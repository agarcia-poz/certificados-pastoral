// ─────────────────────────────── AUTOMATIZACIÓN ─────────────────────────────
// Cada hora (y al pulsar «Generar en segundo plano») la app:
//   1. trae las filas nuevas de las hojas enlazadas,
//   2. genera en el servidor los certificados de las actividades con «generar» automático,
//   3. los envía a firmar si la actividad lo tiene activado y
//   4. envía al alumnado los ya firmados si también está activado.
// El PDF se crea con el mismo motor que el navegador (pdf-lib + fontkit + motor.js). Las librerías
// se descargan una sola vez de jsDelivr (versión fija), se comprueba su huella SHA-256 y se guardan
// en la carpeta «Motor de PDF» de la cuenta propietaria.

const LIBRERIAS_PDF = [
  { nombre: 'pdf-lib-1.17.1.min.js', sha: '0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f',
    urls: ['https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js', 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js'] },
  { nombre: 'fontkit-1.1.1.umd.min.js', sha: 'd8df561b9fba98e24f2e5130e40948809281bbbc55a20c412359f1a0a5eb35a6',
    urls: ['https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js', 'https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js'] },
  { nombre: 'qrcode-generator-1.4.4.js', sha: '18ae399f81182bc9de916e9c77b195df20cc58d6f2d55a62b085a299f1bf1780',
    urls: ['https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', 'https://unpkg.com/qrcode-generator@1.4.4/qrcode.js'] }
];
const SEGUNDOS_TAREA = 270;     // margen bajo el límite de 6 minutos de Apps Script

let MOTOR_SRV_ = null;

function archivoMotor_(nombre) {
  const it = carpeta_('CARPETA_MOTOR').getFilesByName(nombre);
  return it.hasNext() ? it.next() : null;
}
/** Bytes de un recurso del CDN, guardado en Drive tras la primera descarga. Con sha, se comprueba la huella. */
function recursoCdn_(nombre, urls, sha) {
  const f = archivoMotor_(nombre);
  if (f) return f.getBlob().getBytes();
  let ultimo = '';
  for (let k = 0; k < urls.length; k++) {
    try {
      const r = UrlFetchApp.fetch(urls[k], { muteHttpExceptions: true, followRedirects: true });
      if (r.getResponseCode() !== 200) { ultimo = 'HTTP ' + r.getResponseCode(); continue; }
      const bytes = r.getContent();
      if (sha) {
        const h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes).map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join('');
        if (h !== sha) { ultimo = 'huella distinta'; continue; }
      }
      carpeta_('CARPETA_MOTOR').createFile(Utilities.newBlob(bytes, 'application/octet-stream', nombre));
      return bytes;
    } catch (err) { ultimo = err.message; }
  }
  throw new Error('No se pudo descargar ' + nombre + ' (' + ultimo + ').');
}
function textoDeBytes_(bytes) { return Utilities.newBlob(bytes).getDataAsString('UTF-8'); }
function u8_(bytes) { const u = new Uint8Array(bytes.length); for (let i = 0; i < bytes.length; i++) u[i] = bytes[i] & 255; return u; }

/** Carga pdf-lib, fontkit, qrcode y el motor en el ámbito global (una vez por ejecución). */
function motorServidor_() {
  if (MOTOR_SRV_) return MOTOR_SRV_;
  const g = globalThis;
  if (typeof g.setTimeout !== 'function') { g.setTimeout = function (f) { Promise.resolve().then(f); return 0; }; g.clearTimeout = function () { }; }
  if (typeof g.self === 'undefined') g.self = g;
  const codigo = LIBRERIAS_PDF.map(function (l) { return textoDeBytes_(recursoCdn_(l.nombre, l.urls, l.sha)); });
  const motor = recurso_('Motor').replace(/^\s*<script>\s*/, '').replace(/\s*<\/script>\s*$/, '');
  (0, eval)(codigo.join('\n;\n') + '\n;\n' + motor);
  if (!g.PDFLib || !g.fontkit || !g.Motor) throw new Error('No se pudo preparar el motor de PDF en el servidor.');
  MOTOR_SRV_ = { PDFLib: g.PDFLib, fontkit: g.fontkit, Motor: g.Motor, qrcode: g.qrcode, fuentes: {}, imagenes: {} };
  return MOTOR_SRV_;
}

function fuentesServidor_(M, tipo) {
  if (M.fuentes[tipo]) return M.fuentes[tipo];
  const b = {};
  Object.keys(M.Motor.ESTILOS).forEach(function (estilo) {
    const url = M.Motor.urlFuente(tipo, estilo);
    try { b[estilo] = u8_(recursoCdn_('fuente-' + url.split('/').pop(), [url, url.replace('https://cdn.jsdelivr.net/npm/', 'https://unpkg.com/')], '')); } catch (err) { }
  });
  M.fuentes[tipo] = b;
  return b;
}

/** Ancho y alto de un PNG o JPEG a partir de sus bytes. */
function dimensionesImagen_(u) {
  if (u[0] === 0x89 && u[1] === 0x50) return { w: (u[16] << 24 | u[17] << 16 | u[18] << 8 | u[19]) >>> 0, h: (u[20] << 24 | u[21] << 16 | u[22] << 8 | u[23]) >>> 0, tipo: 'png' };
  let i = 2;
  while (i < u.length) {
    if (u[i] !== 0xFF) { i++; continue; }
    const m = u[i + 1];
    if (m >= 0xC0 && m <= 0xCF && [0xC4, 0xC8, 0xCC].indexOf(m) < 0) return { h: u[i + 5] << 8 | u[i + 6], w: u[i + 7] << 8 | u[i + 8], tipo: 'jpg' };
    i += 2 + (u[i + 2] << 8 | u[i + 3]);
  }
  return { w: 1000, h: 1000, tipo: 'jpg' };
}
function imagenServidor_(bytes) { const u = u8_(bytes); const d = dimensionesImagen_(u); return { w: d.w, h: d.h, tipo: d.tipo, bytes: u }; }

function imagenesServidor_(M, d) {
  if (!M.imagenes.pastoral) {
    const m = recurso_('Logos').match(/const LOGOS = (\{[\s\S]*?\});/);
    const logos = m ? JSON.parse(m[1]) : {};
    Object.keys(logos).forEach(function (k) { M.imagenes[k] = imagenServidor_(Utilities.base64Decode(logos[k].split(',')[1])); });
  }
  const r = { safa: M.imagenes.safa, uja: M.imagenes.uja, pastoral: M.imagenes.pastoral };
  const deDrive = function (id) {
    if (!id) return null;
    if (M.imagenes['d_' + id]) return M.imagenes['d_' + id];
    try {
      const f = DriveApp.getFileById(id);
      if (!enCarpeta_(f, 'CARPETA_IMAGENES')) return null;
      return (M.imagenes['d_' + id] = imagenServidor_(f.getBlob().getBytes()));
    } catch (err) { return null; }
  };
  if (d.logoId && deDrive(d.logoId)) r.pastoral = deDrive(d.logoId);
  if (d.fondoId && deDrive(d.fondoId)) r.fondo = deDrive(d.fondoId);
  Object.keys(r).forEach(function (k) { if (!r[k]) delete r[k]; });
  return r;
}

function matrizQrServidor_(M) {
  return function (texto) {
    if (!M.qrcode) return null;
    const q = M.qrcode(0, 'M'); q.addData(texto); q.make();
    const n = q.getModuleCount(), m = [];
    for (let r = 0; r < n; r++) { m.push([]); for (let c = 0; c < n; c++) m[r].push(q.isDark(r, c)); }
    return m;
  };
}

/** Los mismos datos que usa el editor del navegador para rellenar el certificado. */
function datosCertificado_(a, p, rol, codigo) {
  return { nombre: p.nombre, apellidos: p.apellidos, dni: p.dni, actividad: a.nombre, fechas: a.fechas,
    lugar: a.lugar || CONFIG.LUGAR_POR_DEFECTO, horas: Number(a.horas) || 0, ects: Number(a.ects) || 0, rol: rol || 'Participante',
    curso: a.curso, fecha: fechaLarga_(new Date()), codigo: codigo, url: urlApp_(), firmantes: firmantesCert_() };
}

/** Genera en el servidor los certificados en cola de una actividad, hasta agotar el tiempo. */
async function generarActividadServidor_(a, quien, fin) {
  const M = motorServidor_();
  const diseno = M.Motor.mezclar(disenoDe_(a));
  const bytesF = fuentesServidor_(M, diseno.tipografia);
  const medir = await M.Motor.crearMedidor(M.PDFLib, M.fontkit, bytesF);
  const imgs = imagenesServidor_(M, diseno);
  const qr = matrizQrServidor_(M);
  const personas = leerPersonas_();
  const cola = leer_('Inscripciones').filter(function (i) { return i.actividad === a.id && enCola_(i); });
  const res = { hechos: 0, fallos: [], quedan: 0 };
  const validos = cola.filter(function (i) {
    const p = personas[i.persona];
    if (p && dniValido_(p.dni) && p.nombre && p.apellidos) return true;
    res.fallos.push(i.reg + ': faltan datos o el DNI no es válido');
    return false;
  });
  const codigos = conCerrojo_(function () { return reservar_(validos.map(function (i) { return i.reg; })); });
  for (let k = 0; k < validos.length; k++) {
    if (Date.now() > fin) { res.quedan = validos.length - k; break; }
    const i = validos[k], p = personas[i.persona], codigo = codigos[i.reg];
    if (!codigo) continue;
    try {
      const r = M.Motor.componer(diseno, datosCertificado_(a, p, i.rol, codigo), medir, imgs, qr);
      if (r.avisos.some(function (t) { return /no cabe/.test(t); })) throw new Error('el texto no cabe en una página');
      const pdf = await M.Motor.aPdf(M.PDFLib, M.fontkit, r.ops, bytesF, imgs, { titulo: diseno.titulo + ' · ' + a.nombre, asunto: codigo });
      const bytes = Array.prototype.map.call(pdf, function (b) { return b > 127 ? b - 256 : b; });
      conCerrojo_(function () { guardarPdf_(quien, i.reg, codigo, bytes, null); });
      res.hechos++;
    } catch (err) { res.fallos.push(i.reg + ': ' + err.message); }
  }
  return res;
}

/** Comprueba que la llamada viene de un disparador del proyecto o de la propia cuenta propietaria. */
function deDisparador_(e) {
  const uid = e && e.triggerUid ? String(e.triggerUid) : '';
  if (uid) { try { if (ScriptApp.getProjectTriggers().some(function (t) { return t.getUniqueId() === uid; })) return; } catch (err) { } }
  soloPropietaria_();
}

/** Disparador horario. */
async function tareaAutomatica(e) {
  deDisparador_(e);
  if (!instalado_()) return null;
  esquema_();
  return await ejecutarAutomatizacion_(e);
}

/** Disparador de un solo uso («Generar en segundo plano»): hace la tarea y se borra. */
async function tareaAhora(e) {
  deDisparador_(e);
  try { ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'tareaAhora') ScriptApp.deleteTrigger(t); }); } catch (err) { }
  if (!instalado_()) return null;
  esquema_();
  return await ejecutarAutomatizacion_(e);
}

