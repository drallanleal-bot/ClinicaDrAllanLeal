// ── NAV ───────────────────────────────────────────
const pageTitles = {
  dashboard:'Panel Principal', pacientes:'Pacientes', historias:'Historias Clínicas',
  agenda:'Agenda', recordatorios:'Recordatorios',
  respaldos:'Respaldos',
  occEmpresas:'Empresas', occDashboard:'Dashboard Ocupacional', occRegistros:'Registros EMOP', occEscaneres:'Escáneres', occPlantas:'Plantas', occPlanes:'Planes de SSO'
};
function goTo(page) {
  if (isOcupViewer() && page === 'occRegistros') page = 'occDashboard';
  currentPage = page;
  document.querySelectorAll('.navBtn').forEach(b => b.classList.remove('active'));
  const nav = document.getElementById('nav-' + page);
  if (nav) nav.classList.add('active');
  document.getElementById('pageTitle').textContent = pageTitles[page] || page;
  const renders = { dashboard:renderDashboard, pacientes:renderPacientes, historias:renderHistorias, agenda:renderAgenda, recordatorios:renderRecordatorios, respaldos:renderRespaldos, occEmpresas:renderOcupEmpresas, occDashboard:renderOcupDashboard, occRegistros:renderOcupRegistros, occEscaneres:renderOcupEscaneres, occPlantas:renderOcupPlantas, occPlanes:renderPlanesSSO };
  if (renders[page]) renders[page]();
}

// ── HELPERS ───────────────────────────────────────
function getPac(id)     { return state.pacientes.find(p => String(p.id) === String(id)) || { nombre:'Desconocido' }; }
function fmtF(f)        { if(!f) return '—'; const [y,m,d]=f.split('-'); return `${d}/${m}/${y}`; }
function calcEdad(nac)  { if(!nac) return '—'; const h=new Date(), n=new Date(nac); let e=h.getFullYear()-n.getFullYear(); if(h<new Date(h.getFullYear(),n.getMonth(),n.getDate())) e--; return e+' años'; }
function openModal(id)  { document.getElementById(id).classList.add('show'); }
function closeModal(id) {
  document.getElementById(id).classList.remove('show');
  setTimeout(flushDeferredCloudRefresh, 80);
}
function setC(html)     { document.getElementById('mainContent').innerHTML = html; }
function initials(n)    { return n.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase(); }
function citaBadgeClass(estado) {
  if (estado === 'confirmada') return 'badge-green';
  if (estado === 'cancelada') return 'badge-red';
  return 'badge-warn';
}
function refreshClinicPage(fallback = 'dashboard') {
  if (currentPage === 'dashboard') renderDashboard();
  else if (currentPage === 'pacientes') renderPacientes();
  else if (currentPage === 'historias') renderHistorias();
  else if (currentPage === 'agenda') renderAgenda();
  else if (currentPage === 'recordatorios') renderRecordatorios();
  else goTo(fallback);
}

// ── Listas desplegables de Clínica propia (mismo estilo que Registros EMOP) ──
// Guarda qué grupos y filas están abiertos para que no se cierren al actualizar desde Firebase.
const clinicaAbiertos = new Set();
const clinicaGruposAbiertos = {};
let agendaVista = 'calendario';
const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function clinicaToggleFila(el) {
  if (el.open) clinicaAbiertos.add(el.dataset.k);
  else clinicaAbiertos.delete(el.dataset.k);
}
function clinicaToggleGrupo(el) {
  clinicaGruposAbiertos[el.dataset.k] = el.open;
}
function clinicaGrupoAbierto(key, porDefecto) {
  return key in clinicaGruposAbiertos ? clinicaGruposAbiertos[key] : porDefecto;
}
function clinicaDato(label, valor) {
  return `<div><span>${escapeHtml(label)}</span>${valor}</div>`;
}
function clinicaFila(key, resumenIzq, resumenDer, detalle) {
  return `<details class="filaLista" data-k="${escapeHtml(key)}" ontoggle="clinicaToggleFila(this)" ${clinicaAbiertos.has(key) ? 'open' : ''}>
    <summary><span class="filaListaIzq">${resumenIzq}</span><span class="filaListaDer">${resumenDer}</span></summary>
    <div class="filaListaDetalle">${detalle}</div>
  </details>`;
}
function clinicaGrupo(key, titulo, resumen, filas, abiertoPorDefecto) {
  const abierto = clinicaGrupoAbierto(key, abiertoPorDefecto);
  return `<details class="grupoLista" data-k="${escapeHtml(key)}" ontoggle="clinicaToggleGrupo(this)" ${abierto ? 'open' : ''}>
    <summary><span class="grupoListaTitulo">${titulo}</span><span class="grupoListaResumen">${resumen}</span></summary>
    <div>${filas}</div>
  </details>`;
}
function tileGrande(icono, titulo, sub, onclick, activo = false) {
  return `<button type="button" class="tileGrande${activo ? ' activo' : ''}" onclick="${onclick}">
    <span class="tileGrandeIcono" aria-hidden="true">${icono}</span>
    <span><strong>${titulo}</strong><span class="tileGrandeSub">${sub}</span></span>
  </button>`;
}
function alergiaTexto(p) {
  const a = String(p.alergias || '').trim();
  return a && a.toLowerCase() !== 'ninguna' ? a : '';
}
function ultimaHistoriaDe(pacienteId) {
  return state.historias.filter(h => String(h.pacienteId) === String(pacienteId)).sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))[0];
}

