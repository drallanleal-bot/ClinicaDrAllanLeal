// ── USUARIOS FIREBASE ────────────────────────────
const LOGIN_ACCOUNTS = {
  drleal:     { email:'drleal@clinica.local', name:"Dr. Allan Leal", role:'admin', initials:'DR' },
  michi:      { email:'michi@clinica.local', name:'MICHI', role:'admin', initials:'MI' },
  ingsalanic: { email:'ingsalanic@clinica.local', name:'Ingeniería Salanic', role:'ingeniero', initials:'IS' }
};
let currentUser = null;

// ── DATOS ─────────────────────────────────────────
let state = {
  pacientes: [
    { id:1, codigo:'000001', nombre:'María González',  doc:'1234567', nac:'1985-03-12', sexo:'Femenino',  tel:'+502 5555-1111', email:'maria@email.com',  alergias:'Ninguna',    antecedentes:'Hipertensión arterial',  familiares:'Padre: IAM' },
    { id:2, codigo:'000002', nombre:'Carlos Pérez',    doc:'7654321', nac:'1972-08-20', sexo:'Masculino', tel:'+502 5555-2222', email:'carlos@email.com', alergias:'Penicilina', antecedentes:'Diabetes tipo 2',        familiares:'Madre: DM2' },
    { id:3, codigo:'000003', nombre:'Sofía Ramírez',   doc:'9876543', nac:'1995-11-05', sexo:'Femenino',  tel:'+502 5555-3333', email:'sofia@email.com',  alergias:'Ninguna',    antecedentes:'Ninguno relevante',      familiares:'Sin antecedentes' }
  ],
  historias: [
    { id:1, pacienteId:1, fecha:'2025-04-10', motivo:'Control de presión arterial',  diagnostico:'HTA controlada',      anamnesis:'Paciente refiere buena adherencia al tratamiento. Sin síntomas de alarma.', ta:'130/85', fc:'76 lpm', temp:'36.5°C', peso:'68 kg / 1.62 m', sat:'98%', tratamiento:'Losartán 50mg c/24h — continuar', obs:'Control en 3 meses. Solicitar perfil lipídico.' },
    { id:2, pacienteId:2, fecha:'2025-04-14', motivo:'Control de glucemia en ayunas', diagnostico:'DM2 en seguimiento', anamnesis:'Glucemia en ayunas 145 mg/dL. Refiere buena adherencia dietética.', ta:'125/80', fc:'80 lpm', temp:'36.8°C', peso:'85 kg / 1.75 m', sat:'97%', tratamiento:'Metformina 850mg c/12h con alimentos', obs:'Solicitar HbA1c. Control en 6 semanas.' }
  ],
  citas: [
    { id:1, pacienteId:1, fecha:'2025-04-18', hora:'09:00', tipo:'Control',         notas:'Traer resultados de laboratorio', estado:'confirmada' },
    { id:2, pacienteId:2, fecha:'2025-04-18', hora:'10:30', tipo:'Consulta general', notas:'',                               estado:'pendiente'  },
    { id:3, pacienteId:3, fecha:'2025-04-22', hora:'08:00', tipo:'Primera vez',     notas:'Referida por médico general',     estado:'pendiente'  }
  ],
  posts: [
    { id:1, plataforma:'facebook',  texto:'🩺 ¿Sabías que el control médico regular puede prevenir complicaciones graves?\n\nEsta semana recordamos la importancia del chequeo anual. Agenda tu cita con nosotros. 💚\n\n#Salud #PrevencionEsMejor #ConsultorioMedico', fecha:'2025-04-14', estado:'publicado' },
    { id:2, plataforma:'instagram', texto:'✨ Cuida tu salud hoy para vivir mejor mañana.\n\nNuestro consultorio está listo para atenderte con la calidad y calidez que mereces. 🏥💚\n\n#ConsultorioMedico #TuSaludEsPrimero #Bienestar', fecha:'2025-04-14', estado:'publicado' }
  ],
  nextPacId:4, nextPacCode:4, nextHistId:3, nextCitaId:4, nextPostId:3,
  socialLinks:{ facebook:'', instagram:'', website:'', whatsapp:'+50238006697' },
  planesSSO:[],
  nextPlanSSOId:1,
  ocupacional: {
    empresa:'TROPIGAS',
    activeEmpresa:'TROPIGAS',
    plantas:['MIXCO','PETAPA','ZONA 18','PORTILLO'],
    registros:[],
    scans:[],
    fileIndex:[],
    nextRegistroId:1,
    nextScanId:1,
    empresas:[]
  }
};

