/* ============================================================
   history.js - Calendário e histórico de monitoramento
   ============================================================ */

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let selectedDate = todayISO();

function renderCalendar() {
  const container = document.getElementById('calendar');
  if (!container) return;
  const dataDates = Store.datesWithData();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const total = daysInMonth(calYear, calMonth);
  const today = todayISO();

  let html = `
    <div class="calendar__header">
      <span class="calendar__title">${monthName(calMonth)} ${calYear}</span>
      <div class="calendar__nav">
        <button onclick="prevMonth()" aria-label="Mês anterior">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <button onclick="nextMonth()" aria-label="Próximo mês">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
    </div>
    <div class="calendar__grid">
  `;
  const weekdays = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  weekdays.forEach(w => { html += `<div class="calendar__weekday">${w}</div>`; });
  for (let i = 0; i < firstDay; i++) html += `<div class="calendar__day empty"></div>`;
  for (let day = 1; day <= total; day++) {
    const iso = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const classes = ['calendar__day'];
    if (iso === today) classes.push('today');
    if (iso === selectedDate) classes.push('selected');
    if (dataDates.has(iso)) classes.push('has-data');
    html += `<div class="${classes.join(' ')}" onclick="selectDay('${iso}')">${day}</div>`;
  }
  html += `</div>`;
  container.innerHTML = html;
  renderDayDetail(selectedDate);
}

function selectDay(iso) {
  selectedDate = iso;
  renderCalendar();
}
function prevMonth() {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
}
function nextMonth() {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
}

function renderDayDetail(date) {
  const container = document.getElementById('dayDetail');
  if (!container) return;
  const doses = Store.doses.byDate(date);
  const syms = Store.symptoms.byDate(date);
  if (doses.length === 0 && syms.length === 0) {
    container.innerHTML = '<p class="muted">Nenhum registro neste dia.</p>';
    return;
  }
  let html = '';
  if (doses.length) {
    html += '<h3 style="font-size:14px;font-weight:700;margin:8px 0 6px">Doses tomadas</h3>';
    doses.forEach(d => {
      const m = Store.medications.byId(d.medId);
      html += `<div class="symptom-history__item">
        <div class="symptom-history__dot" style="background:#10b981"></div>
        <div class="symptom-history__info">
          <div class="symptom-history__name">${m ? escapeHtml(m.name) : 'Medicamento removido'}</div>
          <div class="symptom-history__meta">${d.time}${d.notes ? ' · ' + escapeHtml(d.notes) : ''}</div>
        </div>
      </div>`;
    });
  }
  if (syms.length) {
    html += '<h3 style="font-size:14px;font-weight:700;margin:12px 0 6px">Sintomas</h3>';
    syms.forEach(s => {
      const sym = SYMPTOMS[s.type] || SYMPTOMS.other;
      html += `<div class="symptom-history__item">
        <div class="symptom-history__dot" style="background:${severityColor(s.severity)}"></div>
        <div class="symptom-history__info">
          <div class="symptom-history__name">${sym.label}</div>
          <div class="symptom-history__meta">${s.time} · ${SEVERITY_LABEL[s.severity]}${s.notes ? ' · ' + escapeHtml(s.notes) : ''}</div>
        </div>
      </div>`;
    });
  }
  container.innerHTML = html;
}

function renderHistory() {
  renderCalendar();
}

window.renderers.history = () => renderHistory();
window.renderHistory = renderHistory;
window.selectDay = selectDay;
window.prevMonth = prevMonth;
window.nextMonth = nextMonth;
window.renderDayDetail = renderDayDetail;
window.renderCalendar = renderCalendar;
