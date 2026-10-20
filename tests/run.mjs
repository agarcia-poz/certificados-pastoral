// Pruebas del flujo completo con Google simulado + el motor de PDF real.
//   cd tests && npm install && node run.mjs
import fs from 'fs';
import vm from 'vm';
import { createRequire } from 'module';
import { crearGoogle } from './fakes.mjs';

const require = createRequire(import.meta.url);
const PDFLib = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const qrgen = require('qrcode-generator');
const Motor = require('../src/motor.js');
const RAIZ = new URL('..', import.meta.url).pathname;

const { ctx, estado, gestion, archivoFalso } = crearGoogle();
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(RAIZ + 'dist/Codigo.gs', 'utf8') + '\n' + fs.readFileSync(RAIZ + 'dist/LogoCorreo.gs', 'utf8') + '\n;this.G = { actualizarApp, instalar, actualizarFormulario, alEnviarFormulario, onEdit, tareaPeriodica, doGet, dniValido_, iniciales_, cursoAcademico_, api_inicio, api_diseno, api_guardarDiseno, api_subirImagen, api_imagen, api_cola, api_reservar, api_guardarPdf, api_finTanda, P, A, EST };', ctx);
const G = ctx.G;

let fallos = 0, ok = 0;
const comprobar = (cond, msg) => { if (cond) ok++; else { fallos++; console.log('  ✗ ' + msg); } };
const lanza = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

// ── 0. Funciones puras
comprobar(G.dniValido_('12345678Z') && !G.dniValido_('12345678A') && G.dniValido_('X1234567L'), 'validación de DNI/NIE');
comprobar(G.cursoAcademico_(new Date('2026-10-20')) === '2026-27' && G.cursoAcademico_(new Date('2027-03-01')) === '2026-27', 'curso académico');
comprobar(G.iniciales_('María de la Paz Ruiz') === 'M. P. R.', 'iniciales');

// ── 1. Instalación
G.instalar();
const hoja = (n) => gestion.getSheetByName(n);
const boveda = estado.libros[estado.props.BOVEDA_ID].getSheetByName('Personas');
comprobar(!!boveda, 'bóveda en archivo aparte');
comprobar(hoja('Ajustes').getRange(2, 1, 5, 3).getValues().filter(f => f[2]).length === 2, 'hoja Ajustes con 2 firmantes');
comprobar(!!hoja('Diseños'), 'hoja Diseños');
const carpetas = JSON.parse(estado.props.CARPETAS);
comprobar(carpetas.bandeja.length === 2 && carpetas.entrega.length === 2 && carpetas.raiz, 'carpetas por firmante');
// El segundo firmante tiene email en Ajustes (lo rellena la coordinación)
hoja('Ajustes').getRange(2, 4).setValue('coordinacion@centro.test');
hoja('Ajustes').getRange(3, 4).setValue('firmante2@centro.test');

// ── 2. Actividades y formulario
const shA = hoja('Actividades');
shA.getRange(2, G.A.ABIERTA, 2, 1).setValues([[true], [true]]);
G.actualizarFormulario();
const grid = Object.values(estado.items).find(i => i.titulo.startsWith('¿En qué actividades'));
comprobar(grid.filas.length === 2, 'formulario con 2 actividades');

const idDe = (pre) => Object.values(estado.items).find(i => i.titulo.startsWith(pre)).getId();
let nResp = 0;
function responder({ nombre, apellidos, dni, email, roles, valores, comentario = '' }) {
  const resp = [[idDe('Nombre'), nombre], [idDe('Apellidos'), apellidos], [idDe('DNI'), dni],
    [idDe('¿En qué actividades'), roles], [idDe('Valora'), valores], [idDe('¿Qué te ha'), comentario], [idDe('Boletín'), []]];
  const id = 'resp' + (++nResp);
  G.alEnviarFormulario({ response: { getId: () => id, getTimestamp: () => new Date('2026-11-10T10:00:00'), getRespondentEmail: () => email,
    getItemResponses: () => resp.map(([iid, r]) => ({ getItem: () => ({ getId: () => iid }), getResponse: () => r })) } });
}
responder({ nombre: 'lucía', apellidos: 'martínez de la torre', dni: '12345678z', email: 'lucia@alumnos.test', roles: ['Participante', 'Organización'], valores: ['5', '4'], comentario: 'Me llevo la calma' });
responder({ nombre: 'Pablo', apellidos: 'Ruiz', dni: '87654321A', email: 'pablo@alumnos.test', roles: ['Participante', null], valores: ['3', null] });
responder({ nombre: 'Pablo', apellidos: 'Ruiz', dni: '87654321X', email: 'pablo@alumnos.test', roles: ['Participante', null], valores: [null, null] });
responder({ nombre: 'Lucía', apellidos: 'Martínez de la Torre', dni: '12345678Z', email: 'otra@mal.test', roles: ['Participante', null], valores: [null, null] });