// Filas reutilizables
function filaPaciente(p) {
  const alergia = alergiaTexto(p);
  const ultima = ultimaHistoriaDe(p.id);
  const nHist = state.historias.filter(h => String(h.pacienteId) === String(p.id)).length;
  return clinicaFila(`p-${p.id}`,
    `<span class="filaAvatar" aria-hidden="true">${escapeHtml(initials(p.nombre || '?'))}</span><span class="filaTexto"><strong>${escapeHtml(p.nombre)}</strong><span class="filaSub">${escapeHtml(patientCode(p))} · ${escapeHtml(calcEdad(p.nac))}</span></span>`,
    alergia ? `<span class="badge badge-red" title="Alergias">⚠ ${escapeHtml(alergia)}</span>` : '',
    `<div class="filaDatos">
      ${clinicaDato('Documento', escapeHtml(p.doc || '—'))}
      ${clinicaDato('Teléfono', escapeHtml(p.tel || '—'))}
      ${clinicaDato('Sexo', escapeHtml(p.sexo || '—'))}
      ${clinicaDato('Alergias', alergia ? `<span style="color:var(--red)">${escapeHtml(alergia)}</span>` : 'Ninguna')}
      ${clinicaDato('Historias', String(nHist))}
      ${clinicaDato('Última consulta', ultima ? fmtF(ultima.fecha) : '—')}
    </div>
    <div class="filaAcciones">
      <button class="btn btn-sm btn-primary" onclick="verPaciente('${p.id}')">Abrir ficha</button>
      <button class="btn btn-sm btn-outline" onclick="prepModalHistoria('${p.id}');openModal('modalHistoria')">+ Historia</button>
      <button class="btn btn-sm btn-outline" onclick="prepModalCita('${p.id}');openModal('modalCita')">+ Cita</button>
      <button class="btn btn-sm btn-outline" onclick="prepModalPaciente('${p.id}');openModal('modalPaciente')">Editar</button>
      <button class="btn btn-sm btn-outline filaBorrar" onclick="borrarPaciente('${p.id}')">Borrar</button>
    </div>`);
}
function filaHistoria(h, mostrarPaciente = true) {
  const pac = getPac(h.pacienteId);
  const nAdj = (h.adjuntos || []).length;
  const titulo = mostrarPaciente ? pac.nombre : (h.motivo || 'Consulta');
  const sub = mostrarPaciente ? `${fmtF(h.fecha)} · ${h.motivo || 'Sin motivo'}` : fmtF(h.fecha);
  return clinicaFila(`h-${h.id}`,
    `<span class="filaTexto"><strong>${escapeHtml(titulo)}</strong><span class="filaSub">${escapeHtml(sub)}</span></span>`,
    `${nAdj ? `<span class="filaMarca" title="Adjuntos">📎 ${nAdj}</span>` : ''}${h.diagnostico ? `<span class="badge badge-blue">${escapeHtml(h.diagnostico)}</span>` : ''}`,
    `<div class="filaDatos">
      ${mostrarPaciente ? clinicaDato('Código', escapeHtml(patientCode(pac))) : ''}
      ${clinicaDato('Fecha', fmtF(h.fecha))}
      ${clinicaDato('Presión arterial', escapeHtml(h.ta || '—'))}
      ${clinicaDato('Adjuntos', String(nAdj))}
    </div>
    ${h.tratamiento ? `<div class="filaNota"><span>Tratamiento</span>${escapeHtml(h.tratamiento)}</div>` : ''}
    <div class="filaAcciones">
      <button class="btn btn-sm btn-primary" onclick="verHistoria('${h.id}')">Ver completa</button>
      <button class="btn btn-sm btn-outline" onclick="prepModalHistoria(null,'${h.id}');openModal('modalHistoria')">Editar</button>
      ${mostrarPaciente ? `<button class="btn btn-sm btn-outline" onclick="verPaciente('${h.pacienteId}')">Ficha del paciente</button>` : ''}
      <button class="btn btn-sm btn-outline filaBorrar" onclick="borrarHistoria('${h.id}')">Borrar</button>
    </div>`);
}
function filaCita(c, mostrarPaciente = true) {
  const pac = getPac(c.pacienteId);
  const titulo = mostrarPaciente ? pac.nombre : (c.tipo || 'Cita');
  const sub = mostrarPaciente ? `${fmtF(c.fecha)} · ${c.tipo || ''}` : fmtF(c.fecha);
  return clinicaFila(`c-${c.id}`,
    `<span class="filaHora">${escapeHtml(c.hora || '—')}</span><span class="filaTexto"><strong>${escapeHtml(titulo)}</strong><span class="filaSub">${escapeHtml(sub)}</span></span>`,
    `<span class="badge ${citaBadgeClass(c.estado)}">${escapeHtml(c.estado || 'pendiente')}</span>`,
    `<div class="filaDatos">
      ${clinicaDato('Tipo', escapeHtml(c.tipo || '—'))}
      ${clinicaDato('Recordatorio', escapeHtml(c.recordatorio || 'Calendario general'))}
      ${mostrarPaciente ? clinicaDato('Teléfono', escapeHtml(pac.tel || '—')) : ''}
    </div>
    ${c.notas ? `<div class="filaNota"><span>Notas</span>${escapeHtml(c.notas)}</div>` : ''}
    <div class="filaAcciones">
      ${c.estado !== 'confirmada' ? `<button class="btn btn-sm btn-primary" onclick="confirmarCita('${c.id}')">Confirmar</button>` : ''}
      ${c.estado !== 'cancelada' ? `<button class="btn btn-sm btn-outline" onclick="cancelarCita('${c.id}')">Cancelar cita</button>` : ''}
      <button class="btn btn-sm btn-outline" onclick="prepModalCita(null,'${c.id}');openModal('modalCita')">Editar</button>
      ${mostrarPaciente ? `<button class="btn btn-sm btn-outline" onclick="verPaciente('${c.pacienteId}')">Ficha del paciente</button>` : ''}
      <button class="btn btn-sm btn-outline filaBorrar" onclick="borrarCita('${c.id}')">Borrar</button>
    </div>`);
}
function listaVacia(texto) { return `<div class="listaVacia">${escapeHtml(texto)}</div>`; }
function ordenarCitas(lista, desc = false) {
  return lista.slice().sort((a, b) => {
    const r = `${a.fecha || ''} ${a.hora || ''}`.localeCompare(`${b.fecha || ''} ${b.hora || ''}`);
    return desc ? -r : r;
  });
}
function historiasRecientes(lista) {
  return lista.slice().sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || String(b.id).localeCompare(String(a.id), undefined, { numeric:true }));
}

