// Uso: cd tests && npm install && CHROMIUM=/ruta/a/chrome node ui.mjs   (capturas en tests/out/)
// Prueba de extremo a extremo: panel y páginas públicas reales en Chromium, contra el servidor real
// ejecutándose en Node sobre el Google simulado.
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
const codigoDe = (para) => estado.correos.filter(c => c.para === para && /código de acceso/i.test(c.asunto)).at(-1).html.match(/color:#1f2a33;">(\d{6})</)[1];

// Datos de partida (ficticios)
G.api_configurarPedirCodigo();
const tA = G.api_configurar(codigoDe(PROP), 'Andrés García Pozas').token;
G.api_guardarMiembro(tA, { email: 'consuelo@centro.test', nombre: 'Consuelo Burgos Bolós', rol: 'firmante' });
G.api_guardarMiembro(tA, { email: 'maria@centro.test', nombre: 'María López', rol: 'coordinacion' });
G.api_guardarFirmantes(tA, [{ cargo: 'Servicio de Pastoral y Compromiso Solidario', nombre: 'Andrés García Pozas', email: PROP }, { cargo: 'Vº Bº Directora Adjunta', nombre: 'Consuelo Burgos Bolós', email: 'consuelo@centro.test' }]);
const a1 = G.api_guardarActividad(tA, { nombre: 'Jornadas de Justicia y Solidaridad: Género y coeducación', tipo: 'Jornada', fechas: 'los días 18 y 19 de marzo de 2027', ects: 1, abierta: true });
G.api_guardarActividad(tA, { nombre: 'Retiro de Adviento', tipo: 'Retiro', fechas: 'los días 12 y 13 de diciembre de 2026', horas: 12, abierta: true });
G.api_guardarActividad(tA, { nombre: 'Voluntariado en Cáritas Úbeda', tipo: 'Voluntariado', fechas: 'durante el primer cuatrimestre del curso 2026-27', horas: 20, abierta: false });
[['Lucía', 'Martínez de la Torre', '12345678Z', 'lucia@al.test', 5, 'Me llevo la calma y las ganas de cuidar a mis futuros alumnos.'],
 ['Pablo', 'Ruiz Gómez', '87654321X', 'pablo@al.test', 4, ''], ['Carmen', 'Ortega Ruiz', '11111111H', 'carmen@al.test', 5, 'Descubrir que educar también es acompañar.']].forEach((p, i) => {
  G.api_publicoInscribir({ nombre: p[0], apellidos: p[1], dni: p[2], email: p[3], consentimiento: true, consentimiento9: true, citable: true, comentario: p[5],
    actividades: [{ id: a1, rol: ['Participante', 'Organización', 'Participante'][i], valor: p[4] }] });
  const t = estado.correos.filter(c => c.para === p[3]).at(-1).html.match(/t=([0-9a-f]+)/)[1];
  G.doGet({ parameter: { p: 'confirmar', t } });
});

function paginaPanel() {
  return A.Panel.replace(/<\?!= incluir_\('(\w+)'\) \?>/g, (m, n) => A[n]);
}
function paginaPublica(param) {
  const r = G.doGet({ parameter: param });
  return A.Publico.replace(/<\?!= incluir_\('(\w+)'\) \?>/g, (m, n) => A[n])
    .replace('<?!= tipoJs ?>', r.vars.tipoJs).replace('<?!= datosJs ?>', r.vars.datosJs).replace('<?!= urlJs ?>', r.vars.urlJs);
}
fs.writeFileSync(OUT + 'panel.html', paginaPanel());

const local = (url) => { const m = url.match(/https:\/\/cdn\.jsdelivr\.net\/npm\/(@?[^@]+(?:\/[^@]+)?)@[^/]+\/(.*)/); return m ? NM + m[1] + '/' + m[2] : null; };
const errores = [];
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pg = await b.newPage({ viewport: { width: 1360, height: 860 }, acceptDownloads: true });
pg.on('pageerror', (e) => errores.push(String(e)));
pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
await pg.route('https://cdn.jsdelivr.net/**', async (r) => { const f = local(r.request().url()); if (f && fs.existsSync(f)) await r.fulfill({ path: f, headers: { 'Access-Control-Allow-Origin': '*' } }); else { errores.push('404 ' + r.request().url()); await r.abort(); } });
await pg.exposeFunction('__api', (fn, args) => {
  try { const v = G[fn].apply(null, args); return { ok: v === undefined ? null : JSON.parse(JSON.stringify(v)) }; }
  catch (e) { return { err: e.message }; }
});
// google.script.run mínimo: run.withSuccessHandler(..).withFailureHandler(..).fn(...)
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
const foto = (n) => pg.screenshot({ path: OUT + n + '.png' });

// 1. Acceso
await pg.goto('file://' + OUT + 'panel.html');
await pg.waitForSelector('#pnEmail', { state: 'visible' });
await foto('01-acceso');
await pg.fill('#pnEmail', PROP); await pg.click('#pnPedir');
await pg.waitForSelector('#pnCodigo', { state: 'visible' });
await pg.fill('#pnCodigo', codigoDe(PROP)); await pg.click('#pnEntrar');
await pg.waitForSelector('#vInicio .tarjetas'); await pg.waitForTimeout(300);
await foto('02-inicio');
// 2. Actividades
await pg.click('a[data-v="actividades"]'); await pg.waitForSelector('#vActividades table'); await foto('03-actividades');
await pg.click('#nuevaAct'); await pg.waitForSelector('.modal'); await foto('04-nueva-actividad'); await pg.click('.modal [data-cerrar]');
// 3. Inscripciones: validar todo
await pg.click('a[data-v="inscripciones"]'); await pg.waitForSelector('#vInscripciones table');
await pg.click('#vInscripciones a.ver'); await pg.waitForTimeout(200);
await pg.check('#selTodas'); await foto('05-inscripciones');
await pg.click('[data-lote="validada"]'); await pg.waitForTimeout(500);
// 4. Diseñar y generar
await pg.click('#irGenerar');
await pg.waitForFunction(() => document.getElementById('cargando').classList.contains('oculto'), null, { timeout: 30000 });
await pg.waitForTimeout(800); await foto('06-editor-generar');
await pg.click('#tabDiseno'); await pg.waitForTimeout(400); await foto('07-editor-diseno');
await pg.click('#tabGenerar');
pg.on('dialog', (d) => d.accept());
await pg.click('#btnGenerar');
await pg.waitForFunction(() => document.getElementById('textoProgreso').textContent.startsWith('Terminado'), null, { timeout: 60000 });
await foto('08-generado');
// 5. Firmar (firma 1): descargar y subir firmados
await pg.click('a[data-v="firmar"]'); await pg.waitForSelector('#zona'); await foto('09-firmar');
const pend = G.api_certificados(tA, { misFirmas: true });
const ficheros = pend.map((c) => { const r = G.api_pdf(tA, c.codigo); const f = OUT + r.nombre.replace('.pdf', '_signed.pdf'); fs.writeFileSync(f, Buffer.concat([Buffer.from(r.base64, 'base64'), Buffer.from('\n/ByteRange [0 1 2 3]')])); return f; });
fs.copyFileSync(OUT + 'panel.html', OUT + 'documento-sin-codigo.pdf'); ficheros.push(OUT + 'documento-sin-codigo.pdf');
console.log('ficheros', ficheros.length, 'pendientes', pend.length);
await pg.setInputFiles('#archivos', ficheros);
console.log('en el input:', await pg.evaluate(() => document.getElementById('archivos') ? document.getElementById('archivos').files.length : 'sin input'));
await pg.waitForFunction(() => /Hecho/.test((document.querySelector('#resultados h3') || {}).textContent || ''), null, { timeout: 30000 });
await foto('10-firmados-subidos');
console.log('resultados:', await pg.evaluate(() => [...document.querySelectorAll('.resultado')].map(x => x.className + ' ' + x.textContent)));
// 6. Certificados, valoraciones, equipo, ajustes
await pg.click('a[data-v="certificados"]'); await pg.waitForSelector('#vCertificados table'); await foto('11-certificados');
await pg.click('a[data-v="valoraciones"]'); await pg.waitForSelector('#vValoraciones .caja'); await foto('12-valoraciones');
await pg.click('a[data-v="equipo"]'); await pg.waitForSelector('#vEquipo table'); await foto('13-equipo');
await pg.click('a[data-v="ajustes"]'); await pg.waitForSelector('#listaF'); await foto('14-ajustes');
// 7. Páginas públicas
fs.writeFileSync(OUT + 'inscripcion.html', paginaPublica({ p: 'inscripcion' }));
const pub = await b.newPage({ viewport: { width: 420, height: 900 } });
pub.on('pageerror', (e) => errores.push('público: ' + e));
await pub.exposeFunction('__api', (fn, args) => { try { return { ok: JSON.parse(JSON.stringify(G[fn].apply(null, args) ?? null)) }; } catch (e) { return { err: e.message }; } });
await pub.addInitScript(() => { function c() { let ok = () => {}, ko = () => {}; const o = new Proxy({}, { get(_, k) { if (k === 'withSuccessHandler') return (f) => { ok = f; return o; }; if (k === 'withFailureHandler') return (f) => { ko = f; return o; }; return (...a) => { window.__api(k, a).then((r) => (r.err !== undefined ? ko(new Error(r.err)) : ok(r.ok))); }; } }); return o; } window.google = { script: { get run() { return c(); } } }; });
await pub.goto('file://' + OUT + 'inscripcion.html');
await pub.waitForSelector('.act');
await pub.click('.act .top'); await pub.click('.act .seg button:nth-child(2)'); await pub.click('.act .estrellas button:nth-child(4)');
await pub.fill('#nombre', 'Irene'); await pub.fill('#apellidos', 'Sánchez Mora'); await pub.fill('#dni', '22222222J'); await pub.fill('#email', 'irene@al.test');
await pub.check('#c1'); await pub.check('#c2');
await pub.screenshot({ path: OUT + '15-inscripcion.png', fullPage: true });
await pub.click('#enviar'); await pub.waitForSelector('.ok'); await pub.screenshot({ path: OUT + '16-inscripcion-enviada.png' });
const env = G.leer_('Inscripciones').find((i) => i.estado === 'enviado');
fs.writeFileSync(OUT + 'verificar.html', paginaPublica({ c: G.leer_('Inscripciones').find((i) => i.codigo)?.codigo || '' }));
await pub.goto('file://' + OUT + 'verificar.html'); await pub.waitForSelector('.tarjeta'); await pub.screenshot({ path: OUT + '17-verificar.png', fullPage: true });

console.log('Estados:', G.leer_('Inscripciones').map((i) => i.estado).join(', '));
console.log('Errores:', errores.length ? errores : 'ninguno');
await b.close();
