// ── AYUDAS EN LA HISTORIA CLÍNICA Y LIMPIEZA DE PACIENTES ─────────────────
// • Peso en libras: se convierte solo a kg para el IMC.
// • Al abrir una historia se ven alergias, antecedentes y las consultas anteriores del paciente.
// • En una historia nueva vienen prellenados el diagnóstico, el tratamiento y la altura de la última consulta.
// • Pacientes repetidos: aviso al crear y herramienta para unirlos o borrar los de prueba.

const LIBRAS_POR_KG = 2.20462;
const CAMPOS_PRELLENADOS = [
  { id:'hDiagnostico', campo:'diagnostico' },
  { id:'hTratamiento', campo:'tratamiento' },
  { id:'hAltura', campo:'altura' }
];

// ── Peso ──
function redondear1(n) { return Math.round(n * 10) / 10; }
function pesoDesdeLibras() {
  const lb = parseFloat(document.getElementById('hPesoLb')?.value);
  const kg = document.getElementById('hPesoKg');
  if (kg) kg.value = lb > 0 ? redondear1(lb / LIBRAS_POR_KG) : '';
  updateClinicImc();
}
function pesoDesdeKg() {
  const kg = parseFloat(document.getElementById('hPesoKg')?.value);
  const lb = document.getElementById('hPesoLb');
  if (lb) lb.value = kg > 0 ? redondear1(kg * LIBRAS_POR_KG) : '';
  updateClinicImc();
}

