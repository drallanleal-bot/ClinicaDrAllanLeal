// Evaluación EMOP y consentimiento informado en digital: condiciones laborales, dictamen,
// firma del trabajador en pantalla y documentos listos para imprimir o guardar como PDF.

const OCC_CONDICIONES_FRECUENCIAS = [
  { key:'N', label:'Nunca' },
  { key:'O', label:'Ocasional (menos de 30 h/mes)' },
  { key:'F', label:'Frecuente (30-140 h/mes)' },
  { key:'P', label:'Permanente (más de 140 h/mes)' }
];
const OCC_CONDICIONES_LABORALES = [
  { grupo:'AMBIENTALES', filas:['Ruido mayor a 85 db','Humedad','Iluminación Artificial','Iluminación Natural','Manejo de sustancia químicas','Olores desagradables','Partículas en el medio ambiente','Temperaturas altas','Temperaturas Bajas','Radiaciones','Agentes biológicos','Vibraciones'] },
  { grupo:'ERGONOMÍA', filas:['Moviliza carga liviana (menor a 5 kg)','Moviliza carga moderada (de 6 kg a 10 kg)','Moviliza carga pesada (11 kg a 24 kg)','Moviliza carga muy pesada (más de 25 kg)','Movimientos repetitivos','Trabajo de pie','Trabajo sentado','Concentración visual','Uso de equipo de computación','Uso de herramientas manuales'] },
  { grupo:'FORMA DE DESPLAZAMIENTO EN EL TRABAJO', filas:['En vehículo','En vehículo y a pie','Montacargas','Equipo especial','A pie'] },
  { grupo:'TRABAJOS PELIGROSOS', filas:['En alturas','Espacios confinados','Energías peligrosas','Soldadura'] }
];
const OCC_DICTAMENES = [
  { aptitud:'Apto', texto:'Apto sin restricciones', detalle:false },
  { aptitud:'Apto con restricción', texto:'Apto con restricciones', detalle:true },
  { aptitud:'No apto con restricción', texto:'No apto temporalmente', detalle:true },
  { aptitud:'No apto', texto:'No apto definitivo', detalle:false }
];
const OCC_CONSENTIMIENTO_PARRAFOS = [
  'Por este medio, confirmo haber sido enterado sobre el objetivo primordial de este tipo de evaluaciones médicas, a la cual, estoy siendo convocado, para identificar factores de riesgo asociados a mi salud en general, para la detección temprana de indicios de enfermedad ocupacional, evitar el padecimiento o prevenir la ocurrencia de un accidente laboral y para recibir orientación sobre un plan terapéutico y de seguimiento que amerite según los hallazgos y las conclusiones de esta evaluación. Adicional, se me ha informado, que la conclusión de esta evaluación, específicamente, la Aptitud Laboral, será comunicado a la empresa a la cual pertenezco, emitiendo un informe de las condiciones de salud de forma global y puntual, dado el caso que amerite un seguimiento médico y en favor de promocionar la condición de Aptitud Laboral identificada, hacia un estado óptimo y deseable, promoviendo también de esta manera, la debida protección a mi salud en relación con el trabajo que desempeño, y respetando la confidencialidad de los todos los datos e información que sean compartidos con los profesionales de los Servicios de Salud externos que contrata la empresa, mismos que quedarán resguardados en mi Expediente Clínico Empresarial en la clínica privada externa.',
  'Este tipo de evaluaciones médicas ocupacionales, están contempladas dentro del Capítulo III Servicios de Atención de Urgencias Médicas y Servicios de Atención en Salud, Artículo 303, del Reglamento de Salud y Seguridad Ocupacional, Artículo 94, 95 y 96 del Acuerdo Gubernativo 229-2014 y sus Reformas 33-2016 y 57-2022, como parte de los Niveles de los Servicios de Salud que debe operativizar la empresa, al contar con servicio de médicos ocupacionales y como parte del listado de las actividades del Sistema de Vigilancia de la Salud en los centros de trabajo. También están respaldadas por el Artículo 63 del Código de Trabajo en donde establece que es obligación del trabajador el “someterse a reconocimiento médico”, siendo posible aplicarlo al inicio de la relación laboral o en el transcurso de esta, a solicitud del patrono o del Instituto Guatemalteco de Seguridad Social. Estas actividades de Vigilancia de la Salud de los colaboradores, se debe llevar a cabo con el consentimiento voluntario informado de los trabajadores (Código de Ética, ICOH, 2014).'
];

function occCondicionKey(grupoIndex, filaIndex) { return `${grupoIndex}-${filaIndex}`; }

// Valores con los que se prellena una evaluación nueva (formato habitual de la jornada).
// Clave: grupo-fila según OCC_CONDICIONES_LABORALES. N Nunca · O Ocasional · F Frecuente · P Permanente.
const OCC_CONDICIONES_PREDETERMINADAS = {
  // Ambientales
  '0-0':'O', '0-1':'O', '0-2':'O', '0-3':'F', '0-4':'N', '0-5':'O',
  '0-6':'F', '0-7':'O', '0-8':'O', '0-9':'N', '0-10':'N', '0-11':'F',
  // Ergonomía
  '1-0':'N', '1-1':'F', '1-2':'N', '1-3':'N', '1-4':'F', '1-5':'O',
  '1-6':'O', '1-7':'O', '1-8':'N', '1-9':'O',
  // Forma de desplazamiento en el trabajo
  '2-0':'O', '2-1':'O', '2-2':'N', '2-3':'N', '2-4':'O',
  // Trabajos peligrosos
  '3-0':'N', '3-1':'N', '3-2':'N', '3-3':'N'
};

function occDictamenDeAptitud(aptitud) {
  return OCC_DICTAMENES.find(d => d.aptitud === aptitud) || OCC_DICTAMENES[0];
}

