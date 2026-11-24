/* ============================================================
   schedule.js - Horários e doses do dia
   ============================================================ */

function isMedDueToday(med) {
  // Tipo de uso
  const usageType = med.usageType || 'continuous';
  const today = new Date();
  const todayStr = todayISO();
  if (usageType === 'asNeeded') return false; // PRN: não aparece na agenda diária
  if (usageType === 'period') {
    if (med.periodStart && todayStr < med.periodStart) return false;
    if (med.periodEnd && todayStr > med.periodEnd) return false;
  }
  if (usageType === 'seasonal') {
    const months = Array.isArray(med.seasonMonths) ? med.seasonMonths : [];
    if (months.length > 0 && !months.includes(today.getMonth() + 1)) return false;
  }
  // Frequência
  const freq = med.frequency || 'daily';
  if (freq === 'daily') return true;
  if (freq === 'weekly') {
    const days = Array.isArray(med.daysOfWeek) ? med.daysOfWeek : [];
    return days.includes(today.getDay());
  }
  if (freq === 'biweekly') {
    if (!med.startDate) return true;
    const start = new Date(med.startDate + 'T00:00:00');
    const diffDays = Math.floor((today - start) / (1000*60*60*24));
    return diffDays >= 0 && (diffDays % 14 === 0);
  }
  if (freq === 'monthly') {
    const dom = med.dayOfMonth ? Number(med.dayOfMonth) : null;
    if (!dom) return true;
    return today.getDate() === dom;
  }
  return true;
}

function getTodaySchedule() {
  // Build list of scheduled doses for today based on medications
  const meds = Store.medications.all();
  const today = todayISO();
  const taken = Store.doses.byDate(today);
  const items = [];
  meds.forEach(m => {
    if (!isMedDueToday(m)) return;
    (m.times || []).forEach(rawT => {
      const t = normalizeTime(rawT);
      const doseRecord = taken.find(d => d.medId === m.id && d.time === t);
      items.push({
        med: m,
        time: t,
        taken: !!doseRecord,
        doseId: doseRecord ? doseRecord.id : null,
        notes: doseRecord ? doseRecord.notes : ''
      });
    });
  });
  items.sort((a,b) => a.time.localeCompare(b.time));
  return items;
}

