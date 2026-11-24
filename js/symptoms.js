/* ============================================================
   symptoms.js - Registro de sintomas/estado do paciente
   ============================================================ */

function openSymptomModal() {
  document.getElementById('symptomForm').reset();
  document.getElementById('symptomDate').value = todayISO();
  document.getElementById('symptomTime').value = nowTime();
  openModal('symptomModal');
}

function renderSymptomTiles() {
  const grid = document.getElementById('symptomGrid');
  if (!grid) return;
  grid.innerHTML = Object.keys(SYMPTOMS).map(k => {
    const s = SYMPTOMS[k];
    return `
      <div class="symptom-tile" data-symptom="${k}">
        <div class="symptom-tile__icon">${icon(s.icon)}</div>
        <span class="symptom-tile__label">${s.label}</span>
      </div>
    `;
  }).join('');
  grid.querySelectorAll('.symptom-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const sel = document.getElementById('symptomType');
      sel.value = tile.dataset.symptom;
      openSymptomModal();
    });
  });
}

function renderSymptomHistory() {
  const container = document.getElementById('symptomHistory');
  if (!container) return;
  const list = Store.symptoms.all().slice().sort((a,b) => (b.date+b.time).localeCompare(a.date+a.time)).slice(0, 12);
  if (list.length === 0) {
    container.innerHTML = '<p class="muted">Nenhum sintoma registrado ainda.</p>';
    return;
  }
  container.innerHTML = list.map(s => {
    const sym = SYMPTOMS[s.type] || SYMPTOMS.other;
    const sevClass = 'severity-badge--' + s.severity;
    return `
      <div class="symptom-history__item">
        <div class="symptom-history__dot" style="background:${severityColor(s.severity)}"></div>
        <div class="symptom-history__icon" style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:#fef2f2;color:#ef4444">${icon(sym.icon)}</div>
        <div class="symptom-history__info">
          <div class="symptom-history__name">${sym.label}</div>
          <div class="symptom-history__meta">${formatDate(s.date)} às ${s.time}${s.notes ? ' · ' + escapeHtml(s.notes) : ''}</div>
        </div>
        <span class="severity-badge ${sevClass}">${SEVERITY_LABEL[s.severity]}</span>
        <button class="med-card__action med-card__action--danger" title="Excluir" onclick="deleteSymptom('${s.id}')" style="margin-left:4px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 0-2 2H7a2 2 0 0 0-2-2V6M8 6V4a2 2 0 0 0 2-2h4a2 2 0 0 0 2 2v2"/></svg>
        </button>
      </div>
    `;
  }).join('');
}

function severityColor(sev) {
  return sev === 'mild' ? '#10b981' : sev === 'moderate' ? '#f59e0b' : '#ef4444';
}

function deleteSymptom(id) {
  if (confirm('Excluir este registro?')) {
    Store.symptoms.remove(id);
    toast('Registro excluído', 'success');
    renderSymptomHistory();
    updateDashboard();
    renderHistory();
  }
}

// recent symptoms on dashboard
function renderRecentSymptoms() {
  const container = document.getElementById('recentSymptoms');
  if (!container) return;
  const list = Store.symptoms.all().slice().sort((a,b) => (b.date+b.time).localeCompare(a.date+a.time)).slice(0,5);
  if (list.length === 0) {
    container.innerHTML = '<p class="muted">Nenhum sintoma registrado.</p>';
    return;
  }
  container.innerHTML = list.map(s => {
    const sym = SYMPTOMS[s.type] || SYMPTOMS.other;
    return `
      <div class="symptom-item">
        <div class="symptom-item__icon">${icon(sym.icon)}</div>
        <div class="symptom-item__info">
          <div class="symptom-item__name">${sym.label}</div>
          <div class="symptom-item__meta">${formatDate(s.date)} · ${SEVERITY_LABEL[s.severity]}</div>
        </div>
      </div>
    `;
  }).join('');
}

document.getElementById('symptomForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const sym = {
    type: document.getElementById('symptomType').value,
    severity: document.getElementById('symptomSeverity').value,
    date: document.getElementById('symptomDate').value,
    time: normalizeTime(document.getElementById('symptomTime').value),
    notes: document.getElementById('symptomNotes').value.trim()
  };
  Store.symptoms.add(sym);
  toast('Sintoma registrado', 'success');
  closeModal('symptomModal');
  if (window.Store && Store.syncToCloud) Store.syncToCloud().catch(e => console.error('syncToCloud error', e));
  renderSymptomHistory();
  renderRecentSymptoms();
  updateDashboard();
  renderHistory();
});

window.renderers.symptoms = () => {
  renderSymptomTiles();
  renderSymptomHistory();
};

window.openSymptomModal = openSymptomModal;
window.deleteSymptom = deleteSymptom;
window.renderRecentSymptoms = renderRecentSymptoms;
window.renderSymptomHistory = renderSymptomHistory;
window.severityColor = severityColor;