// ── Consultas anteriores ──
function historiasPreviasDe(pid, excluirId, antesDe) {
  return state.historias
    .filter(h => String(h.pacienteId) === String(pid) && String(h.id) !== String(excluirId || '') && (!antesDe || String(h.fecha || '') <= antesDe))
    .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || Number(b.id || 0) - Number(a.id || 0));
}
function textoLineas(t) { return escapeHtml(String(t || '').trim()).replace(/\n/g, '<br>'); }
function renderResumenPacienteHistoria(pid) {
  const box = document.getElementById('hResumenPaciente');
  if (!box) return;
  const p = pid ? getPac(pid) : null;
  if (!p) { box.innerHTML = ''; box.hidden = true; return; }
  const actual = editingHistoriaId ? state.historias.find(h => String(h.id) === String(editingHistoriaId)) : null;
  const previas = historiasPreviasDe(pid, editingHistoriaId, actual?.fecha);
  const alergias = String(p.alergias || '').trim();
  const sinAlergias = !alergias || /^ningun/i.test(alergias);
  const ultima = previas[0];
  const glucometrias = previas.slice(1).filter(h => String(h.gmt || '').trim()).slice(0, 6);
  box.hidden = false;
  box.innerHTML = `
    <div class="resumenPacCab"><strong>🧾 Antecedentes de ${escapeHtml(p.nombre || '')}</strong>
      <button type="button" class="btn btn-sm btn-outline" onclick="editarAntecedentesDesdeHistoria('${p.id}')">✏️ Editar antecedentes</button></div>
    <div class="resumenPacGrid">
      <div class="resumenPacDato ${sinAlergias ? '' : 'alerta'}"><b>⚠️ Alergias</b><span>${sinAlergias ? 'Ninguna conocida' : textoLineas(alergias)}</span></div>
      <div class="resumenPacDato"><b>Antecedentes personales</b><span>${textoLineas(p.antecedentes) || '<i>Sin registrar</i>'}</span></div>
      <div class="resumenPacDato"><b>Antecedentes familiares</b><span>${textoLineas(p.familiares) || '<i>Sin registrar</i>'}</span></div>
    </div>
    ${ultima ? `<div class="resumenPacUltima">
      <b>Última consulta: ${fmtF(ultima.fecha)}</b>${ultima.pesoKg ? ` · Peso ${escapeHtml(String(ultima.pesoKg))} kg (${redondear1(Number(ultima.pesoKg) * LIBRAS_POR_KG)} lb)` : ''}${ultima.ta ? ` · PA ${escapeHtml(ultima.ta)}` : ''}
      <div><b>🩸 Glucómetro:</b> ${ultima.gmt ? escapeHtml(ultima.gmt) : 'no se tomó'}</div>
      ${glucometrias.length ? `<div class="resumenPacGluco"><b>Glucómetro en consultas anteriores:</b> ${glucometrias.map(h => `${escapeHtml(h.gmt)} <span>(${fmtF(h.fecha)})</span>`).join(' · ')}</div>` : ''}
      ${ultima.diagnostico ? `<div><b>Dx:</b> ${textoLineas(ultima.diagnostico)}</div>` : ''}
      ${ultima.tratamiento ? `<div><b>Tratamiento que se dejó:</b><br>${textoLineas(ultima.tratamiento)}</div>` : ''}
    </div>
    ${previas.length > 1 ? `<details class="resumenPacPrevias"><summary>Ver todas las consultas anteriores (${previas.length})</summary>
      ${previas.map(h => `<div class="resumenPacConsulta"><b>${fmtF(h.fecha)}</b>${h.motivo ? ` · ${escapeHtml(h.motivo)}` : ''}${h.pesoKg ? ` · ${escapeHtml(String(h.pesoKg))} kg` : ''}${h.ta ? ` · PA ${escapeHtml(h.ta)}` : ''}${h.gmt ? ` · 🩸 ${escapeHtml(h.gmt)}` : ''}
        ${h.diagnostico ? `<div><b>Dx:</b> ${textoLineas(h.diagnostico)}</div>` : ''}
        ${h.tratamiento ? `<div><b>Tx:</b> ${textoLineas(h.tratamiento)}</div>` : ''}</div>`).join('')}
    </details>` : ''}` : '<div class="resumenPacUltima">Primera consulta registrada en la app.</div>'}
    <div class="resumenPacNota" id="hNotaPrellenado"></div>`;
}
// Historia nueva: copia diagnóstico, tratamiento y altura de la última consulta (solo si el campo está vacío
// o todavía tiene lo que se copió de otro paciente).
function prellenarDesdeUltimaConsulta(pid) {
  if (editingHistoriaId) return;
  const ultima = pid ? historiasPreviasDe(pid)[0] : null;
  const copiados = [];
  CAMPOS_PRELLENADOS.forEach(({ id, campo }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const intacto = !String(el.value || '').trim() || (el.dataset.auto && el.value === el.dataset.auto);
    if (!intacto) return;
    const valor = ultima && ultima[campo] ? String(ultima[campo]) : '';
    el.value = valor;
    el.dataset.auto = valor;
    el.classList.toggle('prellenado', !!valor);
    if (valor) copiados.push(id);
  });
  if (copiados.includes('hAltura')) updateClinicImc();
  const nota = document.getElementById('hNotaPrellenado');
  if (nota) nota.textContent = ultima && copiados.length ? `📝 Diagnóstico, tratamiento y altura vienen prellenados de la consulta del ${fmtF(ultima.fecha)}. Déjelos igual o modifíquelos.` : '';
}
function quitarMarcaPrellenado(el) {
  if (el && el.dataset.auto !== undefined && el.value !== el.dataset.auto) el.classList.remove('prellenado');
}
function alCambiarPacienteHistoria(pid) {
  renderPatientPreviousAttachments(pid, editingHistoriaId);
  renderResumenPacienteHistoria(pid);
  prellenarDesdeUltimaConsulta(pid);
}
// Se llama al final de prepModalHistoria.
function prepararAyudasHistoria(h) {
  CAMPOS_PRELLENADOS.forEach(({ id }) => { const el = document.getElementById(id); if (el) { el.dataset.auto = ''; el.classList.remove('prellenado'); } });
  pesoDesdeKg();
  const pid = document.getElementById('hPaciente')?.value;
  renderResumenPacienteHistoria(pid);
  if (!h) prellenarDesdeUltimaConsulta(pid);
  mostrarFechaControl();
}
function editarAntecedentesDesdeHistoria(pid) {
  const p = getPac(pid);
  if (!p) return;
  const m = asegurarModal('modalAntecedentes');
  m.innerHTML = `<div class="modal" style="max-width:560px">
    <div class="modalHead"><h3>✏️ Antecedentes · ${escapeHtml(p.nombre || '')}</h3><button class="btnClose" onclick="closeModal('modalAntecedentes')">✕</button></div>
    <div class="fGroup"><label>Alergias conocidas</label><input type="text" id="antAlergias" value="${escapeHtml(p.alergias || '')}"></div>
    <div class="fGroup"><label>Antecedentes médicos personales</label><textarea id="antPersonales" rows="5" placeholder="Ej.: DM2 desde 2015, metformina 850 mg c/12 h...">${escapeHtml(p.antecedentes || '')}</textarea></div>
    <div class="fGroup"><label>Antecedentes familiares</label><textarea id="antFamiliares" rows="3">${escapeHtml(p.familiares || '')}</textarea></div>
    <div class="modalActions">
      <button class="btn btn-outline" onclick="closeModal('modalAntecedentes')">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarAntecedentesDesdeHistoria('${p.id}')">💾 Guardar</button>
    </div>
  </div>`;
  m.style.zIndex = '1200';
  openModal('modalAntecedentes');
}
function guardarAntecedentesDesdeHistoria(pid) {
  const p = getPac(pid);
  if (!p) return;
  p.alergias = document.getElementById('antAlergias').value.trim() || 'Ninguna';
  p.antecedentes = document.getElementById('antPersonales').value;
  p.familiares = document.getElementById('antFamiliares').value;
  savePatientToCloud(p);
  saveAppData({ backupToFolder:true });
  closeModal('modalAntecedentes');
  renderResumenPacienteHistoria(pid);
  showToast('🧾 Antecedentes guardados.');
}

