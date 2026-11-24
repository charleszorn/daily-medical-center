/* ============================================================
   auth.js - Autenticação (local + Supabase opcional)
   ============================================================ */

const AUTH_KEY = 'dmc_auth_v1';
const USERS_KEY = 'dmc_users_v1';

// ---------- Supabase (opcional) ----------
// Preencha estas constantes com as credenciais do seu projeto Supabase
// para habilitar login/cadastro e sincronização na nuvem.
// Deixe vazio para usar autenticação local (localStorage).
const SUPABASE_URL = 'https://uhvomwfpzdejnukadhnr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_23Sevy_7uPjmq85TxaeWPw_wBZQDCX0';

let supabaseClient = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  // Restaura a sessão automaticamente quando ela muda (ex.: expirou, fez logout)
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      // só limpa se a conta atual era cloud
      try {
        const u = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
        if (u && u.mode === 'cloud') {
          localStorage.removeItem(AUTH_KEY);
          if (typeof showAuthOverlay === 'function') showAuthOverlay();
        }
      } catch (e) {}
    }
  });
}
window.supabaseClient = supabaseClient;

function isCloudEnabled() {
  return !!supabaseClient;
}

// ---------- Local auth ----------
function loadUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch { return []; }
}
function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

async function hashPassword(password) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(password + '::dmc_salt'));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function currentUser() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { return null; }
}
function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    try { localStorage.setItem('dmc_last_user_id_v1', user.id); } catch(e) {}
  } else {
    localStorage.removeItem(AUTH_KEY);
  }
}

async function registerLocal(email, password, name) {
  email = email.trim().toLowerCase();
  const users = loadUsers();
  if (users.find(u => u.email === email)) throw new Error('E-mail já cadastrado');
  const hash = await hashPassword(password);
  const user = { id: 'u_' + Date.now(), email, name: name || email.split('@')[0], passwordHash: hash, createdAt: new Date().toISOString() };
  users.push(user);
  saveUsers(users);
  const session = { id: user.id, email: user.email, name: user.name, mode: 'local' };
  setCurrentUser(session);
  return session;
}

async function loginLocal(email, password) {
  email = email.trim().toLowerCase();
  const users = loadUsers();
  const user = users.find(u => u.email === email);
  if (!user) throw new Error('Usuário não encontrado neste navegador. Cadastre-se ou use Supabase para sincronizar.');
  const hash = await hashPassword(password);
  if (hash !== user.passwordHash) throw new Error('Senha incorreta');
  const session = { id: user.id, email: user.email, name: user.name, mode: 'local' };
  setCurrentUser(session);
  return session;
}

function logout() {
  setCurrentUser(null);
  if (isCloudEnabled() && supabaseClient) {
    supabaseClient.auth.signOut().catch(()=>{});
  }
}

async function deleteAccount() {
  const u = currentUser();
  if (!u) return;
  if (isCloudEnabled() && supabaseClient) {
    try {
      await supabaseClient.from('medications').delete().eq('user_id', u.id);
      await supabaseClient.from('doses').delete().eq('user_id', u.id);
      await supabaseClient.from('symptoms').delete().eq('user_id', u.id);
    } catch (e) { console.error('delete data error', e); }
    // try to delete auth user (requires service role; may fail)
    try {
      await supabaseClient.auth.admin.deleteUser(u.id);
    } catch (e) { console.warn('auth delete not allowed client-side', e); }
  }
  // clear local data
  localStorage.removeItem('dmc_data_v1_' + u.id);
  localStorage.removeItem(AUTH_KEY);
  setCurrentUser(null);
  if (isCloudEnabled() && supabaseClient) {
    supabaseClient.auth.signOut().catch(()=>{});
  }
}

// ---------- Cloud auth (Supabase) ----------
async function registerCloud(email, password, name) {
  const { data, error } = await supabaseClient.auth.signUp({
    email, password,
    options: {
      data: { name },
      emailRedirectTo: window.location.origin + '/'
    }
  });
  if (error) {
    console.error('registerCloud error', error);
    throw new Error(error.message || 'Erro ao cadastrar');
  }
  // Se a confirmação de e-mail estiver ativada, não há sessão ainda
  if (!data.session) {
    return { needsConfirmation: true, email: data.user.email };
  }
  const session = { id: data.user.id, email: data.user.email, name: name || email.split('@')[0], mode: 'cloud' };
  setCurrentUser(session);
  return session;
}
async function loginCloud(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('loginCloud error', error);
    if (/not confirmed|email not confirmed/i.test(error.message || '')) {
      throw new Error('E-mail ainda não confirmado. Verifique sua caixa de entrada (e spam) e clique no link de confirmação, ou clique em "Reenviar confirmação".');
    }
    throw new Error(error.message || 'Erro ao entrar');
  }
  // Verify the session is actually usable
  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError || !sessionData?.session) {
    console.error('loginCloud: session not established after login', sessionError);
    throw new Error('Sessão não estabelecida. Tente novamente.');
  }
  const name = data.user.user_metadata?.name || email.split('@')[0];
  const photo = data.user.user_metadata?.photo || null;
  const session = { id: data.user.id, email: data.user.email, name, mode: 'cloud', photo };
  setCurrentUser(session);
  return session;
}

async function resendConfirmation(email) {
  if (!isCloudEnabled()) throw new Error('Modo nuvem não disponível');
  email = email.trim().toLowerCase();
  const { error } = await supabaseClient.auth.resend({ type: 'signup', email });
  if (error) throw new Error(error.message || 'Erro ao reenviar');
  return true;
}

async function restoreCloudSession() {
  if (!isCloudEnabled()) return false;
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) { console.warn('getSession error', error); return false; }
    const session = data?.session;
    if (session?.user) {
      const u = session.user;
      const name = u.user_metadata?.name || u.email.split('@')[0];
      setCurrentUser({ id: u.id, email: u.email, name, mode: 'cloud', photo: u.user_metadata?.photo || null });
      return true;
    }
  } catch (e) { console.error('restoreCloudSession error', e); }
  return false;
}

async function register(email, password, name) {
  if (isCloudEnabled()) return registerCloud(email, password, name);
  return registerLocal(email, password, name);
}
async function login(email, password) {
  if (isCloudEnabled()) return loginCloud(email, password);
  return loginLocal(email, password);
}

// Expose
async function updateProfilePhoto(photoDataUrl) {
  const u = currentUser();
  if (!u) return;
  u.photo = photoDataUrl;
  setCurrentUser(u);
  if (isCloudEnabled() && supabaseClient) {
    try {
      await supabaseClient.auth.updateUser({ data: { photo: photoDataUrl } });
    } catch (e) { console.warn('photo sync failed', e); }
  }
}
window.Auth = {
  currentUser, setCurrentUser, register, login, logout, deleteAccount,
  isCloudEnabled, isCloud: isCloudEnabled, restoreCloudSession, resendConfirmation,
  updateProfilePhoto
};
window.deleteAccount = deleteAccount;
window.currentUser = currentUser;
window.logout = logout;