function renderSchedule() {
  const container = document.getElementById('timeline');
  const empty = document.getElementById('scheduleEmpty');
  if (!container) return;
  const items = getTodaySchedule();
  if (items.length === 0) {
    container.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  // group by time
  const groups = {};
  items.forEach(it => {
    if (!groups[it.time]) groups[it.time] = [];
    groups[it.time].push(it);
  });
  let html = '';
  Object.keys(groups).sort().forEach(time => {
    const groupItems = groups[time];
    const pendingCount = groupItems.filter(it => !it.taken).length;
    const allTaken = pendingCount === 0;
    html += `<div class="timeline__group">`;
    html += `<div class="timeline__group-header">`;
    html += `<div class="timeline__time">${time}</div>`;
    if (pendingCount > 0) {
      html += `<button class="btn btn--primary btn--sm timeline__mark-all" onclick="markAllDoses('${time}')">Marcar todos (${pendingCount})</button>`;
    } else {
      html += `<button class="btn btn--ghost btn--sm timeline__mark-all" onclick="unmarkAllDoses('${time}')">Desmarcar todos</button>`;
    }
    html += `</div>`;
    groupItems.forEach(it => {
      const m = it.med;
      const cat = CATEGORIES[m.category] || CATEGORIES.other;
      const color = m.color || cat.color;
      html += `
        <div class="timeline__item ${it.taken ? 'done' : ''}">
          <div class="med-card__icon" style="width:36px;height:36px;background:${color}22;color:${color}">${icon(cat.icon)}</div>
          <div>
            <div class="timeline__name">${escapeHtml(m.name)}</div>
            <div class="timeline__meta">${m.amount} ${m.unit} · ${m.dosage} · ${cat.label}</div>
          </div>
          <button class="timeline__check ${it.taken ? 'done' : ''}" onclick="toggleDose('${m.id}','${time}')" title="${it.taken ? 'Desmarcar' : 'Marcar como tomada'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </button>
        </div>
      `;
    });
    html += `</div>`;
  });
  container.innerHTML = html;
}

async function toggleDose(medId, time) {
  const today = todayISO();
  const existing = Store.doses.byDate(today).find(d => d.medId === medId && d.time === time);
  if (existing) {
    Store.doses.remove(existing.id);
    toast('Dose desmarcada', 'info');
  } else {
    Store.doses.add({ medId, date: today, time, notes: '' });
    toast('Dose marcada como tomada', 'success');
  }
  renderSchedule();
  renderUpcomingDoses();
  updateDashboard();
  // Sincroniza com a nuvem (aguarda para garantir persistência)
  if (window.Store && Store.syncToCloud) {
    try {
      await Store.syncToCloud();
    } catch (e) {
      console.error('syncToCloud error', e);
      toast('Aviso: dose salva localmente, sincronização pendente', 'info');
    }
  }
}

// Marca em bloco todas as doses pendentes de um horário
async function markAllDoses(time) {
  const items = getTodaySchedule().filter(it => it.time === time && !it.taken);
  if (items.length === 0) return;
  const today = todayISO();
  items.forEach(it => Store.doses.add({ medId: it.med.id, date: today, time: it.time, notes: '' }));
  toast(`${items.length} dose(s) marcada(s) como tomada(s)`, 'success');
  renderSchedule();
  renderUpcomingDoses();
  updateDashboard();
  if (window.Store && Store.syncToCloud) {
    try { await Store.syncToCloud(); } catch (e) { console.error('syncToCloud error', e); }
  }
}

// Desmarca em bloco todas as doses tomadas de um horário
async function unmarkAllDoses(time) {
  const today = todayISO();
  const items = getTodaySchedule().filter(it => it.time === time && it.taken);
  if (items.length === 0) return;
  items.forEach(it => {
    const rec = Store.doses.byDate(today).find(d => d.medId === it.med.id && d.time === it.time);
    if (rec) Store.doses.remove(rec.id);
  });
  toast(`${items.length} dose(s) desmarcada(s)`, 'info');
  renderSchedule();
  renderUpcomingDoses();
  updateDashboard();
  if (window.Store && Store.syncToCloud) {
    try { await Store.syncToCloud(); } catch (e) { console.error('syncToCloud error', e); }
  }
}

// Marca em bloco todas as doses pendentes do dia
async function markAllPendingDoses() {
  const items = getTodaySchedule().filter(it => !it.taken);
  if (items.length === 0) { toast('Nenhuma dose pendente', 'info'); return; }
  const today = todayISO();
  items.forEach(it => Store.doses.add({ medId: it.med.id, date: today, time: it.time, notes: '' }));
  toast(`${items.length} dose(s) marcada(s) como tomada(s)`, 'success');
  renderSchedule();
  renderUpcomingDoses();
  updateDashboard();
  if (window.Store && Store.syncToCloud) {
    try { await Store.syncToCloud(); } catch (e) { console.error('syncToCloud error', e); }
  }
}

function renderUpcomingDoses() {
  const container = document.getElementById('upcomingDoses');
  if (!container) return;
  const items = getTodaySchedule().slice(0, 6);
  if (items.length === 0) {
    container.innerHTML = '<p class="muted">Nenhuma dose agendada para hoje.</p>';
    return;
  }
  container.innerHTML = items.map(it => {
    const m = it.med;
    const cat = CATEGORIES[m.category] || CATEGORIES.other;
    const color = m.color || cat.color;
    return `
      <div class="dose-item">
        <div class="dose-item__time">${it.time}</div>
        <div class="dose-item__info">
          <div class="dose-item__name">${escapeHtml(m.name)}</div>
          <div class="dose-item__meta">${m.amount} ${m.unit} · ${m.dosage}</div>
        </div>
        <span class="dose-item__badge ${it.taken ? '' : 'dose-item__badge--pending'}">${it.taken ? 'Tomada' : 'Pendente'}</span>
        <button class="dose-item__check ${it.taken ? 'done' : ''}" onclick="toggleDose('${m.id}','${it.time}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </button>
      </div>
    `;
  }).join('');
}

// Dose modal
function openDoseModal() {
  const sel = document.getElementById('doseMed');
  const meds = Store.medications.all();
  sel.innerHTML = meds.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('') || '<option value="">Nenhum medicamento</option>';
  document.getElementById('doseForm').reset();
  document.getElementById('doseDate').value = todayISO();
  document.getElementById('doseTime').value = nowTime();
  openModal('doseModal');
}

document.getElementById('doseForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const medId = document.getElementById('doseMed').value;
  if (!medId) { toast('Selecione um medicamento', 'error'); return; }
  Store.doses.add({
    medId,
    date: document.getElementById('doseDate').value,
    time: normalizeTime(document.getElementById('doseTime').value),
    notes: document.getElementById('doseNotes').value.trim()
  });
  toast('Dose registrada', 'success');
  closeModal('doseModal');
  renderSchedule();
  renderUpcomingDoses();
  updateDashboard();
  renderHistory();
  if (window.Notifications) window.Notifications.scheduleToday();
});