const APP_STORAGE_KEY = 'clinicaDrAllanLeal.data.v1';
const ONEDRIVE_WEB_FOLDER_URL = 'https://1drv.ms/f/c/8a18e0b19317f2a1/IgDnbLPfCqW2Qpg3YCXVs6m7AfttHIgorwZaFIFj-l0c_Vw?e=gn7HFB';
const TROPIGAS_ONEDRIVE_URL = 'https://1drv.ms/f/c/8a18e0b19317f2a1/IgBLGjmoR9nGQYbaSiXXozUAAUOW1ENqCiWw5_ZknLfLZeg?e=K4gIum';
const ONEDRIVE_HANDLE_DB = 'clinicaDrAllanLeal.handles.v1';
const ONEDRIVE_HANDLE_STORE = 'handles';
const ONEDRIVE_HANDLE_KEY = 'oneDriveBackupFolder';
const CLOUD_SYNC_COLLECTION = 'pacientes';
const CLOUD_SYNC_DOC = '__estadoCompartido';
const OCC_SYNC_COLLECTION = 'dashboardOcupacional';
const OCC_SYNC_DOC = '__estadoOcupacional';
const OCC_FIREBASE_SYNC_VERSION = 'Firebase bloques 2026-10-05 v2';
const OCC_SCAN_FILE_CHUNK_SIZE = 450000;
const OCC_SCAN_FILE_MAX_DIRECT_BYTES = 35 * 1024 * 1024;
let oneDriveDirHandle = null;
let cloudUnsubscribe = null;
let cloudSyncStarting = false;
let cloudSyncReady = false;
let isApplyingCloudState = false;
let cloudSaveTimer = null;
let cloudRetryTimer = null;
let cloudHasUnsavedChanges = false;
let cloudInitialStateApplied = false;
let lastCloudStateJson = '';
let occCloudUnsubscribe = null;
let occCloudSyncStarting = false;
let isApplyingOcupCloudState = false;
let occCloudSaveTimer = null;
let lastOccCloudStateJson = '';
let occCloudStatus = { state:'pending', message:'Sin conectar con Firebase todavía.' };
let occCloudLoaded = false;
let cloudSyncErrorNotified = false;
let patientCollectionUnsubscribe = null;
let patientCollectionStarting = false;
let isApplyingPatientCloudState = false;
let firebaseSessionPromise = null;





