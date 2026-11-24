/* ============================================================
   storage.js - Camada de persistência (localStorage + Supabase)
   ============================================================ */

const LAST_USER_KEY = 'dmc_last_user_id_v1';
function getDataKey() {
  let u = null;
  try { if (window.currentUser) u = window.currentUser(); } catch(e) { u = null; }
  let uid = u ? u.id : null;
  // Fallback: se não há usuário logado, usa o último user ID conhecido
  // para não perder acesso aos dados salvos anteriormente
  if (!uid) {
    try { uid = localStorage.getItem(LAST_USER_KEY); } catch(e) { uid = null; }
  }
  if (!uid) uid = 'guest';
  return 'dmc_data_v1_' + uid;
}

function setLastUserId(uid) {
  if (uid) {
    try { localStorage.setItem(LAST_USER_KEY, uid); } catch(e) {}
  }
}

const DEFAULT_DATA = {
  user: { name: 'Paciente', initials: 'CM' },
  medications: [],
  doses: [],
  symptoms: [],
  reports: [],
  doctors: []
};

function isCloud() {
  return !!(window.supabaseClient);
}

function loadData() {
  try {
    const key = getDataKey();
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(DEFAULT_DATA);
    const parsed = JSON.parse(raw);
    const data = { ...structuredClone(DEFAULT_DATA), ...parsed };
    // Safeguard: ensure arrays exist
    if (!Array.isArray(data.medications)) data.medications = [];
    if (!Array.isArray(data.doses)) data.doses = [];
    if (!Array.isArray(data.symptoms)) data.symptoms = [];
    if (!Array.isArray(data.reports)) data.reports = [];
    if (!Array.isArray(data.doctors)) data.doctors = [];
    return data;
  } catch (e) {
    console.error('Erro ao carregar dados', e);
    return structuredClone(DEFAULT_DATA);
  }
}

function saveData(data) {
  try {
    const key = getDataKey();
    const json = JSON.stringify(data);
    localStorage.setItem(key, json);
    // Verify the save succeeded
    const check = localStorage.getItem(key);
    if (check !== json) {
      console.error('saveData: verificação falhou, dados não persistidos');
      return false;
    }
    return true;
  } catch (e) {
    console.error('Erro ao salvar dados', e);
    return false;
  }
}

let _data = loadData();

// ---------- Supabase helpers ----------
// Garante que a sessão do Supabase está válida antes de operações
async function ensureSession() {
  const sb = window.supabaseClient;
  if (!sb) return null;
  try {
    const { data, error } = await sb.auth.getSession();
    if (error) { console.error('ensureSession error', error); return null; }
    if (data?.session) return data.session;
    // Try refresh
    const { data: refreshed, error: refErr } = await sb.auth.refreshSession();
    if (refErr) { console.warn('refreshSession error', refErr); return null; }
    return refreshed?.session || null;
  } catch (e) {
    console.error('ensureSession exception', e);
    return null;
  }
}

async function getAuthUserId() {
  const session = await ensureSession();
  if (session?.user?.id) return session.user.id;
  // Fallback to local user
  const u = window.currentUser && window.currentUser();
  return u ? u.id : null;
}

async function cloudSelect(table) {
  const sb = window.supabaseClient;
  const uid = await getAuthUserId();
  if (!sb || !uid) return null;
  try {
    const { data, error } = await sb.from(table).select('*').eq('user_id', uid);
    if (error) { console.error('cloud select', table, error.message || error); return null; }
    return data || [];
  } catch (e) {
    console.error('cloud select exception', table, e);
    return null;
  }
}

