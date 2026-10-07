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

// ── DASHBOARD ─────────────────────────────────────
function renderDashboard() {
  const hoy = new Date().toISOString().split('T')[0];
  const citasHoy = state.citas.filter(c => c.fecha === hoy);
  const prox = state.citas.filter(c => c.fecha > hoy).length;
  setC(`
<div class="section-title">Clínica Propia</div>
<p style="color:#66756f;font-size:13px;margin-top:-.65rem;margin-bottom:1rem">Buenos días, ${currentUser.name}. Registro privado de pacientes, historias clínicas, agenda y seguimiento.</p>
<div class="statGrid">
  <div class="statBox"><div class="statNum">${state.pacientes.length}</div><div class="statLbl">Pacientes</div></div>
  <div class="statBox"><div class="statNum">${citasHoy.length}</div><div class="statLbl">Citas hoy</div></div>
  <div class="statBox"><div class="statNum">${state.historias.length}</div><div class="statLbl">Historias</div></div>
  <div class="statBox"><div class="statNum">${prox}</div><div class="statLbl">Próximas citas</div></div>
</div>
<div class="card">
  <div class="cardTitle">📅 Agenda de hoy <small>— ${new Date().toLocaleDateString('es-GT',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</small></div>
  ${citasHoy.length===0 ? '<p style="color:#aaa;font-size:14px;padding:.5rem 0">No hay citas programadas para hoy.</p>' : ''}
  ${citasHoy.map(c => {
    const pac = getPac(c.pacienteId);
    return `<div style="display:flex;align-items:center;gap:.75rem;padding:.6rem 0;border-bottom:1px solid rgba(0,0,0,.06)">
      <div style="background:var(--green-light);color:var(--green);border-radius:8px;padding:.4rem .75rem;font-size:13px;font-weight:700;min-width:56px;text-align:center">${c.hora}</div>
      <div style="flex:1">
        <div style="font-weight:500;font-size:14px">${pac.nombre}</div>
        <div style="font-size:12px;color:#999">${c.tipo}</div>
      </div>
      <span class="badge ${citaBadgeClass(c.estado)}">${c.estado}</span>
    </div>`;
  }).join('')}
</div>
<div class="card">
  <div class="cardTitle">📋 Últimas historias clínicas</div>
  <table><thead><tr><th>Paciente</th><th>Fecha</th><th>Diagnóstico</th><th>Acción</th></tr></thead>
  <tbody>${state.historias.slice().reverse().slice(0,5).map(h => `<tr>
    <td>${getPac(h.pacienteId).nombre}</td>
    <td>${fmtF(h.fecha)}</td>
    <td><span class="badge badge-blue">${h.diagnostico}</span></td>
    <td><div style="display:flex;gap:.35rem;flex-wrap:wrap">
      <button class="btn btn-sm btn-outline" onclick="verHistoria('${h.id}')">Ver</button>
      <button class="btn btn-sm btn-primary" onclick="prepModalHistoria(null,'${h.id}');openModal('modalHistoria')">Editar</button>
      <button class="btn btn-sm btn-outline" onclick="borrarHistoria('${h.id}')">Borrar</button>
    </div></td>
  </tr>`).join('')}</tbody></table>
</div>
<div class="card" style="background:var(--green-light);border-color:#b2dfce">
  <div class="cardTitle" style="color:var(--green)">⚡ Accesos rápidos</div>
  <div style="display:flex;gap:.5rem;flex-wrap:wrap">
    <button class="btn btn-primary" onclick="prepModalPaciente();openModal('modalPaciente')">+ Nuevo paciente</button>
    <button class="btn btn-primary" onclick="prepModalCita();openModal('modalCita')">+ Nueva cita</button>
    <button class="btn btn-primary" onclick="prepModalHistoria();openModal('modalHistoria')">+ Nueva historia</button>
  </div>
</div>`);
}

