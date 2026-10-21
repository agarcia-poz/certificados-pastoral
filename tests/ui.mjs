// Uso: cd tests && npm install && CHROMIUM=/ruta/a/chrome node ui.mjs   (capturas en tests/out/)
// Prueba de extremo a extremo: panel y páginas públicas reales en Chromium, contra el servidor real
// ejecutándose en Node sobre el Google simulado. Datos siempre ficticios.
import fs from 'fs'; import vm from 'vm'; import path from 'path';
import { chromium } from 'playwright-core';
import { crearGoogle } from './fakes.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(AQUI, '..'), NM = AQUI + '/node_modules/', OUT = AQUI + '/out/';
fs.mkdirSync(OUT, { recursive: true });
const PROP = 'andres@centro.test';
const { ctx, estado } = crearGoogle({ propietario: PROP });
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(REPO + '/dist/CertificadosPastoral.gs', 'utf8'), ctx);
const G = ctx, A = vm.runInContext('ARCHIVOS_HTML', ctx);
const codigoDe = (para) => estado.correos.filter(c => c.para === para && /código de acceso/i.test(c.asunto)).at(-1).html.match(/color:#1B2733;">(\d{6})</)[1];
let fallos = 0;
const comprobar = (c, m) => { if (!c) { fallos++; console.log('  ✗ ' + m); } };

// ── Datos de partida (ficticios)
G.api_configurarPedirCodigo();
const tA = G.api_configurar(codigoDe(PROP), 'Andrés García Pozas').token;
G.api_guardarMiembro(tA, { email: 'consuelo@centro.test', nombre: 'Consuelo Burgos Bolós', rol: 'firmante' });
G.api_guardarMiembro(tA, { email: 'maria@centro.test', nombre: 'María López', rol: 'coordinacion' });
G.api_guardarFirmantes(tA, [{ cargo: 'Servicio de Pastoral y Compromiso Solidario', nombre: 'Andrés García Pozas', email: PROP }, { cargo: 'Vº Bº Directora Adjunta', nombre: 'Consuelo Burgos Bolós', email: 'consuelo@centro.test' }]);
const a1 = G.api_guardarActividad(tA, { nombre: 'Jornadas de Justicia y Solidaridad: Género y coeducación', tipo: 'Jornada', fechas: 'los días 18 y 19 de marzo de 2027', ects: 1, abierta: true, evaluacion: true,
  contexto: 'Jornadas con la ONG Entreculturas sobre coeducación y perspectiva de género en Infantil y Primaria.' });
const a2 = G.api_guardarActividad(tA, { nombre: 'Retiro de Adviento', tipo: 'Retiro', fechas: 'los días 12 y 13 de diciembre de 2026', horas: 12, abierta: true, auto: { validar: true } });
const a3 = G.api_guardarActividad(tA, { nombre: 'Voluntariado en Cáritas Úbeda', tipo: 'Voluntariado', fechas: 'durante el primer cuatrimestre del curso 2026-27', horas: 20, auto: { validar: true, generar: true, firmar: true, alumnado: true } });
[['Lucía', 'Martínez de la Torre', '12345678Z', 'lucia@al.test', 5, 'Me llevo la calma y las ganas de cuidar a mis futuros alumnos.'],
 ['Pablo', 'Ruiz Gómez', '87654321X', 'pablo@al.test', 4, ''], ['Carmen', 'Ortega Ruiz', '11111111H', 'carmen@al.test', 5, 'Descubrir que educar también es acompañar.']].forEach((p, i) => {
  G.api_publicoInscribir({ nombre: p[0], apellidos: p[1], dni: p[2], email: p[3], consentimiento: true, consentimiento9: true, citable: true, comentario: p[5],
    actividades: [{ id: a1, rol: ['Participante', 'Organización', 'Participante'][i], valor: p[4] }] });
  const t = estado.correos.filter(c => c.para === p[3]).at(-1).html.match(/t=([0-9a-f]+)/)[1];
  G.doGet({ parameter: { p: 'confirmar', t } });
});
[[5, 5, 'Sí', 'Aprendí a mirar el aula con otros ojos.', 'Más tiempo para los talleres prácticos.'], [4, 5, 'Sí', 'La dinámica de los roles me removió.', 'Empezar un poco más tarde.'],
 [5, 4, 'Quizá', 'Que coeducar empieza en lo pequeño.', ''], [3, 3, 'Quizá', '', 'Materiales para llevar al aula de prácticas.'], [5, 5, 'Sí', 'Ganas de seguir formándome.', '']].forEach((v) => {
  G.api_publicoEvaluar(a1, { general: v[0], crecer: v[1], recomendar: v[2], llevo: v[3], mejora: v[4] }, { citable: true });
});
// Groq simulado (la clave es inventada)
estado.web['https://api.groq.com/openai/v1/models'] = { code: 200, text: '{"data":[]}' };
estado.web['https://api.groq.com/openai/v1/chat/completions'] = (op) => {
  const c = JSON.parse(op.payload);
  const pide = c.messages.at(-1).content;
  let t = 'En dicho marco se han trabajado, desde la pedagogía ignaciana, la reflexión crítica sobre las desigualdades de género y la coeducación.\nEstas Jornadas han ofrecido herramientas concretas a los futuros docentes, en colaboración con la **ONG Entreculturas**.';
  if (c.response_format) t = JSON.stringify({ titulo: 'Cuéntanos cómo lo has vivido', intro: 'Tu mirada nos ayuda a preparar mejor las próximas jornadas.', preguntas: [
    { id: 'general', tipo: 'escala', texto: 'Valoración general de las Jornadas', obligatoria: true, clave: 'general' },
    { id: 'talleres', tipo: 'escala', texto: '¿Te han resultado útiles los talleres para tus prácticas?' },
    { id: 'momento', tipo: 'multiple', texto: '¿Qué momentos destacarías?', opciones: ['Ponencia inicial', 'Talleres', 'Mesa de experiencias', 'Oración final'] },
    { id: 'llevo', tipo: 'largo', texto: '¿Qué te llevas para tu futura aula?', clave: 'comentario' },
    { id: 'mejora', tipo: 'largo', texto: '¿Qué cambiarías?', clave: 'mejora' }], cierre: '¡Gracias por tu tiempo!' });
  if (/Redacta un informe/.test(pide)) t = '## Síntesis\nLas Jornadas se valoran muy positivamente (4,4 sobre 5) y la mayoría las recomendaría.\n## Lo que más se ha valorado\n- Las dinámicas vivenciales y la mirada nueva sobre el aula.\n- La conexión con la práctica docente.\n## Aspectos a mejorar\n- Más tiempo para los talleres.\n- Materiales para llevar a las prácticas.\n## Propuestas concretas para la próxima edición\n- Ampliar los talleres a 90 minutos y ofrecer un dosier descargable.\n## Conexión con la vocación docente\nVarios comentarios hablan de «cuidar» y «acompañar»: la experiencia toca el corazón de la vocación.';
  return { code: 200, text: JSON.stringify({ choices: [{ message: { content: t } }] }) };
};
G.api_iaGuardar(tA, { clave: 'gsk_' + 'x'.repeat(40), modelo: 'llama-3.3-70b-versatile', comentarios: true });
G.api_iaInforme(tA, a1);
// Hoja externa ficticia (respuestas de un Google Forms)
const externa = ctx.SpreadsheetApp.create('Inscripciones Voluntariado (respuestas)');
const shE = externa.insertSheet('Respuestas de formulario 1');
const filasHoja = [['Marca temporal', 'Dirección de correo electrónico', 'Nombre', 'Apellidos', 'DNI', '¿Cómo participaste?'],
  ['20/10/2026 18:02', 'jorge@al.test', 'Jorge', 'Pérez López', '22222222J', 'Voluntario/a'], ['20/10/2026 18:30', 'eva@al.test', 'Eva', 'Ruiz Sanz', 'X1234567L', 'Coordinación del grupo'],
  ['21/10/2026 09:12', 'sin-dni@al.test', 'Raúl', 'Moreno', '1234', 'Voluntario/a']];
shE.getRange(1, 1, filasHoja.length, filasHoja[0].length).setValues(filasHoja);
const idHoja = '1Fx' + 'aB3'.repeat(10) + '_hoja'; estado.libros[idHoja] = externa;

// ── Páginas
const incluir = (html) => html.replace(/<\?!= incluir_\('(\w+)'\) \?>/g, (m, n) => A[n]);
function paginaPublica(param) {
  const r = G.doGet({ parameter: param });
  return incluir(A.Publico).replace('<?!= tipoJs ?>', r.vars.tipoJs).replace('<?!= datosJs ?>', r.vars.datosJs).replace('<?!= urlJs ?>', r.vars.urlJs);
}
fs.writeFileSync(OUT + 'panel.html', incluir(A.Panel));

const local = (url) => { const m = url.match(/https:\/\/cdn\.jsdelivr\.net\/npm\/(@?[^@]+(?:\/[^@]+)?)@[^/]+\/(.*)/); return m ? NM + m[1] + '/' + m[2] : null; };
const CSS_FUENTES = [['Outfit', 500, 'outfit/files/outfit-latin-500-normal.woff2'], ['Outfit', 600, 'outfit/files/outfit-latin-600-normal.woff2'], ['Outfit', 700, 'outfit/files/outfit-latin-700-normal.woff2'],
  ['Nunito Sans', 400, 'nunito-sans/files/nunito-sans-latin-400-normal.woff2'], ['Nunito Sans', 600, 'nunito-sans/files/nunito-sans-latin-600-normal.woff2'], ['Nunito Sans', 700, 'nunito-sans/files/nunito-sans-latin-700-normal.woff2']]
  .map((f) => "@font-face{font-family:'" + f[0] + "';font-weight:" + f[1] + ";src:url(https://fonts.gstatic.com/local/" + f[2] + ") format('woff2');}").join('\n');
const errores = [];
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function preparar(pg, nombre) {
  pg.on('pageerror', (e) => errores.push(nombre + ': ' + e));
  pg.on('console', (m) => { if (m.type() === 'error') errores.push(nombre + ': ' + m.text()); });
  pg.on('dialog', (d) => d.accept());
  await pg.route('https://cdn.jsdelivr.net/**', async (r) => { const f = local(r.request().url()); if (f && fs.existsSync(f)) await r.fulfill({ path: f, headers: { 'Access-Control-Allow-Origin': '*' } }); else { errores.push('404 ' + r.request().url()); await r.abort(); } });
  await pg.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: CSS_FUENTES, contentType: 'text/css' }));
  await pg.route('https://fonts.gstatic.com/local/**', (r) => r.fulfill({ path: NM + '@fontsource/' + r.request().url().split('/local/')[1], headers: { 'Access-Control-Allow-Origin': '*' } }));
  await pg.exposeFunction('__api', (fn, args) => {
    try { const v = G[fn].apply(null, args); return { ok: v === undefined ? null : JSON.parse(JSON.stringify(v)) }; }
    catch (e) { return { err: e.message }; }
  });
  await pg.addInitScript(() => {
    function cadena() {
      let ok = () => {}, ko = () => {};
      const o = new Proxy({}, { get(_, k) {
        if (k === 'withSuccessHandler') return (f) => { ok = f; return o; };
        if (k === 'withFailureHandler') return (f) => { ko = f; return o; };
        return (...a) => { window.__api(k, a).then((r) => (r.err !== undefined ? ko(new Error(r.err)) : ok(r.ok))); };
      } });
      return o;
    }
    window.google = { script: { get run() { return cadena(); } } };
  });
}
const pg = await b.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
await preparar(pg, 'panel');
const foto = (n, op) => pg.screenshot(Object.assign({ path: OUT + n + '.png' }, op || {}));
const ir = async (v, sel) => { await pg.click('a[data-v="' + v + '"]'); await pg.waitForSelector(sel); await pg.waitForTimeout(250); };
const confirmar = async () => { await pg.waitForSelector('.modal [data-si]'); await pg.click('.modal [data-si]'); };

