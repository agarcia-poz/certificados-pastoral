/**
 * ============================================================================
 *  CERTIFICADOS DE PASTORAL · C.U. «SAGRADA FAMILIA» · ÚBEDA
 *  Aplicación web del Servicio de Pastoral y Compromiso Solidario
 * ============================================================================
 *
 *  INSTALAR (una vez, con la cuenta propietaria):
 *    1. drive.google.com > Nuevo > Más > Google Apps Script. Ponle nombre.
 *    2. Pega este archivo entero en Código.gs (sustituyendo lo que haya) y guarda.
 *    3. Implementar > Nueva implementación > ⚙️ Aplicación web.
 *       Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario > Implementar > Autorizar.
 *    4. Abre la URL de la aplicación web: un asistente termina la configuración.
 *
 *  ACTUALIZAR: pega la versión nueva y en Implementar > Gestionar implementaciones >
 *  ✏️ > Versión: Nueva versión > Implementar. La dirección no cambia.
 *
 *  Código fuente: https://github.com/agarcia-poz/certificados-pastoral
 * ============================================================================
 */

const VERSION_APP = '3.0.0';

const CONFIG = {
  REPO_GITHUB: 'agarcia-poz/certificados-pastoral',
  NOMBRE_SERVICIO: 'Servicio de Pastoral y Compromiso Solidario',
  NOMBRE_REMITENTE: 'Pastoral · C.U. SAFA',
  LEMA: 'Libres para servir',
  ROLES_ACTIVIDAD: ['Participante', 'Organización', 'Coordinación'],
  TIPOS_ACTIVIDAD: ['Voluntariado', 'Retiro', 'Jornada', 'Encuentro', 'Celebración', 'Peregrinación', 'Formación', 'Otra'],
  LUGAR_POR_DEFECTO: 'en el Centro Universitario de la Sagrada Familia de Úbeda',
  PREFIJO_CODIGO: 'SAFA-PAS',
  MES_INICIO_CURSO: 9,
  COMPROBAR_FIRMAS: true,
  HORAS_SESION: 6,                 // máximo que permite la caché de Google (6 h)
  HORAS_ENLACE_CONFIRMACION: 72,
  MAX_INSCRIPCIONES_CORREO_DIA: 3,
  MAX_CORREOS_PUBLICOS_HORA: 120,
  DIRECCION_PIE: 'Av. Cristo Rey, 17 · 23400 Úbeda (Jaén) · Tel. 953 79 61 02',
  FIRMANTES_INICIALES: [
    { cargo: 'Servicio de Pastoral y Compromiso Solidario', nombre: 'Andrés García Pozas', email: '' },
    { cargo: 'Vº Bº Directora Adjunta', nombre: 'Consuelo Burgos Bolós', email: '' }
  ],
  TEXTO_PRIVACIDAD:
    'Responsable: Fundación SAFA (Centro Universitario «Sagrada Familia», Av. Cristo Rey, 17, 23400 Úbeda). ' +
    'Finalidad: registrar tu participación en actividades del Servicio de Pastoral y Compromiso Solidario, ' +
    'expedir y enviarte el certificado firmado y permitir que terceros comprueben su autenticidad mediante un código. ' +
    'Base jurídica: tu consentimiento (art. 6.1.a RGPD) y, por tratarse de actividades de pastoral que pueden ' +
    'revelar convicciones religiosas, tu consentimiento explícito (art. 9.2.a RGPD). ' +
    'Datos: nombre, apellidos, DNI/NIE y correo. El DNI solo aparece en tu certificado. ' +
    'Destinatarios: no se ceden datos a terceros salvo obligación legal. ' +
    'Conservación: los datos se anonimizan al terminar el curso siguiente; se conserva el registro mínimo ' +
    '(código, actividad, iniciales) para poder verificar el certificado. ' +
    'Derechos: acceso, rectificación, supresión, oposición, limitación y portabilidad, y retirar el consentimiento, ' +
    'escribiendo a la dirección de contacto del centro. Puedes reclamar ante la AEPD (www.aepd.es). ' +
    'Las valoraciones y comentarios se guardan de forma anónima, separados de tus datos.'
};

const ROLES = {
  admin: { nombre: 'Administración', nivel: 3 },
  coordinacion: { nombre: 'Coordinación', nivel: 2 },
  firmante: { nombre: 'Firmante', nivel: 1 }
};

const ESTADOS = {
  pendiente: 'Pendiente de validar',
  validada: 'Validada · lista para generar',
  rechazada: 'Rechazada',
  generando: 'Generando…',
  firma: 'En firma',
  enviado: 'Enviado',
  anulado: 'Anulado',
  revisar: 'Revisar'
};

// Tablas (libro «Datos», privado) y bóveda (libro aparte, privado)
const TABLAS = {
  Actividades: ['id', 'nombre', 'tipo', 'curso', 'fechas', 'lugar', 'horas', 'ects', 'abierta', 'creada', 'diseno'],
  Inscripciones: ['reg', 'fecha', 'curso', 'persona', 'nombre', 'actividad', 'rol', 'estado', 'codigo', 'archivo',
    'firmas', 'enviado', 'notas'],
  Valoraciones: ['fecha', 'actividad', 'valor', 'comentario', 'citable'],
  Equipo: ['email', 'nombre', 'rol', 'activo', 'alta'],
  Ajustes: ['clave', 'valor'],
  Registro: ['fecha', 'usuario', 'accion', 'detalle']
};
const TABLAS_BOVEDA = {
  Personas: ['persona', 'dni', 'nombre', 'apellidos', 'email', 'alta', 'actualizado', 'consentimientos', 'avisos'],
  Pendientes: ['token', 'creada', 'expira', 'email', 'datos']
};

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ─────────────────────────────── RUTAS ──────────────────────────────────────
function doGet(e) {
  const p = (e && e.parameter) || {};
  const pagina = String(p.p || '');
  if (pagina === 'inscripcion') return paginaPublica_('inscripcion', {});
  if (pagina === 'confirmar') return paginaConfirmar_(String(p.t || ''));
  if (pagina === 'verificar' || p.c) return paginaVerificar_(String(p.c || ''));
  const t = HtmlService.createTemplate(recurso_('Panel'));
  return t.evaluate().setTitle('Pastoral · Certificados').addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setFaviconUrl('https://ssl.gstatic.com/docs/script/images/favicon.ico');
}

function recurso_(nombre) {
  if (typeof ARCHIVOS_HTML !== 'undefined' && ARCHIVOS_HTML[nombre]) return ARCHIVOS_HTML[nombre];
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}
function incluir_(nombre) { return recurso_(nombre); }

function urlApp_() {
  const props = PropertiesService.getScriptProperties();
  let url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (err) { }
  if (url && /\/exec$/.test(url) && props.getProperty('URL_APP') !== url) props.setProperty('URL_APP', url);
  return props.getProperty('URL_APP') || url;
}

// ─────────────────────────────── CONFIGURACIÓN INICIAL ──────────────────────
function instalado_() { return !!PropertiesService.getScriptProperties().getProperty('LIBRO_DATOS'); }

/** El panel pregunta al arrancar si la app está configurada. */
function api_estado() {
  return { instalado: instalado_(), version: VERSION_APP, servicio: CONFIG.NOMBRE_SERVICIO,
    propietario: instalado_() ? '' : enmascararEmail_(Session.getEffectiveUser().getEmail()) };
}

/** Paso 1 del asistente: envía un código a la cuenta propietaria (solo ella puede configurar). */
function api_configurarPedirCodigo() {
  if (instalado_()) throw new Error('La aplicación ya está configurada.');
  const email = Session.getEffectiveUser().getEmail();
  enviarCodigo_(email, 'Configuración inicial');
  return { email: enmascararEmail_(email) };
}

/** Paso 2 del asistente: con el código correcto, crea los datos y deja a la propietaria como administradora. */
function api_configurar(codigo, nombre) {
  if (instalado_()) throw new Error('La aplicación ya está configurada.');
  const email = Session.getEffectiveUser().getEmail();
  comprobarCodigo_(email, codigo);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    const raiz = obtenerOCrearCarpeta_(DriveApp.getRootFolder(), 'Pastoral · Certificados (app)');
    const datos = SpreadsheetApp.create('Pastoral · Datos de la app (no editar)');
    const boveda = SpreadsheetApp.create('🔒 Pastoral · Bóveda de datos personales (NO COMPARTIR)');
    [datos, boveda].forEach(function (ss) { DriveApp.getFileById(ss.getId()).moveTo(raiz); });
    prepararLibro_(datos, TABLAS);
    prepararLibro_(boveda, TABLAS_BOVEDA);
    boveda.getSheetByName('Personas').getRange('B:B').setNumberFormat('@');
    props.setProperties({
      LIBRO_DATOS: datos.getId(), LIBRO_BOVEDA: boveda.getId(), CARPETA_RAIZ: raiz.getId(),
      CARPETA_PDF: obtenerOCrearCarpeta_(raiz, 'Certificados (PDF)').getId(),
      CARPETA_IMAGENES: obtenerOCrearCarpeta_(raiz, 'Imágenes de diseño').getId(),
      PROPIETARIO: email
    });
    insertar_('Equipo', { email: email, nombre: limpiar_(nombre || email.split('@')[0]), rol: 'admin', activo: true, alta: new Date() });
    guardarAjuste_('firmantes', CONFIG.FIRMANTES_INICIALES.map(function (f, i) {
      return { cargo: f.cargo, nombre: f.nombre, email: i === 0 ? '' : f.email };
    }));
    try {
      ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
      ScriptApp.newTrigger('mantenimientoDiario').timeBased().everyDays(1).atHour(3).create();
    } catch (err) { }
    urlApp_();
    registrar_(email, 'Configuración inicial', 'Versión ' + VERSION_APP);
  } finally {
    lock.releaseLock();
  }
  return crearSesion_(email);
}

