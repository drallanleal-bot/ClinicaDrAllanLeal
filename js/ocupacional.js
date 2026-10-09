// ── SALUD OCUPACIONAL / TROPIGAS ───────────────────
function prepModalCita(pacId, citaId) {
  editingCitaId = citaId || null;
  const c = citaId ? state.citas.find(x => String(x.id) === String(citaId)) : null;
  const selectedPac = c ? c.pacienteId : pacId;
  const sel = document.getElementById('cPaciente');
  sel.innerHTML = '<option value="">Seleccionar paciente...</option>' + state.pacientes.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
  if (selectedPac) sel.value = selectedPac;
  document.getElementById('modalCitaTitle').textContent = c ? '📅 Editar Cita' : '📅 Nueva Cita';
  document.getElementById('btnGuardarCita').textContent = c ? '💾 Guardar Cambios' : '💾 Guardar Cita';
  document.getElementById('cFecha').value = c ? c.fecha || '' : todayLocalISO();
  document.getElementById('cHora').value = c ? c.hora || '' : '';
  document.getElementById('cTipo').value = c ? c.tipo || document.getElementById('cTipo').value : document.getElementById('cTipo').value;
  document.getElementById('cNotas').value = c ? c.notas || '' : '';
}
function guardarCita() {
  const pid = document.getElementById('cPaciente').value;
  if (!pid) { alert('Seleccione un paciente.'); return; }
  const fecha = document.getElementById('cFecha').value;
  if (!fecha) { alert('Ingrese la fecha de la cita.'); return; }
  const hora = document.getElementById('cHora').value || '08:00';
  const choque = state.citas.find(x => String(x.id) !== String(editingCitaId) && x.fecha === fecha && x.hora === hora && x.estado !== 'cancelada');
  if (choque && !confirm(`Ya hay una cita el ${fmtF(fecha)} a las ${hora} con ${getPac(choque.pacienteId).nombre}.\n\n¿Desea guardarla de todos modos?`)) return;
  const id = editingCitaId || state.nextCitaId++;
  const previa = state.citas.find(x => String(x.id) === String(id));
  const cita = {
    id,
    pacienteId:pid,
    fecha:document.getElementById('cFecha').value,
    hora:document.getElementById('cHora').value||'08:00',
    tipo:document.getElementById('cTipo').value,
    notas:document.getElementById('cNotas').value,
    recordatorio:'Calendario general',
    estado: previa ? previa.estado : 'pendiente'
  };
  const idx = state.citas.findIndex(x => String(x.id) === String(id));
  if (idx >= 0) state.citas[idx] = { ...state.citas[idx], ...cita };
  else state.citas.push(cita);
  saveAppData({ backupToFolder:true });
  closeModal('modalCita');
  editingCitaId = null;
  refreshClinicPage('agenda');
}
function confirmarCita(id) {
  const c = state.citas.find(x => String(x.id) === String(id));
  if(c) c.estado='confirmada';
  saveAppData({ backupToFolder:true });
  refreshClinicPage('agenda');
}
function cancelarCita(id) {
  const c = state.citas.find(x => String(x.id) === String(id));
  if (!c) return;
  if (!confirm(`¿Marcar como cancelada la cita de ${getPac(c.pacienteId).nombre} del ${fmtF(c.fecha)} a las ${c.hora || ''}?`)) return;
  c.estado = 'cancelada';
  saveAppData({ backupToFolder:true });
  refreshClinicPage('agenda');
}
function borrarCita(id) {
  const c = state.citas.find(x => String(x.id) === String(id));
  if (!c) return;
  if (!confirm(`¿Desea borrar la cita de ${getPac(c.pacienteId).nombre} del ${fmtF(c.fecha)} a las ${c.hora || ''}?`)) return;
  state.citas = state.citas.filter(x => String(x.id) !== String(id));
  saveAppData({ backupToFolder:true });
  refreshClinicPage('agenda');
}
function occData() {
  ensureOcupacionalState();
  return state.ocupacional;
}
function activeOccCompany() {
  ensureOcupacionalState();
  return state.ocupacional.empresas.find(e => e.nombre === state.ocupacional.activeEmpresa) || state.ocupacional.empresas[0];
}
function setOccEmpresa(nombre) {
  state.ocupacional.activeEmpresa = nombre;
  ensureOcupacionalState();
  document.body.classList.toggle('occ-tropigas', nombre === 'TROPIGAS');
  renderSidebar();
  goTo('occDashboard');
}
function crearEmpresaOcupacional() {
  const nombre = (document.getElementById('newEmpresaNombre')?.value || '').trim().toUpperCase();
  const plantas = (document.getElementById('newEmpresaPlantas')?.value || '').split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
  if (!nombre || !plantas.length) { alert('Ingrese nombre de empresa y al menos una planta o sede.'); return; }
  if (state.ocupacional.empresas.some(e => e.nombre === nombre)) { alert('Ya existe una empresa con ese nombre.'); return; }
  state.ocupacional.empresas.push({ nombre, plantas, registros:[], scans:[], fileIndex:[], nextRegistroId:1, nextScanId:1, oneDriveUrl:'' });
  state.ocupacional.activeEmpresa = nombre;
  saveAppData({ backupToFolder:true });
  setOccEmpresa(nombre);
}

async function guardarOccCompanyOneDriveUrl() {
  const company = activeOccCompany();
  if (!company) return;
  company.oneDriveUrl = (document.getElementById('occCompanyOneDriveUrl')?.value || '').trim();
  await saveAppData({ backupToFolder:true });
  await saveOccupationalStateToCloud(true);
  showToast('Enlace de carpeta OneDrive actualizado para esta empresa.');
  renderOcupEmpresas();
}

function occPlantsOptions(selected) {
  return occData().plantas.map(p => `<option value="${p}" ${p===selected?'selected':''}>${p}</option>`).join('');
}
function occAptClass(aptitud) {
  if (aptitud === 'Apto') return 'aptApto';
  if (aptitud === 'Apto con restricción') return 'aptRestriccion';
  if (aptitud === 'No apto con restricción') return 'aptNoAptoRestriccion';
  return 'aptNoApto';
}
function occImc(peso, altura) {
  const p = parseFloat(String(peso || '').replace(',', '.'));
  let a = parseFloat(String(altura || '').replace(',', '.'));
  if (!p || !a) return '';
  if (a > 3) a = a / 100;
  return (p / (a * a)).toFixed(1);
}
function updateOccImc() {
  const out = document.getElementById('occImc');
  const imc = occImc(document.getElementById('occPeso')?.value, document.getElementById('occAltura')?.value);
  if (out) out.value = imc ? `${imc} - ${imcClass(imc)}` : '';
}
function ruffierIndex(p0, p1, p2) {
  const vals = [p0,p1,p2].map(v => parseFloat(String(v || '').replace(',', '.')));
  if (vals.some(v => !v)) return '';
  return ((vals[0] + vals[1] + vals[2] - 200) / 10).toFixed(1);
}
function ruffierClass(value) {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return '';
  if (n <= 0) return 'Excelente (deportista élite)';
  if (n <= 5) return 'Muy buena';
  if (n <= 10) return 'Buena';
  if (n <= 15) return 'Insuficiente';
  return 'Malo';
}
function updateRuffier() {
  if (document.getElementById('occRuffierNoAplica')?.checked) {
    const out = document.getElementById('occRuffierResultado');
    if (out) out.value = 'NO APLICA';
    return;
  }
  const idx = ruffierIndex(document.getElementById('occRuffierReposo')?.value, document.getElementById('occRuffierEsfuerzo')?.value, document.getElementById('occRuffierRecuperacion')?.value);
  const out = document.getElementById('occRuffierResultado');
  if (out) out.value = idx ? `${idx} - ${ruffierClass(idx)}` : '';
}
function updateRuffierMode() {
  const noAplica = document.getElementById('occRuffierNoAplica')?.checked;
  ['occRuffierReposo','occRuffierEsfuerzo','occRuffierRecuperacion'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = !!noAplica;
    if (noAplica) el.value = '';
  });
  updateRuffier();
}
const OCC_DEFAULT_MOTIVO = 'JORNADA DE EVALUACIÓN MEDICA OCUPACIONAL';
const OCC_DEFAULT_HISTORIA = `Paciente se presenta a jornada de evaluación médica ocupacional realizada en las instalaciones de TROPIGAS, con el objetivo de realizar valoración integral de su estado de salud en el contexto laboral, como parte del programa de vigilancia de la salud de los trabajadores.

La evaluación se realiza con el fin de identificar oportunamente factores de riesgo, condiciones de salud y posibles alteraciones que puedan tener relación con las actividades desempeñadas, así como establecer recomendaciones preventivas y de seguimiento cuando sean necesarias. Al momento de la evaluación, paciente se encuentra [asintomático/sintomático por _______], sin datos de compromiso agudo. Se documentan los hallazgos clínicos correspondientes y, de acuerdo con los resultados obtenidos, se brindan recomendaciones, tratamiento y/o referencia para seguimiento médico cuando se considera indicado.`;
const OCC_DEFAULT_EXAMEN = `Estado general: Paciente consciente, orientado en tiempo, espacio y persona (COTEP), alerta, colaborador, afebril, hidratado, eupneico en reposo, con buen estado general y adecuada facies.
Piel: Íntegra, normocoloreada, normotérmica, normohidratada, con adecuada turgencia y elasticidad, sin lesiones, exantemas, equimosis, petequias, cianosis, ictericia ni edema.
Cabeza: Normocéfala, sin deformidades ni lesiones aparentes. Cuero cabelludo íntegro, sin masas ni dolor a la palpación.
Ojos: Pupilas isocóricas, normorreactivas a la luz y acomodación (PERRLA), movimientos oculares extrínsecos conservados, conjuntivas rosadas, escleras anictéricas, agudeza visual conservada en ambos ojos, sin uso de lentes.
Oídos: Pabellones auriculares sin alteraciones, conductos auditivos externos permeables, sin tapones de cerumen ni secreciones. Membranas timpánicas íntegras, con adecuado triángulo luminoso bilateral. Audición clínicamente conservada.
Nariz: Fosas nasales permeables, mucosa nasal rosada e hidratada, sin rinorrea, congestión ni desviación septal significativa.
Cavidad oral y orofaringe: Mucosa oral húmeda y rosada. Dentición en adecuado estado según edad. Lengua sin lesiones y con movilidad conservada. Orofaringe sin hiperemia, exudados ni puntos sépticos. Amígdalas de tamaño normal. Úvula centrada.
Cuello: Simétrico, móvil, sin rigidez, sin adenopatías palpables, sin masas, sin ingurgitación yugular. Tráquea central. Tiroides no aumentada de tamaño ni dolorosa.
Tórax: Simétrico, con adecuada expansión bilateral, sin deformidades, retracciones ni uso de músculos accesorios.
Pulmones: Murmullo vesicular presente y bien distribuido bilateralmente, adecuada entrada de aire, sin estertores, sibilancias, roncus ni otros ruidos respiratorios agregados.
Corazón: Ruidos cardíacos rítmicos, normofonéticos, sin soplos, galope, roces ni otros ruidos agregados. Pulsos periféricos presentes, simétricos y de adecuada intensidad.
Abdomen: Plano, blando, depresible, no doloroso a la palpación superficial ni profunda, sin masas ni visceromegalias palpables. Ruidos gastrointestinales presentes y normoactivos. Sin signos de irritación peritoneal. Percusión sin alteraciones.
Genitourinario/Genitales: Genitales externos acordes al sexo y edad, sin lesiones, secreciones, eritema, edema ni masas evidentes. Sin dolor a la exploración. (Realizar únicamente cuando esté indicado y documentado).
Extremidades: Simétricas, sin deformidades, edema, cianosis ni lesiones. Pulsos distales palpables y simétricos. Llenado capilar menor de 2 segundos. Fuerza muscular 5/5 en las cuatro extremidades. Arcos de movilidad completos y sin dolor.
Neurológico: Paciente alerta y orientado (COTEP). Pares craneales íntegros. Fuerza muscular conservada (5/5), sensibilidad superficial y profunda íntegra. Reflejos osteotendinosos presentes y simétricos. Coordinación, equilibrio y marcha conservados. Sin déficit neurológico focal.
Psiquiátrico: Estado de ánimo y afecto acordes al contexto, lenguaje fluido, pensamiento lógico y coherente, juicio y memoria conservados.`;
const OCC_DEFAULT_ANTECEDENTE = 'NO REFIERE.';
function updateDopingOptions() {
  const result = document.getElementById('occDopingResultado')?.value || 'Pendiente';
  const box = document.getElementById('occDopingSustanciasBox');
  const photoBox = document.getElementById('occDopingFotoBox');
  if (box) box.style.display = result === 'Positivo' ? 'block' : 'none';
  if (photoBox) photoBox.style.display = result === 'Positivo' ? 'block' : 'none';
  if (result !== 'Positivo') {
    if (box) box.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = false; });
    const photoInput = document.getElementById('occDopingFotos');
    const photoPreview = document.getElementById('occDopingFotosPreview');
    if (photoInput) photoInput.value = '';
    if (photoPreview) photoPreview.innerHTML = '';
  }
}