// ── INICIO ────────────────────────────────────────
function renderDashboard() {
  const hoy = todayLocalISO();
  const citasHoy = ordenarCitas(state.citas.filter(c => c.fecha === hoy));
  const prox = state.citas.filter(c => c.fecha > hoy).length;
  const saludo = new Date().getHours() < 12 ? 'Buenos días' : (new Date().getHours() < 19 ? 'Buenas tardes' : 'Buenas noches');
  setC(`
<div class="section-title">Clínica Propia</div>
<p style="color:#66756f;font-size:13px;margin-top:-.65rem;margin-bottom:1rem">${saludo}, ${escapeHtml(currentUser?.name || '')}.</p>
<div class="tilesGrandes tres">
  ${tileGrande('👤', 'Nuevo paciente', 'Registrar datos', "prepModalPaciente();openModal('modalPaciente')")}
  ${tileGrande('📝', 'Nueva historia', 'Consulta de hoy', "prepModalHistoria();openModal('modalHistoria')")}
  ${tileGrande('📅', 'Nueva cita', 'Agendar', "prepModalCita();openModal('modalCita')")}
</div>
<div class="statGrid cuatro">
  <button type="button" class="statBox" onclick="goTo('pacientes')"><div class="statNum">${state.pacientes.length}</div><div class="statLbl">Pacientes</div></button>
  <button type="button" class="statBox" onclick="agendaVista='lista';goTo('agenda')"><div class="statNum">${citasHoy.length}</div><div class="statLbl">Citas hoy</div></button>
  <button type="button" class="statBox" onclick="goTo('historias')"><div class="statNum">${state.historias.length}</div><div class="statLbl">Historias</div></button>
  <button type="button" class="statBox" onclick="agendaVista='lista';goTo('agenda')"><div class="statNum">${prox}</div><div class="statLbl">Próximas citas</div></button>
</div>
<div class="card">
  <div class="cardTitle">📅 Agenda de hoy <span class="occMini">${new Date().toLocaleDateString('es-GT',{weekday:'long',day:'numeric',month:'long'})}</span></div>
  <div class="listaPlana">${citasHoy.map(c => filaCita(c)).join('') || listaVacia('No hay citas programadas para hoy.')}</div>
</div>
<div class="card">
  <div class="cardTitle">📋 Últimas historias clínicas</div>
  <div class="listaPlana">${historiasRecientes(state.historias).slice(0, 5).map(h => filaHistoria(h)).join('') || listaVacia('Aún no hay historias.')}</div>
  ${state.historias.length > 5 ? `<div style="margin-top:.75rem"><button class="btn btn-sm btn-outline" onclick="goTo('historias')">Ver todas las historias →</button></div>` : ''}
</div>`);
}

// ── PACIENTES ─────────────────────────────────────
function renderPacientes() {
  setC(`
<div class="searchRow">
  <input type="text" id="searchPac" placeholder="🔍  Buscar paciente por código, nombre o documento..." oninput="filtrarPacientes()"/>
  <button class="btn btn-primary" onclick="prepModalPaciente();openModal('modalPaciente')">+ Nuevo paciente</button>
</div>
<div class="card">
  <div class="cardTitle">👥 Pacientes <span class="occMini" id="conteoPacientes"></span></div>
  <div class="listaPlana" id="tablaPacientes">${rowsPacientes(state.pacientes)}</div>
</div>`);
  actualizarConteoPacientes(state.pacientes.length);
}
function actualizarConteoPacientes(n) {
  const el = document.getElementById('conteoPacientes');
  if (el) el.textContent = n === state.pacientes.length ? `${n}` : `${n} de ${state.pacientes.length}`;
}
function rowsPacientes(lista) {
  if (!lista.length) return listaVacia('No se encontraron pacientes.');
  return lista.slice().sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')).map(filaPaciente).join('');
}
function filtrarPacientes() {
  const q = normalizeOccSearchText(document.getElementById('searchPac').value);
  const res = state.pacientes.filter(p => patientCode(p).includes(q) || normalizeOccSearchText(p.nombre).includes(q) || String(p.doc || '').includes(q));
  document.getElementById('tablaPacientes').innerHTML = rowsPacientes(res);
  actualizarConteoPacientes(res.length);
}

