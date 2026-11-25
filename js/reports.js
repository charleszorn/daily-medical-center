/* ============================================================
   reports.js - Geração de relatórios PDF
   ============================================================ */

function buildReportData(period, opts) {
  const data = Store.get();
  const today = new Date();
  let start;
  if (period === 'all') {
    start = new Date('2000-01-01');
  } else {
    const days = parseInt(period, 10);
    start = new Date();
    start.setDate(today.getDate() - (days - 1));
    start.setHours(0,0,0,0);
  }
  const inRange = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    return d >= start && d <= today;
  };

  const meds = data.medications;
  const medIds = new Set(meds.map(m => m.id));
  const doses = data.doses.filter(d => inRange(d.date) && medIds.has(d.medId));
  const symptoms = data.symptoms.filter(s => inRange(s.date));
  const doctors = data.doctors || [];

  // symptom counts
  const symCounts = {};
  symptoms.forEach(s => { symCounts[s.type] = (symCounts[s.type] || 0) + 1; });

  // days monitored in range
  const daysSet = new Set();
  doses.forEach(d => daysSet.add(d.date));
  symptoms.forEach(s => daysSet.add(s.date));

  return { period, start, today, meds, doses, symptoms, symCounts, daysSet, doctors, opts };
}

function buildReportOpts() {
  return {
    meds: document.getElementById('incMeds')?.checked ?? true,
    doses: document.getElementById('incDoses')?.checked ?? true,
    symptoms: document.getElementById('incSymptoms')?.checked ?? true,
    stats: document.getElementById('incStats')?.checked ?? true,
    doctors: document.getElementById('incDoctors')?.checked ?? true
  };
}

function updateReportPreview() {
  const periodEl = document.getElementById('reportPeriod');
  const period = periodEl ? periodEl.value : '7';
  const opts = buildReportOpts();
  const rd = buildReportData(period, opts);
  const preview = document.getElementById('reportPreview');
  if (!preview) return;
  const u = (window.currentUser && window.currentUser()) ? window.currentUser() : null;
  const latestWeight = (window.Store && Store.weights) ? Store.weights.latest() : null;
  const weightVal = latestWeight ? latestWeight.weight : (u ? u.weight : null);

  const vitals = [];
  if (weightVal) vitals.push('Peso: ' + weightVal + ' kg');
  if (u && u.age) vitals.push('Idade: ' + u.age + ' anos');
  const vitalsStr = vitals.join(' &nbsp;|&nbsp; ');

  preview.innerHTML = `
    <div class="report-preview__header">
      <div class="report-preview__logo">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><path d="M12 4v16M4 12h16"/></svg>
      </div>
      <div class="report-preview__info">
        <h3 class="report-preview__brand">Daily Medical Center</h3>
        <p class="report-preview__subtitle">Relatório de Saúde do Paciente</p>
        <p class="report-preview__patient"><strong>Paciente:</strong> ${u ? (window.escapeHtml ? escapeHtml(u.name) : u.name) : 'Não identificado'}${u && u.email ? ' (' + (window.escapeHtml ? escapeHtml(u.email) : u.email) + ')' : ''}</p>
        ${vitalsStr ? `<p class="report-preview__vitals">${vitalsStr}</p>` : ''}
        <p class="report-preview__date">Gerado em: ${new Date().toLocaleString('pt-BR')} &nbsp;|&nbsp; Período: ${period === 'all' ? 'Todo o histórico' : 'Últimos ' + period + ' dias'}</p>
      </div>
    </div>
    <div class="report-preview__body">
      <h4>Período do relatório</h4>
      <p class="muted" style="margin-bottom:12px">${formatDate(rd.start.toISOString().slice(0,10))} a ${formatDate(todayISO())} (${period === 'all' ? 'Todo o histórico' : 'Últimos ' + period + ' dias'})</p>

      ${opts.stats ? `
        <h4>Resumo geral</h4>
        <div class="stat-line"><span>Medicamentos cadastrados</span><strong>${rd.meds.length}</strong></div>
        <div class="stat-line"><span>Doses registradas no período</span><strong>${rd.doses.length}</strong></div>
        <div class="stat-line"><span>Sintomas registrados no período</span><strong>${rd.symptoms.length}</strong></div>
        <div class="stat-line"><span>Dias monitorados no período</span><strong>${rd.daysSet.size}</strong></div>
      ` : ''}

      ${opts.meds && rd.meds.length ? `
        <h4>Medicamentos cadastrados (${rd.meds.length})</h4>
        <ul>${rd.meds.map(m => `<li><strong>${window.escapeHtml ? escapeHtml(m.name) : m.name}</strong> — ${m.dosage || ''} (${(CATEGORIES[m.category]||CATEGORIES.other).label})</li>`).join('')}</ul>
      ` : ''}

      ${opts.symptoms && rd.symptoms.length ? `
        <h4>Sintomas mais frequentes</h4>
        <ul>${Object.entries(rd.symCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>`<li>${(SYMPTOMS[k]||SYMPTOMS.other).label}: <strong>${v} ocorrência(s)</strong></li>`).join('')}</ul>
      ` : ''}

      ${opts.doctors && rd.doctors.length ? `
        <h4>Médicos responsáveis</h4>
        <ul>${rd.doctors.map(d=>`<li><strong>${window.escapeHtml ? escapeHtml(d.name) : d.name}</strong>${d.specialty ? ' — ' + (window.escapeHtml ? escapeHtml(d.specialty) : d.specialty) : ''}</li>`).join('')}</ul>
      ` : ''}

      <p class="muted" style="margin-top:16px;font-size:12px">Clique em "Gerar relatório PDF" para baixar o arquivo completo.</p>
    </div>
  `;
}

