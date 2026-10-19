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

function occDictamenDeAptitud(aptitud) {
  return OCC_DICTAMENES.find(d => d.aptitud === aptitud) || OCC_DICTAMENES[0];
}

// ── Formulario ────────────────────────────────────
function renderOccCondicionesLaborales(editing, opciones = {}) {
  const valores = editing?.condicionesLaborales || {};
  const head = OCC_CONDICIONES_FRECUENCIAS.map(f => `<th>${escapeHtml(f.label.split(' (')[0])}</th>`).join('');
  const body = OCC_CONDICIONES_LABORALES.map((g, gi) => `
    <tr class="condGrupo"><td colspan="5">${escapeHtml(g.grupo)}</td></tr>
    ${g.filas.map((fila, fi) => {
      const key = occCondicionKey(gi, fi);
      return `<tr><td>${escapeHtml(fila)}</td>${OCC_CONDICIONES_FRECUENCIAS.map(f => `<td class="condCelda"><input type="radio" name="occCond_${key}" value="${f.key}" aria-label="${escapeHtml(fila)}: ${escapeHtml(f.label)}" ${valores[key] === f.key ? 'checked' : ''}></td>`).join('')}</tr>`;
    }).join('')}`).join('');
  const contenido = `<div class="attachHint" style="margin-bottom:.5rem">Marque la frecuencia de exposición según el puesto. Ocasional: menos de 30 h/mes · Frecuente: 30 a 140 h/mes · Permanente: más de 140 h/mes.</div>
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
  return `
  <div class="fRow">
    <div class="fGroup"><label>Detalle de la restricción (si aplica)</label><input id="occRestriccionDetalle" value="${escapeHtml(editing?.restriccionDetalle || '')}" placeholder="Ej: no levantar más de 10 kg"></div>
    <div class="fGroup"><label>Recomendaciones</label><textarea id="occRecomendaciones" rows="2">${escapeHtml(editing?.recomendaciones || '')}</textarea></div>
  </div>
  ${opciones.plano ? '<div class="occSubtitulo">Consentimiento informado</div><div>' : `<details class="fSection" ${firma ? '' : 'open'}>
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

function docFirmaMedico() {
  return `<div class="docSeccion">FIRMA DEL MÉDICO EVALUADOR</div>
    <div class="docFirmaMedico">
      <div class="docLinea"><span>Nombre:</span><i></i></div>
      <div class="docLinea"><span>Colegiado No.:</span><i></i></div>
      <div class="docLinea docLineaAlta"><span>Firma y sello:</span><i></i></div>
    </div>`;
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
    ${docFirmaMedico()}
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

function imprimirDocumentoOcupacional(id, tipo) {
  const r = occData().registros.find(x => String(x.id) === String(id));
  if (!r) { alert('No se encontró el registro.'); return; }
  if (tipo === 'consentimiento' && !r.consentimientoFirma && !confirm('Este trabajador todavía no ha firmado el consentimiento en pantalla. ¿Imprimirlo en blanco para firma a mano?')) return;
  let area = document.getElementById('printArea');
  if (!area) {
    area = document.createElement('div');
    area.id = 'printArea';
    document.body.appendChild(area);
  }
  area.innerHTML = tipo === 'consentimiento' ? documentoConsentimientoHtml(r) : documentoEvaluacionHtml(r);
  const tituloPrevio = document.title;
  document.title = `${tipo === 'consentimiento' ? 'Consentimiento' : 'Evaluacion'} ${r.nombre || ''} ${r.fechaEvaluacion || ''}`.trim();
  const imagenes = Array.from(area.querySelectorAll('img'));
  Promise.all(imagenes.map(img => img.complete ? null : new Promise(res => { img.onload = img.onerror = res; }))).then(() => {
    // El área de impresión solo se ve al imprimir (ver @media print en estilos.css).
    const terminar = () => { document.title = tituloPrevio; window.removeEventListener('afterprint', terminar); };
    window.addEventListener('afterprint', terminar);
    window.print();
  });
}