function prepararLibro_(ss, tablas) {
  Object.keys(tablas).forEach(function (nombre) {
    const sh = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    sh.getRange(1, 1, 1, tablas[nombre].length).setValues([tablas[nombre]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  const sobra = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (sobra && ss.getSheets().length > 1) ss.deleteSheet(sobra);
}

// ─────────────────────────────── ACCESO DEL EQUIPO ──────────────────────────
/** Envía un código de acceso de 6 cifras si el correo pertenece al equipo. No revela si existe. */
function api_pedirCodigo(email) {
  email = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Escribe un correo válido.');
  const m = miembro_(email);
  if (m) enviarCodigo_(email, 'Acceso al panel');
  else registrar_(email, 'Acceso denegado', 'Correo que no pertenece al equipo');
  return { ok: true };
}

function api_entrar(email, codigo) {
  email = String(email || '').trim().toLowerCase();
  const m = miembro_(email);
  if (!m) throw new Error('Código incorrecto o caducado.');
  comprobarCodigo_(email, codigo);
  registrar_(email, 'Entrada al panel', ROLES[m.rol].nombre);
  return crearSesion_(email);
}

function api_salir(token) {
  try { CacheService.getScriptCache().remove('ses_' + huella_(token)); } catch (err) { }
  return true;
}

function api_yo(token) { const u = sesion_(token); return datosUsuario_(u); }

function enviarCodigo_(email, motivo) {
  const cache = CacheService.getScriptCache();
  const clave = 'cod_' + huella_(email);
  const previo = JSON.parse(cache.get(clave) || 'null');
  if (previo && Date.now() - previo.t < 60 * 1000) throw new Error('Espera un minuto antes de pedir otro código.');
  const b = bytesAleatorios_();
  const codigo = String(100000 + ((((b[0] + 256) % 256) << 16 | ((b[1] + 256) % 256) << 8 | ((b[2] + 256) % 256)) % 900000));
  cache.put(clave, JSON.stringify({ h: huella_(codigo), t: Date.now(), n: 0 }), 600);
  enviarEmail_(email, 'Tu código de acceso · Pastoral C.U. SAFA', plantillaEmail_({
    titulo: 'Código de acceso', titular: codigo, subtitular: motivo + ' · válido 10 minutos',
    parrafos: ['Hola:', 'Este es tu código para entrar en la aplicación de certificados de Pastoral. Si no lo has pedido tú, ignora este correo.'],
    cierre: 'Por seguridad, no lo compartas con nadie.'
  }));
}

function comprobarCodigo_(email, codigo) {
  const cache = CacheService.getScriptCache();
  const clave = 'cod_' + huella_(email);
  const guardado = JSON.parse(cache.get(clave) || 'null');
  if (!guardado) throw new Error('Código incorrecto o caducado.');
  if (guardado.n >= 5) { cache.remove(clave); throw new Error('Demasiados intentos. Pide un código nuevo.'); }
  if (guardado.h !== huella_(String(codigo || '').replace(/\D/g, ''))) {
    guardado.n++;
    cache.put(clave, JSON.stringify(guardado), 600);
    throw new Error('Código incorrecto o caducado.');
  }
  cache.remove(clave);
}

function crearSesion_(email) {
  const token = bytesAleatorios_().map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join('') +
    Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('ses_' + huella_(token), JSON.stringify({ email: email }), CONFIG.HORAS_SESION * 3600);
  return { token: token, usuario: datosUsuario_(usuarioDe_(email)) };
}

/** Comprueba la sesión en CADA llamada; nunca se confía en el navegador. */
function sesion_(token, nivelMinimo) {
  if (!token) throw new Error('SESION: Vuelve a entrar.');
  const cache = CacheService.getScriptCache();
  const dato = JSON.parse(cache.get('ses_' + huella_(token)) || 'null');
  if (!dato) throw new Error('SESION: Tu sesión ha caducado. Vuelve a entrar.');
  const u = usuarioDe_(dato.email);
  if (!u) throw new Error('SESION: Ya no formas parte del equipo.');
  cache.put('ses_' + huella_(token), JSON.stringify(dato), CONFIG.HORAS_SESION * 3600);
  if (nivelMinimo && ROLES[u.rol].nivel < nivelMinimo) throw new Error('SIN_PERMISO: Tu papel no permite hacer esto.');
  return u;
}
const NIVEL = { firmante: 1, coordinacion: 2, admin: 3 };

function miembro_(email) {
  if (!instalado_()) return null;
  return leer_('Equipo').filter(function (m) { return m.email === email && m.activo === true; })[0] || null;
}
function usuarioDe_(email) {
  const m = miembro_(email);
  if (!m || !ROLES[m.rol]) return null;
  const firmantes = leerAjuste_('firmantes', []);
  const slots = [];
  firmantes.forEach(function (f, i) { if (String(f.email).toLowerCase() === email) slots.push(i); });
  return { email: email, nombre: m.nombre, rol: m.rol, firmas: slots };
}
function datosUsuario_(u) {
  return { email: u.email, nombre: u.nombre, rol: u.rol, rolNombre: ROLES[u.rol].nombre, nivel: ROLES[u.rol].nivel,
    firmas: u.firmas, version: VERSION_APP, urlApp: urlApp_() };
}

// ─────────────────────────────── INICIO ─────────────────────────────────────
function api_resumen(token) {
  const u = sesion_(token);
  const ins = leer_('Inscripciones');
  const curso = cursoAcademico_(new Date());
  const cuenta = function (f) { return ins.filter(f).length; };
  const nFirm = leerAjuste_('firmantes', []).length;
  return {
    usuario: datosUsuario_(u),
    porValidar: cuenta(function (i) { return i.estado === 'pendiente'; }),
    porGenerar: cuenta(function (i) { return i.estado === 'validada' || i.estado === 'generando'; }),
    enFirma: cuenta(function (i) { return i.estado === 'firma'; }),
    misFirmas: cuenta(function (i) { return i.estado === 'firma' && u.firmas.indexOf(Number(i.firmas) || 0) > -1; }),
    revisar: cuenta(function (i) { return i.estado === 'revisar'; }),
    enviadosCurso: cuenta(function (i) { return i.estado === 'enviado' && i.curso === curso; }),
    abiertas: leer_('Actividades').filter(function (a) { return a.abierta === true; }).map(function (a) { return a.nombre; }),
    firmantes: nFirm, curso: curso,
    urlInscripcion: urlApp_() + '?p=inscripcion', urlVerificacion: urlApp_() + '?p=verificar'
  };
}

// ─────────────────────────────── ACTIVIDADES ────────────────────────────────
function api_actividades(token) {
  sesion_(token, NIVEL.coordinacion);
  const ins = leer_('Inscripciones');
  const val = leer_('Valoraciones');
  return leer_('Actividades').map(function (a) {
    const mias = ins.filter(function (i) { return i.actividad === a.id; });
    const v = val.filter(function (x) { return x.actividad === a.id; });
    return {
      id: a.id, nombre: a.nombre, tipo: a.tipo, curso: a.curso, fechas: a.fechas, lugar: a.lugar,
      horas: Number(a.horas) || 0, ects: Number(a.ects) || 0, abierta: a.abierta === true, conDiseno: !!a.diseno,
      inscritos: mias.length, pendientes: mias.filter(function (i) { return i.estado === 'pendiente'; }).length,
      porGenerar: mias.filter(function (i) { return i.estado === 'validada' || i.estado === 'generando'; }).length,
      enviados: mias.filter(function (i) { return i.estado === 'enviado'; }).length,
      valoracion: v.length ? Math.round(v.reduce(function (s, x) { return s + Number(x.valor); }, 0) / v.length * 10) / 10 : null,
      nValoraciones: v.length
    };
  }).sort(function (x, y) { return String(y.id).localeCompare(String(x.id)); });
}

function api_guardarActividad(token, a) {
  const u = sesion_(token, NIVEL.coordinacion);
  const nombre = limpiar_(a.nombre);
  if (!nombre) throw new Error('La actividad necesita un nombre.');
  if (nombre.length > 180) throw new Error('El nombre es demasiado largo.');
  const fila = {
    nombre: nombre, tipo: limpiar_(a.tipo || ''), curso: /^\d{4}-\d{2}$/.test(a.curso) ? a.curso : cursoAcademico_(new Date()),
    fechas: limpiar_(a.fechas || ''), lugar: limpiar_(a.lugar || ''), horas: Number(String(a.horas).replace(',', '.')) || 0,
    ects: Number(String(a.ects).replace(',', '.')) || 0, abierta: a.abierta === true
  };
  return conCerrojo_(function () {
    const acts = leer_('Actividades');
    if (a.id) {
      const x = acts.filter(function (r) { return r.id === a.id; })[0];
      if (!x) throw new Error('La actividad no existe.');
      actualizar_('Actividades', x._fila, fila);
      registrar_(u.email, 'Actividad modificada', a.id);
      return a.id;
    }
    let max = 0;
    acts.forEach(function (r) { const m = String(r.id).match(/^A-(\d+)$/); if (m) max = Math.max(max, Number(m[1])); });
    const id = 'A-' + String(max + 1).padStart(3, '0');
    fila.id = id; fila.creada = new Date(); fila.diseno = '';
    insertar_('Actividades', fila);
    registrar_(u.email, 'Actividad creada', id + ' · ' + nombre);
    return id;
  });
}

function api_borrarActividad(token, id) {
  const u = sesion_(token, NIVEL.coordinacion);
  return conCerrojo_(function () {
    if (leer_('Inscripciones').some(function (i) { return i.actividad === id; })) throw new Error('No se puede borrar: tiene inscripciones. Ciérrala en su lugar.');
    const x = leer_('Actividades').filter(function (r) { return r.id === id; })[0];
    if (!x) return true;
    hojaDatos_('Actividades').deleteRow(x._fila);
    registrar_(u.email, 'Actividad borrada', id);
    return true;
  });
}

// ─────────────────────────────── INSCRIPCIONES ──────────────────────────────
function api_inscripciones(token, actId) {
  sesion_(token, NIVEL.coordinacion);
  const personas = leerPersonas_();
  return leer_('Inscripciones').filter(function (i) { return i.actividad === actId; }).map(function (i) {
    const p = personas[i.persona] || {};
    return { reg: i.reg, fecha: fechaCorta_(i.fecha), persona: i.persona, nombre: p.nombre || '', apellidos: p.apellidos || '',
      nombreCompleto: i.nombre, dniOculto: enmascararDni_(p.dni || ''), emailOculto: enmascararEmail_(p.email || ''),
      rol: i.rol, estado: i.estado, estadoNombre: ESTADOS[i.estado] || i.estado, codigo: i.codigo, firmas: Number(i.firmas) || 0,
      notas: i.notas || '' };
  });
}

/** Muestra el DNI completo (queda anotado en el registro). */
function api_revelarDni(token, reg) {
  const u = sesion_(token, NIVEL.coordinacion);
  const i = leer_('Inscripciones').filter(function (x) { return x.reg === reg; })[0];
  if (!i) throw new Error('No existe.');
  registrar_(u.email, 'DNI consultado', i.persona);
  return (leerPersonas_()[i.persona] || {}).dni || '';
}

/** Validar, rechazar o volver a pendiente varias inscripciones; también cambiar el rol. */
function api_cambiarInscripciones(token, regs, cambio) {
  const u = sesion_(token, NIVEL.coordinacion);
  return conCerrojo_(function () {
    let n = 0;
    leer_('Inscripciones').forEach(function (i) {
      if (regs.indexOf(i.reg) < 0) return;
      const c = {};
      if (cambio.rol && CONFIG.ROLES_ACTIVIDAD.indexOf(cambio.rol) > -1 && ['pendiente', 'validada', 'rechazada', 'revisar'].indexOf(i.estado) > -1) c.rol = cambio.rol;
      if (cambio.estado && ['pendiente', 'validada', 'rechazada'].indexOf(cambio.estado) > -1 &&
          ['pendiente', 'validada', 'rechazada', 'revisar'].indexOf(i.estado) > -1) c.estado = cambio.estado;
      if (Object.keys(c).length) { actualizar_('Inscripciones', i._fila, c); n++; }
    });
    registrar_(u.email, 'Inscripciones actualizadas', n + ' · ' + JSON.stringify(cambio));
    return n;
  });
}

/** Corrige nombre, apellidos o DNI de una persona (bóveda). */
function api_corregirPersona(token, personaId, c) {
  const u = sesion_(token, NIVEL.coordinacion);
  return conCerrojo_(function () { return corregirPersona_(u.email, personaId, c); });
}

function corregirPersona_(quien, personaId, c) {
  const p = leerBoveda_('Personas').filter(function (x) { return x.persona === personaId; })[0];
  if (!p) throw new Error('No se encuentra a ' + personaId + '.');
  const cambios = {}, que = [];
  if (c.dni !== undefined) {
    const dni = normalizarDni_(c.dni);
    if (dni !== normalizarDni_(p.dni)) {
      if (!dniValido_(dni)) throw new Error('El DNI/NIE no es válido (revisa la letra).');
      cambios.dni = dni; que.push('DNI');
    }
  }
  if (c.nombre !== undefined && limpiar_(c.nombre) && limpiar_(c.nombre) !== p.nombre) { cambios.nombre = limpiar_(c.nombre); que.push('nombre'); }
  if (c.apellidos !== undefined && limpiar_(c.apellidos) && limpiar_(c.apellidos) !== p.apellidos) { cambios.apellidos = limpiar_(c.apellidos); que.push('apellidos'); }
  if (que.length) {
    cambios.actualizado = new Date();
    actualizarBoveda_('Personas', p._fila, cambios);
    const nuevo = (cambios.nombre || p.nombre) + ' ' + (cambios.apellidos || p.apellidos);
    leer_('Inscripciones').forEach(function (i) { if (i.persona === personaId) actualizar_('Inscripciones', i._fila, { nombre: nuevo }); });
    registrar_(quien, 'Datos corregidos', personaId + ' · ' + que.join(', '));
  }
  return true;
}

// ─────────────────────────────── DISEÑO ─────────────────────────────────────
function api_inicioEditor(token) {
  const u = sesion_(token, NIVEL.coordinacion);
  const ins = leer_('Inscripciones');
  return {
    version: VERSION_APP,
    actividades: leer_('Actividades').map(function (a) {
      return { id: a.id, nombre: a.nombre, tipo: a.tipo, curso: a.curso, fechas: a.fechas, lugar: a.lugar,
        horas: Number(a.horas) || 0, ects: Number(a.ects) || 0, conDiseno: !!a.diseno,
        pendientes: ins.filter(function (i) { return i.actividad === a.id && enCola_(i); }).length };
    }),
    firmantes: leerAjuste_('firmantes', []).map(function (f) { return { titulo: f.cargo, nombre: f.nombre }; }),
    roles: CONFIG.ROLES_ACTIVIDAD, url: urlApp_(), lugarPorDefecto: CONFIG.LUGAR_POR_DEFECTO,
    hayBase: !!leerAjuste_('disenoBase', null), usuario: datosUsuario_(u)
  };
}

function api_diseno(token, actId) {
  sesion_(token, NIVEL.coordinacion);
  const a = leer_('Actividades').filter(function (x) { return x.id === actId; })[0];
  if (a && a.diseno) { try { return JSON.parse(a.diseno); } catch (err) { } }
  return leerAjuste_('disenoBase', {}) || {};
}

function api_guardarDiseno(token, actId, diseno, tambienComoBase) {
  const u = sesion_(token, NIVEL.coordinacion);
  const texto = JSON.stringify(diseno || {});
  if (texto.length > 45000) throw new Error('El diseño es demasiado grande (¿texto muy largo?).');
  return conCerrojo_(function () {
    const a = leer_('Actividades').filter(function (x) { return x.id === actId; })[0];
    if (!a) throw new Error('La actividad no existe.');
    actualizar_('Actividades', a._fila, { diseno: texto });
    if (tambienComoBase) guardarAjuste_('disenoBase', diseno);
    registrar_(u.email, 'Diseño guardado', actId + (tambienComoBase ? ' (también como base)' : ''));
    return true;
  });
}

function api_subirImagen(token, base64, mime, nombre) {
  const u = sesion_(token, NIVEL.coordinacion);
  if (['image/jpeg', 'image/png'].indexOf(mime) < 0) throw new Error('Solo imágenes JPG o PNG.');
  if (base64.length > 12 * 1024 * 1024) throw new Error('La imagen es demasiado grande.');
  const f = carpeta_('CARPETA_IMAGENES').createFile(Utilities.newBlob(Utilities.base64Decode(base64), mime, limpiarNombre_(nombre)));
  registrar_(u.email, 'Imagen de diseño subida', f.getName());
  return f.getId();
}

function api_imagen(token, id) {
  sesion_(token, NIVEL.coordinacion);
  const f = DriveApp.getFileById(id);
  if (!enCarpeta_(f, 'CARPETA_IMAGENES')) throw new Error('Esa imagen no pertenece a la carpeta de diseño.');
  const b = f.getBlob();
  return { base64: Utilities.base64Encode(b.getBytes()), mime: b.getContentType() };
}

// ─────────────────────────────── GENERAR ────────────────────────────────────
function enCola_(i) { return i.estado === 'validada' || (i.estado === 'generando' && !i.archivo); }

function api_cola(token, actId) {
  sesion_(token, NIVEL.coordinacion);
  const personas = leerPersonas_();
  return leer_('Inscripciones').filter(function (i) { return i.actividad === actId && enCola_(i); }).map(function (i) {
    const p = personas[i.persona] || {};
    return { reg: i.reg, persona: i.persona, nombre: p.nombre || '', apellidos: p.apellidos || '', dni: p.dni || '',
      tieneEmail: !!p.email, rol: i.rol, codigo: i.codigo || '', notas: i.notas || '' };
  });
}

function api_reservar(token, regs) {
  sesion_(token, NIVEL.coordinacion);
  return conCerrojo_(function () {
    const ins = leer_('Inscripciones');
    const acts = indice_(leer_('Actividades'), 'id');
    const usados = {};
    ins.forEach(function (i) { if (i.codigo) usados[i.codigo] = true; });
    const res = {};
    ins.forEach(function (i) {
      if (regs.indexOf(i.reg) < 0 || !enCola_(i)) return;
      let codigo = i.codigo;
      if (!codigo) {
        codigo = nuevoCodigo_((acts[i.actividad] || {}).curso || i.curso, usados);
        usados[codigo] = true;
        actualizar_('Inscripciones', i._fila, { estado: 'generando', codigo: codigo });
      }
      res[i.reg] = codigo;
    });
    return res;
  });
}

function api_guardarPdf(token, reg, codigo, base64, cambios) {
  const u = sesion_(token, NIVEL.coordinacion);
  return conCerrojo_(function () {
    const i = leer_('Inscripciones').filter(function (x) { return x.reg === reg; })[0];
    if (!i) throw new Error('No se encuentra la inscripción ' + reg);
    if (i.codigo !== codigo || i.estado !== 'generando') throw new Error('La inscripción ' + reg + ' ya no está pendiente de generar.');
    const bytes = Utilities.base64Decode(base64);
    if (String.fromCharCode.apply(null, bytes.slice(0, 5).map(function (b) { return (b + 256) % 256; })) !== '%PDF-') throw new Error('El archivo recibido no es un PDF.');
    const c = {};
    if (cambios) {
      if (cambios.rol && CONFIG.ROLES_ACTIVIDAD.indexOf(cambios.rol) > -1) c.rol = cambios.rol;
      if (cambios.nombre !== undefined || cambios.apellidos !== undefined || cambios.dni !== undefined) corregirPersona_(u.email, i.persona, cambios);
    }
    const a = indice_(leer_('Actividades'), 'id')[i.actividad] || {};
    const f = carpeta_('CARPETA_PDF').createFile(Utilities.newBlob(bytes, 'application/pdf', nombreArchivo_(codigo, a.nombre)));
    c.estado = 'firma'; c.archivo = f.getId(); c.firmas = 0;
    actualizar_('Inscripciones', i._fila, c);
    registrar_(u.email, 'Certificado generado', codigo + ' · ' + reg);
    return { ok: true };
  });
}

function api_finTanda(token, n) {
  sesion_(token, NIVEL.coordinacion);
  if (n > 0) avisarFirmante_(0, n);
  return true;
}

// ─────────────────────────────── CERTIFICADOS ───────────────────────────────
function api_certificados(token, filtro) {
  const u = sesion_(token);
  filtro = filtro || {};
  const acts = indice_(leer_('Actividades'), 'id');
  const firmantes = leerAjuste_('firmantes', []);
  return leer_('Inscripciones').filter(function (i) {
    if (!i.codigo) return false;
    if (filtro.actividad && i.actividad !== filtro.actividad) return false;
    if (u.rol === 'firmante') return i.estado === 'firma' && u.firmas.indexOf(Number(i.firmas) || 0) > -1;
    if (filtro.misFirmas) return i.estado === 'firma' && u.firmas.indexOf(Number(i.firmas) || 0) > -1;
    return true;
  }).map(function (i) {
    const k = Number(i.firmas) || 0;
    return { codigo: i.codigo, reg: i.reg, nombre: i.nombre, actividad: (acts[i.actividad] || {}).nombre || i.actividad,
      actividadId: i.actividad, rol: i.rol, estado: i.estado, firmas: k, totalFirmas: firmantes.length,
      pendienteDe: i.estado === 'firma' && firmantes[k] ? firmantes[k].nombre : '', enviado: i.enviado ? fechaCorta_(i.enviado) : '',
      notas: i.notas || '' };
  });
}

/** Descarga un PDF. Los firmantes solo los que esperan su firma. */
function api_pdf(token, codigo) {
  const u = sesion_(token);
  const i = leer_('Inscripciones').filter(function (x) { return x.codigo === codigo; })[0];
  if (!i || !i.archivo) throw new Error('No hay PDF para ' + codigo);
  if (u.rol === 'firmante' && !(i.estado === 'firma' && u.firmas.indexOf(Number(i.firmas) || 0) > -1)) throw new Error('SIN_PERMISO: Este certificado no espera tu firma.');
  const f = DriveApp.getFileById(i.archivo);
  registrar_(u.email, 'PDF descargado', codigo);
  return { nombre: f.getName(), base64: Utilities.base64Encode(f.getBlob().getBytes()) };
}

/**
 * Recibe un PDF firmado con Autofirma. Lo identifica por el código del nombre, comprueba que le
 * tocaba a esa persona y que contiene la firma, y lo pasa al siguiente firmante o lo envía.
 */
function api_subirFirmado(token, nombreArchivo, base64) {
  const u = sesion_(token);
  return conCerrojo_(function () {
    const patron = new RegExp(escRegex_(CONFIG.PREFIJO_CODIGO) + '-\\d{4}-[' + ALFABETO_CODIGO + ']{6}');
    const m = String(nombreArchivo).toUpperCase().match(patron);
    if (!m) return { ok: false, motivo: 'El nombre del archivo no lleva el código del certificado. No lo renombres.' };
    const i = leer_('Inscripciones').filter(function (x) { return x.codigo === m[0]; })[0];
    if (!i) return { ok: false, motivo: 'No existe ningún certificado con el código ' + m[0] + '.' };
    if (i.estado !== 'firma') return { ok: false, motivo: m[0] + ': no está esperando firmas (' + (ESTADOS[i.estado] || i.estado) + ').' };
    const k = Number(i.firmas) || 0;
    if (u.firmas.indexOf(k) < 0 && u.rol !== 'admin') return { ok: false, motivo: m[0] + ': ahora le toca firmar a otra persona.' };
    const bytes = Utilities.base64Decode(base64);
    const blob = Utilities.newBlob(bytes, 'application/pdf', nombreArchivo);
    if (CONFIG.COMPROBAR_FIRMAS && contarFirmas_(blob) < k + 1) {
      return { ok: false, motivo: m[0] + ': el PDF no contiene la firma electrónica. Fírmalo con Autofirma y vuelve a subirlo.' };
    }
    const firmantes = leerAjuste_('firmantes', []);
    const acts = indice_(leer_('Actividades'), 'id');
    const nombre = nombreArchivo_(m[0], (acts[i.actividad] || {}).nombre);
    const nuevo = carpeta_('CARPETA_PDF').createFile(blob.setName(nombre));
    try { DriveApp.getFileById(i.archivo).setTrashed(true); } catch (err) { }
    if (k + 1 < firmantes.length) {
      actualizar_('Inscripciones', i._fila, { archivo: nuevo.getId(), firmas: k + 1 });
      registrar_(u.email, 'Firma ' + (k + 1) + '/' + firmantes.length, m[0]);
      return { ok: true, codigo: m[0], siguiente: firmantes[k + 1].nombre };
    }
    const p = leerPersonas_()[i.persona];
    if (!p || !p.email) {
      actualizar_('Inscripciones', i._fila, { archivo: nuevo.getId(), firmas: k + 1, estado: 'revisar', notas: 'Firmado, pero sin correo en la bóveda' });
      return { ok: false, motivo: m[0] + ': firmado, pero la persona no tiene correo. Revísalo en «Certificados».' };
    }
    enviarCertificado_(p, i, (acts[i.actividad] || {}).nombre || '', m[0], nuevo.getBlob().setName(m[0] + '.pdf'));
    actualizar_('Inscripciones', i._fila, { archivo: nuevo.getId(), firmas: k + 1, estado: 'enviado', enviado: new Date() });
    registrar_(u.email, 'Certificado enviado', m[0]);
    return { ok: true, codigo: m[0], enviado: true };
  });
}

/** Al terminar de subir una tanda: un correo al siguiente firmante con el total pendiente. */
function api_finSubida(token) {
  sesion_(token);
  const firmantes = leerAjuste_('firmantes', []);
  const ins = leer_('Inscripciones');
  firmantes.forEach(function (f, k) {
    const n = ins.filter(function (i) { return i.estado === 'firma' && (Number(i.firmas) || 0) === k; }).length;
    if (k > 0 && n) avisarFirmante_(k, n);
  });
  return true;
}

function api_rehacer(token, codigo) {
  const u = sesion_(token, NIVEL.coordinacion);
  return conCerrojo_(function () {
    const i = leer_('Inscripciones').filter(function (x) { return x.codigo === codigo; })[0];
    if (!i) throw new Error('No existe.');
    if (i.estado === 'enviado') throw new Error('Ya se envió: anúlalo y emite otro.');
    if (i.archivo) { try { DriveApp.getFileById(i.archivo).setTrashed(true); } catch (err) { } }
    actualizar_('Inscripciones', i._fila, { estado: 'validada', codigo: '', archivo: '', firmas: 0,
      notas: ((i.notas ? i.notas + ' · ' : '') + 'Sustituye a ' + codigo) });
    registrar_(u.email, 'Certificado rehecho', codigo);
    return true;
  });
}

function api_anular(token, codigo) {
  const u = sesion_(token, NIVEL.coordinacion);
  return conCerrojo_(function () {
    const i = leer_('Inscripciones').filter(function (x) { return x.codigo === codigo; })[0];
    if (!i) throw new Error('No existe.');
    if (i.archivo && i.estado !== 'enviado') { try { DriveApp.getFileById(i.archivo).setTrashed(true); } catch (err) { } }
    actualizar_('Inscripciones', i._fila, { estado: 'anulado', notas: ((i.notas ? i.notas + ' · ' : '') + 'Anulado el ' + fechaCorta_(new Date())) });
    registrar_(u.email, 'Certificado anulado', codigo);
    return true;
  });
}

function api_reenviar(token, codigo) {
  const u = sesion_(token, NIVEL.coordinacion);
  const i = leer_('Inscripciones').filter(function (x) { return x.codigo === codigo; })[0];
  if (!i || i.estado !== 'enviado' || !i.archivo) throw new Error('Solo se pueden reenviar certificados ya enviados.');
  const p = leerPersonas_()[i.persona];
  if (!p || !p.email) throw new Error('La persona no tiene correo.');
  const a = indice_(leer_('Actividades'), 'id')[i.actividad] || {};
  enviarCertificado_(p, i, a.nombre || '', codigo, DriveApp.getFileById(i.archivo).getBlob().setName(codigo + '.pdf'));
  registrar_(u.email, 'Certificado reenviado', codigo);
  return true;
}

/** Plan B de las descargas: envía por correo a quien lo pide un PDF de prueba. */
function api_enviarmeArchivo(token, base64, nombre) {
  const u = sesion_(token, NIVEL.coordinacion);
  const bytes = Utilities.base64Decode(base64);
  if (bytes.length > 15 * 1024 * 1024) throw new Error('Archivo demasiado grande para enviarlo por correo.');
  enviarEmail_(u.email, 'Archivo de prueba · Certificados de Pastoral', plantillaEmail_({
    titulo: 'Archivo', titular: 'Tu archivo', subtitular: 'Certificados de Pastoral',
    parrafos: ['Hola, ' + esc_(u.nombre) + ':', 'Te enviamos adjunto el archivo que has pedido desde la aplicación.'], cierre: ''
  }), [Utilities.newBlob(bytes, 'application/pdf', limpiarNombre_(nombre) + '.pdf')]);
  return true;
}

/** Plan B para firmantes: un ZIP con sus PDF pendientes, a su propio correo. */
function api_enviarmeZip(token) {
  const u = sesion_(token);
  const ins = leer_('Inscripciones').filter(function (i) { return i.estado === 'firma' && u.firmas.indexOf(Number(i.firmas) || 0) > -1 && i.archivo; });
  if (!ins.length) throw new Error('No tienes certificados pendientes de firma.');
  const blobs = ins.map(function (i) { return DriveApp.getFileById(i.archivo).getBlob(); });
  const zip = Utilities.zip(blobs, 'Certificados para firmar.zip');
  if (zip.getBytes().length > 20 * 1024 * 1024) throw new Error('Son demasiados para un correo: descárgalos desde la pantalla.');
  enviarEmail_(u.email, 'Certificados para firmar (ZIP) · Pastoral C.U. SAFA', plantillaEmail_({
    titulo: 'ZIP', titular: ins.length + ' certificados para firmar', subtitular: 'Certificados de Pastoral',
    parrafos: ['Hola, ' + esc_(u.nombre) + ':', 'Te enviamos adjuntos los certificados que esperan tu firma. Fírmalos con Autofirma y súbelos en la pantalla «Firmar» de la aplicación.'],
    boton: { texto: 'Abrir la aplicación', url: urlApp_() + '#firmar' }, cierre: 'No cambies el nombre de los archivos.'
  }), [zip]);
  registrar_(u.email, 'ZIP enviado por correo', ins.length + ' PDF');
  return ins.length;
}

// ─────────────────────────────── VALORACIONES ───────────────────────────────
function api_valoraciones(token, actId) {
  sesion_(token, NIVEL.coordinacion);
  return leer_('Valoraciones').filter(function (v) { return !actId || v.actividad === actId; }).map(function (v) {
    return { fecha: fechaCorta_(v.fecha), actividad: v.actividad, valor: Number(v.valor) || 0, comentario: v.comentario || '', citable: v.citable === true };
  }).reverse();
}

// ─────────────────────────────── EQUIPO Y AJUSTES ───────────────────────────
function api_equipo(token) {
  sesion_(token, NIVEL.admin);
  return leer_('Equipo').map(function (m) {
    return { email: m.email, nombre: m.nombre, rol: m.rol, rolNombre: (ROLES[m.rol] || {}).nombre || m.rol, activo: m.activo === true };
  });
}

function api_guardarMiembro(token, m) {
  const u = sesion_(token, NIVEL.admin);
  const email = String(m.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Correo no válido.');
  if (!ROLES[m.rol]) throw new Error('Papel no válido.');
  return conCerrojo_(function () {
    const equipo = leer_('Equipo');
    const x = equipo.filter(function (r) { return r.email === email; })[0];
    const propietario = PropertiesService.getScriptProperties().getProperty('PROPIETARIO');
    if (email === propietario && (m.rol !== 'admin' || m.activo === false)) throw new Error('La cuenta propietaria siempre es administradora.');
    const fila = { email: email, nombre: limpiar_(m.nombre || email.split('@')[0]), rol: m.rol, activo: m.activo !== false };
    if (x) actualizar_('Equipo', x._fila, fila); else { fila.alta = new Date(); insertar_('Equipo', fila); }
    registrar_(u.email, x ? 'Miembro modificado' : 'Miembro añadido', email + ' · ' + ROLES[m.rol].nombre + (fila.activo ? '' : ' (desactivado)'));
    if (!x) {
      enviarEmail_(email, 'Te han dado acceso · Certificados de Pastoral', plantillaEmail_({
        titulo: 'Acceso', titular: 'Bienvenido/a', subtitular: 'Certificados de Pastoral · ' + ROLES[m.rol].nombre,
        parrafos: ['Hola, ' + esc_(fila.nombre) + ':', esc_(u.nombre) + ' te ha dado acceso a la aplicación de certificados del Servicio de Pastoral.',
          'Para entrar, abre el enlace y escribe este correo: te llegará un código de 6 cifras.'],
        boton: { texto: 'Entrar', url: urlApp_() }, cierre: 'Gracias por tu ayuda.'
      }));
    }
    return true;
  });
}

function api_ajustes(token) {
  sesion_(token, NIVEL.coordinacion);
  return { firmantes: leerAjuste_('firmantes', []), lugar: CONFIG.LUGAR_POR_DEFECTO, version: VERSION_APP,
    urlApp: urlApp_(), repo: 'https://github.com/' + CONFIG.REPO_GITHUB };
}

function api_guardarFirmantes(token, lista) {
  const u = sesion_(token, NIVEL.admin);
  if (!Array.isArray(lista) || !lista.length) throw new Error('Tiene que haber al menos un firmante.');
  const enFirma = leer_('Inscripciones').some(function (i) { return i.estado === 'firma'; });
  const actuales = leerAjuste_('firmantes', []);
  if (enFirma && lista.length !== actuales.length) throw new Error('Hay certificados a medio firmar: no cambies el número de firmantes hasta que terminen.');
  const limpia = lista.map(function (f) {
    return { cargo: limpiar_(f.cargo), nombre: limpiar_(f.nombre), email: String(f.email || '').trim().toLowerCase() };
  });
  limpia.forEach(function (f) {
    if (!f.cargo || !f.nombre) throw new Error('Cada firmante necesita cargo y nombre.');
    if (f.email && !miembro_(f.email)) throw new Error(f.email + ' no está en el equipo: añádelo primero en «Equipo».');
  });
  guardarAjuste_('firmantes', limpia);
  registrar_(u.email, 'Firmantes actualizados', limpia.map(function (f) { return f.nombre; }).join(' → '));
  return true;
}

function api_registro(token, n) {
  sesion_(token, NIVEL.admin);
  const r = leer_('Registro');
  return r.slice(Math.max(0, r.length - (n || 200))).reverse().map(function (x) {
    return { fecha: Utilities.formatDate(new Date(x.fecha), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'), usuario: x.usuario, accion: x.accion, detalle: x.detalle };
  });
}

/** Al terminar un curso: nombres → iniciales, bóveda sin quien no siga, PDF a la papelera. */
function api_anonimizar(token, curso) {
  const u = sesion_(token, NIVEL.admin);
  if (!/^\d{4}-\d{2}$/.test(curso)) throw new Error('Formato no válido. Ejemplo: 2025-26');
  if (curso >= cursoAcademico_(new Date())) throw new Error('Solo se pueden anonimizar cursos ya terminados.');
  return conCerrojo_(function () {
    const sigue = {};
    let filas = 0, pdfs = 0;
    leer_('Inscripciones').forEach(function (i) {
      if (String(i.curso) > curso) { sigue[i.persona] = true; return; }
      const c = {};
      if (i.nombre && i.nombre !== iniciales_(i.nombre)) { c.nombre = iniciales_(i.nombre); filas++; }
      if (i.archivo) { try { DriveApp.getFileById(i.archivo).setTrashed(true); pdfs++; } catch (err) { } c.archivo = ''; }
      if (Object.keys(c).length) actualizar_('Inscripciones', i._fila, c);
    });
    const sh = libroBoveda_().getSheetByName('Personas');
    const pers = leerBoveda_('Personas');
    let borradas = 0;
    for (let k = pers.length - 1; k >= 0; k--) if (!sigue[pers[k].persona]) { sh.deleteRow(pers[k]._fila); borradas++; }
    const det = 'Curso ' + curso + ' y anteriores · ' + filas + ' nombres → iniciales · ' + borradas + ' personas borradas · ' + pdfs + ' PDF retirados';
    registrar_(u.email, 'Anonimización', det);
    return det;
  });
}

// ─────────────────────────────── PÁGINAS PÚBLICAS ───────────────────────────
function paginaPublica_(tipo, datos) {
  const t = HtmlService.createTemplate(recurso_('Publico'));
  t.tipoJs = jsSeguro_(tipo); t.datosJs = jsSeguro_(datos || {}); t.urlJs = jsSeguro_(urlApp_());
  return t.evaluate().setTitle(tipo === 'inscripcion' ? 'Registro de participación · Pastoral C.U. SAFA' : 'Pastoral · C.U. SAFA')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Actividades abiertas para la página pública (sin datos de nadie). */
function api_publicoActividades() {
  if (!instalado_()) return { actividades: [], privacidad: CONFIG.TEXTO_PRIVACIDAD, roles: CONFIG.ROLES_ACTIVIDAD };
  return {
    actividades: leer_('Actividades').filter(function (a) { return a.abierta === true; })
      .map(function (a) { return { id: a.id, nombre: a.nombre, fechas: a.fechas, tipo: a.tipo }; }),
    privacidad: CONFIG.TEXTO_PRIVACIDAD, roles: CONFIG.ROLES_ACTIVIDAD, servicio: CONFIG.NOMBRE_SERVICIO
  };
}

/**
 * Registro público. Guarda una solicitud pendiente (en la bóveda) y envía un enlace de confirmación.
 * Hasta que la persona no confirma desde su correo, no se crea nada.
 */
function api_publicoInscribir(f) {
  if (!instalado_()) throw new Error('La aplicación aún no está configurada.');
  f = f || {};
  if (f.web) throw new Error('No se ha podido enviar.');                       // campo trampa para robots
  const nombre = capitalizar_(f.nombre), apellidos = capitalizar_(f.apellidos);
  const dni = normalizarDni_(f.dni);
  const email = String(f.email || '').trim().toLowerCase();
  if (!nombre || !apellidos) throw new Error('Escribe tu nombre y apellidos.');
  if (nombre.length > 80 || apellidos.length > 120) throw new Error('Nombre o apellidos demasiado largos.');
  if (!dniValido_(dni)) throw new Error('El DNI/NIE no es válido: revisa el número y la letra.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Escribe un correo válido.');
  if (f.consentimiento !== true || f.consentimiento9 !== true) throw new Error('Necesitamos tus dos consentimientos para expedir el certificado.');
  const abiertas = indice_(leer_('Actividades').filter(function (a) { return a.abierta === true; }), 'id');
  const elegidas = (f.actividades || []).filter(function (x) { return abiertas[x.id] && CONFIG.ROLES_ACTIVIDAD.indexOf(x.rol) > -1; })
    .map(function (x) {
      const v = Number(x.valor);
      return { id: x.id, rol: x.rol, valor: v >= 1 && v <= 5 ? v : null };
    });
  if (!elegidas.length) throw new Error('Marca al menos una actividad.');
  const cache = CacheService.getScriptCache();
  const hora = 'pub_' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHH');
  const nHora = Number(cache.get(hora) || 0);
  if (nHora >= CONFIG.MAX_CORREOS_PUBLICOS_HORA) throw new Error('Ahora mismo hay muchas solicitudes. Inténtalo dentro de un rato.');
  return conCerrojo_(function () {
    const hEmail = huella_(email);
    const hace24 = Date.now() - 24 * 3600 * 1000;
    const pend = leerBoveda_('Pendientes');
    if (pend.filter(function (p) { return p.email === hEmail && new Date(p.creada).getTime() > hace24; }).length >= CONFIG.MAX_INSCRIPCIONES_CORREO_DIA) {
      throw new Error('Has enviado varias solicitudes hoy. Revisa tu correo (también el correo no deseado).');
    }
    const token = bytesAleatorios_().map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join('') + Utilities.getUuid().replace(/-/g, '');
    insertarBoveda_('Pendientes', { token: huella_(token), creada: new Date(),
      expira: new Date(Date.now() + CONFIG.HORAS_ENLACE_CONFIRMACION * 3600 * 1000), email: hEmail,
      datos: JSON.stringify({ nombre: nombre, apellidos: apellidos, dni: dni, email: email, actividades: elegidas,
        comentario: limpiar_(String(f.comentario || '').slice(0, 1500)), citable: f.citable === true }) });
    cache.put(hora, String(nHora + 1), 3700);
    const lista = elegidas.map(function (x) { return '• ' + esc_(abiertas[x.id].nombre) + ' — ' + esc_(x.rol); });
    enviarEmail_(email, 'Confirma tu registro · Pastoral C.U. SAFA', plantillaEmail_({
      titulo: 'Confirma tu registro', titular: 'Confirma tu registro', subtitular: CONFIG.NOMBRE_SERVICIO,
      parrafos: ['Hola, ' + esc_(nombre) + ':', 'Hemos recibido tu registro de participación. Para que sea válido, confírmalo pulsando el botón.'],
      destacado: { icono: '📝', titulo: 'Actividades', lineas: lista },
      boton: { texto: 'Confirmar mi registro', url: urlApp_() + '?p=confirmar&t=' + token },
      cierre: 'El enlace caduca en ' + CONFIG.HORAS_ENLACE_CONFIRMACION + ' horas. Si no has sido tú, ignora este correo.'
    }));
    return { ok: true, email: enmascararEmail_(email) };
  });
}

function paginaConfirmar_(token) {
  let r;
  try { r = confirmar_(token); } catch (err) { r = { ok: false, mensaje: err.message }; }
  return paginaPublica_('confirmar', r);
}

function confirmar_(token) {
  if (!/^[0-9a-f]{40,100}$/.test(token)) return { ok: false, mensaje: 'El enlace no es válido.' };
  return conCerrojo_(function () {
    const pend = leerBoveda_('Pendientes').filter(function (p) { return p.token === huella_(token); })[0];
    if (!pend) return { ok: false, mensaje: 'Este enlace ya se usó o no es válido. Si ya confirmaste, no tienes que hacer nada más.' };
    libroBoveda_().getSheetByName('Pendientes').deleteRow(pend._fila);          // un solo uso
    if (new Date(pend.expira).getTime() < Date.now()) return { ok: false, mensaje: 'El enlace ha caducado. Vuelve a registrarte.' };
    const d = JSON.parse(pend.datos);
    const persona = guardarPersona_(d.dni, d.nombre, d.apellidos, d.email);
    const acts = indice_(leer_('Actividades'), 'id');
    const existentes = leer_('Inscripciones');
    let max = 0;
    existentes.forEach(function (i) { const m = String(i.reg).match(/^R-(\d+)$/); if (m) max = Math.max(max, Number(m[1])); });
    const hechas = [];
    d.actividades.forEach(function (x) {
      const a = acts[x.id];
      if (!a) return;
      if (x.valor) insertar_('Valoraciones', { fecha: new Date(), actividad: x.id, valor: x.valor, comentario: d.comentario || '', citable: d.comentario ? d.citable === true : false });
      if (existentes.some(function (i) { return i.persona === persona.id && i.actividad === x.id; })) { hechas.push(a.nombre + ' (ya estaba registrada)'); return; }
      insertar_('Inscripciones', { reg: 'R-' + String(++max).padStart(5, '0'), fecha: new Date(), curso: a.curso || cursoAcademico_(new Date()),
        persona: persona.id, nombre: persona.nombreCompleto, actividad: x.id, rol: x.rol, estado: 'pendiente', codigo: '', archivo: '',
        firmas: 0, enviado: '', notas: persona.aviso ? '⚠️ ' + persona.aviso : '' });
      hechas.push(a.nombre);
    });
    registrar_('público', 'Registro confirmado', persona.id + ' · ' + hechas.length + ' actividad(es)');
    return { ok: true, nombre: d.nombre, actividades: hechas };
  });
}

/** Busca a la persona por DNI. Nunca sobrescribe el correo ni el nombre de alguien ya registrado. */
function guardarPersona_(dni, nombre, apellidos, email) {
  const pers = leerBoveda_('Personas');
  let max = 0;
  pers.forEach(function (p) { const m = String(p.persona).match(/^P-(\d+)$/); if (m) max = Math.max(max, Number(m[1])); });
  const p = pers.filter(function (x) { return normalizarDni_(x.dni) === dni; })[0];
  if (p) {
    const avisos = [];
    if (String(p.email).toLowerCase() !== email) avisos.push('correo distinto (' + email + ')');
    if (normalizarTexto_(p.nombre + ' ' + p.apellidos) !== normalizarTexto_(nombre + ' ' + apellidos)) avisos.push('nombre distinto (' + nombre + ' ' + apellidos + ')');
    const c = { actualizado: new Date() };
    if (avisos.length) c.avisos = (p.avisos ? p.avisos + '\n' : '') + fechaCorta_(new Date()) + ': ' + avisos.join(', ');
    actualizarBoveda_('Personas', p._fila, c);
    return { id: p.persona, nombreCompleto: p.nombre + ' ' + p.apellidos,
      aviso: avisos.length ? 'mismo DNI con ' + avisos.map(function (a) { return a.split(' (')[0]; }).join(' y ') + ': revísalo' : '' };
  }
  const id = 'P-' + String(max + 1).padStart(4, '0');
  insertarBoveda_('Personas', { persona: id, dni: dni, nombre: limpiar_(nombre), apellidos: limpiar_(apellidos), email: email,
    alta: new Date(), actualizado: new Date(), consentimientos: 'RGPD 6.1.a + 9.2.a · ' + fechaCorta_(new Date()), avisos: '' });
  return { id: id, nombreCompleto: nombre + ' ' + apellidos, aviso: '' };
}

function paginaVerificar_(codigo) {
  codigo = codigo.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40);
  let r = null;
  if (codigo && instalado_()) {
    const i = leer_('Inscripciones').filter(function (x) { return String(x.codigo).toUpperCase() === codigo; })[0];
    if (!i) r = { estado: 'no' };
    else if (i.estado === 'anulado') r = { estado: 'anulado' };
    else if (i.estado !== 'enviado') r = { estado: 'tramite' };
    else {
      const a = indice_(leer_('Actividades'), 'id')[i.actividad] || {};
      r = { estado: 'ok', codigo: codigo, iniciales: iniciales_(i.nombre), actividad: a.nombre || '', fechas: a.fechas || '', rol: i.rol,
        horas: Number(a.horas) || 0, ects: Number(a.ects) || 0, expedido: i.enviado ? fechaLarga_(i.enviado) : '',
        firmantes: leerAjuste_('firmantes', []).map(function (f) { return f.nombre + ' (' + f.cargo + ')'; }) };
    }
  }
  return paginaPublica_('verificar', { codigo: codigo, r: r });
}

// ─────────────────────────────── MANTENIMIENTO ──────────────────────────────
/** Diario: borra solicitudes de registro caducadas (datos personales que nadie confirmó). */
function mantenimientoDiario() {
  if (!instalado_()) return;
  conCerrojo_(function () {
    const sh = libroBoveda_().getSheetByName('Pendientes');
    const pend = leerBoveda_('Pendientes');
    let n = 0;
    for (let k = pend.length - 1; k >= 0; k--) if (new Date(pend[k].expira).getTime() < Date.now()) { sh.deleteRow(pend[k]._fila); n++; }
    if (n) registrar_('automático', 'Limpieza', n + ' solicitud(es) sin confirmar borradas');
  });
}

// ─────────────────────────────── CORREOS ────────────────────────────────────
function enviarCertificado_(p, i, actividad, codigo, adjunto) {
  const rolTexto = { 'Participante': 'tu participación en', 'Organización': 'tu colaboración en la organización de',
    'Coordinación': 'tu labor de coordinación en' }[i.rol] || 'tu participación en';
  enviarEmail_(p.email, 'Tu certificado de Pastoral · C.U. SAFA', plantillaEmail_({
    titulo: 'Tu certificado', titular: 'Tu certificado está listo', subtitular: CONFIG.NOMBRE_SERVICIO,
    parrafos: ['Hola, ' + esc_(p.nombre) + ':',
      'Te enviamos adjunto, firmado electrónicamente, el certificado que acredita ' + rolTexto + ' <strong>«' + esc_(actividad) + '»</strong>.',
      'Gracias por tu tiempo y por tu manera de estar. Ojalá lo vivido te acompañe también en tu camino como docente.'],
    destacado: { icono: '📄', titulo: 'Código de verificación: ' + esc_(codigo),
      lineas: ['Cualquiera puede comprobar su autenticidad en la página de verificación del centro.'] },
    boton: { texto: 'Verificar certificado', url: urlApp_() + '?c=' + encodeURIComponent(codigo) },
    cierre: 'Te recomendamos guardar el PDF en un lugar seguro.'
  }), [adjunto]);
}

function avisarFirmante_(k, n) {
  const f = leerAjuste_('firmantes', [])[k];
  if (!f || !f.email) return;
  enviarEmail_(f.email, 'Certificados pendientes de tu firma · Pastoral C.U. SAFA', plantillaEmail_({
    titulo: 'Certificados para firmar', titular: 'Certificados para firmar', subtitular: 'Firma ' + (k + 1) + ' · ' + esc_(f.cargo),
    parrafos: ['Hola:', 'Tienes <strong>' + n + '</strong> certificado(s) esperando tu firma.'],
    destacado: { icono: '✍️', titulo: 'Cómo firmarlos', lineas: [
      '1. Entra en la aplicación y abre «Firmar».', '2. Pulsa «Descargar todos» (un ZIP con los PDF).',
      '3. Fírmalos con Autofirma, en el hueco de «' + esc_(f.cargo) + '».',
      '4. Arrastra los PDF firmados a la misma pantalla. No cambies el nombre de los archivos.'] },
    boton: { texto: 'Abrir la aplicación', url: urlApp_() + '#firmar' },
    cierre: 'Gracias.'
  }));
}

function plantillaEmail_(o) {
  let filas = '<tr><td style="padding:32px 42px 12px;">' + o.parrafos.map(function (p, i) {
    return '<p style="font-size:16px; line-height:1.7; margin:0 0 ' + (i === o.parrafos.length - 1 ? '0' : '17px') + ';">' + p + '</p>';
  }).join('') + '</td></tr>';
  if (o.destacado) {
    filas += '<tr><td style="padding:22px 42px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eaf5fb; border-radius:11px;"><tr><td style="padding:22px 25px;">' +
      '<div style="font-size:18px; line-height:1.3; font-weight:bold; color:#005b8f; text-align:center;">' + (o.destacado.icono || '') + ' ' + o.destacado.titulo + '</div>' +
      (o.destacado.lineas || []).map(function (l) { return '<div style="font-size:15px; line-height:1.6; color:#465864; margin-top:8px;">' + l + '</div>'; }).join('') +
      '</td></tr></table></td></tr>';
  }
  if (o.boton) {
    filas += '<tr><td align="center" style="padding:10px 42px 14px;"><a href="' + o.boton.url + '" style="display:inline-block; background:#2e7d4f; color:#ffffff; text-decoration:none; font-size:15px; font-weight:bold; padding:12px 26px; border-radius:6px;">' + o.boton.texto + '</a></td></tr>';
  }
  filas += '<tr><td style="padding:10px 42px 26px;">' + (o.cierre ? '<p style="font-size:16px; line-height:1.7; margin:0 0 17px;">' + o.cierre + '</p>' : '') +
    '<p style="font-size:16px; line-height:1.7; margin:0;">Un saludo,<br>' + CONFIG.NOMBRE_SERVICIO + '<br>Centro Universitario «Sagrada Familia»</p></td></tr>';
  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + o.titulo + '</title></head>' +
    '<body style="margin:0; padding:0; background-color:#eef3f7; font-family:Arial, Helvetica, sans-serif; color:#263746;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eef3f7; margin:0; padding:25px 0;"><tr><td align="center">' +
    '<table role="presentation" width="680" cellspacing="0" cellpadding="0" border="0" style="width:680px; max-width:94%; background:#ffffff; border-radius:14px; overflow:hidden;">' +
    '<tr><td style="background:#2e7d4f; height:8px; line-height:8px; font-size:0;">&nbsp;</td></tr><tr><td style="background:#f2c14e; height:3px; line-height:3px; font-size:0;">&nbsp;</td></tr>' +
    '<tr><td align="center" style="padding:26px 25px 6px;"><img src="cid:logo" width="230" alt="Pastoral · Centro Universitario Sagrada Familia" style="display:block; width:230px; max-width:70%; height:auto; margin:0 auto;"></td></tr>' +
    '<tr><td align="center" style="padding:6px 35px 6px;"><div style="font-size:27px; line-height:1.25; font-weight:bold; color:#1f2a33;">' + o.titular + '</div>' +
    '<div style="font-size:15px; line-height:1.5; color:#5d6b75; margin-top:8px;">' + o.subtitular + '</div></td></tr>' + filas +
    '<tr><td align="center" style="background:#f6f8f7; padding:18px 30px; border-top:1px solid #e5ebe7;"><div style="font-size:13px; line-height:1.5; color:#5d6b75;"><strong>Centro Universitario «Sagrada Familia» · Úbeda</strong><br>' +
    CONFIG.DIRECCION_PIE + '<br><em>' + esc_(CONFIG.LEMA) + '</em></div></td></tr>' +
    '<tr><td style="background:#2e7d4f; height:6px; line-height:6px; font-size:0;">&nbsp;</td></tr>' +
    '</table></td></tr></table></body></html>';
}

function enviarEmail_(para, asunto, html, adjuntos) {
  const opciones = { htmlBody: html, name: CONFIG.NOMBRE_REMITENTE };
  try { opciones.inlineImages = { logo: Utilities.newBlob(Utilities.base64Decode(LOGO_CORREO_B64), 'image/png', 'logo.png') }; } catch (err) { }
  if (adjuntos) opciones.attachments = adjuntos;
  const texto = html.replace(/<title>[\s\S]*?<\/title>/i, '').replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)').replace(/<\/(p|div|tr)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  MailApp.sendEmail(para, asunto, texto, opciones);
}

// ─────────────────────────────── DATOS (hojas como tablas) ──────────────────
function libroDatos_() { return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('LIBRO_DATOS')); }
function libroBoveda_() { return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('LIBRO_BOVEDA')); }
function hojaDatos_(t) { return libroDatos_().getSheetByName(t); }

function leerDe_(sh, cab) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, cab.length).getValues().map(function (f, i) {
    const o = { _fila: i + 2 };
    cab.forEach(function (c, j) { o[c] = f[j]; });
    return o;
  }).filter(function (o) { return cab.some(function (c) { return o[c] !== ''; }); });
}
function filaDe_(cab, obj) { return cab.map(function (c) { return obj[c] === undefined ? '' : obj[c]; }); }
function leer_(t) { return leerDe_(hojaDatos_(t), TABLAS[t]); }
function insertar_(t, obj) { const sh = hojaDatos_(t); sh.getRange(sh.getLastRow() + 1, 1, 1, TABLAS[t].length).setValues([filaDe_(TABLAS[t], obj)]); }
function actualizar_(t, fila, cambios) {
  const sh = hojaDatos_(t);
  Object.keys(cambios).forEach(function (c) { const j = TABLAS[t].indexOf(c); if (j > -1) sh.getRange(fila, j + 1).setValue(cambios[c]); });
}
function leerBoveda_(t) { return leerDe_(libroBoveda_().getSheetByName(t), TABLAS_BOVEDA[t]); }
function insertarBoveda_(t, obj) { const sh = libroBoveda_().getSheetByName(t); sh.getRange(sh.getLastRow() + 1, 1, 1, TABLAS_BOVEDA[t].length).setValues([filaDe_(TABLAS_BOVEDA[t], obj)]); }
function actualizarBoveda_(t, fila, cambios) {
  const sh = libroBoveda_().getSheetByName(t);
  Object.keys(cambios).forEach(function (c) { const j = TABLAS_BOVEDA[t].indexOf(c); if (j > -1) sh.getRange(fila, j + 1).setValue(cambios[c]); });
}
function leerPersonas_() {
  const r = {};
  leerBoveda_('Personas').forEach(function (p) {
    r[p.persona] = { id: p.persona, dni: normalizarDni_(p.dni), nombre: String(p.nombre), apellidos: String(p.apellidos), email: String(p.email).trim() };
  });
  return r;
}
function indice_(lista, clave) { const r = {}; lista.forEach(function (x) { r[x[clave]] = x; }); return r; }

function leerAjuste_(clave, porDefecto) {
  const x = leer_('Ajustes').filter(function (a) { return a.clave === clave; })[0];
  if (!x) return porDefecto;
  try { return JSON.parse(x.valor); } catch (err) { return porDefecto; }
}
function guardarAjuste_(clave, valor) {
  const x = leer_('Ajustes').filter(function (a) { return a.clave === clave; })[0];
  if (x) actualizar_('Ajustes', x._fila, { valor: JSON.stringify(valor) }); else insertar_('Ajustes', { clave: clave, valor: JSON.stringify(valor) });
}

function registrar_(usuario, accion, detalle) {
  try { insertar_('Registro', { fecha: new Date(), usuario: usuario || '', accion: accion, detalle: limpiar_(String(detalle || '')) }); }
  catch (err) { Logger.log(accion + ': ' + detalle); }
}

function conCerrojo_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function carpeta_(prop) { return DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty(prop)); }
function enCarpeta_(archivo, prop) {
  const id = PropertiesService.getScriptProperties().getProperty(prop);
  const it = archivo.getParents();
  while (it.hasNext()) if (it.next().getId() === id) return true;
  return false;
}
function obtenerOCrearCarpeta_(padre, nombre) { const it = padre.getFoldersByName(nombre); return it.hasNext() ? it.next() : padre.createFolder(nombre); }

// ─────────────────────────────── UTILIDADES ─────────────────────────────────
function contarFirmas_(blob) { const m = blob.getDataAsString('ISO-8859-1').match(/\/ByteRange\s*\[/g); return m ? m.length : 0; }

function cursoAcademico_(fecha) {
  const d = new Date(fecha);
  const a = d.getMonth() + 1 >= CONFIG.MES_INICIO_CURSO ? d.getFullYear() : d.getFullYear() - 1;
  return a + '-' + String((a + 1) % 100).padStart(2, '0');
}
function normalizarDni_(v) { return String(v || '').toUpperCase().replace(/[\s.\-]/g, ''); }
function dniValido_(dni) {
  const m = String(dni).match(/^([0-9XYZ])(\d{7})([A-Z])$/);
  if (!m) return false;
  return LETRAS_DNI.charAt(Number(({ X: '0', Y: '1', Z: '2' }[m[1]] || m[1]) + m[2]) % 23) === m[3];
}
function enmascararDni_(d) { d = String(d || ''); return d ? '•••••' + d.slice(-4) : ''; }
function enmascararEmail_(e) { e = String(e || ''); const p = e.split('@'); return p.length === 2 ? p[0].slice(0, 2) + '•••@' + p[1] : ''; }
function bytesAleatorios_() { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid() + Date.now()); }
function huella_(t) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(t), Utilities.Charset.UTF_8)
    .map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join('');
}
function nuevoCodigo_(curso, usados) {
  const c = String(curso).replace(/^20(\d\d)-(\d\d)$/, '$1$2');
  for (let k = 0; k < 50; k++) {
    const b = bytesAleatorios_();
    let s = '';
    for (let i = 0; i < 6; i++) s += ALFABETO_CODIGO.charAt((b[i] + 256) % ALFABETO_CODIGO.length);
    const codigo = CONFIG.PREFIJO_CODIGO + '-' + c + '-' + s;
    if (!usados[codigo]) return codigo;
  }
  throw new Error('No se pudo generar un código único');
}
/** Nombre del PDF: código + actividad, sin espacios ni caracteres raros (Autofirma, ZIP y Windows lo agradecen). */
function nombreArchivo_(codigo, actividad) { return codigo + '_' + slug_(actividad).slice(0, 50).replace(/ /g, '-') + '.pdf'; }
function limpiarNombre_(t) { return slug_(t).slice(0, 80) || 'archivo'; }
function capitalizar_(texto) {
  const menores = ['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'van', 'von'];
  return String(texto || '').trim().replace(/\s+/g, ' ').toLowerCase().split(' ').map(function (p, i) {
    if (i > 0 && menores.indexOf(p) > -1) return p;
    return p.split('-').map(function (s) { return s.charAt(0).toUpperCase() + s.slice(1); }).join('-');
  }).join(' ').slice(0, 120);
}
function normalizarTexto_(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function limpiar_(t) { const s = String(t == null ? '' : t).trim().slice(0, 2000); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; }
function iniciales_(nombre) {
  return String(nombre || '').replace(/^'/, '').split(/\s+/)
    .filter(function (p) { return p && ['de', 'del', 'la', 'las', 'los', 'y'].indexOf(p.toLowerCase()) < 0; })
    .map(function (p) { return p.charAt(0).toUpperCase() + '.'; }).join(' ');
}
const MESES_ = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function fechaLarga_(f) { const d = new Date(f); return d.getDate() + ' de ' + MESES_[d.getMonth()] + ' de ' + d.getFullYear(); }
function fechaCorta_(d) { return d ? Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), 'dd/MM/yyyy') : ''; }
function slug_(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, ' ').trim(); }
function escRegex_(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
/** Valor listo para escribirse dentro de <script> sin riesgo de romperlo (ni de inyectar HTML). */
function jsSeguro_(v) { return JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'); }
function esc_(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