function renderDopingPhotoList(fotos = [], editable = false) {
  if (!fotos.length) return '<div class="attachHint">Sin foto documentada.</div>';
  return `<div class="attachList">${fotos.map(foto => `
    <div class="attachItem">
      <div class="attachMeta">
        ${foto.dataUrl ? `<img class="attachThumb" src="${foto.dataUrl}" alt="Foto de doping">` : '<div class="attachIcon">IMG</div>'}
        <div style="min-width:0">
          <div class="attachName">${escapeHtml(foto.nombre || 'Foto de doping')}</div>
          <div class="attachSub">${escapeHtml(foto.tamano || formatFileSize(foto.size))}${foto.ubicacion ? ' - ' + escapeHtml(foto.ubicacion) : ''}${foto.uploadedAt ? ' - ' + fmtF(String(foto.uploadedAt).slice(0,10)) : ''}</div>
        </div>
      </div>
      <div class="attachActions">
        ${foto.dataUrl ? `<button type="button" class="btn btn-sm btn-outline" onclick="downloadDataUrl('${foto.id || ''}')">Descargar</button>` : ''}
        ${foto.url ? `<button class="btn btn-sm btn-outline" onclick="openAttachment('${foto.url}')">Abrir</button>` : ''}
        ${editable ? `<button type="button" class="btn btn-sm btn-outline" onclick="renameOcupDopingFoto('${foto.id || ''}')">Renombrar</button>` : ''}
        ${editable ? `<button type="button" class="btn btn-sm btn-outline" onclick="removeOcupDopingFoto('${foto.id || ''}')">Quitar</button>` : ''}
      </div>
    </div>`).join('')}</div>`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function canvasToDataUrl(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(canvas.toDataURL('image/jpeg', quality)); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    }, 'image/jpeg', quality);
  });
}

async function compressImageFile(file, maxSide = 520, quality = 0.62) {
  const source = await readFileAsDataUrl(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height || 1));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let dataUrl = await canvasToDataUrl(canvas, quality);
      if (dataUrl.length > 260000 && maxSide > 360) {
        dataUrl = await compressImageFile(file, 360, 0.55);
      }
      resolve(dataUrl);
    };
    img.onerror = reject;
    img.src = source;
  });
}

function splitBase64DataUrl(dataUrl) {
  const text = String(dataUrl || '');
  const comma = text.indexOf(',');
  if (comma < 0) return { prefix:'data:application/octet-stream;base64,', base64:text };
  return { prefix:text.slice(0, comma + 1), base64:text.slice(comma + 1) };
}

async function nextPaint() {
  await new Promise(resolve => setTimeout(resolve, 25));
}

function setOccScanSaveStatus(message = '', progress = null) {
  const out = document.getElementById('occScanSaveStatus');
  if (!out) return;
  const pct = Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : null;
  out.innerHTML = message ? `
    <div style="font-size:13px;color:#56635e;margin-top:.45rem">${escapeHtml(message)}</div>
    ${pct === null ? '' : `<div style="height:8px;background:#eef3f1;border-radius:999px;overflow:hidden;margin-top:.4rem"><div style="width:${pct}%;height:100%;background:var(--green)"></div></div>`}
  ` : '';
}

function base64ToBlob(base64, contentType = 'application/octet-stream') {
  const byteCharacters = atob(base64);
  const byteArrays = [];
  const sliceSize = 512 * 1024;
  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, { type:contentType });
}