// Diagnóstico completo de sincronização
async function diagnoseSync() {
  const sb = window.supabaseClient;
  const u = window.currentUser && window.currentUser();
  const session = await ensureSession();
  const result = {
    cloudEnabled: !!sb,
    localUser: u ? { email: u.email, id: u.id, mode: u.mode } : null,
    sessionValid: !!session,
    sessionUserId: session?.user?.id || null,
    idMatch: u && session ? (u.id === session.user.id) : null,
    tables: {}
  };
  if (!sb) { result.error = 'Supabase client not loaded'; return result; }
  if (!session) { result.error = 'No valid Supabase session. User needs to re-login.'; return result; }
  for (const t of ['medications', 'doses', 'symptoms', 'doctors']) {
    try {
      const { data, error } = await sb.from(t).select('id').eq('user_id', session.user.id);
      if (error) {
        result.tables[t] = { ok: false, error: error.message };
      } else {
        result.tables[t] = { ok: true, count: (data || []).length };
      }
    } catch (e) {
      result.tables[t] = { ok: false, error: String(e) };
    }
  }
  // Test upsert
  try {
    const testId = 'diag_test_' + Date.now();
    const { error } = await sb.from('medications').upsert({
      id: testId, user_id: session.user.id, name: 'DiagTest', category: 'other',
      dosage: '1mg', amount: '1', unit: 'comprimido', times: ['08:00'], color: '#2563eb'
    });
    if (error) {
      result.testUpsert = { ok: false, error: error.message };
    } else {
      result.testUpsert = { ok: true };
      // cleanup
      await sb.from('medications').delete().eq('id', testId).eq('user_id', session.user.id);
    }
  } catch (e) {
    result.testUpsert = { ok: false, error: String(e) };
  }
  // Show which local meds are NOT in cloud
  result.localMedCount = _data.medications.length;
  result.localMedNames = _data.medications.map(m => m.name);
  return result;
}


async function cloudUpsert(table, row) {
  const sb = window.supabaseClient;
  const uid = await getAuthUserId();
  if (!sb || !uid) {
    console.warn('cloudUpsert skipped: no client or session', table);
    return false;
  }
  row.user_id = uid;
  row.user_id = uid;
  // Fix: convert empty strings to null for date fields (Supabase DATE columns reject "")
  if (table === 'medications') {
    if (!row.start_date) row.start_date = null;
    if (!row.period_start) row.period_start = null;
    if (!row.period_end) row.period_end = null;
    if (!row.frequency) row.frequency = 'daily';
  }
  if (table === 'doctors') {
    if (!row.photo) row.photo = null;
  }
  // Retry up to 3 times
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { error } = await sb.from(table).upsert(row);
      if (!error) {
        console.log('cloudUpsert OK:', table, row.id);
        return true;
      }
      console.error('cloud upsert', table, error.message || error);
      // Fallback: try with basic fields only (in case of column/type errors)
      if (true) {  // always try fallback on any error
        let basic = { id: row.id, user_id: row.user_id };
        if (table === 'medications') {
          Object.assign(basic, { name: row.name, category: row.category, dosage: row.dosage,
            amount: String(row.amount || '1'), unit: row.unit, times: row.times, notes: row.notes, color: row.color });
        } else if (table === 'doctors') {
          Object.assign(basic, { name: row.name, specialty: row.specialty, notes: row.notes });
          if (row.photo && row.photo.length <= 50000) basic.photo = row.photo;
        } else if (table === 'doses') {
          Object.assign(basic, { med_id: row.med_id, date: row.date, time: row.time, notes: row.notes, taken_at: row.taken_at });
        } else if (table === 'symptoms') {
          Object.assign(basic, { type: row.type, severity: row.severity, date: row.date, time: row.time, notes: row.notes });
        }
        const { error: e2 } = await sb.from(table).upsert(basic);
        if (!e2) {
          console.warn('cloud upsert: saved basic fields only for ' + table);
          return true;
        }
        console.error('cloud upsert (fallback)', table, e2.message || e2);
      }
    } catch (e) {
      console.error('cloud upsert exception', table, e);
    }
    // Wait before retry
    if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

async function cloudDelete(table, id) {
  const sb = window.supabaseClient;
  const uid = await getAuthUserId();
  if (!sb || !uid) return;
  const { error } = await sb.from(table).delete().eq('id', id).eq('user_id', uid);
  if (error) console.error('cloud delete', table, error);
}

