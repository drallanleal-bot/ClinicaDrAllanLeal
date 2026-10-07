const cloudSyncErrorAreas = new Set();

// ── ESTADO DE GUARDADO Y AVISOS ───────────────────
// Avisos breves que desaparecen solos, en lugar de ventanas que hay que cerrar.
function showToast(message, type = 'ok', ms = 3500) {
  const box = document.getElementById('toastBox');
  if (!box) { alert(message); return; }
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.textContent = message;
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, ms);
}

let syncPendingWrites = 0;
const syncErrors = new Map();

// Etiqueta de la barra superior: Guardado, Guardando…, Sin conexión o Error al guardar.
function renderSyncPill() {
  const pill = document.getElementById('syncPill');
  if (!pill) return;
  let kind = 'saved', text = 'Guardado';
  if (!navigator.onLine) { kind = 'offline'; text = 'Sin conexión, se guardará al volver'; }
  else if (syncErrors.size) { kind = 'error'; text = 'Error al guardar'; }
  else if (syncPendingWrites > 0 || cloudHasUnsavedChanges) { kind = 'saving'; text = 'Guardando…'; }
  pill.className = 'syncPill ' + kind;
  pill.querySelector('.syncText').textContent = text;
  pill.title = kind === 'error' ? 'Toque para ver qué pasó' : text;
}

async function trackCloudWrite(area, work) {
  syncPendingWrites++;
  renderSyncPill();
  try {
    const result = await work();
    syncErrors.delete(area);
    return result;
  } finally {
    syncPendingWrites = Math.max(0, syncPendingWrites - 1);
    renderSyncPill();
  }
}

function showSyncDetails() {
  if (!syncErrors.size) return;
  const lines = [...syncErrors].map(([area, detail]) => `• ${area}: ${detail}`).join('\n');
  alert(`No se pudo guardar en Firebase:\n\n${lines}\n\nLos datos siguen guardados en este equipo y se vuelve a intentar solo.`);
}

window.addEventListener('offline', renderSyncPill);
window.addEventListener('online', () => {
  renderSyncPill();
  if (!currentUser) return;
  showToast('Conexión recuperada. Subiendo cambios…');
  if (cloudHasUnsavedChanges) saveStateToCloud(true);
});

function notifyCloudSyncError(error, area = 'General') {
  console.warn(`Sincronización en tiempo real no disponible (${area}).`, error);
  const detail = [error?.code, error?.message].filter(Boolean).join(': ').slice(0, 300) || 'error desconocido';
  syncErrors.set(area, detail);
  renderSyncPill();
  if (cloudSyncErrorNotified && cloudSyncErrorAreas.has(area)) return;
  cloudSyncErrorNotified = true;
  cloudSyncErrorAreas.add(area);
  showToast(`No se pudo guardar en Firebase (${area}). Toque "Error al guardar" arriba para ver el detalle.`, 'error', 7000);
}

function warnIfCloudStateGrowing(bytes) {
  if (cloudSizeWarningShown || bytes < CLOUD_DOC_WARN_BYTES || !isAdminUser()) return;
  cloudSizeWarningShown = true;
  const kb = Math.round(bytes / 1024);
  const pct = Math.round(bytes / (1024 * 1024) * 100);
  setTimeout(() => alert(`Aviso preventivo: el archivo de historias y citas en Firebase ya mide ${kb} KB (${pct}% del límite de 1 MB). Todo se sigue guardando bien, pero conviene dividirlo pronto para que no se llene.`), 100);
}

async function ensureFirebaseSession() {
  if (!auth) throw new Error('Firebase Authentication no está disponible.');
  if (auth.currentUser) return auth.currentUser;
  // Al recargar la página Firebase restaura la sesión de forma asíncrona: esperamos el primer aviso.
  if (!firebaseSessionPromise) {
    firebaseSessionPromise = new Promise(resolve => {
      const unsubscribe = auth.onAuthStateChanged(user => { unsubscribe(); resolve(user); });
    });
  }
  const user = await firebaseSessionPromise;
  firebaseSessionPromise = null;
  if (user) return user;
  throw new Error('No hay una sesión activa de Firebase. Inicie sesión nuevamente.');
}

async function saveAppData(options = {}) {
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(backupPayload()));
  queueCloudSave();
  queueOccupationalCloudSave();
  if (options.backupToFolder && oneDriveDirHandle) {
    await writeOneDriveBackup(false);
  }
}

function cloudDocRef() {
  return db.collection(CLOUD_SYNC_COLLECTION).doc(CLOUD_SYNC_DOC);
}

// Firestore rechaza documentos de más de 1 MiB. El estado compartido solo lleva lo que no
// tiene sincronización propia: pacientes van uno por documento y Salud Ocupacional va por bloques.
const CLOUD_SHARED_STATE_EXCLUDED_KEYS = ['pacientes', 'ocupacional', 'planesSSO', 'nextPlanSSOId', 'chatHistory'];
const CLOUD_DOC_SAFE_BYTES = 900 * 1024;
// Aviso previo: al pasar de 700 KB se avisa al admin para dividir el documento antes de llegar al límite.
const CLOUD_DOC_WARN_BYTES = 700 * 1024;
let cloudSizeWarningShown = false;

