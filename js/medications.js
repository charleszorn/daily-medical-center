/* ============================================================
   medications.js - Cadastro e gerenciamento de medicamentos
   ============================================================ */

function openMedModal(med = null) {
  try {
    const title = document.getElementById('medModalTitle');
    if (title) title.textContent = med ? 'Editar medicamento' : 'Novo medicamento';
    const medId = document.getElementById('medId');
    if (medId) medId.value = med ? med.id : '';
    const medName = document.getElementById('medName');
    if (medName) medName.value = med ? med.name : '';
    const medCategory = document.getElementById('medCategory');
    if (medCategory) medCategory.value = med ? med.category : 'cardiac';
    const medDosage = document.getElementById('medDosage');
    if (medDosage) medDosage.value = med ? med.dosage : '';
    const medAmount = document.getElementById('medAmount');
    if (medAmount) medAmount.value = med ? med.amount : '1';
    const medUnit = document.getElementById('medUnit');
    if (medUnit) medUnit.value = med ? med.unit : 'comprimido';
    const medTimes = document.getElementById('medTimes');
    if (medTimes) medTimes.value = med ? (med.times || []).join(', ') : '';
    const mf = document.getElementById('medFrequency');
    if (mf) mf.value = med ? (med.frequency || 'daily') : 'daily';
    // days of week
    document.querySelectorAll('#medFreqWeekly input[type="checkbox"]').forEach(cb => {
      cb.checked = med && Array.isArray(med.daysOfWeek) ? med.daysOfWeek.includes(Number(cb.value)) : false;
    });
    const ms = document.getElementById('medStartDate');
    if (ms) ms.value = med ? (med.startDate || '') : '';
    const md = document.getElementById('medDayOfMonth');
    if (md) md.value = med ? (med.dayOfMonth || '') : '';
    // usage type
    const mu = document.getElementById('medUsageType');
    if (mu) mu.value = med ? (med.usageType || 'continuous') : 'continuous';
    const mps = document.getElementById('medPeriodStart');
    if (mps) mps.value = med ? (med.periodStart || '') : '';
    const mpe = document.getElementById('medPeriodEnd');
    if (mpe) mpe.value = med ? (med.periodEnd || '') : '';
    document.querySelectorAll('#monthPicker input[type="checkbox"]').forEach(cb => {
      cb.checked = med && Array.isArray(med.seasonMonths) ? med.seasonMonths.includes(Number(cb.value)) : false;
    });
    try { updateMedFreqFields(); } catch (e) { console.warn('updateMedFreqFields error:', e); }
    try { updateMedUsageFields(); } catch (e) { console.warn('updateMedUsageFields error:', e); }
    const medNotes = document.getElementById('medNotes');
    if (medNotes) medNotes.value = med ? (med.notes || '') : '';
    const color = med ? (med.color || '#2563eb') : '#2563eb';
    const medColor = document.getElementById('medColor');
    if (medColor) medColor.value = color;
    document.querySelectorAll('.color-swatch').forEach(s => {
      s.classList.toggle('active', s.dataset.color === color);
    });
    // reset confirm view
    if (typeof hideMedConfirm === 'function') hideMedConfirm();
    const form = document.getElementById('medForm');
    if (form) form.hidden = false;
    openModal('medModal');
  } catch (err) {
    console.error('Erro ao abrir modal de medicamento:', err);
    if (typeof toast === 'function') toast('Erro ao abrir formulário: ' + (err.message || err), 'error');
  }
}

function getMedColorSoft(color) {
  // map color to soft bg
  const map = {
    '#2563eb': '#eff6ff', '#10b981': '#ecfdf5', '#f59e0b': '#fffbeb',
    '#ef4444': '#fef2f2', '#8b5cf6': '#f5f3ff', '#ec4899': '#fdf2f8',
    '#06b6d4': '#ecfeff', '#64748b': '#f1f5f9', '#6366f1': '#eef2ff',
    '#f97316': '#fff7ed',
    '#a855f7': '#faf5ff',
    '#d946ef': '#fdf4ff'
  };
  return map[color] || '#f1f5f9';
}