function ensureOcupacionalState() {
  if (!state.ocupacional) {
    state.ocupacional = {};
  }
  const legacy = {
    nombre:'TROPIGAS',
    plantas:state.ocupacional.plantas && state.ocupacional.plantas.length ? state.ocupacional.plantas : ['MIXCO','PETAPA','ZONA 18','PORTILLO'],
    registros:Array.isArray(state.ocupacional.registros) ? state.ocupacional.registros : [],
    scans:Array.isArray(state.ocupacional.scans) ? state.ocupacional.scans : [],
    fileIndex:Array.isArray(state.ocupacional.fileIndex) ? state.ocupacional.fileIndex : [],
    nextRegistroId:state.ocupacional.nextRegistroId || 1,
    nextScanId:state.ocupacional.nextScanId || 1,
    oneDriveUrl:TROPIGAS_ONEDRIVE_URL
  };
  state.ocupacional.empresas = Array.isArray(state.ocupacional.empresas) ? state.ocupacional.empresas : [];
  const tropigas = state.ocupacional.empresas.find(e => e.nombre === 'TROPIGAS');
  if (!tropigas) state.ocupacional.empresas.unshift(legacy);
  else {
    tropigas.plantas = tropigas.plantas && tropigas.plantas.length ? tropigas.plantas : legacy.plantas;
    tropigas.registros = Array.isArray(tropigas.registros) ? tropigas.registros : legacy.registros;
    tropigas.scans = Array.isArray(tropigas.scans) ? tropigas.scans : legacy.scans;
    tropigas.fileIndex = Array.isArray(tropigas.fileIndex) ? tropigas.fileIndex : legacy.fileIndex;
    tropigas.nextRegistroId = tropigas.nextRegistroId || legacy.nextRegistroId;
    tropigas.nextScanId = tropigas.nextScanId || legacy.nextScanId;
    tropigas.oneDriveUrl = tropigas.oneDriveUrl || TROPIGAS_ONEDRIVE_URL;
  }
  seedTropigasMixco2025Backup();
  state.ocupacional.activeEmpresa = state.ocupacional.activeEmpresa || 'TROPIGAS';
  if (!state.ocupacional.empresas.some(e => e.nombre === state.ocupacional.activeEmpresa)) state.ocupacional.activeEmpresa = 'TROPIGAS';
  const active = state.ocupacional.empresas.find(e => e.nombre === state.ocupacional.activeEmpresa) || state.ocupacional.empresas[0];
  state.ocupacional.empresa = active.nombre;
  state.ocupacional.plantas = active.plantas;
  state.ocupacional.registros = active.registros;
  state.ocupacional.scans = active.scans;
  state.ocupacional.fileIndex = active.fileIndex;
  state.ocupacional.nextRegistroId = active.nextRegistroId;
  state.ocupacional.nextScanId = active.nextScanId;
  state.socialLinks = state.socialLinks || { facebook:'', instagram:'', website:'', whatsapp:'+50238006697' };
  state.planesSSO = Array.isArray(state.planesSSO) ? state.planesSSO : [];
  state.nextPlanSSOId = state.nextPlanSSOId || 1;
}


function seedTropigasImportBatch(emp, batchId, records, meta = {}) {
  if (!emp || !Array.isArray(records) || !records.length) return { added:0, updated:0, skipped:true };
  emp.registros = Array.isArray(emp.registros) ? emp.registros : [];
  emp.importedBatches = Array.isArray(emp.importedBatches) ? emp.importedBatches : [];
  emp.backupsAnuales = Array.isArray(emp.backupsAnuales) ? emp.backupsAnuales : [];
  const batchExists = emp.importedBatches.some(batch => batch.id === batchId);
  if (batchExists) return { added:0, updated:0, skipped:true };
  const keyFor = record => {
    const planta = String(record.planta || '').trim().toUpperCase();
    const fecha = String(record.fechaEvaluacion || '').trim();
    const expediente = String(record.expediente || '').trim().toUpperCase();
    const fallback = String(record.dpi || record.nombre || '').trim().toUpperCase();
    return `${planta}|${fecha}|${expediente || fallback}`;
  };
  let added = 0;
  let updated = 0;
  records.forEach(source => {
    const incoming = { ...source, syncKey:keyFor(source) };
    const key = keyFor(incoming);
    const existingIndex = emp.registros.findIndex(record => keyFor(record) === key);
    if (existingIndex >= 0) {
      emp.registros[existingIndex] = mergeOcupRegistro(emp.registros[existingIndex], incoming, true);
      updated += 1;
    } else {
      emp.registros.push(incoming);
      added += 1;
    }
  });
  emp.importedBatches.push({
    id:batchId,
    anio:meta.anio || 2025,
    empresa:meta.empresa || 'TROPIGAS',
    planta:meta.planta || '',
    fecha:meta.fecha || '',
    registros:records.length,
    agregados:added,
    actualizados:updated,
    fuente:meta.fuente || '',
    importedAt:meta.importedAt || new Date().toISOString()
  });
  return { added, updated, skipped:false };
}