function generateReport() {
  const period = document.getElementById('reportPeriod').value;
  const opts = buildReportOpts();

  const rd = buildReportData(period, opts);

  // Preview
  updateReportPreview();

  // Generate PDF
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, margin = 16;

    // Header (gradient blue->green, with logo in translucent square)
    // Height: 46mm to comfortably contain all brand and patient info centered vertically
    const headerH = 46;
    for (let i = 0; i < headerH; i++) {
      const t = i / (headerH - 1);
      const rr = Math.round(37 + (16 - 37) * t);
      const gg = Math.round(99 + (185 - 99) * t);
      const bb = Math.round(235 + (129 - 235) * t);
      doc.setFillColor(rr, gg, bb);
      doc.rect(0, i, W, 1, 'F');
    }

    // Logo container (translucent white rounded square)
    const logoX = margin, logoSize = 26;
    const logoY = Math.round((headerH - logoSize) / 2); // 10mm, perfectly centered vertically
    doc.setFillColor(255, 255, 255);
    doc.setGState(new doc.GState({ opacity: 0.18 }));
    doc.roundedRect(logoX, logoY, logoSize, logoSize, 3.5, 3.5, 'F');
    doc.setGState(new doc.GState({ opacity: 1 }));

    // Logo (white cross +)
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(2.4);
    doc.line(logoX + logoSize / 2, logoY + 5.5, logoX + logoSize / 2, logoY + logoSize - 5.5);
    doc.line(logoX + 5.5, logoY + logoSize / 2, logoX + logoSize - 5.5, logoY + logoSize / 2);

    // Header content: ALL aligned to the left, following the logo ("centralizada a esquerda, seguindo a logo")
    const infoX = logoX + logoSize + 6; // 48mm
    const u = (window.currentUser && window.currentUser()) ? window.currentUser() : null;
    const latestWeight = (window.Store && Store.weights) ? Store.weights.latest() : null;
    const weightVal = latestWeight ? latestWeight.weight : (u ? u.weight : null);

    // 1. Site name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(17);
    doc.setFont('helvetica', 'bold');
    doc.text('Daily Medical Center', infoX, 14.5);

    // 2. Subtitle
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(235, 248, 255);
    doc.text('Relatório de Saúde do Paciente', infoX, 19.5);

    // 3. Patient Name & Email
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    const pLabel = 'Paciente: ';
    doc.text(pLabel, infoX, 26);
    doc.setFont('helvetica', 'normal');
    const pVal = (u ? u.name : 'Não identificado') + (u && u.email ? '  (' + u.email + ')' : '');
    doc.text(pVal, infoX + doc.getTextWidth(pLabel), 26);

    // 4. Weight & Age
    const vitals = [];
    if (weightVal) vitals.push('Peso: ' + weightVal + ' kg');
    if (u && u.age) vitals.push('Idade: ' + u.age + ' anos');
    doc.setFontSize(8.5);
    doc.setTextColor(224, 242, 254);
    if (vitals.length > 0) {
      doc.text(vitals.join('   |   '), infoX, 31);
    }

    // 5. Emission Date and Period
    doc.setFontSize(8);
    doc.setTextColor(210, 235, 252);
    const dateLine = 'Gerado em: ' + new Date().toLocaleString('pt-BR') + '   |   Período: ' + (period === 'all' ? 'Todo o histórico' : 'Últimos ' + period + ' dias');
    doc.text(dateLine, infoX, vitals.length > 0 ? 36 : 31.5);

    // BODY START:
    // Header gradient ends at headerH (46mm).
    // Start body at y = 58mm to provide a clear, generous gap of 12mm!
    // At y = 58, 12pt font baseline places top of letters at ~54.5mm (8.5mm below header).
    // Zero chance of invading or touching the header!
    let y = headerH + 12; // 58mm
    doc.setTextColor(15, 23, 42);

    // Period
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text('Período do relatório', margin, y); y += 2;
    // bottom border line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, y, W - margin, y); y += 5;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`${formatDate(rd.start.toISOString().slice(0,10))} a ${formatDate(todayISO())}`, margin, y); y += 4;
    doc.text(`(${period === 'all' ? 'Todo o histórico' : 'Últimos ' + period + ' dias'})`, margin, y); y += 8;

    // Stats
    if (opts.stats) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text('Resumo geral', margin, y); y += 2;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, y, W - margin, y); y += 5;
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const stats = [
        ['Medicamentos cadastrados', String(rd.meds.length)],
        ['Doses registradas no período', String(rd.doses.length)],
        ['Sintomas registrados no período', String(rd.symptoms.length)],
        ['Dias monitorados no período', String(rd.daysSet.size)]
      ];
      stats.forEach(([k,v]) => {
        doc.text(k, margin, y);
        doc.setFont('helvetica', 'bold');
        doc.text(v, W - margin, y, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        y += 5;
      });
      y += 4;
    }

    // Medications
    if (opts.meds && rd.meds.length) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text('Medicamentos cadastrados', margin, y); y += 2;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, y, W - margin, y); y += 5;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      rd.meds.forEach(m => {
        const cat = CATEGORIES[m.category] || CATEGORIES.other;
        const lineH = 4.5;
        const padTop = 2.5;
        const padBottom = 3;
        const lines = [
          { text: `${m.name} (${cat.label})`, bold: true },
          { text: `Dosagem: ${m.dosage} | Quantidade: ${m.amount} ${m.unit} por dose` },
          { text: `Horários: ${(m.times||[]).join(', ') || '—'}` }
        ];
        if (m.notes) lines.push({ text: `Obs: ${m.notes}` });
        const cardH = padTop + lines.length * lineH + padBottom;
        // card background
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, y, W - margin * 2, cardH, 2, 2, 'F');
        // colored left border
        const hex = (cat.color || '#2563eb').replace('#', '');
        const cr = parseInt(hex.slice(0,2), 16);
        const cg = parseInt(hex.slice(2,4), 16);
        const cb = parseInt(hex.slice(4,6), 16);
        doc.setFillColor(cr, cg, cb);
        doc.rect(margin, y, 1.5, cardH, 'F');
        // text
        let ty = y + padTop + 3;
        lines.forEach(ln => {
          doc.setFont('helvetica', ln.bold ? 'bold' : 'normal');
          doc.text(ln.text, margin + 4, ty);
          ty += lineH;
        });
        y += cardH + 5;
        if (y > 265) { doc.addPage(); y = 16; }
      });
      y += 2;
    }

    // Doctors
    if (opts.doctors && rd.doctors && rd.doctors.length) {
      if (y > 250) { doc.addPage(); y = 16; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text('Médicos responsáveis', margin, y); y += 2;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, y, W - margin, y); y += 5;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      const maxW = W - margin * 2 - 6;
      rd.doctors.forEach(d => {
        // Build lines with text wrapping
        const lines = [];
        lines.push({ text: d.name, bold: true });
        if (d.specialty) lines.push({ text: 'Especialidade: ' + d.specialty });
        if (d.notes) lines.push({ text: 'Obs: ' + d.notes });
        // Wrap each line
        const wrapped = [];
        lines.forEach(ln => {
          const split = doc.splitTextToSize(ln.text, maxW);
          split.forEach(s => wrapped.push({ text: s, bold: ln.bold }));
        });
        const lineH = 4.5;
        const padTop = 2.5;
        const padBottom = 3;
        const cardH = padTop + wrapped.length * lineH + padBottom;
        // Card background
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, y, W - margin * 2, cardH, 2, 2, 'F');
        // Colored left border (blue)
        doc.setFillColor(37, 99, 235);
        doc.rect(margin, y, 1.5, cardH, 'F');
        // Text
        let ty = y + padTop + 3;
        wrapped.forEach(ln => {
          doc.setFont('helvetica', ln.bold ? 'bold' : 'normal');
          doc.text(ln.text, margin + 4, ty);
          ty += lineH;
        });
        y += cardH + 4;
        if (y > 265) { doc.addPage(); y = 16; }
      });
      y += 2;
    }

    // Doses
    if (opts.doses && rd.doses.length) {
      if (y > 250) { doc.addPage(); y = 16; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text('Doses tomadas no período', margin, y); y += 2;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, y, W - margin, y); y += 5;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      rd.doses.slice().sort((a,b)=> (a.date+a.time).localeCompare(b.date+b.time)).forEach(d => {
        const m = Store.medications.byId(d.medId);
        const name = m ? m.name : 'Medicamento removido';
        doc.text(`${formatDate(d.date)} ${d.time} - ${name}${d.notes ? ' (' + d.notes + ')' : ''}`, margin, y); y += 5;
        if (y > 275) { doc.addPage(); y = 16; }
      });
      y += 2;
    }

    // Symptoms
    if (opts.symptoms && rd.symptoms.length) {
      if (y > 250) { doc.addPage(); y = 16; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text('Sintomas registrados no período', margin, y); y += 2;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, y, W - margin, y); y += 5;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      rd.symptoms.slice().sort((a,b)=> (a.date+a.time).localeCompare(b.date+b.time)).forEach(s => {
        const sym = SYMPTOMS[s.type] || SYMPTOMS.other;
        doc.text(`${formatDate(s.date)} ${s.time} - ${sym.label} (${SEVERITY_LABEL[s.severity]})${s.notes ? ' - ' + s.notes : ''}`, margin, y); y += 5;
        if (y > 275) { doc.addPage(); y = 16; }
      });
      y += 2;

      // symptom frequency
      if (y > 230) { doc.addPage(); y = 16; }
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text('Frequência de sintomas', margin, y); y += 2;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, y, W - margin, y); y += 5;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      Object.entries(rd.symCounts).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => {
        const sym = SYMPTOMS[k] || SYMPTOMS.other;
        doc.text(`${sym.label}: ${v} ocorrência(s)`, margin, y); y += 4;
      });
    }

    // Footer
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setTextColor(148,163,184);
      doc.text(`Daily Medical Center - Relatório de saúde | Página ${p} de ${pages}`, W/2, 290, { align: 'center' });
    }

    const fileName = `relatorio-saude-${todayISO()}.pdf`;
    doc.save(fileName);

    // record
    Store.reports.add({
      name: fileName,
      period: period,
      date: todayISO(),
      summary: `${rd.meds.length} medicamentos, ${rd.doses.length} doses, ${rd.symptoms.length} sintomas, ${rd.daysSet.size} dias`
    });
    renderReportList();

    toast('Relatório PDF gerado com sucesso', 'success');
  } catch (err) {
    console.error(err);
    toast('Erro ao gerar PDF: ' + err.message, 'error');
  }
}

