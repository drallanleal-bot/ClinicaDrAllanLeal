// Arranque: se ejecuta al final, cuando todos los archivos ya definieron sus funciones.
loadLocalData();
ensureOcupacionalState();

// Modo app: registra el service worker para poder instalar el sistema en teléfono y tablet.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('No se pudo activar el modo app.', e)));
}
