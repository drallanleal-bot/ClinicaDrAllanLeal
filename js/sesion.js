function cargarPacientes() {
  if (isOcupViewer()) return;
  startRealtimeSync();
  startPatientCollectionSync();
  syncLocalPatientsToCloud();
}

let currentPage = 'dashboard';
let currentModule = 'clinica';
let calMonth = new Date().getMonth();
let calYear  = new Date().getFullYear();
let editingPacienteId = null;
let editingHistoriaId = null;
let editingCitaId = null;
let editingOcupRegistroId = null;
let editingOcupScanId = null;
let pendingCloudRefresh = false;
let pendingCloudRefreshTimer = null;

function isAdminUser() {
  return currentUser && currentUser.role === 'admin';
}

function isOcupViewer() {
  return currentUser && (currentUser.role === 'viewer_ocupacional' || currentUser.role === 'ingeniero');
}

function renderModuleSwitch() {
  const el = document.getElementById('moduleSwitch');
  if (!el) return;
  if (isOcupViewer()) {
    el.innerHTML = `<button class="moduleBtn active" type="button">Salud Ocupacional</button>`;
    return;
  }
  el.innerHTML = `
    <button class="moduleBtn ${currentModule==='clinica'?'active':''}" type="button" onclick="switchModule('clinica')">Clínica Propia</button>
    <button class="moduleBtn ${currentModule==='ocupacional'?'active':''}" type="button" onclick="switchModule('ocupacional')">Salud Ocupacional</button>
  `;
}

function renderSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  if (currentModule === 'ocupacional') {
    sidebar.innerHTML = `
      <button class="navBtn" onclick="goTo('occEmpresas')" id="nav-occEmpresas"><span class="navIcon">🏢</span><span class="navLabel">Empresas</span></button>
      <button class="navBtn" onclick="goTo('occDashboard')" id="nav-occDashboard"><span class="navIcon">📊</span><span class="navLabel">Dashboard</span></button>
      ${isOcupViewer() ? '' : `<button class="navBtn" onclick="goTo('occRegistros')" id="nav-occRegistros"><span class="navIcon">🩺</span><span class="navLabel">Registros EMOP</span></button>`}
      <button class="navBtn" onclick="goTo('occEscaneres')" id="nav-occEscaneres"><span class="navIcon">📁</span><span class="navLabel">Escáneres</span></button>
      <button class="navBtn" onclick="goTo('occPlantas')" id="nav-occPlantas"><span class="navIcon">🏭</span><span class="navLabel">Plantas</span></button>
      ${isOcupViewer() ? '' : `<button class="navBtn" onclick="goTo('occPlanes')" id="nav-occPlanes"><span class="navIcon">📄</span><span class="navLabel">Planes SSO</span></button>`}
      <div class="sidebar-footer">
        ${isOcupViewer() ? '' : `<button class="navBtn" onclick="switchModule('clinica')"><span class="navIcon">🏥</span><span class="navLabel">Clínica Propia</span></button>`}
        <button class="navBtn" onclick="doLogout()"><span class="navIcon">🚪</span><span class="navLabel">Cerrar sesión</span></button>
      </div>`;
    return;
  }
  sidebar.innerHTML = `
    <button class="navBtn" onclick="goTo('dashboard')" id="nav-dashboard"><span class="navIcon">🏠</span><span class="navLabel">Inicio</span></button>
    <button class="navBtn" onclick="goTo('pacientes')" id="nav-pacientes"><span class="navIcon">👥</span><span class="navLabel">Pacientes</span></button>
    <button class="navBtn" onclick="goTo('historias')" id="nav-historias"><span class="navIcon">📋</span><span class="navLabel">Historias</span></button>
    <button class="navBtn" onclick="goTo('agenda')" id="nav-agenda"><span class="navIcon">📅</span><span class="navLabel">Agenda</span></button>
    <button class="navBtn" onclick="goTo('recordatorios')" id="nav-recordatorios"><span class="navIcon">🔔</span><span class="navLabel">Recordatorios</span></button>
    <button class="navBtn" id="nav-respaldos" onclick="goTo('respaldos')"><span class="navIcon">💾</span><span class="navLabel">Respaldos</span></button>
    <div class="sidebar-footer">
      <button class="navBtn" onclick="switchModule('ocupacional')"><span class="navIcon">🏭</span><span class="navLabel">Salud Ocupacional</span></button>
      <button class="navBtn" onclick="doLogout()"><span class="navIcon">🚪</span><span class="navLabel">Cerrar sesión</span></button>
    </div>`;
}

function switchModule(module, page) {
  if (isOcupViewer()) module = 'ocupacional';
  currentModule = module;
  document.body.classList.toggle('occ-tropigas', module === 'ocupacional' && occData().activeEmpresa === 'TROPIGAS');
  renderModuleSwitch();
  renderSidebar();
  goTo(page || (module === 'ocupacional' ? 'occEmpresas' : 'dashboard'));
}

function initializeUserSession() {
  document.getElementById('topAvatar').textContent = currentUser.initials;
  document.getElementById('topName').textContent = currentUser.name;
  switchModule(isOcupViewer() ? 'ocupacional' : 'clinica', isOcupViewer() ? 'occDashboard' : 'dashboard');
  cargarPacientes();
  startOccupationalRealtimeSync();
  resetTimer();
}

// ── AUTH ──────────────────────────────────────────
function getLoginAccount(usernameOrEmail) {
  const key = String(usernameOrEmail || '').trim().toLowerCase();
  if (LOGIN_ACCOUNTS[key]) return { username:key, ...LOGIN_ACCOUNTS[key] };
  if (key.includes('@')) return { username:key.split('@')[0], email:key, name:key, role:'admin', initials:'US' };
  return null;
}

