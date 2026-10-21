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
const ultimoCodigo = (para) => { const c = estado.correos.filter(x => x.para === para && /código de acceso/i.test(x.asunto)).at(-1); return c && c.html.match(/font-weight:bold; color:#1B2733;">(\d{6})</)[1]; };
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
comprobar(G.api_finTanda(tC, 3, a1).aFirma === 0, 'sin automatización no se envía a firmar solo');
const generados = G.api_certificados(tC, {}).filter(c => c.estado === 'generado');
comprobar(generados.length === 3, 'quedan 3 «por enviar a firmar»');
comprobar(!estado.correos.some(c => /pendientes de tu firma/.test(c.asunto)), 'nadie recibe aviso hasta «Enviar a firmar»');

// ── 7. Enviar a firmar y firmas por subida
comprobar(G.api_enviarAFirmar(tC, generados.map(c => c.codigo), 'Son de las Jornadas') === 3, 'enviar a firmar');
const avisoFirma = estado.correos.filter(c => c.para === PROP && /pendientes de tu firma/.test(c.asunto)).at(-1);
comprobar(avisoFirma && /Son de las Jornadas/.test(avisoFirma.html), 'aviso al primer firmante con el mensaje');
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
misF.forEach(c => { const r = G.api_subirFirmado(tF, c.codigo + '_signed.pdf', firmar(G.api_pdf(tF, c.codigo).base64, 1)); comprobar(r.ok && r.firmado && !r.enviado, 'firma 2 → firmado, sin enviar (' + c.codigo + ')'); });
comprobar(estado.correos.length === antesEnv, 'firmar no envía nada al alumnado');
comprobar(/SIN_PERMISO/.test(lanza(() => G.api_enviarAlumnado(tF, [misF[0].codigo])) || ''), 'la firmante no envía al alumnado');

// ── 8. Enviar al alumnado y descarga privada con código
const envio = G.api_enviarAlumnado(tC, misF.map(c => c.codigo));
comprobar(envio.enviados === 3 && !envio.problemas.length, 'enviar al alumnado');
const env = estado.correos.slice(antesEnv).filter(c => /certificado de Pastoral está listo/.test(c.asunto));
comprobar(env.length === 3 && env.every(c => c.adjuntos.length === 0), 'correos sin el PDF adjunto');
const correoLucia = env.find(c => c.para === 'lucia@alumnos.test');
const claveLucia = correoLucia.html.match(/letter-spacing:6px[^>]*>([A-Z0-9]{4}-[A-Z0-9]{4})</)[1];
const codLucia = decodeURIComponent(correoLucia.html.match(/p=descargar&c=([^"]+)"/)[1]);
comprobar(!new RegExp(claveLucia).test(JSON.stringify(Object.values(estado.libros).map(l => Object.values(l.hojas).map(s => s.datos)))), 'el código de descarga no se guarda (solo su huella)');
comprobar(G.doGet({ parameter: { p: 'descargar', c: codLucia } }).vars.tipoJs === '"descargar"', 'página de descarga');
comprobar(/no es correcto/.test(lanza(() => G.api_publicoDescargar(codLucia, 'AAAA-AAAA')) || ''), 'código de descarga incorrecto');
comprobar(Number(G.leer_('Inscripciones').find(i => i.codigo === codLucia).intentos) === 1, 'el intento fallido cuenta');
const bajada = G.api_publicoDescargar(codLucia, claveLucia.toLowerCase().replace('-', ' '));
comprobar(Buffer.from(bajada.base64, 'base64').slice(0, 5).toString() === '%PDF-' && !!G.leer_('Inscripciones').find(i => i.codigo === codLucia).descargado, 'descarga con el código correcto');
comprobar(/no es correcto/.test(lanza(() => G.api_publicoDescargar(misF.find(c => c.codigo !== codLucia).codigo, claveLucia)) || ''), 'el código de una persona no sirve para otro certificado');
G.api_reenviar(tC, codLucia);
const claveNueva = estado.correos.filter(c => c.para === 'lucia@alumnos.test').at(-1).html.match(/letter-spacing:6px[^>]*>([A-Z0-9]{4}-[A-Z0-9]{4})</)[1];
comprobar(claveNueva !== claveLucia && lanza(() => G.api_publicoDescargar(codLucia, claveLucia)) && !lanza(() => G.api_publicoDescargar(codLucia, claveNueva)), 'reenviar cambia el código y anula el anterior');
for (let k = 0; k < 8; k++) lanza(() => G.api_publicoDescargar(codLucia, 'BBBB-BBBB'));
comprobar(/bloqueado|demasiados/i.test(lanza(() => G.api_publicoDescargar(codLucia, claveNueva)) || ''), 'demasiados intentos bloquean la descarga');

// ── 9. Verificación pública, rehacer y anular
const cod = misF[0].codigo;
const ver = JSON.parse(G.doGet({ parameter: { c: cod.toLowerCase() } }).vars.datosJs);
comprobar(ver.r.estado === 'ok' && !/12345678|87654321|@alumnos|Martínez|Ruiz/.test(JSON.stringify(ver)), 'verificación sin datos personales');
comprobar(JSON.parse(G.doGet({ parameter: { p: 'verificar', c: 'SAFA-PAS-2627-AAAAAA' } }).vars.datosJs).r.estado === 'no', 'código inexistente');
comprobar(/anúlalo/.test(lanza(() => G.api_rehacer(tC, cod)) || ''), 'no se rehace uno enviado');
G.api_anular(tC, cod);
comprobar(JSON.parse(G.doGet({ parameter: { c: cod } }).vars.datosJs).r.estado === 'anulado', 'anulado se ve en la verificación');

// ── 10. Formularios propios
const a3 = G.api_guardarActividad(tC, { nombre: 'Voluntariado en Cáritas', tipo: 'Voluntariado', fechas: 'de octubre a diciembre de 2026', horas: 20,
  contexto: 'Apoyo escolar a niños y niñas del barrio de San Pedro con Cáritas Úbeda.' });
const f0 = G.api_formularios(tC, a3);
comprobar(f0.evaluacion.preguntas.some(q => q.clave === 'general') && f0.inscripcion.preguntas.length === 0, 'formularios base');
const fGuard = G.api_guardarFormulario(tC, a3, 'inscripcion', { titulo: 'Voluntariado <b>', color: 'rojo', intro: 'Hola',
  preguntas: [{ id: 'turno', tipo: 'unica', texto: '¿Qué turno prefieres?', opciones: ['Lunes', 'Miércoles', 'Lunes'], obligatoria: true },
    { tipo: 'raro', texto: 'x' }, { tipo: 'unica', texto: 'Sin opciones', opciones: ['Una'] }, { id: 'nota', tipo: 'corto', texto: '¿Algo que debamos saber?' }] });
comprobar(fGuard.preguntas.length === 2 && fGuard.color === '#136EA1' && fGuard.preguntas[0].opciones.length === 2, 'el formulario se limpia al guardarlo');
comprobar(G.api_publicoFormulario('inscripcion', a3).cerrado === true, 'formulario cerrado mientras la inscripción no se abre');
G.api_guardarActividad(tC, { id: a3, abierta: true, evaluacion: true, auto: { validar: true } });
comprobar(G.api_publicoFormulario('inscripcion', a3).formulario.preguntas[0].id === 'turno', 'formulario público abierto');
const datosAna = { nombre: 'Ana', apellidos: 'Gil Ortega', dni: '11111111H', email: 'ana@alumnos.test', consentimiento: true, consentimiento9: true, formulario: a3 };
comprobar(/turno/.test(lanza(() => G.api_publicoInscribir(Object.assign({}, datosAna, { actividades: [{ id: a3, rol: 'Participante' }], respuestas: { [a3]: {} } }))) || ''), 'pregunta obligatoria sin responder');
G.api_publicoInscribir(Object.assign({}, datosAna, { actividades: [{ id: a3, rol: 'Participante' }], respuestas: { [a3]: { turno: 'Miércoles', nota: 'Llego a las 17 h', intruso: 'x' } } }));
G.doGet({ parameter: { p: 'confirmar', t: enlace('ana@alumnos.test') } });
const insAna = G.leer_('Inscripciones').find(i => i.actividad === a3);
comprobar(insAna && insAna.estado === 'validada', 'validación automática al confirmar');
const respAna = G.leerBoveda_('Respuestas').find(r => r.reg === insAna.reg);
comprobar(respAna && JSON.parse(respAna.datos).turno === 'Miércoles' && !('intruso' in JSON.parse(respAna.datos)), 'respuestas de la inscripción en la bóveda');
comprobar(/obligatoria|Falta/.test(lanza(() => G.api_publicoEvaluar(a3, { crecer: 4 }, {})) || ''), 'evaluación: falta la valoración general');
G.api_publicoEvaluar(a3, { general: 5, crecer: 4, recomendar: 'Sí', llevo: 'Me llevo la sonrisa de Marta y lo que me enseñó Ana. Escribidme a ana@alumnos.test', mejora: 'Más tiempo de preparación' }, { citable: true });
G.api_publicoEvaluar(a3, { general: 3, recomendar: 'Quizá', mejora: 'Avisar antes del horario' }, {});
comprobar(/robots|enviar/.test(lanza(() => G.api_publicoEvaluar(a3, { general: 4 }, { web: 'spam' })) || ''), 'evaluación: campo trampa');
const vA3 = G.api_valoraciones(tC, a3);
comprobar(vA3.length === 2 && vA3.some(v => v.mejora === 'Más tiempo de preparación' && v.citable), 'evaluaciones guardadas con su mejora');
const inf0 = G.api_informe(tC, a3);
comprobar(inf0.estadisticas.n === 2 && inf0.estadisticas.media === 4 && inf0.estadisticas.preguntas.find(q => q.id === 'recomendar').opciones[0].n === 1, 'estadísticas del informe');

// ── 11. Importar desde una hoja de Drive (y dejarla enlazada)
const externa = ctx.SpreadsheetApp.create('Respuestas Retiro (Forms)');
const shE = externa.insertSheet('Respuestas de formulario 1');
const filasHoja = [['Marca temporal', 'Dirección de correo electrónico', 'Nombre', 'Apellidos', 'DNI', '¿Cómo participaste?', 'Valora del 1 al 5', 'Comentario'],
  [new Date(), 'jorge@alumnos.test', 'jorge', 'pérez lópez', '22222222J', 'Equipo de organización', 5, 'Genial'],
  [new Date(), 'mal@alumnos.test', 'Sin', 'Dni', '12345678A', 'Participante', '', ''],
  [new Date(), 'lucia@alumnos.test', 'Lucía', 'Martínez de la Torre', '12345678Z', 'Participante', 4, '']];
shE.getRange(1, 1, filasHoja.length, filasHoja[0].length).setValues(filasHoja);
const urlHoja = 'https://docs.google.com/spreadsheets/d/' + externa.getId() + 'aaaaaaaaaaaaaaaaaaaa/edit#gid=0';
comprobar(/dirección completa/.test(lanza(() => G.api_hojaAbrir(tC, 'hola')) || ''), 'dirección de hoja no válida');
comprobar(/Compártela/.test(lanza(() => G.api_hojaAbrir(tC, urlHoja)) || ''), 'hoja no accesible: pide compartirla');
const idLargo = '1AbCdEfGhIjKlMnOpQrStUvWxYz_' + externa.getId(); estado.libros[idLargo] = externa;
const hoja = G.api_hojaAbrir(tC, 'https://docs.google.com/spreadsheets/d/' + idLargo + '/edit');
comprobar(hoja.sugerencia.dni === 4 && hoja.sugerencia.email === 1 && hoja.sugerencia.nombre === 2 && hoja.sugerencia.apellidos === 3 && hoja.sugerencia.rol === 5 && hoja.sugerencia.valor === 6 && hoja.sugerencia.comentario === 7, 'columnas sugeridas');
comprobar(!/22222222J|jorge@/.test(JSON.stringify(hoja.ejemplos)), 'ejemplos enmascarados');
const cfgHoja = { id: hoja.id, hoja: hoja.hoja, columnas: hoja.sugerencia, rol: 'Participante' };
comprobar(/consentimiento/.test(lanza(() => G.api_hojaImportar(tC, a2, cfgHoja, false)) || ''), 'sin confirmar el consentimiento no se importa');
cfgHoja.consentimiento = true;
const imp1 = G.api_hojaImportar(tC, a2, cfgHoja, true);
comprobar(imp1.nuevas === 1 && imp1.repetidas === 1 && imp1.errores.length === 1 && /DNI/.test(imp1.errores[0].motivo), 'importación: 1 nueva, 1 repetida, 1 con error');
const jorge = G.leer_('Inscripciones').find(i => i.nombre === 'Jorge Pérez López');
comprobar(jorge && jorge.rol === 'Organización' && jorge.origen === 'hoja' && jorge.estado === 'pendiente', 'fila importada con su rol');
comprobar(G.api_hojaImportar(tC, a2, cfgHoja, false).nuevas === 0, 'reimportar no duplica');
comprobar(G.api_actividades(tC).find(a => a.id === a2).enlace.nombre === 'Respuestas Retiro (Forms)', 'hoja enlazada');
shE.getRange(5, 1, 1, 8).setValues([[new Date(), 'eva@alumnos.test', 'Eva', 'Ruiz Sanz', 'X1234567L', 'Participante', '', 'Me ayudó mucho']]);
comprobar(G.api_hojaSincronizar(tC, a2).nuevas === 1, 'sincronizar trae la fila nueva');

// ── 12. Automatización completa con el PDF generado en el servidor
const CDN = {};
const nm = (r) => fs.readFileSync(require.resolve(r));
CDN['https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js'] = nm('pdf-lib/dist/pdf-lib.min.js');
CDN['https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js'] = fs.readFileSync(new URL('./node_modules/@pdf-lib/fontkit/dist/fontkit.umd.min.js', import.meta.url));
CDN['https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'] = nm('qrcode-generator/qrcode.js');
estado.webPor = (url) => {
  if (CDN[url]) return { code: 200, bytes: CDN[url] };
  const m = url.match(/@expo-google-fonts\/open-sans@0\.4\.2\/(\w+)\/(OpenSans_\w+\.ttf)$/);
  if (m) return { code: 200, bytes: nm(`@expo-google-fonts/open-sans/${m[1]}/${m[2]}`) };
  return undefined;
};
G.api_guardarActividad(tC, { id: a2, auto: { validar: true, generar: true, firmar: true, alumnado: false } });
G.api_cambiarInscripciones(tC, G.api_inscripciones(tC, a2).filter(i => i.estado === 'pendiente').map(i => i.reg), { estado: 'validada' });
shE.getRange(6, 1, 1, 8).setValues([[new Date(), 'raul@alumnos.test', 'Raúl', 'Moreno Díaz', '33333333P', '', '', '']]);
estado.usuario = 'visitante@fuera.test';
comprobar(/propietaria/.test(await G.tareaAutomatica().then(() => '', (e) => e.message)), 'un visitante no puede lanzar la tarea automática');
estado.usuario = PROP;
const antesAuto = estado.correos.length;
const t0 = Date.now();
const informe = await G.tareaAutomatica();
const gen = informe.generados[a2];
const enA2 = G.leer_('Inscripciones').filter(i => i.actividad === a2);
comprobar(informe.hojas.length === 1 && informe.hojas[0].r.nuevas === 1, 'la tarea trae las respuestas nuevas de la hoja');
comprobar(gen && gen.hechos === 3 && !gen.fallos.length, 'generados 3 certificados en el servidor (' + (gen ? gen.fallos.join('; ') : 'sin datos') + ')');
const pdfSrv = estado.archivos[enA2.find(i => i.nombre === 'Raúl Moreno Díaz').archivo];
comprobar(pdfSrv && pdfSrv.bytes.slice(0, 5).toString() === '%PDF-' && pdfSrv.bytes.length > 15000, 'el PDF del servidor es un PDF completo (' + (pdfSrv ? pdfSrv.bytes.length : 0) + ' bytes, ' + (Date.now() - t0) + ' ms)');
fs.mkdirSync('out', { recursive: true }); fs.writeFileSync('out/servidor.pdf', pdfSrv.bytes);
const textoPdf = await PDFLib.PDFDocument.load(pdfSrv.bytes).then(d => d.getTitle());
comprobar(/Retiro de Adviento/.test(textoPdf || ''), 'el PDF del servidor lleva sus metadatos');
comprobar(informe.aFirma === 3 && enA2.filter(i => i.estado === 'firma').length === 3, 'enviados a firmar automáticamente');
comprobar(estado.correos.slice(antesAuto).some(c => c.para === PROP && /pendientes de tu firma/.test(c.asunto)), 'aviso automático al primer firmante');
comprobar(Object.values(estado.archivos).some(f => f.nombre === 'pdf-lib-1.17.1.min.js'), 'librerías guardadas en la carpeta del motor');
estado.webPor = () => undefined;
comprobar(/No hay certificados/.test(lanza(() => G.api_generarEnServidor(tC, a1)) || ''), 'generar en segundo plano sin pendientes: aviso claro');

// ── 13. Inteligencia artificial (Groq simulado)
const CLAVE = 'gsk_' + 'p'.repeat(40);
comprobar(/Groq/.test(lanza(() => G.api_iaGuardar(tA, { clave: 'hola' })) || ''), 'clave con formato incorrecto');
comprobar(/SIN_PERMISO/.test(lanza(() => G.api_iaGuardar(tC, { clave: CLAVE })) || ''), 'solo administración guarda la clave');
estado.web['https://api.groq.com/openai/v1/models'] = (op) => op.headers.Authorization === 'Bearer ' + CLAVE ? { code: 200, text: '{"data":[]}' } : { code: 401, text: '' };
comprobar(/rechazado/.test(lanza(() => G.api_iaGuardar(tA, { clave: 'gsk_' + 'z'.repeat(40) })) || ''), 'clave rechazada por Groq');
G.api_iaGuardar(tA, { clave: CLAVE, modelo: 'llama-3.3-70b-versatile', comentarios: true });
const aj = G.api_ajustes(tC);
comprobar(aj.ia.configurada && aj.ia.terminacion === '…pppp' && !JSON.stringify(aj).includes(CLAVE), 'la clave no vuelve nunca al navegador');
const pedidas = [];
estado.web['https://api.groq.com/openai/v1/chat/completions'] = (op) => {
  const cuerpo = JSON.parse(op.payload); pedidas.push(cuerpo);
  const pide = cuerpo.messages.at(-1).content;
  let contenido = 'En dicho marco se ha acompañado a niños y niñas del barrio con **Cáritas Úbeda**.\nEsta experiencia ofrece herramientas para la futura labor docente.';
  if (cuerpo.response_format) contenido = JSON.stringify({ titulo: 'Cuéntanos', intro: 'Tu opinión cuenta.', preguntas: [{ id: 'general', tipo: 'escala', texto: 'Valoración general', obligatoria: true, clave: 'general' }, { id: 'mejor', tipo: 'largo', texto: '¿Qué mejorarías?', clave: 'mejora' }, { tipo: 'unica', texto: 'Mal', opciones: [] }], cierre: 'Gracias' });
  if (/Redacta un informe/.test(pide)) contenido = '## Síntesis\n- Muy bien valorada.\n## Aspectos a mejorar\n- Más preparación.';
  return { code: 200, text: JSON.stringify({ choices: [{ message: { content: contenido } }] }) };
};
const txt = G.api_iaTextoCertificado(tC, a3, 'Dos tardes por semana', 'ha participado en la actividad');
comprobar(/Cáritas/.test(txt.texto) && pedidas.at(-1).messages.at(-1).content.includes('San Pedro'), 'texto del certificado con el contexto de la actividad');
const sug = G.api_iaFormulario(tC, a3, 'evaluacion');
comprobar(sug.preguntas.length === 2 && sug.preguntas[0].clave === 'general', 'propuesta de formulario limpiada');
const inf = G.api_iaInforme(tC, a3);
const enviado = JSON.stringify(pedidas.at(-1));
comprobar(/Síntesis/.test(inf.guardado.texto) && G.api_informe(tC, a3).guardado, 'informe redactado y guardado');
comprobar(!/ana@alumnos|Ana|Gil|Ortega/.test(enviado) && /\[correo\]/.test(enviado) && /Más tiempo de preparación/.test(enviado), 'comentarios anonimizados antes de ir a la IA');
G.api_iaGuardar(tA, { comentarios: false });
G.api_iaInforme(tC, a3);
comprobar(!/Más tiempo de preparación/.test(JSON.stringify(pedidas.at(-1))), 'con el interruptor apagado no se envían comentarios');
comprobar(!estado.peticiones.some(p => /groq/.test(p.url) && JSON.stringify(p.op.payload || '').includes(CLAVE)), 'la clave solo va en la cabecera');

// ── 14. Privacidad
const textoDatos = JSON.stringify(Object.values(estado.libros[estado.props.LIBRO_DATOS].hojas).map(s => s.datos));
comprobar(!/12345678Z|87654321X|11111111H|22222222J|33333333P|X1234567L/.test(textoDatos), 'ningún DNI en el libro de datos');
comprobar(!/@alumnos\.test|@mal\.test/.test(textoDatos.replace(/Escribidme a ana@alumnos\.test/g, '')), 'ningún correo del alumnado en el libro de datos (salvo lo que alguien escriba en un comentario anónimo)');
comprobar(!textoDatos.includes(CLAVE), 'la clave de Groq no está en ninguna hoja');
comprobar(Object.values(estado.archivos).every(f => !/\d{8}[A-Z]/.test(f.nombre)), 'ningún DNI en nombres de archivo');
comprobar(estado.correos.every(c => !/\d{8}[A-Z]|Lucía|Pablo|Jorge|Raúl/.test(c.asunto)), 'asuntos sin datos personales');
comprobar(/terminados/.test(lanza(() => G.api_anonimizar(tA, '2026-27')) || ''), 'no se anonimiza el curso en marcha');
const resumen = G.api_resumen(tA);
comprobar(resumen.enviadosCurso === 2 && resumen.descargadosCurso === (codLucia !== cod ? 1 : 0) && /p=inscripcion/.test(resumen.urlInscripcion), 'resumen de inicio');
comprobar(G.api_publicoFormulario('evaluacion', 'A-999').cerrado === true, 'formulario de una actividad que no existe');

console.log(`\n${ok} comprobaciones correctas, ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