async function uploadOcupScanFileToFirestore(scan, file, onProgress = null) {
  if (!scan || !file) return null;
  if (file.size > OCC_SCAN_FILE_MAX_DIRECT_BYTES) {
    alert(`El archivo ${file.name} pesa ${formatFileSize(file.size)}. Para descarga directa gratis, el máximo recomendado es ${formatFileSize(OCC_SCAN_FILE_MAX_DIRECT_BYTES)}. Pegue un enlace directo de OneDrive para archivos más grandes.`);
    return null;
  }
  if (onProgress) { onProgress('Conectando con Firebase...', 3); await nextPaint(); }
  await ensureFirebaseSession();
  if (onProgress) { onProgress(`Leyendo ${file.name} (${formatFileSize(file.size)})...`, 8); await nextPaint(); }
  const dataUrl = await readFileAsDataUrl(file);
  if (onProgress) { onProgress('Preparando archivo para descarga directa...', 15); await nextPaint(); }
  const parts = splitBase64DataUrl(dataUrl);
  const chunks = [];
  for (let i = 0; i < parts.base64.length; i += OCC_SCAN_FILE_CHUNK_SIZE) {
    chunks.push(parts.base64.slice(i, i + OCC_SCAN_FILE_CHUNK_SIZE));
  }
  const docPrefix = `${OCC_SYNC_DOC}__scan_${String(scan.id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  for (let start = 0; start < chunks.length; start += 10) {
    const uploadedBefore = start;
    if (onProgress) {
      const pct = 15 + (uploadedBefore / Math.max(1, chunks.length)) * 80;
      onProgress(`Subiendo archivo directo a Firebase: parte ${uploadedBefore + 1} de ${chunks.length}...`, pct);
      await nextPaint();
    }
    const batch = db.batch();
    chunks.slice(start, start + 10).forEach((chunk, localIndex) => {
      const chunkIndex = start + localIndex;
      batch.set(db.collection(OCC_SYNC_COLLECTION).doc(ocupScanFileDocId(scan.id, chunkIndex)), {
        app:'ClinicaDrAllanLeal',
        module:'SaludOcupacionalEscaner',
        scanId:String(scan.id),
        docPrefix,
        chunkIndex,
        chunk,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy:currentUser?.name || currentUser?.username || 'Usuario'
      });
    });
    await batch.commit();
  }
  if (onProgress) { onProgress('Archivo directo preparado. Guardando índice...', 96); await nextPaint(); }
  return {
    storage:'firestoreChunks',
    docPrefix,
    chunkCount:chunks.length,
    dataPrefix:parts.prefix,
    contentType:file.type || 'application/octet-stream',
    size:file.size,
    uploadedAt:new Date().toISOString(),
    uploadedBy:currentUser?.name || currentUser?.username || 'Usuario'
  };
}

async function deleteOcupScanFileFromFirestore(scan) {
  if (!scan?.firestoreFile?.chunkCount) return;
  await ensureFirebaseSession();
  for (let start = 0; start < scan.firestoreFile.chunkCount; start += 10) {
    const batch = db.batch();
    for (let i = start; i < Math.min(scan.firestoreFile.chunkCount, start + 10); i++) {
      batch.delete(db.collection(OCC_SYNC_COLLECTION).doc(ocupScanFileDocId(scan.id, i)));
    }
    await batch.commit();
  }
}

async function downloadOcupScanFromFirestore(scan) {
  const meta = scan?.firestoreFile;
  if (!meta?.chunkCount) return false;
  await ensureFirebaseSession();
  const chunks = [];
  for (let i = 0; i < meta.chunkCount; i++) {
    const snap = await db.collection(OCC_SYNC_COLLECTION).doc(ocupScanFileDocId(scan.id, i)).get();
    if (!snap.exists || !snap.data()?.chunk) throw new Error(`Falta una parte del archivo (${i + 1}/${meta.chunkCount}).`);
    chunks.push(snap.data().chunk);
  }
  const blob = base64ToBlob(chunks.join(''), meta.contentType || 'application/octet-stream');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safePathName(scan.nombreArchivo || 'escaner.pdf');
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return true;
}

function findDopingPhoto(photoId) {
  for (const emp of state.ocupacional?.empresas || []) {
    for (const record of emp.registros || []) {
      const foto = (record.dopingFotos || []).find(item => String(item.id) === String(photoId));
      if (foto) return foto;
    }
  }
  return null;
}

function downloadDataUrl(photoId) {
  const foto = findDopingPhoto(photoId);
  if (!foto || !foto.dataUrl) {
    alert('Esta foto no está disponible para descarga desde el dashboard. Si es una foto antigua, edite el registro y vuelva a adjuntarla.');
    return;
  }
  const link = document.createElement('a');
  link.href = foto.dataUrl;
  link.download = safeStorageName(foto.nombre || 'foto-doping.jpg');
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function currentEditingOcupRecord() {
  if (!editingOcupRegistroId) return null;
  return occData().registros.find(r => String(r.id) === String(editingOcupRegistroId)) || null;
}

function refreshOcupDopingFotosPreview() {
  const out = document.getElementById('occDopingFotosPreview');
  if (!out) return;
  previewOcupDopingFotos();
}

async function renameOcupDopingFoto(photoId) {
  const record = currentEditingOcupRecord();
  if (!record) return;
  const foto = (record.dopingFotos || []).find(item => String(item.id) === String(photoId));
  if (!foto) return;
  const nuevoNombre = prompt('Nuevo nombre para la foto:', foto.nombre || 'Foto de doping');
  if (!nuevoNombre || !nuevoNombre.trim()) return;
  foto.nombre = nuevoNombre.trim();
  foto.updatedAt = new Date().toISOString();
  record.updatedAt = new Date().toISOString();
  await saveAppData({ backupToFolder:true });
  await saveOccupationalStateToCloud(true);
  refreshOcupDopingFotosPreview();
}

async function removeOcupDopingFoto(photoId) {
  const record = currentEditingOcupRecord();
  if (!record) return;
  const fotos = Array.isArray(record.dopingFotos) ? record.dopingFotos : [];
  const foto = fotos.find(item => String(item.id) === String(photoId));
  if (!foto) return;
  if (!confirm(`¿Desea quitar la foto ${foto.nombre || 'seleccionada'} de este registro? El archivo original en OneDrive no se eliminará automáticamente.`)) return;
  record.dopingFotos = fotos.filter(item => String(item.id) !== String(photoId));
  record.updatedAt = new Date().toISOString();
  await saveAppData({ backupToFolder:true });
  await saveOccupationalStateToCloud(true);
  refreshOcupDopingFotosPreview();
}

function dopingPhotoPreview(fotos = []) {
  if (!Array.isArray(fotos) || !fotos.length) return '<span class="attachHint">Sin foto</span>';
  const first = fotos.find(foto => foto && foto.dataUrl) || fotos[0];
  const thumb = first.dataUrl ? `<img class="dopingThumb" src="${first.dataUrl}" alt="Foto de doping">` : '<span class="attachIcon" title="Foto documentada">IMG</span>';
  const download = first.dataUrl ? `<button type="button" class="btn btn-sm btn-outline" onclick="downloadDataUrl('${first.id || ''}')">Descargar</button>` : '<span class="attachHint">Sin descarga</span>';
  return `<div style="display:flex;align-items:center;gap:.45rem;flex-wrap:wrap">${thumb}${download}${fotos.length > 1 ? `<small>+${fotos.length - 1}</small>` : ''}</div>`;
}

function findOcupScan(scanId) {
  for (const emp of state.ocupacional?.empresas || []) {
    const scan = (emp.scans || []).find(item => String(item.id) === String(scanId));
    if (scan) return scan;
  }
  return null;
}

function oneDriveDownloadUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (host.includes('1drv.ms') || host.includes('onedrive.live.com') || host.includes('sharepoint.com')) {
      url.searchParams.set('download', '1');
      return url.toString();
    }
  } catch (e) {
    return raw;
  }
  return raw;
}

async function downloadOcupScan(scanId = '') {
  const scan = scanId ? findOcupScan(scanId) : null;
  if (scan?.firestoreFile?.chunkCount) {
    try {
      await downloadOcupScanFromFirestore(scan);
      return;
    } catch (e) {
      console.warn('No se pudo descargar escáner desde Firestore.', e);
      alert(`No se pudo descargar el archivo directo desde Firebase: ${e.message || 'error desconocido'}.`);
    }
  }
  if (scan?.dataUrl) {
    const link = document.createElement('a');
    link.href = scan.dataUrl;
    link.download = safePathName(scan.nombreArchivo || 'escaner.pdf');
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }
  if (scan?.url) {
    window.open(oneDriveDownloadUrl(scan.url), '_blank', 'noopener');
    return;
  }
  alert('Este escáner aún no tiene enlace directo. Se abrirá la carpeta compartida de OneDrive; para abrirlo directo, edite el escáner y pegue el enlace compartido del archivo.');
  openOccupationalScansFolder();
}

function scanDownloadButton(scan) {
  const hasDirect = !!(scan?.firestoreFile?.chunkCount || scan?.dataUrl || scan?.url);
  const label = hasDirect ? 'Abrir/descargar' : 'Abrir OneDrive';
  return `<button class="btn btn-sm ${hasDirect ? 'btn-primary' : 'btn-outline'}" onclick="downloadOcupScan('${scan.id}')">${label}</button>`;
}

function scanStorageBadge(scan) {
  if (scan?.firestoreFile?.chunkCount) return '<span class="badge badge-green">Descarga directa lista</span>';
  if (scan?.url) return '<span class="badge badge-green">Enlace directo</span>';
  if (scan?.dataUrl) return '<span class="badge badge-green">Imagen directa</span>';
  if (scan?.sincronizado) return '<span class="badge badge-warn">Solo OneDrive local</span>';
  return '<span class="badge badge-warn">Solo índice</span>';
}

function previewOcupDopingFotos() {
  const input = document.getElementById('occDopingFotos');
  const out = document.getElementById('occDopingFotosPreview');
  if (!input || !out) return;
  const files = Array.from(input.files || []);
  const existing = editingOcupRegistroId ? (occData().registros.find(r => String(r.id) === String(editingOcupRegistroId))?.dopingFotos || []) : [];
  const selected = files.length ? `<div class="attachList">${files.map(file => `
    <div class="attachItem">
      <div class="attachMeta"><div class="attachIcon">IMG</div><div><div class="attachName">${escapeHtml(file.name)}</div><div class="attachSub">Pendiente de copiar a OneDrive - ${formatFileSize(file.size)}</div></div></div>
    </div>`).join('')}</div>` : '';
  out.innerHTML = `${existing.length ? renderDopingPhotoList(existing, true) : ''}${selected || (!existing.length ? '<div class="attachHint">Aun no ha seleccionado foto.</div>' : '')}`;
}

async function uploadOcupDopingFotos(registro, previous = []) {
  const input = document.getElementById('occDopingFotos');
  const files = Array.from(input?.files || []);
  const fotos = Array.isArray(previous) ? [...previous] : [];
  if (!files.length) return fotos;
  const oneDriveReady = oneDriveDirHandle || await restoreOneDriveFolderConnection(false);
  for (const file of files) {
    if (!String(file.type || '').startsWith('image/')) {
      alert(`El archivo ${file.name} no parece ser una imagen. Seleccione una foto del resultado.`);
      continue;
    }
    if (file.size > 25 * 1024 * 1024) {
      alert(`La foto ${file.name} supera 25 MB. Suba una versión más liviana para guardarla.`);
      continue;
    }
    const fotoId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const nombreArchivo = `${fotoId}-${file.name}`;
    let dataUrl = '';
    try {
      dataUrl = await compressImageFile(file);
    } catch (e) {
      console.warn('No se pudo comprimir la foto de doping.', e);
      alert(`No se pudo preparar la foto ${file.name} para descarga en dashboard.`);
    }
    const synced = oneDriveReady ? await writeOcupDopingPhotoToOneDrive(registro, file, nombreArchivo) : false;
    fotos.push({
      id:fotoId,
      nombre:file.name,
      tipo:file.type || 'image/*',
      size:file.size,
      tamano:formatFileSize(file.size),
      nombreArchivo,
      dataUrl,
      oneDriveLocal:synced,
      ubicacion:synced ? `OneDrive local / SALUD OCUPACIONAL / ${occData().activeEmpresa || 'TROPIGAS'} / DOPING` : 'Guardada en Firebase como imagen comprimida',
      uploadedAt:new Date().toISOString(),
      uploadedBy:currentUser?.name || currentUser?.username || 'Usuario'
    });
  }
  if (input) input.value = '';
  return fotos;
}
function countBy(records, keyFn) {
  return records.reduce((acc, row) => {
    const key = keyFn(row) || 'Sin dato';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}
function tableFromCounts(counts, label) {
  const rows = Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  return `<table><thead><tr><th>${label}</th><th>Total</th></tr></thead><tbody>${rows || '<tr><td colspan="2" style="text-align:center;color:#aaa;padding:1rem">Sin datos.</td></tr>'}</tbody></table>`;
}
function isHighBp(pa) {
  const m = String(pa || '').match(/(\d{2,3})\D+(\d{2,3})/);
  return m ? Number(m[1]) >= 140 || Number(m[2]) >= 90 : false;
}
function isHighGlucose(gmt) {
  const n = parseFloat(String(gmt || '').replace(',', '.'));
  return n >= 126;
}
function ageGroup(edad) {
  const n = Number(edad);
  if (!n) return 'Sin edad';
  if (n < 30) return '18-29';
  if (n < 40) return '30-39';
  if (n < 50) return '40-49';
  if (n < 60) return '50-59';
  return '60+';
}
function isPilot(row) {
  return /piloto|conductor|driver|chofer/i.test(`${row.puesto || ''} ${row.area || ''}`);
}
function occHeader(title, subtitle) {
  const company = activeOccCompany();
  return `<div class="occHeader">
    <div><div class="occTitle">${title}</div><div class="occSubtitle">${subtitle}</div></div>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap">
      <button class="btn btn-outline" onclick="openOccupationalScansFolder()">Abrir OneDrive</button>
      ${isOcupViewer() ? '' : `<button class="btn btn-primary" onclick="forceOccupationalCloudSync()">Subir data a Firebase</button>`}
      ${isOcupViewer() ? '' : `<button class="btn btn-primary" onclick="goTo('occRegistros')">+ Registro EMOP</button>`}
    </div>
  </div>`;
}
function occRecordYear(record = {}) {
  return String(record.backupYear || record.fechaEvaluacion || record.fecha || '').slice(0, 4);
}
function occAvailableYears() {
  const years = new Set();
  (occData().registros || []).forEach(r => {
    const year = occRecordYear(r);
    if (/^\d{4}$/.test(year)) years.add(year);
  });
  (occData().scans || []).forEach(s => {
    const year = occRecordYear(s);
    if (/^\d{4}$/.test(year)) years.add(year);
  });
  return Array.from(years).sort((a, b) => Number(b) - Number(a));
}
function occYearOptions(selected = 'TODOS') {
  return occAvailableYears().map(year => `<option value="${year}" ${year === selected ? 'selected' : ''}>${year}</option>`).join('');
}
function normalizeOccSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
function occFilteredRecords(planta, fecha, year = 'TODOS', options = {}) {
  const nombre = normalizeOccSearchText(options.nombre || '');
  const fechaInicio = options.fechaInicio || '';
  const fechaFin = options.fechaFin || '';
  return occData().registros.filter(r => {
    const recordFecha = String(r.fechaEvaluacion || '');
    const recordNombre = normalizeOccSearchText(r.nombre || '');
    return (!planta || planta === 'TODAS' || r.planta === planta) &&
      (!fecha || recordFecha === fecha) &&
      (!fechaInicio || recordFecha >= fechaInicio) &&
      (!fechaFin || recordFecha <= fechaFin) &&
      (!nombre || recordNombre.includes(nombre)) &&
      (!year || year === 'TODOS' || occRecordYear(r) === year);
  });
}
const occRegistrosFilters = { nombre:'' };
function updateOcupRegistrosFilter(key, value) {
  occRegistrosFilters[key] = value || '';
  renderOcupRegistros();
  if (key === 'nombre') {
    setTimeout(() => {
      const input = document.getElementById('occRegNombreSearch');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 0);
  }
}
function clearOcupRegistrosFilters() {
  occRegistrosFilters.nombre = '';
  renderOcupRegistros();
}
function occRecordKey(record = {}) {
  const expediente = String(record.expediente || '').trim().toUpperCase();
  const planta = String(record.planta || '').trim().toUpperCase();
  const fecha = String(record.fechaEvaluacion || '').trim();
  if (expediente && planta && fecha) return `${planta}|${fecha}|${expediente}`;
  const dpi = String(record.dpi || '').trim();
  const nombre = String(record.nombre || '').trim().toUpperCase();
  return `${planta}|${fecha}|${dpi || nombre}`;
}
function recordUpdatedTime(record = {}) {
  const raw = record.updatedAt || record.createdAt || '';
  const time = Date.parse(raw);
  return Number.isFinite(time) ? time : 0;
}
function mergeOcupRegistro(base = {}, incoming = {}, preferIncoming = true) {
  const merged = { ...base };
  Object.entries(incoming).forEach(([key, value]) => {
    const incomingHasValue = Array.isArray(value) || !(value === '' || value === null || typeof value === 'undefined');
    const baseHasValue = !(merged[key] === '' || merged[key] === null || typeof merged[key] === 'undefined');
    if (incomingHasValue || !baseHasValue || preferIncoming) merged[key] = incomingHasValue ? value : merged[key];
  });
  return merged;
}
function findOcupRegistroIndex(records, candidate) {
  let idx = records.findIndex(r => String(r.id) === String(candidate.id));
  if (idx >= 0) return idx;
  const key = occRecordKey(candidate);
  if (!key.replace(/\|/g, '')) return -1;
  return records.findIndex(r => occRecordKey(r) === key);
}
function dedupeOcupRegistros(records = []) {
  const byKey = new Map();
  records.forEach(record => {
    const key = occRecordKey(record) || `id:${record.id}`;
    if (!byKey.has(key)) {
      byKey.set(key, record);
      return;
    }
    const existing = byKey.get(key);
    const incomingIsNewer = recordUpdatedTime(record) >= recordUpdatedTime(existing);
    byKey.set(key, incomingIsNewer
      ? mergeOcupRegistro(existing, record, true)
      : mergeOcupRegistro(record, existing, true)
    );
  });
  records.splice(0, records.length, ...Array.from(byKey.values()));
  return records;
}
function dedupeAllOcupacionalRegistros() {
  ensureOcupacionalState();
  (state.ocupacional.empresas || []).forEach(emp => {
    emp.registros = dedupeOcupRegistros(Array.isArray(emp.registros) ? emp.registros : []);
  });
}
function occAptCounts(records) {
  const base = { 'Apto':0, 'Apto con restricción':0, 'No apto con restricción':0, 'No apto':0 };
  records.forEach(r => { base[r.aptitudLaboral] = (base[r.aptitudLaboral] || 0) + 1; });
  return base;
}
function renderOcupEmpresas() {
  const cards = state.ocupacional.empresas.map(emp => `<div class="occCompanyCard ${emp.nombre===occData().activeEmpresa?'active':''}" onclick="setOccEmpresa('${emp.nombre.replace(/'/g, "\\'")}')">
    <div style="font-size:18px;font-weight:700;margin-bottom:.35rem">${emp.nombre}</div>
    <div style="font-size:12px;color:#777;margin-bottom:.75rem">${(emp.plantas || []).join(', ') || 'Sin plantas'}</div>
    <div class="occMetricRow">
      <div class="occMetric"><span>Evaluaciones</span>${(emp.registros || []).length}</div>
      <div class="occMetric"><span>Escáneres</span>${(emp.scans || []).length}</div>
      <div class="occMetric"><span>Archivos</span>${(emp.fileIndex || []).length}</div>
      <div class="occMetric"><span>Backups</span>${(emp.backupsAnuales || []).map(b => b.anio).join(', ') || '—'}</div>
    </div>
  </div>`).join('');
  setC(`