function renderMedGrid(filterCat = 'all', search = '') {
  const grid = document.getElementById('medGrid');
  const empty = document.getElementById('medEmpty');
  if (!grid) return;
  let meds = Store.medications.all();
  if (filterCat && filterCat !== 'all') meds = meds.filter(m => m.category === filterCat);
  if (search) {
    const q = search.toLowerCase();
    meds = meds.filter(m => m.name.toLowerCase().includes(q) || (m.notes||'').toLowerCase().includes(q));
  }
  if (meds.length === 0) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  // Agrupa medicamentos com o mesmo nome (case-insensitive) em um único card,
  // unindo os horários e mantendo os IDs para edição/exclusão
  const groups = {};
  meds.forEach(m => {
    const key = (m.name || '').trim().toLowerCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });
  const grouped = Object.values(groups).map(list => {
    const primary = list[0];
    const allTimes = [...new Set(list.flatMap(m => m.times || []))].sort();
    return { primary, list, times: allTimes };
  });
  grid.innerHTML = grouped.map(g => {
    const m = g.primary;
    const cat = CATEGORIES[m.category] || CATEGORIES.other;
    const color = m.color || cat.color;
    const soft = getMedColorSoft(color);
    const times = g.times.map(t => `<span class="med-card__time">${t}</span>`).join('');
    const groupedBadge = g.list.length > 1 ? `<span class="med-card__group-badge">${g.list.length} registros agrupados</span>` : '';
    const ids = g.list.map(x => x.id);
    return `
      <div class="med-card" style="--med-color:${color}; --med-soft:${soft}">
        <div class="med-card__header">
          <div class="med-card__icon" style="background:${soft}; color:${color}">
            ${icon(cat.icon)}
          </div>
          <div class="med-card__actions">
            <button class="med-card__action" title="Editar" onclick="editMed('${m.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1"/></svg>
            </button>
            <button class="med-card__action med-card__action--danger" title="Excluir todos os registros deste medicamento" onclick="deleteMedGroup(${JSON.stringify(ids)})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 0-2 2H7a2 2 0 0 0-2-2V6M8 6V4a2 2 0 0 0 2-2h4a2 2 0 0 0 2 2v2"/></svg>
            </button>
          </div>
        </div>
        <div class="med-card__name">${escapeHtml(m.name)}${groupedBadge}</div>
        <div class="med-card__category">${cat.label}${m.frequency && m.frequency !== 'daily' ? ' · ' + ({weekly:'Semanal',biweekly:'Quinzenal',monthly:'Mensal'}[m.frequency] || '') : ''}${m.usageType && m.usageType !== 'continuous' ? ' · ' + ({period:'Por período',seasonal:'Sazonal',asNeeded:'Sob demanda'}[m.usageType] || '') : ''}</div>
        <div class="med-card__details">
          <div class="med-card__detail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M5 7h14"/></svg>
            <span>Dosagem: <strong>${escapeHtml(m.dosage)}</strong></span>
          </div>
          <div class="med-card__detail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 8.5-8.5a4.95 4.95 0 1 0-7-7l-8.5 8.5a4.95 4.95 0 0 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
            <span>Quantidade: <strong>${m.amount} ${m.unit}</strong> por dose</span>
          </div>
          <div class="med-card__detail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
            <span>Horários:</span>
          </div>
          <div class="med-card__times">${times || '<span class="med-card__time">—</span>'}</div>
        </div>
        ${m.notes ? `<div class="med-card__notes">"${escapeHtml(m.notes)}"</div>` : ''}
      </div>
    `;
  }).join('');
}

function editMed(id) {
  const med = Store.medications.byId(id);
  if (med) openMedModal(med);
}
async function deleteMed(id) {
  if (confirm('Deseja realmente excluir este medicamento?')) {
    await Store.medications.remove(id);
    toast('Medicamento excluído com sucesso!', 'success');
    renderMedGrid(currentCat, document.getElementById('medSearch')?.value || '');
    updateDashboard();
  }
}
async function deleteMedGroup(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const msg = ids.length > 1
    ? `Deseja excluir todos os ${ids.length} registros deste medicamento?`
    : 'Deseja realmente excluir este medicamento?';
  if (!confirm(msg)) return;
  for (const id of ids) {
    await Store.medications.remove(id);
  }
  toast(ids.length > 1 ? `${ids.length} registros excluídos` : 'Medicamento excluído', 'success');
  renderMedGrid(currentCat, document.getElementById('medSearch')?.value || '');
  updateDashboard();
  renderSchedule();
  if (window.Notifications) window.Notifications.scheduleToday();
}

let currentCat = 'all';
window.renderMedications = (cat) => {
  if (cat) currentCat = cat;
  renderMedGrid(currentCat, document.getElementById('medSearch')?.value || '');
};

// Mostra/oculta campos conforme a frequência escolhida
function updateMedFreqFields() {
  const freq = document.getElementById('medFrequency')?.value || 'daily';
  const w = document.getElementById('medFreqWeekly');
  const b = document.getElementById('medFreqBiweekly');
  const m = document.getElementById('medFreqMonthly');
  if (w) w.hidden = freq !== 'weekly';
  if (b) b.hidden = freq !== 'biweekly';
  if (m) m.hidden = freq !== 'monthly';
}

