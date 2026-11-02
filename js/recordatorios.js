// ── RECORDATORIOS SEMIAUTOMÁTICOS ─────────────────
// La app no envía nada sola: cada día dice a quién hay que escribirle y deja el mensaje listo.
// El doctor toca «Copiar y abrir WhatsApp», lo envía desde WhatsApp Business y marca la respuesta.
// • Sábado y domingo: recordatorio de todas las citas de la semana siguiente.
// • Un día antes de cada cita: recordatorio corto.
// • Si cambia el horario de un día con citas: aviso de cambio con la nueva hora propuesta.

const CLINICA_FIRMA = 'Clínica Dr. Allan Leal';
const CLINICA_DIRECCION = '8ª Calle 11-13, Zona 1, Edificio Recinos, Clínica 403';
const CLINICA_DIRECCION_CORTA = 'Clínica 403, Edificio Recinos, Zona 1';
const DIAS_SEMANA = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MESES_MIN = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
// Horario normal: lunes a jueves 4:30–6:30 p. m., viernes 3:00–6:30 p. m., sábado 9:00–14:00.
const HORARIO_BASE = {
  0:null,
  1:{ ini:'16:30', fin:'18:30' }, 2:{ ini:'16:30', fin:'18:30' }, 3:{ ini:'16:30', fin:'18:30' }, 4:{ ini:'16:30', fin:'18:30' },
  5:{ ini:'15:00', fin:'18:30' },
  6:{ ini:'09:00', fin:'14:00' }
};
const PLAZOS_CONTROL = {
  '15d':{ dias:15, t:'15 días' }, '1m':{ meses:1, t:'1 mes' }, '2m':{ meses:2, t:'2 meses' }, '3m':{ meses:3, t:'3 meses' },
  '4m':{ meses:4, t:'4 meses' }, '6m':{ meses:6, t:'6 meses' }, '12m':{ meses:12, t:'1 año' }
};