// ---------- Sync from cloud ----------
async function syncFromCloud() {
  if (!isCloud()) { console.warn('syncFromCloud: cloud not enabled'); return; }
  const u = window.currentUser && window.currentUser();
  if (!u) { console.warn('syncFromCloud: no user'); return; }
  console.log('syncFromCloud: user', u.email, u.id, 'mode:', u.mode);
  // Ensure session is valid
  const session = await ensureSession();
  if (!session) {
    console.warn('syncFromCloud: no valid session, trying with local user ID');
  } else {
    console.log('syncFromCloud: session valid, user ID:', session.user.id);
    if (session.user.id !== u.id) {
      console.warn('syncFromCloud: user ID mismatch! local:', u.id, 'session:', session.user.id);
      setCurrentUser({ id: session.user.id, email: session.user.email, name: u.name, mode: 'cloud', photo: u.photo });
    }
  }
  try {
    const [meds, doses, syms] = await Promise.all([
      cloudSelect('medications'),
      cloudSelect('doses'),
      cloudSelect('symptoms')
    ]);
    if (meds) {
      const cloudMeds = meds.map(r => ({
        id: r.id, name: r.name, category: r.category, dosage: r.dosage,
        amount: r.amount, unit: r.unit, times: r.times || [], notes: r.notes,
        color: r.color, createdAt: r.created_at,
        frequency: r.frequency || 'daily',
        daysOfWeek: r.days_of_week || r.daysOfWeek || [],
        startDate: r.start_date || r.startDate || '',
        dayOfMonth: r.day_of_month || r.dayOfMonth || null,
        usageType: r.usage_type || r.usageType || 'continuous',
        periodStart: r.period_start || r.periodStart || '',
        periodEnd: r.period_end || r.periodEnd || '',
        seasonMonths: r.season_months || r.seasonMonths || []
      }));
      // Nuvem é fonte de verdade: substitui local com cloud quando cloud tem dados
      const cloudIds = new Set(cloudMeds.map(m => m.id));
      const localOnly = _data.medications.filter(m => !cloudIds.has(m.id));
      _data.medications = [...cloudMeds, ...localOnly];
    }
    if (doses) {
      const cloudDoses = doses.map(r => ({
        id: r.id, medId: r.med_id, date: r.date, time: r.time,
        notes: r.notes, takenAt: r.taken_at
      }));
      const cloudIds = new Set(cloudDoses.map(d => d.id));
      const localOnly = _data.doses.filter(d => !cloudIds.has(d.id));
      _data.doses = [...cloudDoses, ...localOnly];
    }
    if (syms) {
      const cloudSyms = syms.map(r => ({
        id: r.id, type: r.type, severity: r.severity, date: r.date,
        time: r.time, notes: r.notes, createdAt: r.created_at
      }));
      const cloudIds = new Set(cloudSyms.map(s => s.id));
      const localOnly = _data.symptoms.filter(s => !cloudIds.has(s.id));
      _data.symptoms = [...cloudSyms, ...localOnly];
    }
    // doctors (optional, may not exist in cloud yet)
    try {
      const docs = await cloudSelect('doctors');
      if (docs) {
        const cloudDocs = docs.map(r => ({
          id: r.id, name: r.name, specialty: r.specialty, notes: r.notes, createdAt: r.created_at,
          photo: r.photo || null
        }));
        // Merge: nuvem é fonte de verdade. Atualiza registros existentes, preserva locais não presentes na nuvem.
        const cloudIds = new Set(cloudDocs.map(d => d.id));
        const localOnly = (_data.doctors || []).filter(d => !cloudIds.has(d.id));
        _data.doctors = [...cloudDocs, ...localOnly];
      }
    } catch (e) { /* table may not exist */ }
    saveData(_data);
  } catch (e) {
    console.error('syncFromCloud error', e);
  }
}