function refreshTropigasAnnualBackups(emp) {
  if (!emp) return;
  emp.backupsAnuales = Array.isArray(emp.backupsAnuales) ? emp.backupsAnuales : [];
  const recordsByYear = {};
  (emp.registros || []).forEach(record => {
    const year = String(record.backupYear || String(record.fechaEvaluacion || '').slice(0, 4) || 'SIN ANIO');
    if (!/^\d{4}$/.test(year)) return;
    recordsByYear[year] = recordsByYear[year] || [];
    recordsByYear[year].push(record);
  });
  Object.entries(recordsByYear).forEach(([year, records]) => {
    const plantas = Array.from(new Set(records.map(record => record.planta).filter(Boolean))).sort();
    const fechas = records.map(record => record.fechaEvaluacion).filter(Boolean).sort();
    const jornadasMap = new Map();
    records.forEach(record => {
      const key = `${record.planta || 'SIN PLANTA'}|${record.fechaEvaluacion || 'SIN FECHA'}|${record.importBatch || 'SIN LOTE'}`;
      if (!jornadasMap.has(key)) {
        jornadasMap.set(key, { planta:record.planta || 'SIN PLANTA', fecha:record.fechaEvaluacion || 'SIN FECHA', registros:0, lote:record.importBatch || 'SIN LOTE' });
      }
      jornadasMap.get(key).registros += 1;
    });
    const backup = {
      anio:Number(year),
      empresa:'TROPIGAS',
      plantas,
      fechaInicio:fechas[0] || '',
      fechaFin:fechas[fechas.length - 1] || '',
      jornadas:Array.from(jornadasMap.values()).sort((a,b) => `${a.fecha}${a.planta}`.localeCompare(`${b.fecha}${b.planta}`)),
      registros:records.length,
      fuente:`Jornadas EMOP TROPIGAS ${year}`,
      updatedAt:'2026-09-21T00:00:00.000Z'
    };
    const backupIndex = emp.backupsAnuales.findIndex(item => Number(item.anio) === Number(year) && item.empresa === 'TROPIGAS');
    if (backupIndex >= 0) emp.backupsAnuales[backupIndex] = { ...emp.backupsAnuales[backupIndex], ...backup };
    else emp.backupsAnuales.push(backup);
  });
}

function seedTropigasMixco2025Backup() {
  // Los registros ocupacionales ya no viven en el código público: se cargan solo desde Firebase tras el login.
  const emp = (state.ocupacional.empresas || []).find(e => e.nombre === 'TROPIGAS');
  if (!emp) return;
  refreshTropigasAnnualBackups(emp);
}

function normalizeStateCounters() {
  ensureOcupacionalState();
  state.pacientes.forEach((p, idx) => { if (!p.codigo) p.codigo = String(idx + 1).padStart(6, '0'); });
  const patientCodes = state.pacientes.map(p => Number(p.codigo)).filter(n => Number.isFinite(n) && n > 0);
  if (patientCodes.length && !patientCodes.includes(1) && patientCodes.every(n => n >= 4)) {
    state.pacientes.forEach((p, idx) => { p.codigo = String(idx + 1).padStart(6, '0'); });
  }
  state.nextPacId = Math.max(1, ...state.pacientes.map(p => Number(p.id) || 0)) + 1;
  state.nextPacCode = Math.max(0, ...state.pacientes.map(p => Number(p.codigo) || 0)) + 1;
  state.nextHistId = Math.max(1, ...state.historias.map(h => Number(h.id) || 0)) + 1;
  state.nextCitaId = Math.max(1, ...state.citas.map(c => Number(c.id) || 0)) + 1;
  state.nextPostId = Math.max(1, ...state.posts.map(p => Number(p.id) || 0)) + 1;
  state.nextPlanSSOId = Math.max(1, ...state.planesSSO.map(p => Number(p.id) || 0)) + 1;
  state.ocupacional.empresas.forEach(emp => {
    emp.registros = Array.isArray(emp.registros) ? emp.registros : [];
    emp.scans = Array.isArray(emp.scans) ? emp.scans : [];
    emp.fileIndex = Array.isArray(emp.fileIndex) ? emp.fileIndex : [];
    emp.nextRegistroId = Math.max(1, ...emp.registros.map(r => Number(r.id) || 0)) + 1;
    emp.nextScanId = Math.max(1, ...emp.scans.map(s => Number(s.id) || 0)) + 1;
  });
  const active = state.ocupacional.empresas.find(e => e.nombre === state.ocupacional.activeEmpresa) || state.ocupacional.empresas[0];
  state.ocupacional.nextRegistroId = active.nextRegistroId;
  state.ocupacional.nextScanId = active.nextScanId;
}

