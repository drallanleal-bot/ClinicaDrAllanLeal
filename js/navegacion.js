// ── Navegación tipo app (mismo estilo que SISO) ──
// Inicio con los dos módulos; dentro de cada módulo, sus secciones como botones grandes.
// Cada página tiene arriba su título y «← Secciones» para regresar a la cuadrícula del módulo.

const PAGINA_PADRE = {
  dashboard:'modClinica', pacientes:'modClinica', historias:'modClinica', agenda:'modClinica', recordatorios:'modClinica', respaldos:'modClinica',
  occRegistros:'modOcupacional', occDashboard:'modOcupacional', occArchivos:'modOcupacional', occPlantas:'modOcupacional', occEmpresas:'modOcupacional',
  occEscaneres:'occArchivos', occPlanes:'occArchivos'
};
const PAGINA_INFO = {
  inicio:{ e:'🏠', t:'Inicio' },
  modClinica:{ e:'🏥', t:'Clínica propia' },
  modOcupacional:{ e:'🏭', t:'Salud Ocupacional' },
  dashboard:{ e:'📊', t:'Resumen del día' },
  pacientes:{ e:'👥', t:'Pacientes' },
  historias:{ e:'📋', t:'Historias clínicas' },
  agenda:{ e:'📅', t:'Agenda' },
  recordatorios:{ e:'🔔', t:'Recordatorios' },
  respaldos:{ e:'💾', t:'Respaldos' },
  occRegistros:{ e:'🩺', t:'Registros EMOP' },
  occDashboard:{ e:'📊', t:'Dashboard ocupacional' },
  occArchivos:{ e:'📁', t:'Escáneres y planes' },
  occEscaneres:{ e:'📁', t:'Escáneres' },
  occPlanes:{ e:'📄', t:'Planes de SSO' },
  occPlantas:{ e:'🏭', t:'Plantas' },
  occEmpresas:{ e:'🏢', t:'Empresa y configuración' }
};

function moduloDePagina(page) {
  if (page === 'inicio') return null;
  return (String(page).startsWith('occ') || page === 'modOcupacional') ? 'ocupacional' : 'clinica';
}
function paginaInicioUsuario() { return isSoloOcupacional() ? 'modOcupacional' : 'inicio'; }

function actualizarBarraSuperior() {
  const el = document.getElementById('pageTitle');
  if (!el) return;
  const info = PAGINA_INFO[currentPage];
  const mod = moduloDePagina(currentPage);
  const nombreMod = mod === 'ocupacional' ? 'Salud Ocupacional' : (mod === 'clinica' ? 'Clínica propia' : '');
  el.textContent = currentPage === 'inicio' ? 'Inicio'
    : (currentPage === 'modClinica' || currentPage === 'modOcupacional') ? nombreMod
    : `${nombreMod} · ${info ? info.t : ''}`;
  document.title = `Dr. Allan Leal — ${el.textContent}`;
}

// Encabezado que va arriba de cada página (lo agrega setC).
function cabeceraPagina() {
  if (!currentUser || currentPage === 'inicio') return '';
  const info = PAGINA_INFO[currentPage];
  if (!info) return '';
  const padre = PAGINA_PADRE[currentPage];
  const empresa = moduloDePagina(currentPage) === 'ocupacional' && currentPage !== 'modOcupacional' ? ` <span class="moduloEmpresa">${escapeHtml(occData().activeEmpresa || '')}</span>` : '';
  return `<div class="moduloHead">
    ${padre ? `<button type="button" class="btnSecciones" onclick="goTo('${padre}')">← Secciones</button>` : ''}
    <h1><span aria-hidden="true">${info.e}</span> ${escapeHtml(info.t)}${empresa}</h1>
  </div>`;
}

function botonSeccion(s) {
  return `<button type="button" class="seccionBtn" style="--acento:${s.color}" onclick="${s.onclick}">
    <span class="seccionIcono" aria-hidden="true">${s.e}</span>
    <b>${escapeHtml(s.t)}</b>
    ${s.d ? `<span class="seccionTexto">${escapeHtml(s.d)}</span>` : ''}
    ${s.stat ? `<span class="seccionDato">${escapeHtml(s.stat)}</span>` : ''}
  </button>`;
}
function plural(n, uno, varios) { return `${n} ${n === 1 ? uno : varios}`; }

// ── Inicio ──
function renderInicio() {
  const hoy = todayLocalISO();
  const citasHoy = state.citas.filter(c => c.fecha === hoy && c.estado !== 'cancelada').length;
  const regs = occData().registros || [];
  const firmados = regs.filter(r => r.firmaMedico).length;
  setC(`
<section class="inicioHero">
  <img class="inicioLogo" src="ALLAN-logo (1).jpeg" alt="Clínica Dr. Allan Leal">
  <h1>Hola, ${escapeHtml(currentUser?.name || '')}</h1>
  <p class="inicioSub">¿Qué quieres revisar hoy?</p>
</section>
<div class="inicioModulos">
  <button type="button" class="tileModulo" style="--acento:#0d4330" onclick="goTo('modClinica')">
    <span class="tileModuloIcono" aria-hidden="true">🏥</span>
    <strong>Clínica propia</strong>
    <span class="tileModuloTexto">Pacientes, historias clínicas, agenda, recordatorios y respaldos</span>
    <span class="tileModuloDato">${plural(state.pacientes.length, 'paciente', 'pacientes')} · ${plural(citasHoy, 'cita hoy', 'citas hoy')}</span>
  </button>
  <button type="button" class="tileModulo" style="--acento:#ea580c" onclick="goTo('modOcupacional')">
    <span class="tileModuloIcono" aria-hidden="true">🏭</span>
    <strong>Salud Ocupacional</strong>
    <span class="tileModuloTexto">Registros EMOP, dictámenes firmados, escáneres y planes de SSO</span>
    <span class="tileModuloDato">${plural(regs.length, 'evaluación', 'evaluaciones')} · ${plural(firmados, 'firmada', 'firmadas')}</span>
  </button>
</div>`);
}