// Força recarregar TUDO da nuvem (substitui dados locais pelos da nuvem)
// Útil para sincronizar dispositivos que estão com versão antiga
async function forcePullFromCloud() {
  if (!isCloud()) return { ok: false, reason: 'cloud not enabled' };
  const u = window.currentUser && window.currentUser();
  if (!u) return { ok: false, reason: 'no user' };
  try {
    const [meds, doses, syms, docs] = await Promise.all([
      cloudSelect('medications'),
      cloudSelect('doses'),
      cloudSelect('symptoms'),
      cloudSelect('doctors')
    ]);
    // Warn if cloud returned empty but local has data (possible session issue)
    if (meds && meds.length === 0 && _data.medications.length > 0) {
      console.warn('syncFromCloud: cloud returned 0 medications but local has ' + _data.medications.length + '. Session may be expired.');
      if (typeof toast === 'function') toast('⚠️ Sessão pode ter expirado. Faça login novamente.', 'error');
    }
    if (meds) {
      _data.medications = meds.map(r => ({
        id: r.id, name: r.name, category: r.category, dosage: r.dosage,
        amount: r.amount, unit: r.unit, times: r.times || [], notes: r.notes,
        color: r.color, createdAt: r.created_at,
        frequency: r.frequency || 'daily',
        daysOfWeek: r.days_of_week || r.daysOfWeek || [],
        startDate: r.start_date || r.startDate || '',
        dayOfMonth: r.day_of_month || r.dayOfMonth || null,
        usageType: r.usage_type || r.usageType || 'continuous',
        periodStart: r.period_start || r.periodStart || '',
        periodEnd: r.period_end || r.periodEnd || '',
        seasonMonths: r.season_months || r.seasonMonths || []
      }));
    }
    if (doses) {
      _data.doses = doses.map(r => ({
        id: r.id, medId: r.med_id, date: r.date, time: r.time,
        notes: r.notes, takenAt: r.taken_at
      }));
    }
    if (syms) {
      _data.symptoms = syms.map(r => ({
        id: r.id, type: r.type, severity: r.severity, date: r.date,
        time: r.time, notes: r.notes, createdAt: r.created_at
      }));
    }
    if (docs) {
      _data.doctors = docs.map(r => ({
        id: r.id, name: r.name, specialty: r.specialty, notes: r.notes, createdAt: r.created_at,
        photo: r.photo || null
      }));
    }
    saveData(_data);
    console.log('forcePullFromCloud: done', { meds: _data.medications.length, doses: _data.doses.length, syms: _data.symptoms.length, docs: _data.doctors.length });
    return { ok: true, meds: _data.medications.length, doses: _data.doses.length, symptoms: _data.symptoms.length, doctors: _data.doctors.length };
  } catch (e) {
    console.error('forcePullFromCloud error', e);
    return { ok: false, error: String(e) };
  }
}

// RESET TOTAL: limpa todos os dados locais e recarrega da nuvem
// Use quando os dados estão inconsistentes entre dispositivos
async function forceResetAndSync() {
  const u = window.currentUser && window.currentUser();
  if (!u) return { ok: false, reason: 'no user' };
  // Backup
  const backup = { medications: _data.medications, doses: _data.doses, symptoms: _data.symptoms, doctors: _data.doctors };
  try { localStorage.setItem('dmc_backup_' + Date.now(), JSON.stringify(backup)); } catch(e) {}
  // 1. Push ALL local data to cloud FIRST
  if (window.Store && Store.syncToCloud) {
    await Store.syncToCloud();
  }
  // 2. Clear ALL local data keys (not just current user's)
  const allKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('dmc_data_v1_')) allKeys.push(key);
  }
  allKeys.forEach(k => localStorage.removeItem(k));
  // 3. Clear in-memory data
  _data.medications = [];
  _data.doses = [];
  _data.symptoms = [];
  _data.doctors = [];
  saveData(_data);
  // 3. Force pull from cloud (now has the latest data)
  const result = await forcePullFromCloud();
  console.log('forceResetAndSync result:', JSON.stringify(result));
  return result;
}