function sharedCloudState(source = state) {
  const shared = {};
  Object.keys(source || {}).forEach(key => {
    if (!CLOUD_SHARED_STATE_EXCLUDED_KEYS.includes(key)) shared[key] = source[key];
  });
  return stripUndefinedForFirestore(JSON.parse(JSON.stringify(shared)));
}

function occupationalCloudDocRef() {
  return db.collection(OCC_SYNC_COLLECTION).doc(OCC_SYNC_DOC);
}

function patientDocRef(id) {
  return db.collection('pacientes').doc(String(id));
}

function ocupScanFileDocId(scanId, chunkIndex) {
  return `${OCC_SYNC_DOC}__scan_${String(scanId).replace(/[^a-zA-Z0-9_-]/g, '_')}_${chunkIndex}`;
}

function patientCloudPayload(p) {
  return {
    codigo:p.codigo || '',
    nombre:p.nombre || '',
    doc:p.doc || '',
    nac:p.nac || '',
    sexo:p.sexo || '',
    tel:p.tel || '',
    email:p.email || '',
    alergias:p.alergias || 'Ninguna',
    antecedentes:p.antecedentes || '',
    familiares:p.familiares || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: currentUser?.name || currentUser?.username || 'Usuario'
  };
}

async function savePatientToCloud(p) {
  if (!currentUser || isApplyingPatientCloudState) return;
  try {
    await ensureFirebaseSession();
    await trackCloudWrite('Pacientes', () => patientDocRef(p.id).set(patientCloudPayload(p), { merge:true }));
    cloudSyncErrorNotified = false;
  } catch (e) {
    notifyCloudSyncError(e, 'Pacientes');
  }
}

async function deletePatientFromCloud(id) {
  if (!currentUser || isApplyingPatientCloudState) return;
  try {
    await ensureFirebaseSession();
    await trackCloudWrite('Pacientes', () => patientDocRef(id).delete());
    cloudSyncErrorNotified = false;
  } catch (e) {
    notifyCloudSyncError(e, 'Pacientes');
  }
}

async function syncLocalPatientsToCloud() {
  if (!currentUser || isDefaultDemoState(state)) return;
  normalizeStateCounters();
  for (const p of state.pacientes) {
    await savePatientToCloud(p);
  }
}

function startPatientCollectionSync() {
  if (patientCollectionUnsubscribe || patientCollectionStarting) return;
  patientCollectionStarting = true;
  ensureFirebaseSession().then(() => {
    patientCollectionUnsubscribe = db.collection('pacientes').onSnapshot((snapshot) => {
    cloudSyncErrorNotified = false;
    const remote = [];
    snapshot.forEach(doc => {
      const data = doc.data() || {};
      if (doc.id === CLOUD_SYNC_DOC || data.state || data.app === 'ClinicaDrAllanLeal') return;
      remote.push({ id:doc.id, ...data });
    });
    const realRemote = remote.some(p => !isDemoPatient(p)) ? remote.filter(p => !isDemoPatient(p)) : remote;
    if (realRemote.length) {
      isApplyingPatientCloudState = true;
      state.pacientes = realRemote.sort((a,b) => Number(a.codigo || 0) - Number(b.codigo || 0));
      const codesBeforeNormalize = state.pacientes.map(p => p.codigo || '').join('|');
      normalizeStateCounters();
      const codesAfterNormalize = state.pacientes.map(p => p.codigo || '').join('|');
      localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(backupPayload()));
      isApplyingPatientCloudState = false;
      if (codesBeforeNormalize !== codesAfterNormalize) syncLocalPatientsToCloud();
      if (currentUser) refreshCurrentViewAfterCloudSync();
    } else if (!isDefaultDemoState(state) && state.pacientes.length) {
      syncLocalPatientsToCloud();
    }
  }, (error) => {
    patientCollectionUnsubscribe = null;
    patientCollectionStarting = false;
    notifyCloudSyncError(error);
  });
  }).catch((error) => {
    patientCollectionStarting = false;
    notifyCloudSyncError(error);
  });
}

function queueCloudSave() {
  if (isApplyingCloudState || !cloudSyncReady || !currentUser) return;
  cloudHasUnsavedChanges = true;
  renderSyncPill();
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(saveStateToCloud, 450);
}

