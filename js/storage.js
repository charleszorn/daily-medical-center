/* ============================================================
   storage.js - Camada de persistência (localStorage + Supabase + Realtime)
   Sincronização automática em tempo real entre abas, navegadores e APK
   ============================================================ */

const LAST_USER_KEY = 'dmc_last_user_id_v1';
const TAB_ID = 'tab_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

// Canal de comunicação entre abas no mesmo navegador
let tabSyncChannel = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    tabSyncChannel = new BroadcastChannel('dmc_tab_sync');
    tabSyncChannel.onmessage = (e) => {
      if (e.data && e.data.source !== TAB_ID) {
        handleCrossTabSync(e.data);
      }
    };
  }
} catch (e) {
  tabSyncChannel = null;
}

// Fallback para comunicação entre abas via evento de storage
window.addEventListener('storage', (e) => {
  if (e.key === 'dmc_tab_sync_ping' && e.newValue) {
    try {
      const payload = JSON.parse(e.newValue);
      if (payload && payload.source !== TAB_ID) {
        handleCrossTabSync(payload);
      }
    } catch (err) {}
  }
});

function handleCrossTabSync(payload) {
  console.log('[CrossTabSync] Alteração detectada em outra aba. Atualizando dados locais...');
  _data = loadData();
  if (window.refreshCurrentView) {
    window.refreshCurrentView();
  }
}

