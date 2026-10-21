// Pruebas de la aplicación web con Google simulado + el motor de PDF real.
//   cd tests && npm install && npm test
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

const PROP = 'coordinacion@centro.test';
const { ctx, estado, gestion } = crearGoogle({ propietario: PROP });
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(RAIZ + 'dist/CertificadosPastoral.gs', 'utf8') + '\n;this.G = this;', ctx);
const G = ctx;

let fallos = 0, ok = 0;
const comprobar = (cond, msg) => { if (cond) ok++; else { fallos++; console.log('  ✗ ' + msg); } };
const lanza = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const ultimoCodigo = (para) => { const c = estado.correos.filter(x => x.para === para && /código de acceso/i.test(x.asunto)).at(-1); return c && c.html.match(/font-weight:bold; color:#1f2a33;">(\d{6})</)[1]; };
const entrar = (email) => { estado.cache = Object.fromEntries(Object.entries(estado.cache).filter(([k]) => !k.startsWith('cod_'))); G.api_pedirCodigo(email); return G.api_entrar(email, ultimoCodigo(email)).token; };

// ── 0. Funciones puras
comprobar(G.dniValido_('12345678Z') && !G.dniValido_('12345678A') && G.dniValido_('X1234567L'), 'DNI/NIE');
comprobar(G.cursoAcademico_(new Date('2026-10-20')) === '2026-27', 'curso académico');
comprobar(G.jsSeguro_({ a: '</script><b>' }).indexOf('</') < 0, 'valores seguros dentro de <script>');

// ── 1. Configuración inicial
comprobar(G.api_estado().instalado === false, 'sin instalar al principio');
comprobar(/Panel|vistaEditor|pnAcceso/.test(G.doGet({ parameter: {} }).html), 'el panel se sirve');
G.api_configurarPedirCodigo();
const codigoConfig = ultimoCodigo(PROP);
comprobar(/\d{6}/.test(codigoConfig), 'código de configuración enviado a la propietaria');
comprobar(/incorrecto/.test(lanza(() => G.api_configurar('000000', 'Andrés')) || ''), 'código incorrecto rechazado');
const sAdmin = G.api_configurar(codigoConfig, 'Andrés García Pozas');
const tA = sAdmin.token;
comprobar(G.api_estado().instalado && sAdmin.usuario.rol === 'admin', 'configurada y propietaria como administradora');
comprobar(/ya está configurada/.test(lanza(() => G.api_configurarPedirCodigo()) || ''), 'no se puede reconfigurar');

// ── 2. Acceso y equipo
const antesCorreos = estado.correos.length;
G.api_pedirCodigo('intruso@fuera.test');
comprobar(estado.correos.length === antesCorreos, 'a un correo ajeno no se le envía código (y no se revela)');
comprobar(/SESION/.test(lanza(() => G.api_resumen('token-falso')) || ''), 'token falso rechazado');
G.api_guardarMiembro(tA, { email: 'coordi@centro.test', nombre: 'María Coordinadora', rol: 'coordinacion' });
G.api_guardarMiembro(tA, { email: 'firma2@centro.test', nombre: 'Consuelo Burgos Bolós', rol: 'firmante' });
comprobar(estado.correos.some(c => c.para === 'coordi@centro.test' && /acceso/i.test(c.asunto)), 'correo de bienvenida');
comprobar(/propietaria/.test(lanza(() => G.api_guardarMiembro(tA, { email: PROP, nombre: 'x', rol: 'firmante' })) || ''), 'la propietaria no pierde la administración');
G.api_guardarFirmantes(tA, [{ cargo: 'Servicio de Pastoral y Compromiso Solidario', nombre: 'Andrés García Pozas', email: PROP },
  { cargo: 'Vº Bº Directora Adjunta', nombre: 'Consuelo Burgos Bolós', email: 'firma2@centro.test' }]);
comprobar(/no está en el equipo/.test(lanza(() => G.api_guardarFirmantes(tA, [{ cargo: 'a', nombre: 'b', email: 'nadie@x.test' }])) || ''), 'firmante debe ser del equipo');
const tC = entrar('coordi@centro.test');
const tF = entrar('firma2@centro.test');
comprobar(/SIN_PERMISO/.test(lanza(() => G.api_inscripciones(tF, 'A-001')) || ''), 'la firmante no ve inscripciones');
comprobar(/SIN_PERMISO/.test(lanza(() => G.api_equipo(tC)) || ''), 'coordinación no gestiona el equipo');

// ── 3. Actividades
const a1 = G.api_guardarActividad(tC, { nombre: 'Jornadas de Justicia y Solidaridad', tipo: 'Jornada', fechas: 'los días 18 y 19 de marzo de 2027', ects: 1, abierta: true });
const a2 = G.api_guardarActividad(tC, { nombre: 'Retiro de Adviento', tipo: 'Retiro', fechas: 'los días 12 y 13 de diciembre de 2026', horas: 12, abierta: true });
comprobar(a1 === 'A-001' && a2 === 'A-002', 'IDs de actividad');
comprobar(G.api_publicoActividades().actividades.length === 2, 'actividades abiertas en la página pública');

// ── 4. Inscripción pública con confirmación por correo
const inscribir = (o) => G.api_publicoInscribir(Object.assign({ consentimiento: true, consentimiento9: true }, o));
comprobar(/DNI/.test(lanza(() => inscribir({ nombre: 'Pablo', apellidos: 'Ruiz', dni: '87654321A', email: 'pablo@alumnos.test', actividades: [{ id: a1, rol: 'Participante' }] })) || ''), 'DNI con letra mala rechazado');
comprobar(/consentimientos/.test(lanza(() => G.api_publicoInscribir({ nombre: 'P', apellidos: 'R', dni: '87654321X', email: 'p@a.test', actividades: [{ id: a1, rol: 'Participante' }] })) || ''), 'sin consentimientos no se acepta');
comprobar(lanza(() => inscribir({ web: 'spam', nombre: 'P', apellidos: 'R', dni: '87654321X', email: 'p@a.test', actividades: [{ id: a1, rol: 'Participante' }] })) !== null, 'campo trampa para robots');
inscribir({ nombre: 'lucía', apellidos: 'martínez de la torre', dni: '12345678z', email: 'Lucia@Alumnos.test',
  actividades: [{ id: a1, rol: 'Participante', valor: 5 }, { id: a2, rol: 'Organización', valor: 4 }], comentario: 'Me llevo la calma', citable: true });
inscribir({ nombre: 'Pablo', apellidos: 'Ruiz', dni: '87654321X', email: 'pablo@alumnos.test', actividades: [{ id: a1, rol: 'Participante' }] });
comprobar(G.leer_('Inscripciones').length === 0, 'nada se registra hasta confirmar');
const enlace = (para) => estado.correos.filter(c => c.para === para && /Confirma/.test(c.asunto)).at(-1).html.match(/p=confirmar&t=([0-9a-f]+)/)[1];
const tokLucia = enlace('lucia@alumnos.test');
const conf = G.doGet({ parameter: { p: 'confirmar', t: tokLucia } }).vars;
comprobar(JSON.parse(conf.datosJs).ok === true && JSON.parse(conf.tipoJs) === 'confirmar', 'confirmación por enlace');
comprobar(JSON.parse(G.doGet({ parameter: { p: 'confirmar', t: tokLucia } }).vars.datosJs).ok === false, 'el enlace es de un solo uso');
G.doGet({ parameter: { p: 'confirmar', t: enlace('pablo@alumnos.test') } });
comprobar(G.leer_('Inscripciones').length === 3 && G.leer_('Valoraciones').length === 2, '3 inscripciones y 2 valoraciones anónimas');
comprobar(G.leer_('Inscripciones')[0].nombre === 'Lucía Martínez de la Torre', 'nombre capitalizado');
inscribir({ nombre: 'Lucía', apellidos: 'Martínez de la Torre', dni: '12345678Z', email: 'otra@mal.test', actividades: [{ id: a1, rol: 'Participante' }] });
G.doGet({ parameter: { p: 'confirmar', t: enlace('otra@mal.test') } });
comprobar(G.leer_('Inscripciones').length === 3, 'no se duplica la inscripción de la misma persona');
comprobar(G.leerBoveda_('Personas')[0].email === 'lucia@alumnos.test' && /correo distinto/.test(G.leerBoveda_('Personas')[0].avisos), 'no se sobrescribe el correo y queda aviso');
for (let k = 0; k < 3; k++) inscribir({ nombre: 'Pablo', apellidos: 'Ruiz', dni: '87654321X', email: 'pablo@alumnos.test', actividades: [{ id: a1, rol: 'Participante' }] });
comprobar(/varias solicitudes/.test(lanza(() => inscribir({ nombre: 'Pablo', apellidos: 'Ruiz', dni: '87654321X', email: 'pablo@alumnos.test', actividades: [{ id: a1, rol: 'Participante' }] })) || ''), 'límite de solicitudes por correo y día');

// ── 5. Validar
const ins1 = G.api_inscripciones(tC, a1);
comprobar(ins1.length === 2 && ins1[0].dniOculto === '•••••678Z' && ins1[0].emailOculto.indexOf('lucia@') < 0, 'DNI y correo enmascarados');
comprobar(G.api_revelarDni(tC, ins1[0].reg) === '12345678Z' && G.leer_('Registro').some(r => r.accion === 'DNI consultado'), 'ver el DNI queda registrado');
comprobar(G.api_cambiarInscripciones(tC, ins1.map(i => i.reg), { estado: 'validada' }) === 2, 'validar en lote');
G.api_cambiarInscripciones(tC, [ins1[0].reg], { rol: 'Coordinación' });
G.api_cambiarInscripciones(tC, G.api_inscripciones(tC, a2).map(i => i.reg), { estado: 'validada' });

// ── 6. Diseño y generación con el motor real
G.api_guardarDiseno(tC, a1, { plantilla: 'cabecera', descripcion: 'Texto de la **IA**' }, true);
comprobar(G.api_diseno(tC, a1).descripcion === 'Texto de la **IA**' && G.api_diseno(tC, a2).plantilla === 'cabecera', 'diseño propio y base');
const ini = G.api_inicioEditor(tC);
comprobar(ini.firmantes.length === 2 && ini.firmantes[1].nombre === 'Consuelo Burgos Bolós', 'firmantes en el editor');
const fuentes = {}; for (const [k, e] of Object.entries(Motor.ESTILOS)) fuentes[k] = fs.readFileSync(require.resolve(`@expo-google-fonts/open-sans/${e}/OpenSans_${e}.ttf`));
const medir = await Motor.crearMedidor(PDFLib, fontkit, fuentes);
const qr = (t) => { const q = qrgen(0, 'M'); q.addData(t); q.make(); const n = q.getModuleCount(); return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c))); };
const pdfPara = async (p, codigo, act) => Buffer.from(await Motor.aPdf(PDFLib, fontkit, Motor.componer(G.api_diseno(tC, act), { nombre: p.nombre, apellidos: p.apellidos, dni: p.dni, actividad: 'X', fechas: 'f', rol: p.rol, codigo, url: ini.url, firmantes: ini.firmantes }, medir, {}, qr).ops, fuentes, {})).toString('base64');
for (const act of [a1, a2]) {
  const cola = G.api_cola(tC, act);
  const cod = G.api_reservar(tC, cola.map(p => p.reg));
  comprobar(JSON.stringify(G.api_reservar(tC, cola.map(p => p.reg))) === JSON.stringify(cod), 'reservar dos veces da los mismos códigos (' + act + ')');
  for (const p of cola) {
    const cambios = p.nombre === 'Pablo' ? { apellidos: 'Ruiz Gómez' } : null;
    G.api_guardarPdf(tC, p.reg, cod[p.reg], await pdfPara(p, cod[p.reg], act), cambios);
  }
}
comprobar(G.leerBoveda_('Personas')[1].apellidos === 'Ruiz Gómez' && G.leer_('Inscripciones').some(i => i.nombre === 'Pablo Ruiz Gómez'), 'corrección guardada en bóveda e inscripciones');
G.api_finTanda(tC, 3);
comprobar(estado.correos.some(c => c.para === PROP && /pendientes de tu firma/.test(c.asunto)), 'aviso al primer firmante');