// ── PACIENTES ─────────────────────────────────────
function renderPacientes() {
  setC(`
<div class="searchRow">
  <input type="text" id="searchPac" placeholder="🔍  Buscar paciente por código, nombre o documento..." oninput="filtrarPacientes()"/>
  <button class="btn btn-primary" onclick="prepModalPaciente();openModal('modalPaciente')">+ Nuevo paciente</button>
</div>
<div class="card" style="padding:.5rem">
  <table><thead><tr><th>Código</th><th>Paciente</th><th>Doc.</th><th>Edad</th><th>Teléfono</th><th>Alergias</th><th>Acciones</th></tr></thead>
  <tbody id="tablaPacientes">${rowsPacientes(state.pacientes)}</tbody></table>
</div>`);
}
function rowsPacientes(lista) {
  if (!lista.length) return '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:1.5rem">No se encontraron pacientes.</td></tr>';
  return lista.map(p => `<tr>
    <td><span class="badge badge-gray">${patientCode(p)}</span></td>
    <td><div style="display:flex;align-items:center;gap:.6rem">
      <div class="pacAvatar" style="width:32px;height:32px;font-size:12px">${initials(p.nombre)}</div>
      <div><div style="font-weight:500">${p.nombre}</div><div style="font-size:11px;color:#aaa">${p.email||''}</div></div>
    </div></td>
    <td>${p.doc||'—'}</td>
    <td>${calcEdad(p.nac)}</td>
    <td>${p.tel||'—'}</td>
    <td>${p.alergias && p.alergias!=='Ninguna' ? `<span class="badge badge-red">${p.alergias}</span>` : '<span class="badge badge-green">Ninguna</span>'}</td>
    <td><div style="display:flex;gap:.35rem;flex-wrap:wrap">
      <button class="btn btn-sm btn-outline" onclick="verPaciente('${p.id}')">Ver</button>
      <button class="btn btn-sm btn-primary" onclick="prepModalPaciente('${p.id}');openModal('modalPaciente')">Editar</button>
      <button class="btn btn-sm btn-outline" onclick="borrarPaciente('${p.id}')">Borrar</button>
    </div></td>
  </tr>`).join('');
}
function filtrarPacientes() {
  const q = document.getElementById('searchPac').value.toLowerCase();
  const res = state.pacientes.filter(p => patientCode(p).includes(q) || p.nombre.toLowerCase().includes(q) || (p.doc||'').includes(q));
  document.getElementById('tablaPacientes').innerHTML = rowsPacientes(res);
}
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
      <div style="font-size:13px;color:#888">${p.email||''} ${p.tel?'· '+p.tel:''}</div>
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
  <table><tbody>${hists.slice().reverse().map(h => `<tr>
    <td>${fmtF(h.fecha)}</td>
    <td>${h.motivo}</td>
    <td><span class="badge badge-blue">${h.diagnostico}</span></td>
    <td><div style="display:flex;gap:.35rem;flex-wrap:wrap">
      <button class="btn btn-sm btn-outline" onclick="verHistoria('${h.id}')">Ver</button>
      <button class="btn btn-sm btn-primary" onclick="prepModalHistoria(null,'${h.id}');openModal('modalHistoria')">Editar</button>
      <button class="btn btn-sm btn-outline" onclick="borrarHistoria('${h.id}')">Borrar</button>
    </div></td>
  </tr>`).join('')}</tbody></table>