// ── Módulo Clínica propia ──
function renderModuloClinica() {
  const hoy = todayLocalISO();
  const citasHoy = state.citas.filter(c => c.fecha === hoy && c.estado !== 'cancelada').length;
  const porConfirmar = state.citas.filter(c => c.fecha >= hoy && c.estado === 'pendiente').length;
  const secciones = [
    { e:'📊', t:'Resumen del día', d:'Agenda de hoy y últimas historias', stat:plural(citasHoy, 'cita hoy', 'citas hoy'), color:'#0d4330', onclick:"goTo('dashboard')" },
    { e:'👥', t:'Pacientes', d:'Fichas, alergias y contacto', stat:plural(state.pacientes.length, 'paciente', 'pacientes'), color:'#176345', onclick:"goTo('pacientes')" },
    { e:'📋', t:'Historias clínicas', d:'Consultas agrupadas por mes', stat:plural(state.historias.length, 'historia', 'historias'), color:'#185fa5', onclick:"goTo('historias')" },
    { e:'📅', t:'Agenda', d:'Calendario y lista de citas', stat:plural(state.citas.filter(c => c.fecha >= hoy).length, 'cita próxima', 'citas próximas'), color:'#0f766e', onclick:"goTo('agenda')" },
    { e:'🔔', t:'Recordatorios', d:'Mensajes listos para WhatsApp', stat:plural(porConfirmar, 'por confirmar', 'por confirmar'), color:'#b45309', onclick:"goTo('recordatorios')" },
    { e:'💾', t:'Respaldos', d:'Copia en OneDrive e importar', stat:oneDriveDirHandle ? 'OneDrive conectado' : '', color:'#7c3aed', onclick:"goTo('respaldos')" },
    { e:'🔑', t:'Cambiar contraseña', d:'Su contraseña de acceso', stat:'', color:'#5f5e5a', onclick:'abrirCambioContrasena()' }
  ];
  setC(`<div class="seccionesGrid">${secciones.map(botonSeccion).join('')}</div>`);
}

// ── Módulo Salud Ocupacional ──
function renderModuloOcupacional() {
  const regs = occData().registros || [];
  const firmados = regs.filter(r => r.firmaMedico).length;
  const archivos = (occData().scans || []).length + (isSoloOcupacional() ? 0 : (state.planesSSO || []).length);
  const secciones = [
    !isOcupViewer() && { e:'🩺', t:'Registros EMOP', d:'Nueva evaluación y evaluaciones por jornada', stat:plural(regs.length, 'evaluación', 'evaluaciones'), color:'#ea580c', onclick:"goTo('occRegistros')" },
    { e:'📊', t:'Dashboard', d:'Dictámenes firmados y reportes', stat:plural(firmados, 'firmado', 'firmados'), color:'#534ab7', onclick:"goTo('occDashboard')" },
    { e:'📁', t:'Escáneres y planes', d:isSoloOcupacional() ? 'Escáneres firmados por jornada' : 'Escáneres por jornada y planes de SSO', stat:plural(archivos, 'archivo', 'archivos'), color:'#378add', onclick:"goTo('occArchivos')" },
    { e:'🏭', t:'Plantas', d:'Evaluaciones y jornadas por planta', stat:plural((occData().plantas || []).length, 'planta', 'plantas'), color:'#0f766e', onclick:"goTo('occPlantas')" },
    { e:'🏢', t:'Empresa y configuración', d:isSoloOcupacional() ? 'Empresa activa' : 'Empresa, médicos y firma, leyenda', stat:occData().activeEmpresa || '', color:'#854f0b', onclick:"goTo('occEmpresas')" },
    { e:'🔑', t:'Cambiar contraseña', d:'Su contraseña de acceso', stat:'', color:'#5f5e5a', onclick:'abrirCambioContrasena()' }
  ].filter(Boolean);
  setC(`<div class="seccionesGrid">${secciones.map(botonSeccion).join('')}</div>`);
}

// ── Escáneres y planes ──
function abrirEscaneres(vista) {
  editingOcupScanId = null;
  occScanVista = vista;
  goTo('occEscaneres');
}
function abrirPlanes(vista) {
  planesVista = vista;
  goTo('occPlanes');
}
function renderArchivosOcupacional() {
  const scans = occData().scans || [];
  const planes = state.planesSSO || [];
  const secciones = [
    !isOcupViewer() && { e:'⬆️', t:'Subir escáneres', d:'PDF o imagen firmada de la jornada', stat:'', color:'#378add', onclick:"abrirEscaneres('subir')" },
    { e:'📁', t:'Ver escáneres', d:'Archivos agrupados por jornada', stat:plural(scans.length, 'escáner', 'escáneres'), color:'#185fa5', onclick:"abrirEscaneres('ver')" },
    !isSoloOcupacional() && { e:'📤', t:'Subir plan de SSO', d:'Plan firmado de la empresa', stat:'', color:'#0f766e', onclick:"abrirPlanes('subir')" },
    !isSoloOcupacional() && { e:'📄', t:'Planes guardados', d:'Planes de SSO respaldados', stat:plural(planes.length, 'plan', 'planes'), color:'#176345', onclick:"abrirPlanes('lista')" }
  ].filter(Boolean);
  setC(`<div class="seccionesGrid">${secciones.map(botonSeccion).join('')}</div>`);
}