// ── HISTORIAS ─────────────────────────────────────
function renderHistorias() {
  setC(`
<div class="searchRow">
  <input type="text" id="searchHist" placeholder="🔍  Buscar por código, paciente o diagnóstico..." oninput="filtrarHistorias()"/>
  <button class="btn btn-primary" onclick="prepModalHistoria();openModal('modalHistoria')">+ Nueva historia</button>
</div>
<div class="card">
  <div class="cardTitle">📋 Historias clínicas <span class="occMini">${state.historias.length}</span></div>
  <div id="tablaHistorias">${rowsHistorias(state.historias)}</div>
</div>`);
}
function rowsHistorias(lista, buscando = false) {
  if (!lista.length) return listaVacia('No se encontraron historias.');
  const grupos = new Map();
  historiasRecientes(lista).forEach(h => {
    const key = String(h.fecha || '').slice(0, 7) || 'sin-fecha';
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(h);
  });
  return Array.from(grupos.entries()).map(([key, hs], i) => {
    const [y, m] = key.split('-');
    const titulo = key === 'sin-fecha' ? 'Sin fecha' : `${MESES_ES[Number(m) - 1] || m} ${y}`;
    const nAdj = hs.filter(h => (h.adjuntos || []).length).length;
    const resumen = `${nAdj ? `<span class="filaMarca">📎 ${nAdj}</span>` : ''}<span class="grupoListaTotal">${hs.length} ${hs.length === 1 ? 'historia' : 'historias'}</span>`;
    return clinicaGrupo(`hm-${key}`, escapeHtml(titulo), resumen, hs.map(h => filaHistoria(h)).join(''), buscando || i === 0);
  }).join('');
}
function filtrarHistorias() {
  const q = normalizeOccSearchText(document.getElementById('searchHist').value);
  const res = state.historias.filter(h => {
    const pac = getPac(h.pacienteId);
    return patientCode(pac).includes(q) || normalizeOccSearchText(pac.nombre).includes(q) || normalizeOccSearchText(h.diagnostico).includes(q) || normalizeOccSearchText(h.motivo).includes(q);
  });
  document.getElementById('tablaHistorias').innerHTML = rowsHistorias(res, !!q);
}

// ── AGENDA ────────────────────────────────────────
function agendaCambiarVista(vista) { agendaVista = vista; renderAgenda(); }
function renderAgenda() {
  const dias  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const hoyIso = todayLocalISO();
  const hoy   = new Date();
  const citasHoy = ordenarCitas(state.citas.filter(c => c.fecha === hoyIso));
  const proximas = ordenarCitas(state.citas.filter(c => c.fecha > hoyIso));
  const pasadas = ordenarCitas(state.citas.filter(c => !c.fecha || c.fecha < hoyIso), true);
  let contenido = '';
  if (agendaVista === 'calendario') {
    const primerDia = new Date(calYear, calMonth, 1).getDay();
    const ultDia    = new Date(calYear, calMonth+1, 0).getDate();
    const prevUlt   = new Date(calYear, calMonth, 0).getDate();
    let cells = '', d = 1, extra = 1;
    for (let i = 0; i < 42; i++) {
      let dayNum, isOther = false;
      if (i < primerDia)      { dayNum = prevUlt - (primerDia - 1 - i); isOther = true; }
      else if (d > ultDia)    { dayNum = extra++; isOther = true; d++; }
      else                    { dayNum = d++; }
      const isHoy = !isOther && dayNum===hoy.getDate() && calMonth===hoy.getMonth() && calYear===hoy.getFullYear();
      const evs   = isOther ? [] : ordenarCitas(state.citas.filter(c => c.fecha === `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`));
      cells += `<div class="calDay${isOther?' otherMonth':''}${isHoy?' today':''}" ${!isOther?`onclick="diaClick(${calYear},${calMonth+1},${dayNum})"`:''}>
        <div class="dayNum">${dayNum}</div>
        ${evs.slice(0,2).map(c => `<div class="ev${c.estado==='confirmada'?' conf':c.estado==='cancelada'?' cancelada':' reminder'}">${escapeHtml(c.hora)} ${escapeHtml(getPac(c.pacienteId).nombre.split(' ')[0])}</div>`).join('')}
        ${evs.length>2 ? `<div style="font-size:9px;color:#888">+${evs.length-2}</div>` : ''}
      </div>`;
    }
    contenido = `
<div class="card" style="padding:.75rem">
  <div class="calNav" style="margin:0 0 .75rem">
    <button onclick="cambiarMes(-1)" aria-label="Mes anterior">‹</button>
    <h4>${MESES_ES[calMonth]} ${calYear}</h4>
    <button onclick="cambiarMes(1)" aria-label="Mes siguiente">›</button>
  </div>
  <div class="calGrid">${dias.map(d=>`<div class="calHead">${d}</div>`).join('')}${cells}</div>
  <div class="attachHint" style="margin-top:.6rem">Toque un día para agendar una cita en esa fecha.</div>
</div>`;
  } else {
    contenido = `
<div class="card">
  ${clinicaGrupo('ag-hoy', `Hoy · ${fmtF(hoyIso)}`, `<span class="grupoListaTotal">${citasHoy.length} ${citasHoy.length === 1 ? 'cita' : 'citas'}</span>`, citasHoy.map(c => filaCita(c)).join('') || listaVacia('No hay citas para hoy.'), true)}
  ${clinicaGrupo('ag-prox', 'Próximas', `<span class="grupoListaTotal">${proximas.length}</span>`, proximas.map(c => filaCita(c)).join('') || listaVacia('No hay citas próximas.'), true)}
  ${clinicaGrupo('ag-pasadas', 'Pasadas', `<span class="grupoListaTotal">${pasadas.length}</span>`, pasadas.map(c => filaCita(c)).join('') || listaVacia('No hay citas pasadas.'), false)}
</div>`;
  }
  setC(`
<div class="tilesGrandes tres">
  ${tileGrande('🗓️', 'Calendario', `${MESES_ES[calMonth]} ${calYear}`, "agendaCambiarVista('calendario')", agendaVista === 'calendario')}
  ${tileGrande('📋', 'Lista de citas', `${citasHoy.length} hoy · ${proximas.length} próximas`, "agendaCambiarVista('lista')", agendaVista === 'lista')}
  ${tileGrande('➕', 'Nueva cita', 'Agendar', "prepModalCita();openModal('modalCita')")}
</div>
${contenido}`);
}