// 1. Acceso
await pg.goto('file://' + OUT + 'panel.html');
await pg.waitForSelector('#pnEmail', { state: 'visible' }); await pg.waitForTimeout(300);
await foto('01-acceso');
await pg.fill('#pnEmail', PROP); await pg.click('#pnPedir');
await pg.waitForSelector('#pnCodigo', { state: 'visible' });
await pg.fill('#pnCodigo', codigoDe(PROP)); await pg.click('#pnEntrar');
await pg.waitForSelector('#vInicio .tiles'); await pg.waitForTimeout(400);
await foto('02-inicio');
// 2. Actividades
await ir('actividades', '#vActividades .act'); await foto('03-actividades');
await pg.click('.act[data-id="' + a3 + '"] [data-edit]'); await pg.waitForSelector('.modal'); await pg.waitForTimeout(200); await foto('04-actividad-automatizar');
await pg.click('.modal [data-cerrar]');
// 3. Inscripciones
await ir('inscripciones', '#vInscripciones table');
await pg.selectOption('#selAct', a1); await pg.waitForSelector('#vInscripciones table');
await pg.click('#vInscripciones button.ver'); await pg.waitForTimeout(200);
await pg.check('#selTodas'); await foto('05-inscripciones');
await pg.click('[data-lote="validada"]'); await pg.waitForTimeout(500);
// 4. Formularios
await ir('formularios', '#fVista .pv-cab');
await pg.selectOption('#fSelAct', a1); await pg.waitForSelector('#fVista .pv-cab'); await pg.waitForTimeout(300);
await pg.click('[data-anadir="unica"]'); await pg.fill('#fPreguntas .preg:last-child input[data-campo="texto"]', '¿Vienes desde Prácticas?');
await pg.fill('#fPreguntas .preg:last-child textarea[data-campo="opciones"]', 'Sí, desde el centro de prácticas\nNo'); await pg.waitForTimeout(300);
await foto('06-formulario-inscripcion'); await pg.click('#fGuardar'); await pg.waitForTimeout(300);
comprobar(G.api_formularios(tA, a1).inscripcion.preguntas.length === 1, 'formulario de inscripción guardado desde el panel');
await pg.click('#vFormularios [data-t="evaluacion"]'); await pg.waitForSelector('#fIa'); await pg.click('#fIa'); await pg.waitForTimeout(600);
await foto('07-formulario-evaluacion-ia'); await pg.click('#fGuardar'); await pg.waitForTimeout(300);
comprobar(G.api_formularios(tA, a1).evaluacion.preguntas.some((q) => q.id === 'momento'), 'propuesta de la IA guardada');
// 5. Importar de Drive
await ir('importar', '#hUrl');
await pg.fill('#hUrl', 'https://docs.google.com/spreadsheets/d/' + idHoja + '/edit#gid=0'); await pg.click('#hAbrir');
await pg.waitForSelector('#hAct'); await pg.selectOption('#hAct', a3); await pg.click('label:has(#hConsent)');
await foto('08-importar-mapa', { fullPage: true });
await pg.click('#hEnlazar'); await pg.waitForSelector('#hResultado .aviso, #hResultado .exito-msg'); await pg.waitForTimeout(200);
await foto('09-importar-resultado', { fullPage: true });
comprobar(G.leer_('Inscripciones').filter((i) => i.actividad === a3 && i.estado === 'validada').length === 2, 'hoja importada y validada sola');
// 6. Diseñar y generar (en el navegador)
await ir('inscripciones', '#vInscripciones'); await pg.selectOption('#selAct', a1); await pg.waitForSelector('#irGenerar:not([disabled])');
await pg.click('#irGenerar');
await pg.waitForFunction(() => document.getElementById('cargando').classList.contains('oculto'), null, { timeout: 30000 });
await pg.waitForTimeout(900); await foto('10-editor-generar');
await pg.click('#tabDiseno'); await pg.waitForTimeout(300);
await pg.click('#btnIaTexto'); await pg.waitForTimeout(800); await foto('11-editor-diseno-ia');
await pg.click('#tabGenerar'); await pg.click('#btnGenerar');
await pg.waitForFunction(() => document.getElementById('textoProgreso').textContent.startsWith('Terminado'), null, { timeout: 90000 });
await foto('12-generado');
// 7. Envíos: enviar a firmar
await ir('envios', '#vEnvios .etapas');
await pg.click('[data-etapa="generado"]'); await pg.waitForSelector('#eTodas'); await pg.check('#eTodas');
await foto('13-envios-generados');
await pg.click('#eAccion'); await pg.waitForSelector('#eMsg'); await pg.fill('#eMsg', 'Son los de las Jornadas de marzo. ¡Gracias!'); await pg.click('#eOk');
await pg.waitForSelector('.etapa.activo[data-etapa="firma"]'); await pg.waitForTimeout(200);
// 8. Firmar: dos vueltas (administración puede subir también la 2.ª firma)
for (let vuelta = 1; vuelta <= 2; vuelta++) {
  await ir('firmar', '#zona');
  if (vuelta === 1) await foto('14-firmar');
  const pend = G.api_certificados(tA, {}).filter((c) => c.estado === 'firma' && c.firmas === vuelta - 1);
  const ficheros = pend.map((c) => { const r = G.api_pdf(tA, c.codigo); const f = OUT + r.nombre.replace('.pdf', '_signed' + vuelta + '.pdf'); fs.writeFileSync(f, Buffer.concat([Buffer.from(r.base64, 'base64'), Buffer.from('\n/ByteRange [0 1 2 3]'.repeat(vuelta))])); return f; });
  if (vuelta === 1) { fs.copyFileSync(OUT + 'panel.html', OUT + 'documento-sin-codigo.pdf'); ficheros.push(OUT + 'documento-sin-codigo.pdf'); }
  await pg.setInputFiles('#archivos', ficheros);
  await pg.waitForFunction(() => /Hecho/.test((document.querySelector('#resultados h3') || {}).textContent || ''), null, { timeout: 30000 });
  if (vuelta === 1) await foto('15-firmados-subidos');
}
// 9. Envíos: enviar al alumnado
await ir('envios', '#vEnvios .etapas');
await pg.click('[data-etapa="firmado"]'); await pg.waitForSelector('#eTodas'); await pg.check('#eTodas');
await foto('16-envios-firmados');
await pg.click('#eAccion'); await confirmar();
await pg.waitForFunction(() => /enviado/.test((document.querySelector('.toast') || {}).textContent || ''), null, { timeout: 15000 });
await pg.click('[data-etapa="enviado"]'); await pg.waitForTimeout(300); await foto('17-envios-enviados');
comprobar(estado.correos.filter((c) => /está listo/.test(c.asunto)).length === 3, '3 correos de descarga enviados desde «Envíos»');
// 10. Valoraciones, ajustes, equipo
await ir('valoraciones', '#vValoraciones .tiles'); await pg.selectOption('#vSel', a1); await pg.waitForSelector('#vValoraciones .informe'); await pg.waitForTimeout(300);
await foto('18-valoraciones', { fullPage: true });
await ir('ajustes', '#listaF'); await foto('19-ajustes', { fullPage: true });
await ir('equipo', '#vEquipo table'); await foto('20-equipo');
// 11. El panel en el móvil
await pg.setViewportSize({ width: 390, height: 844 });
await ir('inicio', '#vInicio .tiles').catch(async () => { await pg.click('#pnMenuBtn'); await pg.click('a[data-v="inicio"]'); });
await pg.waitForTimeout(300); await foto('21-movil-inicio');
await pg.click('#pnMenuBtn'); await pg.waitForTimeout(350); await foto('22-movil-menu');

