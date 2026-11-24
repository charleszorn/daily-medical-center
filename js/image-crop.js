/* ============================================================
   image-crop.js - Upload e recorte/posicionamento de fotos de perfil
   ============================================================ */
(function () {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const OUTPUT_SIZE = 192; // px - tamanho ideal e leve para avatares (evita estouro de payload)

  let currentImage = null;
  let scale = 1;
  let offsetX = 0, offsetY = 0;
  let dragging = false, dragStartX = 0, dragStartY = 0, dragStartOffsetX = 0, dragStartOffsetY = 0;
  let onSaveCallback = null;

  const modal = () => document.getElementById('cropModal');
  const viewport = () => document.getElementById('cropViewport');
  const img = () => document.getElementById('cropImage');
  const zoomSlider = () => document.getElementById('cropZoom');
  const saveBtn = () => document.getElementById('cropSaveBtn');

  function openCropper(file, onSave) {
    if (!file || !file.type.startsWith('image/')) {
      if (window.toast) toast('Selecione um arquivo de imagem válido.', 'error');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      if (window.toast) toast('Arquivo muito grande. Máximo: 10 MB.', 'error');
      return;
    }
    onSaveCallback = onSave;
    const reader = new FileReader();
    reader.onload = (e) => {
      const image = new Image();
      image.onload = () => {
        currentImage = image;
        scale = 1;
        offsetX = 0;
        offsetY = 0;
        if (zoomSlider()) zoomSlider().value = 1;
        openModal('cropModal');
        // Update transform after modal is visible (viewport has dimensions)
        let tries = 0;
        function tryUpdate() {
          const vp = viewport();
          if (vp && vp.clientWidth > 0) {
            updateTransform();
          } else if (tries < 20) {
            tries++;
            requestAnimationFrame(tryUpdate);
          }
        }
        requestAnimationFrame(tryUpdate);
      };
      image.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function updatePreview() {
    const preview = document.getElementById('cropPreviewAvatar');
    if (!preview || !currentImage) return;
    const vp = viewport();
    const vpSize = vp.clientWidth || 320;
    const el = img();
    const ts = parseFloat(el.dataset.totalScale);
    if (!ts) return;
    const imgW = currentImage.width;
    const imgH = currentImage.height;
    const baseScale = Math.max(vpSize / imgW, vpSize / imgH);
    const cropSize = vpSize / ts;
    const centerX = imgW / 2 - offsetX / ts;
    const centerY = imgH / 2 - offsetY / ts;
    const sx = centerX - cropSize / 2;
    const sy = centerY - cropSize / 2;
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(currentImage, sx, sy, cropSize, cropSize, 0, 0, 96, 96);
    preview.style.backgroundImage = 'url(' + canvas.toDataURL('image/jpeg', 0.85) + ')';
    preview.style.backgroundSize = 'cover';
    preview.style.backgroundPosition = 'center';
    const span = preview.querySelector('span');
    if (span) span.style.display = 'none';
  }

  function updateTransform() {
    const el = img();
    if (!el || !currentImage) return;
    const vp = viewport();
    const vpSize = vp.clientWidth || 320;
    // base scale to cover the viewport
    const baseScale = Math.max(vpSize / currentImage.width, vpSize / currentImage.height);
    const totalScale = baseScale * scale;
    const w = currentImage.width * totalScale;
    const h = currentImage.height * totalScale;
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    // center the image, then apply offset
    const tx = -w / 2 + offsetX;
    const ty = -h / 2 + offsetY;
    el.style.transform = `translate(${tx}px, ${ty}px)`;
    // store for crop
    el.dataset.totalScale = totalScale;
    el.dataset.baseW = w;
    el.dataset.baseH = h;

    // update preview avatar
    updatePreview();
  }

  function clampOffsets() {
    const el = img();
    const vp = viewport();
    const vpSize = vp.clientWidth || 320;
    const w = parseFloat(el.dataset.baseW) || vpSize;
    const h = parseFloat(el.dataset.baseH) || vpSize;
    const maxX = Math.max(0, (w - vpSize) / 2);
    const maxY = Math.max(0, (h - vpSize) / 2);
    offsetX = Math.max(-maxX, Math.min(maxX, offsetX));
    offsetY = Math.max(-maxY, Math.min(maxY, offsetY));
  }

  // Drag
  function onPointerDown(e) {
    dragging = true;
    const pt = e.touches ? e.touches[0] : e;
    dragStartX = pt.clientX;
    dragStartY = pt.clientY;
    dragStartOffsetX = offsetX;
    dragStartOffsetY = offsetY;
    e.preventDefault();
  }
  function onPointerMove(e) {
    if (!dragging) return;
    const pt = e.touches ? e.touches[0] : e;
    offsetX = dragStartOffsetX + (pt.clientX - dragStartX);
    offsetY = dragStartOffsetY + (pt.clientY - dragStartY);
    clampOffsets();
    updateTransform();
    e.preventDefault();
  }
  function onPointerUp() { dragging = false; }

  // Zoom
  function onZoom(e) {
    scale = parseFloat(e.target.value);
    clampOffsets();
    updateTransform();
  }

  // Save: crop to canvas
  function save() {
    if (!currentImage) return;
    const el = img();
    const vp = viewport();
    const vpSize = vp.clientWidth || 320;
    const totalScale = parseFloat(el.dataset.totalScale);
    // The visible region is the viewport (circle). We crop the image to the viewport.
    const imgW = currentImage.width;
    const imgH = currentImage.height;
    // base scale
    const baseScale = Math.max(vpSize / imgW, vpSize / imgH);
    const ts = baseScale * scale;
    // rendered image size
    const renderedW = imgW * ts;
    const renderedH = imgH * ts;
    // offset in image coords: viewport center maps to image center + offset
    const centerX = imgW / 2 - offsetX / ts;
    const centerY = imgH / 2 - offsetY / ts;
    const cropSize = vpSize / ts;
    const sx = centerX - cropSize / 2;
    const sy = centerY - cropSize / 2;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(currentImage, sx, sy, cropSize, cropSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

    if (onSaveCallback) onSaveCallback(dataUrl);
    closeModal('cropModal');
    currentImage = null;
    onSaveCallback = null;
  }

  // Wire events
  document.addEventListener('DOMContentLoaded', () => {
    const vp = viewport();
    if (vp) {
      vp.addEventListener('mousedown', onPointerDown);
      vp.addEventListener('mousemove', onPointerMove);
      vp.addEventListener('mouseup', onPointerUp);
      vp.addEventListener('mouseleave', onPointerUp);
      vp.addEventListener('touchstart', onPointerDown, { passive: false });
      vp.addEventListener('touchmove', onPointerMove, { passive: false });
      vp.addEventListener('touchend', onPointerUp);
    }
    const zs = zoomSlider();
    if (zs) zs.addEventListener('input', onZoom);
    const sb = saveBtn();
    if (sb) sb.addEventListener('click', save);
  });

  // Expose
  window.openImageCropper = openCropper;
  window.closeImageCropper = () => { currentImage = null; onSaveCallback = null; closeModal('cropModal'); };
})();