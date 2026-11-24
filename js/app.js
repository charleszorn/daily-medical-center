/* ============================================================
   app.js - Núcleo da aplicação: navegação, helpers, modais, toasts
   ============================================================ */

const APP_VERSION = '2026-11-24-v3';
const CATEGORIES = {
  cardiac:     { label: 'Cardíaco',           icon: 'heart',        color: '#ef4444', soft: '#fef2f2' },
  anxiety:     { label: 'Ansiedade / Depressão', icon: 'brain',     color: '#8b5cf6', soft: '#f5f3ff' },
  weight:      { label: 'Emagrecimento',      icon: 'scale',        color: '#f59e0b', soft: '#fffbeb' },
  vitamin:     { label: 'Vitaminas',         icon: 'pill',         color: '#10b981', soft: '#ecfdf5' },
  menstrual:   { label: 'Menstruação / Cólica', icon: 'flower',    color: '#ec4899', soft: '#fdf2f8' },
  diabetes:    { label: 'Diabetes',           icon: 'diabetes',     color: '#06b6d4', soft: '#ecfeff' },
  spine:       { label: 'Coluna',             icon: 'spine',        color: '#6366f1', soft: '#eef2ff' },
  cholesterol: { label: 'Colesterol',         icon: 'cholesterol',  color: '#f97316', soft: '#fff7ed' },
  thyroid:     { label: 'Tireóide',           icon: 'thyroid',      color: '#a855f7', soft: '#faf5ff' },
  hormone:     { label: 'Hormônio',           icon: 'hormone',      color: '#d946ef', soft: '#fdf4ff' },
  other:       { label: 'Outros',             icon: 'box',          color: '#64748b', soft: '#f1f5f9' }
};

const SYMPTOMS = {
  headache:     { label: 'Dor de cabeça',     icon: 'headache' },
  dizziness:    { label: 'Tontura',          icon: 'dizziness' },
  swelling:     { label: 'Inchaço',          icon: 'swelling' },
  fever:        { label: 'Febre',            icon: 'fever' },
  fainting:     { label: 'Desmaio',          icon: 'fainting' },
  nosebleed:    { label: 'Sangramento nasal',icon: 'nosebleed' },
  high_bp:      { label: 'Pressão alta',     icon: 'bp-high' },
  low_bp:       { label: 'Pressão baixa',    icon: 'bp-low' },
  high_glucose: { label: 'Glicemia alta',    icon: 'glucose' },
  low_glucose:  { label: 'Glicemia baixa',   icon: 'glucose' },
  nausea:       { label: 'Náusea',           icon: 'nausea' },
  vomiting:     { label: 'Enjoo / Vômito',   icon: 'vomiting' },
  chest_pain:   { label: 'Dor no peito',     icon: 'chest' },
  muscle_pain:  { label: 'Dor muscular',     icon: 'muscle' },
  diarrhea:     { label: 'Diarreia',         icon: 'diarrhea' },
  apnea:        { label: 'Apneia do sono',   icon: 'apnea' },
  palpitations: { label: 'Palpitações',      icon: 'heart' },
  fatigue:      { label: 'Cansaço / Fadiga', icon: 'fatigue' },
  insomnia:     { label: 'Insônia',          icon: 'insomnia' },
  drowsiness:   { label: 'Sonolência',       icon: 'drowsiness' },
  anxiety:      { label: 'Ansiedade',        icon: 'anxiety' },
  sadness:      { label: 'Tristeza / Depressão', icon: 'sadness' },
  cramps:       { label: 'Cólica',           icon: 'cramps' },
  shortness_breath: { label: 'Falta de ar / Dificuldade para respirar', icon: 'shortness_breath' },
  sweating:     { label: 'Sudorese',         icon: 'sweating' },
  mobility_loss:{ label: 'Perda da mobilidade', icon: 'mobility_loss' },
  toothache:    { label: 'Dor no dente',     icon: 'toothache' },
  irritability: { label: 'Irritação / Impaciência', icon: 'irritability' },
  numbness:     { label: 'Dormência',        icon: 'numbness' },
  other:        { label: 'Outro',            icon: 'other' }
};

const SEVERITY_LABEL = { mild: 'Leve', moderate: 'Moderada', severe: 'Forte' };