</div>
<div class="card">
  <div class="cardTitle">📅 Citas (${citas.length})</div>
  ${citas.length===0 ? '<p style="color:#aaa;font-size:13px">Sin citas registradas.</p>' : ''}
  <table><tbody>${citas.slice().reverse().map(c => `<tr>
    <td>${fmtF(c.fecha)} ${c.hora}</td>
    <td>${c.tipo}</td>
    <td><span class="badge ${citaBadgeClass(c.estado)}">${c.estado}</span></td>
    <td><div style="display:flex;gap:.35rem;flex-wrap:wrap">
      ${c.estado!=='confirmada'?`<button class="btn btn-sm btn-outline" onclick="confirmarCita('${c.id}')">Confirmar</button>`:''}
      ${c.estado!=='cancelada'?`<button class="btn btn-sm btn-outline" onclick="cancelarCita('${c.id}')">Cancelar cita</button>`:''}
      <button class="btn btn-sm btn-primary" onclick="prepModalCita(null,'${c.id}');openModal('modalCita')">Editar</button>
      <button class="btn btn-sm btn-outline" onclick="borrarCita('${c.id}')">Borrar</button>
    </div></td>
  </tr>`).join('')}</tbody></table>
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
function prepModalHistoria(pacId, histId) {
  editingHistoriaId = histId || null;
  const h = histId ? state.historias.find(x => String(x.id) === String(histId)) : null;
  const selectedPac = h ? h.pacienteId : pacId;
  const sel = document.getElementById('hPaciente');
  sel.innerHTML = '<option value="">Seleccionar paciente...</option>' + state.pacientes.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
  if (selectedPac) sel.value = selectedPac;
  document.getElementById('modalHistoriaTitle').textContent = h ? '📋 Editar Historia Clínica' : '📋 Nueva Historia Clínica';
  document.getElementById('btnGuardarHistoria').textContent = h ? '💾 Guardar Cambios' : '💾 Guardar Historia';
  document.getElementById('hFecha').value = h ? h.fecha || '' : new Date().toISOString().split('T')[0];
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
}
function historiaDesdeFormulario(id) {
  const pid = document.getElementById('hPaciente').value;
  if (!pid) { alert('Seleccione un paciente.'); return null; }
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
  const id = editingHistoriaId || state.nextHistId++;
  const historia = historiaDesdeFormulario(id);
  if (!historia) return;
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
function renderHistorias() {
  setC(`
<div class="searchRow">
  <input type="text" id="searchHist" placeholder="Buscar por codigo, paciente o diagnostico..." oninput="filtrarHistorias()"/>
  <button class="btn btn-primary" onclick="prepModalHistoria();openModal('modalHistoria')">+ Nueva historia</button>
</div>
<div class="card" style="padding:.5rem">
  <table><thead><tr><th>Codigo</th><th>Paciente</th><th>Fecha</th><th>Motivo</th><th>Diagnostico</th><th>Adjuntos</th><th>PA</th><th>Acciones</th></tr></thead>
  <tbody id="tablaHistorias">${rowsHistorias(state.historias)}</tbody></table>
</div>`);
}
function rowsHistorias(lista) {
  if (!lista.length) return '<tr><td colspan="8" style="text-align:center;color:#aaa;padding:1.5rem">No se encontraron historias.</td></tr>';
  return lista.slice().reverse().map(h => `<tr>
    <td><span class="badge badge-gray">${patientCode(getPac(h.pacienteId))}</span></td>
    <td><span style="font-weight:500">${getPac(h.pacienteId).nombre}</span></td>
    <td>${fmtF(h.fecha)}</td>
    <td>${h.motivo || ''}</td>
    <td><span class="badge badge-blue">${h.diagnostico || ''}</span></td>
    <td><span class="badge ${h.adjuntos?.length?'badge-green':'badge-gray'}">${h.adjuntos?.length || 0}</span></td>
    <td>${h.ta||'—'}</td>
    <td><div style="display:flex;gap:.35rem;flex-wrap:wrap">
      <button class="btn btn-sm btn-outline" onclick="verHistoria('${h.id}')">Ver</button>
      <button class="btn btn-sm btn-primary" onclick="prepModalHistoria(null,'${h.id}');openModal('modalHistoria')">Editar</button>
      <button class="btn btn-sm btn-outline" onclick="borrarHistoria('${h.id}')">Borrar</button>
    </div></td>
  </tr>`).join('');
}
function filtrarHistorias() {
  const q = document.getElementById('searchHist').value.toLowerCase();
  const res = state.historias.filter(h => patientCode(getPac(h.pacienteId)).includes(q) || getPac(h.pacienteId).nombre.toLowerCase().includes(q) || (h.diagnostico||'').toLowerCase().includes(q) || (h.motivo||'').toLowerCase().includes(q));
  document.getElementById('tablaHistorias').innerHTML = rowsHistorias(res);
}
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

function renderAgenda() {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const dias  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const hoy   = new Date();
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
    const fStr  = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(isOther?0:dayNum).padStart(2,'0')}`;
    const evs   = isOther ? [] : state.citas.filter(c => c.fecha === `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`);
    cells += `<div class="calDay${isOther?' otherMonth':''}${isHoy?' today':''}" ${!isOther?`onclick="diaClick(${calYear},${calMonth+1},${dayNum})"`:''}>
      <div class="dayNum">${dayNum}</div>
      ${evs.slice(0,2).map(c => `<div class="ev${c.estado==='confirmada'?' conf':c.estado==='cancelada'?' cancelada':' reminder'}">${c.hora} ${getPac(c.pacienteId).nombre.split(' ')[0]}</div>`).join('')}
      ${evs.length>2 ? `<div style="font-size:9px;color:#888">+${evs.length-2}</div>` : ''}
    </div>`;
  }
  setC(`
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
  <div class="calNav">
    <button onclick="cambiarMes(-1)">‹</button>
    <h4>${meses[calMonth]} ${calYear}</h4>
    <button onclick="cambiarMes(1)">›</button>
  </div>
  <button class="btn btn-primary" onclick="prepModalCita();openModal('modalCita')">+ Nueva cita</button>
</div>
<div class="card" style="padding:.75rem">
  <div class="calGrid">${dias.map(d=>`<div class="calHead">${d}</div>`).join('')}${cells}</div>
</div>
<div class="card" style="padding:.5rem">
  <div class="cardTitle" style="padding:.5rem .25rem 0">📋 Lista de citas</div>
  <table><thead><tr><th>Fecha</th><th>Hora</th><th>Paciente</th><th>Tipo</th><th>Recordatorio</th><th>Estado</th><th>Acción</th></tr></thead>
  <tbody>${state.citas.slice().sort((a,b)=>a.fecha>b.fecha?1:-1).map(c => `<tr>
    <td>${fmtF(c.fecha)}</td><td><strong>${c.hora}</strong></td>
    <td>${getPac(c.pacienteId).nombre}</td>
    <td>${c.tipo}</td>
    <td><span class="badge badge-warn">${c.recordatorio || 'Calendario general'}</span></td>
    <td><span class="badge ${citaBadgeClass(c.estado)}">${c.estado}</span></td>
    <td><div style="display:flex;gap:.35rem;flex-wrap:wrap">
      ${c.estado!=='confirmada'?`<button class="btn btn-sm btn-outline" onclick="confirmarCita('${c.id}')">Confirmar</button>`:'<span style="color:#aaa;font-size:12px">✓ Confirmada</span>'}
      ${c.estado!=='cancelada'?`<button class="btn btn-sm btn-outline" onclick="cancelarCita('${c.id}')">Cancelar cita</button>`:'<span style="color:#aaa;font-size:12px">Cancelada</span>'}
      <button class="btn btn-sm btn-primary" onclick="prepModalCita(null,'${c.id}');openModal('modalCita')">Editar</button>
      <button class="btn btn-sm btn-outline" onclick="borrarCita('${c.id}')">Borrar</button>
    </div></td>
  </tr>`).join('')}</tbody></table>
</div>`);
}
function cambiarMes(d) { calMonth += d; if(calMonth>11){calMonth=0;calYear++;} else if(calMonth<0){calMonth=11;calYear--;} renderAgenda(); }
function diaClick(y,m,d) { prepModalCita(); document.getElementById('cFecha').value = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; openModal('modalCita'); }
