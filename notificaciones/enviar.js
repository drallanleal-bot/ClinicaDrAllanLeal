// Se ejecuta cada mañana en GitHub Actions (.github/workflows/notificaciones.yml).
// Lee las citas en Firebase, cuenta los recordatorios con la misma lógica de la app (js/recordatorios.js)
// y manda un aviso a los teléfonos activados. El aviso NO lleva nombres ni datos de pacientes.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const admin = require('firebase-admin');

const prueba = process.env.PRUEBA === 'true';

function hoyGuatemala() {
  return new Intl.DateTimeFormat('en-CA', { timeZone:'America/Guatemala', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
}

function contarConLogicaDeLaApp(estado) {
  const ctx = { state:{ citas:[], ...estado }, todayLocalISO:hoyGuatemala, getPac:() => ({ nombre:'' }), escapeHtml:t => String(t), plural:(n, a, b) => `${n} ${n === 1 ? a : b}`, console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'recordatorios.js'), 'utf8'), ctx);
  return vm.runInContext(`({
    porEnviar: avisosPorEnviar().length,
    porLlamar: citasPorLlamar().length,
    horarioPendiente: !!horarioSemanaPendiente(),
    citasHoy: state.citas.filter(c => c.estado !== 'cancelada' && c.fecha === todayLocalISO()).length
  })`, ctx);
}

async function main() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) { console.log('Falta el secreto FIREBASE_SERVICE_ACCOUNT: no se envía nada.'); return; }
  admin.initializeApp({ credential:admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const db = admin.firestore();

  const compartido = await db.collection('pacientes').doc('__estadoCompartido').get();
  const r = contarConLogicaDeLaApp((compartido.data() || {}).state || {});
  console.log('Hoy', hoyGuatemala(), r);

  const partes = [];
  if (r.porEnviar) partes.push(`📤 ${r.porEnviar} ${r.porEnviar === 1 ? 'recordatorio' : 'recordatorios'} por enviar`);
  if (r.porLlamar) partes.push(`📞 ${r.porLlamar} por llamar`);
  if (r.horarioPendiente) partes.push('🗓️ Confirme su horario de la próxima semana');
  if (r.citasHoy) partes.push(`🩺 ${r.citasHoy} ${r.citasHoy === 1 ? 'cita' : 'citas'} hoy`);
  if (!partes.length && !prueba) { console.log('Nada pendiente: no se envía aviso.'); return; }
  const cuerpo = partes.length ? partes.join(' · ') : '✅ Prueba: todo al día.';

  const usuarios = await db.collection('usuarios').get();
  for (const u of usuarios.docs) {
    const datos = u.data() || {};
    const tokens = Array.isArray(datos.pushTokens) ? datos.pushTokens.filter(Boolean) : [];
    if (!tokens.length || datos.active !== true) continue;
    // Hay varios horarios de respaldo en la mañana: solo se manda una vez al día.
    if (!prueba && datos.pushUltimoAviso === hoyGuatemala()) { console.log('Ya se avisó hoy.'); continue; }
    const res = await admin.messaging().sendEachForMulticast({
      tokens,
      data:{ titulo:'Clínica Dr. Allan Leal', cuerpo, url:'./' },
      webpush:{ headers:{ Urgency:'high', TTL:'43200' } }
    });
    const vencidos = res.responses.map((x, i) => (!x.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(x.error?.code || '')) ? tokens[i] : null).filter(Boolean);
    console.log(`Usuario ${u.id.slice(0, 6)}…: ${res.successCount} enviados, ${res.failureCount} fallidos`);
    if (vencidos.length) await u.ref.update({ pushTokens:admin.firestore.FieldValue.arrayRemove(...vencidos) });
    if (res.successCount && !prueba) await u.ref.update({ pushUltimoAviso:hoyGuatemala() });
  }
}

main().catch(e => { console.error(e); process.exit(1); });
