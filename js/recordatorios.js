// ── RECORDATORIOS ─────────────────────────────────
function renderRecordatorios() {
  const hoy  = todayLocalISO();
  const prox = state.citas.filter(c => c.fecha >= hoy).sort((a,b) => a.fecha > b.fecha ? 1 : -1);
  setC(`
<div class="card">
  <div class="cardTitle">🔔 Centro de recordatorios</div>
  <p style="font-size:13px;color:#888;margin-bottom:1rem">Genere mensajes listos para copiar y enviar por WhatsApp a sus pacientes.</p>
  ${prox.length === 0 ? '<p style="color:#aaa">No hay citas próximas programadas.</p>' : ''}
  ${prox.map(c => {
    const pac = getPac(c.pacienteId);
    return `<div style="border:1.5px solid var(--border);border-radius:10px;padding:1rem;margin-bottom:.75rem">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:.75rem">
        <div style="display:flex;align-items:center;gap:.65rem">
          <div class="pacAvatar" style="width:38px;height:38px;font-size:13px">${initials(pac.nombre)}</div>
          <div>
            <div style="font-weight:600;font-size:14.5px">${pac.nombre}</div>
            <div style="font-size:12.5px;color:#888">📅 ${fmtF(c.fecha)} · ⏰ ${c.hora} · ${c.tipo}</div>
          </div>
        </div>
        <span class="badge ${citaBadgeClass(c.estado)}">${c.estado}</span>
      </div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" onclick="genRecordatorio('${pac.nombre}','${fmtF(c.fecha)}','${c.hora}','${c.tipo}')">📱 Copiar mensaje WhatsApp</button>
        ${c.estado!=='confirmada'?`<button class="btn btn-sm btn-outline" onclick="confirmarCita('${c.id}');renderRecordatorios()">✅ Marcar confirmada</button>`:''}
        ${c.estado!=='cancelada'?`<button class="btn btn-sm btn-outline" onclick="cancelarCita('${c.id}');renderRecordatorios()">Cancelar cita</button>`:''}
      </div>
    </div>`;
  }).join('')}
</div>
<div class="card" style="background:var(--blue-light);border-color:#b8d4ee">
  <div class="cardTitle" style="color:var(--blue)">📋 Resumen del médico — próximas citas</div>
  ${prox.slice(0,5).map(c => `<div style="display:flex;align-items:center;gap:.75rem;padding:.45rem 0;border-bottom:1px solid rgba(0,0,0,.07);font-size:14px">
    <strong style="min-width:50px">${c.hora}</strong>
    <span>${getPac(c.pacienteId).nombre}</span>
    <span style="color:#888;font-size:12px;margin-left:auto">${c.tipo}</span>
    <span class="badge ${citaBadgeClass(c.estado)}">${c.estado}</span>
  </div>`).join('')}
</div>`);
}
function genRecordatorio(nombre, fecha, hora, tipo) {
  const msg = `📅 *Recordatorio de Cita Médica*\n\nEstimado/a *${nombre}*,\n\nLe recordamos que tiene una cita programada:\n\n🗓 Fecha: *${fecha}*\n⏰ Hora: *${hora}*\n🩺 Tipo: ${tipo}\n\nPor favor:\n• Llegue 10 minutos antes\n• Traiga su documento de identidad\n• Lleve exámenes o resultados previos si los tiene\n\nPara confirmar o cancelar su cita, escríbanos a este número.\n\n¡Le esperamos! 😊🏥`;
  navigator.clipboard && navigator.clipboard.writeText(msg).catch(() => {});
  const ta = document.createElement('textarea'); ta.value = msg; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  showToast('✅ Mensaje copiado al portapapeles.\n\nYa puede pegarlo en WhatsApp.');
}

function openClinicWhatsApp(text = '') {
  const phone = (state.socialLinks?.whatsapp || '+50238006697').replace(/\D/g, '');
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