async function saveStateToCloud(force = false) {
  if (isApplyingCloudState || !cloudSyncReady || !currentUser) return;
  try {
    await ensureFirebaseSession();
    normalizeStateCounters();
    const shared = sharedCloudState();
    const stateJson = JSON.stringify(shared);
    if (!force && stateJson === lastCloudStateJson) { cloudHasUnsavedChanges = false; renderSyncPill(); return; }
    if (new Blob([stateJson]).size > CLOUD_DOC_SAFE_BYTES) {
      throw new Error('Los datos de historias/citas superan el tamaño máximo de un documento de Firebase (1 MB).');
    }
    // Sin merge: reemplaza el documento completo para borrar campos viejos (pacientes, ocupacional) que lo inflaban.
    await trackCloudWrite('Historias y citas', () => cloudDocRef().set({
      app:'ClinicaDrAllanLeal',
      version:3,
      state: shared,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: currentUser.name || currentUser.username || 'Usuario'
    }));
    // Solo se marca como guardado cuando Firebase confirma; si falla, el siguiente cambio reintenta.
    lastCloudStateJson = stateJson;
    warnIfCloudStateGrowing(new Blob([stateJson]).size);
    if (JSON.stringify(sharedCloudState()) === stateJson) cloudHasUnsavedChanges = false;
    cloudSyncErrorNotified = false;
    renderSyncPill();
  } catch (e) {
    // Si Firebase rechaza la escritura, los cambios locales se conservan y se reintenta.
    notifyCloudSyncError(e, 'Historias y citas');
    clearTimeout(cloudRetryTimer);
    cloudRetryTimer = setTimeout(() => { if (cloudHasUnsavedChanges) saveStateToCloud(true); }, 15000);
  }
}

// Une dos listas por id: lo local gana, para no perder lo que todavía no llegó a Firebase.
function mergeListById(remoteList, localList) {
  const merged = new Map();
  (Array.isArray(remoteList) ? remoteList : []).forEach(item => merged.set(String(item.id), item));
  (Array.isArray(localList) ? localList : []).forEach(item => merged.set(String(item.id), item));
  return Array.from(merged.values());
}

function occupationalCloudPayload() {
  ensureOcupacionalState();
  return stripUndefinedForFirestore({
    ocupacional: state.ocupacional,
    planesSSO: Array.isArray(state.planesSSO) ? state.planesSSO : [],
    nextPlanSSOId: state.nextPlanSSOId || 1
  });
}

function occupationalRecordChunkDocId(index) {
  return `${OCC_SYNC_DOC}__registros_${String(index).padStart(3, '0')}`;
}

function cloneOccupationalPayloadWithoutRecords(payload) {
  const clean = stripUndefinedForFirestore(JSON.parse(JSON.stringify(payload || {})));
  const occ = clean.ocupacional || {};
  occ.empresas = (Array.isArray(occ.empresas) ? occ.empresas : []).map(emp => ({
    ...emp,
    registros:[]
  }));
  // registros/scans/fileIndex de primer nivel son copias de la empresa activa (ensureOcupacionalState los
  // reconstruye). Subirlos duplicaba los 419 registros en el documento principal y pasaba de 1 MB.
  occ.registros = [];
  occ.scans = [];
  occ.fileIndex = [];
  clean.ocupacional = occ;
  return clean;
}

function buildOccupationalCloudPackage(payload) {
  const main = cloneOccupationalPayloadWithoutRecords(payload);
  const empresas = Array.isArray(payload?.ocupacional?.empresas) ? payload.ocupacional.empresas : [];
  const chunks = [];
  let current = { version:1, index:0, items:[] };
  const maxChunkChars = 450000;
  const pushCurrent = () => {
    if (!current.items.length) return;
    current.index = chunks.length;
    chunks.push(current);
    current = { version:1, index:chunks.length, items:[] };
  };
  empresas.forEach(emp => {
    const empresa = emp.nombre || emp.empresa || 'TROPIGAS';
    (emp.registros || []).forEach(record => {
      const item = { empresa, registro:record };
      const candidate = { ...current, items:[...current.items, item] };
      if (current.items.length && JSON.stringify(candidate).length > maxChunkChars) pushCurrent();
      current.items.push(item);
    });
  });
  pushCurrent();
  main.recordChunks = {
    version:1,
    count:chunks.length,
    totalRegistros:chunks.reduce((total, chunk) => total + chunk.items.length, 0),
    updatedAt:new Date().toISOString()
  };
  return { main, chunks };
}

async function writeOccupationalRecordChunks(chunks) {
  for (const chunk of chunks) {
    try {
      await db.collection(OCC_SYNC_COLLECTION).doc(occupationalRecordChunkDocId(chunk.index)).set({
        ...stripUndefinedForFirestore(chunk),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy:currentUser?.name || currentUser?.username || 'Usuario'
      });
    } catch (error) {
      const detail = error?.code || error?.message || 'error desconocido';
      const enriched = new Error(`Firebase no permitió guardar el bloque ${chunk.index + 1}/${chunks.length} de registros ocupacionales: ${detail}`);
      enriched.code = error?.code || 'occupational-chunk-write-failed';
      enriched.originalError = error;
      throw enriched;
    }
  }
}