// Mostra/oculta campos conforme o tipo de uso
function updateMedUsageFields() {
  const u = document.getElementById('medUsageType')?.value || 'continuous';
  const p = document.getElementById('medUsagePeriod');
  const s = document.getElementById('medUsageSeasonal');
  const a = document.getElementById('medUsageAsNeeded');
  if (p) p.hidden = u !== 'period';
  if (s) s.hidden = u !== 'seasonal';
  if (a) a.hidden = u !== 'asNeeded';
}

// search
document.addEventListener('DOMContentLoaded', () => {
  const s = document.getElementById('medSearch');
  if (s) s.addEventListener('input', () => renderMedGrid(currentCat, s.value));
  const mt = document.getElementById('medTimes');
  if (mt) mt.addEventListener('blur', () => {
    mt.value = mt.value.split(',').map(t => normalizeTime(t.trim())).filter(Boolean).join(', ');
  });
  const mf = document.getElementById('medFrequency');
  if (mf) mf.addEventListener('change', updateMedFreqFields);
  updateMedFreqFields();
  const mu = document.getElementById('medUsageType');
  if (mu) mu.addEventListener('change', updateMedUsageFields);
  updateMedUsageFields();
});

let pendingMed = null;
let pendingMedId = null;

function showMedConfirm(med, id) {
  pendingMed = med;
  pendingMedId = id;
  const details = document.getElementById('medConfirmDetails');
  const cat = CATEGORIES[med.category] || CATEGORIES.other;
  const freqLabel = {daily:'Diário',weekly:'Semanal',biweekly:'Quinzenal',monthly:'Mensal'}[med.frequency] || med.frequency;
  const usageLabel = {continuous:'Uso contínuo',period:'Por período',seasonal:'Sazonal',asNeeded:'Sob demanda'}[med.usageType] || med.usageType;
  let extra = '';
  if (med.frequency === 'weekly' && med.daysOfWeek.length) {
    const names = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    extra += `<div><strong>Dias:</strong> ${med.daysOfWeek.map(d=>names[d]).join(', ')}</div>`;
  }
  if (med.frequency === 'biweekly' && med.startDate) extra += `<div><strong>Início:</strong> ${med.startDate}</div>`;
  if (med.frequency === 'monthly' && med.dayOfMonth) extra += `<div><strong>Dia do mês:</strong> ${med.dayOfMonth}</div>`;
  if (med.usageType === 'period' && (med.periodStart || med.periodEnd)) extra += `<div><strong>Período:</strong> ${med.periodStart || '—'} a ${med.periodEnd || '—'}</div>`;
  if (med.usageType === 'seasonal' && med.seasonMonths.length) {
    const mnames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    extra += `<div><strong>Meses:</strong> ${med.seasonMonths.map(m=>mnames[m-1]).join(', ')}</div>`;
  }
  details.innerHTML = `
    <div class="med-confirm__row"><strong>Nome:</strong> ${escapeHtml(med.name)}</div>
    <div class="med-confirm__row"><strong>Categoria:</strong> ${cat.label}</div>
    <div class="med-confirm__row"><strong>Dosagem:</strong> ${escapeHtml(med.dosage)}</div>
    <div class="med-confirm__row"><strong>Quantidade:</strong> ${escapeHtml(med.amount)} ${med.unit} por dose</div>
    <div class="med-confirm__row"><strong>Horários:</strong> ${(med.times||[]).join(', ') || '—'}</div>
    <div class="med-confirm__row"><strong>Frequência:</strong> ${freqLabel}</div>
    <div class="med-confirm__row"><strong>Tipo de uso:</strong> ${usageLabel}</div>
    ${extra}
    ${med.notes ? `<div class="med-confirm__row"><strong>Obs:</strong> ${escapeHtml(med.notes)}</div>` : ''}
    <div class="med-confirm__row"><strong>Cor:</strong> <span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${med.color};vertical-align:middle;margin-left:4px"></span></div>
  `;
  document.getElementById('medForm').hidden = true;
  document.getElementById('medConfirmView').hidden = false;
}

function hideMedConfirm() {
  pendingMed = null;
  pendingMedId = null;
  document.getElementById('medConfirmView').hidden = true;
  document.getElementById('medForm').hidden = false;
}