/* ---------- SVG icon library (auto-explicative, modern line icons) ---------- */
const ICONS = {
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  brain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>`,
  scale: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M5 6h14"/><path d="m5 6-3 7a4 4 0 0 0 6 0l-3-7"/><path d="m19 6-3 7a4 4 0 0 0 6 0l-3-7"/><path d="M9 21h6"/></svg>`,
  pill: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 8.5-8.5a4.95 4.95 0 1 0-7-7l-8.5 8.5a4.95 4.95 0 0 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>`,
  flower: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2a3 3 0 0 0-3 3c0 2 3 4 3 4s3-2 3-4a3 3 0 0 0-3-3z"/><path d="M12 22a3 3 0 0 0 3-3c0-2-3-4-3-4s-3 2-3 4a3 3 0 0 0 3 3z"/><path d="M2 12a3 3 0 0 1 3-3c2 0 4 3 4 3s-2 3-4 3a3 3 0 0 1-3-3z"/><path d="M22 12a3 3 0 0 0-3-3c-2 0-4 3-4 3s2 3 4 3a3 3 0 0 0 3-3z"/></svg>`,
  box: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
  diabetes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/><path d="M12 9v6M9 12h6"/></svg>`,
  spine: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M8 5h8M7 9h10M7 13h10M8 17h8"/><circle cx="12" cy="3" r="1"/><circle cx="12" cy="21" r="1"/></svg>`,
  cholesterol: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/><path d="M12 9v6M9 12h6"/></svg>`,
  thyroid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12c-3-4-7-4-9 0s-1 6 2 7 6-1 7-7"/><path d="M12 12c3-4 7-4 9 0s1 6-2 7-6-1-7-7"/></svg>`,
  hormone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="4" ry="10" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="4" ry="10" transform="rotate(-60 12 12)"/></svg>`,
  // symptoms
  headache: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9h.01M15 9h.01M9 15c.5-1 1.5-1.5 3-1.5s2.5.5 3 1.5"/></svg>`,
  dizziness: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5"/><path d="m15 12-3 3-3-3"/></svg>`,
  swelling: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8a4 4 0 0 1 0 8"/><path d="M8 12h8"/></svg>`,
  fever: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>`,
  fainting: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3"/><path d="M12 11v4"/><path d="m9 18 3-3 3 3"/><path d="M6 21h12"/></svg>`,
  nosebleed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c-3 4-6 7-6 11a6 6 0 0 0 12 0c0-4-3-7-6-11z"/></svg>`,
  'bp-high': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/><circle cx="12" cy="12" r="4"/><path d="m12 12 2-2"/></svg>`,
  'bp-low': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/><circle cx="12" cy="12" r="4"/><path d="m12 12 0 2"/></svg>`,
  glucose: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M5 7h14"/><path d="M5 12h14"/><path d="M5 17h14"/></svg>`,
  nausea: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/></svg>`,
  vomiting: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c-3 4-6 7-6 11a6 6 0 0 0 12 0c0-4-3-7-6-11z"/><path d="M8 18l-2 4M16 18l2 4"/></svg>`,
  chest: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/><path d="M12 8v6"/></svg>`,
  muscle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4c-2 2-2 6 0 8s6 2 8 0 2-6 0-8"/><path d="M14 12l4 4"/><path d="M18 16l-2 2"/></svg>`,
  diarrhea: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 6c-2 2-4 4-4 8a4 4 0 0 0 8 0c0-4-2-6-4-8z"/><path d="M8 20h8"/></svg>`,
  apnea: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4l2-6 4 12 2-6h4"/><path d="M20 8a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3"/></svg>`,
  fatigue: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/></svg>`,
  insomnia: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  drowsiness: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>`,
  anxiety: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/><circle cx="12" cy="12" r="3"/></svg>`,
  sadness: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9h.01M15 9h.01M9 16c.5-1 1.5-1.5 3-1.5s2.5.5 3 1.5"/></svg>`,
  cramps: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>`,
  shortness_breath: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 3-3 5"/></svg>`,
  sweating: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/><path d="M9 12c0-2 1.5-3 3-3"/></svg>`,
  mobility_loss: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><path d="M12 7v6M9 10h6M10 13l-2 6M14 13l2 6"/></svg>`,
  toothache: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c-3 0-5 2-5 5 0 2 1 3 1 5s-1 4-1 6c0 2 1 4 3 4s2-2 2-4 0-4 0-4 0 2 0 4 0 4 2 4 3-2 3-4c0-2-1-4-1-6s1-3 1-5c0-3-2-5-5-5z"/></svg>`,
  irritability: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9h.01M15 9h.01M9 16h6M10 13l-1 2M14 13l1 2"/></svg>`,
  numbness: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/><path d="M9 9h6M9 15h6"/></svg>`,
  other: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="6" cy="12" r="1"/><circle cx="18" cy="12" r="1"/></svg>`
};