// Dashboard render
function renderDashboard() {
  const meds = Store.medications.all();
  // Conta medicamentos únicos (por nome) para não duplicar na exibição
  const uniqueMeds = new Set(meds.map(m => (m.name || '').trim().toLowerCase()));
  document.getElementById('statMeds').textContent = uniqueMeds.size;
  const today = todayISO();
  document.getElementById('statToday').textContent = Store.doses.byDate(today).length;
  document.getElementById('statSymptoms').textContent = Store.symptoms.all().length;
  document.getElementById('statDays').textContent = Store.monitoredDays();

  renderUpcomingDoses();
  renderCategoryChart();
  renderRecentSymptoms();
}

function renderCategoryChart() {
  const container = document.getElementById('categoryChart');
  if (!container) return;
  const meds = Store.medications.all();
  // Agrupa por nome dentro de cada categoria (medicamento duplicado conta como 1)
  const uniqueByCat = {};
  const seen = new Set();
  meds.forEach(m => {
    const key = (m.name || '').trim().toLowerCase() + '|' + (m.category || '');
    if (seen.has(key)) return;
    seen.add(key);
    uniqueByCat[m.category] = (uniqueByCat[m.category] || 0) + 1;
  });
  const total = Object.values(uniqueByCat).reduce((a,b)=>a+b,0) || 1;
  container.innerHTML = Object.keys(CATEGORIES).map(k => {
    const c = CATEGORIES[k];
    const count = uniqueByCat[k] || 0;
    const pct = (count / total) * 100;
    return `
      <div class="cat-row">
        <div class="cat-row__icon" style="background:${c.soft}; color:${c.color}">${icon(c.icon)}</div>
        <span class="cat-row__label">${c.label}</span>
        <div class="cat-row__bar"><div class="cat-row__bar-fill" style="width:${pct}%; background:${c.color}"></div></div>
        <span class="cat-row__count">${count}</span>
      </div>
    `;
  }).join('');
}

window.renderers.dashboard = () => renderDashboard();
window.renderers.schedule = () => { renderSchedule(); if (window.Notifications) window.Notifications.scheduleToday(); };

window.renderDashboard = renderDashboard;
window.renderSchedule = renderSchedule;
window.renderUpcomingDoses = renderUpcomingDoses;
window.getTodaySchedule = getTodaySchedule;
window.openDoseModal = openDoseModal;
window.toggleDose = toggleDose;
