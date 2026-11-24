/* ============================================================
   notifications.js - Avisos e notificações dos horários
   ============================================================ */

const NOTIF_KEY = 'dmc_notif_enabled_v1';

const Notifications = {
  enabled: () => localStorage.getItem(NOTIF_KEY) === '1',
  setEnabled: (v) => localStorage.setItem(NOTIF_KEY, v ? '1' : '0'),
  supported: () => 'Notification' in window,

  async requestPermission() {
    if (!Notifications.supported()) {
      toast('Notificações não suportadas neste navegador', 'error');
      return false;
    }
    const perm = await Notification.requestPermission();
    const ok = perm === 'granted';
    Notifications.setEnabled(ok);
    if (ok) {
      toast('Notificações ativadas', 'success');
      Notifications.scheduleToday();
    } else {
      toast('Permissão de notificação negada', 'error');
    }
    updateNotifButton();
    return ok;
  },

  async show(title, body, tag) {
    if (!Notifications.enabled()) return;
    if (!Notifications.supported() || Notification.permission !== 'granted') return;
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification(title, {
          body, tag, icon: 'assets/icon.svg', badge: 'assets/icon.svg',
          vibrate: [200, 100, 200], requireInteraction: false
        });
      } else {
        new Notification(title, { body, tag, icon: 'assets/icon.svg' });
      }
    } catch (e) {
      console.error('notif error', e);
    }
  },

  // timers for today
  _timers: [],
  clearTimers() {
    Notifications._timers.forEach(t => clearTimeout(t));
    Notifications._timers = [];
  },
  scheduleToday() {
    Notifications.clearTimers();
    if (!Notifications.enabled()) return;
    if (!Notifications.supported() || Notification.permission !== 'granted') return;

    const items = (window.getTodaySchedule ? window.getTodaySchedule() : []);
    const now = new Date();
    items.forEach(it => {
      if (it.taken) return;
      const [hh, mm] = it.time.split(':').map(Number);
      const target = new Date();
      target.setHours(hh, mm, 0, 0);
      const delay = target.getTime() - now.getTime();
      if (delay <= 0) return; // already passed
      // notify 5 min before? We'll notify at exact time and 5 min before
      const t1 = setTimeout(() => {
        Notifications.show(
          'Hora do medicamento',
          `${it.med.name} — ${it.med.amount} ${it.med.unit} (${it.med.dosage})`,
          'dose_' + it.med.id + '_' + it.time
        );
      }, delay);
      Notifications._timers.push(t1);
      // 5 min before reminder
      if (delay > 5 * 60 * 1000) {
        const t2 = setTimeout(() => {
          Notifications.show(
            'Lembrete: medicamento em 5 minutos',
            `${it.med.name} às ${it.time}`,
            'reminder_' + it.med.id + '_' + it.time
          );
        }, delay - 5 * 60 * 1000);
        Notifications._timers.push(t2);
      }
    });
  }
};

function updateNotifButton() {
  const btn = document.getElementById('notifBtn');
  if (!btn) return;
  const on = Notifications.enabled() && Notifications.supported() && Notification.permission === 'granted';
  btn.textContent = on ? '🔔 Notificações ativas' : '🔕 Ativar notificações';
  btn.classList.toggle('active', on);
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('notifBtn');
  if (btn) btn.addEventListener('click', () => Notifications.requestPermission());
  updateNotifButton();
  if (Notifications.enabled()) Notifications.scheduleToday();
});

window.Notifications = Notifications;
window.updateNotifButton = updateNotifButton;