// ── PACIENTES ─────────────────────────────────────
function verPaciente(id) {
  const p = getPac(id);
  const hists = state.historias.filter(h => String(h.pacienteId) === String(id));
  const citas  = state.citas.filter(c => String(c.pacienteId) === String(id));
  setC(`
<button class="btn btn-outline btn-sm mb1" onclick="renderPacientes()">← Volver a pacientes</button>
<div class="card">
  <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem">
    <div class="pacAvatar">${initials(p.nombre)}</div>
    <div>
      <div style="font-size:18px;font-weight:600;font-family:'DM Serif Display',serif">${p.nombre}</div>
      <div style="font-size:13px;color:#888">${[p.email, p.tel].filter(Boolean).map(escapeHtml).join(' · ')}</div>
    </div>
    <div style="margin-left:auto;display:flex;gap:.4rem;flex-wrap:wrap">
      <button class="btn btn-sm btn-primary" onclick="prepModalCita('${p.id}');openModal('modalCita')">+ Cita</button>
      <button class="btn btn-sm btn-primary" onclick="prepModalHistoria('${p.id}');openModal('modalHistoria')">+ Historia</button>
      <button class="btn btn-sm btn-outline" onclick="prepModalPaciente('${p.id}');openModal('modalPaciente')">Editar</button>
      <button class="btn btn-sm btn-outline" onclick="borrarPaciente('${p.id}')">Borrar</button>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.5rem;font-size:13.5px;margin-bottom:.75rem">
    <div><span style="color:#aaa;font-size:11px;font-weight:600;text-transform:uppercase">Código</span><br><span class="badge badge-gray">${patientCode(p)}</span></div>
    <div><span style="color:#aaa;font-size:11px;font-weight:600;text-transform:uppercase">Documento</span><br>${p.doc||'—'}</div>
    <div><span style="color:#aaa;font-size:11px;font-weight:600;text-transform:uppercase">Nacimiento</span><br>${fmtF(p.nac)} (${calcEdad(p.nac)})</div>
    <div><span style="color:#aaa;font-size:11px;font-weight:600;text-transform:uppercase">Sexo</span><br>${p.sexo||'—'}</div>
    <div><span style="color:#aaa;font-size:11px;font-weight:600;text-transform:uppercase">Alergias</span><br><span style="color:${p.alergias&&p.alergias!=='Ninguna'?'var(--red)':'var(--green)'}">${p.alergias||'Ninguna'}</span></div>
  </div>
  ${p.antecedentes ? `<div style="background:#f8f8f6;border-radius:8px;padding:.7rem;font-size:13px;margin-bottom:.5rem"><span style="color:#aaa;font-size:10.5px;font-weight:600;text-transform:uppercase">Antecedentes personales</span><br>${p.antecedentes}</div>` : ''}
  ${p.familiares   ? `<div style="background:#f8f8f6;border-radius:8px;padding:.7rem;font-size:13px"><span style="color:#aaa;font-size:10.5px;font-weight:600;text-transform:uppercase">Antecedentes familiares</span><br>${p.familiares}</div>` : ''}
</div>
<div class="card">
  <div class="cardTitle">📋 Historias clínicas (${hists.length})</div>
  ${hists.length===0 ? '<p style="color:#aaa;font-size:13px">Sin historias registradas.</p>' : ''}
  <div class="listaPlana">${historiasRecientes(hists).map(h => filaHistoria(h, false)).join('')}</div>
</div>
<div class="card">
  <div class="cardTitle">📅 Citas (${citas.length})</div>
  ${citas.length===0 ? '<p style="color:#aaa;font-size:13px">Sin citas registradas.</p>' : ''}
  <div class="listaPlana">${ordenarCitas(citas, true).map(c => filaCita(c, false)).join('')}</div>
</div>`);
}
// ── HISTORIAS ─────────────────────────────────────
function prepModalPaciente(id) {
  editingPacienteId = id || null;
  const p = id ? getPac(id) : null;
  document.getElementById('modalPacienteTitle').textContent = p ? '👤 Editar Paciente' : '👤 Registrar Nuevo Paciente';
  document.getElementById('btnGuardarPaciente').textContent = p ? '💾 Guardar Cambios' : '💾 Registrar Paciente';
  document.getElementById('pNombre').value = p && p.nombre !== 'Desconocido' ? p.nombre || '' : '';
  document.getElementById('pDoc').value = p ? p.doc || '' : '';
  document.getElementById('pNac').value = p ? p.nac || '' : '';
  document.getElementById('pSexo').value = p ? p.sexo || 'Femenino' : 'Femenino';
  document.getElementById('pTel').value = p ? p.tel || '' : '';
  document.getElementById('pEmail').value = p ? p.email || '' : '';
  document.getElementById('pAlergias').value = p ? p.alergias || '' : '';
  document.getElementById('pAntecedentes').value = p ? p.antecedentes || '' : '';
  document.getElementById('pFamiliares').value = p ? p.familiares || '' : '';
}
function pacienteDesdeFormulario(codigo) {
  const n = document.getElementById('pNombre').value.trim();
  if (!n) {
    alert('Por favor ingrese el nombre del paciente.');
    return null;
  }
  return {
    codigo,
    nombre: n,
    doc: document.getElementById('pDoc').value,
    nac: document.getElementById('pNac').value,
    sexo: document.getElementById('pSexo').value,
    tel: document.getElementById('pTel').value,
    email: document.getElementById('pEmail').value,
    alergias: document.getElementById('pAlergias').value || 'Ninguna',
    antecedentes: document.getElementById('pAntecedentes').value,
    familiares: document.getElementById('pFamiliares').value
  };
}
function guardarPaciente() {
  const current = editingPacienteId ? getPac(editingPacienteId) : null;
  normalizeStateCounters();
  const codigo = current && current.codigo ? current.codigo : String(state.nextPacCode || state.pacientes.length + 1).padStart(6, '0');
  const paciente = pacienteDesdeFormulario(codigo);
  if (!paciente) return;

  if (editingPacienteId) {
    const idx = state.pacientes.findIndex(p => String(p.id) === String(editingPacienteId));
    if (idx >= 0) {
      state.pacientes[idx] = { ...state.pacientes[idx], ...paciente };
      savePatientToCloud(state.pacientes[idx]);
      saveAppData({ backupToFolder:true });
      closeModal('modalPaciente');
      refreshClinicPage('pacientes');
      editingPacienteId = null;
    }
    return;
  }

  state.pacientes.push({ id:`${Date.now()}-${Math.random().toString(36).slice(2,7)}`, ...paciente });
  normalizeStateCounters();
  savePatientToCloud(state.pacientes[state.pacientes.length - 1]);
  saveAppData({ backupToFolder:true });
  closeModal('modalPaciente');
  prepModalPaciente();
  refreshClinicPage('pacientes');
}
function borrarPaciente(id) {
  const p = getPac(id);
  const historias = state.historias.filter(h => String(h.pacienteId) === String(id)).length;
  const citas = state.citas.filter(c => String(c.pacienteId) === String(id)).length;
  const extra = historias || citas ? `\n\nTambién se eliminarán ${historias} historia(s) y ${citas} cita(s) asociada(s).` : '';
  if (!confirm(`¿Desea borrar el paciente ${p.nombre}?${extra}`)) return;
  state.pacientes = state.pacientes.filter(x => String(x.id) !== String(id));
  state.historias = state.historias.filter(h => String(h.pacienteId) !== String(id));
  state.citas = state.citas.filter(c => String(c.pacienteId) !== String(id));
  normalizeStateCounters();
  deletePatientFromCloud(id);
  saveAppData({ backupToFolder:true });
  refreshClinicPage('pacientes');
}
// Fecha de hoy según el reloj del equipo (toISOString usa UTC y en Guatemala después de las 6 p. m. daba el día siguiente).
function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Signos vitales: avisa (amarillo) si el valor está fuera de lo normal y bloquea solo lo que es claramente un error de dedo.
const VITAL_RULES = {
  hTA:   { name:'Presión arterial' },
  hFC:   { name:'Frecuencia cardíaca', min:20, max:250, low:60, high:100, unit:'lpm' },
  hFR:   { name:'Frecuencia respiratoria', min:4, max:70, low:12, high:20, unit:'rpm' },
  hTemp: { name:'Temperatura', min:30, max:45, low:36, high:37.5, unit:'°C' },
  hSat:  { name:'Saturación O₂', min:40, max:100, low:95, unit:'%' },
  hGMT:  { name:'GMT', min:20, max:700, low:70, high:140, unit:'mg/dL' }
};
let historiaVitalOriginals = {};