const Store = {
  get: () => _data,
  set: (d) => { _data = d; saveData(_data); },
  reload: () => { _data = loadData(); },
  // Força sincronização de todos os dados locais para a nuvem
  syncToCloud: async () => {
    if (!isCloud()) { console.warn('syncToCloud: cloud not enabled'); return { ok: false, reason: 'cloud not enabled' }; }
    const u = window.currentUser && window.currentUser();
    if (!u) { console.warn('syncToCloud: no user'); return { ok: false, reason: 'no user' }; }
    console.log('syncToCloud: pushing all data for user', u.email);
    const results = { medications: 0, doses: 0, symptoms: 0, doctors: 0, errors: [] };
    // medications
    for (const m of _data.medications) {
      const ok = await cloudUpsert('medications', {
        id: m.id, name: m.name, category: m.category, dosage: m.dosage,
        amount: m.amount, unit: m.unit, times: m.times, notes: m.notes, color: m.color,
        frequency: m.frequency, days_of_week: m.daysOfWeek, start_date: m.startDate, day_of_month: m.dayOfMonth,
        usage_type: m.usageType, period_start: m.periodStart, period_end: m.periodEnd, season_months: m.seasonMonths
      });
      if (ok) results.medications++; else results.errors.push('med:' + m.name);
    }
    // doses
    for (const d of _data.doses) {
      const ok = await cloudUpsert('doses', {
        id: d.id, med_id: d.medId, date: d.date, time: d.time, notes: d.notes, taken_at: d.takenAt
      });
      if (ok) results.doses++; else results.errors.push('dose:' + d.id);
    }
    // symptoms
    for (const s of _data.symptoms) {
      const ok = await cloudUpsert('symptoms', {
        id: s.id, type: s.type, severity: s.severity, date: s.date, time: s.time, notes: s.notes
      });
      if (ok) results.symptoms++; else results.errors.push('symptom:' + s.id);
    }
    // doctors
    if (_data.doctors) {
      for (const doc of _data.doctors) {
        const ok = await cloudUpsert('doctors', {
          id: doc.id, name: doc.name, specialty: doc.specialty, notes: doc.notes, photo: doc.photo
        });
        if (ok) results.doctors++; else results.errors.push('doctor:' + doc.name);
      }
    }
    console.log('syncToCloud: concluído', results);
    return { ok: results.errors.length === 0, results };
  },
  reloadForUser: () => {
    // Merge com dados em memória para não perder alterações não sincronizadas
    const fresh = loadData();
    if (!_data) { _data = fresh; return; }
    // Preserve local-only medications/doses/symptoms
    const cloudMedIds = new Set(fresh.medications.map(m => m.id));
    const localOnlyMeds = _data.medications.filter(m => !cloudMedIds.has(m.id));
    _data.medications = [...fresh.medications, ...localOnlyMeds];
    const cloudDoseIds = new Set(fresh.doses.map(d => d.id));
    const localOnlyDoses = _data.doses.filter(d => !cloudDoseIds.has(d.id));
    _data.doses = [...fresh.doses, ...localOnlyDoses];
    const cloudSymIds = new Set(fresh.symptoms.map(s => s.id));
    const localOnlySyms = _data.symptoms.filter(s => !cloudSymIds.has(s.id));
    _data.symptoms = [...fresh.symptoms, ...localOnlySyms];
    saveData(_data);
  },
  syncFromCloud: syncFromCloud,

  medications: {
    all: () => _data.medications,
    byId: (id) => _data.medications.find(m => m.id === id),
    byCategory: (cat) => _data.medications.filter(m => m.category === cat),
    add: (med) => {
      med.id = 'med_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
      med.createdAt = new Date().toISOString();
      _data.medications.push(med);
      saveData(_data);
      if (isCloud()) cloudUpsert('medications', {
        id: med.id, name: med.name, category: med.category, dosage: med.dosage,
        amount: med.amount, unit: med.unit, times: med.times, notes: med.notes, color: med.color,
        frequency: med.frequency, days_of_week: med.daysOfWeek, start_date: med.startDate, day_of_month: med.dayOfMonth,
        usage_type: med.usageType, period_start: med.periodStart, period_end: med.periodEnd, season_months: med.seasonMonths
      });
      return med;
    },
    update: (id, patch) => {
      const idx = _data.medications.findIndex(m => m.id === id);
      if (idx !== -1) {
        _data.medications[idx] = { ..._data.medications[idx], ...patch };
        saveData(_data);
        if (isCloud()) {
          const m = _data.medications[idx];
          cloudUpsert('medications', {
            id: m.id, name: m.name, category: m.category, dosage: m.dosage,
            amount: m.amount, unit: m.unit, times: m.times, notes: m.notes, color: m.color,
             frequency: m.frequency, days_of_week: m.daysOfWeek, start_date: m.startDate, day_of_month: m.dayOfMonth,
             usage_type: m.usageType, period_start: m.periodStart, period_end: m.periodEnd, season_months: m.seasonMonths
          });
        }
        return _data.medications[idx];
      }
      return null;
    },
    remove: (id) => {
      _data.medications = _data.medications.filter(m => m.id !== id);
      _data.doses = _data.doses.filter(d => d.medId !== id);
      saveData(_data);
      if (isCloud()) { cloudDelete('medications', id); }
    }
  },

  doses: {
    all: () => _data.doses,
    byDate: (date) => _data.doses.filter(d => d.date === date),
    add: (dose) => {
      dose.id = 'dose_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
      dose.takenAt = new Date().toISOString();
      _data.doses.push(dose);
      saveData(_data);
      if (isCloud()) cloudUpsert('doses', {
        id: dose.id, med_id: dose.medId, date: dose.date, time: dose.time,
        notes: dose.notes, taken_at: dose.takenAt
      });
      return dose;
    },
    remove: (id) => {
      _data.doses = _data.doses.filter(d => d.id !== id);
      saveData(_data);
      if (isCloud()) cloudDelete('doses', id);
    }
  },

  symptoms: {
    all: () => _data.symptoms,
    byDate: (date) => _data.symptoms.filter(s => s.date === date),
    add: (sym) => {
      sym.id = 'sym_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
      sym.createdAt = new Date().toISOString();
      _data.symptoms.push(sym);
      saveData(_data);
      if (isCloud()) cloudUpsert('symptoms', {
        id: sym.id, type: sym.type, severity: sym.severity, date: sym.date,
        time: sym.time, notes: sym.notes
      });
      return sym;
    },
    remove: (id) => {
      _data.symptoms = _data.symptoms.filter(s => s.id !== id);
      saveData(_data);
      if (isCloud()) cloudDelete('symptoms', id);
    }
  },

  reports: {
    all: () => _data.reports,
    add: (rep) => {
      rep.id = 'rep_' + Date.now();
      rep.createdAt = new Date().toISOString();
      _data.reports.push(rep);
      saveData(_data);
      return rep;
    },
    byId: (id) => _data.reports.find(r => r.id === id),
    remove: (id) => {
      _data.reports = _data.reports.filter(r => r.id !== id);
      saveData(_data);
    }
  },

  doctors: {
    all: () => _data.doctors || [],
    byId: (id) => (_data.doctors || []).find(d => d.id === id),
    add: (doc) => {
      if (!_data.doctors) _data.doctors = [];
      doc.id = 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
      doc.createdAt = new Date().toISOString();
      _data.doctors.push(doc);
      saveData(_data);
      if (isCloud()) cloudUpsert('doctors', { id: doc.id, name: doc.name, specialty: doc.specialty, notes: doc.notes, photo: doc.photo });
      return doc;
    },
    update: (id, patch) => {
      if (!_data.doctors) return null;
      const idx = _data.doctors.findIndex(d => d.id === id);
      if (idx !== -1) {
        _data.doctors[idx] = { ..._data.doctors[idx], ...patch };
        saveData(_data);
        if (isCloud()) {
          const d = _data.doctors[idx];
          cloudUpsert('doctors', { id: d.id, name: d.name, specialty: d.specialty, notes: d.notes, photo: d.photo });
        }
        return _data.doctors[idx];
      }
      return null;
    },
    remove: (id) => {
      if (!_data.doctors) return;
      _data.doctors = _data.doctors.filter(d => d.id !== id);
      saveData(_data);
      if (isCloud()) cloudDelete('doctors', id);
    }
  },

  monitoredDays: () => {
    const set = new Set();
    _data.doses.forEach(d => set.add(d.date));
    _data.symptoms.forEach(s => set.add(s.date));
    return set.size;
  },
  datesWithData: () => {
    const set = new Set();
    _data.doses.forEach(d => set.add(d.date));
    _data.symptoms.forEach(s => set.add(s.date));
    return set;
  }
};

window.Store = Store;
window.loadData = loadData;
window.syncFromCloud = syncFromCloud;
window.syncToCloud = Store.syncToCloud;
window.forcePullFromCloud = forcePullFromCloud;
window.forceResetAndSync = forceResetAndSync;
window.isCloud = isCloud;
window.diagnoseSync = diagnoseSync;