const shP = hoja('Participaciones');
const filasP = () => shP.getRange(2, 1, shP.getLastRow() - 1, 16).getValues();
comprobar(filasP().length === 3, 'participaciones (DNI malo descartado, duplicado ignorado)');
comprobar(boveda.getLastRow() === 3 && String(boveda.getRange(2, 5).getValue()) === 'lucia@alumnos.test', 'bóveda: 2 personas, correo no sobrescrito');
comprobar(estado.respuestasBorradas.length === 4, 'respuestas borradas del formulario');
comprobar(hoja('Valoraciones').getLastRow() === 3, 'valoraciones anónimas');

// ── 3. Editor: permisos
estado.usuario = 'otra.persona@centro.test';
comprobar(/SIN_PERMISO/.test(lanza(() => G.api_cola('A-001')) || ''), 'el editor rechaza a quien no es propietario');
estado.usuario = 'coordinacion@centro.test';

const ini = G.api_inicio();
comprobar(ini.actividades.length === 2 && ini.firmantes.length === 2 && ini.firmantes[1].nombre === 'Consuelo Burgos Bolós', 'api_inicio');
comprobar(JSON.stringify(ini).indexOf('@') < 0, 'api_inicio no expone correos');

// ── 4. Diseño por actividad
G.api_guardarDiseno('A-001', { plantilla: 'marco', color: '#5b2c83', descripcion: 'Texto **IA**' }, true);
comprobar(G.api_diseno('A-001').plantilla === 'marco', 'diseño guardado y leído');
comprobar(G.api_diseno('A-002').plantilla === 'marco', 'diseño base para el resto');
comprobar(String(shA.getRange(2, G.A.DISENO).getValue()).includes('Personalizado'), 'estado de diseño en Actividades');
const idImg = G.api_subirImagen(Buffer.from('fake').toString('base64'), 'image/jpeg', 'Fondo prueba');
comprobar(G.api_imagen(idImg).base64 === Buffer.from('fake').toString('base64'), 'subir y leer imagen de diseño');
const ajeno = archivoFalso('secreto.pdf', 'x', carpetas.archivo, 'propietario');
comprobar(/no pertenece/.test(lanza(() => G.api_imagen(ajeno.getId())) || ''), 'api_imagen no sirve archivos fuera de la carpeta de diseño');
comprobar(/JPG o PNG/.test(lanza(() => G.api_subirImagen('eA==', 'application/pdf', 'x')) || ''), 'solo imágenes');

// ── 5. Validar y generar con el motor real
filasP().forEach((_, i) => shP.getRange(i + 2, G.P.CERT).setValue(true));
G.onEdit({ range: shP.getRange(2, G.P.CERT, 3, 1) });
comprobar(filasP().every(f => f[G.P.ESTADO - 1] === G.EST.EN_COLA), 'estado listo al marcar');
const cola1 = G.api_cola('A-001');
comprobar(cola1.length === 2 && cola1[0].dni === '12345678Z', 'cola con datos de la bóveda');