function getDataKey() {
  let u = null;
  try { if (window.currentUser) u = window.currentUser(); } catch(e) { u = null; }
  let uid = u ? u.id : null;
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

function saveData(data, notifyTabs = true) {
  try {
    const key = getDataKey();
    const json = JSON.stringify(data);
    localStorage.setItem(key, json);

    if (notifyTabs) {
      const ping = { source: TAB_ID, key: key, time: Date.now() };
      if (tabSyncChannel) {
        try { tabSyncChannel.postMessage(ping); } catch(e) {}
      }
      try { localStorage.setItem('dmc_tab_sync_ping', JSON.stringify(ping)); } catch(e) {}
    }
    return true;
  } catch (e) {
    console.error('Erro ao salvar dados', e);
    return false;
  }
}

let _data = loadData();

// ---------- Supabase helpers ----------
async function ensureSession() {
  const sb = window.supabaseClient;
  if (!sb) return null;
  try {
    const { data, error } = await sb.auth.getSession();
    if (error) { console.error('ensureSession error', error); return null; }
    if (data?.session) return data.session;
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
  result.localMedCount = _data.medications.length;
  result.localMedNames = _data.medications.map(m => m.name);
  return result;
}

// Inserção / Atualização segura na nuvem com retry e sanitização de dados
async function cloudUpsert(table, row) {
  const sb = window.supabaseClient;
  const uid = await getAuthUserId();
  if (!sb || !uid) {
    console.warn('cloudUpsert skipped: no client or session', table);
    return false;
  }
  row.user_id = uid;

  // Sanitização estrita para colunas PostgreSQL
  if (table === 'medications') {
    if (!row.start_date) row.start_date = null;
    if (!row.period_start) row.period_start = null;
    if (!row.period_end) row.period_end = null;
    if (row.day_of_month === '' || row.day_of_month === undefined) {
      row.day_of_month = null;
    } else if (row.day_of_month !== null) {
      row.day_of_month = parseInt(row.day_of_month, 10) || null;
    }
    if (!row.frequency) row.frequency = 'daily';
    if (!Array.isArray(row.days_of_week)) row.days_of_week = [];
    if (!Array.isArray(row.times)) row.times = [];
    if (!Array.isArray(row.season_months)) row.season_months = [];
    if (row.amount !== undefined && row.amount !== null) row.amount = String(row.amount);
  } else if (table === 'doctors') {
    if (!row.photo) row.photo = null;
  } else if (table === 'doses') {
    if (!row.notes) row.notes = '';
  } else if (table === 'symptoms') {
    if (!row.notes) row.notes = '';
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { error } = await sb.from(table).upsert(row);
      if (!error) {
        console.log(`[CloudUpsert OK] ${table}:`, row.id);
        saveData(_data, true);
        return true;
      }
      console.warn(`[CloudUpsert tentativa ${attempt + 1}] ${table}:`, error.message || error);

      // Fallback seguro mantendo todos os campos vitais (incluindo foto)
      let basic = { id: row.id, user_id: row.user_id };
      if (table === 'medications') {
        Object.assign(basic, {
          name: row.name, category: row.category, dosage: row.dosage,
          amount: String(row.amount || '1'), unit: row.unit, times: row.times || [],
          notes: row.notes || '', color: row.color || '#2563eb'
        });
      } else if (table === 'doctors') {
        Object.assign(basic, {
          name: row.name, specialty: row.specialty || '', notes: row.notes || ''
        });
        if (row.photo) basic.photo = row.photo;
      } else if (table === 'doses') {
        Object.assign(basic, {
          med_id: row.med_id, date: row.date, time: row.time,
          notes: row.notes || '', taken_at: row.taken_at
        });
      } else if (table === 'symptoms') {
        Object.assign(basic, {
          type: row.type, severity: row.severity, date: row.date,
          time: row.time, notes: row.notes || ''
        });
      }
      const { error: e2 } = await sb.from(table).upsert(basic);
      if (!e2) {
        console.warn(`[CloudUpsert fallback OK] ${table}:`, row.id);
        saveData(_data, true);
        return true;
      }
      console.error(`[CloudUpsert fallback falhou] ${table}:`, e2.message || e2);
    } catch (e) {
      console.error(`[CloudUpsert exception] ${table}:`, e);
    }
    if (attempt < 2) await new Promise(r => setTimeout(r, 600));
  }
  return false;
}

async function cloudDelete(table, id) {
  const sb = window.supabaseClient;
  const uid = await getAuthUserId();
  if (!sb || !uid) return;
  try {
    const { error } = await sb.from(table).delete().eq('id', id).eq('user_id', uid);
    if (error) console.error('cloud delete error', table, error);
    else {
      console.log(`[CloudDelete OK] ${table}:`, id);
      saveData(_data, true);
    }
  } catch (e) {
    console.error('cloud delete exception', table, e);
  }
}

// ---------- Sincronização em tempo real (Supabase Realtime) ----------
let _realtimeChannel = null;
let _realtimeDebounceTimer = null;

function setupRealtimeListener(uid) {
  const sb = window.supabaseClient;
  if (!sb || !uid) return;

  if (_realtimeChannel) {
    try { sb.removeChannel(_realtimeChannel); } catch(e) {}
    _realtimeChannel = null;
  }

  try {
    const ch = sb.channel('dmc_realtime_sync_' + uid);
    const tables = ['medications', 'doctors', 'doses', 'symptoms'];
    tables.forEach(tbl => {
      ch.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: tbl,
        filter: `user_id=eq.${uid}`
      }, (payload) => {
        console.log(`[Supabase Realtime] Evento na tabela ${tbl}:`, payload.eventType);
        // Debounce para recarregar da nuvem
        if (_realtimeDebounceTimer) clearTimeout(_realtimeDebounceTimer);
        _realtimeDebounceTimer = setTimeout(() => {
          syncFromCloud(true);
        }, 400);
      });
    });

    ch.subscribe((status) => {
      console.log('[Supabase Realtime] Status de conexão:', status);
    });
    _realtimeChannel = ch;
  } catch (err) {
    console.warn('[Supabase Realtime] Falha ao configurar realtime:', err);
  }
}

