/* ============================================================
   auth-ui.js - Interface de login/cadastro
   ============================================================ */

function showAuthOverlay() {
  document.getElementById('authOverlay').classList.remove('hidden');
  document.querySelector('.app').style.display = 'none';
  document.body.style.overflow = '';
}
function hideAuthOverlay() {
  document.getElementById('authOverlay').classList.add('hidden');
  document.querySelector('.app').style.display = '';
  document.body.style.overflow = '';
  // fecha o modal de acesso, caso estivesse aberto
  const m = document.getElementById('authModal');
  if (m) m.hidden = true;
}

function updateAuthModeText() {
  const el = document.getElementById('authMode');
  if (!el) return;
  el.textContent = Auth.isCloudEnabled() ? 'Modo nuvem (Supabase) — dados sincronizados' : 'Modo local — dados salvos neste navegador';
}

function updateUserCard() {
  const u = Auth.currentUser();
  if (!u) return;
  const initials = (u.name || u.email || 'P').split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
  const avatar = document.getElementById('userAvatar');
  const initialsEl = document.getElementById('userAvatarInitials');
  const removeBtn = document.getElementById('userPhotoRemove');
  if (initialsEl) initialsEl.textContent = initials;
  if (avatar) {
    if (u.photo) {
      avatar.style.backgroundImage = 'url(' + u.photo + ')';
      avatar.style.backgroundSize = 'cover';
      avatar.style.backgroundPosition = 'center';
      if (initialsEl) initialsEl.style.display = 'none';
      if (removeBtn) removeBtn.hidden = false;
    } else {
      avatar.style.backgroundImage = '';
      avatar.style.backgroundSize = '';
      avatar.style.backgroundPosition = '';
      if (initialsEl) initialsEl.style.display = '';
      if (removeBtn) removeBtn.hidden = true;
    }
  }
  document.getElementById('userName').textContent = u.name || u.email;
  document.getElementById('userStatus').textContent = u.mode === 'cloud' ? 'Conta na nuvem' : 'Conta local';
}

// Upload de foto de perfil do usuário
const userAvatarWrap = document.querySelector('.user-card__avatar-wrap');
const userAvatarMenu = document.getElementById('userAvatarMenu');
const userPhotoChange = document.getElementById('userPhotoChange');
const userPhotoRemove = document.getElementById('userPhotoRemove');

function closeUserAvatarMenu() {
  if (userAvatarMenu) userAvatarMenu.hidden = true;
  if (userAvatarWrap) userAvatarWrap.classList.remove('open');
}

document.getElementById('userAvatar')?.addEventListener('click', (e) => {
  e.stopPropagation();
  const u = Auth.currentUser();
  // If no photo, directly open file picker
  if (!u || !u.photo) {
    const input = document.getElementById('userPhotoInput');
    if (input) input.click();
    return;
  }
  // If has photo, show menu with options
  if (userAvatarMenu) {
    const isOpen = !userAvatarMenu.hidden;
    userAvatarMenu.hidden = isOpen;
    if (userAvatarWrap) userAvatarWrap.classList.toggle('open', !isOpen);
  }
});

if (userPhotoChange) {
  userPhotoChange.addEventListener('click', (e) => {
    e.stopPropagation();
    closeUserAvatarMenu();
    const input = document.getElementById('userPhotoInput');
    if (input) input.click();
  });
}

if (userPhotoRemove) {
  userPhotoRemove.addEventListener('click', (e) => {
    e.stopPropagation();
    closeUserAvatarMenu();
    if (!confirm('Remover a foto de perfil?')) return;
    const u = Auth.currentUser();
    if (!u) return;
    delete u.photo;
    Auth.setCurrentUser(u);
    if (window.Auth.updateProfilePhoto) Auth.updateProfilePhoto(null).catch(()=>{});
    updateUserCard();
    toast('Foto removida.', 'info');
  });
}

// Close menu when clicking outside
document.addEventListener('click', (e) => {
  if (userAvatarWrap && !userAvatarWrap.contains(e.target)) {
    closeUserAvatarMenu();
  }
});