async function hydrateOccupationalCloudPayload(data) {
  const chunkInfo = data?.recordChunks;
  if (!chunkInfo || !Number(chunkInfo.count)) return data;
  const hydrated = JSON.parse(JSON.stringify(data));
  const empresas = Array.isArray(hydrated.ocupacional?.empresas) ? hydrated.ocupacional.empresas : [];
  const embeddedRecords = empresas.reduce((total, emp) => total + (emp.registros || []).length, 0);
  const byEmpresa = new Map(empresas.map(emp => [emp.nombre || emp.empresa || 'TROPIGAS', []]));
  for (let index = 0; index < Number(chunkInfo.count); index += 1) {
    let snap;
    try {
      snap = await db.collection(OCC_SYNC_COLLECTION).doc(occupationalRecordChunkDocId(index)).get();
    } catch (error) {
      if (embeddedRecords) {
        console.warn('No se pudo leer un bloque ocupacional, se usará la data embebida del documento principal.', error);
        return data;
      }
      const detail = error?.code || error?.message || 'error desconocido';
      throw new Error(`Firebase no permitió leer el bloque ${index + 1}/${chunkInfo.count} de registros ocupacionales: ${detail}`);
    }
    if (!snap.exists) {
      if (embeddedRecords) {
        console.warn(`Falta el bloque ocupacional ${index + 1}/${chunkInfo.count}; se usará la data embebida del documento principal.`);
        return data;
      }
      throw new Error(`Falta el bloque de registros ocupacionales ${index + 1}/${chunkInfo.count}. Vuelva a subir data a Firebase desde DRLEAL o MICHI.`);
    }
    const chunk = snap.data() || {};
    (chunk.items || []).forEach(item => {
      const empresa = item.empresa || 'TROPIGAS';
      if (!byEmpresa.has(empresa)) byEmpresa.set(empresa, []);
      if (item.registro) byEmpresa.get(empresa).push(item.registro);
    });
  }
  hydrated.ocupacional.empresas = empresas.map(emp => ({
    ...emp,
    registros:byEmpresa.get(emp.nombre || emp.empresa || 'TROPIGAS') || []
  }));
  return hydrated;
}

function stripUndefinedForFirestore(value) {
  if (Array.isArray(value)) return value.map(stripUndefinedForFirestore);
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((clean, [key, val]) => {
      if (typeof val !== 'undefined') clean[key] = stripUndefinedForFirestore(val);
      return clean;
    }, {});
  }
  return typeof value === 'undefined' ? '' : value;
}

function hasOccupationalContent(payload = occupationalCloudPayload()) {
  const occ = payload.ocupacional || {};
  const empresas = Array.isArray(occ.empresas) ? occ.empresas : [];
  return empresas.some(emp =>
    (emp.registros || []).length ||
    (emp.scans || []).length ||
    (emp.fileIndex || []).length
  ) || (payload.planesSSO || []).length > 0;
}

function occupationalCloudCounts(data = occupationalCloudPayload()) {
  const occ = data.ocupacional || {};
  const empresas = Array.isArray(occ.empresas) ? occ.empresas : [];
  const registros = empresas.reduce((total, emp) => total + (emp.registros || []).length, 0);
  return {
    empresas: empresas.length,
    registros: registros || Number(data.recordChunks?.totalRegistros || 0),
    scans: empresas.reduce((total, emp) => total + (emp.scans || []).length, 0),
    planes: Array.isArray(data.planesSSO) ? data.planesSSO.length : 0
  };
}

function formatCloudTimestamp(value) {
  if (!value) return '';
  try {
    const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('es-GT');
  } catch (e) {
    return '';
  }
}