// ---------- Sync from cloud ----------
// Nuvem é a fonte da verdade para contas conectadas
async function syncFromCloud(silent = false) {
  if (!isCloud()) {
    if (!silent) console.warn('syncFromCloud: cloud not enabled');
    return { ok: false, reason: 'cloud not enabled' };
  }
  const u = window.currentUser && window.currentUser();
  if (!u || u.mode !== 'cloud') {
    if (!silent) console.warn('syncFromCloud: no cloud user');
    return { ok: false, reason: 'no cloud user' };
  }

  const session = await ensureSession();
  if (!session) {
    if (!silent) console.warn('syncFromCloud: no valid session');
    return { ok: false, reason: 'no session' };
  }

  try {
    const [meds, doses, syms, docs] = await Promise.all([
      cloudSelect('medications'),
      cloudSelect('doses'),
      cloudSelect('symptoms'),
      cloudSelect('doctors')
    ]);

    let updated = false;

    if (meds) {
      const cloudMeds = meds.map(r => ({
        id: r.id, name: r.name, category: r.category, dosage: r.dosage,
        amount: r.amount, unit: r.unit, times: r.times || [], notes: r.notes || '',
        color: r.color || '#2563eb', createdAt: r.created_at,
        frequency: r.frequency || 'daily',
        daysOfWeek: r.days_of_week || r.daysOfWeek || [],
        startDate: r.start_date || r.startDate || '',
        dayOfMonth: r.day_of_month || r.dayOfMonth || null,
        usageType: r.usage_type || r.usageType || 'continuous',
        periodStart: r.period_start || r.periodStart || '',
        periodEnd: r.period_end || r.periodEnd || '',
        seasonMonths: r.season_months || r.seasonMonths || []
      }));
      // Preserva apenas registros locais explicitamente marcados como criados offline
      const cloudIds = new Set(cloudMeds.map(m => m.id));
      const pendingOffline = (_data.medications || []).filter(m => m._isOffline && !cloudIds.has(m.id));
      _data.medications = [...cloudMeds, ...pendingOffline];
      updated = true;
    }

    if (doses) {
      const cloudDoses = doses.map(r => ({
        id: r.id, medId: r.med_id, date: r.date, time: r.time,
        notes: r.notes || '', takenAt: r.taken_at
      }));
      const cloudIds = new Set(cloudDoses.map(d => d.id));
      const pendingOffline = (_data.doses || []).filter(d => d._isOffline && !cloudIds.has(d.id));
      _data.doses = [...cloudDoses, ...pendingOffline];
      updated = true;
    }

    if (syms) {
      const cloudSyms = syms.map(r => ({
        id: r.id, type: r.type, severity: r.severity, date: r.date,
        time: r.time, notes: r.notes || '', createdAt: r.created_at
      }));
      const cloudIds = new Set(cloudSyms.map(s => s.id));
      const pendingOffline = (_data.symptoms || []).filter(s => s._isOffline && !cloudIds.has(s.id));
      _data.symptoms = [...cloudSyms, ...pendingOffline];
      updated = true;
    }

    if (docs) {
      const cloudDocs = docs.map(r => ({
        id: r.id, name: r.name, specialty: r.specialty, notes: r.notes || '', createdAt: r.created_at,
        photo: r.photo || null
      }));
      const cloudIds = new Set(cloudDocs.map(d => d.id));
      const pendingOffline = (_data.doctors || []).filter(d => d._isOffline && !cloudIds.has(d.id));
      _data.doctors = [...cloudDocs, ...pendingOffline];
      updated = true;
    }

    if (updated) {
      saveData(_data, true);
      if (window.refreshCurrentView) {
        window.refreshCurrentView();
      }
    }

    return {
      ok: true,
      meds: _data.medications.length,
      doses: _data.doses.length,
      symptoms: _data.symptoms.length,
      doctors: _data.doctors.length
    };
  } catch (e) {
    console.error('syncFromCloud error', e);
    return { ok: false, error: String(e) };
  }
}