const fuentes = {}; for (const [k, e] of Object.entries(Motor.ESTILOS)) fuentes[k] = fs.readFileSync(require.resolve(`@expo-google-fonts/open-sans/${e}/OpenSans_${e}.ttf`));
const medir = await Motor.crearMedidor(PDFLib, fontkit, fuentes);
const qr = (t) => { const q = qrgen(0, 'M'); q.addData(t); q.make(); const n = q.getModuleCount(); return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c))); };
async function pdfPara(p, codigo) {
  const r = Motor.componer(G.api_diseno('A-001'), { nombre: p.nombre, apellidos: p.apellidos, dni: p.dni, actividad: 'Retiro', fechas: 'el 7 de noviembre', rol: p.rol, codigo, url: ini.url, firmantes: ini.firmantes }, medir, {}, qr);
  return Buffer.from(await Motor.aPdf(PDFLib, fontkit, r.ops, fuentes, {})).toString('base64');
}
const codigos = G.api_reservar(cola1.map(p => p.reg));
comprobar(Object.values(codigos).every(c => /^SAFA-PAS-2627-[A-Z2-9]{6}$/.test(c)), 'códigos reservados');
comprobar(JSON.stringify(G.api_reservar(cola1.map(p => p.reg))) === JSON.stringify(codigos), 'reservar de nuevo devuelve los mismos códigos (tanda interrumpida)');
comprobar(/no es un PDF/.test(lanza(() => G.api_guardarPdf(cola1[0].reg, codigos[cola1[0].reg], Buffer.from('hola').toString('base64'), null)) || ''), 'rechaza lo que no es PDF');
comprobar(/no es válido/.test(lanza(() => G.api_guardarPdf(cola1[0].reg, codigos[cola1[0].reg], 'JVBERi0=', { dni: '12345678A' })) || ''), 'rechaza DNI corregido no válido');
G.api_guardarPdf(cola1[0].reg, codigos[cola1[0].reg], await pdfPara(cola1[0], codigos[cola1[0].reg]), { apellidos: 'Martínez de la Torre López', rol: 'Coordinación' });
G.api_guardarPdf(cola1[1].reg, codigos[cola1[1].reg], await pdfPara(cola1[1], codigos[cola1[1].reg]), null);
comprobar(String(boveda.getRange(2, 4).getValue()) === 'Martínez de la Torre López', 'corrección guardada en la bóveda');
comprobar(filasP()[0][G.P.NOMBRE - 1] === 'Lucía Martínez de la Torre López' && filasP()[0][G.P.ROL - 1] === 'Coordinación', 'corrección reflejada en Participaciones');
comprobar(/ya no está pendiente/.test(lanza(() => G.api_guardarPdf(cola1[0].reg, codigos[cola1[0].reg], 'JVBERi0=', null)) || ''), 'no se guarda dos veces');
G.api_finTanda(2);
comprobar(estado.correos.some(c => c.para === 'coordinacion@centro.test' && c.asunto.startsWith('Certificados pendientes')), 'aviso al firmante 1');
const cola2 = G.api_cola('A-002');
const c2 = G.api_reservar(cola2.map(p => p.reg));
G.api_guardarPdf(cola2[0].reg, c2[cola2[0].reg], await pdfPara(cola2[0], c2[cola2[0].reg]), null);
comprobar(G.api_cola('A-001').length === 0 && G.api_cola('A-002').length === 0, 'colas vacías tras generar');

// ── 6. Firmas
const enCarpeta = (id) => Object.values(estado.archivos).filter(f => f.carpeta === id && !f.papelera);
const firmar = (f, n) => Buffer.concat([f.bytes, Buffer.from('\n/ByteRange [0 1 2 3]'.repeat(n))]);
const b1 = enCarpeta(carpetas.bandeja[0]);
comprobar(b1.length === 3 && b1.every(f => /^SAFA-PAS-2627-[A-Z2-9]{6} · /.test(f.nombre)), 'PDF en «Para firmar» nombrados por código');
b1.forEach(f => archivoFalso(f.nombre.replace('.pdf', '_signed.pdf'), firmar(f, 1), carpetas.entrega[0], 'propietario'));
archivoFalso('documento cualquiera.pdf', Buffer.from('x'), carpetas.entrega[0], 'propietario');
G.tareaPeriodica();
comprobar(filasP().every(f => f[G.P.FIRMAS - 1] === 1 && String(f[G.P.ESTADO - 1]).includes('Firma 2 de 2')), 'pasan al firmante 2');
comprobar(estado.correos.some(c => c.para === 'firmante2@centro.test'), 'aviso al firmante 2');
const b2 = enCarpeta(carpetas.bandeja[1]);
archivoFalso(b2[0].nombre, b2[0].bytes, carpetas.entrega[1], 'consuelo');
b2.slice(1).forEach(f => archivoFalso(f.nombre.replace('.pdf', '_signed.pdf'), firmar(f, 1), carpetas.entrega[1], 'consuelo'));
const antes = estado.correos.length;
G.tareaPeriodica();
const enviados = estado.correos.slice(antes).filter(c => c.asunto.startsWith('Tu certificado'));
comprobar(enviados.length === 2 && enviados.every(c => c.adjuntos.length === 1), 'enviados 2 certificados con PDF');
comprobar(filasP().some(f => String(f[G.P.ESTADO - 1]).includes('no contiene la firma')), 'el PDF sin segunda firma queda en Revisar');
G.tareaPeriodica();
comprobar(estado.correos.filter(c => c.asunto.startsWith('Tu certificado')).length === 2, 'nada se envía dos veces');