function evaluateVital(id, raw) {
  const value = String(raw || '').trim();
  // Texto libre sin números (por ejemplo "Normal") se respeta tal cual.
  if (!value || !/\d/.test(value)) return { level:'ok', msg:'' };
  const rule = VITAL_RULES[id];
  if (id === 'hTA') {
    const m = value.match(/(\d{2,3})\s*[\/\-]\s*(\d{2,3})/);
    if (!m) return { level:'error', msg:'Escriba la presión como 120/80.' };
    const sys = Number(m[1]), dia = Number(m[2]);
    if (sys < 50 || sys > 260 || dia < 30 || dia > 160 || dia >= sys) return { level:'error', msg:'Revise la presión, parece un error de dedo.' };
    if (sys >= 140 || dia >= 90) return { level:'warn', msg:'Presión alta (normal hasta 139/89).' };
    if (sys < 90 || dia < 60) return { level:'warn', msg:'Presión baja (normal desde 90/60).' };
    return { level:'ok', msg:'' };
  }
  const num = parseFloat(value.replace(',', '.').match(/-?\d+(?:\.\d+)?/)[0]);
  if (num < rule.min || num > rule.max) return { level:'error', msg:`Revise el valor: ${rule.name.toLowerCase()} entre ${rule.min} y ${rule.max} ${rule.unit}.` };
  if (rule.low !== undefined && num < rule.low) return { level:'warn', msg:`Bajo (normal desde ${rule.low} ${rule.unit}).` };
  if (rule.high !== undefined && num > rule.high) return { level:'warn', msg:`Alto (normal hasta ${rule.high} ${rule.unit}).` };
  return { level:'ok', msg:'' };
}

function checkVitalField(id) {
  const input = document.getElementById(id);
  const msg = document.getElementById(id + '_msg');
  if (!input) return { level:'ok', msg:'' };
  const result = evaluateVital(id, input.value);
  input.classList.toggle('vitalWarn', result.level === 'warn');
  input.classList.toggle('vitalError', result.level === 'error');
  if (msg) { msg.textContent = result.msg; msg.className = 'vitalMsg' + (result.level === 'ok' ? '' : ' ' + result.level); }
  return result;
}

// Al editar una historia vieja solo se bloquean los signos vitales que se cambiaron.
function blockingVitalErrors() {
  return Object.keys(VITAL_RULES)
    .map(id => ({ id, value:document.getElementById(id)?.value || '', result:checkVitalField(id) }))
    .filter(v => v.result.level === 'error' && String(v.value).trim() !== String(historiaVitalOriginals[v.id] || '').trim());
}