${occHeader('Salud Ocupacional', 'Seleccione TROPIGAS o cree nuevas empresas con el mismo estilo de control.')}
<div class="occCompanyGrid">${cards}</div>
${isOcupViewer() ? '' : `<div class="card">
  <div class="cardTitle">Carpeta OneDrive de ${escapeHtml(occData().activeEmpresa)}</div>
  <div class="fGroup">
    <label>Enlace compartido de carpeta</label>
    <input id="occCompanyOneDriveUrl" type="url" value="${escapeHtml(activeOccCompany()?.oneDriveUrl || '')}" placeholder="Pegue el enlace actualizado de OneDrive">
    <div class="attachHint">Este enlace se usa solo como respaldo cuando un escáner aún no tiene descarga directa. Los escáneres con copia directa se descargan sin abrir carpeta.</div>
  </div>
  <div style="display:flex;gap:.5rem;flex-wrap:wrap">
    <button class="btn btn-primary" onclick="guardarOccCompanyOneDriveUrl()">Guardar enlace</button>
    <button class="btn btn-outline" onclick="openOccupationalScansFolder()">Probar carpeta</button>
  </div>
</div>`}
${isOcupViewer() ? '' : `<div class="card">
  <div class="cardTitle">Nueva empresa</div>
  <div class="fRow">
    <div class="fGroup"><label>Nombre de empresa</label><input id="newEmpresaNombre" placeholder="Ej: NUEVA EMPRESA"></div>
    <div class="fGroup"><label>Plantas / sedes separadas por coma</label><input id="newEmpresaPlantas" placeholder="Ej: MIXCO, PETAPA, ZONA 18"></div>
  </div>
  <button class="btn btn-primary" onclick="crearEmpresaOcupacional()">Crear empresa</button>
</div>`}`);
}
function renderOcupDashboard() {
  const plantFilter = document.getElementById('occDashPlant')?.value || 'TODAS';
  const yearFilter = document.getElementById('occDashYear')?.value || 'TODOS';
  const dateStartFilter = document.getElementById('occDashDateStart')?.value || '';
  const dateEndFilter = document.getElementById('occDashDateEnd')?.value || '';
  const records = occFilteredRecords(plantFilter, '', yearFilter, { fechaInicio:dateStartFilter, fechaFin:dateEndFilter });
  const counts = occAptCounts(records);
  const scans = occData().scans.filter(s =>
    (!plantFilter || plantFilter === 'TODAS' || s.planta === plantFilter) &&
    (!dateStartFilter || String(s.fecha || '') >= dateStartFilter) &&
    (!dateEndFilter || String(s.fecha || '') <= dateEndFilter) &&
    (!yearFilter || yearFilter === 'TODOS' || occRecordYear(s) === yearFilter)
  );
  const hta = records.filter(r => isHighBp(r.pa)).length;
  const glucosa = records.filter(r => isHighGlucose(r.gmt)).length;
  const pilotos = records.filter(isPilot);
  const imcCounts = countBy(records, r => imcClass(r.imc));
  const edadCounts = countBy(records, r => ageGroup(r.edad));
  const puestoCounts = countBy(records, r => r.puesto);
  const noAptos = records.filter(r => ['No apto','No apto con restricción'].includes(r.aptitudLaboral));
  const dopingPositivos = records.filter(r => r.dopingResultado === 'Positivo');
  const dopingSustanciaCounts = countBy(dopingPositivos.flatMap(r => (Array.isArray(r.dopingSustancias) && r.dopingSustancias.length ? r.dopingSustancias : ['Positivo sin sustancia registrada'])), s => s);
  const plantRows = occData().plantas.map(p => {
    const rows = occFilteredRecords(p, '', yearFilter, { fechaInicio:dateStartFilter, fechaFin:dateEndFilter });
    const c = occAptCounts(rows);
    return `<tr><td><strong>${p}</strong></td><td>${rows.length}</td><td>${c['Apto']}</td><td>${c['Apto con restricción']}</td><td>${c['No apto con restricción']}</td><td>${c['No apto']}</td></tr>`;
  }).join('');
  setC(`
${occHeader(`Salud Ocupacional - ${occData().activeEmpresa}`, 'Control de jornadas EMOP por planta, fecha, aptitud laboral y escáneres.')}
<div class="card">
  <div class="cardTitle">Filtros</div>
  <div class="fRow">
    <div class="fGroup"><label>Planta</label><select id="occDashPlant" onchange="renderOcupDashboard()"><option value="TODAS">Todas las plantas</option>${occPlantsOptions(plantFilter)}</select></div>
    <div class="fGroup"><label>Año</label><select id="occDashYear" onchange="renderOcupDashboard()"><option value="TODOS">Todos los años</option>${occYearOptions(yearFilter)}</select></div>
    <div class="fGroup"><label>Fecha de inicio</label><input id="occDashDateStart" type="date" value="${dateStartFilter}" onchange="renderOcupDashboard()"></div>
    <div class="fGroup"><label>Fecha final</label><input id="occDashDateEnd" type="date" value="${dateEndFilter}" onchange="renderOcupDashboard()"></div>
  </div>
  ${(dateStartFilter || dateEndFilter) ? `<div style="display:flex;justify-content:flex-end;margin-top:.65rem"><button class="btn btn-sm btn-outline" onclick="document.getElementById('occDashDateStart').value='';document.getElementById('occDashDateEnd').value='';renderOcupDashboard()">Limpiar fechas</button></div>` : ''}
  ${isOcupViewer() ? '' : `<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.75rem">
    <button class="btn btn-outline" onclick="indexarCarpetaOcupacional()">Indexar carpeta local de OneDrive</button>
    <button class="btn btn-primary" onclick="forceOccupationalCloudSync()">Sincronizar ahora con Firebase</button>
    <button class="btn btn-outline" onclick="openOccupationalScansFolder()">Abrir carpeta de resultados</button>
  </div>`}
  ${renderOccCloudStatus()}
</div>
<div class="riskGrid" style="margin-bottom:1rem">
  <div class="riskBox"><span>Por puestos de trabajo</span><strong>${Object.keys(puestoCounts).length}</strong><small>puestos identificados</small></div>
  <div class="riskBox"><span>Pilotos / grupo prioritario</span><strong>${pilotos.length}/${records.length || 0}</strong><small>pilotos, conductores o choferes</small></div>
  <div class="riskBox"><span>Hipertensión arterial</span><strong>${hta}/${records.length || 0}</strong><small>PA ≥ 140/90 registrada</small></div>
  <div class="riskBox"><span>Hiperglucemia</span><strong>${glucosa}/${records.length || 0}</strong><small>GMT ≥ 126 mg/dL</small></div>
  <div class="riskBox"><span>Doping positivo</span><strong>${dopingPositivos.length}/${records.length || 0}</strong><small>resultados positivos registrados</small></div>
</div>
<div class="statGrid">
  <div class="statBox"><div class="statNum">${records.length}</div><div class="statLbl">Evaluaciones</div></div>
  <div class="statBox"><div class="statNum">${counts['Apto']}</div><div class="statLbl">Aptos</div></div>
  <div class="statBox"><div class="statNum">${counts['Apto con restricción']}</div><div class="statLbl">Aptos con restricción</div></div>
  <div class="statBox"><div class="statNum">${counts['No apto con restricción'] + counts['No apto']}</div><div class="statLbl">No aptos / restricción</div></div>
</div>
<div class="card">
  <div class="cardTitle">Gráficas / análisis de población</div>
  <div class="fRow">
    <div>${tableFromCounts(puestoCounts, 'Puesto')}</div>
    <div>${tableFromCounts(edadCounts, 'Edad')}</div>
  </div>
  <div class="fRow" style="margin-top:.75rem">
    <div>${tableFromCounts(imcCounts, 'Clasificación IMC')}</div>
    <div>${tableFromCounts(countBy(pilotos, r => r.planta), 'Pilotos por planta')}</div>
  </div>