function loadLocalData() {
  try {
    const raw = localStorage.getItem(APP_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved && saved.state) {
      state = { ...state, ...saved.state };
      normalizeStateCounters();
    }
  } catch (e) {
    console.warn('No se pudo cargar el respaldo local.', e);
  }
}

function backupPayload() {
  return {
    app: 'ClinicaDrAllanLeal',
    version: 1,
    exportedAt: new Date().toISOString(),
    state
  };
}

function isDefaultDemoState(candidate = state) {
  const docs = (candidate.pacientes || []).map(p => String(p.doc || ''));
  return (candidate.pacientes || []).length === 3
    && docs.includes('1234567')
    && docs.includes('7654321')
    && docs.includes('9876543')
    && (candidate.historias || []).length <= 2
    && (candidate.citas || []).length <= 3;
}

function isDemoPatient(p) {
  return ['1234567','7654321','9876543'].includes(String(p.doc || ''));
}

function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function safeStorageName(name) {
  return String(name || 'archivo')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'archivo';
}

function attachmentIcon(att) {
  const type = String(att?.tipo || att?.type || '').toLowerCase();
  const name = String(att?.nombre || att?.name || '').toLowerCase();
  if (type.includes('pdf') || name.endsWith('.pdf')) return 'PDF';
  if (type.includes('image') || /\.(png|jpe?g|webp|gif)$/i.test(name)) return 'IMG';
  return 'DOC';
}


function openAttachment(url) {
  window.open(url, '_blank', 'noopener');
}