// Envia itens que foram criados offline para a nuvem
async function pushOfflinePending() {
  if (!isCloud()) return;
  const uid = await getAuthUserId();
  if (!uid) return;

  if (_data.medications) {
    for (const m of _data.medications) {
      if (m._isOffline) {
        delete m._isOffline;
        await cloudUpsert('medications', {
          id: m.id, name: m.name, category: m.category, dosage: m.dosage,
          amount: m.amount, unit: m.unit, times: m.times, notes: m.notes, color: m.color,
          frequency: m.frequency, days_of_week: m.daysOfWeek, start_date: m.startDate, day_of_month: m.dayOfMonth,
          usage_type: m.usageType, period_start: m.periodStart, period_end: m.periodEnd, season_months: m.seasonMonths
        });
      }
    }
  }

  if (_data.doctors) {
    for (const doc of _data.doctors) {
      if (doc._isOffline) {
        delete doc._isOffline;
        await cloudUpsert('doctors', {
          id: doc.id, name: doc.name, specialty: doc.specialty, notes: doc.notes, photo: doc.photo
        });
      }
    }
  }

  if (_data.doses) {
    for (const d of _data.doses) {
      if (d._isOffline) {
        delete d._isOffline;
        await cloudUpsert('doses', {
          id: d.id, med_id: d.medId, date: d.date, time: d.time, notes: d.notes, taken_at: d.takenAt
        });
      }
    }
  }

  if (_data.symptoms) {
    for (const s of _data.symptoms) {
      if (s._isOffline) {
        delete s._isOffline;
        await cloudUpsert('symptoms', {
          id: s.id, type: s.type, severity: s.severity, date: s.date, time: s.time, notes: s.notes
        });
      }
    }
  }
  saveData(_data, true);
}

// Força recarregar TUDO da nuvem (substitui dados locais pelos da nuvem)
async function forcePullFromCloud() {
  return syncFromCloud(false);
}

// RESET TOTAL: limpa todos os dados locais e recarrega da nuvem
async function forceResetAndSync() {
  const u = window.currentUser && window.currentUser();
  if (!u) return { ok: false, reason: 'no user' };

  const backup = { medications: _data.medications, doses: _data.doses, symptoms: _data.symptoms, doctors: _data.doctors };
  try { localStorage.setItem('dmc_backup_' + Date.now(), JSON.stringify(backup)); } catch(e) {}

  const allKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('dmc_data_v1_')) allKeys.push(key);
  }
  allKeys.forEach(k => localStorage.removeItem(k));

  _data.medications = [];
  _data.doses = [];
  _data.symptoms = [];
  _data.doctors = [];
  saveData(_data, true);

  const result = await syncFromCloud(false);
  console.log('forceResetAndSync result:', JSON.stringify(result));
  return result;
}