async function ejecutarAutomatizacion_() {
  const fin = Date.now() + SEGUNDOS_TAREA * 1000;
  const props = PropertiesService.getScriptProperties();
  const encargos = jsonDe_(props.getProperty('GENERAR_YA'), []) || [];
  props.deleteProperty('GENERAR_YA');
  const informe = { hojas: sincronizarHojas_(), generados: {}, aFirma: 0, enviados: 0 };
  const acts = leer_('Actividades');
  const pedidas = {};
  encargos.forEach(function (x) { (pedidas[x.act] = pedidas[x.act] || []).push(x.quien); });
  for (let k = 0; k < acts.length; k++) {
    const a = acts[k], auto = autoDe_(a);
    if (!auto.generar && !pedidas[a.id]) continue;
    if (!leer_('Inscripciones').some(function (i) { return i.actividad === a.id && enCola_(i); })) continue;
    if (Date.now() > fin) { informe.sinTiempo = true; break; }
    try {
      informe.generados[a.id] = await generarActividadServidor_(a, pedidas[a.id] ? pedidas[a.id][0] : 'automático', fin);
      registrar_('automático', 'Generación en el servidor', a.id + ' · ' + informe.generados[a.id].hechos + ' hechos · ' + informe.generados[a.id].fallos.length + ' con problemas');
    } catch (err) {
      informe.generados[a.id] = { hechos: 0, fallos: [err.message], quedan: 0 };
      registrar_('automático', 'Error al generar en el servidor', a.id + ' · ' + err.message);
    }
    if (informe.generados[a.id].quedan) encargos.filter(function (x) { return x.act === a.id; }).forEach(function (x) { volverAEncargar_(x); });
  }
  leer_('Actividades').forEach(function (a) {
    const auto = autoDe_(a);
    const ins = leer_('Inscripciones').filter(function (i) { return i.actividad === a.id; });
    if (auto.firmar) {
      const cods = ins.filter(function (i) { return i.estado === 'generado'; }).map(function (i) { return i.codigo; });
      if (cods.length) informe.aFirma += enviarAFirmar_('automático', cods, '');
    }
    if (auto.alumnado) {
      ins.filter(function (i) { return i.estado === 'firmado'; }).forEach(function (i) {
        if (conCerrojo_(function () { return enviarAlumnadoUno_('automático', i.codigo); }) === 'enviado') informe.enviados++;
      });
    }
  });
  // Aviso a quien pidió la generación
  const quienes = {};
  encargos.forEach(function (x) { if (x.quien && x.quien !== 'automático') quienes[x.quien] = true; });
  Object.keys(quienes).forEach(function (email) {
    const lineas = Object.keys(informe.generados).map(function (id) {
      const g = informe.generados[id], a = acts.filter(function (x) { return x.id === id; })[0] || {};
      return '• ' + esc_(a.nombre || id) + ': ' + g.hechos + ' generado(s)' + (g.fallos.length ? ', ' + g.fallos.length + ' con problemas' : '') + (g.quedan ? ', ' + g.quedan + ' quedan para la próxima vuelta' : '');
    });
    try {
      enviarEmail_(email, 'Certificados generados · Pastoral C.U. SAFA', plantillaEmail_({
        titulo: 'Generación terminada', titular: 'Generación terminada', subtitular: 'Certificados de Pastoral',
        parrafos: ['Hola:', 'La generación en segundo plano ha terminado.'],
        destacado: { titulo: 'Resultado', lineas: lineas.length ? lineas : ['No había certificados pendientes.'] },
        boton: { texto: 'Abrir la aplicación', url: urlApp_() + '#certificados' }, cierre: informe.aFirma ? 'Se han enviado ' + informe.aFirma + ' a firmar automáticamente.' : ''
      }));
    } catch (err) { }
  });
  return informe;
}
function volverAEncargar_(x) {
  const props = PropertiesService.getScriptProperties();
  const l = jsonDe_(props.getProperty('GENERAR_YA'), []) || [];
  l.push(x);
  props.setProperty('GENERAR_YA', JSON.stringify(l));
  try { ScriptApp.newTrigger('tareaAhora').timeBased().after(60 * 1000).create(); } catch (err) { }
}

/** Desde el panel: generar en el servidor sin tener la ventana abierta. */
function api_generarEnServidor(token, actId) {
  const u = sesion_(token, NIVEL.coordinacion);
  const a = actividad_(actId);
  if (!a) throw new Error('La actividad no existe.');
  const n = leer_('Inscripciones').filter(function (i) { return i.actividad === a.id && enCola_(i); }).length;
  if (!n) throw new Error('No hay certificados validados pendientes de generar en esta actividad.');
  conCerrojo_(function () { volverAEncargar_({ act: a.id, quien: u.email }); });
  registrar_(u.email, 'Generación en segundo plano pedida', a.id + ' · ' + n);
  return { n: n };
}