function icon(name) { return ICONS[name] || ICONS.other; }

/* ---------- Date helpers ---------- */
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function formatDate(iso) {
  if (!iso) return '';
  const [y,m,day] = iso.split('-');
  return `${day}/${m}/${y}`;
}
function formatTime(t) { return t || ''; }
function nowTime() {
  const d = new Date();
  return d.toTimeString().slice(0,5);
}
// Normaliza horários digitados em formatos variados para "HH:MM"
// Aceita: "01:30", "1:30", "01h30", "1h30", "01H30"
function normalizeTime(val) {
  if (!val) return '';
  let s = String(val).trim().toLowerCase().replace(/\s+/g, '');
  // troca 'h' por ':'
  s = s.replace(/h/g, ':');
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return String(val).trim();
  const hh = m[1].padStart(2, '0');
  const mm = m[2];
  if (Number(hh) > 23 || Number(mm) > 59) return String(val).trim();
  return `${hh}:${mm}`;
}
function monthName(m) {
  const names = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return names[m];
}
function daysInMonth(y,m) { return new Date(y, m+1, 0).getDate(); }

/* ---------- Toast ---------- */
function toast(msg, type = 'info', duration = 2800) {
  const c = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast toast--' + type;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; setTimeout(() => el.remove(), 250); }, duration);
}

/* ---------- Modal helpers ---------- */
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.addEventListener('click', (e) => {
  if (e.target.matches('[data-close]')) closeModal(e.target.getAttribute('data-close'));
  const backdrop = e.target.classList && e.target.classList.contains('modal__backdrop');
  if (backdrop) {
    const modal = e.target.closest('.modal');
    if (modal) modal.classList.remove('open');
  }
});

/* ---------- Navigation ---------- */
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav__item').forEach(n => n.classList.remove('active'));
  const view = document.getElementById('view-' + name);
  if (view) view.classList.add('active');
  const nav = document.querySelector(`.nav__item[data-view="${name}"]`);
  if (nav) nav.classList.add('active');
  // close mobile sidebar
  closeSidebar();
  // trigger render
  if (window.renderers && window.renderers[name]) window.renderers[name]();
}

function refreshCurrentView() {
  const activeNav = document.querySelector('.nav__item.active');
  const viewName = activeNav ? activeNav.dataset.view : 'dashboard';
  if (window.renderers && window.renderers[viewName]) {
    try { window.renderers[viewName](); } catch (e) { console.warn('refreshCurrentView error', e); }
  }
}
window.refreshCurrentView = refreshCurrentView;

document.querySelectorAll('.nav__item').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});
document.querySelectorAll('[data-view-go]').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.viewGo));
});

// quick actions
document.addEventListener('click', (e) => {
  const qa = e.target.closest('[data-action]');
  if (!qa) return;
  const action = qa.dataset.action;
  if (action === 'add-med') { openMedModal(); }
  if (action === 'add-symptom') { openSymptomModal(); }
  if (action === 'add-dose') { openDoseModal(); }
  if (action === 'add-doctor') { openDoctorModal(); }
});

// topbar
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
function isMobileView() { return window.matchMedia('(max-width: 768px)').matches; }
function openSidebar() { sidebar?.classList.add('open'); if (isMobileView()) sidebarBackdrop?.classList.add('open'); }
function closeSidebar() { sidebar?.classList.remove('open'); sidebarBackdrop?.classList.remove('open'); }
if (menuToggle) menuToggle.addEventListener('click', () => {
  if (sidebar?.classList.contains('open')) closeSidebar(); else openSidebar();
});
if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);
const quickAdd = document.getElementById('quickAdd');
if (quickAdd) quickAdd.addEventListener('click', () => openMedModal());