function renderReportList() {
  const container = document.getElementById('reportList');
  if (!container) return;
  const list = Store.reports.all().slice().reverse();
  if (list.length === 0) {
    container.innerHTML = '<p class="muted">Nenhum relatório gerado ainda.</p>';
    return;
  }
  container.innerHTML = list.map(r => `
    <div class="report-list__item">
      <div class="report-list__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
      </div>
      <div class="report-list__info">
        <div class="report-list__name">${escapeHtml(r.name)}</div>
        <div class="report-list__meta">${formatDate(r.date)} · ${r.summary}</div>
      </div>
      <div class="report-list__actions">
        <button class="btn btn--ghost btn--sm" onclick="regenerateReport('${r.period}')" title="Gerar novamente">↻ Regenerar</button>
        <button class="btn btn--ghost btn--sm btn--danger" onclick="deleteReport('${r.id}')" title="Excluir registro">✕</button>
      </div>
    </div>
  `).join('');
}

// Regenera um relatório antigo (recria o PDF com os dados atuais do período)
function regenerateReport(period) {
  const sel = document.getElementById('reportPeriod');
  if (sel) sel.value = period;
  generateReport();
}
window.regenerateReport = regenerateReport;

// Exclui um registro de relatório antigo
function deleteReport(id) {
  if (!confirm('Excluir este registro de relatório?')) return;
  if (Store.reports && Store.reports.remove) Store.reports.remove(id);
  renderReportList();
  toast('Registro excluído', 'info');
}
window.deleteReport = deleteReport;

// Auto-update preview when options change
['reportPeriod', 'incMeds', 'incDoses', 'incSymptoms', 'incStats', 'incDoctors'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', updateReportPreview);
});

// Initial preview (delayed to ensure DOM and auth are ready)
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(updateReportPreview, 100);
});
setTimeout(updateReportPreview, 500);
setTimeout(updateReportPreview, 1500);

document.getElementById('generateReportBtn')?.addEventListener('click', generateReport);

window.renderers.reports = () => { renderReportList(); updateReportPreview(); };
window.generateReport = generateReport;
window.renderReportList = renderReportList;
window.buildReportData = buildReportData;