function setHistoriaSections(h) {
  const filled = ids => ids.some(id => String(document.getElementById(id)?.value || '').trim());
  const hasAdj = h && Array.isArray(h.adjuntos) && h.adjuntos.length;
  const open = h ? {
    consulta:true,
    anamnesis:filled(['hAnamnesis']),
    signos:filled(['hTA','hFC','hFR','hTemp','hSat','hGMT','hPesoKg','hAltura']),
    examen:filled(['hExamenFisico']),
    plan:filled(['hTratamiento','hObs']),
    estudios:!!hasAdj
  } : { consulta:true, anamnesis:true, signos:true, examen:false, plan:false, estudios:false };
  document.querySelectorAll('#modalHistoria .fSection').forEach(sec => { sec.open = !!open[sec.dataset.sec]; });
}

function prepModalHistoria(pacId, histId) {
  editingHistoriaId = histId || null;
  const h = histId ? state.historias.find(x => String(x.id) === String(histId)) : null;
  const selectedPac = h ? h.pacienteId : pacId;
  const sel = document.getElementById('hPaciente');
  sel.innerHTML = '<option value="">Seleccionar paciente...</option>' + state.pacientes.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
  if (selectedPac) sel.value = selectedPac;
  document.getElementById('modalHistoriaTitle').textContent = h ? '📋 Editar Historia Clínica' : '📋 Nueva Historia Clínica';
  document.getElementById('btnGuardarHistoria').textContent = h ? '💾 Guardar Cambios' : '💾 Guardar Historia';
  document.getElementById('hFecha').value = h ? h.fecha || '' : todayLocalISO();
  document.getElementById('hMotivo').value = h ? h.motivo || '' : '';
  document.getElementById('hDiagnostico').value = h ? h.diagnostico || '' : '';
  document.getElementById('hAnamnesis').value = h ? h.anamnesis || '' : '';
  document.getElementById('hExamenFisico').value = h ? h.examenFisico || '' : CLINIC_DEFAULT_EXAMEN_FISICO;
  document.getElementById('hTA').value = h ? h.ta || '' : '';
  document.getElementById('hFC').value = h ? h.fc || '' : '';
  document.getElementById('hFR').value = h ? h.fr || '' : '';
  document.getElementById('hTemp').value = h ? h.temp || '' : '';
  document.getElementById('hSat').value = h ? h.sat || '' : '';
  document.getElementById('hGMT').value = h ? h.gmt || '' : '';
  document.getElementById('hPesoKg').value = h ? h.pesoKg || '' : '';
  document.getElementById('hAltura').value = h ? h.altura || '' : '';
  document.getElementById('hTratamiento').value = h ? h.tratamiento || '' : '';
  document.getElementById('hObs').value = h ? h.obs || '' : '';
  const adjInput = document.getElementById('hAdjuntos');
  if (adjInput) adjInput.value = '';
  const adjName = document.getElementById('hAdjuntoNombre');
  const adjUrl = document.getElementById('hAdjuntoUrl');
  if (adjName) adjName.value = '';
  if (adjUrl) adjUrl.value = '';
  const adjPreview = document.getElementById('hAdjuntosPreview');
  if (adjPreview) adjPreview.innerHTML = h && h.adjuntos?.length ? renderAttachmentList(h.adjuntos) : '<div class="attachHint">Aun no ha seleccionado archivos.</div>';
  renderPatientPreviousAttachments(selectedPac || '', histId || '');
  updateClinicImc();
  historiaVitalOriginals = h ? { hTA:h.ta, hFC:h.fc, hFR:h.fr, hTemp:h.temp, hSat:h.sat, hGMT:h.gmt } : {};
  Object.keys(VITAL_RULES).forEach(checkVitalField);
  setHistoriaSections(h);
}
function historiaDesdeFormulario(id) {
  const pid = document.getElementById('hPaciente').value;
  if (!pid) { alert('Seleccione un paciente.'); return null; }
  if (!document.getElementById('hFecha').value) { alert('Ingrese la fecha de consulta.'); return null; }
  const vitalErrors = blockingVitalErrors();
  if (vitalErrors.length) {
    const sec = document.querySelector('#modalHistoria .fSection[data-sec="signos"]');
    if (sec) sec.open = true;
    document.getElementById(vitalErrors[0].id)?.focus();
    alert('Revise los signos vitales marcados en rojo:\n\n' + vitalErrors.map(v => `• ${VITAL_RULES[v.id].name}: ${v.result.msg}`).join('\n'));
    return null;
  }
  const imc = clinicImcValue(document.getElementById('hPesoKg').value, document.getElementById('hAltura').value);
  return {
    id,
    pacienteId:pid,
    fecha:document.getElementById('hFecha').value,
    motivo:document.getElementById('hMotivo').value,
    diagnostico:document.getElementById('hDiagnostico').value,
    anamnesis:document.getElementById('hAnamnesis').value,
    examenFisico:document.getElementById('hExamenFisico').value,
    ta:document.getElementById('hTA').value,
    fc:document.getElementById('hFC').value,
    fr:document.getElementById('hFR').value,
    temp:document.getElementById('hTemp').value,
    sat:document.getElementById('hSat').value,
    gmt:document.getElementById('hGMT').value,
    pesoKg:document.getElementById('hPesoKg').value,
    altura:document.getElementById('hAltura').value,
    peso:`${document.getElementById('hPesoKg').value || '—'} kg / ${document.getElementById('hAltura').value || '—'}`,
    imc,
    imcClasificacion:imcClass(imc),
    tratamiento:document.getElementById('hTratamiento').value,
    obs:document.getElementById('hObs').value,
    adjuntos:[]
  };
}
async function guardarHistoria() {
  const id = editingHistoriaId || state.nextHistId;
  const historia = historiaDesdeFormulario(id);
  if (!historia) return;
  if (!editingHistoriaId) state.nextHistId++;
  const idx = state.historias.findIndex(h => String(h.id) === String(id));
  const previousAdjuntos = idx >= 0 && Array.isArray(state.historias[idx].adjuntos) ? state.historias[idx].adjuntos : [];
  const btn = document.getElementById('btnGuardarHistoria');
  const prevText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Copiando a OneDrive...'; }
  try {
    historia.adjuntos = await uploadHistoriaAttachments(historia, previousAdjuntos);
  } catch (error) {
    console.warn('No se pudieron subir los adjuntos de la historia.', error);
    alert('La historia se guardara, pero no se pudieron copiar los archivos a OneDrive. Revise que la carpeta local de OneDrive este conectada desde Respaldos.');
    historia.adjuntos = previousAdjuntos;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = prevText || 'Guardar Historia'; }
  }
  if (idx >= 0) state.historias[idx] = { ...state.historias[idx], ...historia };
  else state.historias.push(historia);
  saveAppData({ backupToFolder:true });
  closeModal('modalHistoria');
  editingHistoriaId = null;
  refreshClinicPage('historias');
}
function borrarHistoria(id) {
  const h = state.historias.find(x => String(x.id) === String(id));
  if (!h) return;
  const pac = getPac(h.pacienteId);
  if (!confirm(`¿Desea borrar la historia de ${pac.nombre} del ${fmtF(h.fecha)}?`)) return;
  state.historias = state.historias.filter(x => String(x.id) !== String(id));
  saveAppData({ backupToFolder:true });
  refreshClinicPage('historias');
}

