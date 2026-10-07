function downloadBackup() {
  const blob = new Blob([JSON.stringify(backupPayload(), null, 2)], { type:'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `clinica-dr-allan-leal-respaldo-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

function openOneDriveWebFolder() {
  window.open(ONEDRIVE_WEB_FOLDER_URL, '_blank', 'noopener');
}

function openTropigasOneDriveFolder() {
  window.open(occupationalOneDriveUrl(), '_blank', 'noopener');
}

function occupationalOneDriveUrl() {
  const company = activeOccCompany();
  return company?.oneDriveUrl || (company?.nombre === 'TROPIGAS' ? TROPIGAS_ONEDRIVE_URL : ONEDRIVE_WEB_FOLDER_URL);
}

function openOccupationalScansFolder() {
  window.open(occupationalOneDriveUrl(), '_blank', 'noopener');
}

function openHandleDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error('IndexedDB no disponible'));
    const request = indexedDB.open(ONEDRIVE_HANDLE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(ONEDRIVE_HANDLE_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveDirectoryHandle(handle) {
  const db = await openHandleDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ONEDRIVE_HANDLE_STORE, 'readwrite');
    tx.objectStore(ONEDRIVE_HANDLE_STORE).put(handle, ONEDRIVE_HANDLE_KEY);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function loadDirectoryHandle() {
  const db = await openHandleDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ONEDRIVE_HANDLE_STORE, 'readonly');
    const request = tx.objectStore(ONEDRIVE_HANDLE_STORE).get(ONEDRIVE_HANDLE_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function hasWritePermission(handle, requestPermission = false) {
  const options = { mode:'readwrite' };
  if (!handle.queryPermission || !handle.requestPermission) return true;
  if (await handle.queryPermission(options) === 'granted') return true;
  return requestPermission && await handle.requestPermission(options) === 'granted';
}

async function restoreOneDriveFolderConnection(requestPermission = false) {
  if (!window.showDirectoryPicker) return false;
  try {
    const handle = await loadDirectoryHandle();
    if (!handle) return false;
    if (!await hasWritePermission(handle, requestPermission)) return false;
    oneDriveDirHandle = handle;
    return true;
  } catch (e) {
    return false;
  }
}

async function connectOneDriveFolder() {
  if (!window.showDirectoryPicker) {
    alert('Este navegador no permite guardar directamente en una carpeta. Use "Descargar respaldo" y luego abra la carpeta OneDrive para subir o mover el archivo.');
    return;
  }
  try {
    oneDriveDirHandle = await window.showDirectoryPicker({ mode:'readwrite' });
    if (!await hasWritePermission(oneDriveDirHandle, true)) {
      alert('No se otorgó permiso para escribir en la carpeta seleccionada.');
      return;
    }
    await saveDirectoryHandle(oneDriveDirHandle);
    await writeOneDriveBackup(true);
  } catch (e) {
    if (e.name !== 'AbortError') alert('No se pudo conectar la carpeta seleccionada.');
  }
}

async function writeOneDriveBackup(showAlert = true) {
  if (!oneDriveDirHandle) return false;
  try {
    const fileHandle = await oneDriveDirHandle.getFileHandle('clinica-dr-allan-leal-respaldo.json', { create:true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(backupPayload(), null, 2));
    await writable.close();
    await writeReadableClinicalBackup(false);
    await writeReadableOccupationalBackup(false);
    if (showAlert) showToast('Respaldo guardado en la carpeta seleccionada. Incluye el archivo técnico JSON, carpetas legibles por paciente y backups anuales de Salud Ocupacional.');
    return true;
  } catch (e) {
    console.warn('No se pudo escribir el respaldo.', e);
    if (showAlert) alert('No se pudo escribir el respaldo en la carpeta seleccionada.');
    return false;
  }
}

function safePathName(value) {
  return String(value || 'SIN_DATO')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90) || 'SIN_DATO';
}

async function getOrCreateSubdir(parentHandle, name) {
  return parentHandle.getDirectoryHandle(safePathName(name), { create:true });
}

async function writeFileToHandle(directoryHandle, file, outputName) {
  const fileHandle = await directoryHandle.getFileHandle(safePathName(outputName || file.name), { create:true });
  const writable = await fileHandle.createWritable();
  await writable.write(file);
  await writable.close();
}

async function writeTextToHandle(directoryHandle, fileName, text, type = 'text/html;charset=utf-8') {
  const fileHandle = await directoryHandle.getFileHandle(safePathName(fileName), { create:true });
  const writable = await fileHandle.createWritable();
  await writable.write(new Blob([text], { type }));
  await writable.close();
}

async function writeHistoriaAttachmentToOneDrive(historia, paciente, file, outputName) {
  if (!oneDriveDirHandle) return false;
  try {
    const root = await getOrCreateSubdir(oneDriveDirHandle, 'CLINICA PROPIA');
    const pacientesDir = await getOrCreateSubdir(root, 'PACIENTES');
    const pacDir = await getOrCreateSubdir(pacientesDir, `${patientCode(paciente)} - ${paciente.nombre || 'Paciente'}`);
    const historiasDir = await getOrCreateSubdir(pacDir, 'HISTORIAS CLINICAS');
    const fechaDir = await getOrCreateSubdir(historiasDir, historia.fecha || 'SIN FECHA');
    const labsDir = await getOrCreateSubdir(fechaDir, 'LABORATORIOS Y ESTUDIOS');
    await writeFileToHandle(labsDir, file, outputName || file.name);
    return true;
  } catch (e) {
    console.warn('No se pudo guardar el adjunto de historia en OneDrive.', e);
    return false;
  }
}

async function writeOccupationalScanToOneDrive(scan, file) {
  if (!oneDriveDirHandle) return false;
  try {
    const root = await getOrCreateSubdir(oneDriveDirHandle, 'SALUD OCUPACIONAL');
    const empresa = await getOrCreateSubdir(root, occData().activeEmpresa || 'TROPIGAS');
    const planta = await getOrCreateSubdir(empresa, scan.planta);
    const fecha = await getOrCreateSubdir(planta, scan.fecha || 'SIN FECHA');
    const escaneos = await getOrCreateSubdir(fecha, 'CONSENTIMIENTOS INFORMADOS Y APTITUDES LABORALES');
    await writeFileToHandle(escaneos, file, scan.nombreArchivo);
    return true;
  } catch (e) {
    console.warn('No se pudo guardar el escáner en OneDrive.', e);
    return false;
  }
}

async function writeOcupDopingPhotoToOneDrive(registro, file, outputName) {
  if (!oneDriveDirHandle) return false;
  try {
    const root = await getOrCreateSubdir(oneDriveDirHandle, 'SALUD OCUPACIONAL');
    const empresa = await getOrCreateSubdir(root, occData().activeEmpresa || 'TROPIGAS');
    const doping = await getOrCreateSubdir(empresa, 'DOPING');
    const planta = await getOrCreateSubdir(doping, registro.planta || 'SIN PLANTA');
    const fecha = await getOrCreateSubdir(planta, registro.fechaEvaluacion || 'SIN FECHA');
    const paciente = await getOrCreateSubdir(fecha, `${registro.expediente || 'SIN EXPEDIENTE'} - ${registro.nombre || 'SIN NOMBRE'}`);
    await writeFileToHandle(paciente, file, outputName || file.name);
    return true;
  } catch (e) {
    console.warn('No se pudo guardar la foto de doping en OneDrive.', e);
    return false;
  }
}

async function writePlanSSOToOneDrive(plan, file) {
  if (!oneDriveDirHandle) return false;
  try {
    const root = await getOrCreateSubdir(oneDriveDirHandle, 'SALUD OCUPACIONAL');
    const planes = await getOrCreateSubdir(root, 'PLANES DE SSO');
    const empresa = await getOrCreateSubdir(planes, plan.empresa || 'GENERAL');
    await writeFileToHandle(empresa, file, plan.nombreArchivo);
    return true;
  } catch (e) {
    console.warn('No se pudo guardar el plan SSO en OneDrive.', e);
    return false;
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function patientCode(p) {
  if (!p.codigo) p.codigo = String(Number(p.id) || state.pacientes.indexOf(p) + 1).padStart(6, '0');
  return p.codigo;
}

function clinicImcValue(peso, altura) {
  const p = parseFloat(String(peso || '').replace(',', '.'));
  let a = parseFloat(String(altura || '').replace(',', '.'));
  if (!p || !a) return '';
  if (a > 3) a = a / 100;
  return (p / (a * a)).toFixed(1);
}

function imcClass(value) {
  const n = parseFloat(value);
  if (!n) return '';
  if (n < 16) return 'Infrapeso - delgadez severa';
  if (n < 17) return 'Infrapeso - delgadez moderada';
  if (n < 18.5) return 'Infrapeso - delgadez leve';
  if (n < 25) return 'Normal';
  if (n < 30) return 'Sobrepeso';
  if (n < 35) return 'Obesidad grado I';
  if (n < 40) return 'Obesidad grado II';
  return 'Obesidad grado III (mórbida)';
}

function updateClinicImc() {
  const imc = clinicImcValue(document.getElementById('hPesoKg')?.value, document.getElementById('hAltura')?.value);
  const out = document.getElementById('hIMC');
  if (out) out.value = imc ? `${imc} - ${imcClass(imc)}` : '';
}

const CLINIC_DEFAULT_EXAMEN_FISICO = `Estado general: Paciente consciente, orientado en tiempo, espacio y persona (COTEP), alerta, colaborador, afebril, hidratado, eupneico en reposo, con buen estado general y adecuada facies.
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

async function writeReadableClinicalBackup(showAlert = false) {
  if (!oneDriveDirHandle) {
    if (showAlert) alert('Primero conecte la carpeta local de OneDrive.');
    return false;
  }
  try {
    const root = await getOrCreateSubdir(oneDriveDirHandle, 'CLINICA PROPIA');
    const pacientesDir = await getOrCreateSubdir(root, 'PACIENTES');
    const indexRows = [];
    for (const p of state.pacientes) {
      const code = patientCode(p);
      const dir = await getOrCreateSubdir(pacientesDir, `${code} - ${p.nombre || 'Paciente'}`);
      const hists = state.historias.filter(h => String(h.pacienteId) === String(p.id));
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(code)} ${escapeHtml(p.nombre)}</title><style>body{font-family:Arial,sans-serif;line-height:1.5;color:#17211d;margin:28px}h1{color:#124734}.box{border:1px solid #ddd;border-radius:8px;padding:14px;margin:12px 0}small{color:#666}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:7px;text-align:left}</style></head><body>
      <h1>${escapeHtml(p.nombre)}</h1><small>Código ${escapeHtml(code)} · Documento ${escapeHtml(p.doc || '')}</small>
      <div class="box"><strong>Información general</strong><br>Teléfono: ${escapeHtml(p.tel || '')}<br>Email: ${escapeHtml(p.email || '')}<br>Nacimiento: ${escapeHtml(fmtF(p.nac))}<br>Sexo: ${escapeHtml(p.sexo || '')}<br>Alergias: ${escapeHtml(p.alergias || 'Ninguna')}</div>
      <div class="box"><strong>Antecedentes</strong><br>Personales: ${escapeHtml(p.antecedentes || '')}<br>Familiares: ${escapeHtml(p.familiares || '')}</div>
      <h2>Historias clínicas</h2>${hists.length ? hists.map(h => `<div class="box"><strong>${escapeHtml(fmtF(h.fecha))} - ${escapeHtml(h.diagnostico || '')}</strong><br>Motivo: ${escapeHtml(h.motivo || '')}<br>Presión arterial: ${escapeHtml(h.ta || '')}<br>FC: ${escapeHtml(h.fc || '')} · FR: ${escapeHtml(h.fr || '')} · TEMP: ${escapeHtml(h.temp || '')} · SpO2: ${escapeHtml(h.sat || '')} · GMT: ${escapeHtml(h.gmt || '')}<br>IMC: ${escapeHtml(h.imc || '')} ${escapeHtml(h.imcClasificacion || '')}<br><br>${escapeHtml(h.anamnesis || '')}<br><br>Examen físico:<br>${escapeHtml(h.examenFisico || '')}<br><br>Tratamiento: ${escapeHtml(h.tratamiento || '')}</div>`).join('') : '<p>Sin historias registradas.</p>'}
      </body></html>`;
      await writeTextToHandle(dir, `Paciente ${code}.html`, html);
      indexRows.push(`<tr><td>${escapeHtml(code)}</td><td>${escapeHtml(p.nombre)}</td><td>${hists.length}</td><td>${escapeHtml(p.tel || '')}</td></tr>`);
    }
    await writeTextToHandle(root, 'INDICE PACIENTES.html', `<!doctype html><html><head><meta charset="utf-8"><title>Índice pacientes</title><style>body{font-family:Arial,sans-serif;margin:28px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left}</style></head><body><h1>Índice de pacientes - Clínica Propia</h1><table><thead><tr><th>Código</th><th>Paciente</th><th>Historias</th><th>Teléfono</th></tr></thead><tbody>${indexRows.join('')}</tbody></table></body></html>`);
    if (showAlert) showToast('Respaldo legible de Clínica Propia guardado en OneDrive local.');
    return true;
  } catch (e) {
    console.warn('No se pudo escribir el respaldo legible.', e);
    if (showAlert) alert('No se pudo escribir el respaldo legible en OneDrive.');
    return false;
  }
}

function csvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""');
  return `"${text}"`;
}

async function writeReadableOccupationalBackup(showAlert = false) {
  if (!oneDriveDirHandle) {
    if (showAlert) alert('Primero conecte la carpeta local de OneDrive.');
    return false;
  }
  try {
    ensureOcupacionalState();
    const root = await getOrCreateSubdir(oneDriveDirHandle, 'SALUD OCUPACIONAL');
    const headers = ['Fecha','Planta','Expediente','Nombre','DPI','Puesto','Área','Edad','PA','FC','FR','TEMP','SpO2','GMT','Peso kg','Altura','IMC','Aptitud','Ruffier','Diagnósticos','Tratamiento','Archivo fuente'];
    for (const emp of state.ocupacional.empresas || []) {
      const empresaDir = await getOrCreateSubdir(root, emp.nombre || 'EMPRESA');
      const recordsByYear = {};
      (emp.registros || []).forEach(record => {
        const year = String(record.backupYear || String(record.fechaEvaluacion || '').slice(0,4) || 'SIN ANIO');
        recordsByYear[year] = recordsByYear[year] || [];
        recordsByYear[year].push(record);
      });
      for (const [year, records] of Object.entries(recordsByYear)) {
        if (!records.length) continue;
        const backupDir = await getOrCreateSubdir(empresaDir, `BACKUP ${year}`);
        const csvRows = [headers.map(csvCell).join(',')].concat(records.map(record => [
          record.fechaEvaluacion, record.planta, record.expediente, record.nombre, record.dpi, record.puesto, record.area, record.edad,
          record.pa, record.fc, record.fr, record.temp, record.spo2, record.gmt, record.peso, record.altura, record.imc,
          record.aptitudLaboral, record.ruffierClasificacion === 'NO APLICA' ? 'NO APLICA' : [record.ruffierIndice, record.ruffierClasificacion].filter(Boolean).join(' - '),
          record.diagnosticos, record.tratamiento, record.sourceArchivo
        ].map(csvCell).join(',')));
        await writeTextToHandle(backupDir, `REGISTROS_EMOP_${year}.csv`, csvRows.join('\n'), 'text/csv;charset=utf-8');
        await writeTextToHandle(backupDir, `REGISTROS_EMOP_${year}.json`, JSON.stringify({ empresa:emp.nombre, anio:year, exportedAt:new Date().toISOString(), registros:records }, null, 2), 'application/json;charset=utf-8');
        const byPlant = countBy(records, r => r.planta || 'SIN PLANTA');
        const apt = occAptCounts(records);
        const rows = records.map(record => `<tr><td>${escapeHtml(fmtF(record.fechaEvaluacion))}</td><td>${escapeHtml(record.planta || '')}</td><td>${escapeHtml(record.expediente || '')}</td><td>${escapeHtml(record.nombre || '')}</td><td>${escapeHtml(record.puesto || '')}</td><td>${escapeHtml(record.aptitudLaboral || '')}</td><td>${escapeHtml(record.imc || '')}</td></tr>`).join('');
        const plantRows = Object.entries(byPlant).map(([plant, total]) => `<tr><td>${escapeHtml(plant)}</td><td>${total}</td></tr>`).join('');
        await writeTextToHandle(backupDir, `INDICE_BACKUP_${year}.html`, `<!doctype html><html><head><meta charset="utf-8"><title>Backup ${escapeHtml(emp.nombre || '')} ${escapeHtml(year)}</title><style>body{font-family:Arial,sans-serif;margin:28px;color:#17211d}table{border-collapse:collapse;width:100%;margin:12px 0}td,th{border:1px solid #ddd;padding:7px;text-align:left}h1{color:#124734}.box{border:1px solid #ddd;border-radius:8px;padding:12px;margin:12px 0}</style></head><body><h1>Backup Salud Ocupacional ${escapeHtml(emp.nombre || '')} ${escapeHtml(year)}</h1><div class="box"><strong>Total registros:</strong> ${records.length}<br><strong>Aptos:</strong> ${apt['Apto'] || 0}<br><strong>Aptos con restricción:</strong> ${apt['Apto con restricción'] || 0}<br><strong>No aptos con restricción:</strong> ${apt['No apto con restricción'] || 0}<br><strong>No aptos:</strong> ${apt['No apto'] || 0}</div><h2>Registros por planta</h2><table><thead><tr><th>Planta</th><th>Registros</th></tr></thead><tbody>${plantRows}</tbody></table><h2>Registros EMOP</h2><table><thead><tr><th>Fecha</th><th>Planta</th><th>Expediente</th><th>Nombre</th><th>Puesto</th><th>Aptitud</th><th>IMC</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
      }
    }
    if (showAlert) showToast('Respaldo legible de Salud Ocupacional guardado en OneDrive local.');
    return true;
  } catch (e) {
    console.warn('No se pudo escribir el respaldo ocupacional legible.', e);
    if (showAlert) alert('No se pudo escribir el respaldo ocupacional en OneDrive.');
    return false;
  }
}

function importBackup(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.state) throw new Error('Formato inválido');
      state = { ...state, ...data.state };
      normalizeStateCounters();
      saveAppData();
      showToast('Respaldo importado correctamente.');
      goTo(currentPage || 'dashboard');
    } catch (e) {
      alert('No se pudo importar el respaldo. Verifique que sea un archivo JSON válido de esta aplicación.');
    } finally {
      input.value = '';
    }
  };
  reader.readAsText(file);
}