// ── Próximo control con fecha elegida ──
function mostrarFechaControl() {
  const sel = document.getElementById('hControl');
  const caja = document.getElementById('hControlFechaCaja');
  if (!sel || !caja) return;
  caja.hidden = sel.value !== 'fecha';
  const input = document.getElementById('hControlFecha');
  if (input) input.min = todayLocalISO();
}

// ── Pacientes repetidos ──
function nombreClave(n) { return normalizeOccSearchText(n).replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function docClave(d) { return String(d || '').replace(/\D/g, ''); }
function pacienteParecido(nombre, doc, excluirId) {
  const n = nombreClave(nombre); const d = docClave(doc);
  return state.pacientes.find(p => String(p.id) !== String(excluirId || '') && ((n && nombreClave(p.nombre) === n) || (d.length >= 6 && docClave(p.doc) === d)));
}
function gruposDuplicados() {
  const padre = new Map();
  const raiz = id => { while (padre.get(id) !== id) id = padre.get(id); return id; };
  state.pacientes.forEach(p => padre.set(String(p.id), String(p.id)));
  const porClave = new Map();
  state.pacientes.forEach(p => {
    [`n:${nombreClave(p.nombre)}`, docClave(p.doc).length >= 6 ? `d:${docClave(p.doc)}` : ''].filter(k => k && k !== 'n:').forEach(k => {
      if (porClave.has(k)) padre.set(raiz(String(p.id)), raiz(porClave.get(k))); else porClave.set(k, String(p.id));
    });
  });
  const grupos = new Map();
  state.pacientes.forEach(p => { const r = raiz(String(p.id)); if (!grupos.has(r)) grupos.set(r, []); grupos.get(r).push(p); });
  return [...grupos.values()].filter(g => g.length > 1);
}
function conteosPaciente(id) {
  return {
    historias:state.historias.filter(h => String(h.pacienteId) === String(id)).length,
    citas:state.citas.filter(c => String(c.pacienteId) === String(id)).length
  };
}
function pareceDePrueba(p) { return /\b(prueba|test|demo|ejemplo|paciente \d+|asdf|xxx)\b/i.test(normalizeOccSearchText(p.nombre)); }
function abrirLimpiezaPacientes() {
  const grupos = gruposDuplicados();
  const prueba = state.pacientes.filter(pareceDePrueba);
  const vacios = state.pacientes.filter(p => !pareceDePrueba(p) && !conteosPaciente(p.id).historias && !conteosPaciente(p.id).citas)
    .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  const filaBorrar = p => { const c = conteosPaciente(p.id); return `<div class="filaSimple"><span class="filaTexto"><strong>${escapeHtml(p.nombre || '(sin nombre)')}</strong>
    <span class="filaSub">Código ${escapeHtml(patientCode(p))} · ${plural(c.historias, 'historia', 'historias')} · ${plural(c.citas, 'cita', 'citas')}${p.tel ? ' · ' + escapeHtml(p.tel) : ''}</span></span>
    <button class="btn btn-sm btn-outline btnCancelo" onclick="borrarPacienteLimpieza('${p.id}')">🗑️ Borrar</button></div>`; };
  const m = asegurarModal('modalLimpieza');
  m.innerHTML = `<div class="modal" style="max-width:640px">
    <div class="modalHead"><h3>🧹 Pacientes repetidos y de prueba</h3><button class="btnClose" onclick="closeModal('modalLimpieza');refreshClinicPage('pacientes')">✕</button></div>
    <div class="cardTitle" style="margin-top:.25rem">🔗 Repetidos (${grupos.length})</div>
    <p class="avisoNota">Elija cuál conservar. Las historias y citas de los demás pasan a ese paciente y los datos que le falten se completan; después se borran los repetidos.</p>
    ${grupos.length ? grupos.map((g, i) => {
      const orden = g.slice().sort((a, b) => conteosPaciente(b.id).historias - conteosPaciente(a.id).historias);
      return `<div class="grupoDup" id="grupoDup${i}">${orden.map((p, j) => { const c = conteosPaciente(p.id); return `<label class="filaDup"><input type="radio" name="dup${i}" value="${p.id}" ${j === 0 ? 'checked' : ''}>
        <span><strong>${escapeHtml(p.nombre || '')}</strong><span class="filaSub">Código ${escapeHtml(patientCode(p))} · ${plural(c.historias, 'historia', 'historias')} · ${plural(c.citas, 'cita', 'citas')}${p.doc ? ' · DPI ' + escapeHtml(p.doc) : ''}${p.tel ? ' · ' + escapeHtml(p.tel) : ''}</span></span></label>`; }).join('')}
        <div class="avisoBtns"><button class="btn btn-sm btn-primary" onclick="unirGrupoDuplicado(${i})">🔗 Unir en el marcado</button></div></div>`;
    }).join('') : '<div class="listaVacia">✅ No hay pacientes repetidos.</div>'}
    <div class="cardTitle" style="margin-top:1rem">🧪 Parecen de prueba (${prueba.length})</div>
    ${prueba.length ? `<div class="listaPlana">${prueba.map(filaBorrar).join('')}</div>` : '<div class="listaVacia">No encontré nombres de prueba.</div>'}
    <details class="resumenPacPrevias" style="margin-top:1rem"><summary>Pacientes sin historias ni citas (${vacios.length}) — revise si alguno era de prueba</summary>
      ${vacios.length ? `<div class="listaPlana">${vacios.map(filaBorrar).join('')}</div>` : '<div class="listaVacia">Ninguno.</div>'}
    </details>
  </div>`;
  openModal('modalLimpieza');
}
function borrarPacienteLimpieza(id) {
  const antes = state.pacientes.length;
  borrarPaciente(id);
  if (state.pacientes.length !== antes) abrirLimpiezaPacientes();
}
function unirGrupoDuplicado(i) {
  const grupo = gruposDuplicados()[i];
  const elegido = document.querySelector(`#grupoDup${i} input[type=radio]:checked`)?.value;
  const keep = grupo && grupo.find(p => String(p.id) === String(elegido));
  if (!keep) return;
  const otros = grupo.filter(p => p !== keep);
  if (!confirm(`¿Unir ${otros.length + 1} registros en «${keep.nombre}» (código ${patientCode(keep)})?\n\nSus historias y citas quedan juntas y se borran los repetidos.`)) return;
  otros.forEach(o => {
    state.historias.forEach(h => { if (String(h.pacienteId) === String(o.id)) h.pacienteId = keep.id; });
    state.citas.forEach(c => { if (String(c.pacienteId) === String(o.id)) c.pacienteId = keep.id; });
    ['doc', 'nac', 'sexo', 'tel', 'email'].forEach(k => { if (!String(keep[k] || '').trim() && String(o[k] || '').trim()) keep[k] = o[k]; });
    const alergO = String(o.alergias || '').trim();
    if (alergO && !/^ningun/i.test(alergO)) {
      const alergK = String(keep.alergias || '').trim();
      keep.alergias = !alergK || /^ningun/i.test(alergK) ? alergO : (alergK.includes(alergO) ? alergK : `${alergK}; ${alergO}`);
    }
    ['antecedentes', 'familiares'].forEach(k => {
      const a = String(keep[k] || '').trim(); const b = String(o[k] || '').trim();
      if (b && !a.includes(b)) keep[k] = a ? `${a}\n${b}` : b;
    });
    state.pacientes = state.pacientes.filter(p => p !== o);
    deletePatientFromCloud(o.id);
  });
  normalizeStateCounters();
  savePatientToCloud(keep);
  saveAppData({ backupToFolder:true });
  showToast('🔗 Pacientes unidos.');
  abrirLimpiezaPacientes();
}