</div>
<div class="card">
  <div class="cardTitle">Resultados de doping</div>
  <div class="fRow" style="align-items:flex-start">
    <div>${tableFromCounts(dopingSustanciaCounts, 'Sustancia')}</div>
    <div>
      <table><thead><tr><th>Fecha</th><th>Planta</th><th>Expediente</th><th>Nombre</th><th>Sustancia</th><th>Foto</th></tr></thead>
      <tbody>${dopingPositivos.map(r => `<tr><td>${fmtF(r.fechaEvaluacion)}</td><td>${escapeHtml(r.planta)}</td><td>${escapeHtml(r.expediente)}</td><td>${escapeHtml(r.nombre)}</td><td>${escapeHtml((r.dopingSustancias || []).join(', ') || 'Positivo sin sustancia registrada')}</td><td>${dopingPhotoPreview(r.dopingFotos)}</td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:1rem">Sin resultados positivos de doping en estos filtros.</td></tr>'}</tbody></table>
    </div>
  </div>
</div>
<div class="card">
  <div class="cardTitle">Aptitud laboral por planta</div>
  <table><thead><tr><th>Planta</th><th>Total</th><th>Apto</th><th>Apto c/restricción</th><th>No apto c/restricción</th><th>No apto</th></tr></thead><tbody>${plantRows}</tbody></table>
</div>
<div class="card">
  <div class="cardTitle">No aptos y no aptos con restricción por planta</div>
  <table><thead><tr><th>Planta</th><th>Expediente</th><th>Nombre</th><th>Puesto</th><th>Aptitud</th></tr></thead>
  <tbody>${noAptos.map(r => `<tr><td>${r.planta}</td><td>${r.expediente}</td><td>${r.nombre}</td><td>${r.puesto||'—'}</td><td><span class="badge ${occAptClass(r.aptitudLaboral)}">${r.aptitudLaboral}</span></td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:1rem">Sin registros no aptos en estos filtros.</td></tr>'}</tbody></table>
</div>
<div class="card">
  <div class="cardTitle">Últimas evaluaciones</div>
  <table><thead><tr><th>Fecha</th><th>Planta</th><th>Expediente</th><th>Nombre</th><th>Puesto</th><th>IMC</th><th>Aptitud</th></tr></thead>
  <tbody>${records.slice().reverse().slice(0,10).map(r => `<tr><td>${fmtF(r.fechaEvaluacion)}</td><td>${r.planta}</td><td>${r.expediente}</td><td>${r.nombre}</td><td>${r.puesto||'—'}</td><td>${r.imc||'—'}</td><td><span class="badge ${occAptClass(r.aptitudLaboral)}">${r.aptitudLaboral}</span></td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:1rem">Sin evaluaciones registradas con estos filtros.</td></tr>'}</tbody></table>
</div>
<div class="card">
  <div class="cardTitle">Escáneres disponibles</div>
  <div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap;margin-bottom:.75rem">
    <p style="font-size:13px;color:#666;margin:0">${scans.length} archivo(s) indexados para los filtros seleccionados.</p>
    <button class="btn btn-sm btn-outline" onclick="openOccupationalScansFolder()">Descargar escáneres</button>
  </div>
  <table><thead><tr><th>Fecha</th><th>Planta</th><th>Tipo</th><th>Archivo</th><th>Estado</th><th>Descargar</th></tr></thead>
  <tbody>${scans.slice().reverse().map(s => `<tr><td>${fmtF(s.fecha)}</td><td>${s.planta}</td><td>${s.tipo}</td><td>${s.nombreArchivo}</td><td>${scanStorageBadge(s)}</td><td>${scanDownloadButton(s)}</td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:1rem">Sin escáneres registrados.</td></tr>'}</tbody></table>
</div>
<div class="card">
  <div class="cardTitle">Historias clínicas y reportes indexados desde OneDrive</div>
  <p style="font-size:13px;color:#666;margin-bottom:.75rem">${(activeOccCompany().fileIndex || []).length} archivo(s) indexados. El sistema guarda el índice local; los documentos reales permanecen en tu OneDrive.</p>
  <table><thead><tr><th>Archivo</th><th>Ruta</th><th>Tamaño</th></tr></thead>
  <tbody>${(activeOccCompany().fileIndex || []).slice(0,25).map(f => `<tr><td>${f.nombreArchivo}</td><td>${f.ruta}</td><td>${f.tamano}</td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:#aaa;padding:1rem">Aún no se ha indexado una carpeta.</td></tr>'}</tbody></table>
</div>`);
}
function renderOcupRegistros() {
  if (isOcupViewer()) { renderOcupDashboard(); return; }
  const allRecords = occData().registros;
  const nombreFilter = occRegistrosFilters.nombre || '';
  const records = occFilteredRecords('', '', 'TODOS', { nombre:nombreFilter });
  const editing = allRecords.find(r => String(r.id) === String(editingOcupRegistroId));
  const isEdit = !!editing;
  const v = key => escapeHtml(editing?.[key] ?? '');
  const defaultValue = (key, fallback) => escapeHtml(isEdit ? (editing?.[key] ?? '') : fallback);
  const selectedPlant = editing?.planta || occData().plantas[0] || 'MIXCO';
  const selectedApt = editing?.aptitudLaboral || 'Apto';
  const aptSelected = value => selectedApt === value ? 'selected' : '';
  const ruffierNoAplica = editing?.ruffierNoAplica === true || editing?.ruffierClasificacion === 'NO APLICA';
  const ruffierDisplay = ruffierNoAplica ? 'NO APLICA' : (editing?.ruffierIndice ? `${editing.ruffierIndice} - ${editing.ruffierClasificacion || ruffierClass(editing.ruffierIndice)}` : '');
  const ruffierDisabled = ruffierNoAplica ? 'disabled' : '';
  const selectedDoping = editing?.dopingResultado || 'Pendiente';
  const dopingSustancias = Array.isArray(editing?.dopingSustancias) ? editing.dopingSustancias : [];
  const dopingFotos = Array.isArray(editing?.dopingFotos) ? editing.dopingFotos : [];
  const dopingSelected = value => selectedDoping === value ? 'selected' : '';
  const dopingChecked = value => dopingSustancias.includes(value) ? 'checked' : '';
  setC(`
${occHeader(`Registros EMOP - ${occData().activeEmpresa}`, 'Evaluación médica ocupacional por planta y fecha.')}
<div class="card">
  <div class="cardTitle">${isEdit ? 'Editar registro de evaluación médica ocupacional' : 'Nuevo registro de evaluación médica ocupacional'}</div>
  <div class="fRow three">
    <div class="fGroup"><label>Planta</label><select id="occPlanta">${occPlantsOptions(selectedPlant)}</select></div>
    <div class="fGroup"><label>Fecha de evaluación</label><input type="date" id="occFecha" value="${v('fechaEvaluacion') || new Date().toISOString().slice(0,10)}"></div>
    <div class="fGroup"><label>Número de expediente</label><input id="occExpediente" value="${v('expediente')}" placeholder="Auto si se deja vacío"></div>
  </div>
  <div class="fRow">
    <div class="fGroup"><label>Nombre completo</label><input id="occNombre" value="${v('nombre')}" placeholder="Nombre del colaborador"></div>
    <div class="fGroup"><label>DPI</label><input id="occDpi" value="${v('dpi')}" placeholder="Número de DPI"></div>
  </div>
  <div class="fRow three">
    <div class="fGroup"><label>Puesto</label><input id="occPuesto" value="${v('puesto')}"></div>
    <div class="fGroup"><label>Área</label><input id="occArea" value="${v('area')}"></div>
    <div class="fGroup"><label>Edad</label><input id="occEdad" value="${v('edad')}" type="number" min="0"></div>
  </div>
  <div class="fRow three">
    <div class="fGroup"><label>PA</label><input id="occPa" value="${v('pa')}" placeholder="120/80"></div>
    <div class="fGroup"><label>FC</label><input id="occFc" value="${v('fc')}" type="number"></div>
    <div class="fGroup"><label>FR</label><input id="occFr" value="${v('fr')}" type="number"></div>
  </div>
  <div class="fRow three">
    <div class="fGroup"><label>TEMP</label><input id="occTemp" value="${v('temp')}" type="number" step="0.1"></div>
    <div class="fGroup"><label>SPO2</label><input id="occSpo2" value="${v('spo2')}" type="number"></div>
    <div class="fGroup"><label>GMT</label><input id="occGmt" value="${v('gmt')}" type="number"></div>
  </div>
  <div class="fRow three">
    <div class="fGroup"><label>Peso kg</label><input id="occPeso" value="${v('peso')}" type="number" step="0.1" oninput="updateOccImc()"></div>
    <div class="fGroup"><label>Altura m o cm</label><input id="occAltura" value="${v('altura')}" type="number" step="0.01" oninput="updateOccImc()"></div>
    <div class="fGroup"><label>IMC automático</label><input id="occImc" value="${v('imc')}" readonly></div>
  </div>
  <div class="fRow">
    <div class="fGroup"><label>Motivo de consulta</label><textarea id="occMotivo" rows="2">${defaultValue('motivoConsulta', OCC_DEFAULT_MOTIVO)}</textarea></div>
    <div class="fGroup"><label>Historia enfermedad actual</label><textarea id="occHistoria" rows="5">${defaultValue('historiaActual', OCC_DEFAULT_HISTORIA)}</textarea></div>
  </div>
  <div class="cardTitle" style="margin-top:.35rem">Antecedentes</div>
  <div class="fRow">
    <div class="fGroup"><label>Antecedentes familiares</label><textarea id="occAntecedentesFamiliares" rows="2">${defaultValue('antecedentesFamiliares', OCC_DEFAULT_ANTECEDENTE)}</textarea></div>
    <div class="fGroup"><label>Antecedentes médicos</label><textarea id="occAntecedentesMedicos" rows="2">${defaultValue('antecedentesMedicos', OCC_DEFAULT_ANTECEDENTE)}</textarea></div>
  </div>
  <div class="fRow">
    <div class="fGroup"><label>Antecedentes alérgicos</label><textarea id="occAntecedentesAlergicos" rows="2">${defaultValue('antecedentesAlergicos', OCC_DEFAULT_ANTECEDENTE)}</textarea></div>
    <div class="fGroup"><label>Antecedentes quirúrgicos/traumáticos</label><textarea id="occAntecedentesQuirurgicos" rows="2">${defaultValue('antecedentesQuirurgicos', OCC_DEFAULT_ANTECEDENTE)}</textarea></div>
  </div>
  <div class="fRow">
    <div class="fGroup"><label>Examen físico</label><textarea id="occExamen" rows="10">${defaultValue('examenFisico', OCC_DEFAULT_EXAMEN)}</textarea></div>
    <div class="fGroup"><label>Diagnósticos</label><textarea id="occDiagnosticos" rows="2">${v('diagnosticos')}</textarea></div>
  </div>
  <div class="fRow three">
    <div class="fGroup"><label>Aptitud laboral</label><select id="occAptitud"><option ${aptSelected('Apto')}>Apto</option><option ${aptSelected('Apto con restricción')}>Apto con restricción</option><option ${aptSelected('No apto con restricción')}>No apto con restricción</option><option ${aptSelected('No apto')}>No apto</option></select></div>
    <div class="fGroup"><label>Ruffier reposo P0</label><input id="occRuffierReposo" value="${v('ruffierReposo')}" type="number" oninput="updateRuffier()" placeholder="Pulso en reposo" ${ruffierDisabled}></div>
    <div class="fGroup"><label>Ruffier esfuerzo P1</label><input id="occRuffierEsfuerzo" value="${v('ruffierEsfuerzo')}" type="number" oninput="updateRuffier()" placeholder="Pulso post-ejercicio" ${ruffierDisabled}></div>
  </div>
  <div class="fRow three">
    <div class="fGroup"><label>Ruffier recuperación P2</label><input id="occRuffierRecuperacion" value="${v('ruffierRecuperacion')}" type="number" oninput="updateRuffier()" placeholder="Pulso al minuto" ${ruffierDisabled}></div>
    <div class="fGroup"><label>Índice y clasificación Ruffier</label><input id="occRuffierResultado" value="${escapeHtml(ruffierDisplay)}" readonly><label style="display:flex;align-items:center;gap:.4rem;margin-top:.45rem;font-size:13px;color:#4d5b55"><input type="checkbox" id="occRuffierNoAplica" onchange="updateRuffierMode()" ${ruffierNoAplica ? 'checked' : ''}> NO APLICA</label></div>
    <div class="fGroup"><label>Tratamiento</label><input id="occTratamiento" value="${v('tratamiento')}"></div>
  </div>
  <div class="fRow">
    <div class="fGroup">
      <label>Doping</label>
      <select id="occDopingResultado" onchange="updateDopingOptions()">
        <option ${dopingSelected('Pendiente')}>Pendiente</option>
        <option ${dopingSelected('Negativo')}>Negativo</option>
        <option ${dopingSelected('Positivo')}>Positivo</option>
      </select>
    </div>
    <div class="fGroup" id="occDopingSustanciasBox" style="display:${selectedDoping === 'Positivo' ? 'block' : 'none'}">
      <label>Sustancias detectadas</label>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:.45rem;font-size:13px;color:#34423d">
        <label><input type="checkbox" name="occDopingSustancia" value="Marihuana (Cannabis)" ${dopingChecked('Marihuana (Cannabis)')}> Marihuana (Cannabis)</label>
        <label><input type="checkbox" name="occDopingSustancia" value="Cocaína" ${dopingChecked('Cocaína')}> Cocaína</label>
        <label><input type="checkbox" name="occDopingSustancia" value="Éxtasis (MDMA)" ${dopingChecked('Éxtasis (MDMA)')}> Éxtasis (MDMA)</label>
        <label><input type="checkbox" name="occDopingSustancia" value="Anfetaminas" ${dopingChecked('Anfetaminas')}> Anfetaminas</label>
        <label><input type="checkbox" name="occDopingSustancia" value="Benzodiacepinas" ${dopingChecked('Benzodiacepinas')}> Benzodiacepinas</label>
        <label><input type="checkbox" name="occDopingSustancia" value="Morfina / Opiáceos" ${dopingChecked('Morfina / Opiáceos')}> Morfina / Opiáceos</label>
      </div>
    </div>
    <div class="fGroup" id="occDopingFotoBox" style="display:${selectedDoping === 'Positivo' ? 'block' : 'none'}">
      <label>Foto del resultado positivo</label>
      <input type="file" id="occDopingFotos" accept="image/*" multiple onchange="previewOcupDopingFotos()">
      <div style="margin-top:.55rem;display:flex;gap:.5rem;flex-wrap:wrap"><button type="button" class="btn btn-sm btn-outline" onclick="connectOneDriveFolder()">Conectar carpeta local OneDrive</button></div>
      <div class="attachHint">La foto se copia en OneDrive local dentro de SALUD OCUPACIONAL / empresa / DOPING / planta / fecha.</div>
      <div id="occDopingFotosPreview" class="attachList">${dopingFotos.length ? renderDopingPhotoList(dopingFotos, isEdit) : '<div class="attachHint">Aun no ha seleccionado foto.</div>'}</div>
    </div>
  </div>
  <div style="display:flex;gap:.5rem;flex-wrap:wrap">
    <button class="btn btn-primary" onclick="guardarOcupacionalRegistro()">${isEdit ? 'Actualizar evaluación' : 'Guardar evaluación'}</button>
    ${isEdit ? '<button class="btn btn-outline" onclick="cancelarEdicionOcupacionalRegistro()">Cancelar edición</button>' : ''}
  </div>
</div>
<div class="card">
  <div class="cardTitle">Registros guardados (${records.length}${records.length !== allRecords.length ? ` de ${allRecords.length}` : ''})</div>
  <div class="fRow" style="margin-bottom:.8rem">
    <div class="fGroup"><label>Buscar por nombre</label><input id="occRegNombreSearch" value="${escapeHtml(nombreFilter)}" placeholder="Escriba el nombre del colaborador" oninput="updateOcupRegistrosFilter('nombre', this.value)"></div>
  </div>
  ${nombreFilter ? `<div style="display:flex;justify-content:flex-end;margin-bottom:.75rem"><button class="btn btn-sm btn-outline" onclick="clearOcupRegistrosFilters()">Limpiar búsqueda</button></div>` : ''}
  <table><thead><tr><th>Acción</th><th>Fecha</th><th>Planta</th><th>Expediente</th><th>Nombre</th><th>DPI</th><th>Puesto</th><th>Área</th><th>IMC</th><th>Ruffier</th><th>Aptitud</th><th>Doping</th></tr></thead>
  <tbody>${records.slice().reverse().map(r => `<tr><td style="white-space:nowrap"><button class="btn btn-sm btn-primary" onclick="editarOcupacionalRegistro('${r.id}')">Editar</button> <button class="btn btn-sm btn-outline" onclick="borrarOcupacionalRegistro('${r.id}')">Borrar</button></td><td>${fmtF(r.fechaEvaluacion)}</td><td>${escapeHtml(r.planta)}</td><td>${escapeHtml(r.expediente)}</td><td>${escapeHtml(r.nombre)}</td><td>${escapeHtml(r.dpi||'—')}</td><td>${escapeHtml(r.puesto||'—')}</td><td>${escapeHtml(r.area||'—')}</td><td>${escapeHtml(r.imc||'—')}</td><td>${r.ruffierNoAplica || r.ruffierClasificacion === 'NO APLICA' ? 'NO APLICA' : (r.ruffierIndice ? `${escapeHtml(r.ruffierIndice)} · ${escapeHtml(r.ruffierClasificacion)}` : '—')}</td><td><span class="badge ${occAptClass(r.aptitudLaboral)}">${escapeHtml(r.aptitudLaboral)}</span></td><td>${escapeHtml(r.dopingResultado || 'Pendiente')}${r.dopingResultado === 'Positivo' && Array.isArray(r.dopingSustancias) && r.dopingSustancias.length ? `<br><small>${escapeHtml(r.dopingSustancias.join(', '))}</small>` : ''}${r.dopingResultado === 'Positivo' ? `<div style="margin-top:.35rem">${dopingPhotoPreview(r.dopingFotos)}</div>` : ''}</td></tr>`).join('') || '<tr><td colspan="12" style="text-align:center;color:#aaa;padding:1rem">No hay registros con esos filtros.</td></tr>'}</tbody></table>
</div>`);
  setTimeout(() => {
    updateOccImc();
    updateRuffierMode();
    updateDopingOptions();
  }, 0);
}
async function guardarOcupacionalRegistro() {
  const planta = document.getElementById('occPlanta').value;
  const fecha = document.getElementById('occFecha').value;
  const nombre = document.getElementById('occNombre').value.trim();
  if (!fecha || !nombre) { alert('Ingrese fecha de evaluación y nombre completo.'); return; }
  const records = occData().registros;
  const requestedId = editingOcupRegistroId || '';
  const provisionalId = requestedId || occData().nextRegistroId;
  const empresaPrefix = String(occData().activeEmpresa || 'EMOP').replace(/[^a-z0-9]/gi,'').slice(0,3).toUpperCase() || 'EMO';
  const expediente = document.getElementById('occExpediente').value.trim() || `${empresaPrefix}-${planta.replace(/\s+/g,'').slice(0,3)}-${new Date(fecha).getFullYear()}-${String(provisionalId).padStart(4,'0')}`;
  const searchCandidate = {
    id:requestedId,
    expediente,
    planta,
    fechaEvaluacion:fecha,
    dpi:document.getElementById('occDpi').value.trim(),
    nombre
  };
  const editIndex = findOcupRegistroIndex(records, searchCandidate);
  const isEdit = editIndex >= 0;
  const id = isEdit ? records[editIndex].id : provisionalId;
  const baseRegistro = isEdit ? records[editIndex] : {};
  const ruffierNoAplica = document.getElementById('occRuffierNoAplica')?.checked || false;
  const idx = ruffierNoAplica ? '' : ruffierIndex(document.getElementById('occRuffierReposo').value, document.getElementById('occRuffierEsfuerzo').value, document.getElementById('occRuffierRecuperacion').value);
  const dopingResultado = document.getElementById('occDopingResultado')?.value || 'Pendiente';
  const dopingSustancias = dopingResultado === 'Positivo'
    ? Array.from(document.querySelectorAll('input[name="occDopingSustancia"]:checked')).map(input => input.value)
    : [];
  const nowIso = new Date().toISOString();
  const formRegistro = {
    id, expediente, planta, fechaEvaluacion:fecha, nombre,
    dpi:document.getElementById('occDpi').value.trim(),
    puesto:document.getElementById('occPuesto').value.trim(),
    area:document.getElementById('occArea').value.trim(),
    edad:document.getElementById('occEdad').value,
    pa:document.getElementById('occPa').value, fc:document.getElementById('occFc').value, fr:document.getElementById('occFr').value,
    temp:document.getElementById('occTemp').value, spo2:document.getElementById('occSpo2').value, gmt:document.getElementById('occGmt').value,
    peso:document.getElementById('occPeso').value, altura:document.getElementById('occAltura').value, imc:document.getElementById('occImc').value,
    motivoConsulta:document.getElementById('occMotivo').value, historiaActual:document.getElementById('occHistoria').value,
    antecedentesFamiliares:document.getElementById('occAntecedentesFamiliares').value,
    antecedentesMedicos:document.getElementById('occAntecedentesMedicos').value,
    antecedentesAlergicos:document.getElementById('occAntecedentesAlergicos').value,
    antecedentesQuirurgicos:document.getElementById('occAntecedentesQuirurgicos').value,
    examenFisico:document.getElementById('occExamen').value, diagnosticos:document.getElementById('occDiagnosticos').value,
    aptitudLaboral:document.getElementById('occAptitud').value,
    ruffierReposo:document.getElementById('occRuffierReposo').value,
    ruffierEsfuerzo:document.getElementById('occRuffierEsfuerzo').value,
    ruffierRecuperacion:document.getElementById('occRuffierRecuperacion').value,
    ruffierNoAplica,
    ruffierIndice:idx,
    ruffierClasificacion:ruffierNoAplica ? 'NO APLICA' : ruffierClass(idx),
    tratamiento:document.getElementById('occTratamiento').value,
    dopingResultado,
    dopingSustancias,
    syncKey:occRecordKey({ expediente, planta, fechaEvaluacion:fecha, dpi:document.getElementById('occDpi').value.trim(), nombre }),
    createdAt:isEdit ? (records[editIndex].createdAt || nowIso) : nowIso,
    updatedAt:nowIso
  };
  const previousDopingFotos = isEdit && Array.isArray(records[editIndex].dopingFotos) ? records[editIndex].dopingFotos : [];
  formRegistro.dopingFotos = dopingResultado === 'Positivo'
    ? await uploadOcupDopingFotos(formRegistro, previousDopingFotos)
    : [];
  const registro = isEdit ? mergeOcupRegistro(baseRegistro, formRegistro, true) : formRegistro;
  if (isEdit) records[editIndex] = registro;
  else {
    records.push(registro);
    const numericId = Number(id);
    if (Number.isFinite(numericId)) occData().nextRegistroId = Math.max(occData().nextRegistroId, numericId + 1);
  }
  dedupeOcupRegistros(records);
  editingOcupRegistroId = null;
  normalizeStateCounters();
  await saveAppData({ backupToFolder:true });
  await saveOccupationalStateToCloud(true);
  showToast(isEdit ? 'Evaluación ocupacional actualizada.' : 'Evaluación ocupacional guardada.');
  renderOcupRegistros();
}
function editarOcupacionalRegistro(id) {
  editingOcupRegistroId = id;
  renderOcupRegistros();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function cancelarEdicionOcupacionalRegistro() {
  editingOcupRegistroId = null;
  renderOcupRegistros();
}
async function borrarOcupacionalRegistro(id) {
  const records = occData().registros;
  const index = records.findIndex(r => String(r.id) === String(id));
  const registro = records[index];
  if (!registro) return;
  if (!confirm(`¿Desea borrar el registro EMOP de ${registro.nombre} del ${fmtF(registro.fechaEvaluacion)}?`)) return;
  records.splice(index, 1);
  if (String(editingOcupRegistroId) === String(id)) editingOcupRegistroId = null;
  normalizeStateCounters();
  await saveAppData({ backupToFolder:true });
  await saveOccupationalStateToCloud(true);
  renderOcupRegistros();
}
function renderOcupEscaneres() {
  const plantFilter = document.getElementById('occScanPlantFilter')?.value || 'TODAS';
  const dateFilter = document.getElementById('occScanDateFilter')?.value || '';
  const scans = occData().scans.filter(s => (!plantFilter || plantFilter === 'TODAS' || s.planta === plantFilter) && (!dateFilter || s.fecha === dateFilter));
  const editing = occData().scans.find(s => String(s.id) === String(editingOcupScanId));
  const isEdit = !!editing;
  const scanPlant = editing?.planta || 'MIXCO';
  const scanFecha = editing?.fecha || new Date().toISOString().slice(0,10);
  const scanTipo = editing?.tipo || 'Aptitud laboral firmada';
  const scanUrl = editing?.url || '';
  const scanDirectStatus = editing?.firestoreFile?.chunkCount ? `Descarga directa lista (${editing.firestoreFile.chunkCount} parte(s), ${formatFileSize(editing.firestoreFile.size)})` : (editing?.url ? 'Abre por enlace directo de OneDrive' : 'Sin descarga directa');
  const scanTipoSelected = value => scanTipo === value ? 'selected' : '';
  setC(`
${occHeader('Escáneres - Aptitudes y consentimientos', 'Índice de archivos firmados por planta y fecha.')}
${isOcupViewer() ? '' : `<div class="card">
  <div class="cardTitle">${isEdit ? 'Editar escáner' : 'Subir escáneres'}</div>
  <div class="fRow three">
    <div class="fGroup"><label>Planta</label><select id="occScanPlanta">${occPlantsOptions(scanPlant)}</select></div>
    <div class="fGroup"><label>Fecha de jornada</label><input type="date" id="occScanFecha" value="${scanFecha}"></div>
    <div class="fGroup"><label>Tipo</label><select id="occScanTipo"><option ${scanTipoSelected('Aptitud laboral firmada')}>Aptitud laboral firmada</option><option ${scanTipoSelected('Consentimiento informado')}>Consentimiento informado</option><option ${scanTipoSelected('Paquete aptitud + consentimiento')}>Paquete aptitud + consentimiento</option><option ${scanTipoSelected('Otro')}>Otro</option></select></div>
  </div>
  ${isEdit ? `<div class="fGroup"><label>Nombre del archivo</label><input id="occScanNombreArchivo" value="${escapeHtml(editing.nombreArchivo || '')}"></div>` : '<div class="scanDrop"><input type="file" id="occScanFiles" multiple accept=".pdf,image/*,.jpg,.jpeg,.png"></div>'}
  <div class="fGroup">
    <label>Enlace directo de OneDrive</label>
    <input id="occScanUrl" type="url" value="${escapeHtml(scanUrl)}" placeholder="Pegue aqui el enlace compartido del archivo">
    <div class="attachHint">Opcional. Permite abrir o descargar este escaner directo desde dashboard, registros y el usuario del ingeniero. Si sube varios archivos, agregue este enlace editando cada archivo despues.</div>
  </div>
  ${isEdit ? `<div class="scanDrop">
    <input type="file" id="occScanDirectFile" accept=".pdf,image/*,.jpg,.jpeg,.png">
    <div class="attachHint">Estado: ${escapeHtml(scanDirectStatus)}. Para que descargue directo como doping, seleccione aqui el PDF o imagen original y luego pulse Actualizar escáner.</div>
  </div>` : '<div class="attachHint">Los archivos de hasta 35 MB se preparan para descarga directa desde Firebase. Para archivos mayores, use enlace directo de OneDrive.</div>'}
  <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.75rem">
    <button class="btn btn-primary" id="btnGuardarOcupScan" onclick="guardarOcupacionalEscaneres()">${isEdit ? 'Actualizar escáner' : 'Guardar escáneres'}</button>
    ${isEdit ? '<button class="btn btn-outline" onclick="cancelarEdicionOcupacionalScan()">Cancelar edición</button>' : ''}
    <button class="btn btn-outline" onclick="connectOneDriveFolder()">Conectar carpeta local OneDrive</button>
  </div>
  <div id="occScanSaveStatus"></div>
  <p style="font-size:12px;color:#888;margin-top:.75rem">${isEdit ? 'La edición actualiza el índice del sistema. El archivo físico en OneDrive permanece igual.' : `Si la carpeta local de OneDrive está conectada, los archivos se copian a SALUD OCUPACIONAL / ${occData().activeEmpresa} / PLANTA / FECHA.`}</p>
</div>`}
<div class="card">
  <div class="cardTitle">Filtros</div>
  <div class="fRow">
    <div class="fGroup"><label>Planta</label><select id="occScanPlantFilter" onchange="renderOcupEscaneres()"><option value="TODAS">Todas</option>${occPlantsOptions(plantFilter)}</select></div>
    <div class="fGroup"><label>Fecha</label><input type="date" id="occScanDateFilter" value="${dateFilter}" onchange="renderOcupEscaneres()"></div>
  </div>
</div>
<div class="card">
  <div class="cardTitle">Archivos indexados (${scans.length})</div>
  <table><thead><tr>${isOcupViewer() ? '' : '<th>Acción</th>'}<th>Fecha</th><th>Planta</th><th>Tipo</th><th>Archivo</th><th>Tamaño</th><th>Estado</th><th>Descargar</th></tr></thead>
  <tbody>${scans.slice().reverse().map(s => `<tr>${isOcupViewer() ? '' : `<td style="white-space:nowrap"><button class="btn btn-sm btn-primary" onclick="editarOcupacionalScan('${s.id}')">Editar</button> <button class="btn btn-sm btn-outline" onclick="borrarOcupacionalScan('${s.id}')">Borrar</button></td>`}<td>${fmtF(s.fecha)}</td><td>${s.planta}</td><td>${s.tipo}</td><td>${s.nombreArchivo}</td><td>${s.tamano || '—'}</td><td>${scanStorageBadge(s)}</td><td>${scanDownloadButton(s)}</td></tr>`).join('') || `<tr><td colspan="${isOcupViewer() ? '7' : '8'}" style="text-align:center;color:#aaa;padding:1rem">No hay escáneres con estos filtros.</td></tr>`}</tbody></table>
  <div style="margin-top:.75rem"><button class="btn btn-outline" onclick="openOccupationalScansFolder()">Abrir carpeta OneDrive compartida</button></div>
</div>`);
}
async function guardarOcupacionalEscaneres() {
  const saveButton = document.getElementById('btnGuardarOcupScan');
  if (saveButton?.dataset.saving === '1') return;
  if (saveButton) {
    saveButton.dataset.saving = '1';
    saveButton.disabled = true;
    saveButton.textContent = 'Procesando...';
  }
  setOccScanSaveStatus('Preparando guardado...', 2);
  await nextPaint();
  const planta = document.getElementById('occScanPlanta').value;
  const fecha = document.getElementById('occScanFecha').value;
  const tipo = document.getElementById('occScanTipo').value;
  const scanUrl = document.getElementById('occScanUrl')?.value.trim() || '';
  try {
    if (editingOcupScanId) {
      const scan = occData().scans.find(s => String(s.id) === String(editingOcupScanId));
      if (!scan) {
        alert('No se encontró el escáner que estaba editando. Recargue la página e intente de nuevo.');
        return;
      }
      const directFile = Array.from(document.getElementById('occScanDirectFile')?.files || [])[0] || null;
      scan.planta = planta;
      scan.fecha = fecha;
      scan.tipo = tipo;
      scan.nombreArchivo = document.getElementById('occScanNombreArchivo')?.value.trim() || scan.nombreArchivo;
      scan.url = scanUrl;
      if (directFile) {
        const newFirestoreFile = await uploadOcupScanFileToFirestore(scan, directFile, setOccScanSaveStatus);
        if (newFirestoreFile) {
          scan.firestoreFile = newFirestoreFile;
          scan.nombreArchivo = document.getElementById('occScanNombreArchivo')?.value.trim() || directFile.name;
          scan.tamano = formatFileSize(directFile.size);
          scan.dataUrl = '';
          if (String(directFile.type || '').startsWith('image/')) {
            try { scan.dataUrl = await compressImageFile(directFile); }
            catch (e) { console.warn('No se pudo crear miniatura del escaner.', e); }
          }
        }
      }
      scan.updatedAt = new Date().toISOString();
      editingOcupScanId = null;
      normalizeStateCounters();
      setOccScanSaveStatus('Sincronizando índice con Firebase...', 98);
      await saveAppData({ backupToFolder:true });
      await saveOccupationalStateToCloud(true);
      setOccScanSaveStatus('Escáner actualizado correctamente.', 100);
      showToast('Escáner actualizado.');
      renderOcupEscaneres();
      return;
    }
    const files = Array.from(document.getElementById('occScanFiles').files || []);
    if (!files.length) { alert('Seleccione uno o más archivos escaneados.'); return; }
    let synced = 0;
    let directReady = 0;
    for (const file of files) {
      const scan = {
        id:occData().nextScanId++, planta, fecha, tipo,
        nombreArchivo:file.name,
        tamano:formatFileSize(file.size),
        url:files.length === 1 ? scanUrl : '',
        dataUrl:'',
        firestoreFile:null,
        sincronizado:false,
        createdAt:new Date().toISOString()
      };
      if (String(file.type || '').startsWith('image/')) {
        try { scan.dataUrl = await compressImageFile(file); }
        catch (e) { console.warn('No se pudo crear miniatura del escaner.', e); }
      }
      if (oneDriveDirHandle) {
        setOccScanSaveStatus(`Copiando ${file.name} a OneDrive local...`, 5);
        await nextPaint();
        scan.sincronizado = await writeOccupationalScanToOneDrive(scan, file);
        if (scan.sincronizado) synced++;
      }
      try {
        scan.firestoreFile = await uploadOcupScanFileToFirestore(scan, file, setOccScanSaveStatus);
        if (scan.firestoreFile?.chunkCount) directReady++;
      } catch (e) {
        console.warn('No se pudo preparar descarga directa del escaner.', e);
        alert(`No se pudo preparar descarga directa para ${file.name}: ${e.message || 'error desconocido'}.`);
      }
      occData().scans.push(scan);
    }
    normalizeStateCounters();
    setOccScanSaveStatus('Sincronizando índice con Firebase...', 98);
    await saveAppData({ backupToFolder:true });
    await saveOccupationalStateToCloud(true);
    const multiLinkNotice = scanUrl && files.length > 1 ? ' El enlace directo no se asignó porque subió varios archivos; edite cada escáner para pegar su enlace individual.' : '';
    setOccScanSaveStatus('Escáneres guardados correctamente.', 100);
    showToast((oneDriveDirHandle ? `Escáneres guardados. ${synced}/${files.length} copiado(s) a la carpeta local de OneDrive.` : 'Escáneres indexados. Conecte carpeta local de OneDrive para copiar archivos automáticamente.') + ` Descarga directa lista: ${directReady}/${files.length}.` + multiLinkNotice);
    renderOcupEscaneres();
  } catch (e) {
    console.warn('No se pudo guardar el escáner.', e);
    setOccScanSaveStatus(`Error: ${e.message || 'no se pudo guardar el escáner.'}`, null);
    alert(`No se pudo guardar el escáner: ${e.message || 'error desconocido'}.`);
  } finally {
    if (saveButton) {
      saveButton.dataset.saving = '0';
      saveButton.disabled = false;
      saveButton.textContent = editingOcupScanId ? 'Actualizar escáner' : 'Guardar escáneres';
    }
  }
}
function editarOcupacionalScan(id) {
  editingOcupScanId = id;
  renderOcupEscaneres();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function cancelarEdicionOcupacionalScan() {
  editingOcupScanId = null;
  renderOcupEscaneres();
}
async function borrarOcupacionalScan(id) {
  const scans = occData().scans;
  const index = scans.findIndex(s => String(s.id) === String(id));
  const scan = scans[index];
  if (!scan) return;
  if (!confirm(`¿Desea borrar del índice el escáner ${scan.nombreArchivo || 'seleccionado'}? El archivo físico en OneDrive no se eliminará automáticamente.`)) return;
  try {
    await deleteOcupScanFileFromFirestore(scan);
  } catch (e) {
    console.warn('No se pudo borrar la copia directa del escaner.', e);
  }
  scans.splice(index, 1);
  if (String(editingOcupScanId) === String(id)) editingOcupScanId = null;
  normalizeStateCounters();
  await saveAppData({ backupToFolder:true });
  await saveOccupationalStateToCloud(true);
  renderOcupEscaneres();
}
function renderOcupPlantas() {
  const rows = occData().plantas.map(p => {
    const records = occFilteredRecords(p, '');
    const scans = occData().scans.filter(s => s.planta === p);
    const dates = [...new Set(records.map(r => r.fechaEvaluacion).concat(scans.map(s => s.fecha)).filter(Boolean))].sort();
    return `<div class="occPlantCard">
      <strong>${p}</strong>
      <div class="occMetricRow">
        <div class="occMetric"><span>Evaluaciones</span>${records.length}</div>
        <div class="occMetric"><span>Escáneres</span>${scans.length}</div>
        <div class="occMetric"><span>Fechas</span>${dates.length || 0}</div>
      </div>
      <div style="font-size:12px;color:#777;margin-top:.75rem">${dates.length ? dates.map(fmtF).join(', ') : 'Sin jornadas registradas.'}</div>
    </div>`;
  }).join('');
  setC(`${occHeader(`Plantas ${occData().activeEmpresa}`, (occData().plantas || []).join(', '))}<div class="occPlantGrid">${rows}</div>`);
}

function renderPlanesSSO() {
  const planes = state.planesSSO || [];
  setC(`
${occHeader('Planes de SSO', 'Archivo y respaldo de planes de salud y seguridad ocupacional firmados.')}
<div class="card">
  <div class="cardTitle">Subir plan firmado</div>
  <div class="fRow">
    <div class="fGroup"><label>Empresa</label><input id="planEmpresa" value="${occData().activeEmpresa || ''}"></div>
    <div class="fGroup"><label>Fecha</label><input id="planFecha" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
  </div>
  <div class="scanDrop"><input type="file" id="planSSOFiles" multiple accept=".pdf,.doc,.docx,image/*,.jpg,.jpeg,.png"></div>
  <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.75rem">
    <button class="btn btn-primary" onclick="guardarPlanesSSO()">Guardar planes SSO</button>
    <button class="btn btn-outline" onclick="connectOneDriveFolder()">Conectar carpeta local OneDrive</button>
  </div>
</div>
<div class="card">
  <div class="cardTitle">Planes respaldados (${planes.length})</div>
  <table><thead><tr><th>Fecha</th><th>Empresa</th><th>Archivo</th><th>Tamaño</th><th>Estado</th></tr></thead>
  <tbody>${planes.slice().reverse().map(p => `<tr><td>${fmtF(p.fecha)}</td><td>${p.empresa}</td><td>${p.nombreArchivo}</td><td>${p.tamano}</td><td><span class="badge ${p.sincronizado?'badge-green':'badge-warn'}">${p.sincronizado?'Guardado en OneDrive local':'Solo índice'}</span></td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:1rem">Aún no hay planes de SSO registrados.</td></tr>'}</tbody></table>
  <div style="margin-top:.75rem"><button class="btn btn-outline" onclick="openOneDriveWebFolder()">Abrir respaldo OneDrive</button></div>
</div>`);
}

async function guardarPlanesSSO() {
  const files = Array.from(document.getElementById('planSSOFiles').files || []);
  if (!files.length) { alert('Seleccione uno o más planes firmados.'); return; }
  const empresa = document.getElementById('planEmpresa').value.trim() || occData().activeEmpresa || 'GENERAL';
  const fecha = document.getElementById('planFecha').value;
  let synced = 0;
  for (const file of files) {
    const plan = { id:state.nextPlanSSOId++, empresa, fecha, nombreArchivo:file.name, tamano:`${Math.round(file.size/1024)} KB`, sincronizado:false, createdAt:new Date().toISOString() };
    if (oneDriveDirHandle) {
      plan.sincronizado = await writePlanSSOToOneDrive(plan, file);
      if (plan.sincronizado) synced++;
    }
    state.planesSSO.push(plan);
  }
  normalizeStateCounters();
  await saveAppData({ backupToFolder:true });
  showToast(oneDriveDirHandle ? `Planes guardados. ${synced}/${files.length} copiado(s) a OneDrive local.` : 'Planes indexados. Conecte carpeta local de OneDrive para copiarlos automáticamente.');
  renderPlanesSSO();
}

async function walkDirectoryFiles(dirHandle, base = '') {
  const out = [];
  for await (const [name, handle] of dirHandle.entries()) {
    const rel = base ? `${base}/${name}` : name;
    if (handle.kind === 'file') {
      const file = await handle.getFile();
      out.push({ nombreArchivo:name, ruta:rel, tamano:`${Math.round(file.size/1024)} KB`, modifiedAt:file.lastModified ? new Date(file.lastModified).toISOString() : '' });
    } else if (handle.kind === 'directory') {
      out.push(...await walkDirectoryFiles(handle, rel));
    }
  }
  return out;
}

async function indexarCarpetaOcupacional() {
  if (!window.showDirectoryPicker) {
    alert('Este navegador no permite seleccionar carpetas. Use Edge o Chrome actualizado.');
    return;
  }
  try {
    const handle = await window.showDirectoryPicker({ mode:'read' });
    const files = await walkDirectoryFiles(handle);
    const allowed = files.filter(f => /\.(docx?|xlsx?|pdf|png|jpe?g)$/i.test(f.nombreArchivo));
    activeOccCompany().fileIndex = allowed.map((f, idx) => ({ id:idx+1, ...f, indexedAt:new Date().toISOString() }));
    saveAppData({ backupToFolder:true });
    showToast(`Índice creado: ${allowed.length} archivo(s) de Word, Excel, PDF o imagen.`);
    renderOcupDashboard();
  } catch (e) {
    if (e.name !== 'AbortError') alert('No se pudo indexar la carpeta seleccionada.');
  }
}

function renderRespaldos() {
  setC(`
<div class="card">
  <div class="cardTitle">💾 Respaldo de datos</div>
  <p style="font-size:13px;color:#666;line-height:1.6;margin-bottom:1rem">
    Los datos se guardan automaticamente en este navegador. Para respaldo automático en OneDrive desde esta PC, seleccione una vez la carpeta local sincronizada con OneDrive usando "Conectar carpeta local".
  </p>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.75rem">
    <button class="btn btn-primary" onclick="downloadBackup()">Descargar respaldo JSON</button>
    <button class="btn btn-primary" onclick="writeReadableClinicalBackup(true)">Guardar respaldo legible por paciente</button>
    <button class="btn btn-primary" onclick="writeReadableOccupationalBackup(true)">Guardar respaldo Salud Ocupacional</button>
    <button class="btn btn-outline" onclick="openOneDriveWebFolder()">Abrir carpeta OneDrive</button>
    <label class="btn btn-outline" style="justify-content:center;cursor:pointer">
      Importar respaldo
      <input type="file" accept="application/json,.json" onchange="importBackup(this)" style="display:none">
    </label>
    <button class="btn btn-outline" onclick="connectOneDriveFolder()">Conectar carpeta local</button>
  </div>
  <div style="font-size:12px;color:#888;line-height:1.6;margin-top:1rem">
    Nota: si selecciona una carpeta dentro de OneDrive en Windows, la app escribira automaticamente el archivo clinica-dr-allan-leal-respaldo.json y OneDrive lo sincronizara. El enlace web solo abre la carpeta en linea; escribir directamente a ese link requiere una integracion avanzada con Microsoft Graph.
  </div>
</div>
<div class="card">
  <div class="cardTitle">Resumen incluido en el respaldo</div>
  <div class="statGrid">
    <div class="statBox"><div class="statNum">${state.pacientes.length}</div><div class="statLbl">Pacientes</div></div>
    <div class="statBox"><div class="statNum">${state.historias.length}</div><div class="statLbl">Historias</div></div>
    <div class="statBox"><div class="statNum">${state.citas.length}</div><div class="statLbl">Citas</div></div>
  </div>
</div>`);
}