// ── Fechas y horas ──
function fechaObj(iso) { return new Date(`${iso}T12:00:00`); }
function isoDe(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function sumarDias(iso, n) { const d = fechaObj(iso); d.setDate(d.getDate() + n); return isoDe(d); }
function sumarMeses(iso, n) {
  const d = fechaObj(iso);
  const dia = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
  return isoDe(d);
}
function diaSemana(iso) { return fechaObj(iso).getDay(); }
function lunesDe(iso) { const dow = diaSemana(iso); return sumarDias(iso, dow === 0 ? -6 : 1 - dow); }
function lunesProximaSemana(hoy = todayLocalISO()) { return sumarDias(lunesDe(hoy), 7); }
function aMinutos(h) { const [a, b] = String(h || '0:0').split(':').map(Number); return (a || 0) * 60 + (b || 0); }
function aHora(m) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
function fechaLarga(iso) { const d = fechaObj(iso); return `${DIAS_SEMANA[d.getDay()]} ${d.getDate()} de ${MESES_MIN[d.getMonth()]}`; }
function fechaCorta(iso) { const d = fechaObj(iso); return `${DIAS_SEMANA[d.getDay()].slice(0, 3)} ${d.getDate()} ${MESES_MIN[d.getMonth()].slice(0, 3)}`; }
function horaBonita(h) {
  const m = aMinutos(h); const hh = Math.floor(m / 60); const mm = m % 60;
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'a. m.' : 'p. m.'}`;
}
function mayuscula(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }

// ── Horario de atención ──
function ensureHorario() {
  if (!state.horario || typeof state.horario !== 'object') state.horario = {};
  const h = state.horario;
  if (!h.base || typeof h.base !== 'object') h.base = JSON.parse(JSON.stringify(HORARIO_BASE));
  if (!h.excepciones || typeof h.excepciones !== 'object') h.excepciones = {};
  if (!Array.isArray(h.semanasConfirmadas)) h.semanasConfirmadas = [];
  return h;
}
function horarioDelDia(iso) {
  const h = ensureHorario();
  if (Object.prototype.hasOwnProperty.call(h.excepciones, iso)) return h.excepciones[iso] || null;
  return h.base[diaSemana(iso)] || null;
}
function duracionCita(c) {
  if (c && Number(c.duracion) > 0) return Number(c.duracion);
  return /primera/i.test(c?.tipo || '') ? 60 : 30;
}
function duracionPorTipo(tipo) { return /primera/i.test(tipo || '') ? 60 : 30; }
function citaActiva(c) { return c && c.estado !== 'cancelada'; }
function citaCabeEnHorario(fecha, hora, dur) {
  const h = horarioDelDia(fecha);
  if (!h) return false;
  const ini = aMinutos(hora);
  return ini >= aMinutos(h.ini) && ini + dur <= aMinutos(h.fin);
}
function citaChoca(fecha, hora, dur, excluirIds = [], extra = []) {
  const ini = aMinutos(hora); const fin = ini + dur;
  const excl = excluirIds.map(String);
  const ocupadas = state.citas.filter(c => citaActiva(c) && c.fecha === fecha && !excl.includes(String(c.id)))
    .map(c => ({ ini:aMinutos(c.hora), fin:aMinutos(c.hora) + duracionCita(c) }))
    .concat(extra.filter(x => x.fecha === fecha).map(x => ({ ini:aMinutos(x.hora), fin:aMinutos(x.hora) + x.dur })));
  return ocupadas.find(o => ini < o.fin && fin > o.ini) || null;
}
// Busca los primeros espacios libres desde una fecha (en bloques de 30 minutos).
function buscarEspacios(desde, dur, opciones = {}) {
  const max = opciones.max || 1;
  const excluir = opciones.excluir || [];
  const extra = opciones.extra || [];
  const hoy = todayLocalISO();
  const ahora = new Date();
  const minHoy = ahora.getHours() * 60 + ahora.getMinutes();
  let fecha = desde < hoy ? hoy : desde;
  const res = [];
  for (let i = 0; i < (opciones.maxDias || 120) && res.length < max; i++, fecha = sumarDias(fecha, 1)) {
    const h = horarioDelDia(fecha);
    if (!h) continue;
    for (let m = aMinutos(h.ini); m + dur <= aMinutos(h.fin) && res.length < max; m += 30) {
      if (fecha === hoy && m <= minHoy) continue;
      if (!citaChoca(fecha, aHora(m), dur, excluir, extra)) res.push({ fecha, hora:aHora(m) });
    }
  }
  return res;
}
function primerEspacioLibre(desde, dur, opciones = {}) { return buscarEspacios(desde, dur, { ...opciones, max:1 })[0] || null; }

// ── Teléfono y WhatsApp ──
function telefonoWhatsApp(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (d.length === 8) d = '502' + d;
  return d.length >= 10 ? d : '';
}
function copiarTexto(texto) {
  let ok = false;
  try {
    const ta = document.createElement('textarea');
    ta.value = texto; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, texto.length);
    ok = document.execCommand('copy');
    document.body.removeChild(ta);
  } catch (e) {}
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).catch(() => {});
  return ok;
}
function abrirWhatsApp(tel, texto) {
  const num = telefonoWhatsApp(tel);
  if (!num) return false;
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  return true;
}
function openClinicWhatsApp(text = '') {
  const phone = (state.socialLinks?.whatsapp || '+50238006697').replace(/\D/g, '');
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

// ── Mensajes (sin diagnóstico ni datos clínicos) ──
function nombreSaludo(c) { return (getPac(c.pacienteId)?.nombre || '').trim(); }
function mensajeAviso(c, tipo) {
  const nombre = nombreSaludo(c);
  const cuando = `📅 ${mayuscula(fechaLarga(c.fecha))}\n⏰ ${horaBonita(c.hora)}`;
  const tele = /telemedicina/i.test(c.tipo || '');
  const dom = /domiciliar/i.test(c.tipo || '');
  const lugar = tele ? '💻 Consulta por videollamada' : (dom ? '🏠 Visita a domicilio' : `📍 ${CLINICA_DIRECCION}`);
  if (tipo === 'diaAntes') {
    const donde = tele ? 'por videollamada' : (dom ? 'en su domicilio' : `en ${CLINICA_DIRECCION_CORTA}`);
    return `Hola, ${nombre} 👋 Le recordamos su cita de mañana ${fechaLarga(c.fecha)} a las ${horaBonita(c.hora)} ${donde}.\n\nSi no puede asistir, responda *CAMBIAR*.\n\n${CLINICA_FIRMA}`;
  }
  if (tipo === 'cambio') {
    const ant = c.avisos?.cambio?.anterior;
    return `Hola, ${nombre}. Le saluda ${CLINICA_FIRMA}.\n\nPor un cambio en el horario de la clínica, su cita${ant ? ` del ${fechaLarga(ant.fecha)} a las ${horaBonita(ant.hora)}` : ''} pasó a:\n\n${cuando}\n${lugar}\n\nResponda *SÍ* si le queda bien o *CAMBIAR* para buscarle otro horario. Disculpe la molestia.\n\n${CLINICA_FIRMA}`;
  }
  if (tipo === 'reprogramada') {
    return `Hola, ${nombre}. Listo, su cita quedó para:\n\n${cuando}\n${lugar}\n\nLe esperamos.\n\n${CLINICA_FIRMA}`;
  }
  if (tipo === 'control') {
    return `Hola, ${nombre}. Le saluda ${CLINICA_FIRMA}.\n\nLe dejamos agendada su próxima cita de control:\n\n${cuando}\n${lugar}\n\nUnos días antes le escribiremos para confirmar.\n\n${CLINICA_FIRMA}`;
  }
  return `Hola, ${nombre}. Le saluda ${CLINICA_FIRMA} 👋\n\nLe recordamos su cita:\n\n${cuando}\n${lugar}\n\nPor favor responda *SÍ* para confirmar o *CAMBIAR* si necesita otro horario.\n\n${CLINICA_FIRMA}`;
}
const AVISO_ETIQUETA = { semana:'Recordatorio de la semana', diaAntes:'Cita mañana · recordatorio corto', cambio:'Cambio de horario' };

// ── Qué toca enviar hoy ──
function avisoEnviado(c, tipo) { return tipo === 'cambio' ? !!c.avisos?.cambio?.enviado : !!c.avisos?.[tipo]; }
function avisosPorEnviar(hoy = todayLocalISO()) {
  const dow = diaSemana(hoy);
  const finDeSemana = dow === 6 || dow === 0;
  const mañana = sumarDias(hoy, 1);
  // Fin de semana: toda la semana siguiente. Entre semana: se ponen al día las citas que no se avisaron (2+ días).
  const desde = finDeSemana ? mañana : sumarDias(hoy, 2);
  const hasta = sumarDias(finDeSemana ? lunesProximaSemana(hoy) : lunesDe(hoy), 5);
  const lista = [];
  state.citas.filter(c => citaActiva(c) && c.fecha >= hoy).forEach(c => {
    if (c.avisos?.cambio?.pendiente && !c.avisos.cambio.enviado) { lista.push({ c, tipo:'cambio' }); return; }
    if (c.fecha === mañana && !avisoEnviado(c, 'diaAntes')) {
      const semanaHoy = String(c.avisos?.semana || '').slice(0, 10) === hoy;
      if (!semanaHoy) { lista.push({ c, tipo:'diaAntes' }); return; }
    }
    if (c.fecha >= desde && c.fecha <= hasta && c.fecha !== mañana && c.estado !== 'confirmada' && !avisoEnviado(c, 'semana')) lista.push({ c, tipo:'semana' });
  });
  const orden = { cambio:0, diaAntes:1, semana:2 };
  return lista.sort((a, b) => orden[a.tipo] - orden[b.tipo] || (a.c.fecha + a.c.hora).localeCompare(b.c.fecha + b.c.hora));
}
function citasEsperandoRespuesta(hoy = todayLocalISO(), porEnviar = avisosPorEnviar(hoy)) {
  const ids = porEnviar.map(x => String(x.c.id));
  return state.citas.filter(c => citaActiva(c) && c.fecha >= hoy && c.estado === 'pendiente' && !c.sinRespuesta && !ids.includes(String(c.id))
    && (c.avisos?.semana || c.avisos?.diaAntes || c.avisos?.cambio?.enviado))
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
}
function citasPorLlamar(hoy = todayLocalISO()) {
  return state.citas.filter(c => citaActiva(c) && c.fecha >= hoy && c.estado === 'pendiente' && c.sinRespuesta)
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
}
function contarAvisosPorEnviar() { return avisosPorEnviar().length; }

// ── Acciones ──
function citaPorId(id) { return state.citas.find(x => String(x.id) === String(id)); }
function guardarYRefrescarAvisos() {
  saveAppData({ backupToFolder:true });
  refreshClinicPage('recordatorios');
}
function enviarAviso(id, tipo) {
  const c = citaPorId(id);
  if (!c) return;
  const texto = mensajeAviso(c, tipo);
  copiarTexto(texto);
  const abierto = abrirWhatsApp(getPac(c.pacienteId)?.tel, texto);
  c.avisos = c.avisos || {};
  const ahora = new Date().toISOString();
  if (tipo === 'cambio') c.avisos.cambio = { ...(c.avisos.cambio || {}), pendiente:false, enviado:ahora };
  else c.avisos[tipo] = ahora;
  c.sinRespuesta = false;
  showToast(abierto ? '📋 Mensaje copiado. Si WhatsApp no lo trae escrito, péguelo y envíelo.' : '📋 Mensaje copiado. El paciente no tiene teléfono válido: péguelo donde corresponda.');
  setTimeout(guardarYRefrescarAvisos, 400);
}
function copiarAvisoOtraVez(id) {
  const c = citaPorId(id);
  if (!c) return;
  const tipo = c.avisos?.cambio?.enviado && !c.avisos?.semana ? 'cambio' : (c.fecha === sumarDias(todayLocalISO(), 1) ? 'diaAntes' : 'semana');
  const texto = mensajeAviso(c, tipo);
  copiarTexto(texto);
  abrirWhatsApp(getPac(c.pacienteId)?.tel, texto);
  showToast('📋 Mensaje copiado otra vez.');
}
function respuestaCita(id, resultado) {
  const c = citaPorId(id);
  if (!c) return;
  if (resultado === 'confirmo') { c.estado = 'confirmada'; c.sinRespuesta = false; showToast(`✅ ${nombreSaludo(c)} confirmó.`); }
  else if (resultado === 'noContesto') { c.sinRespuesta = true; showToast('📵 Pasó a «Por llamar».'); }
  else if (resultado === 'cancelo') {
    if (!confirm(`¿${nombreSaludo(c)} canceló la cita del ${fechaLarga(c.fecha)}? El espacio queda libre.`)) return;
    c.estado = 'cancelada'; c.sinRespuesta = false;
  }
  guardarYRefrescarAvisos();
}
function llamarPaciente(id) {
  const c = citaPorId(id);
  const tel = String(getPac(c?.pacienteId)?.tel || '').replace(/[^\d+]/g, '');
  if (!tel) { alert('Este paciente no tiene teléfono guardado.'); return; }
  window.location.href = `tel:${tel}`;
}

// ── Cambiar la cita (el paciente pidió otro horario) ──
function asegurarModal(id) {
  let m = document.getElementById(id);
  if (!m) { m = document.createElement('div'); m.className = 'overlay'; m.id = id; document.body.appendChild(m); }
  return m;
}
function abrirCambiarCita(id, desde) {
  const c = citaPorId(id);
  if (!c) return;
  const dur = duracionCita(c);
  const inicio = desde || (c.fecha > todayLocalISO() ? c.fecha : todayLocalISO());
  const espacios = buscarEspacios(inicio, dur, { max:13, excluir:[c.id] }).filter(e => !(e.fecha === c.fecha && e.hora === c.hora)).slice(0, 12);
  const m = asegurarModal('modalCambiarCita');
  m.innerHTML = `<div class="modal" style="max-width:520px">
    <div class="modalHead"><h3>📅 Cambiar cita</h3><button class="btnClose" onclick="closeModal('modalCambiarCita')">✕</button></div>
    <p class="avisoNota"><strong>${escapeHtml(nombreSaludo(c))}</strong> · ahora: ${escapeHtml(mayuscula(fechaLarga(c.fecha)))}, ${horaBonita(c.hora)} · ${dur} min</p>
    <div class="fGroup"><label>Buscar espacios desde</label><input type="date" id="cambiarDesde" value="${inicio}" onchange="abrirCambiarCita('${c.id}', this.value)"></div>
    <div class="espaciosLista">${espacios.length ? espacios.map(e => `<button type="button" class="espacioBtn" onclick="moverCitaA('${c.id}','${e.fecha}','${e.hora}')"><b>${escapeHtml(mayuscula(fechaCorta(e.fecha)))}</b><span>${horaBonita(e.hora)}</span></button>`).join('') : '<div class="listaVacia">No hay espacios libres en su horario. Pruebe otra fecha o cambie el horario de esa semana.</div>'}</div>
  </div>`;
  openModal('modalCambiarCita');
}
function moverCitaA(id, fecha, hora) {
  const c = citaPorId(id);
  if (!c) return;
  c.fecha = fecha; c.hora = hora;
  c.estado = 'confirmada'; c.sinRespuesta = false;
  c.avisos = { semana:new Date().toISOString() };
  saveAppData({ backupToFolder:true });
  const texto = mensajeAviso(c, 'reprogramada');
  const m = asegurarModal('modalCambiarCita');
  m.innerHTML = `<div class="modal" style="max-width:520px">
    <div class="modalHead"><h3>✅ Cita cambiada</h3><button class="btnClose" onclick="closeModal('modalCambiarCita');refreshClinicPage('recordatorios')">✕</button></div>
    <p class="avisoNota">Quedó para <strong>${escapeHtml(fechaLarga(fecha))}, ${horaBonita(hora)}</strong>. Envíele la confirmación:</p>
    <pre class="avisoMsg">${escapeHtml(texto)}</pre>
    <div class="avisoBtns">
      <button class="btn btn-primary" onclick="copiarTexto(document.querySelector('#modalCambiarCita .avisoMsg').textContent);abrirWhatsApp('${escapeHtml(getPac(c.pacienteId)?.tel || '')}', document.querySelector('#modalCambiarCita .avisoMsg').textContent);closeModal('modalCambiarCita');refreshClinicPage('recordatorios')">📋 Copiar y abrir WhatsApp</button>
      <button class="btn btn-outline" onclick="closeModal('modalCambiarCita');refreshClinicPage('recordatorios')">Listo</button>
    </div>
  </div>`;
}

// ── Horario de la semana (se pregunta cada fin de semana) ──
function horarioSemanaPendiente(hoy = todayLocalISO()) {
  const dow = diaSemana(hoy);
  if (dow !== 6 && dow !== 0) return null;
  const lunes = lunesProximaSemana(hoy);
  return ensureHorario().semanasConfirmadas.includes(lunes) ? null : lunes;
}
function bannerHorario() {
  if (typeof isSoloOcupacional === 'function' && isSoloOcupacional()) return '';
  const lunes = horarioSemanaPendiente();
  if (!lunes) return '';
  return `<div class="avisoBanner">
    <div><strong>🗓️ ¿Su horario de la próxima semana es el de siempre?</strong><span>Semana del ${escapeHtml(fechaLarga(lunes))} · ${escapeHtml(resumenHorarioSemana(lunes))}</span></div>
    <div class="avisoBtns"><button class="btn btn-primary btn-sm" onclick="confirmarSemanaIgual('${lunes}')">✅ Sí, igual</button><button class="btn btn-outline btn-sm" onclick="abrirHorarioSemana('${lunes}')">✏️ Cambiar</button></div>
  </div>`;
}
function rangoHoras(h) {
  const a = horaBonita(h.ini), b = horaBonita(h.fin);
  return a.slice(-5) === b.slice(-5) ? `${a.slice(0, -6)}–${b}` : `${a}–${b}`;
}
// «lun–jue 4:30–6:30 p. m. · vie 3:00–6:30 p. m. · sáb 9:00 a. m.–2:00 p. m.»
function resumenHorarioSemana(lunes) {
  const dias = [0, 1, 2, 3, 4, 5].map(i => { const f = sumarDias(lunes, i); return { d:DIAS_SEMANA[diaSemana(f)].slice(0, 3), h:horarioDelDia(f) }; });
  const grupos = [];
  dias.forEach(x => {
    const txt = x.h ? rangoHoras(x.h) : 'sin consulta';
    const ult = grupos[grupos.length - 1];
    if (ult && ult.txt === txt) ult.fin = x.d; else grupos.push({ ini:x.d, fin:x.d, txt });
  });
  return grupos.map(g => `${g.ini}${g.fin !== g.ini ? '–' + g.fin : ''} ${g.txt}`).join(' · ');
}
function confirmarSemanaIgual(lunes) {
  const h = ensureHorario();
  if (!h.semanasConfirmadas.includes(lunes)) h.semanasConfirmadas.push(lunes);
  h.semanasConfirmadas = h.semanasConfirmadas.slice(-20);
  saveAppData({ backupToFolder:true });
  showToast('🗓️ Horario confirmado.');
  refreshClinicPage('recordatorios');
}
function abrirHorarioSemana(lunes) {
  lunes = lunes || lunesDe(todayLocalISO());
  const m = asegurarModal('modalHorario');
  const filas = [0, 1, 2, 3, 4, 5].map(i => {
    const f = sumarDias(lunes, i); const h = horarioDelDia(f);
    const n = state.citas.filter(c => citaActiva(c) && c.fecha === f).length;
    return `<div class="horarioFila" data-fecha="${f}">
      <label class="horarioDia"><input type="checkbox" ${h ? 'checked' : ''} onchange="this.closest('.horarioFila').classList.toggle('cerrado', !this.checked)"> <b>${escapeHtml(mayuscula(fechaCorta(f)))}</b>${n ? `<small>${plural(n, 'cita', 'citas')}</small>` : ''}</label>
      <input type="time" class="hIni" value="${h ? h.ini : '16:30'}" step="1800" aria-label="Desde">
      <span>a</span>
      <input type="time" class="hFin" value="${h ? h.fin : '18:30'}" step="1800" aria-label="Hasta">
    </div>`;
  }).join('');
  m.innerHTML = `<div class="modal" style="max-width:520px">
    <div class="modalHead"><h3>🗓️ Horario · semana del ${escapeHtml(fechaLarga(lunes))}</h3><button class="btnClose" onclick="closeModal('modalHorario')">✕</button></div>
    <p class="avisoNota">Quite el cheque si ese día no atiende. Las citas nuevas y los controles solo se agendan dentro de este horario.</p>
    <div id="horarioFilas">${filas}</div>
    <label class="horarioBase"><input type="checkbox" id="horarioComoBase"> Usar este horario para todas las semanas</label>
    <div class="modalActions">
      <button class="btn btn-outline" onclick="closeModal('modalHorario')">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarHorarioSemana('${lunes}')">💾 Guardar horario</button>
    </div>
  </div>`;
  m.querySelectorAll('.horarioFila').forEach(f => f.classList.toggle('cerrado', !f.querySelector('input[type=checkbox]').checked));
  openModal('modalHorario');
}
function guardarHorarioSemana(lunes) {
  const h = ensureHorario();
  const comoBase = document.getElementById('horarioComoBase')?.checked;
  const filas = [...document.querySelectorAll('#horarioFilas .horarioFila')];
  for (const fila of filas) {
    const abre = fila.querySelector('input[type=checkbox]').checked;
    const ini = fila.querySelector('.hIni').value; const fin = fila.querySelector('.hFin').value;
    if (abre && (!ini || !fin || aMinutos(fin) <= aMinutos(ini))) { alert(`Revise las horas del ${fechaLarga(fila.dataset.fecha)}.`); return; }
  }
  filas.forEach(fila => {
    const f = fila.dataset.fecha;
    const abre = fila.querySelector('input[type=checkbox]').checked;
    const val = abre ? { ini:fila.querySelector('.hIni').value, fin:fila.querySelector('.hFin').value } : null;
    if (comoBase) { h.base[diaSemana(f)] = val; delete h.excepciones[f]; return; }
    const base = h.base[diaSemana(f)] || null;
    if (JSON.stringify(base) === JSON.stringify(val)) delete h.excepciones[f];
    else h.excepciones[f] = val;
  });
  if (!h.semanasConfirmadas.includes(lunes)) h.semanasConfirmadas.push(lunes);
  h.semanasConfirmadas = h.semanasConfirmadas.slice(-20);
  // Limpia excepciones viejas
  const corte = sumarDias(todayLocalISO(), -30);
  Object.keys(h.excepciones).forEach(f => { if (f < corte) delete h.excepciones[f]; });
  saveAppData({ backupToFolder:true });
  closeModal('modalHorario');
  const desde = comoBase ? todayLocalISO() : lunes;
  const hasta = comoBase ? sumarDias(todayLocalISO(), 180) : sumarDias(lunes, 6);
  revisarCitasFueraDeHorario(desde, hasta);
}
// Citas que quedaron fuera del horario: se propone el primer espacio libre y un mensaje listo.
let propuestasCambio = [];
function revisarCitasFueraDeHorario(desde, hasta) {
  const hoy = todayLocalISO();
  const afectadas = state.citas.filter(c => citaActiva(c) && c.fecha >= (desde > hoy ? desde : hoy) && c.fecha <= hasta && !citaCabeEnHorario(c.fecha, c.hora, duracionCita(c)))
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  if (!afectadas.length) { showToast('🗓️ Horario guardado. Ninguna cita quedó afectada.'); refreshClinicPage('recordatorios'); return; }
  const reservados = [];
  const ids = afectadas.map(c => c.id);
  propuestasCambio = afectadas.map(c => {
    const dur = duracionCita(c);
    const e = primerEspacioLibre(c.fecha, dur, { excluir:ids, extra:reservados });
    if (e) reservados.push({ ...e, dur });
    return { id:c.id, nueva:e };
  });
  const m = asegurarModal('modalAfectadas');
  m.innerHTML = `<div class="modal" style="max-width:560px">
    <div class="modalHead"><h3>⚠️ ${plural(afectadas.length, 'cita quedó', 'citas quedaron')} fuera del horario</h3><button class="btnClose" onclick="closeModal('modalAfectadas');refreshClinicPage('recordatorios')">✕</button></div>
    <p class="avisoNota">Le propongo el primer espacio libre para cada paciente. Al mover, el aviso de cambio aparece en «Por enviar hoy» con el mensaje listo.</p>
    <div class="listaPlana">${afectadas.map((c, i) => `<div class="filaSimple"><span class="filaTexto"><strong>${escapeHtml(nombreSaludo(c))}</strong>
      <span class="filaSub">${escapeHtml(mayuscula(fechaCorta(c.fecha)))} ${horaBonita(c.hora)} → ${propuestasCambio[i].nueva ? `<b>${escapeHtml(mayuscula(fechaCorta(propuestasCambio[i].nueva.fecha)))} ${horaBonita(propuestasCambio[i].nueva.hora)}</b>` : 'sin espacio libre (muévala desde Agenda)'}</span></span></div>`).join('')}</div>
    <div class="modalActions">
      <button class="btn btn-outline" onclick="closeModal('modalAfectadas');refreshClinicPage('recordatorios')">Dejarlas como están</button>
      <button class="btn btn-primary" onclick="aplicarPropuestasCambio()">📅 Mover y preparar avisos</button>
    </div>
  </div>`;
  openModal('modalAfectadas');
}
function aplicarPropuestasCambio() {
  let n = 0;
  propuestasCambio.forEach(p => {
    const c = citaPorId(p.id);
    if (!c || !p.nueva) return;
    const anterior = { fecha:c.fecha, hora:c.hora };
    c.fecha = p.nueva.fecha; c.hora = p.nueva.hora;
    c.estado = 'pendiente'; c.sinRespuesta = false;
    c.avisos = { cambio:{ pendiente:true, anterior } };
    n++;
  });
  propuestasCambio = [];
  saveAppData({ backupToFolder:true });
  closeModal('modalAfectadas');
  showToast(`📅 ${plural(n, 'cita movida', 'citas movidas')}. Los avisos están en «Por enviar hoy».`);
  if (currentPage === 'recordatorios') renderRecordatorios(); else goTo('recordatorios');
}

// ── Próximo control desde la historia clínica ──
function fechaObjetivoControl(desde, plazo) {
  const p = PLAZOS_CONTROL[plazo];
  if (!p) return null;
  return p.dias ? sumarDias(desde, p.dias) : sumarMeses(desde, p.meses);
}
// Devuelve la cita agendada (o movida) o null. No envía nada: el paciente está en consulta.
function agendarControlDesdeHistoria(h) {
  if (!h || !h.proximoControl || !PLAZOS_CONTROL[h.proximoControl]) return null;
  const existente = h.citaControlId ? citaPorId(h.citaControlId) : null;
  if (existente && citaActiva(existente) && existente.controlPlazo === h.proximoControl) return null;
  const manana = sumarDias(todayLocalISO(), 1);
  let objetivo = fechaObjetivoControl(h.fecha || todayLocalISO(), h.proximoControl);
  if (objetivo < manana) objetivo = manana;
  const espacio = primerEspacioLibre(objetivo, 30, { excluir:existente ? [existente.id] : [] });
  if (!espacio) { alert('No encontré espacio libre en su horario para el control. Agéndelo a mano desde Agenda.'); return null; }
  if (existente && citaActiva(existente)) {
    Object.assign(existente, { fecha:espacio.fecha, hora:espacio.hora, controlPlazo:h.proximoControl, estado:'pendiente', avisos:{}, sinRespuesta:false });
    return existente;
  }
  const cita = {
    id:state.nextCitaId++,
    pacienteId:h.pacienteId,
    fecha:espacio.fecha,
    hora:espacio.hora,
    tipo:'Presencial - Seguimiento',
    duracion:30,
    notas:`Control en ${PLAZOS_CONTROL[h.proximoControl].t} (agendado desde la historia)`,
    recordatorio:'Calendario general',
    estado:'pendiente',
    origen:'control',
    controlPlazo:h.proximoControl,
    historiaId:h.id,
    avisos:{}
  };
  state.citas.push(cita);
  h.citaControlId = cita.id;
  return cita;
}
function infoControlHistoria(h) {
  const box = document.getElementById('hControlInfo');
  if (!box) return;
  const c = h && h.citaControlId ? citaPorId(h.citaControlId) : null;
  box.textContent = c && citaActiva(c) ? `Agendado: ${mayuscula(fechaLarga(c.fecha))}, ${horaBonita(c.hora)} (${c.estado}).` : 'Al guardar, la app aparta el primer espacio libre en su horario.';
}
function avisoControlAgendado(c) {
  if (!c) return;
  const m = asegurarModal('modalControlAgendado');
  const texto = mensajeAviso(c, 'control');
  m.innerHTML = `<div class="modal" style="max-width:480px">
    <div class="modalHead"><h3>📅 Control agendado</h3><button class="btnClose" onclick="closeModal('modalControlAgendado')">✕</button></div>
    <p class="avisoNota"><strong>${escapeHtml(nombreSaludo(c))}</strong>: ${escapeHtml(mayuscula(fechaLarga(c.fecha)))}, ${horaBonita(c.hora)}<br>Dígaselo en consulta; si prefiere, también puede mandarle este mensaje.</p>
    <pre class="avisoMsg">${escapeHtml(texto)}</pre>
    <div class="avisoBtns">
      <button class="btn btn-outline" onclick="abrirCambiarCita('${c.id}');closeModal('modalControlAgendado')">📅 Otra fecha</button>
      <button class="btn btn-outline" onclick="enviarTextoPaciente('${c.id}', document.querySelector('#modalControlAgendado .avisoMsg').textContent);closeModal('modalControlAgendado')">📋 Enviar por WhatsApp</button>
      <button class="btn btn-primary" onclick="closeModal('modalControlAgendado')">Listo</button>
    </div>
  </div>`;
  openModal('modalControlAgendado');
}
function enviarTextoPaciente(id, texto) {
  const c = citaPorId(id);
  copiarTexto(texto);
  abrirWhatsApp(getPac(c?.pacienteId)?.tel, texto);
  showToast('📋 Mensaje copiado.');
}

// ── Pantalla ──
function filaAviso(item) {
  const { c, tipo } = item;
  const pac = getPac(c.pacienteId);
  const tel = telefonoWhatsApp(pac?.tel);
  return `<div class="avisoItem tipo-${tipo}">
    <div class="avisoCab"><strong>${escapeHtml(pac?.nombre || 'Paciente')}</strong><span class="avisoTipo">${AVISO_ETIQUETA[tipo]}</span></div>
    <div class="avisoSub">📅 ${escapeHtml(mayuscula(fechaCorta(c.fecha)))} · ⏰ ${horaBonita(c.hora)} · ${escapeHtml(c.tipo || '')}${tel ? '' : ' · <b class="sinTel">sin teléfono</b>'}</div>
    <details class="avisoVer"><summary>Ver mensaje</summary><pre class="avisoMsg">${escapeHtml(mensajeAviso(c, tipo))}</pre></details>
    <div class="avisoBtns">
      <button class="btn btn-primary" onclick="enviarAviso('${c.id}','${tipo}')">📋 Copiar y abrir WhatsApp</button>
      ${tel ? `<button class="btn btn-outline" onclick="llamarPaciente('${c.id}')">📞 Llamar</button>` : ''}
    </div>
  </div>`;
}
function filaRespuesta(c, llamar) {
  const pac = getPac(c.pacienteId);
  const enviado = c.avisos?.diaAntes || c.avisos?.semana || c.avisos?.cambio?.enviado;
  return `<div class="avisoItem ${llamar ? 'tipo-llamar' : 'tipo-espera'}">
    <div class="avisoCab"><strong>${escapeHtml(pac?.nombre || 'Paciente')}</strong><span class="avisoTipo">${llamar ? 'No contestó' : `Enviado ${enviado ? escapeHtml(fechaCorta(String(enviado).slice(0, 10))) : ''}`}</span></div>
    <div class="avisoSub">📅 ${escapeHtml(mayuscula(fechaCorta(c.fecha)))} · ⏰ ${horaBonita(c.hora)} · ${escapeHtml(c.tipo || '')}${pac?.tel ? ` · ${escapeHtml(pac.tel)}` : ''}</div>
    <div class="avisoBtns">
      <button class="btn btn-sm btn-primary" onclick="respuestaCita('${c.id}','confirmo')">✅ Confirmó</button>
      <button class="btn btn-sm btn-outline" onclick="abrirCambiarCita('${c.id}')">📅 Cambiar</button>
      ${llamar ? (pac?.tel ? `<button class="btn btn-sm btn-outline" onclick="llamarPaciente('${c.id}')">📞 Llamar</button>` : '') : `<button class="btn btn-sm btn-outline" onclick="respuestaCita('${c.id}','noContesto')">📵 No contestó</button>`}
      <button class="btn btn-sm btn-outline" onclick="copiarAvisoOtraVez('${c.id}')">💬 Escribir otra vez</button>
      <button class="btn btn-sm btn-outline btnCancelo" onclick="respuestaCita('${c.id}','cancelo')">❌ Canceló</button>
    </div>
  </div>`;
}
function respuestasRapidas() {
  const h = ensureHorario();
  const dias = [1, 2, 3, 4, 5, 6].map(d => h.base[d] ? `${mayuscula(DIAS_SEMANA[d])}: ${horaBonita(h.base[d].ini)} a ${horaBonita(h.base[d].fin)}` : `${mayuscula(DIAS_SEMANA[d])}: no hay consulta`).join('\n');
  return [
    { atajo:'/direccion', texto:`📍 ${CLINICA_DIRECCION}.\nGuatemala.\n\n${CLINICA_FIRMA}` },
    { atajo:'/horario', texto:`🕐 Horario de consulta (con cita):\n${dias}\n\n${CLINICA_FIRMA}` },
    { atajo:'/primera', texto:`Con gusto le atendemos. La primera consulta dura aproximadamente 1 hora. Por favor traiga su DPI, sus medicamentos actuales y exámenes recientes si los tiene.\n\n${CLINICA_FIRMA}` },
    { atajo:'/confirmada', texto:`¡Gracias! Su cita queda confirmada. Le esperamos.\n\n${CLINICA_FIRMA}` }
  ];
}
function renderRecordatorios() {
  const hoy = todayLocalISO();
  const porEnviar = avisosPorEnviar(hoy);
  const espera = citasEsperandoRespuesta(hoy, porEnviar);
  const llamar = citasPorLlamar(hoy);
  const dow = diaSemana(hoy);
  const lunesSig = lunesProximaSemana(hoy);
  setC(`
${bannerHorario()}
<div class="avisoResumen">
  <div class="avisoChip ${porEnviar.length ? 'activo' : ''}"><b>${porEnviar.length}</b><span>por enviar hoy</span></div>
  <div class="avisoChip"><b>${espera.length}</b><span>esperando respuesta</span></div>
  <div class="avisoChip ${llamar.length ? 'alerta' : ''}"><b>${llamar.length}</b><span>por llamar</span></div>
</div>
<div class="card">
  <div class="cardTitle">📤 Por enviar hoy</div>
  <p class="avisoNota">${dow === 6 || dow === 0 ? `Fin de semana: avise a los pacientes de la semana del ${escapeHtml(fechaLarga(lunesSig))}.` : 'Recordatorios cortos de las citas de mañana y avisos pendientes.'} Toque el botón, WhatsApp se abre con el mensaje escrito y solo lo envía.</p>
  ${porEnviar.length ? porEnviar.map(filaAviso).join('') : '<div class="listaVacia">✅ Nada por enviar hoy.</div>'}
</div>
<div class="card">
  <div class="cardTitle">⏳ Esperando respuesta</div>
  <p class="avisoNota">Cuando el paciente conteste, marque lo que respondió.</p>
  ${espera.length ? espera.map(c => filaRespuesta(c, false)).join('') : '<div class="listaVacia">Nadie pendiente de responder.</div>'}
</div>
<div class="card">
  <div class="cardTitle">📞 Por llamar</div>
  ${llamar.length ? llamar.map(c => filaRespuesta(c, true)).join('') : '<div class="listaVacia">No hay pacientes por llamar.</div>'}
</div>
<div class="card">
  <div class="cardTitle">🗓️ Horario de atención</div>
  <p class="avisoNota">Esta semana: ${escapeHtml(resumenHorarioSemana(lunesDe(hoy)))}</p>
  <div class="avisoBtns">
    <button class="btn btn-outline" onclick="abrirHorarioSemana('${lunesDe(hoy)}')">✏️ Esta semana</button>
    <button class="btn btn-outline" onclick="abrirHorarioSemana('${lunesSig}')">✏️ Próxima semana</button>
  </div>
  <p class="avisoNota" style="margin-top:.6rem">Primera consulta: 1 hora · Seguimiento: 30 minutos.</p>
</div>
<details class="card avisoRapidas">
  <summary class="cardTitle">💬 Respuestas rápidas para WhatsApp Business</summary>
  <p class="avisoNota">Guárdelas una vez en WhatsApp Business (Herramientas para la empresa → Respuestas rápidas) con el atajo indicado.</p>
  ${respuestasRapidas().map((r, i) => `<div class="rapidaItem"><div class="avisoCab"><strong>${r.atajo}</strong><button class="btn btn-sm btn-outline" onclick="copiarTexto(respuestasRapidas()[${i}].texto);showToast('📋 Copiado.')">📋 Copiar</button></div><pre class="avisoMsg">${escapeHtml(r.texto)}</pre></div>`).join('')}
</details>`);
}
