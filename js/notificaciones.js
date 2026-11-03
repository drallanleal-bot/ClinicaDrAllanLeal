// ── NOTIFICACIONES EN EL TELÉFONO ─────────────────
// Funciona con la app instalada en la pantalla de inicio (iPhone con iOS 16.4 o más reciente, Android y computadora).
// El teléfono guarda un "token" en su usuario de Firebase; cada mañana una tarea de GitHub
// (notificaciones/enviar.js) cuenta los recordatorios y le manda un aviso sin nombres de pacientes.
const VAPID_KEY = 'BL6maZ5DIyOAxNrSm7hNdOxOM2fMYNKY_WHAXFdpwVv22WBHFfDeElMzG6aqnMQyR3UfJBB1pvPLhbxvAoCz16Q';
const NOTIF_GUARDADO = 'clinicaNotifToken';

function notifEsIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function notifEnModoApp() { return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true; }
function notifSoportadas() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && typeof firebase !== 'undefined' && !!firebase.messaging; }
function notifTokenGuardado() { try { return localStorage.getItem(NOTIF_GUARDADO) || ''; } catch (e) { return ''; } }

function estadoNotificaciones() {
  if (notifEsIOS() && !notifEnModoApp()) return 'instalar';
  if (!notifSoportadas()) return 'noSoportado';
  if (Notification.permission === 'denied') return 'bloqueadas';
  if (Notification.permission === 'granted' && notifTokenGuardado()) return 'activas';
  return 'apagadas';
}

async function activarNotificaciones() {
  const btn = document.getElementById('btnNotif');
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Activando...'; }
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') { alert('No se dio permiso. Puede activarlo en Configuración del teléfono → Notificaciones → Dr. Allan Leal.'); return; }
    const reg = await navigator.serviceWorker.ready;
    const token = await firebase.messaging().getToken({ vapidKey:VAPID_KEY, serviceWorkerRegistration:reg });
    if (!token) throw new Error('sin token');
    await db.collection('usuarios').doc(auth.currentUser.uid).set({
      pushTokens:firebase.firestore.FieldValue.arrayUnion(token),
      pushActualizado:firebase.firestore.FieldValue.serverTimestamp()
    }, { merge:true });
    try { localStorage.setItem(NOTIF_GUARDADO, token); } catch (e) {}
    await reg.showNotification('Clínica Dr. Allan Leal', { body:'✅ Notificaciones activadas en este teléfono.', icon:'icons/icono-192.png', badge:'icons/icono-192.png' });
    showToast('🔔 Notificaciones activadas.');
  } catch (e) {
    console.warn('No se pudieron activar las notificaciones.', e);
    alert('No se pudieron activar las notificaciones. Revise el internet e intente de nuevo.' + (e && e.code ? `\n(${e.code})` : ''));
  } finally {
    if (currentPage === 'recordatorios') renderRecordatorios();
  }
}

async function probarNotificacion() {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('Clínica Dr. Allan Leal', { body:'🔔 Así se verá el aviso de cada mañana.', icon:'icons/icono-192.png', badge:'icons/icono-192.png' });
}

// Tarjeta en Recordatorios (solo el doctor: su usuario guarda el token).
function tarjetaNotificaciones() {
  if (currentUser?.role !== 'admin') return '';
  const e = estadoNotificaciones();
  const textos = {
    activas:'✅ Activas en este dispositivo. Cada mañana le llega un aviso con cuántos recordatorios hay por enviar (sin nombres de pacientes).',
    apagadas:'Reciba cada mañana un aviso en el teléfono con los recordatorios por enviar, sin abrir la app.',
    instalar:'En iPhone primero instale la app: en Safari toque Compartir → «Agregar a pantalla de inicio», ábrala desde ese ícono y vuelva aquí.',
    bloqueadas:'Las notificaciones están bloqueadas. Actívelas en Configuración del teléfono → Notificaciones → Dr. Allan Leal.',
    noSoportado:'Este navegador no permite notificaciones. En iPhone use la app instalada desde Safari.'
  };
  const boton = e === 'apagadas' ? '<button class="btn btn-primary" id="btnNotif" onclick="activarNotificaciones()">🔔 Activar notificaciones</button>'
    : e === 'activas' ? '<button class="btn btn-outline" onclick="probarNotificacion()">🔔 Probar</button><button class="btn btn-outline" onclick="activarNotificaciones()">🔄 Volver a activar</button>' : '';
  return `<div class="card">
  <div class="cardTitle">🔔 Avisos en el teléfono</div>
  <p class="avisoNota">${textos[e]}</p>
  ${boton ? `<div class="avisoBtns">${boton}</div>` : ''}
</div>`;
}