// ── 7. Verificación pública
const env = filasP().find(f => f[G.P.ESTADO - 1] === G.EST.ENVIADO);
const pag = G.doGet({ parameter: { c: env[G.P.CODIGO - 1] } }).html;
comprobar(pag.includes('Certificado auténtico') && !/12345678|87654321|@alumnos|Martínez/.test(pag), 'verificación sin datos personales');

// ── 8. Reglas de privacidad
const textoGestion = JSON.stringify(Object.values(gestion.hojas).map(s => s.datos));
comprobar(!/12345678Z|87654321X/.test(textoGestion), 'ningún DNI en la hoja de gestión');
comprobar(!/@alumnos\.test|@mal\.test/.test(textoGestion), 'ningún correo del alumnado en la hoja de gestión');
comprobar(Object.values(estado.archivos).every(f => !/\d{8}[A-Z]/.test(f.nombre)), 'ningún DNI en nombres de archivo');
comprobar(estado.correos.every(c => !/\d{8}[A-Z]|Lucía|Pablo/.test(c.asunto)), 'asuntos sin datos personales');

// ── 9. Actualización desde GitHub
const commit = 'a'.repeat(40), base = 'https://raw.githubusercontent.com/agarcia-poz/certificados-pastoral/' + commit + '/dist/';
const publicar = (cambiar) => {
  const man = JSON.parse(fs.readFileSync(RAIZ + 'dist/version.json', 'utf8'));
  man.version = '9.9.9';
  estado.web['https://github.com/agarcia-poz/certificados-pastoral.git/info/refs?service=git-upload-pack'] = { code: 200, text: '001e# service=git-upload-pack\n0000015a' + commit + ' HEAD\u0000multi_ack\n003f' + commit + ' refs/heads/main\n0000' };
  estado.web[base + 'version.json'] = { code: 200, text: JSON.stringify(man) };
  man.archivos.forEach(a => { estado.web[base + a.archivo] = { code: 200, text: fs.readFileSync(RAIZ + 'dist/' + a.archivo, 'utf8') + (cambiar === a.archivo ? '// manipulado' : '') }; });
};
publicar('Editor.html');
estado.peticiones.length = 0;
G.actualizarApp();
comprobar(!estado.peticiones.some(p => p.op.method === 'put') && /no coincide con su huella/.test(estado.alertas.at(-1)), 'actualización: rechaza un archivo manipulado');
publicar(null);
G.actualizarApp();
const put = estado.peticiones.find(p => p.op.method === 'put');
const enviadosPut = put ? JSON.parse(put.op.payload).files : [];
comprobar(put && put.url.includes('/projects/SCRIPT123/content') && enviadosPut.length === 7 - 1 && enviadosPut.some(f => f.name === 'appsscript' && f.type === 'JSON'), 'actualización: sustituye los 6 archivos del proyecto');
comprobar(/Actualizada a la versión 9.9.9/.test(estado.alertas.at(-1)), 'actualización: confirma la versión');
estado.web['https://script.googleapis.com/v1/projects/SCRIPT123/content'] = { code: 403, text: 'Apps Script API has not been used in project' };
G.actualizarApp();
comprobar(/usersettings/.test(estado.alertas.at(-1)), 'actualización: explica cómo activar la API');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