document.getElementById('userPhotoInput')?.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  openImageCropper(file, async (dataUrl) => {
    await Auth.updateProfilePhoto(dataUrl);
    updateUserCard();
    toast('Foto de perfil atualizada!', 'success');
  });
  e.target.value = '';
});

async function requireAuth() {
  const u = Auth.currentUser();
  if (!u) { showAuthOverlay(); return false; }
  hideAuthOverlay();
  updateUserCard();
  if (window.Store && Store.reloadForUser) Store.reloadForUser();
  if (!window.isCloud || !window.isCloud()) {
    console.warn('Cloud mode DISABLED: Supabase library not loaded or not configured.');
    toast('⚠️ Modo offline: Supabase não carregou. Verifique sua conexão e desative bloqueadores (Brave Shields).', 'error');
  }
  if (window.isCloud && window.isCloud() && window.Store && Store.syncFromCloud) {
    console.log('requireAuth: modo nuvem ativo, sincronizando a versão mais recente...');
    // 1. Puxa primeiro os dados da nuvem (nuvem é a fonte de verdade para contas sincronizadas)
    try {
      await Store.syncFromCloud();
    } catch (e) {
      console.error('syncFromCloud error', e);
    }
    // 2. Envia quaisquer itens que foram criados offline localmente
    if (window.Store.pushOfflinePending) {
      try {
        await Store.pushOfflinePending();
      } catch (e) {
        console.error('pushOfflinePending error', e);
      }
    }
    // 3. Ativa listener de sincronização em tempo real (Supabase Realtime)
    if (window.setupRealtimeListener && u.id) {
      window.setupRealtimeListener(u.id);
    }
    // Diagnóstico
    if (window.diagnoseSync) {
      const diag = await window.diagnoseSync();
      console.log('diagnoseSync:', JSON.stringify(diag));
      // Show warning if any table is missing
      const missingTables = Object.entries(diag.tables || {}).filter(([t, r]) => !r.ok);
      if (missingTables.length > 0) {
        console.warn('MISSING TABLES:', missingTables.map(([t]) => t).join(', '));
        toast('Tabelas do Supabase nao encontradas: ' + missingTables.map(([t]) => t).join(', ') + '. Rode o SQL no Supabase.', 'error');
      } else {
        console.log('All cloud tables OK');
      }
      if (!diag.sessionValid) {
        toast('Sessao expirada. Faca login novamente.', 'error');
      }
    }
  } else if (window.Store && Store.reloadForUser) {
    Store.reloadForUser();
  }
  if (window.renderDashboard) window.renderDashboard();
  // re-render current view
  const active = document.querySelector('.nav__item.active')?.dataset.view || 'dashboard';
  if (window.switchView) window.switchView(active);
  return true;
}

// tabs
function switchAuthMode(mode) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.auth === mode));
  document.getElementById('loginForm').hidden = mode !== 'login';
  document.getElementById('registerForm').hidden = mode !== 'register';
  document.getElementById('authHint').textContent = '';
}
document.querySelectorAll('.auth-tab, .link-btn').forEach(el => {
  el.addEventListener('click', () => switchAuthMode(el.dataset.auth));
});

// Acessar (dropdown + modal de login/cadastro)
const heroAccess = document.getElementById('heroAccess');
const heroAccessBtn = document.getElementById('heroAccessBtn');
const heroAccessMenu = document.getElementById('heroAccessMenu');
const authModal = document.getElementById('authModal');
const authChoice = document.getElementById('authChoice');
const authFormView = document.getElementById('authFormView');

function showChoiceView() {
  if (authChoice) authChoice.hidden = false;
  if (authFormView) authFormView.hidden = true;
}
function showFormView(mode) {
  if (authChoice) authChoice.hidden = true;
  if (authFormView) authFormView.hidden = false;
  switchAuthMode(mode || 'login');
}

function openAuthModal(mode) {
  if (!authModal) return;
  authModal.hidden = false;
  document.body.style.overflow = 'hidden';
  if (mode) showFormView(mode); else showChoiceView();
}
function closeAuthModal() {
  if (!authModal) return;
  authModal.hidden = true;
  document.body.style.overflow = '';
  showChoiceView();
}

heroAccessBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  openAuthModal();
});
document.querySelectorAll('[data-open-auth]').forEach(btn => {
  btn.addEventListener('click', () => {
    openAuthModal(btn.dataset.openAuth);
  });
});
document.querySelectorAll('[data-back-choice]').forEach(btn => {
  btn.addEventListener('click', showChoiceView);
});
document.querySelectorAll('[data-close-auth]').forEach(el => {
  el.addEventListener('click', closeAuthModal);
});
document.addEventListener('click', (e) => {
  if (heroAccess && !heroAccess.contains(e.target)) heroAccess.classList.remove('open');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && authModal && !authModal.hidden) closeAuthModal();
});

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const hint = document.getElementById('authHint');
  hint.textContent = '';
  // remove resend button if exists
  const oldResend = document.getElementById('resendConfirmBtn');
  if (oldResend) oldResend.remove();
  try {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    await Auth.login(email, password);
    closeAuthModal();
    await requireAuth();
    toast('Bem-vindo de volta!', 'success');
    // re-render current view
    const active = document.querySelector('.nav__item.active')?.dataset.view || 'dashboard';
    switchView(active);
  } catch (err) {
    hint.textContent = err.message || 'Erro ao entrar';
    // Show resend confirmation button if email not confirmed
    if (/não confirmado|not confirmed/i.test(err.message || '')) {
      const btn = document.createElement('button');
      btn.id = 'resendConfirmBtn';
      btn.type = 'button';
      btn.className = 'btn btn--ghost btn--block';
      btn.style.marginTop = '8px';
      btn.textContent = 'Reenviar e-mail de confirmação';
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Enviando...';
        try {
          const email = document.getElementById('loginEmail').value;
          await Auth.resendConfirmation(email);
          hint.textContent = 'E-mail de confirmação reenviado! Verifique sua caixa de entrada (e spam).';
          toast('E-mail reenviado!', 'success');
        } catch (e) {
          hint.textContent = e.message || 'Erro ao reenviar';
        } finally {
          btn.disabled = false;
          btn.textContent = 'Reenviar e-mail de confirmação';
        }
      });
      hint.parentNode.insertBefore(btn, hint.nextSibling);
    }
  }
});

document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const hint = document.getElementById('authHint');
  hint.textContent = '';
  try {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const res = await Auth.register(email, password, name);
    closeAuthModal();
    if (res && res.needsConfirmation) {
      hint.textContent = 'Cadastro criado! Verifique seu e-mail para confirmar a conta antes de entrar.';
      toast('Verifique seu e-mail para confirmar o cadastro.', 'info');
      return;
    }
    await requireAuth();
    toast('Conta criada com sucesso!', 'success');
    const active = document.querySelector('.nav__item.active')?.dataset.view || 'dashboard';
    switchView(active);
  } catch (err) {
    hint.textContent = err.message || 'Erro ao cadastrar';
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
  if (confirm('Deseja sair da conta?')) {
    Auth.logout();
    showAuthOverlay();
    toast('Sessão encerrada', 'info');
  }
});

document.getElementById('deleteAccountBtn')?.addEventListener('click', () => {
  const input = document.getElementById('deleteConfirmInput');
  const btn = document.getElementById('deleteConfirmBtn');
  if (input) input.value = '';
  if (btn) btn.disabled = true;
  openModal('deleteAccountModal');
});

document.getElementById('deleteConfirmInput')?.addEventListener('input', (e) => {
  const btn = document.getElementById('deleteConfirmBtn');
  if (btn) btn.disabled = e.target.value.trim().toUpperCase() !== 'EXCLUIR';
});

document.getElementById('deleteConfirmBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('deleteConfirmBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Excluindo...'; }
  try {
    await Auth.deleteAccount();
    closeModal('deleteAccountModal');
    showAuthOverlay();
    toast('Conta e dados removidos', 'success');
  } catch (e) {
    toast('Erro: ' + (e.message || e), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Excluir conta'; }
  }
});

// init
document.addEventListener('DOMContentLoaded', async () => {
  updateAuthModeText();
  if (window.Auth && Auth.restoreCloudSession) await Auth.restoreCloudSession();
  await requireAuth();
});