function initialsFromName(name) {
  return String(name || 'Usuario')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('') || 'US';
}

async function buildCurrentUser(firebaseUser, preferredUsername = '') {
  if (!firebaseUser) throw new Error('No hay usuario autenticado en Firebase.');
  const profileSnap = await db.collection('usuarios').doc(firebaseUser.uid).get();
  if (!profileSnap.exists) {
    throw new Error('Este usuario existe en Authentication, pero falta crearlo en Firestore > usuarios con su UID.');
  }
  const profile = profileSnap.data() || {};
  if (profile.active !== true) {
    throw new Error('Este usuario está desactivado. Revise el campo active en Firestore.');
  }
  const username = String(profile.username || preferredUsername || firebaseUser.email || '').trim().toLowerCase();
  const account = LOGIN_ACCOUNTS[username] || LOGIN_ACCOUNTS[String(preferredUsername || '').toLowerCase()] || {};
  const name = profile.nombre || profile.name || account.name || username.toUpperCase() || 'Usuario';
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || account.email || '',
    username,
    name,
    role: profile.role || account.role || 'admin',
    initials: profile.initials || account.initials || initialsFromName(name)
  };
}

function showLoginError(message) {
  const err = document.getElementById('loginError');
  err.textContent = message || 'Usuario o contraseña incorrectos.';
  err.style.display = 'block';
  setTimeout(() => err.style.display = 'none', 5500);
}

function resetLoginButton() {
  const btn = document.querySelector('.btnLogin');
  btn.innerText = 'Ingresar al sistema';
  btn.disabled = false;
}

function enterApp(animated = true) {
  const screen = document.getElementById('loginScreen');
  const app = document.getElementById('app');
  if (animated) screen.classList.add('fadeOut');
  setTimeout(() => {
    screen.style.display = 'none';
    app.style.display = 'flex';
    app.classList.add('fadeIn');
    initializeUserSession();
    resetLoginButton();
  }, animated ? 350 : 0);
}

async function doLogin() {
  const usernameInput = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const account = getLoginAccount(usernameInput);
  const btn = document.querySelector('.btnLogin');

  btn.innerHTML = '<span class="spinner"></span>Ingresando...';
  btn.disabled = true;

  try {
    if (!auth) throw new Error('Firebase Authentication no está disponible.');
    if (!account) throw new Error('Usuario no autorizado. Revise que esté escrito como DRLEAL, MICHI o INGSALANIC.');
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    const credential = await auth.signInWithEmailAndPassword(account.email, password);
    currentUser = await buildCurrentUser(credential.user, account.username);
    localStorage.setItem('lastUser', account.username);
    localStorage.setItem('user', JSON.stringify(currentUser));
    document.getElementById('loginPass').value = '';
    enterApp(true);
  } catch (error) {
    console.warn('No se pudo iniciar sesión.', error);
    currentUser = null;
    localStorage.removeItem('user');
    showLoginError(error.message || 'No se pudo iniciar sesión con Firebase.');
    resetLoginButton();
  }
}

async function doLogout() {
  if (cloudUnsubscribe) { cloudUnsubscribe(); cloudUnsubscribe = null; }
  if (patientCollectionUnsubscribe) { patientCollectionUnsubscribe(); patientCollectionUnsubscribe = null; }
  if (occCloudUnsubscribe) { occCloudUnsubscribe(); occCloudUnsubscribe = null; }
  cloudSyncStarting = false;
  cloudInitialStateApplied = false;
  cloudHasUnsavedChanges = false;
  clearTimeout(cloudRetryTimer);
  syncErrors.clear();
  renderSyncPill();
  patientCollectionStarting = false;
  occCloudSyncStarting = false;
  occCloudLoaded = false;
  currentUser = null;
  localStorage.removeItem('user');
  try {
    if (auth && auth.currentUser) await auth.signOut();
  } catch (error) {
    console.warn('No se pudo cerrar la sesión de Firebase.', error);
  }
  document.getElementById('loginScreen').classList.remove('fadeOut');
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
}
document.getElementById('loginPass').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
document.getElementById('loginUser').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const pass = document.getElementById('loginPass');
  if (pass.value) doLogin(); else pass.focus();
});

if (auth) {
  auth.onAuthStateChanged(async (firebaseUser) => {
    if (!firebaseUser || currentUser) return;
    try {
      const saved = JSON.parse(localStorage.getItem('user') || '{}');
      currentUser = await buildCurrentUser(firebaseUser, saved.username || localStorage.getItem('lastUser') || '');
      localStorage.setItem('user', JSON.stringify(currentUser));
      enterApp(false);
    } catch (error) {
      console.warn('Sesión previa no válida.', error);
      localStorage.removeItem('user');
      await auth.signOut().catch(() => {});
    }
  });
}
// 🔵 RECORDAR USUARIO
window.addEventListener('load', () => {
  const savedUser = localStorage.getItem('lastUser');
  if (savedUser) {
    document.getElementById('loginUser').value = savedUser;
  }
});
window.addEventListener('load', () => {
  restoreOneDriveFolderConnection(false).then((connected) => {
    if (connected) writeOneDriveBackup(false);
  });
});
// ⏱️ AUTO LOGOUT POR INACTIVIDAD (30 min)
let inactivityTimer;

function resetTimer() {
  clearTimeout(inactivityTimer);

  inactivityTimer = setTimeout(() => {
    alert("Sesión cerrada por inactividad");
    doLogout();
  }, 30 * 60 * 1000); // 30 minutos
}

// Detectar actividad del usuario
['click','mousemove','keydown','scroll','touchstart'].forEach(event => {
  document.addEventListener(event, resetTimer);
});