const Store = {
  get: () => _data,
  set: (d) => { _data = d; saveData(_data, true); },
  reload: () => { _data = loadData(); },
  syncToCloud: async () => {
    return pushOfflinePending();
  },
  reloadForUser: () => {
    _data = loadData();
    saveData(_data, false);
  },
  syncFromCloud: syncFromCloud,
  pushOfflinePending: pushOfflinePending,

  medications: {
    all: () => _data.medications || [],
    byId: (id) => (_data.medications || []).find(m => m.id === id),
    byCategory: (cat) => (_data.medications || []).filter(m => m.category === cat),
    add: async (med) => {
      med.id = 'med_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      med.createdAt = new Date().toISOString();
      if (!isCloud()) med._isOffline = true;
      _data.medications.push(med);
      saveData(_data, true);
      if (isCloud()) {
        await cloudUpsert('medications', {
          id: med.id, name: med.name, category: med.category, dosage: med.dosage,
          amount: med.amount, unit: med.unit, times: med.times, notes: med.notes, color: med.color,
          frequency: med.frequency, days_of_week: med.daysOfWeek, start_date: med.startDate, day_of_month: med.dayOfMonth,
          usage_type: med.usageType, period_start: med.periodStart, period_end: med.periodEnd, season_months: med.seasonMonths
        });
      }
      return med;
    },
    update: async (id, patch) => {
      const idx = _data.medications.findIndex(m => m.id === id);
      if (idx !== -1) {
        _data.medications[idx] = { ..._data.medications[idx], ...patch };
        saveData(_data, true);
        if (isCloud()) {
          const m = _data.medications[idx];
          await cloudUpsert('medications', {
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
    remove: async (id) => {
      _data.medications = _data.medications.filter(m => m.id !== id);
      _data.doses = _data.doses.filter(d => d.medId !== id);
      saveData(_data, true);
      if (isCloud()) {
        await cloudDelete('medications', id);
      }
    }
  },

  doses: {
    all: () => _data.doses || [],
    byDate: (date) => (_data.doses || []).filter(d => d.date === date),
    add: async (dose) => {
      dose.id = 'dose_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      dose.takenAt = new Date().toISOString();
      if (!isCloud()) dose._isOffline = true;
      _data.doses.push(dose);
      saveData(_data, true);
      if (isCloud()) {
        await cloudUpsert('doses', {
          id: dose.id, med_id: dose.medId, date: dose.date, time: dose.time,
          notes: dose.notes, taken_at: dose.takenAt
        });
      }
      return dose;
    },
    remove: async (id) => {
      _data.doses = _data.doses.filter(d => d.id !== id);
      saveData(_data, true);
      if (isCloud()) {
        await cloudDelete('doses', id);
      }
    }
  },

  symptoms: {
    all: () => _data.symptoms || [],
    byDate: (date) => (_data.symptoms || []).filter(s => s.date === date),
    add: async (sym) => {
      sym.id = 'sym_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      sym.createdAt = new Date().toISOString();
      if (!isCloud()) sym._isOffline = true;
      _data.symptoms.push(sym);
      saveData(_data, true);
      if (isCloud()) {
        await cloudUpsert('symptoms', {
          id: sym.id, type: sym.type, severity: sym.severity, date: sym.date,
          time: sym.time, notes: sym.notes
        });
      }
      return sym;
    },
    remove: async (id) => {
      _data.symptoms = _data.symptoms.filter(s => s.id !== id);
      saveData(_data, true);
      if (isCloud()) {
        await cloudDelete('symptoms', id);
      }
    }
  },

  reports: {
    all: () => _data.reports || [],
    add: (rep) => {
      rep.id = 'rep_' + Date.now();
      rep.createdAt = new Date().toISOString();
      _data.reports.push(rep);
      saveData(_data, true);
      return rep;
    },
    byId: (id) => (_data.reports || []).find(r => r.id === id),
    remove: (id) => {
      _data.reports = _data.reports.filter(r => r.id !== id);
      saveData(_data, true);
    }
  },

  doctors: {
    all: () => _data.doctors || [],
    byId: (id) => (_data.doctors || []).find(d => d.id === id),
    add: async (doc) => {
      if (!_data.doctors) _data.doctors = [];
      doc.id = 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      doc.createdAt = new Date().toISOString();
      if (!isCloud()) doc._isOffline = true;
      _data.doctors.push(doc);
      saveData(_data, true);
      if (isCloud()) {
        await cloudUpsert('doctors', { id: doc.id, name: doc.name, specialty: doc.specialty, notes: doc.notes, photo: doc.photo });
      }
      return doc;
    },
    update: async (id, patch) => {
      if (!_data.doctors) return null;
      const idx = _data.doctors.findIndex(d => d.id === id);
      if (idx !== -1) {
        _data.doctors[idx] = { ..._data.doctors[idx], ...patch };
        saveData(_data, true);
        if (isCloud()) {
          const d = _data.doctors[idx];
          await cloudUpsert('doctors', { id: d.id, name: d.name, specialty: d.specialty, notes: d.notes, photo: d.photo });
        }
        return _data.doctors[idx];
      }
      return null;
    },
    remove: async (id) => {
      if (!_data.doctors) return;
      _data.doctors = _data.doctors.filter(d => d.id !== id);
      saveData(_data, true);
      if (isCloud()) {
        await cloudDelete('doctors', id);
      }
    }
  },

  monitoredDays: () => {
    const set = new Set();
    (_data.doses || []).forEach(d => set.add(d.date));
    (_data.symptoms || []).forEach(s => set.add(s.date));
    return set.size;
  },
  datesWithData: () => {
    const set = new Set();
    (_data.doses || []).forEach(d => set.add(d.date));
    (_data.symptoms || []).forEach(s => set.add(s.date));
    return set;
  }
};

window.Store = Store;
window.loadData = loadData;
window.saveData = saveData;
window.syncFromCloud = syncFromCloud;
window.syncToCloud = Store.syncToCloud;
window.forcePullFromCloud = forcePullFromCloud;
window.forceResetAndSync = forceResetAndSync;
window.isCloud = isCloud;
window.diagnoseSync = diagnoseSync;
window.setupRealtimeListener = setupRealtimeListener;