function renderPatientPreviousAttachments(patientId, excludeHistId = '') {
  const out = document.getElementById('hPreviosAdjuntos');
  if (!out) return;
  if (!patientId) {
    out.innerHTML = '<div class="attachHint">Seleccione un paciente para ver estudios previos.</div>';
    return;
  }
  const histories = state.historias
    .filter(h => String(h.pacienteId) === String(patientId) && String(h.id) !== String(excludeHistId) && Array.isArray(h.adjuntos) && h.adjuntos.length)
    .sort((a,b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
  if (!histories.length) {
    out.innerHTML = '<div class="attachHint">Este paciente aun no tiene laboratorios o estudios previos adjuntos.</div>';
    return;
  }
  out.innerHTML = histories.map(h => `
    <div class="attachItem" style="align-items:flex-start;flex-direction:column">
      <div style="display:flex;align-items:center;justify-content:space-between;width:100%;gap:.75rem">
        <div>
          <div class="attachName">${fmtF(h.fecha)} - ${escapeHtml(h.diagnostico || h.motivo || 'Historia clinica')}</div>
          <div class="attachSub">${h.adjuntos.length} archivo(s) previo(s)</div>
        </div>
        <button type="button" class="btn btn-sm btn-outline" onclick="closeModal('modalHistoria');verHistoria('${h.id}')">Ver historia</button>
      </div>
      <div style="width:100%;margin-top:.45rem">${renderAttachmentList(h.adjuntos || [])}</div>
    </div>`).join('');
}



function renderAttachmentList(adjs = [], histId = '') {
  if (!adjs.length) return '<div class="attachHint">Sin laboratorios o estudios adjuntos.</div>';
  return `<div class="attachList">${adjs.map(att => `
    <div class="attachItem">
      <div class="attachMeta">
        <div class="attachIcon">${attachmentIcon(att)}</div>
        <div style="min-width:0">
          <div class="attachName">${escapeHtml(att.nombre || 'Archivo')}</div>
          <div class="attachSub">${escapeHtml(att.tamano || formatFileSize(att.size))}${att.ubicacion ? ' - ' + escapeHtml(att.ubicacion) : ''}${att.uploadedAt ? ' - ' + fmtF(String(att.uploadedAt).slice(0,10)) : ''}</div>
        </div>
      </div>
      <div class="attachActions">
        ${att.url ? `<button class="btn btn-sm btn-outline" onclick="openAttachment('${att.url}')">Abrir</button>` : ''}
        ${histId ? `<button class="btn btn-sm btn-outline" onclick="removeHistoriaAttachment('${histId}','${att.id || ''}')">Quitar</button>` : ''}
      </div>
    </div>`).join('')}</div>`;
}

function previewHistoriaFiles() {
  const input = document.getElementById('hAdjuntos');
  const out = document.getElementById('hAdjuntosPreview');
  if (!input || !out) return;
  const files = Array.from(input.files || []);
  const existing = editingHistoriaId ? (state.historias.find(h => String(h.id) === String(editingHistoriaId))?.adjuntos || []) : [];
  const manualUrl = document.getElementById('hAdjuntoUrl')?.value.trim();
  const manualName = document.getElementById('hAdjuntoNombre')?.value.trim();
  const selected = files.length ? `<div class="attachList">${files.map(file => `
    <div class="attachItem">
      <div class="attachMeta"><div class="attachIcon">${attachmentIcon(file)}</div><div><div class="attachName">${escapeHtml(file.name)}</div><div class="attachSub">Pendiente de copiar a OneDrive - ${formatFileSize(file.size)}</div></div></div>
    </div>`).join('')}</div>` : '';
  const linkPreview = manualUrl ? `<div class="attachItem"><div class="attachMeta"><div class="attachIcon">URL</div><div><div class="attachName">${escapeHtml(manualName || 'Enlace de OneDrive')}</div><div class="attachSub">Enlace pendiente de guardar</div></div></div></div>` : '';
  out.innerHTML = `${existing.length ? renderAttachmentList(existing) : ''}${selected || ''}${linkPreview || ''}${(!existing.length && !selected && !linkPreview) ? '<div class="attachHint">Aun no ha seleccionado archivos ni pegado enlaces.</div>' : ''}`;
}

async function uploadHistoriaAttachments(historia, previous = []) {
  const input = document.getElementById('hAdjuntos');
  const files = Array.from(input?.files || []);
  const linkName = document.getElementById('hAdjuntoNombre')?.value.trim() || '';
  const linkUrl = document.getElementById('hAdjuntoUrl')?.value.trim() || '';
  const adjuntos = Array.isArray(previous) ? [...previous] : [];
  const pac = getPac(historia.pacienteId);
  if (linkUrl) {
    adjuntos.push({
      id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      nombre:linkName || 'Enlace de OneDrive',
      tipo:'link/onedrive',
      tamano:'Enlace',
      url:linkUrl,
      ubicacion:'OneDrive web',
      uploadedAt:new Date().toISOString(),
      uploadedBy:currentUser?.name || currentUser?.username || 'Usuario'
    });
  }
  for (const file of files) {
    if (file.size > 25 * 1024 * 1024) {
      alert(`El archivo ${file.name} supera 25 MB. Suba una version mas liviana para guardarlo.`);
      continue;
    }
    const attId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    let synced = false;
    let ubicacion = 'Solo indice local';
    if (oneDriveDirHandle || await restoreOneDriveFolderConnection(false)) {
      synced = await writeHistoriaAttachmentToOneDrive(historia, pac, file, `${attId}-${file.name}`);
      ubicacion = synced ? `OneDrive local / CLINICA PROPIA / PACIENTES / ${patientCode(pac)} - ${pac.nombre || 'Paciente'}` : 'Pendiente de copiar a OneDrive';
    }
    adjuntos.push({
      id:attId,
      nombre:file.name,
      tipo:file.type || '',
      size:file.size,
      tamano:formatFileSize(file.size),
      oneDriveLocal:synced,
      ubicacion,
      uploadedAt:new Date().toISOString(),
      uploadedBy:currentUser?.name || currentUser?.username || 'Usuario'
    });
  }
  if (input) input.value = '';
  const nameInput = document.getElementById('hAdjuntoNombre');
  const urlInput = document.getElementById('hAdjuntoUrl');
  if (nameInput) nameInput.value = '';
  if (urlInput) urlInput.value = '';
  return adjuntos;
}