// ── 7. Firmas por subida
const firmar = (b64, n) => Buffer.concat([Buffer.from(b64, 'base64'), Buffer.from('\n/ByteRange [0 1 2 3]'.repeat(n))]).toString('base64');
const misA = G.api_certificados(tA, { misFirmas: true });
comprobar(misA.length === 3, 'la primera firmante ve 3 pendientes');
comprobar(G.api_certificados(tF, {}).length === 0, 'la segunda aún no ve ninguno');
comprobar(/SIN_PERMISO/.test(lanza(() => G.api_pdf(tF, misA[0].codigo)) || ''), 'la segunda no puede descargar lo que no le toca');
const sinFirma = G.api_subirFirmado(tA, misA[0].codigo + ' · X.pdf', G.api_pdf(tA, misA[0].codigo).base64);
comprobar(sinFirma.ok === false && /no contiene la firma/.test(sinFirma.motivo), 'un PDF sin firmar no avanza');
comprobar(G.api_subirFirmado(tA, 'otro.pdf', 'JVBERi0=').ok === false, 'un archivo sin código no avanza');
misA.forEach(c => { const r = G.api_subirFirmado(tA, c.codigo + ' · X_signed.pdf', firmar(G.api_pdf(tA, c.codigo).base64, 1)); comprobar(r.ok && r.siguiente === 'Consuelo Burgos Bolós', 'firma 1 → pasa a Consuelo (' + c.codigo + ')'); });
G.api_finSubida(tA);
comprobar(estado.correos.some(c => c.para === 'firma2@centro.test' && /pendientes de tu firma/.test(c.asunto)), 'aviso a la segunda firmante');
const misF = G.api_certificados(tF, {});
comprobar(misF.length === 3, 'la segunda firmante ve 3');
comprobar(G.api_enviarmeZip(tF) === 3 && estado.correos.some(c => c.para === 'firma2@centro.test' && c.adjuntos.length === 1 && /ZIP/.test(c.asunto)), 'ZIP por correo');
comprobar(G.api_subirFirmado(tF, misF[0].codigo + '.pdf', firmar(G.api_pdf(tF, misF[0].codigo).base64, 0)).ok === false, 'sin la 2.ª firma no avanza');
const antesEnv = estado.correos.length;
misF.forEach(c => { const r = G.api_subirFirmado(tF, c.codigo + '_signed.pdf', firmar(G.api_pdf(tF, c.codigo).base64, 1)); comprobar(r.ok && r.enviado, 'firma 2 → enviado (' + c.codigo + ')'); });
const env = estado.correos.slice(antesEnv).filter(c => /Tu certificado/.test(c.asunto));
comprobar(env.length === 3 && env.every(c => c.adjuntos.length === 1) && env.some(c => c.para === 'lucia@alumnos.test'), '3 certificados enviados con PDF');
comprobar(G.api_subirFirmado(tF, misF[0].codigo + '_signed.pdf', firmar('JVBERi0=', 2)).ok === false, 'nada se envía dos veces');