// form submit -> show confirmation
document.getElementById('medForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  try {
    const id = document.getElementById('medId').value;
    const timesRaw = document.getElementById('medTimes').value;
    const times = timesRaw.split(',').map(t => normalizeTime(t.trim())).filter(Boolean);
    const mf = document.getElementById('medFrequency');
    const frequency = mf ? mf.value : 'daily';
    const daysOfWeek = frequency === 'weekly'
      ? [...document.querySelectorAll('#medFreqWeekly input[type="checkbox"]:checked')].map(cb => Number(cb.value))
      : [];
    const ms = document.getElementById('medStartDate');
    const startDate = frequency === 'biweekly' ? (ms ? ms.value : '') : '';
    const md = document.getElementById('medDayOfMonth');
    const dayOfMonth = frequency === 'monthly' ? (md ? (parseInt(md.value, 10) || null) : null) : null;
    const mu = document.getElementById('medUsageType');
    const usageType = mu ? mu.value : 'continuous';
    const mps = document.getElementById('medPeriodStart');
    const periodStart = usageType === 'period' ? (mps ? mps.value : '') : '';
    const mpe = document.getElementById('medPeriodEnd');
    const periodEnd = usageType === 'period' ? (mpe ? mpe.value : '') : '';
    const seasonMonths = usageType === 'seasonal'
      ? [...document.querySelectorAll('#monthPicker input[type="checkbox"]:checked')].map(cb => Number(cb.value))
      : [];
    const nameEl = document.getElementById('medName');
    const catEl = document.getElementById('medCategory');
    const dosageEl = document.getElementById('medDosage');
    const amountEl = document.getElementById('medAmount');
    const unitEl = document.getElementById('medUnit');
    const notesEl = document.getElementById('medNotes');
    const colorEl = document.getElementById('medColor');
    const med = {
      name: (nameEl ? nameEl.value : '').trim() || 'Medicamento',
      category: catEl ? catEl.value : 'other',
      dosage: (dosageEl ? dosageEl.value : '').trim() || '—',
      amount: (amountEl ? amountEl.value : '1').trim() || '1',
      unit: unitEl ? unitEl.value : 'comprimido',
      times: times.length ? times : [],
      frequency: frequency,
      daysOfWeek: daysOfWeek,
      startDate: startDate,
      dayOfMonth: dayOfMonth,
      usageType: usageType,
      periodStart: periodStart,
      periodEnd: periodEnd,
      seasonMonths: seasonMonths,
      notes: (notesEl ? notesEl.value : '').trim(),
      color: (colorEl ? colorEl.value : '#2563eb')
    };
    showMedConfirm(med, id);
  } catch (err) {
    console.error('Erro ao montar medicamento:', err);
    toast('Erro: ' + (err.message || err), 'error');
  }
});

// dashboard update hook
function updateDashboard() {
  if (window.renderDashboard) window.renderDashboard();
}
window.updateDashboard = updateDashboard;

// escape html
function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
// Confirmação de cadastro/edição
document.getElementById('medConfirmOk')?.addEventListener('click', async () => {
  if (!pendingMed) return;
  try {
    if (pendingMedId) {
      await Store.medications.update(pendingMedId, pendingMed);
      toast('Medicamento atualizado e salvo na nuvem!', 'success');
    } else {
      const added = await Store.medications.add(pendingMed);
      console.log('Medication added:', added ? added.id : 'null');
      toast('Medicamento cadastrado e salvo na nuvem!', 'success');
    }
    hideMedConfirm();
    closeModal('medModal');
    const form = document.getElementById('medForm');
    if (form) form.reset();
    // reset conditional fields visibility
    if (typeof updateMedFreqFields === 'function') updateMedFreqFields();
    if (typeof updateMedUsageFields === 'function') updateMedUsageFields();
    renderMedGrid(currentCat, document.getElementById('medSearch')?.value || '');
    updateDashboard();
    renderSchedule();
    if (window.Notifications) window.Notifications.scheduleToday();
  } catch (err) {
    console.error('Erro ao salvar medicamento:', err);
    toast('Erro ao salvar: ' + (err.message || err), 'error');
  }
});

document.getElementById('medConfirmCancel')?.addEventListener('click', () => {
  hideMedConfirm();
});

// Reset confirm view when opening modal
const _origOpenMedModal = openMedModal;
openMedModal = function(med) {
  hideMedConfirm();
  document.getElementById('medForm').hidden = false;
  _origOpenMedModal(med);
};

window.escapeHtml = escapeHtml;

window.renderers.medications = () => renderMedGrid(currentCat, document.getElementById('medSearch')?.value || '');
window.openMedModal = openMedModal;
window.editMed = editMed;
window.deleteMed = deleteMed;