// ── Formulario ────────────────────────────────────
function renderOccCondicionesLaborales(editing, opciones = {}) {
  const valores = editing ? (editing.condicionesLaborales || {}) : OCC_CONDICIONES_PREDETERMINADAS;
  const head = OCC_CONDICIONES_FRECUENCIAS.map(f => `<th>${escapeHtml(f.label.split(' (')[0])}</th>`).join('');
  const body = OCC_CONDICIONES_LABORALES.map((g, gi) => `
    <tr class="condGrupo"><td colspan="5">${escapeHtml(g.grupo)}</td></tr>
    ${g.filas.map((fila, fi) => {
      const key = occCondicionKey(gi, fi);
      return `<tr><td>${escapeHtml(fila)}</td>${OCC_CONDICIONES_FRECUENCIAS.map(f => `<td class="condCelda"><input type="radio" name="occCond_${key}" value="${f.key}" aria-label="${escapeHtml(fila)}: ${escapeHtml(f.label)}" ${valores[key] === f.key ? 'checked' : ''}></td>`).join('')}</tr>`;
    }).join('')}`).join('');
  const contenido = `${editing ? '' : '<div class="occAvisoPrellenado">Ya viene marcado con los valores habituales de la jornada. Cambie solo lo que sea distinto para este puesto.</div>'}<div class="attachHint" style="margin-bottom:.5rem">Marque la frecuencia de exposición según el puesto. Ocasional: menos de 30 h/mes · Frecuente: 30 a 140 h/mes · Permanente: más de 140 h/mes.</div>
    <div class="condWrap"><table class="condTabla"><thead><tr><th>Tipo de condiciones</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  if (opciones.plano) return contenido;
  return `<details class="fSection" ${Object.keys(valores).length ? 'open' : ''}>
    <summary>Condiciones laborales</summary>
    ${contenido}
  </details>`;
}

function leerOccCondicionesLaborales() {
  const valores = {};
  OCC_CONDICIONES_LABORALES.forEach((g, gi) => g.filas.forEach((_, fi) => {
    const key = occCondicionKey(gi, fi);
    const checked = document.querySelector(`input[name="occCond_${key}"]:checked`);
    if (checked) valores[key] = checked.value;
  }));
  return valores;
}

function renderOccDictamenYConsentimiento(editing, opciones = {}) {
  const firma = editing?.consentimientoFirma || '';
  const dictamen = `
  <div class="fRow">
    <div class="fGroup"><label>Detalle de la restricción (si aplica)</label><input id="occRestriccionDetalle" value="${escapeHtml(editing?.restriccionDetalle || '')}" placeholder="Ej: no levantar más de 10 kg"></div>
    <div class="fGroup"><label>Recomendaciones</label><textarea id="occRecomendaciones" rows="2">${escapeHtml(editing?.recomendaciones || '')}</textarea></div>
  </div>`;
  const consentimiento = `
  ${opciones.plano ? '<div>' : `<details class="fSection" ${firma ? '' : 'open'}>
    <summary>Consentimiento informado</summary>`}
    <div class="consTexto">${OCC_CONSENTIMIENTO_PARRAFOS.map(p => `<p>${escapeHtml(p)}</p>`).join('')}
      <p>Por lo que, yo, <strong id="occConsNombre">${escapeHtml(editing?.nombre || '(nombre del trabajador)')}</strong>, informo haber dado lectura a este documento, haber comprendido la información acá expuesta y comprendo que de surgir la necesidad de un posible acompañamiento médico laboral, debo cumplir con dicho plan terapéutico, por lo que confirmo mi participación en este Procedimiento de Evaluaciones Médicas Ocupacionales Anuales.</p>
    </div>
    <label class="firmaLabel">Firma del trabajador</label>
    <div class="firmaPadWrap">
      <canvas id="occFirmaPad" class="firmaPad" aria-label="Espacio para firmar con el dedo, lápiz o mouse"></canvas>
      <img id="occFirmaGuardada" class="firmaGuardada" alt="Firma guardada del trabajador" ${firma ? `src="${firma}"` : 'style="display:none"'}>
    </div>
    <div class="firmaAcciones">
      <span class="attachHint" id="occFirmaEstado">${firma ? `Firmado el ${escapeHtml(fmtFechaHora(editing.consentimientoFirmadoEn))}` : 'Firme con el dedo, el lápiz de la tablet o el mouse.'}</span>
      <button type="button" class="btn btn-sm btn-outline" onclick="limpiarOccFirmaPad()">${firma ? 'Volver a firmar' : 'Borrar firma'}</button>
    </div>
  ${opciones.plano ? '</div>' : '</details>'}`;
  if (opciones.parte === 'dictamen') return dictamen;
  if (opciones.parte === 'consentimiento') return consentimiento;
  return dictamen + consentimiento;
}

function fmtFechaHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-GT', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

// ── Firma en pantalla ─────────────────────────────
let occFirmaTrazada = false;
let occFirmaBorrada = false;

function initOccFirmaPad() {
  const canvas = document.getElementById('occFirmaPad');
  if (!canvas) return;
  occFirmaTrazada = false;
  occFirmaBorrada = false;
  const guardada = document.getElementById('occFirmaGuardada');
  if (guardada && guardada.getAttribute('src')) canvas.style.display = 'none';
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round((rect.width || 500) * ratio);
  canvas.height = Math.round((rect.height || 170) * ratio);
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#10223a';
  let dibujando = false;
  const punto = e => { const r = canvas.getBoundingClientRect(); return { x:e.clientX - r.left, y:e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    dibujando = true;
    const p = punto(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1);
    ctx.stroke();
    occFirmaTrazada = true;
  });
  canvas.addEventListener('pointermove', e => {
    if (!dibujando) return;
    e.preventDefault();
    const p = punto(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });
  const terminar = () => { dibujando = false; };
  canvas.addEventListener('pointerup', terminar);
  canvas.addEventListener('pointercancel', terminar);
}

function limpiarOccFirmaPad() {
  const canvas = document.getElementById('occFirmaPad');
  const guardada = document.getElementById('occFirmaGuardada');
  if (!canvas) return;
  if (guardada && guardada.style.display !== 'none') {
    if (!confirm('¿Borrar la firma guardada para que el trabajador vuelva a firmar?')) return;
    guardada.style.display = 'none';
    guardada.removeAttribute('src');
    canvas.style.display = '';
    initOccFirmaPad();
    occFirmaBorrada = true;
    document.getElementById('occFirmaEstado').textContent = 'Firme con el dedo, el lápiz de la tablet o el mouse.';
    return;
  }
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  occFirmaTrazada = false;
}

// Recorta el espacio en blanco y reduce la firma para que pese poco en Firebase.
function leerOccFirmaPad() {
  const canvas = document.getElementById('occFirmaPad');
  if (!canvas || !occFirmaTrazada) return '';
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return '';
  const pad = 8;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad); maxY = Math.min(height - 1, maxY + pad);
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const scale = Math.min(1, 420 / w, 160 / h);
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(w * scale));
  out.height = Math.max(1, Math.round(h * scale));
  out.getContext('2d').drawImage(canvas, minX, minY, w, h, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

// Campos nuevos que se agregan al registro al guardar.
function camposDocumentosOcupacionales() {
  const campos = {
    sexo:document.getElementById('occSexo')?.value || '',
    condicionesLaborales:leerOccCondicionesLaborales(),
    restriccionDetalle:document.getElementById('occRestriccionDetalle')?.value.trim() || '',
    recomendaciones:document.getElementById('occRecomendaciones')?.value.trim() || ''
  };
  const medicoSel = document.getElementById('occMedico');
  if (medicoSel) {
    campos.medicoId = medicoSel.value || 'otro';
    const mm = occMedicoPorId(campos.medicoId);
    if (mm) { campos.medicoNombre = mm.nombre; campos.medicoColegiado = mm.colegiado || ''; }
  }
  const firma = leerOccFirmaPad();
  if (firma) {
    campos.consentimientoFirma = firma;
    campos.consentimientoFirmadoEn = new Date().toISOString();
  }
  return campos;
}

function aplicarFirmaBorrada(registro) {
  if (occFirmaBorrada && !occFirmaTrazada) {
    registro.consentimientoFirma = '';
    registro.consentimientoFirmadoEn = '';
  }
  return registro;
}

// ── Documentos para imprimir o guardar como PDF ───
function docEncabezado(titulo, subtitulo) {
  return `<div class="docHead">
    <img src="ALLAN-logo (1).jpeg" alt="" class="docLogo">
    <div class="docTitulos"><div class="docTitulo">${escapeHtml(titulo)}</div>${subtitulo ? `<div class="docSub">${escapeHtml(subtitulo)}</div>` : ''}</div>
    <img src="img/logo-tropigas.png" alt="" class="docLogoEmpresa">
  </div>`;
}

function docCampo(label, valor) {
  return `<div class="docCampo"><span>${escapeHtml(label)}:</span> <b>${escapeHtml(valor || '')}</b></div>`;
}

function docFirmaMedico(r) {
  const f = r.firmaMedico;
  const pub = occFirmaPublicada(r);
  const firmado = !!(f && pub && pub.firma);
  const m = occMedicoDeRegistro(r);
  let datos = null;
  if (f) datos = { nombre:f.nombre, colegiado:f.colegiado };
  else if (r.medicoId && r.medicoId !== 'otro') datos = { nombre:m?.nombre || r.medicoNombre || '', colegiado:m?.colegiado || r.medicoColegiado || '' };
  if (datos && firmado) { datos.firma = pub.firma; datos.sello = pub.sello || ''; }
  return `<div class="docSeccion">FIRMA DEL MÉDICO EVALUADOR</div>
    ${docBloqueFirma(r, datos, firmado, firmado && f.qr ? f.codigo : '')}
    ${firmado ? `<div class="docNota">${escapeHtml(occTextoFirmado(f))}</div>` : ''}`;
}

function documentoEvaluacionHtml(r) {
  const valores = r.condicionesLaborales || {};
  const dictamen = occDictamenDeAptitud(r.aptitudLaboral);
  const condiciones = OCC_CONDICIONES_LABORALES.map((g, gi) => `
    <tr class="docGrupo"><td colspan="5">${escapeHtml(g.grupo)}</td></tr>
    ${g.filas.map((fila, fi) => {
      const v = valores[occCondicionKey(gi, fi)];
      return `<tr><td>${escapeHtml(fila)}</td>${OCC_CONDICIONES_FRECUENCIAS.map(f => `<td class="docX">${v === f.key ? 'X' : ''}</td>`).join('')}</tr>`;
    }).join('')}`).join('');
  const dictamenes = OCC_DICTAMENES.map(d => `<div class="docCheck">${d.texto === dictamen.texto ? '☒' : '☐'} ${escapeHtml(d.texto)}${d.detalle ? `: <b>${d.texto === dictamen.texto ? escapeHtml(r.restriccionDetalle || '') : ''}</b>` : ''}</div>`).join('');
  return `<div class="docPagina">
    ${docEncabezado('JORNADA DE EVALUACIONES MÉDICAS OCUPACIONALES ANUALES', 'TROPIGAS')}
    <div class="docSeccion">DATOS DE IDENTIFICACIÓN</div>
    <div class="docGrid">
      ${docCampo('Nombre del trabajador', r.nombre)}${docCampo('Fecha', fmtF(r.fechaEvaluacion))}
      ${docCampo('Edad', r.edad)}${docCampo('Sexo', r.sexo)}
      ${docCampo('DPI', r.dpi)}${docCampo('Expediente', r.expediente)}
      ${docCampo('Puesto de trabajo', r.puesto)}${docCampo('Área/Departamento', r.area)}
    </div>
    <div class="docSeccion">CONDICIONES LABORALES</div>
    <table class="docTabla"><thead><tr><th>Tipo de condiciones</th>${OCC_CONDICIONES_FRECUENCIAS.map(f => `<th>${escapeHtml(f.label)}</th>`).join('')}</tr></thead><tbody>${condiciones}</tbody></table>
  </div>
  <div class="docPagina">
    ${docEncabezado('JORNADA DE EVALUACIONES MÉDICAS OCUPACIONALES ANUALES', 'TROPIGAS')}
    ${docCampo('Trabajador', `${r.nombre || ''} · DPI ${r.dpi || '—'}`)}
    <div class="docSeccion">DICTAMEN MÉDICO</div>
    ${dictamenes}
    <div class="docSeccion">RECOMENDACIONES</div>
    <div class="docTextoLibre">${escapeHtml(r.recomendaciones || '')}</div>
    ${docFirmaMedico(r)}
    <div class="docSeccion">ANEXO 1. CRITERIOS DE APTITUD MÉDICA OCUPACIONAL</div>
    <table class="docTabla docAnexo"><thead><tr><th>Dictamen</th><th>Descripción breve</th><th>Ejemplo clínico</th></tr></thead><tbody>
      <tr><td>APTO SIN RESTRICCIONES</td><td>El trabajador puede realizar todas las funciones del puesto sin riesgo para su salud o la de otros.</td><td>Ejemplo: operario sano sin alteraciones médicas ni paraclínicas.</td></tr>
      <tr><td>APTO CON RESTRICCIONES</td><td>Puede trabajar, pero con limitaciones específicas o adaptaciones del puesto.</td><td>Ejemplo: hernia lumbar, no levantar más de 10 kg.</td></tr>
      <tr><td>NO APTO TEMPORALMENTE</td><td>No puede trabajar de momento; requiere tratamiento o recuperación antes de reevaluación.</td><td>Ejemplo: bronquitis aguda o fractura en consolidación.</td></tr>
      <tr><td>NO APTO DEFINITIVO</td><td>Condición permanente o grave que impide desempeñar el puesto de forma segura.</td><td>Ejemplo: epilepsia activa o pérdida visual severa.</td></tr>
    </tbody></table>
  </div>`;
}

function documentoConsentimientoHtml(r) {
  return `<div class="docPagina">
    ${docEncabezado('CONSENTIMIENTO INFORMADO – TROPIGAS', 'EVALUACIONES MÉDICAS OCUPACIONALES ANUALES')}
    <div class="docFecha">FECHA: <b>${escapeHtml(fmtF(r.fechaEvaluacion))}</b></div>
    ${OCC_CONSENTIMIENTO_PARRAFOS.map(p => `<p class="docParrafo">${escapeHtml(p)}</p>`).join('')}
    <p class="docParrafo">Por lo que, yo: <b class="docSubrayado">${escapeHtml(r.nombre || '')}</b>, informo haber dado lectura a este documento, haber comprendido la información acá expuesta y comprendo que de surgir la necesidad de un posible acompañamiento médico laboral, debo cumplir con dicho plan terapéutico, por lo que confirmo mi participación en este Procedimiento de Evaluaciones Médicas Ocupacionales Anuales.</p>
    <div class="docLinea"><span>DPI:</span><i>${escapeHtml(r.dpi || '')}</i></div>
    <div class="docLinea docLineaFirma"><span>Firma:</span><i>${r.consentimientoFirma ? `<img src="${r.consentimientoFirma}" alt="Firma del trabajador">` : ''}</i></div>
    ${r.consentimientoFirmadoEn ? `<div class="docNota">Firmado en pantalla el ${escapeHtml(fmtFechaHora(r.consentimientoFirmadoEn))}</div>` : ''}
  </div>`;
}

async function imprimirDocumentoOcupacional(id, tipo) {
  const r = occData().registros.find(x => String(x.id) === String(id));
  if (!r) { alert('No se encontró el registro.'); return; }
  if (tipo === 'consentimiento' && !r.consentimientoFirma && !confirm('Este trabajador todavía no ha firmado el consentimiento en pantalla. ¿Imprimirlo en blanco para firma a mano?')) return;
  await imprimirRegistrosOcupacionales([r], tipo, `${tipo === 'consentimiento' ? 'Consentimiento' : 'Evaluacion'} ${r.nombre || ''} ${r.fechaEvaluacion || ''}`.trim());
}

// Imprime o guarda en un solo PDF todas las evaluaciones (o consentimientos) de una jornada.
// Las firmadas salen con la firma digital; las demás con el recuadro para firmar y sellar a mano.
async function imprimirJornadaOcupacional(key, tipo) {
  const regs = occData().registros.filter(r => occRegJornadaKey(r) === key)
    .sort((a, b) => String(a.expediente || '').localeCompare(String(b.expediente || ''), 'es', { numeric:true }) || String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  if (!regs.length) { alert('No hay evaluaciones en esta jornada.'); return; }
  const [fecha, planta] = key.split('|');
  const nombre = tipo === 'consentimiento' ? 'Consentimientos' : 'Evaluaciones';
  showToast(`Preparando ${regs.length} ${nombre.toLowerCase()}...`);
  await imprimirRegistrosOcupacionales(regs, tipo, `${nombre} ${occData().activeEmpresa || ''} ${planta || ''} ${fecha || ''}`.replace(/\s+/g, ' ').trim());
}

async function imprimirRegistrosOcupacionales(regs, tipo, titulo) {
  if (tipo !== 'consentimiento' && isAdminUser()) {
    const pendientes = regs.filter(r => r.firmaMedico && !r.firmaMedico.qr);
    if (pendientes.length) {
      const ok = await Promise.all(pendientes.map(occPublicarVerificacion));
      if (ok.some(Boolean)) { saveAppData(); saveOccupationalStateToCloud(true); }
    }
  }
  let area = document.getElementById('printArea');
  if (!area) {
    area = document.createElement('div');
    area.id = 'printArea';
    document.body.appendChild(area);
  }
  area.innerHTML = regs.map(r => tipo === 'consentimiento' ? documentoConsentimientoHtml(r) : documentoEvaluacionHtml(r)).join('');
  const tituloPrevio = document.title;
  document.title = titulo;
  const imagenes = Array.from(area.querySelectorAll('img'));
  Promise.all(imagenes.map(img => img.complete ? null : new Promise(res => { img.onload = img.onerror = res; }))).then(() => {
    // El área de impresión solo se ve al imprimir (ver @media print en estilos.css).
    const terminar = () => { document.title = tituloPrevio; window.removeEventListener('afterprint', terminar); };
    window.addEventListener('afterprint', terminar);
    window.print();
  });
}

// ── Médicos evaluadores, firma digital y leyenda de protección ──
// La firma digital se guarda en el estado compartido de Firebase (solo administradores), nunca en el repositorio.
// Encima de la leyenda va la firma (digital o a mano): así la firma impresa queda atada a ese documento.
const OCC_LEYENDA_PREDETERMINADA = [
  'EVALUACIÓN MÉDICA OCUPACIONAL ANUAL',
  'Uso exclusivo para el presente dictamen',
  '{empresa} · Planta {planta}',
  'Trabajador: {nombre}',
  'Exp. {expediente} · {mes}',
  'No válido para otro fin'
].join('\n');

function ensureMedicos() {
  if (!Array.isArray(state.medicos)) {
    state.medicos = [
      { id:'drleal', nombre:'Dr. Allan Leal', colegiado:'', usuario:'drleal', firma:'', sello:'' }
    ];
  }
  return state.medicos;
}
function occMedicoPorId(id) { return ensureMedicos().find(m => String(m.id) === String(id)) || null; }
function occMedicoDeRegistro(r) { return r && r.medicoId ? occMedicoPorId(r.medicoId) : null; }
function occLeyendaEmpresa(emp = activeOccCompany()) {
  const t = String(emp?.leyendaFirma ?? '').trim();
  return t || OCC_LEYENDA_PREDETERMINADA;
}
function occLeyendaLineas(r = {}, emp = activeOccCompany()) {
  const fecha = String(r.fechaEvaluacion || '');
  const [y, m] = fecha.split('-');
  const mes = y && m ? `${(typeof MESES_ES !== 'undefined' ? MESES_ES[Number(m) - 1] : m) || m} ${y}` : '';
  const datos = { empresa:emp?.nombre || '', planta:r.planta || '', fecha:fmtF(fecha), nombre:r.nombre || '', expediente:r.expediente || '', dpi:r.dpi || '', mes, anio:y || '' };
  return occLeyendaEmpresa(emp).split('\n').map(l => l.replace(/\{(\w+)\}/g, (all, k) => (k in datos ? datos[k] : all)).trim()).filter(Boolean).slice(0, 8);
}

// Bloque que se imprime en el dictamen (también se usa para la vista previa).
function docBloqueFirma(r, medico, aplicarDigital, codigoQr = '') {
  const qr = codigoQr ? `<div class="docQr">
      ${occQrSvg(occVerificacionUrl(codigoQr))}
      <div class="docQrTexto">Verifique este dictamen escaneando el código.<br>Código: <b>${escapeHtml(codigoQr)}</b></div>
    </div>` : '';
  return `<div class="docFirmaFila"><div class="docFirmaBloque">
    <div class="docFirmaZona">
      <div class="docLeyenda">${occLeyendaLineas(r).map(l => `<div>${escapeHtml(l)}</div>`).join('')}</div>
      ${aplicarDigital && medico.sello ? `<img class="docSelloImg" src="${medico.sello}" alt="">` : ''}
      ${aplicarDigital ? `<img class="docFirmaImg" src="${medico.firma}" alt="">` : ''}
    </div>
    <div class="docFirmaPie">Firma y sello</div>
    <div class="docLinea"><span>Nombre:</span><i>${medico ? escapeHtml(medico.nombre || '') : ''}</i></div>
    <div class="docLinea"><span>Colegiado No.:</span><i>${medico ? escapeHtml(medico.colegiado || '') : ''}</i></div>
  </div>${qr}</div>`;
}

// Selector del médico en la sección "Aptitud laboral" del formulario.
function renderOccMedicoSelect(editing) {
  const medicos = ensureMedicos();
  const propio = medicos.find(m => m.usuario && m.usuario === currentUser?.username);
  const elegido = editing ? (editing.medicoId || 'otro') : (occRegUltimos.medicoId ?? (propio?.id || medicos[0]?.id || 'otro'));
  return `<div class="fGroup"><label>Médico evaluador (firma)</label>
    <select id="occMedico">
      ${medicos.map(m => `<option value="${escapeHtml(m.id)}" ${String(m.id) === String(elegido) ? 'selected' : ''}>${escapeHtml(m.nombre)}${m.colegiado ? ` · Col. ${escapeHtml(m.colegiado)}` : ''}${m.firma ? ' · firma digital' : ' · firma a mano'}</option>`).join('')}
      <option value="otro" ${elegido === 'otro' ? 'selected' : ''}>Otro médico (llenar y firmar a mano)</option>
    </select>
    <div class="attachHint">Después de guardar, el médico con firma digital firma desde el listado con «✍️ Firmar» y su contraseña. Sin firmar, el dictamen sale con el espacio para firmar y sellar en papel.</div>
  </div>`;
}

// Convierte la foto de la firma o sello en una imagen con fondo transparente, recortada y liviana.
function procesarImagenFirma(file, maxW, maxH) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, 1400 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * escala));
      c.height = Math.max(1, Math.round(img.height * escala));
      const ctx = c.getContext('2d');
      // Fondo blanco primero: una imagen con fondo transparente no debe leerse como tinta negra.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const data = ctx.getImageData(0, 0, c.width, c.height);
      const px = data.data;
      // Se calcula el brillo del papel zona por zona: así una esquina gris, una sombra o un fondo café
      // no quedan como mancha. Lo que es más oscuro que el papel de alrededor es tinta.
      const W = c.width, H = c.height, B = 24;
      const lum = new Float32Array(W * H);
      for (let i = 0, p = 0; i < px.length; i += 4, p++) lum[p] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      const gw = Math.ceil(W / B), gh = Math.ceil(H / B);
      let grid = new Float32Array(gw * gh);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const k = Math.floor(y / B) * gw + Math.floor(x / B);
        if (lum[y * W + x] > grid[k]) grid[k] = lum[y * W + x];
      }
      for (let pasada = 0; pasada < 2; pasada++) {
        const sig = new Float32Array(gw * gh);
        for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
          let s = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const yy = Math.min(gh - 1, Math.max(0, gy + dy)), xx = Math.min(gw - 1, Math.max(0, gx + dx));
            s += grid[yy * gw + xx];
          }
          sig[gy * gw + gx] = s / 9;
        }
        grid = sig;
      }
      const fondo = (x, y) => {
        const fx = Math.min(gw - 1, Math.max(0, (x + 0.5) / B - 0.5)), fy = Math.min(gh - 1, Math.max(0, (y + 0.5) / B - 0.5));
        const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1);
        const tx = fx - x0, ty = fy - y0;
        const arriba = grid[y0 * gw + x0] * (1 - tx) + grid[y0 * gw + x1] * tx;
        const abajo = grid[y1 * gw + x0] * (1 - tx) + grid[y1 * gw + x1] * tx;
        return arriba * (1 - ty) + abajo * ty;
      };
      let sr = 0, sg = 0, sb = 0, n = 0;
      const alfa = new Uint8ClampedArray(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const p = y * W + x, i = p * 4;
        const d = fondo(x, y) - lum[p];
        // 16 niveles de transparencia: se ve igual y la imagen pesa mucho menos.
        const a = d <= 20 ? 0 : Math.min(255, Math.round(Math.pow(Math.min(1, (d - 20) / 50), 0.8) * 15) * 17);
        alfa[p] = a;
        if (a > 200) { sr += px[i]; sg += px[i + 1]; sb += px[i + 2]; n++; }
      }
      if (!n) { reject(new Error('No se encontró la firma en la foto. Use papel blanco y tinta oscura.')); return; }
      // Color de la tinta: el promedio, oscurecido para que se imprima nítido.
      const r = Math.round(sr / n * 0.6), g = Math.round(sg / n * 0.6), b = Math.round(sb / n * 0.6);
      let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        if (alfa[y * c.width + x] > 40) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
      for (let i = 0, p = 0; i < px.length; i += 4, p++) { px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = alfa[p]; }
      ctx.putImageData(data, 0, 0);
      const pad = 6;
      minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
      maxX = Math.min(c.width - 1, maxX + pad); maxY = Math.min(c.height - 1, maxY + pad);
      const w = maxX - minX + 1, h = maxY - minY + 1;
      const k = Math.min(1, maxW / w, maxH / h);
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(w * k));
      out.height = Math.max(1, Math.round(h * k));
      out.getContext('2d').drawImage(c, minX, minY, w, h, 0, 0, out.width, out.height);
      resolve(out.toDataURL('image/png'));
    };
    img.src = url;
  });
}

// ── Configuración (página Empresas) ──
function renderOccMedicosConfig() {
  const medicos = ensureMedicos();
  const emp = activeOccCompany();
  const ejemplo = { planta:(emp?.plantas || [])[0] || 'MIXCO', fechaEvaluacion:todayLocalISO(), nombre:'Nombre del trabajador', expediente:'TRO-MIX-2026-0001' };
  const conFirma = medicos.find(m => m.firma);
  return `<div class="card" id="occMedicosCard">
  <div class="cardTitle">✍️ Médicos evaluadores y firma</div>
  <div class="listaPlana">
    ${medicos.map(m => `<div class="medicoFila" data-id="${escapeHtml(m.id)}">
      <div class="fRow three">
        <div class="fGroup"><label>Nombre</label><input data-campo="nombre" value="${escapeHtml(m.nombre || '')}"></div>
        <div class="fGroup"><label>Colegiado No.</label><input data-campo="colegiado" value="${escapeHtml(m.colegiado || '')}" placeholder="Ej: 12,345"></div>
        <div class="fGroup"><label>Usuario de la app</label><input data-campo="usuario" value="${escapeHtml(m.usuario || '')}" placeholder="Vacío si firma a mano"></div>
      </div>
      <div class="medicoFirmas">
        <div class="medicoImg ancha">${m.firma ? `<img src="${m.firma}" alt="Firma y sello">` : '<span>Sin firma y sello digital</span>'}${m.sello ? `<img src="${m.sello}" alt="Sello">` : ''}</div>
        <div class="medicoBotones">
          <label class="btn btn-sm btn-outline">📷 ${m.firma ? 'Cambiar firma y sello' : 'Subir firma y sello'}<input type="file" accept="image/*" hidden onchange="subirImagenMedico('${escapeHtml(m.id)}','firma',this)"></label>
          ${m.firma || m.sello ? `<button type="button" class="btn btn-sm btn-outline" onclick="quitarImagenesMedico('${escapeHtml(m.id)}')">Quitar firma y sello</button>` : ''}
          <button type="button" class="btn btn-sm btn-outline filaBorrar" onclick="quitarMedico('${escapeHtml(m.id)}')">Quitar médico</button>
        </div>
      </div>
      <div class="attachHint">${m.firma ? `Solo el usuario «${escapeHtml(m.usuario || '—')}» puede firmar con esta firma, y siempre se le pide la contraseña.` : 'Sin firma digital: sus dictámenes salen con el espacio para firmar y sellar a mano.'}</div>
    </div>`).join('')}
  </div>
  <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin:.75rem 0 1.25rem">
    <button class="btn btn-outline" onclick="agregarMedico()">+ Agregar médico</button>
    <button class="btn btn-primary" onclick="guardarMedicosYLeyenda()">Guardar</button>
  </div>
  <div class="attachHint" style="margin-bottom:1rem">Para la foto: ponga el sello y firme encima en una hoja blanca, con tinta oscura; tómela de frente y con buena luz. La app quita el fondo sola (aunque salga gris o café). La firma queda guardada en Firebase, solo visible para administradores.</div>
  <div class="fRow" style="align-items:flex-start">
    <div class="fGroup">
      <label>Leyenda de protección (${escapeHtml(emp?.nombre || '')})</label>
      <textarea id="occLeyendaTexto" rows="7" oninput="previewLeyendaFirma()">${escapeHtml(occLeyendaEmpresa(emp))}</textarea>
      <div class="attachHint">Una línea por renglón (máximo 8). Se reemplazan solos: {empresa}, {planta}, {fecha}, {mes}, {anio}, {nombre}, {expediente}, {dpi}.</div>
      <button type="button" class="btn btn-sm btn-outline" style="margin-top:.5rem" onclick="document.getElementById('occLeyendaTexto').value=OCC_LEYENDA_PREDETERMINADA;previewLeyendaFirma()">Restablecer leyenda</button>
    </div>
    <div class="fGroup">
      <label>Vista previa en el dictamen</label>
      <div class="docPreview" id="occLeyendaPreview">${docBloqueFirma(ejemplo, conFirma || medicos[0] || null, !!conFirma)}</div>
    </div>
  </div>
</div>`;
}
function previewLeyendaFirma() {
  const box = document.getElementById('occLeyendaPreview');
  const txt = document.getElementById('occLeyendaTexto');
  if (!box || !txt) return;
  const emp = { ...activeOccCompany(), leyendaFirma:txt.value };
  const ejemplo = { planta:(emp.plantas || [])[0] || 'MIXCO', fechaEvaluacion:todayLocalISO(), nombre:'Nombre del trabajador', expediente:'TRO-MIX-2026-0001' };
  const lineas = occLeyendaLineas(ejemplo, emp);
  const ley = box.querySelector('.docLeyenda');
  if (ley) ley.innerHTML = lineas.map(l => `<div>${escapeHtml(l)}</div>`).join('');
}
function leerMedicosDelFormulario() {
  document.querySelectorAll('#occMedicosCard .medicoFila').forEach(fila => {
    const m = occMedicoPorId(fila.dataset.id);
    if (!m) return;
    fila.querySelectorAll('[data-campo]').forEach(el => {
      const campo = el.dataset.campo;
      m[campo] = el.type === 'checkbox' ? el.checked : (campo === 'usuario' ? el.value.trim().toLowerCase() : el.value.trim());
    });
  });
  const txt = document.getElementById('occLeyendaTexto');
  if (txt) activeOccCompany().leyendaFirma = txt.value.trim() === OCC_LEYENDA_PREDETERMINADA ? '' : txt.value.trim();
}
async function guardarMedicosYLeyenda(aviso = true) {
  leerMedicosDelFormulario();
  await saveAppData({ backupToFolder:true });
  await saveOccupationalStateToCloud(true);
  if (aviso) showToast('Médicos y leyenda guardados.');
  renderOcupEmpresas();
}
function agregarMedico() {
  leerMedicosDelFormulario();
  ensureMedicos().push({ id:`med-${Date.now()}`, nombre:'', colegiado:'', usuario:'', firma:'', sello:'' });
  renderOcupEmpresas();
  setTimeout(() => document.querySelector('#occMedicosCard .medicoFila:last-child input')?.focus(), 0);
}
async function quitarMedico(id) {
  const m = occMedicoPorId(id);
  if (!m) return;
  if (!confirm(`¿Quitar a ${m.nombre || 'este médico'} de la lista? Las evaluaciones ya guardadas con este médico saldrán con el espacio en blanco.`)) return;
  leerMedicosDelFormulario();
  state.medicos = ensureMedicos().filter(x => String(x.id) !== String(id));
  await guardarMedicosYLeyenda(false);
}
async function quitarImagenesMedico(id) {
  const m = occMedicoPorId(id);
  if (!m || !confirm('¿Quitar la firma y el sello digital de este médico?')) return;
  leerMedicosDelFormulario();
  m.firma = ''; m.sello = '';
  await guardarMedicosYLeyenda(false);
  showToast('Firma y sello quitados.');
}
async function subirImagenMedico(id, tipo, input) {
  const file = input.files && input.files[0];
  if (!file) return;
  try {
    leerMedicosDelFormulario();
    // Firma y sello van en una sola imagen (como el sello de hule con la firma encima).
    const dataUrl = await procesarImagenFirma(file, 480, 260);
    const m = occMedicoPorId(id);
    if (!m) return;
    m.firma = dataUrl;
    m.sello = '';
    m.firmaVersion = String(Date.now());
    await guardarMedicosYLeyenda(false);
    showToast('Firma y sello guardados.');
  } catch (e) {
    alert(e.message || 'No se pudo procesar la imagen.');
  }
}

// ── Firmar dictámenes con contraseña ──
// Al firmar se guarda en el registro quién firmó, cuándo y un código; la imagen de la firma se publica una
// sola vez en los datos ocupacionales para que todos los usuarios (incluido ingeniería) impriman el dictamen
// ya firmado. Si el dictamen se edita, la firma se quita y hay que volver a firmar.
function occFirmaClave(m) { return `${m.id}-${m.firmaVersion || '1'}`; }
function occPuedeFirmar(m) { return !!(m && m.firma && m.usuario && currentUser?.username === m.usuario); }
function occFirmaPublicada(r) {
  const clave = r?.firmaMedico?.clave;
  return clave ? (state.ocupacional?.firmasPublicadas || {})[clave] || null : null;
}
function occCodigoFirma() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => letras[b % letras.length]).join('');
}
function occTextoFirmado(f) {
  return f ? `Firmado digitalmente por ${f.nombre || ''} el ${fmtFechaHora(f.firmadoEn)} · Código ${f.codigo || ''}` : '';
}

// Ventana para volver a escribir la contraseña (se verifica con Firebase, no se guarda).
function pedirContrasenaFirma(texto) {
  return new Promise(resolve => {
    let modal = document.getElementById('modalFirmar');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'overlay';
      modal.id = 'modalFirmar';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `<div class="modal" style="max-width:420px">
      <div class="modalHead"><h3>✍️ Confirmar firma</h3></div>
      <p style="font-size:14px;color:#34423d;margin:.25rem 0 1rem">${escapeHtml(texto)}</p>
      <div class="fGroup"><label>Su contraseña</label><input type="password" id="firmaPwd" autocomplete="current-password"></div>
      <div id="firmaPwdError" style="color:var(--red);font-size:13px;min-height:18px;margin-top:.35rem"></div>
      <div class="modalActions" style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:.75rem">
        <button class="btn btn-outline" id="firmaCancelar">Cancelar</button>
        <button class="btn btn-primary" id="firmaOk">Firmar</button>
      </div>
    </div>`;
    const cerrar = ok => { modal.classList.remove('show'); resolve(ok); };
    const input = modal.querySelector('#firmaPwd');
    const error = modal.querySelector('#firmaPwdError');
    const ok = modal.querySelector('#firmaOk');
    const intentar = async () => {
      const pwd = input.value;
      if (!pwd) { error.textContent = 'Escriba su contraseña.'; input.focus(); return; }
      ok.disabled = true; ok.textContent = 'Verificando...'; error.textContent = '';
      try {
        const usuario = auth && auth.currentUser;
        if (!usuario || !usuario.email) throw { code:'sin-sesion' };
        const cred = firebase.auth.EmailAuthProvider.credential(usuario.email, pwd);
        await usuario.reauthenticateWithCredential(cred);
        cerrar(true);
      } catch (e) {
        ok.disabled = false; ok.textContent = 'Firmar';
        const codigo = e && e.code ? e.code : '';
        error.textContent = codigo === 'sin-sesion' ? 'No hay sesión activa. Vuelva a iniciar sesión.'
          : (codigo.includes('network') ? 'Sin conexión. Revise el internet e intente de nuevo.'
          : (codigo.includes('too-many') ? 'Demasiados intentos. Espere unos minutos.' : 'Contraseña incorrecta.'));
        input.select();
      }
    };
    modal.querySelector('#firmaCancelar').onclick = () => cerrar(false);
    ok.onclick = intentar;
    input.addEventListener('input', () => { error.textContent = ''; });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') intentar(); });
    modal.classList.add('show');
    setTimeout(() => input.focus(), 50);
  });
}

async function firmarDictamenes(ids) {
  const lista = occData().registros.filter(r => ids.map(String).includes(String(r.id)));
  const pendientes = lista.filter(r => !r.firmaMedico);
  const firmables = pendientes.filter(r => occPuedeFirmar(occMedicoDeRegistro(r)));
  if (!firmables.length) {
    const m = occMedicoDeRegistro(pendientes[0] || lista[0]);
    alert(!pendientes.length ? 'Ya están firmados.'
      : !m ? 'Primero elija el médico evaluador en la sección "Aptitud laboral" (Editar).'
      : !m.firma ? `${m.nombre} no tiene firma digital. Súbala en Empresas > Médicos evaluadores y firma.`
      : `Solo ${m.nombre} puede firmar estos dictámenes con su propio usuario.`);
    return;
  }
  const medico = occMedicoDeRegistro(firmables[0]);
  const texto = firmables.length === 1
    ? `Va a firmar el dictamen de ${firmables[0].nombre} como ${medico.nombre}.`
    : `Va a firmar ${firmables.length} dictámenes como ${medico.nombre}.`;
  if (!await pedirContrasenaFirma(texto)) return;
  const ahora = new Date().toISOString();
  ensureOcupacionalState();
  state.ocupacional.firmasPublicadas = state.ocupacional.firmasPublicadas || {};
  firmables.forEach(r => {
    const m = occMedicoDeRegistro(r);
    if (!m) return;
    const clave = occFirmaClave(m);
    if (!state.ocupacional.firmasPublicadas[clave]) state.ocupacional.firmasPublicadas[clave] = { firma:m.firma, sello:m.sello || '' };
    r.firmaMedico = { medicoId:m.id, clave, nombre:m.nombre, colegiado:m.colegiado || '', firmadoPor:currentUser.username, firmadoEn:ahora, codigo:occCodigoFirma() };
    r.medicoNombre = m.nombre; r.medicoColegiado = m.colegiado || '';
    r.updatedAt = ahora;
  });
  // Quita copias de firmas que ya ningún dictamen usa (por ejemplo, si cambió la foto de la firma).
  const enUso = new Set(occData().registros.map(r => r.firmaMedico?.clave).filter(Boolean));
  Object.keys(state.ocupacional.firmasPublicadas).forEach(k => { if (!enUso.has(k)) delete state.ocupacional.firmasPublicadas[k]; });
  const publicados = await Promise.all(firmables.map(occPublicarVerificacion));
  await saveAppData({ backupToFolder:true });
  await saveOccupationalStateToCloud(true);
  showToast(firmables.length === 1 ? 'Dictamen firmado.' : `${firmables.length} dictámenes firmados.`);
  if (publicados.some(ok => !ok)) alert(OCC_AVISO_QR);
  if (currentPage === 'occRegistros') renderOcupRegistros(); else if (currentPage === 'occDashboard') renderOcupDashboard();
}
function firmarPendientesJornada(key) {
  const ids = occData().registros.filter(r => occRegJornadaKey(r) === key && !r.firmaMedico).map(r => r.id);
  firmarDictamenes(ids);
}
async function quitarFirmaDictamen(id) {
  const r = occData().registros.find(x => String(x.id) === String(id));
  if (!r || !r.firmaMedico) return;
  if (!confirm(`¿Quitar la firma del dictamen de ${r.nombre}? Tendrá que volver a firmarlo.`)) return;
  occAnularVerificacion(r.firmaMedico.codigo);
  r.firmaMedico = null;
  r.updatedAt = new Date().toISOString();
  await saveAppData({ backupToFolder:true });
  await saveOccupationalStateToCloud(true);
  showToast('Firma quitada.');
  renderOcupRegistros();
}

// Lista de dictámenes firmados (dashboard): todos los usuarios la ven y pueden imprimir.
let occFirmadosBusca = '';
function occFilasFirmados(records) {
  const q = normalizeOccSearchText(occFirmadosBusca);
  const lista = records.filter(r => r.firmaMedico && (!q || normalizeOccSearchText(r.nombre).includes(q)))
    .sort((a, b) => String(b.fechaEvaluacion || '').localeCompare(String(a.fechaEvaluacion || '')) || String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  if (!lista.length) return `<div class="listaVacia">${q ? 'No hay dictámenes firmados con ese nombre.' : 'Aún no hay dictámenes firmados en estos filtros.'}</div>`;
  return `<div class="listaPlana">${lista.map(r => `<div class="filaSimple">
    <span class="filaTexto"><strong>${escapeHtml(r.nombre || '')}</strong><span class="filaSub">${escapeHtml(r.planta || '')} · ${fmtF(r.fechaEvaluacion)} · ${escapeHtml(r.puesto || 'Sin puesto')} · Firmó ${escapeHtml(r.firmaMedico.nombre || '')}</span></span>
    <span class="filaListaDer">
      <span class="badge ${occAptClass(r.aptitudLaboral)}">${escapeHtml(r.aptitudLaboral || '—')}</span>
      <button class="btn btn-sm btn-primary" onclick="imprimirDocumentoOcupacional('${r.id}','evaluacion')">📄 Dictamen</button>
      ${r.consentimientoFirma ? `<button class="btn btn-sm btn-outline" onclick="imprimirDocumentoOcupacional('${r.id}','consentimiento')">✍️ Consentimiento</button>` : ''}
    </span>
  </div>`).join('')}</div>`;
}
function occBuscarFirmados(valor) {
  occFirmadosBusca = valor || '';
  const box = document.getElementById('occFirmadosLista');
  if (box) box.innerHTML = occFilasFirmados(occDashRegistrosActuales || []);
}
let occDashRegistrosActuales = [];

// ── Código QR de verificación ──
// Al firmar se publica en Firestore "verificaciones/{código}" un resumen mínimo del dictamen. Cualquiera que
// tenga el papel escanea el QR y ve en verificar.html si es válido y con qué datos. Las reglas permiten leer
// un código a la vez (no listar), y solo administradores pueden crear o anular.
function occVerificacionUrl(codigo) {
  const base = location.origin + location.pathname.replace(/[^/]*$/, '');
  return `${base}verificar.html?c=${encodeURIComponent(codigo)}`;
}
function occQrSvg(texto, celda = 3) {
  if (typeof qrcode !== 'function') return '';
  const qr = qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  return qr.createSvgTag({ cellSize:celda, margin:1, scalable:true });
}
function occDatosVerificacion(r) {
  const f = r.firmaMedico || {};
  const dpi = String(r.dpi || '').replace(/\D/g, '');
  return {
    estado:'valido',
    empresa:occData().activeEmpresa || '',
    planta:r.planta || '',
    fechaEvaluacion:r.fechaEvaluacion || '',
    trabajador:r.nombre || '',
    expediente:r.expediente || '',
    dpiFinal:dpi ? dpi.slice(-4) : '',
    dictamen:occDictamenDeAptitud(r.aptitudLaboral).texto,
    medico:f.nombre || '',
    colegiado:f.colegiado || '',
    firmadoEn:f.firmadoEn || '',
    publicadoEn:new Date().toISOString()
  };
}
async function occPublicarVerificacion(r) {
  if (!r?.firmaMedico?.codigo || typeof db === 'undefined' || !db) return false;
  try {
    await db.collection('verificaciones').doc(r.firmaMedico.codigo).set(occDatosVerificacion(r));
    r.firmaMedico.qr = true;
    return true;
  } catch (e) {
    console.warn('No se pudo publicar la verificación', e);
    return false;
  }
}
function occAnularVerificacion(codigo) {
  if (!codigo || typeof db === 'undefined' || !db) return;
  db.collection('verificaciones').doc(codigo).set({ estado:'anulado', anuladoEn:new Date().toISOString() }, { merge:true })
    .catch(e => console.warn('No se pudo anular la verificación', e));
}
const OCC_AVISO_QR = 'Los dictámenes quedaron firmados, pero el código QR todavía no se pudo activar en Firebase. Revise que las reglas de Firestore tengan la parte de "verificaciones" y vuelva a imprimir: la app lo intentará de nuevo.';