// ── AGENDA ────────────────────────────────────────
function verHistoria(id) {
  const h = state.historias.find(x => String(x.id) === String(id));
  if (!h) return;
  const pac = getPac(h.pacienteId);
  const back = currentPage;
  setC(`
<button class="btn btn-outline btn-sm mb1" onclick="goTo('${back}')">← Volver</button>
<div class="card">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:1.25rem">
    <div>
      <div style="font-size:20px;font-weight:600;font-family:'DM Serif Display',serif">${pac.nombre}</div>
      <div style="font-size:13px;color:#aaa;margin-top:2px">Codigo ${patientCode(pac)} · ${fmtF(h.fecha)}</div>
    </div>
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;justify-content:flex-end">
      <span class="badge badge-blue" style="font-size:12px;padding:4px 12px">${h.diagnostico || 'Sin diagnostico'}</span>
      <button class="btn btn-sm btn-primary" onclick="prepModalHistoria(null,'${h.id}');openModal('modalHistoria')">Editar</button>
      <button class="btn btn-sm btn-outline" onclick="borrarHistoria('${h.id}')">Borrar</button>
    </div>
  </div>
  <div class="vitalesGrid">
    <div class="vitalItem"><span>Presion arterial</span>${h.ta||'—'}</div>
    <div class="vitalItem"><span>Frec. cardiaca</span>${h.fc||'—'}</div>
    <div class="vitalItem"><span>Frec. respiratoria</span>${h.fr||'—'}</div>
    <div class="vitalItem"><span>Temperatura</span>${h.temp||'—'}</div>
    <div class="vitalItem"><span>Peso / Talla</span>${h.peso||'—'}</div>
    <div class="vitalItem"><span>Saturacion O2</span>${h.sat||'—'}</div>
    <div class="vitalItem"><span>GMT</span>${h.gmt||'—'}</div>
    <div class="vitalItem"><span>IMC</span>${h.imc ? `${h.imc} · ${h.imcClasificacion||imcClass(h.imc)}` : '—'}</div>
  </div>
  <div style="margin-bottom:1rem"><div style="font-size:10.5px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.5px;margin-bottom:.35rem">Motivo de consulta</div><div style="font-size:14px">${h.motivo||'—'}</div></div>
  <div style="margin-bottom:1rem"><div style="font-size:10.5px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.5px;margin-bottom:.35rem">Anamnesis</div><div style="font-size:14px;line-height:1.65;white-space:pre-wrap">${h.anamnesis||'—'}</div></div>
  <div style="margin-bottom:1rem"><div style="font-size:10.5px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.5px;margin-bottom:.35rem">Examen físico</div><div style="font-size:14px;line-height:1.65;white-space:pre-wrap">${h.examenFisico||'—'}</div></div>
  <div style="margin-bottom:1rem"><div style="font-size:10.5px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.5px;margin-bottom:.35rem">Tratamiento y prescripcion</div><div style="font-size:14px;line-height:1.65;white-space:pre-wrap">${h.tratamiento||'—'}</div></div>
  ${h.obs ? `<div style="margin-bottom:1rem"><div style="font-size:10.5px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.5px;margin-bottom:.35rem">Observaciones y seguimiento</div><div style="font-size:14px;line-height:1.65">${h.obs}</div></div>` : ''}
  <div style="margin-top:1rem"><div style="font-size:10.5px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.5px;margin-bottom:.35rem">Laboratorios y estudios</div>${renderAttachmentList(h.adjuntos || [], h.id)}</div>
</div>`);
}
async function removeHistoriaAttachment(histId, attId) {
  const h = state.historias.find(x => String(x.id) === String(histId));
  if (!h) return;
  const att = (h.adjuntos || []).find(a => String(a.id) === String(attId));
  if (!att) return;
  if (!confirm(`¿Desea quitar el archivo ${att.nombre || 'adjunto'} de esta historia?`)) return;
  h.adjuntos = (h.adjuntos || []).filter(a => String(a.id) !== String(attId));
  saveAppData({ backupToFolder:true });
  verHistoria(histId);
}

function cambiarMes(d) { calMonth += d; if(calMonth>11){calMonth=0;calYear++;} else if(calMonth<0){calMonth=11;calYear--;} renderAgenda(); }
function diaClick(y,m,d) { prepModalCita(); document.getElementById('cFecha').value = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; openModal('modalCita'); }