// ── Páginas públicas (móvil)
const pub = await b.newPage({ viewport: { width: 400, height: 860 }, acceptDownloads: true });
await preparar(pub, 'público');
const fotoP = (n) => pub.screenshot({ path: OUT + n + '.png', fullPage: true });
fs.writeFileSync(OUT + 'formulario.html', paginaPublica({ p: 'f', a: a1 }));
await pub.goto('file://' + OUT + 'formulario.html'); await pub.waitForSelector('#nombre'); await pub.waitForTimeout(300);
await pub.click('.roles label:nth-child(2) span');
await pub.fill('#nombre', 'Irene'); await pub.fill('#apellidos', 'Sánchez Mora'); await pub.fill('#dni', '33333333P'); await pub.fill('#email', 'irene@al.test');
await pub.click('#preguntas .fv-opc label:first-child span');
await pub.check('#c1'); await pub.check('#c2');
await fotoP('23-publico-inscripcion');
await pub.click('#enviar'); await pub.waitForSelector('.resultado-final'); await fotoP('24-publico-inscripcion-enviada');
fs.writeFileSync(OUT + 'evaluacion.html', paginaPublica({ p: 'e', a: a1 }));
await pub.goto('file://' + OUT + 'evaluacion.html'); await pub.waitForSelector('.fv-escala'); await pub.waitForTimeout(300);
await pub.click('#enviar'); await pub.waitForTimeout(200);
await pub.click('.fv-q[data-q="general"] .fv-escala label:nth-child(5) span'); await pub.click('.fv-q[data-q="talleres"] .fv-escala label:nth-child(4) span');
await pub.click('.fv-q[data-q="momento"] .fv-opc label:nth-child(2) span'); await pub.fill('textarea[name="fv_llevo"]', 'Ideas para mi aula de prácticas.');
await fotoP('25-publico-evaluacion');
await pub.click('#enviar'); await pub.waitForSelector('.resultado-final'); await fotoP('26-publico-evaluacion-enviada');
const correo = estado.correos.filter((c) => /está listo/.test(c.asunto)).at(-1);
const clave = correo.html.match(/letter-spacing:6px[^>]*>([A-Z0-9]{4}-[A-Z0-9]{4})</)[1];
const codigo = decodeURIComponent(correo.html.match(/p=descargar&c=([^"]+)"/)[1]);
fs.writeFileSync(OUT + 'correo-descarga.html', correo.html.replace('cid:logo', 'data:image/png;base64,' + vm.runInContext('LOGO_CORREO_B64', ctx)));
await pub.goto('file://' + OUT + 'correo-descarga.html'); await pub.waitForTimeout(300); await fotoP('27-correo-descarga');
fs.writeFileSync(OUT + 'descargar.html', paginaPublica({ p: 'descargar', c: codigo }));
await pub.goto('file://' + OUT + 'descargar.html'); await pub.waitForSelector('#clave');
await pub.fill('#clave', 'AAAA-AAAA'); await pub.click('#bajar'); await pub.waitForSelector('#error:not(.oculto)'); await fotoP('28-descarga-error');
await pub.fill('#clave', clave.replace('-', ''));
const [descarga] = await Promise.all([pub.waitForEvent('download', { timeout: 10000 }).catch(() => null), pub.click('#bajar')]);
await pub.waitForSelector('.resultado-final'); await fotoP('29-descarga-ok');
comprobar(descarga && /\.pdf$/.test(descarga.suggestedFilename()), 'el alumno/a descarga su PDF con el código');
fs.writeFileSync(OUT + 'verificar.html', paginaPublica({ c: codigo }));
await pub.goto('file://' + OUT + 'verificar.html'); await pub.waitForSelector('.estado'); await fotoP('30-verificar');
fs.writeFileSync(OUT + 'inscripcion.html', paginaPublica({ p: 'inscripcion' }));
await pub.goto('file://' + OUT + 'inscripcion.html'); await pub.waitForSelector('.act'); await pub.check('.act input[type=checkbox]'); await pub.waitForTimeout(200); await fotoP('31-inscripcion-general');

console.log('Estados:', G.leer_('Inscripciones').map((i) => i.estado).join(', '));
console.log('Errores:', errores.length ? errores : 'ninguno');
if (errores.length) fallos++;
console.log(fallos ? fallos + ' fallo(s)' : 'Todo bien');
await b.close();
process.exit(fallos ? 1 : 0);