// Swipe gestures (mobile): swipe right from left edge to open, swipe left on sidebar to close
(function setupSwipe() {
  let startX = 0, startY = 0, tracking = false, openedBySwipe = false;
  const EDGE = 28;
  const THRESHOLD = 60;
  document.addEventListener('touchstart', (e) => {
    if (!isMobileView()) return;
    if (!e.touches || e.touches.length !== 1) return;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    tracking = true;
    openedBySwipe = false;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!isMobileView()) { tracking = false; return; }
    if (!tracking || !e.touches || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    // only horizontal swipes
    if (Math.abs(dy) > Math.abs(dx)) { tracking = false; return; }
    // open: starting from left edge, swiping right
    if (!sidebar?.classList.contains('open') && startX < EDGE && dx > THRESHOLD) {
      openSidebar();
      openedBySwipe = true;
      tracking = false;
    }
    // close: swiping left while sidebar open
    if (sidebar?.classList.contains('open') && dx < -THRESHOLD) {
      closeSidebar();
      tracking = false;
    }
  }, { passive: true });
  document.addEventListener('touchend', () => { tracking = false; openedBySwipe = false; }, { passive: true });
})();

// med modal buttons
document.getElementById('addMedBtn')?.addEventListener('click', () => openMedModal());

/* ---------- Renderers registry ---------- */
window.renderers = window.renderers || {};

/* ---------- Init ---------- */
function initApp() {
  // date
  const d = new Date();
  const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const todayStr = d.toLocaleDateString('pt-BR', opts);
  document.getElementById('todayDate').textContent = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);
  document.getElementById('scheduleDate').textContent = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);

  // color picker
  document.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      document.getElementById('medColor').value = sw.dataset.color;
    });
  });
  // default color
  const firstSw = document.querySelector('.color-swatch');
  if (firstSw) { firstSw.classList.add('active'); }

  // set default dates
  document.getElementById('symptomDate').value = todayISO();
  document.getElementById('symptomTime').value = nowTime();
  document.getElementById('doseDate').value = todayISO();
  document.getElementById('doseTime').value = nowTime();

  // normaliza horário ao sair do campo (aceita 01:30 e 01h30)
  ['symptomTime', 'doseTime'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('blur', () => { el.value = normalizeTime(el.value); });
  });

  // category filters
  renderCategoryFilters();

  // initial render
  switchView('dashboard');

  // Sincronização automática em segundo plano (visibilidade, foco, reconexão e timer de 30s)
  let lastAutoSync = 0;
  const triggerAutoSync = () => {
    const now = Date.now();
    if (now - lastAutoSync < 4000) return; // evita chamadas repetidas
    lastAutoSync = now;
    if (window.isCloud && window.isCloud() && window.syncFromCloud) {
      window.syncFromCloud(true);
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') triggerAutoSync();
  });
  window.addEventListener('focus', triggerAutoSync);
  window.addEventListener('online', triggerAutoSync);

  // Verificação periódica a cada 30 segundos
  setInterval(() => {
    if (document.visibilityState === 'visible') triggerAutoSync();
  }, 30 * 1000);

  // reset sync button
  const resetSyncBtn = document.getElementById('resetSyncBtn');
  if (resetSyncBtn) {
    resetSyncBtn.addEventListener('click', async () => {
      if (!confirm('Isso vai limpar os dados locais e recarregar tudo da nuvem. Continuar?')) return;
      resetSyncBtn.disabled = true;
      resetSyncBtn.textContent = '⏳ Resetando...';
      try {
        if (window.forceResetAndSync) {
          const result = await window.forceResetAndSync();
          console.log('Reset result:', JSON.stringify(result));
          if (result.ok) {
            toast('Dados recarregados da nuvem! Meds: ' + result.meds, 'success');
          } else {
            toast('Erro: ' + (result.error || result.reason), 'error');
          }
        }
        const active = document.querySelector('.nav__item.active')?.dataset.view || 'dashboard';
        if (window.switchView) window.switchView(active);
      } catch (e) {
        console.error('reset error', e);
        toast('Erro: ' + (e.message || e), 'error');
      } finally {
        resetSyncBtn.disabled = false;
        resetSyncBtn.textContent = '♻️ Resetar e recarregar da nuvem';
      }
    });
  }

  // sync button
  const syncBtn = document.getElementById('syncBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      syncBtn.disabled = true;
      syncBtn.textContent = '⏳ Sincronizando...';
      try {
        // 1. Push ALL local data to cloud
        let pushResult = null;
        if (window.Store && Store.syncToCloud) {
          pushResult = await Store.syncToCloud();
          console.log('Push result:', JSON.stringify(pushResult));
        }
        // 2. Force pull from cloud (replace local with cloud, keep local-only)
        if (window.forcePullFromCloud) {
          await window.forcePullFromCloud();
        }
        // 3. Diagnose
        if (window.diagnoseSync) {
          const diag = await window.diagnoseSync();
          console.log('Diagnose:', JSON.stringify(diag));
          const missing = Object.entries(diag.tables || {}).filter(([t, r]) => !r.ok);
          if (!diag.sessionValid) {
            toast('⚠️ Sessão expirada. Faça login novamente.', 'error');
          } else if (missing.length > 0) {
            toast('⚠️ Tabelas faltando: ' + missing.map(([t]) => t).join(', ') + '. Rode o SQL no Supabase.', 'error');
          } else {
            const pushed = pushResult?.results ? Object.values(pushResult.results).reduce((a,b) => (typeof b === 'number' ? a+b : a), 0) : 0;
            toast('Sincronizado! ' + pushed + ' enviados. Nuvem: ' + (diag.tables?.medications?.count || 0) + ' meds.', 'success');
          }
        } else {
          toast('Sincronização concluída!', 'success');
        }
        // re-render current view
        const active = document.querySelector('.nav__item.active')?.dataset.view || 'dashboard';
        if (window.switchView) window.switchView(active);
      } catch (e) {
        console.error('sync error', e);
        toast('Erro na sincronização: ' + (e.message || e), 'error');
      } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = '🔄 Sincronizar agora';
      }
    });
  }
}