// ── 8. Verificación pública, rehacer y anular
const cod = misF[0].codigo;
const ver = JSON.parse(G.doGet({ parameter: { c: cod.toLowerCase() } }).vars.datosJs);
comprobar(ver.r.estado === 'ok' && !/12345678|87654321|@alumnos|Martínez|Ruiz/.test(JSON.stringify(ver)), 'verificación sin datos personales');
comprobar(JSON.parse(G.doGet({ parameter: { p: 'verificar', c: 'SAFA-PAS-2627-AAAAAA' } }).vars.datosJs).r.estado === 'no', 'código inexistente');
comprobar(/anúlalo/.test(lanza(() => G.api_rehacer(tC, cod)) || ''), 'no se rehace uno enviado');
G.api_reenviar(tC, cod);
G.api_anular(tC, cod);
comprobar(JSON.parse(G.doGet({ parameter: { c: cod } }).vars.datosJs).r.estado === 'anulado', 'anulado se ve en la verificación');

// ── 9. Privacidad
const textoDatos = JSON.stringify(Object.values(estado.libros[estado.props.LIBRO_DATOS].hojas).map(s => s.datos));
comprobar(!/12345678Z|87654321X/.test(textoDatos), 'ningún DNI en el libro de datos');
comprobar(!/@alumnos\.test|@mal\.test/.test(textoDatos), 'ningún correo del alumnado en el libro de datos');
comprobar(Object.values(estado.archivos).every(f => !/\d{8}[A-Z]/.test(f.nombre)), 'ningún DNI en nombres de archivo');
comprobar(estado.correos.every(c => !/\d{8}[A-Z]|Lucía|Pablo/.test(c.asunto)), 'asuntos sin datos personales');
comprobar(/terminados/.test(lanza(() => G.api_anonimizar(tA, '2026-27')) || ''), 'no se anonimiza el curso en marcha');
const resumen = G.api_resumen(tA);
comprobar(resumen.enviadosCurso === 2 && /p=inscripcion/.test(resumen.urlInscripcion), 'resumen de inicio');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