function renderOccCloudStatus() {
  const counts = occupationalCloudCounts();
  const statusColor = occCloudStatus.state === 'ok' ? 'badge-green' : (occCloudStatus.state === 'error' ? 'badge-red' : 'badge-warn');
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap;margin-top:.85rem;padding:.7rem .8rem;border:1px solid var(--border);border-radius:8px;background:#fbfcfb">
    <div style="font-size:12.5px;color:#56635e;line-height:1.45">
      <span class="badge ${statusColor}">${escapeHtml(occCloudStatus.state === 'ok' ? 'Firebase conectado' : (occCloudStatus.state === 'error' ? 'Firebase con error' : 'Firebase pendiente'))}</span>
      <span style="margin-left:.45rem">${escapeHtml(occCloudStatus.message || 'Estado de sincronización pendiente.')}</span>
      <div style="margin-top:.25rem;font-size:.86rem;color:#667085">Versión de sincronización: ${escapeHtml(OCC_FIREBASE_SYNC_VERSION)}</div>
      <div style="margin-top:.25rem">Datos en esta pantalla: ${counts.registros} registro(s), ${counts.scans} escáner(es), ${counts.planes} plan(es).</div>
    </div>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap">
      <button class="btn btn-sm btn-outline" onclick="refreshOccupationalFromCloud(true)">Actualizar desde Firebase</button>
      ${isAdminUser() ? `<button class="btn btn-sm btn-outline" onclick="recoverOccupationalRecordsFromCloud()">Recuperar registros de Firebase</button>
      <label class="btn btn-sm btn-outline" style="cursor:pointer">Importar registros (JSON)<input type="file" accept="application/json,.json" onchange="importOccupationalRecordsFile(this)" style="display:none"></label>` : ''}
    </div>
  </div>`;
}

// Recuperación: une registros sin borrar nada. Si un registro ya existe, se conservan sus datos y solo se llenan campos vacíos.
function mergeRecoveredOcupRegistros(items) {
  ensureOcupacionalState();
  let added = 0;
  let filled = 0;
  items.forEach(({ empresa, registro }) => {
    if (!registro) return;
    const nombreEmpresa = empresa || 'TROPIGAS';
    let emp = state.ocupacional.empresas.find(e => e.nombre === nombreEmpresa);
    if (!emp) {
      emp = { nombre:nombreEmpresa, plantas:[], registros:[], scans:[], fileIndex:[], nextRegistroId:1, nextScanId:1 };
      state.ocupacional.empresas.push(emp);
    }
    emp.registros = Array.isArray(emp.registros) ? emp.registros : [];
    const idx = findOcupRegistroIndex(emp.registros, registro);
    if (idx >= 0) {
      emp.registros[idx] = mergeOcupRegistro(registro, emp.registros[idx]);
      filled += 1;
    } else {
      emp.registros.push({ ...registro });
      added += 1;
    }
  });
  dedupeAllOcupacionalRegistros();
  ensureOcupacionalState();
  normalizeStateCounters();
  return { added, filled };
}

function totalOcupRegistros() {
  return (state.ocupacional.empresas || []).reduce((total, emp) => total + (emp.registros || []).length, 0);
}

async function finishOccupationalRecovery(result, origen) {
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(backupPayload()));
  const total = totalOcupRegistros();
  refreshCurrentViewAfterCloudSync();
  if (!result.added) {
    alert(`${origen}: no se encontraron registros nuevos. Total en pantalla: ${total}.`);
    return;
  }
  if (confirm(`${origen}: se agregaron ${result.added} registro(s). Total en pantalla: ${total}.\n\n¿Subir ahora los ${total} registros a Firebase?`)) {
    occCloudLoaded = true;
    const ok = await saveOccupationalStateToCloud(true);
    alert(ok ? `Listo: ${total} registros guardados en Firebase.` : `No se pudo subir. Detalle: ${occCloudStatus.message || 'desconocido'}`);
  }
}

async function recoverOccupationalRecordsFromCloud() {
  if (!isAdminUser()) return;
  try {
    await ensureFirebaseSession();
    const items = [];
    let found = 0;
    // Lee todos los bloques que existan, aunque el documento principal indique menos.
    for (let index = 0; index < 50; index += 1) {
      const snap = await db.collection(OCC_SYNC_COLLECTION).doc(occupationalRecordChunkDocId(index)).get({ source:'server' });
      if (!snap.exists) continue;
      found += 1;
      (snap.data()?.items || []).forEach(item => items.push(item));
    }
    const result = mergeRecoveredOcupRegistros(items);
    await finishOccupationalRecovery(result, `Bloques leídos en Firebase: ${found}`);
  } catch (e) {
    alert(`No se pudieron leer los bloques de Firebase: ${[e.code, e.message].filter(Boolean).join(': ')}`);
  }
}

function importOccupationalRecordsFile(input) {
  if (!isAdminUser()) return;
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      const list = Array.isArray(data) ? data : (data.registros || data.records || []);
      if (!Array.isArray(list) || !list.length) throw new Error('El archivo no trae registros.');
      const items = list.map(registro => ({ empresa:registro.empresa || 'TROPIGAS', registro }));
      const result = mergeRecoveredOcupRegistros(items);
      await finishOccupationalRecovery(result, `Archivo ${file.name}`);
    } catch (e) {
      alert(`No se pudo importar el archivo: ${e.message}`);
    } finally {
      input.value = '';
    }
  };
  reader.readAsText(file);
}

function queueOccupationalCloudSave() {
  if (isApplyingOcupCloudState || !currentUser || !isAdminUser()) return;
  clearTimeout(occCloudSaveTimer);
  occCloudSaveTimer = setTimeout(() => saveOccupationalStateToCloud(false), 350);
}

async function saveOccupationalStateToCloud(force = false) {
  if (isApplyingOcupCloudState || !currentUser || !isAdminUser()) return false;
  // Firebase es la única fuente de los registros: nunca se sube antes de haber leído la nube, para no borrarla con un equipo vacío.
  if (!occCloudLoaded) return false;
  try {
    await ensureFirebaseSession();
    normalizeStateCounters();
    dedupeAllOcupacionalRegistros();
    normalizeStateCounters();
    const payload = occupationalCloudPayload();
    const payloadJson = JSON.stringify(payload);
    if (!force && payloadJson === lastOccCloudStateJson) return true;
    const cloudPackage = buildOccupationalCloudPackage(payload);
    const mainBytes = new Blob([JSON.stringify(cloudPackage.main)]).size;
    if (mainBytes > CLOUD_DOC_SAFE_BYTES) {
      throw new Error(`El documento principal de Salud Ocupacional pesa ${Math.round(mainBytes / 1024)} KB y Firebase acepta hasta 1024 KB (escáneres o planes demasiado grandes).`);
    }
    const bigChunk = cloudPackage.chunks.find(chunk => new Blob([JSON.stringify(chunk)]).size > CLOUD_DOC_SAFE_BYTES);
    if (bigChunk) {
      throw new Error(`El bloque ${bigChunk.index + 1} de registros ocupacionales pasa de 1 MB, probablemente por fotos de doping muy pesadas.`);
    }
    await trackCloudWrite('Salud Ocupacional', async () => {
      await writeOccupationalRecordChunks(cloudPackage.chunks);
      await occupationalCloudDocRef().set({
        app:'ClinicaDrAllanLeal',
        module:'SaludOcupacional',
        version:1,
        ...cloudPackage.main,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: currentUser.name || currentUser.username || 'Usuario'
      }, { merge:true });
    });
    lastOccCloudStateJson = payloadJson;
    cloudSyncErrorNotified = false;
    occCloudStatus = { state:'ok', message:`Última subida correcta. Registros: ${occupationalCloudCounts(payload).registros}. Bloques: ${cloudPackage.chunks.length}.` };
    return true;
  } catch (e) {
    console.warn('Sincronización ocupacional no disponible.', e);
    if (e && e.code) console.warn('Código Firebase ocupacional:', e.code, e.message);
    occCloudStatus = { state:'error', message:`No se pudo subir/leer Firebase: ${[e.code, e.message].filter(Boolean).join(': ').slice(0, 300) || 'error desconocido'}.` };
    notifyCloudSyncError(e, 'Salud Ocupacional');
    return false;
  }
}

async function forceOccupationalCloudSync() {
  if (!currentUser || !isAdminUser()) {
    alert('Solo DRLEAL o MICHI pueden subir la data ocupacional completa a Firebase.');
    return;
  }
  ensureOcupacionalState();
  dedupeAllOcupacionalRegistros();
  normalizeStateCounters();
  const empresas = state.ocupacional.empresas || [];
  const registros = empresas.reduce((total, emp) => total + (emp.registros || []).length, 0);
  const scans = empresas.reduce((total, emp) => total + (emp.scans || []).length, 0);
  if (!occCloudLoaded) {
    alert('Todavía no se han leído los datos de Firebase en este equipo. Use "Actualizar desde Firebase" antes de subir.');
    return;
  }
  if (!registros && !scans && !state.planesSSO.length) {
    alert('Este equipo no tiene registros ocupacionales. No se sube nada para no borrar los datos guardados en Firebase.');
    return;
  }
  const ok = await saveOccupationalStateToCloud(true);
  if (ok) showToast(`Sincronización ocupacional enviada a Firebase. Registros: ${registros}. Escáneres: ${scans}. Ahora INGSALANIC debería verlos al recargar.`);
  else alert(`No se pudo sincronizar con Firebase. Detalle: ${occCloudStatus.message || 'Revise reglas/conexión e intente de nuevo.'}`);
}

async function applyOccupationalCloudState(data) {
  if (!data || !data.ocupacional) return;
  data = await hydrateOccupationalCloudPayload(data);
  isApplyingOcupCloudState = true;
  occCloudLoaded = true;
  const localActiveEmpresa = state.ocupacional?.activeEmpresa;
  state.ocupacional = { ...state.ocupacional, ...data.ocupacional };
  if (localActiveEmpresa && (state.ocupacional.empresas || []).some(emp => emp.nombre === localActiveEmpresa)) {
    state.ocupacional.activeEmpresa = localActiveEmpresa;
  }
  if (Array.isArray(data.planesSSO)) state.planesSSO = data.planesSSO;
  if (data.nextPlanSSOId) state.nextPlanSSOId = data.nextPlanSSOId;
  ensureOcupacionalState();
  const beforeDedupeJson = JSON.stringify(occupationalCloudPayload());
  dedupeAllOcupacionalRegistros();
  normalizeStateCounters();
  lastOccCloudStateJson = JSON.stringify(occupationalCloudPayload());
  const counts = occupationalCloudCounts(data);
  const updated = formatCloudTimestamp(data.updatedAt);
  occCloudStatus = { state:'ok', message:`Datos recibidos de Firebase${updated ? ' el ' + updated : ''}. Registros en nube: ${counts.registros}.` };
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(backupPayload()));
  isApplyingOcupCloudState = false;
  if (isAdminUser() && beforeDedupeJson !== lastOccCloudStateJson) saveOccupationalStateToCloud(true);
  if (currentUser && String(currentPage || '').startsWith('occ')) refreshCurrentViewAfterCloudSync();
}

async function refreshOccupationalFromCloud(showAlert = false) {
  try {
    await ensureFirebaseSession();
    const doc = await occupationalCloudDocRef().get({ source:'server' });
    if (!doc.exists || !doc.data() || !doc.data().ocupacional) {
      occCloudStatus = { state:'error', message:'Firebase respondió, pero no encontró data ocupacional.' };
      if (showAlert) alert('Firebase respondió, pero no encontró data ocupacional en dashboardOcupacional / __estadoOcupacional.');
      if (String(currentPage || '').startsWith('occ')) refreshCurrentViewAfterCloudSync();
      return false;
    }
    await applyOccupationalCloudState(doc.data());
    const counts = occupationalCloudCounts(occupationalCloudPayload());
    if (showAlert) showToast(`Datos leídos desde Firebase. Registros: ${counts.registros}. Escáneres: ${counts.scans}.`);
    return true;
  } catch (e) {
    console.warn('No se pudo leer Firebase ocupacional manualmente.', e);
    occCloudStatus = { state:'error', message:`Firebase no permitió leer: ${e.code || e.message || 'error desconocido'}.` };
    if (showAlert) alert(`No se pudo leer la data ocupacional desde Firebase. Error: ${e.code || e.message || 'desconocido'}. Si esto le pasa solo a INGSALANIC, hay que ajustar las reglas de Firestore para permitirle leer dashboardOcupacional.`);
    if (String(currentPage || '').startsWith('occ')) refreshCurrentViewAfterCloudSync();
    return false;
  }
}

function startOccupationalRealtimeSync() {
  if (occCloudUnsubscribe || occCloudSyncStarting) return;
  occCloudSyncStarting = true;
  occCloudStatus = { state:'pending', message:'Conectando a Firebase ocupacional...' };
  ensureFirebaseSession().then(() => {
    occCloudUnsubscribe = occupationalCloudDocRef().onSnapshot(async (doc) => {
      try {
        cloudSyncErrorNotified = false;
        if (doc.exists && doc.data() && doc.data().ocupacional) {
          await applyOccupationalCloudState(doc.data());
        } else if (!doc.exists && isAdminUser() && hasOccupationalContent()) {
          occCloudLoaded = true;
          saveOccupationalStateToCloud(true);
        } else {
          occCloudStatus = { state:'error', message:'Firebase respondió, pero no encontró data ocupacional.' };
          if (currentUser && String(currentPage || '').startsWith('occ')) refreshCurrentViewAfterCloudSync();
        }
      } catch (error) {
        console.warn('No se pudo reconstruir la data ocupacional desde Firebase.', error);
        occCloudStatus = { state:'error', message:`Firebase respondió, pero faltó reconstruir bloques: ${error.message || 'error desconocido'}.` };
        if (currentUser && String(currentPage || '').startsWith('occ')) refreshCurrentViewAfterCloudSync();
      }
    }, (error) => {
      console.warn('Sincronización ocupacional no disponible.', error);
      occCloudSyncStarting = false;
      occCloudStatus = { state:'error', message:`Firebase no permitió leer: ${error.code || error.message || 'error desconocido'}.` };
      notifyCloudSyncError(error);
      if (currentUser && String(currentPage || '').startsWith('occ')) refreshCurrentViewAfterCloudSync();
    });
  }).catch((error) => {
    occCloudSyncStarting = false;
    occCloudStatus = { state:'error', message:`No se pudo iniciar Firebase: ${error.code || error.message || 'error desconocido'}.` };
    notifyCloudSyncError(error);
  });
}

function applyCloudState(remoteState) {
  if (isDefaultDemoState(remoteState) && !isDefaultDemoState(state)) {
    saveStateToCloud(true);
    return;
  }
  // Pacientes y Salud Ocupacional tienen su propia sincronización; se ignoran copias viejas del documento compartido.
  remoteState = { ...remoteState };
  CLOUD_SHARED_STATE_EXCLUDED_KEYS.forEach(key => { delete remoteState[key]; });
  if (cloudHasUnsavedChanges) {
    // Hay cambios locales sin confirmar: un snapshot (incluida la reversión de una escritura rechazada) no los borra.
    if (cloudInitialStateApplied) return;
    ['historias', 'citas', 'posts'].forEach(key => { remoteState[key] = mergeListById(remoteState[key], state[key]); });
  }
  cloudInitialStateApplied = true;
  isApplyingCloudState = true;
  const currentOcupacional = state.ocupacional;
  const currentPlanesSSO = state.planesSSO;
  const currentNextPlanSSOId = state.nextPlanSSOId;
  state = { ...state, ...remoteState };
  if (occCloudSyncStarting || occCloudUnsubscribe) {
    state.ocupacional = currentOcupacional;
    state.planesSSO = currentPlanesSSO;
    state.nextPlanSSOId = currentNextPlanSSOId;
  }
  normalizeStateCounters();
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(backupPayload()));
  isApplyingCloudState = false;
  if (cloudHasUnsavedChanges) queueCloudSave();
  else lastCloudStateJson = JSON.stringify(sharedCloudState());
  if (currentUser) refreshCurrentViewAfterCloudSync();
}

function refreshCurrentViewAfterCloudSync() {
  if (shouldHoldCloudRefresh()) {
    scheduleDeferredCloudRefresh();
    return;
  }
  if (currentPage === 'dashboard') renderDashboard();
  else if (currentPage === 'pacientes') renderPacientes();
  else if (currentPage === 'historias') renderHistorias();
  else if (currentPage === 'agenda') renderAgenda();
  else if (currentPage === 'recordatorios') renderRecordatorios();
  else if (currentPage === 'respaldos') renderRespaldos();
  else if (currentPage === 'occEmpresas') renderOcupEmpresas();
  else if (currentPage === 'occDashboard') renderOcupDashboard();
  else if (currentPage === 'occRegistros') renderOcupRegistros();
  else if (currentPage === 'occEscaneres') renderOcupEscaneres();
  else if (currentPage === 'occPlantas') renderOcupPlantas();
  else if (currentPage === 'occPlanes') renderPlanesSSO();
}

function visibleModalIsOpen() {
  return !!document.querySelector('.overlay.show');
}

function activeElementIsFormControl() {
  const el = document.activeElement;
  return !!(el && el.closest && el.closest('#mainContent') && el.matches('input, textarea, select'));
}

function hasOcupRegistroDraft() {
  if (currentPage !== 'occRegistros') return false;
  const ids = [
    'occExpediente','occNombre','occDpi','occPuesto','occArea','occEdad',
    'occPa','occFc','occFr','occTemp','occSpo2','occGmt','occPeso','occAltura',
    'occMotivo','occHistoria','occAntecedentesFamiliares','occAntecedentesMedicos',
    'occAntecedentesAlergicos','occAntecedentesQuirurgicos','occExamen','occDiagnosticos','occRuffierReposo',
    'occRuffierEsfuerzo','occRuffierRecuperacion','occTratamiento'
  ];
  const clinicHistoriaDraft = visibleModalIsOpen() && [
    'hMotivo','hDiagnostico','hAnamnesis','hExamenFisico','hTA','hFC','hFR','hTemp',
    'hSat','hGMT','hPesoKg','hAltura','hTratamiento','hObs'
  ].some(id => {
    const el = document.getElementById(id);
    return el && String(el.value || '').trim() && String(el.value || '').trim() !== CLINIC_DEFAULT_EXAMEN_FISICO.trim();
  });
  const dopingDraft = document.getElementById('occDopingResultado')?.value === 'Positivo'
    || !!document.querySelector('input[name="occDopingSustancia"]:checked');
  const dopingPhotoDraft = !!(document.getElementById('occDopingFotos')?.files || []).length;
  const ruffierNoAplicaDraft = document.getElementById('occRuffierNoAplica')?.checked || false;
  return clinicHistoriaDraft || !!editingOcupRegistroId || dopingDraft || dopingPhotoDraft || ruffierNoAplicaDraft || ids.some(id => {
    const el = document.getElementById(id);
    return el && String(el.value || '').trim();
  });
}

function shouldHoldCloudRefresh() {
  return visibleModalIsOpen() || activeElementIsFormControl() || hasOcupRegistroDraft();
}

function scheduleDeferredCloudRefresh() {
  pendingCloudRefresh = true;
  clearTimeout(pendingCloudRefreshTimer);
  pendingCloudRefreshTimer = setTimeout(() => {
    if (!pendingCloudRefresh || shouldHoldCloudRefresh()) {
      scheduleDeferredCloudRefresh();
      return;
    }
    pendingCloudRefresh = false;
    refreshCurrentViewAfterCloudSync();
  }, 1200);
}

function flushDeferredCloudRefresh() {
  if (!pendingCloudRefresh || shouldHoldCloudRefresh()) return;
  pendingCloudRefresh = false;
  clearTimeout(pendingCloudRefreshTimer);
  refreshCurrentViewAfterCloudSync();
}

function startRealtimeSync() {
  if (cloudUnsubscribe || cloudSyncStarting) return;
  cloudSyncStarting = true;
  cloudSyncReady = true;
  ensureFirebaseSession().then(() => {
    cloudUnsubscribe = cloudDocRef().onSnapshot((doc) => {
    if (doc.exists && doc.data() && doc.data().state) {
      applyCloudState(doc.data().state);
    } else {
      if (!isDefaultDemoState(state)) saveStateToCloud(true);
      else console.warn('Sin documento compartido todavía. Esperando a que un usuario con datos reales sincronice primero.');
    }
  }, (error) => {
    cloudUnsubscribe = null;
    cloudSyncStarting = false;
    notifyCloudSyncError(error);
  });
  }).catch((error) => {
    cloudSyncStarting = false;
    notifyCloudSyncError(error);
  });
}