function renderCategoryFilters() {
  const container = document.getElementById('categoryFilters');
  if (!container) return;
  let html = `<button class="chip active" data-cat="all">Todas</button>`;
  Object.keys(CATEGORIES).forEach(k => {
    html += `<button class="chip" data-cat="${k}">${CATEGORIES[k].label}</button>`;
  });
  container.innerHTML = html;
  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      if (window.renderMedications) window.renderMedications(chip.dataset.cat);
    });
  });
}

// expose
window.CATEGORIES = CATEGORIES;
window.APP_VERSION = APP_VERSION;
window.SYMPTOMS = SYMPTOMS;
window.SEVERITY_LABEL = SEVERITY_LABEL;
window.ICONS = ICONS;
window.icon = icon;
window.toast = toast;
window.openModal = openModal;
window.closeModal = closeModal;
window.switchView = switchView;
window.todayISO = todayISO;
window.formatDate = formatDate;
window.nowTime = nowTime;
window.monthName = monthName;
window.daysInMonth = daysInMonth;

// PWA install prompt
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = '';
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = 'none';
  toast('Aplicativo instalado com sucesso!', 'success');
});

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('installBtn');
  if (btn) btn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) {
      toast('Use o menu do navegador para instalar', 'info');
      return;
    }
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') toast('Instalação iniciada', 'success');
    deferredInstallPrompt = null;
    btn.style.display = 'none';
  });
});

// Version check: force reload if cached version is outdated
(function checkVersion() {
  const lastVersion = localStorage.getItem('dmc_app_version');
  if (lastVersion && lastVersion !== APP_VERSION) {
    // Clear service worker caches and reload
    if ('caches' in window) {
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => {
        localStorage.setItem('dmc_app_version', APP_VERSION);
        window.location.reload();
      });
      return;
    }
    localStorage.setItem('dmc_app_version', APP_VERSION);
    window.location.reload();
    return;
  }
  localStorage.setItem('dmc_app_version', APP_VERSION);
})();

document.addEventListener('DOMContentLoaded', initApp);

// PWA service worker with auto-update
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js?v=20261124-1');
      // Check for updates every 30 seconds
      setInterval(() => reg.update(), 30000);
      // If a new SW is waiting, activate it and reload
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available, reload to get fresh code
              newWorker.postMessage({ type: 'SKIP_WAITING' });
              window.location.reload();
            }
          });
        }
      });
    } catch (e) { /* ignore */ }
  });
  // Listen for controller change (new SW activated)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}
