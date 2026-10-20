/**
 * ============================================================================
 *  CERTIFICADOS DE PASTORAL · C.U. «SAGRADA FAMILIA» · ÚBEDA
 *  Servicio de Pastoral y Compromiso Solidario
 *
 *  Formulario (registro + valoración) → validación en la hoja → editor de
 *  diseño con vista previa → PDF → firma 1 → firma 2 (Autofirma) → envío
 *  automático al alumno/a → verificación pública por código.
 *
 *  INSTALAR: hoja nueva > Extensiones > Apps Script > pega este archivo entero
 *  en Código.gs > guarda > ejecuta «instalar». Recarga la hoja.
 *  ACTUALIZAR: ⛪ Certificados > 🔄 Actualizar la app (te da el enlace al archivo nuevo).
 *  Código fuente: https://github.com/agarcia-poz/certificados-pastoral
 * ============================================================================
 */

const VERSION_APP = '2.2.0';

// ─────────────────────────────── CONFIGURACIÓN TÉCNICA ──────────────────────
// Los firmantes, cargos y correos de aviso se cambian en la hoja «Ajustes», no aquí.
const CONFIG = {
  REPO_GITHUB: 'agarcia-poz/certificados-pastoral',   // repositorio público del que se actualiza la app
  RAMA_GITHUB: 'main',
  NOMBRE_SERVICIO: 'Servicio de Pastoral y Compromiso Solidario',
  NOMBRE_REMITENTE: 'Pastoral · C.U. SAFA',
  LEMA: 'Libres para servir',
  // Valores iniciales de la hoja «Ajustes» (solo se usan la primera vez)
  FIRMANTES_INICIALES: [
    ['Servicio de Pastoral y Compromiso Solidario', 'Andrés García Pozas', ''],
    ['Vº Bº Directora Adjunta', 'Consuelo Burgos Bolós', '']
  ],
  ROLES: ['Participante', 'Organización', 'Coordinación'],
  TIPOS_ACTIVIDAD: ['Voluntariado', 'Retiro', 'Jornada', 'Encuentro', 'Celebración', 'Peregrinación', 'Formación', 'Otra'],
  LUGAR_POR_DEFECTO: 'en el Centro Universitario de la Sagrada Familia de Úbeda',
  TITULO_FORMULARIO: 'Pastoral · Registro de participación y valoración',
  SOLO_CUENTAS_DEL_CENTRO: false,      // true solo si el alumnado tiene correo del mismo dominio
  MES_INICIO_CURSO: 9,
  PREFIJO_CODIGO: 'SAFA-PAS',
  COMPROBAR_FIRMAS: true,              // exige que el PDF devuelto contenga la firma electrónica
  NOMBRE_CARPETA_RAIZ: 'Pastoral · Certificados',
  DIRECCION_PIE: 'Av. Cristo Rey, 17 · 23400 Úbeda (Jaén) · Tel. 953 79 61 02',
  // BORRADOR: debe revisarlo el DPD de la Fundación SAFA
  TEXTO_PRIVACIDAD:
    'Responsable: Fundación SAFA (Centro Universitario «Sagrada Familia», Av. Cristo Rey, 17, 23400 Úbeda). ' +
    'Finalidad: registrar tu participación en actividades del Servicio de Pastoral y Compromiso Solidario, ' +
    'expedir y enviarte el certificado firmado y permitir que terceros comprueben su autenticidad mediante un código. ' +
    'Base jurídica: tu consentimiento (art. 6.1.a RGPD) y, por tratarse de actividades de pastoral que pueden ' +
    'revelar convicciones religiosas, tu consentimiento explícito (art. 9.2.a RGPD). ' +
    'Datos: nombre, apellidos, DNI/NIE y correo. El DNI solo aparece en tu certificado. ' +
    'Destinatarios: no se ceden datos a terceros salvo obligación legal. ' +
    'Conservación: los datos de registro se anonimizan al terminar el curso siguiente; se conserva el registro ' +
    'mínimo (código, actividad, iniciales) para poder verificar el certificado. ' +
    'Derechos: acceso, rectificación, supresión, oposición, limitación y portabilidad, y retirar el consentimiento, ' +
    'escribiendo a la dirección de contacto del centro. Puedes reclamar ante la AEPD (www.aepd.es). ' +
    'Las valoraciones y comentarios se guardan de forma anónima, separados de tus datos.'
};

// ─────────────────────────────── ESTRUCTURA ─────────────────────────────────
const HOJA = { INICIO: 'Inicio', ACT: 'Actividades', PART: 'Participaciones', VAL: 'Valoraciones',
  AJUSTES: 'Ajustes', DISENOS: 'Diseños', REG: 'Registro' };

const CAB_ACT = ['ID', 'Actividad', 'Tipo', 'Curso', 'Fechas (tal como saldrán en el certificado)',
  'Lugar (vacío = en el Centro)', 'Horas', 'ECTS', 'Diseño', 'En el formulario',
  'Registros', 'Certificados enviados', 'Valoración media', 'Nº valoraciones'];
const A = { ID: 1, NOMBRE: 2, TIPO: 3, CURSO: 4, FECHAS: 5, LUGAR: 6, HORAS: 7, ECTS: 8, DISENO: 9,
  ABIERTA: 10, N_REG: 11, N_ENV: 12, VAL_MEDIA: 13, N_VAL: 14 };

const CAB_PART = ['Registro', 'Fecha', 'Curso', 'Persona', 'Nombre y apellidos', 'ID actividad', 'Actividad',
  'Rol', '✔ Certificar', 'Estado', 'Código', 'PDF', 'Enviado', 'Notas', '_archivo', '_firmas'];
const P = { REG: 1, FECHA: 2, CURSO: 3, PERSONA: 4, NOMBRE: 5, ACT_ID: 6, ACT: 7, ROL: 8, CERT: 9,
  ESTADO: 10, CODIGO: 11, PDF: 12, ENVIADO: 13, NOTAS: 14, ARCHIVO: 15, FIRMAS: 16 };

const CAB_VAL = ['Fecha', 'ID actividad', 'Actividad', 'Valoración (1-5)', 'Comentario', '¿Citable en el boletín? (anónimo)'];
const CAB_REG = ['Fecha', 'Usuario', 'Acción', 'Detalle'];
const CAB_AJ = ['Orden de firma', 'Cargo (tal como sale en el certificado)', 'Nombre', 'Email (recibe los PDF para firmar)'];
const CAB_DIS = ['ID actividad', 'Actividad', 'Actualizado', 'Diseño (lo escribe el editor; no lo toques)'];

const CAB_PERSONAS = ['Persona', 'DNI/NIE', 'Nombre', 'Apellidos', 'Email', 'Alta', 'Actualizado',
  'Consentimientos', 'Avisos'];
const V = { PERSONA: 1, DNI: 2, NOMBRE: 3, APELLIDOS: 4, EMAIL: 5, ALTA: 6, ACT: 7, CONS: 8, AVISOS: 9 };

const EST = {
  PENDIENTE: 'Pendiente de validar',
  EN_COLA: '⏳ Validado · listo para generar',
  GENERANDO: '🖨️ Generando…',
  ENVIADO: '✅ Enviado al alumno/a',
  ANULADO: '⛔ Anulado',
  REVISAR: '⚠️ Revisar: '
};

const PROP = {
  FORM_ID: 'FORM_ID', ITEMS: 'FORM_ITEMS', MAPA: 'MAPA_ACTIVIDADES', BOVEDA: 'BOVEDA_ID',
  CARPETAS: 'CARPETAS', SS: 'HOJA_ID', PROPIETARIO: 'PROPIETARIO', AVISADOS: 'ARCHIVOS_AVISADOS',
  URL_WEB: 'URL_VERIFICACION'
};

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DISENO_BASE_ID = '_BASE';

// ─────────────────────────────── MENÚ ───────────────────────────────────────
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⛪ Certificados')
    .addItem('🎨 Diseñar y generar certificados', 'abrirEditor')
    .addSeparator()
    .addItem('① Actualizar actividades del formulario', 'actualizarFormulario')
    .addItem('② Revisar firmas y enviar ya', 'revisarFirmasAhora')
    .addSeparator()
    .addItem('Enlaces (formulario, carpetas, verificación)', 'mostrarEnlaces')
    .addItem('Rehacer el certificado de la fila seleccionada', 'rehacerSeleccion')
    .addItem('Anular el certificado de la fila seleccionada', 'anularSeleccion')
    .addSubMenu(ui.createMenu('Privacidad')
      .addItem('Abrir la bóveda (solo propietario)', 'abrirBoveda')
      .addItem('Anonimizar un curso terminado…', 'anonimizarCurso'))
    .addSeparator()
    .addItem('Instalar / reparar', 'instalar')
    .addItem('🔄 Actualizar la app', 'actualizarApp')
    .addItem('Acerca de (versión)', 'acercaDe')
    .addToUi();
  // Tras una actualización, recuerda ejecutar «Instalar / reparar» una vez
  try {
    const instalada = PropertiesService.getScriptProperties().getProperty('VERSION_INSTALADA');
    if (instalada && instalada !== VERSION_APP) {
      SpreadsheetApp.getActive().toast('Versión ' + VERSION_APP + ' descargada. Pulsa ⛪ Certificados > Instalar / reparar para terminar.', 'Certificados', 15);
    }
  } catch (err) { }
}

function acercaDe() { avisar_('Certificados de Pastoral · versión ' + VERSION_APP); }

/** Disparador simple: al marcar «✔ Certificar» se ve el cambio de estado al instante. */
function onEdit(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (sh.getName() !== HOJA.PART) return;
  const c0 = e.range.getColumn(), c1 = e.range.getLastColumn();
  if (P.CERT < c0 || P.CERT > c1) return;
  const f0 = Math.max(2, e.range.getRow()), f1 = e.range.getLastRow();
  if (f1 < f0) return;
  const datos = sh.getRange(f0, 1, f1 - f0 + 1, CAB_PART.length).getValues();
  const estados = datos.map(function (v) {
    if (v[P.CODIGO - 1] || !v[P.REG - 1]) return [v[P.ESTADO - 1]];
    const actual = String(v[P.ESTADO - 1] || '');
    if (v[P.CERT - 1] === true) return [EST.EN_COLA];
    return [actual === EST.EN_COLA ? EST.PENDIENTE : actual];
  });
  sh.getRange(f0, P.ESTADO, estados.length, 1).setValues(estados);
}

// ─────────────────────────────── EDITOR ─────────────────────────────────────
function abrirEditor() {
  if (!esPropietario_()) return;
  const html = (typeof ARCHIVOS_HTML !== 'undefined' ? HtmlService.createTemplate(ARCHIVOS_HTML.Editor) : HtmlService.createTemplateFromFile('Editor')).evaluate()
    .setWidth(1320).setHeight(880).setTitle('Diseñar y generar certificados');
  SpreadsheetApp.getUi().showModalDialog(html, '🎨 Diseñar y generar certificados');
}

/** Las páginas van dentro de este mismo archivo (ARCHIVOS_HTML, al final); si no, se leen como archivos HTML. */
function incluir_(nombre) {
  if (typeof ARCHIVOS_HTML !== 'undefined' && ARCHIVOS_HTML[nombre]) return ARCHIVOS_HTML[nombre];
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}

/** Datos iniciales del editor. */
function api_inicio() {
  exigirPropietario_();
  const cola = colaPorActividad_();
  return {
    version: VERSION_APP,
    actividades: leerActividades_().map(function (a) {
      return { id: a.id, nombre: a.nombre, tipo: a.tipo, curso: a.curso, fechas: a.fechas, lugar: a.lugar,
        horas: a.horas, ects: a.ects, conDiseno: !!leerDisenoGuardado_(a.id), pendientes: cola[a.id] || 0 };
    }),
    firmantes: leerFirmantes_().map(function (f) { return { titulo: f.titulo, nombre: f.nombre }; }),
    roles: CONFIG.ROLES,
    url: urlVerificacion_(),
    lugarPorDefecto: CONFIG.LUGAR_POR_DEFECTO,
    hayBase: !!leerDisenoGuardado_(DISENO_BASE_ID)
  };
}

/** Diseño de una actividad: el suyo, o el diseño base, o vacío (el editor completa con los valores por defecto). */
function api_diseno(actId) {
  exigirPropietario_();
  return leerDisenoGuardado_(actId) || leerDisenoGuardado_(DISENO_BASE_ID) || {};
}

function api_guardarDiseno(actId, diseno, tambienComoBase) {
  exigirPropietario_();
  const texto = JSON.stringify(diseno || {});
  if (texto.length > 45000) throw new Error('El diseño es demasiado grande (¿texto muy largo?).');
  const acts = {};
  leerActividades_().forEach(function (a) { acts[a.id] = a; });
  if (actId !== DISENO_BASE_ID && !acts[actId]) throw new Error('La actividad no existe.');
  guardarDiseno_(actId, actId === DISENO_BASE_ID ? '(diseño base para actividades nuevas)' : acts[actId].nombre, texto);
  if (tambienComoBase) guardarDiseno_(DISENO_BASE_ID, '(diseño base para actividades nuevas)', texto);
  if (acts[actId]) {
    const sh = hoja_(HOJA.ACT);
    const ids = sh.getRange(2, A.ID, Math.max(1, sh.getLastRow() - 1), 1).getValues();
    for (let i = 0; i < ids.length; i++) if (ids[i][0] === actId) sh.getRange(i + 2, A.DISENO).setValue('🎨 Personalizado · ' + fechaCorta_(new Date()));
  }
  registrar_('Diseño guardado', actId + (tambienComoBase ? ' (también como base)' : ''));
  return true;
}

/** Sube una imagen (fondo o logo) ya reducida por el navegador. Devuelve su ID de Drive. */
function api_subirImagen(base64, mime, nombre) {
  exigirPropietario_();
  if (['image/jpeg', 'image/png'].indexOf(mime) < 0) throw new Error('Solo imágenes JPG o PNG.');
  if (base64.length > 12 * 1024 * 1024) throw new Error('La imagen es demasiado grande.');
  const carpeta = obtenerOCrearCarpeta_(carpetaRaiz_(), 'Imágenes de diseño');
  const archivo = carpeta.createFile(Utilities.newBlob(Utilities.base64Decode(base64), mime, limpiarNombre_(nombre)));
  registrar_('Imagen de diseño subida', archivo.getName());
  return archivo.getId();
}

/** Devuelve una imagen de la carpeta de diseño en base64 (solo de esa carpeta). */
function api_imagen(id) {
  exigirPropietario_();
  const archivo = DriveApp.getFileById(id);
  const carpeta = obtenerOCrearCarpeta_(carpetaRaiz_(), 'Imágenes de diseño');
  const padres = archivo.getParents();
  let dentro = false;
  while (padres.hasNext()) if (padres.next().getId() === carpeta.getId()) dentro = true;
  if (!dentro) throw new Error('Esa imagen no pertenece a la carpeta de diseño.');
  const b = archivo.getBlob();
  return { base64: Utilities.base64Encode(b.getBytes()), mime: b.getContentType() };
}

/** Personas validadas pendientes de certificado en una actividad (con DNI: solo propietario). */
function api_cola(actId) {
  exigirPropietario_();
  const sh = hoja_(HOJA.PART);
  if (sh.getLastRow() < 2) return [];
  const personas = leerPersonas_();
  return sh.getRange(2, 1, sh.getLastRow() - 1, CAB_PART.length).getValues()
    .filter(function (v) { return v[P.ACT_ID - 1] === actId && enCola_(v); })
    .map(function (v) {
      const p = personas[v[P.PERSONA - 1]] || {};
      return { reg: v[P.REG - 1], persona: v[P.PERSONA - 1], nombre: p.nombre || '', apellidos: p.apellidos || '',
        dni: p.dni || '', tieneEmail: !!p.email, rol: v[P.ROL - 1], codigo: v[P.CODIGO - 1] || '', notas: v[P.NOTAS - 1] || '' };
    });
}

/** Asigna (o recupera) el código de cada registro antes de dibujar su PDF. */
function api_reservar(regs) {
  exigirPropietario_();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = hoja_(HOJA.PART);
    const datos = sh.getRange(2, 1, sh.getLastRow() - 1, CAB_PART.length).getValues();
    const acts = {};
    leerActividades_().forEach(function (a) { acts[a.id] = a; });
    const usados = {};
    datos.forEach(function (v) { if (v[P.CODIGO - 1]) usados[v[P.CODIGO - 1]] = true; });
    const res = {};
    datos.forEach(function (v, i) {
      if (regs.indexOf(v[P.REG - 1]) < 0 || !enCola_(v)) return;
      let codigo = v[P.CODIGO - 1];
      if (!codigo) {
        const a = acts[v[P.ACT_ID - 1]] || {};
        codigo = nuevoCodigo_(a.curso || v[P.CURSO - 1], usados);
        usados[codigo] = true;
        sh.getRange(i + 2, P.ESTADO, 1, 2).setValues([[EST.GENERANDO, codigo]]);
      }
      res[v[P.REG - 1]] = codigo;
    });
    return res;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Guarda el PDF dibujado en el navegador en «Para firmar» del primer firmante.
 * cambios: correcciones hechas en el editor {nombre, apellidos, dni, rol} (se guardan en la bóveda).
 */
function api_guardarPdf(reg, codigo, base64, cambios) {
  exigirPropietario_();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = hoja_(HOJA.PART);
    const datos = sh.getRange(2, 1, sh.getLastRow() - 1, CAB_PART.length).getValues();
    let i = -1;
    for (let k = 0; k < datos.length; k++) if (datos[k][P.REG - 1] === reg) { i = k; break; }
    if (i < 0) throw new Error('No se encuentra el registro ' + reg);
    const v = datos[i], fila = i + 2;
    if (v[P.CODIGO - 1] !== codigo || v[P.ESTADO - 1] !== EST.GENERANDO) throw new Error('El registro ' + reg + ' ya no está pendiente de generar.');
    const bytes = Utilities.base64Decode(base64);
    if (String.fromCharCode.apply(null, bytes.slice(0, 5).map(function (b) { return (b + 256) % 256; })) !== '%PDF-') throw new Error('El archivo recibido no es un PDF.');

    if (cambios) {
      if (cambios.rol && CONFIG.ROLES.indexOf(cambios.rol) > -1 && cambios.rol !== v[P.ROL - 1]) {
        sh.getRange(fila, P.ROL).setValue(cambios.rol);
        v[P.ROL - 1] = cambios.rol;
      }
      if (cambios.nombre !== undefined || cambios.apellidos !== undefined || cambios.dni !== undefined) {
        const nuevoNombre = corregirPersona_(v[P.PERSONA - 1], cambios);
        if (nuevoNombre) sh.getRange(fila, P.NOMBRE).setValue(limpiar_(nuevoNombre));
      }
    }
    const carpetas = carpetas_();
    const archivo = DriveApp.getFolderById(carpetas.bandeja[0])
      .createFile(Utilities.newBlob(bytes, 'application/pdf', nombreArchivo_(codigo, v[P.ACT - 1])));
    sh.getRange(fila, P.ESTADO, 1, 3).setValues([[estadoFirma_(0), codigo, enlace_(archivo.getUrl(), 'Abrir PDF')]]);
    sh.getRange(fila, P.ARCHIVO, 1, 2).setValues([[archivo.getId(), 0]]);
    registrar_('Certificado generado', codigo + ' · ' + reg + ' · ' + v[P.ACT_ID - 1]);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/** Al terminar una tanda: un solo correo al primer firmante. */
function api_finTanda(n) {
  exigirPropietario_();
  if (n > 0) avisarFirmante_(0, n);
  return true;
}

/** Guarda un PDF de prueba en la carpeta privada «Pruebas de diseño» y devuelve su enlace. */
function api_guardarPrueba(base64, nombre) {
  exigirPropietario_();
  const carpeta = obtenerOCrearCarpeta_(carpetaRaiz_(), 'Pruebas de diseño (privado)');
  const f = carpeta.createFile(Utilities.newBlob(Utilities.base64Decode(base64), 'application/pdf', limpiarNombre_(nombre) + '.pdf'));
  return f.getUrl();
}

function enCola_(v) {
  if (v[P.CERT - 1] !== true || !v[P.REG - 1]) return false;
  if (!v[P.CODIGO - 1]) return v[P.ESTADO - 1] !== EST.ANULADO;
  return v[P.ESTADO - 1] === EST.GENERANDO && !v[P.ARCHIVO - 1];   // tanda interrumpida: se reanuda con el mismo código
}

function colaPorActividad_() {
  const sh = hoja_(HOJA.PART), r = {};
  if (sh.getLastRow() < 2) return r;
  sh.getRange(2, 1, sh.getLastRow() - 1, CAB_PART.length).getValues().forEach(function (v) {
    if (enCola_(v)) r[v[P.ACT_ID - 1]] = (r[v[P.ACT_ID - 1]] || 0) + 1;
  });
  return r;
}

/** Corrige nombre, apellidos o DNI de una persona en la bóveda. Devuelve el nombre completo nuevo. */
function corregirPersona_(personaId, c) {
  const sh = boveda_().getSheetByName('Personas');
  const n = sh.getLastRow() - 1;
  const datos = n > 0 ? sh.getRange(2, 1, n, CAB_PERSONAS.length).getValues() : [];
  for (let i = 0; i < datos.length; i++) {
    if (datos[i][V.PERSONA - 1] !== personaId) continue;
    const fila = i + 2, cambiado = [];
    if (c.dni !== undefined) {
      const dni = normalizarDni_(c.dni);
      if (dni !== normalizarDni_(datos[i][V.DNI - 1])) {
        if (!dniValido_(dni)) throw new Error('El DNI/NIE corregido de ' + personaId + ' no es válido.');
        sh.getRange(fila, V.DNI).setValue(dni); cambiado.push('DNI');
      }
    }
    if (c.nombre !== undefined && limpiar_(capitalizarSuave_(c.nombre)) !== datos[i][V.NOMBRE - 1]) {
      sh.getRange(fila, V.NOMBRE).setValue(limpiar_(capitalizarSuave_(c.nombre))); cambiado.push('nombre');
    }
    if (c.apellidos !== undefined && limpiar_(capitalizarSuave_(c.apellidos)) !== datos[i][V.APELLIDOS - 1]) {
      sh.getRange(fila, V.APELLIDOS).setValue(limpiar_(capitalizarSuave_(c.apellidos))); cambiado.push('apellidos');
    }
    if (cambiado.length) {
      sh.getRange(fila, V.ACT).setValue(new Date());
      registrar_('Datos corregidos', personaId + ' · ' + cambiado.join(', '));
    }
    const v = sh.getRange(fila, 1, 1, CAB_PERSONAS.length).getValues()[0];
    return v[V.NOMBRE - 1] + ' ' + v[V.APELLIDOS - 1];
  }
  throw new Error('No se encuentra a ' + personaId + ' en la bóveda.');
}

function leerDisenoGuardado_(id) {
  const sh = hoja_(HOJA.DISENOS);
  if (!sh || sh.getLastRow() < 2) return null;
  const datos = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
  for (let i = 0; i < datos.length; i++) {
    if (datos[i][0] === id && datos[i][3]) { try { return JSON.parse(datos[i][3]); } catch (err) { return null; } }
  }
  return null;
}

function guardarDiseno_(id, nombre, texto) {
  const sh = hoja_(HOJA.DISENOS);
  const n = sh.getLastRow() - 1;
  const ids = n > 0 ? sh.getRange(2, 1, n, 1).getValues() : [];
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) { sh.getRange(i + 2, 2, 1, 3).setValues([[nombre, new Date(), texto]]); return; }
  }
  sh.getRange(sh.getLastRow() + 1, 1, 1, 4).setValues([[id, nombre, new Date(), texto]]);
}

// ─────────────────────────────── INSTALACIÓN ────────────────────────────────
function instalar() {
  const ss = SpreadsheetApp.getActive();
  const props = PropertiesService.getScriptProperties();
  props.setProperty(PROP.SS, ss.getId());
  if (!props.getProperty(PROP.PROPIETARIO)) props.setProperty(PROP.PROPIETARIO, Session.getEffectiveUser().getEmail());
  else if (!esPropietario_()) return;

  // 1. Hojas de gestión (sin DNI ni correos del alumnado)
  prepararInicio_(ss);
  const shA = prepararHoja_(ss, HOJA.ACT, CAB_ACT, '#006fae');
  if (shA.getLastRow() < 2) {
    shA.getRange(2, A.NOMBRE, 2, 7).setValues([
      ['Actividad de ejemplo (cámbiala)', 'Retiro', cursoAcademico_(new Date()), 'los días 7 y 8 de noviembre de 2026', '', 10, ''],
      ['Voluntariado de ejemplo (cámbialo)', 'Voluntariado', cursoAcademico_(new Date()),
        'durante el primer cuatrimestre del curso 2026-27', 'en distintas entidades sociales de Úbeda', 20, 1]
    ]);
  }
  const filasA = shA.getMaxRows() - 1;
  shA.getRange(2, A.ABIERTA, filasA, 1).insertCheckboxes();
  shA.getRange(2, A.TIPO, filasA, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.TIPOS_ACTIVIDAD, true).setAllowInvalid(true).build());
  shA.getRange(2, A.CURSO, filasA, 1).setNumberFormat('@');
  shA.setColumnWidth(A.NOMBRE, 300); shA.setColumnWidth(A.FECHAS, 280); shA.setColumnWidth(A.LUGAR, 220);
  shA.setColumnWidth(A.DISENO, 190);
  shA.getRange(1, A.DISENO).setBackground('#5b6b76');
  shA.getRange(1, A.N_REG, 1, 4).setBackground('#5b6b76');

  const shP = prepararHoja_(ss, HOJA.PART, CAB_PART, '#006fae');
  const filasP = shP.getMaxRows() - 1;
  shP.getRange(2, P.CURSO, filasP, 1).setNumberFormat('@');
  shP.getRange(2, P.ROL, filasP, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.ROLES, true).setAllowInvalid(false).build());
  shP.getRange(1, P.CERT).setBackground('#0a8f4f');
  shP.getRange(1, P.ESTADO, 1, 4).setBackground('#5b6b76');
  shP.setColumnWidth(P.NOMBRE, 220); shP.setColumnWidth(P.ACT, 240); shP.setColumnWidth(P.ESTADO, 300);
  shP.setColumnWidth(P.CODIGO, 170);
  shP.hideColumns(P.ARCHIVO, 2);
  reglasColor_(shP);
  proteger_(shP.getRange(1, P.REG, shP.getMaxRows(), 7), 'Datos que rellena el formulario');
  proteger_(shP.getRange(1, P.ESTADO, shP.getMaxRows(), 4), 'Columnas que rellena el script');
  proteger_(shP.getRange(1, P.ARCHIVO, shP.getMaxRows(), 2), 'Columnas internas');

  prepararHoja_(ss, HOJA.VAL, CAB_VAL, '#5b6b76').setColumnWidth(5, 420);

  const shAj = prepararHoja_(ss, HOJA.AJUSTES, CAB_AJ, '#006fae');
  if (shAj.getLastRow() < 2) {
    shAj.getRange(2, 1, CONFIG.FIRMANTES_INICIALES.length, 4).setValues(
      CONFIG.FIRMANTES_INICIALES.map(function (f, i) { return [i + 1, f[0], f[1], f[2]]; }));
  }
  shAj.setColumnWidth(2, 340); shAj.setColumnWidth(3, 240); shAj.setColumnWidth(4, 300);
  shAj.getRange('F1:F6').setValues([['NOTAS'],
    ['· Cada fila es un firmante, en el orden en que firman. Puedes añadir o quitar filas.'],
    ['· El cargo y el nombre son los que salen por defecto en los certificados (en el editor se pueden cambiar por actividad).'],
    ['· El email recibe el aviso y acceso a sus carpetas «Para firmar» y «Firmados por…».'],
    ['· Si cambias firmantes, pulsa ⛪ Certificados > Instalar / reparar para crear y compartir sus carpetas.'],
    ['· No cambies los firmantes mientras haya certificados a medio firmar.']]);
  shAj.getRange('F1').setFontWeight('bold').setFontColor('#006fae');

  const shD = prepararHoja_(ss, HOJA.DISENOS, CAB_DIS, '#5b6b76');
  shD.setColumnWidth(4, 500);
  proteger_(shD.getRange(1, 1, shD.getMaxRows(), 4), 'Diseños: los escribe el editor');

  const shR = prepararHoja_(ss, HOJA.REG, CAB_REG, '#5b6b76');
  shR.setColumnWidth(4, 520);
  proteger_(shR.getRange(1, 1, shR.getMaxRows(), 4), 'Registro de actividad: solo lo escribe el script');

  // 2. Bóveda (archivo aparte, sin compartir)
  let boveda = null;
  const idB = props.getProperty(PROP.BOVEDA);
  if (idB) { try { boveda = SpreadsheetApp.openById(idB); } catch (err) { boveda = null; } }
  if (!boveda) {
    boveda = SpreadsheetApp.create('🔒 Pastoral · Bóveda de datos personales (NO COMPARTIR)');
    props.setProperty(PROP.BOVEDA, boveda.getId());
  }
  const shV = prepararHoja_(boveda, 'Personas', CAB_PERSONAS, '#8a1c1c');
  shV.getRange(2, V.DNI, shV.getMaxRows() - 1, 1).setNumberFormat('@');
  const sobrante = boveda.getSheetByName('Hoja 1') || boveda.getSheetByName('Sheet1');
  if (sobrante && boveda.getSheets().length > 1) boveda.deleteSheet(sobrante);
  quitarAccesos_(DriveApp.getFileById(boveda.getId()));

  // 3. Carpetas por firmante: «Para firmar» (coge de aquí) y «Firmados por…» (deja aquí)
  const raiz = obtenerOCrearCarpeta_(DriveApp.getRootFolder(), CONFIG.NOMBRE_CARPETA_RAIZ);
  const firmantes = leerFirmantes_();
  if (!firmantes.length) throw new Error('La hoja «Ajustes» debe tener al menos un firmante.');
  const carpetas = { raiz: raiz.getId(), bandeja: [], entrega: [], archivo: '' };
  const yo = Session.getEffectiveUser().getEmail();
  firmantes.forEach(function (f, i) {
    const n = i + 1;
    const bandeja = obtenerOCrearCarpeta_(raiz, n + 'a. Para firmar · ' + f.nombre);
    const entrega = obtenerOCrearCarpeta_(raiz, n + 'b. Firmados por ' + f.nombre + ' (déjalos aquí)');
    carpetas.bandeja.push(bandeja.getId());
    carpetas.entrega.push(entrega.getId());
    if (f.email && f.email !== yo) {
      try { bandeja.addViewer(f.email); entrega.addEditor(f.email); }
      catch (err) { registrar_('Aviso', 'No se pudo compartir la carpeta con el firmante ' + n + ': ' + err); }
    }
  });
  carpetas.archivo = obtenerOCrearCarpeta_(raiz, '9. Archivo de certificados enviados (privado)').getId();
  props.setProperty(PROP.CARPETAS, JSON.stringify(carpetas));

  // 4. Formulario (sin hoja de respuestas)
  let form = null;
  const idF = props.getProperty(PROP.FORM_ID);
  if (idF) { try { form = FormApp.openById(idF); } catch (err) { form = null; } }
  if (!form) form = crearFormulario_();

  // 5. Activadores
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['alEnviarFormulario', 'tareaPeriodica'].indexOf(t.getHandlerFunction()) > -1) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('alEnviarFormulario').forForm(form).onFormSubmit().create();
  ScriptApp.newTrigger('tareaPeriodica').timeBased().everyMinutes(15).create();

  // 6. URL de verificación (si ya se ha publicado como aplicación web)
  try { const url = ScriptApp.getService().getUrl(); if (url) props.setProperty(PROP.URL_WEB, url); } catch (err) { }

  actualizarFormulario(true);
  const avisos = [];
  firmantes.forEach(function (f, i) { if (!f.email) avisos.push('• Falta el email del firmante ' + (i + 1) + ' en la hoja «Ajustes».'); });
  props.setProperty('VERSION_INSTALADA', VERSION_APP);
  registrar_('Instalación', 'Versión ' + VERSION_APP);
  avisar_('✅ Instalación completada (versión ' + VERSION_APP + ').\n\n' +
    'Formulario para el alumnado:\n' + form.getPublishedUrl() + '\n\n' +
    'Carpetas de firma: ' + raiz.getUrl() + '\n\n' +
    (props.getProperty(PROP.URL_WEB) ? 'Verificación pública: ' + props.getProperty(PROP.URL_WEB) + '\n\n'
      : 'Verificación pública: aún no publicada (opcional, ver la guía).\n\n') +
    (avisos.length ? 'Pendiente:\n' + avisos.join('\n') + '\n\n' : '') +
    'Recarga la hoja para ver el menú «⛪ Certificados».');
}

function prepararInicio_(ss) {
  const sh = ss.getSheetByName(HOJA.INICIO) || ss.insertSheet(HOJA.INICIO, 0);
  sh.clear();
  const filas = [
    ['⛪ Certificados de Pastoral · C.U. «Sagrada Familia»'],
    [''],
    ['CÓMO SE USA'],
    ['1. Actividades: escribe cada actividad (nombre, fechas tal como saldrán en el certificado, horas, ECTS si los tiene).'],
    ['   Marca «En el formulario» las que el alumnado puede elegir y pulsa ⛪ Certificados > ① Actualizar actividades del formulario.'],
    ['2. Comparte el enlace del formulario con el alumnado (⛪ Certificados > Enlaces). Ahí se registran y valoran la actividad.'],
    ['3. Participaciones: comprueba el rol y marca «✔ Certificar» a quien corresponda (selecciona varias casillas y pulsa la barra espaciadora).'],
    ['4. ⛪ Certificados > 🎨 Diseñar y generar: elige la actividad, ajusta diseño y textos (con vista previa) y pulsa «Generar».'],
    ['5. Firmas: cada firmante recibe un correo, firma con Autofirma y sube los PDF a su carpeta «Firmados por…».'],
    ['   El sistema los pasa al siguiente firmante y, al final, los envía al alumno/a (revisión cada 15 minutos).'],
    ['6. La columna «Estado» dice en qué punto está cada certificado. Si pone ⚠️ Revisar, lee el motivo.'],
    [''],
    ['AJUSTES'],
    ['· Firmantes, cargos y emails: hoja «Ajustes». Diseños por actividad: los guarda el editor en la hoja «Diseños».'],
    [''],
    ['PRIVACIDAD'],
    ['· En esta hoja no hay DNI ni correos del alumnado: están en la bóveda (archivo aparte que solo abre la cuenta propietaria).'],
    ['· Las valoraciones son anónimas. No compartas esta hoja fuera del equipo de Pastoral.'],
    ['· Al acabar cada curso: ⛪ Certificados > Privacidad > Anonimizar un curso terminado.']
  ];
  sh.getRange(1, 1, filas.length, 1).setValues(filas);
  sh.getRange(1, 1).setFontSize(16).setFontWeight('bold').setFontColor('#005b8f');
  [3, 13, 16].forEach(function (f) { sh.getRange(f, 1).setFontWeight('bold').setFontColor('#006fae'); });
  sh.setColumnWidth(1, 980);
  sh.setHiddenGridlines(true);
}

function crearFormulario_() {
  const form = FormApp.create(CONFIG.TITULO_FORMULARIO);
  const props = PropertiesService.getScriptProperties();
  form.setDescription('Centro Universitario «Sagrada Familia» · ' + CONFIG.NOMBRE_SERVICIO + '\n\n' +
    'Registra aquí las actividades de Pastoral en las que has participado, organizado o coordinado, ' +
    'y cuéntanos qué te han aportado. Con este registro preparamos tu certificado, que te llegará firmado por correo.');
  form.setAllowResponseEdits(false);
  form.setPublishingSummary(false);
  form.setShowLinkToRespondAgain(true);
  form.setConfirmationMessage('¡Gracias! Te hemos enviado un correo de confirmación. ' +
    'Cuando el certificado esté firmado te llegará a este mismo correo.');
  try { form.setEmailCollectionType(FormApp.EmailCollectionType.VERIFIED); }
  catch (err) { form.setCollectEmail(true); }
  if (CONFIG.SOLO_CUENTAS_DEL_CENTRO) { try { form.setRequireLogin(true); } catch (err) { } }

  const nombre = form.addTextItem().setTitle('Nombre').setRequired(true);
  const apellidos = form.addTextItem().setTitle('Apellidos').setRequired(true);
  const dni = form.addTextItem().setTitle('DNI / NIE')
    .setHelpText('Aparecerá en tu certificado. Con letra y sin espacios, por ejemplo 12345678Z.')
    .setRequired(true)
    .setValidation(FormApp.createTextValidation()
      .requireTextMatchesPattern('^ *[0-9XYZxyz][ .-]?[0-9]{2}[ .]?[0-9]{3}[ .]?[0-9]{2}[ -]?[A-Za-z] *$')
      .setHelpText('Escribe un DNI o NIE con su letra, por ejemplo 12345678Z').build());
  const roles = form.addGridItem().setTitle('¿En qué actividades has estado y cómo?')
    .setHelpText('Marca solo las actividades en las que has estado. Deja en blanco el resto.')
    .setRows(['(sin actividades)']).setColumns(CONFIG.ROLES);
  const valor = form.addGridItem().setTitle('Valora esas actividades')
    .setHelpText('1 = me ha aportado poco · 5 = me ha aportado mucho. Es anónimo.')
    .setRows(['(sin actividades)']).setColumns(['1', '2', '3', '4', '5']);
  const comentario = form.addParagraphTextItem().setTitle('¿Qué te ha aportado? (opcional y anónimo)')
    .setHelpText('Una frase, una experiencia, algo que te llevas…');
  const citar = form.addCheckboxItem().setTitle('Boletín de Pastoral (opcional)')
    .setChoiceValues(['Podéis citar mi comentario en el boletín, siempre sin mi nombre']);
  form.addSectionHeaderItem().setTitle('Protección de datos').setHelpText(CONFIG.TEXTO_PRIVACIDAD);
  const c1 = form.addCheckboxItem().setTitle('Información y tratamiento de datos').setRequired(true)
    .setChoiceValues(['He leído la información sobre protección de datos y acepto el tratamiento de mis datos ' +
      'para gestionar y expedir mi certificado.']);
  const c2 = form.addCheckboxItem().setTitle('Consentimiento explícito').setRequired(true)
    .setChoiceValues(['Consiento expresamente que se trate la información sobre mi participación en actividades del ' +
      'Servicio de Pastoral, que podría revelar convicciones religiosas (art. 9.2.a RGPD).']);

  props.setProperty(PROP.FORM_ID, form.getId());
  props.setProperty(PROP.ITEMS, JSON.stringify({
    nombre: nombre.getId(), apellidos: apellidos.getId(), dni: dni.getId(), roles: roles.getId(),
    valor: valor.getId(), comentario: comentario.getId(), citar: citar.getId(), c1: c1.getId(), c2: c2.getId()
  }));
  return form;
}

// ─────────────────────────────── ACTIVIDADES Y FORMULARIO ───────────────────
function actualizarFormulario(silencioso) {
  silencioso = silencioso === true;
  asignarIdsActividades_(hoja_(HOJA.ACT));
  const abiertas = leerActividades_().filter(function (a) { return a.abierta && a.nombre; });
  const form = obtenerFormulario_();
  const items = JSON.parse(PropertiesService.getScriptProperties().getProperty(PROP.ITEMS));
  const cuenta = {};
  abiertas.forEach(function (a) { cuenta[a.nombre] = (cuenta[a.nombre] || 0) + 1; });
  const mapa = {};
  const filas = abiertas.map(function (a) {
    const etiqueta = cuenta[a.nombre] > 1 ? a.nombre + ' · ' + a.fechas : a.nombre;
    mapa[etiqueta] = a.id;
    return etiqueta;
  });
  const visibles = filas.length ? filas : ['(ahora mismo no hay actividades abiertas)'];
  form.getItemById(items.roles).asGridItem().setRows(visibles);
  form.getItemById(items.valor).asGridItem().setRows(visibles);
  form.setAcceptingResponses(filas.length > 0);
  if (!filas.length) form.setCustomClosedFormMessage('Ahora mismo no hay actividades abiertas para registrarse.');
  const anterior = JSON.parse(PropertiesService.getScriptProperties().getProperty(PROP.MAPA) || '{}');
  Object.keys(anterior).forEach(function (k) { if (!mapa[k]) mapa[k] = anterior[k]; });
  PropertiesService.getScriptProperties().setProperty(PROP.MAPA, JSON.stringify(mapa));
  registrar_('Formulario actualizado', filas.length + ' actividad(es) abiertas');
  if (!silencioso) avisar_(filas.length
    ? 'Formulario actualizado. Actividades abiertas:\n\n• ' + filas.join('\n• ')
    : 'No hay actividades marcadas «En el formulario». El formulario queda cerrado hasta que marques alguna.');
}

function asignarIdsActividades_(sh) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return;
  const datos = sh.getRange(2, 1, n, CAB_ACT.length).getValues();
  let max = 0;
  datos.forEach(function (f) { const m = String(f[A.ID - 1]).match(/^A-(\d+)$/); if (m) max = Math.max(max, Number(m[1])); });
  datos.forEach(function (f, i) {
    if (!String(f[A.NOMBRE - 1]).trim()) return;
    const fila = i + 2;
    let id = f[A.ID - 1];
    if (!id) { id = 'A-' + String(++max).padStart(3, '0'); sh.getRange(fila, A.ID).setValue(id); }
    if (!f[A.CURSO - 1]) sh.getRange(fila, A.CURSO).setValue(cursoAcademico_(new Date()));
    if (!f[A.DISENO - 1]) sh.getRange(fila, A.DISENO).setValue('Base');
    const r = 'A' + fila;
    sh.getRange(fila, A.N_REG, 1, 4).setFormulas([[
      '=COUNTIF(' + HOJA.PART + '!F:F,' + r + ')',
      '=COUNTIFS(' + HOJA.PART + '!F:F,' + r + ',' + HOJA.PART + '!J:J,"' + EST.ENVIADO + '")',
      '=IFERROR(ROUND(AVERAGEIF(' + HOJA.VAL + '!B:B,' + r + ',' + HOJA.VAL + '!D:D),1),"")',
      '=COUNTIF(' + HOJA.VAL + '!B:B,' + r + ')'
    ]]);
  });
}

function leerActividades_() {
  const sh = hoja_(HOJA.ACT);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, CAB_ACT.length).getValues()
    .filter(function (f) { return f[A.ID - 1] && String(f[A.NOMBRE - 1]).trim(); })
    .map(function (f) {
      return {
        id: String(f[A.ID - 1]), nombre: String(f[A.NOMBRE - 1]).trim(), tipo: String(f[A.TIPO - 1] || ''),
        curso: String(f[A.CURSO - 1] || ''), fechas: String(f[A.FECHAS - 1] || '').trim(),
        lugar: String(f[A.LUGAR - 1] || '').trim(), horas: Number(f[A.HORAS - 1]) || 0,
        ects: Number(String(f[A.ECTS - 1]).replace(',', '.')) || 0, abierta: f[A.ABIERTA - 1] === true
      };
    });
}

function leerFirmantes_() {
  const sh = hoja_(HOJA.AJUSTES);
  if (!sh || sh.getLastRow() < 2) {
    return CONFIG.FIRMANTES_INICIALES.map(function (f) { return { titulo: f[0], nombre: f[1], email: f[2] }; });
  }
  return sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues()
    .filter(function (f) { return String(f[2]).trim(); })
    .sort(function (a, b) { return (Number(a[0]) || 99) - (Number(b[0]) || 99); })
    .map(function (f) { return { titulo: String(f[1]).trim(), nombre: String(f[2]).trim(), email: String(f[3]).trim().toLowerCase() }; });
}

// ─────────────────────────────── RESPUESTA DEL FORMULARIO ───────────────────
function alEnviarFormulario(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    const items = JSON.parse(props.getProperty(PROP.ITEMS));
    const mapa = JSON.parse(props.getProperty(PROP.MAPA) || '{}');
    const r = {};
    e.response.getItemResponses().forEach(function (ir) { r[ir.getItem().getId()] = ir.getResponse(); });

    const email = String(e.response.getRespondentEmail() || '').trim().toLowerCase();
    const nombre = capitalizar_(r[items.nombre]);
    const apellidos = capitalizar_(r[items.apellidos]);
    const dni = normalizarDni_(r[items.dni]);
    const fecha = e.response.getTimestamp();
    const filasForm = obtenerFormulario_().getItemById(items.roles).asGridItem().getRows();
    const rolesResp = r[items.roles] || [];
    const valorResp = r[items.valor] || [];
    const comentario = limpiar_(r[items.comentario] || '');
    const citable = (r[items.citar] || []).length > 0 ? 'Sí' : 'No';

    const elegidas = [], valoraciones = [];
    filasForm.forEach(function (etiqueta, i) {
      if (rolesResp[i] && mapa[etiqueta]) elegidas.push({ id: mapa[etiqueta], rol: rolesResp[i] });
      if (valorResp[i] && mapa[etiqueta]) valoraciones.push({ id: mapa[etiqueta], valor: Number(valorResp[i]) });
    });

    const borrar = function () {
      try { obtenerFormulario_().deleteResponse(e.response.getId()); }
      catch (err) { registrar_('Aviso', 'No se pudo borrar una respuesta del formulario: ' + err); }
    };

    if (!email) { registrar_('Registro descartado', 'Respuesta sin correo verificado'); borrar(); return; }
    if (!dniValido_(dni)) {
      enviarEmail_(email, 'Revisa tu registro · Pastoral C.U. SAFA', plantillaEmail_({
        titulo: 'Revisa tu DNI/NIE', titular: 'Revisa tu DNI/NIE', subtitular: 'Registro de participación',
        parrafos: ['Hola, ' + esc_(nombre) + ':',
          'No hemos podido guardar tu registro porque el DNI/NIE que escribiste no es válido (la letra no coincide con el número).',
          'Por favor, vuelve a rellenar el formulario con el DNI/NIE correcto. Lo necesitamos para tu certificado.'],
        boton: { texto: 'Volver al formulario', url: obtenerFormulario_().getPublishedUrl() },
        cierre: 'Gracias.'
      }));
      registrar_('Registro rechazado', 'DNI/NIE no válido (se ha pedido al alumno/a que lo repita)');
      borrar();
      return;
    }

    const acts = {};
    leerActividades_().forEach(function (a) { acts[a.id] = a; });
    const persona = guardarPersona_(dni, nombre, apellidos, email, fecha);

    const shP = hoja_(HOJA.PART);
    const existentes = shP.getLastRow() > 1 ? shP.getRange(2, 1, shP.getLastRow() - 1, P.ACT_ID).getValues() : [];
    let maxReg = 0;
    existentes.forEach(function (f) { const m = String(f[P.REG - 1]).match(/^R-(\d+)$/); if (m) maxReg = Math.max(maxReg, Number(m[1])); });
    const nuevas = [], resumen = [];
    elegidas.forEach(function (el) {
      const a = acts[el.id];
      if (!a) return;
      const repetida = existentes.some(function (f) { return f[P.PERSONA - 1] === persona.id && f[P.ACT_ID - 1] === el.id; });
      if (repetida) { resumen.push({ act: a.nombre, rol: el.rol, repetida: true }); return; }
      nuevas.push(['R-' + String(++maxReg).padStart(5, '0'), fecha, a.curso || cursoAcademico_(fecha), persona.id,
        limpiar_(persona.nombreCompleto), a.id, a.nombre, el.rol, false,
        EST.PENDIENTE, '', '', '', persona.aviso ? '⚠️ ' + persona.aviso : '', '', 0]);
      resumen.push({ act: a.nombre, rol: el.rol });
    });
    if (nuevas.length) {
      const fila = shP.getLastRow() + 1;
      shP.getRange(fila, 1, nuevas.length, CAB_PART.length).setValues(nuevas);
      shP.getRange(fila, P.CERT, nuevas.length, 1).insertCheckboxes();
    }

    if (valoraciones.length) {
      const shV = hoja_(HOJA.VAL);
      const filasV = valoraciones.map(function (v) {
        const a = acts[v.id] || { nombre: '' };
        return [fecha, v.id, a.nombre, v.valor, comentario, comentario ? citable : ''];
      });
      shV.getRange(shV.getLastRow() + 1, 1, filasV.length, CAB_VAL.length).setValues(filasV);
    }

    const lineas = resumen.length
      ? resumen.map(function (x) { return '• ' + esc_(x.act) + ' — ' + esc_(x.rol) + (x.repetida ? ' (ya estaba registrada)' : ''); })
      : ['No marcaste ninguna actividad. Si querías registrarte, vuelve a rellenar el formulario.'];
    enviarEmail_(persona.email, 'Hemos recibido tu registro · Pastoral C.U. SAFA', plantillaEmail_({
      titulo: 'Registro recibido', titular: 'Registro recibido', subtitular: CONFIG.NOMBRE_SERVICIO,
      parrafos: ['Hola, ' + esc_(nombre) + ':', 'Gracias por registrar tu participación. Hemos anotado lo siguiente:'],
      destacado: { icono: '📝', titulo: 'Tus actividades', lineas: lineas },
      cierre: 'El equipo de Pastoral revisará el registro y, cuando tu certificado esté firmado, te llegará a este correo.'
    }));
    registrar_('Registro recibido', persona.id + ' · ' + nuevas.length + ' participación(es) · ' + valoraciones.length + ' valoración(es)');
    borrar();
  } finally {
    lock.releaseLock();
  }
}

/** Busca a la persona por DNI en la bóveda. Nunca sobrescribe el correo ni el nombre de alguien ya registrado. */
function guardarPersona_(dni, nombre, apellidos, email, fecha) {
  const sh = boveda_().getSheetByName('Personas');
  const n = sh.getLastRow() - 1;
  const datos = n > 0 ? sh.getRange(2, 1, n, CAB_PERSONAS.length).getValues() : [];
  let max = 0;
  for (let i = 0; i < datos.length; i++) {
    const m = String(datos[i][V.PERSONA - 1]).match(/^P-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  for (let i = 0; i < datos.length; i++) {
    if (normalizarDni_(datos[i][V.DNI - 1]) !== dni) continue;
    const fila = i + 2, avisos = [];
    if (String(datos[i][V.EMAIL - 1]).toLowerCase() !== email) avisos.push('correo distinto (' + email + ')');
    const guardado = normalizarTexto_(datos[i][V.NOMBRE - 1] + ' ' + datos[i][V.APELLIDOS - 1]);
    if (guardado !== normalizarTexto_(nombre + ' ' + apellidos)) avisos.push('nombre distinto (' + nombre + ' ' + apellidos + ')');
    sh.getRange(fila, V.ACT).setValue(fecha);
    if (avisos.length) {
      const previo = String(datos[i][V.AVISOS - 1] || '');
      sh.getRange(fila, V.AVISOS).setValue((previo ? previo + '\n' : '') + fechaCorta_(fecha) + ': ' + avisos.join(', '));
    }
    return { id: datos[i][V.PERSONA - 1], email: String(datos[i][V.EMAIL - 1]), dni: dni,
      nombreCompleto: datos[i][V.NOMBRE - 1] + ' ' + datos[i][V.APELLIDOS - 1],
      aviso: avisos.length ? 'mismo DNI con ' + avisos.map(function (a) { return a.split(' (')[0]; }).join(' y ') + ' (ver bóveda)' : '' };
  }
  const id = 'P-' + String(max + 1).padStart(4, '0');
  sh.getRange(sh.getLastRow() + 1, 1, 1, CAB_PERSONAS.length).setValues([[id, dni, limpiar_(nombre), limpiar_(apellidos),
    email, fecha, fecha, 'RGPD 6.1.a + 9.2.a · ' + fechaCorta_(fecha), '']]);
  return { id: id, email: email, dni: dni, nombreCompleto: nombre + ' ' + apellidos, aviso: '' };
}

// ─────────────────────────────── CIRCUITO DE FIRMAS ─────────────────────────
function tareaPeriodica() { revisarFirmas_(); }

function revisarFirmasAhora() {
  if (!esPropietario_()) return;
  const r = revisarFirmas_();
  avisar_('Revisión de firmas hecha.\n\n' +
    'Pasados al siguiente firmante: ' + r.avanzados + '\nEnviados al alumnado: ' + r.enviados +
    (r.problemas ? '\nPara revisar: ' + r.problemas + ' (mira la columna Estado o la hoja Registro)' : ''));
}

/**
 * Recorre las carpetas «Firmados por…». Por cada PDF lee el CÓDIGO del nombre, comprueba que le tocaba
 * a ese firmante y que contiene su firma, y lo pasa al siguiente o, si era el último, lo envía al alumno/a.
 */
function revisarFirmas_() {
  const res = { avanzados: 0, enviados: 0, problemas: 0 };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return res;
  try {
    const sh = hoja_(HOJA.PART);
    if (sh.getLastRow() < 2) return res;
    const datos = sh.getRange(2, 1, sh.getLastRow() - 1, CAB_PART.length).getValues();
    const porCodigo = {};
    datos.forEach(function (v, i) { if (v[P.CODIGO - 1]) porCodigo[String(v[P.CODIGO - 1]).toUpperCase()] = i; });
    const carpetas = carpetas_();
    const firmantes = leerFirmantes_();
    const props = PropertiesService.getScriptProperties();
    const avisados = JSON.parse(props.getProperty(PROP.AVISADOS) || '{}');
    const nFirm = carpetas.entrega.length;
    const nuevosPorFirmante = {};
    const patron = new RegExp(escRegex_(CONFIG.PREFIJO_CODIGO) + '-\\d{4}-[' + ALFABETO_CODIGO + ']{6}');
    let personas = null;

    for (let k = 0; k < nFirm; k++) {
      const archivos = DriveApp.getFolderById(carpetas.entrega[k]).getFiles();
      while (archivos.hasNext()) {
        const archivo = archivos.next();
        if (archivo.getMimeType() !== MimeType.PDF) continue;
        const id = archivo.getId();
        const m = archivo.getName().toUpperCase().match(patron);
        const i = m ? porCodigo[m[0]] : undefined;
        const avisarUnaVez = function (motivo) {
          if (avisados[id]) return;
          avisados[id] = true;
          res.problemas++;
          registrar_('Archivo no procesado', '«' + archivo.getName() + '» en la carpeta del firmante ' + (k + 1) + ': ' + motivo);
        };
        if (i === undefined) { avisarUnaVez('no lleva un código de certificado conocido en el nombre (no lo renombres)'); continue; }
        const v = datos[i], fila = i + 2;
        const firmas = Number(v[P.FIRMAS - 1]) || 0;
        if (v[P.ESTADO - 1] === EST.ANULADO) { avisarUnaVez('el certificado ' + m[0] + ' está anulado'); quitarSeguro_(archivo); continue; }
        if (firmas > k) { quitarSeguro_(archivo); continue; }
        if (firmas < k || !v[P.ARCHIVO - 1]) { avisarUnaVez('aún le falta la firma n.º ' + (firmas + 1)); continue; }

        const blob = archivo.getBlob();
        if (CONFIG.COMPROBAR_FIRMAS && contarFirmas_(blob) < k + 1) {
          if (!avisados[id]) {
            sh.getRange(fila, P.ESTADO).setValue(EST.REVISAR + 'el PDF subido a «Firmados por ' + (firmantes[k] || {}).nombre +
              '» no contiene la firma electrónica. Fírmalo con Autofirma y súbelo de nuevo.');
          }
          avisarUnaVez('el PDF no contiene la firma electrónica n.º ' + (k + 1));
          continue;
        }

        const codigo = String(v[P.CODIGO - 1]);
        const nombre = nombreArchivo_(codigo, v[P.ACT - 1]);
        if (k < nFirm - 1) {
          if (v[P.ARCHIVO - 1]) { try { DriveApp.getFileById(v[P.ARCHIVO - 1]).setTrashed(true); } catch (err) { } }
          const copia = DriveApp.getFolderById(carpetas.bandeja[k + 1]).createFile(blob.copyBlob().setName(nombre));
          sh.getRange(fila, P.ESTADO, 1, 3).setValues([[estadoFirma_(k + 1), codigo, enlace_(copia.getUrl(), 'Abrir PDF')]]);
          sh.getRange(fila, P.ARCHIVO, 1, 2).setValues([[copia.getId(), k + 1]]);
          v[P.FIRMAS - 1] = k + 1;
          nuevosPorFirmante[k + 1] = (nuevosPorFirmante[k + 1] || 0) + 1;
          registrar_('Firma ' + (k + 1) + '/' + nFirm, codigo);
          res.avanzados++;
        } else {
          personas = personas || leerPersonas_();
          const pers = personas[v[P.PERSONA - 1]];
          if (!pers || !pers.email) { avisarUnaVez('no se encuentra el correo de la persona en la bóveda'); continue; }
          try {
            enviarCertificado_(pers, v, codigo, blob.copyBlob().setName(codigo + '.pdf'));
          } catch (err) {
            avisarUnaVez('no se pudo enviar el correo (' + err + '); se reintentará');
            delete avisados[id];
            continue;
          }
          if (v[P.ARCHIVO - 1]) { try { DriveApp.getFileById(v[P.ARCHIVO - 1]).setTrashed(true); } catch (err) { } }
          const final = DriveApp.getFolderById(carpetas.archivo).createFile(blob.copyBlob().setName(nombre));
          sh.getRange(fila, P.ESTADO, 1, 4).setValues([[EST.ENVIADO, codigo, enlace_(final.getUrl(), 'Abrir PDF'), new Date()]]);
          sh.getRange(fila, P.ARCHIVO, 1, 2).setValues([[final.getId(), nFirm]]);
          v[P.FIRMAS - 1] = nFirm;
          SpreadsheetApp.flush();
          registrar_('Certificado enviado', codigo + ' · ' + v[P.REG - 1]);
          res.enviados++;
        }
        quitarSeguro_(archivo);
      }
    }
    props.setProperty(PROP.AVISADOS, JSON.stringify(avisados));
    Object.keys(nuevosPorFirmante).forEach(function (k) { avisarFirmante_(Number(k), nuevosPorFirmante[k]); });
    if (res.problemas) avisarCoordinacion_(res.problemas + ' archivo(s) de las carpetas de firma no se han podido procesar. Detalle en la hoja «Registro».');
  } finally {
    lock.releaseLock();
  }
  return res;
}

/** Cuenta las firmas electrónicas incrustadas en un PDF (cada firma PAdES lleva un /ByteRange). */
function contarFirmas_(blob) {
  const m = blob.getDataAsString('ISO-8859-1').match(/\/ByteRange\s*\[/g);
  return m ? m.length : 0;
}

function estadoFirma_(hechas) {
  const f = leerFirmantes_();
  return '✍️ Firma ' + (hechas + 1) + ' de ' + f.length + ' pendiente · ' + (f[hechas] || {}).nombre;
}

function enviarCertificado_(pers, v, codigo, adjunto) {
  const url = urlVerificacion_();
  const rolTexto = { 'Participante': 'tu participación en', 'Organización': 'tu colaboración en la organización de',
    'Coordinación': 'tu labor de coordinación en' }[v[P.ROL - 1]] || 'tu participación en';
  enviarEmail_(pers.email, 'Tu certificado de Pastoral · C.U. SAFA', plantillaEmail_({
    titulo: 'Tu certificado', titular: 'Tu certificado está listo', subtitular: CONFIG.NOMBRE_SERVICIO,
    parrafos: ['Hola, ' + esc_(pers.nombre) + ':',
      'Te enviamos adjunto, firmado electrónicamente, el certificado que acredita ' + rolTexto +
      ' <strong>«' + esc_(v[P.ACT - 1]) + '»</strong>.',
      'Gracias por tu tiempo y por tu manera de estar. Ojalá lo vivido te acompañe también en tu camino como docente.'],
    destacado: { icono: '📄', titulo: 'Código de verificación: ' + esc_(codigo),
      lineas: [url ? 'Cualquiera puede comprobar su autenticidad en la página de verificación del centro.' : 'Guárdalo junto a tu certificado.'] },
    boton: url ? { texto: 'Verificar certificado', url: url + '?c=' + encodeURIComponent(codigo) } : null,
    cierre: 'Te recomendamos guardar el PDF en un lugar seguro.'
  }), [adjunto]);
}

function avisarFirmante_(k, nuevos) {
  const f = leerFirmantes_()[k];
  if (!f || !f.email) return;
  const carpetas = carpetas_();
  const bandeja = DriveApp.getFolderById(carpetas.bandeja[k]);
  const entrega = DriveApp.getFolderById(carpetas.entrega[k]);
  let total = 0;
  const it = bandeja.getFilesByType(MimeType.PDF);
  while (it.hasNext()) { it.next(); total++; }
  enviarEmail_(f.email, 'Certificados pendientes de tu firma · Pastoral C.U. SAFA', plantillaEmail_({
    titulo: 'Certificados para firmar', titular: 'Certificados para firmar',
    subtitular: 'Firma ' + (k + 1) + ' de ' + carpetas.bandeja.length + ' · ' + esc_(f.titulo),
    parrafos: ['Hola:', 'Hay <strong>' + nuevos + '</strong> certificado(s) nuevo(s) esperando tu firma (' + total + ' en total en tu carpeta).'],
    destacado: { icono: '✍️', titulo: 'Cómo firmarlos', lineas: [
      '1. Abre «Para firmar» y descarga los PDF (puedes seleccionarlos todos).',
      '2. Fírmalos con Autofirma, en el hueco de firma de «' + esc_(f.titulo) + '».',
      '3. Sube los PDF firmados a «Firmados por ' + esc_(f.nombre) + '». No cambies el código del nombre del archivo.',
      'El sistema hará el resto en un máximo de 15 minutos.'] },
    boton: { texto: 'Abrir «Para firmar»', url: bandeja.getUrl() },
    cierre: 'Carpeta donde dejar los firmados: <a href="' + entrega.getUrl() + '">Firmados por ' + esc_(f.nombre) + '</a>.'
  }));
}

function avisarCoordinacion_(texto) {
  const destino = PropertiesService.getScriptProperties().getProperty(PROP.PROPIETARIO);
  if (!destino) return;
  enviarEmail_(destino, 'Certificados de Pastoral: hay algo que revisar', plantillaEmail_({
    titulo: 'Revisar', titular: 'Hay algo que revisar', subtitular: 'Certificados de Pastoral',
    parrafos: [esc_(texto)],
    boton: { texto: 'Abrir la hoja de gestión', url: SpreadsheetApp.openById(idHoja_()).getUrl() },
    cierre: 'Busca las filas marcadas con ⚠️ en la columna «Estado».'
  }));
}

// ─────────────────────────────── REHACER / ANULAR ───────────────────────────
function rehacerSeleccion() { cambiarSeleccion_('rehacer'); }
function anularSeleccion() { cambiarSeleccion_('anular'); }

function cambiarSeleccion_(modo) {
  if (!esPropietario_()) return;
  const ui = SpreadsheetApp.getUi();
  const sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== HOJA.PART) { avisar_('Selecciona una fila de la hoja «Participaciones».'); return; }
  const fila = sh.getActiveRange().getRow();
  if (fila < 2) return;
  const v = sh.getRange(fila, 1, 1, CAB_PART.length).getValues()[0];
  if (!v[P.CODIGO - 1]) { avisar_('Esa fila aún no tiene certificado generado.'); return; }
  if (v[P.ESTADO - 1] === EST.ENVIADO && modo === 'rehacer') {
    avisar_('Ese certificado ya se envió. Si tiene un error, anúlalo y emite uno nuevo.');
    return;
  }
  const pregunta = modo === 'rehacer'
    ? '¿Rehacer el certificado ' + v[P.CODIGO - 1] + '?\n\nSe retirará el PDF actual (aunque esté a medio firmar) y la fila volverá a «listo para generar», con un código nuevo.'
    : '¿Anular el certificado ' + v[P.CODIGO - 1] + '?\n\nLa página de verificación dirá que está anulado.';
  if (ui.alert(pregunta, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  if (v[P.ARCHIVO - 1] && v[P.ESTADO - 1] !== EST.ENVIADO) {
    try { DriveApp.getFileById(v[P.ARCHIVO - 1]).setTrashed(true); } catch (err) { }
  }
  const notas = String(v[P.NOTAS - 1] || '');
  if (modo === 'rehacer') {
    sh.getRange(fila, P.CERT).setValue(true);
    sh.getRange(fila, P.ESTADO, 1, 3).setValues([[EST.EN_COLA, '', '']]);
    sh.getRange(fila, P.NOTAS).setValue((notas ? notas + ' · ' : '') + 'Sustituye a ' + v[P.CODIGO - 1]);
    sh.getRange(fila, P.ARCHIVO, 1, 2).setValues([['', 0]]);
  } else {
    sh.getRange(fila, P.ESTADO).setValue(EST.ANULADO);
    sh.getRange(fila, P.NOTAS).setValue((notas ? notas + ' · ' : '') + 'Anulado el ' + fechaCorta_(new Date()));
  }
  registrar_(modo === 'rehacer' ? 'Certificado rehecho' : 'Certificado anulado', v[P.CODIGO - 1]);
  toast_('Hecho.');
}

// ─────────────────────────────── VERIFICACIÓN PÚBLICA ───────────────────────
/** Página pública: ?c=CÓDIGO. Nunca muestra DNI, correo ni nombre completo. */
function doGet(e) {
  const codigo = String((e && e.parameter && e.parameter.c) || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40);
  let cuerpo;
  if (!codigo) {
    cuerpo = '<p>Escribe el código que aparece al pie del certificado.</p>';
  } else {
    const r = buscarCertificado_(codigo);
    if (!r) cuerpo = '<div class="caja mal"><b>No existe ningún certificado con el código ' + esc_(codigo) + '.</b><br>Revisa que esté bien escrito.</div>';
    else if (r.estado === EST.ANULADO) cuerpo = '<div class="caja mal"><b>Este certificado fue anulado</b> y no tiene validez.</div>';
    else if (r.estado !== EST.ENVIADO) cuerpo = '<div class="caja aviso"><b>Este certificado está en proceso de firma</b> y todavía no se ha expedido.</div>';
    else {
      cuerpo = '<div class="caja bien"><b>✅ Certificado auténtico</b></div><table>' +
        '<tr><th>Código</th><td>' + esc_(codigo) + '</td></tr>' +
        '<tr><th>Titular</th><td>' + esc_(r.iniciales) + ' <span class="peq">(solo iniciales, por privacidad)</span></td></tr>' +
        '<tr><th>Actividad</th><td>' + esc_(r.actividad) + '</td></tr>' +
        '<tr><th>Fechas</th><td>' + esc_(r.fechas) + '</td></tr>' +
        '<tr><th>Condición</th><td>' + esc_(r.rol) + '</td></tr>' +
        (r.horas ? '<tr><th>Duración</th><td>' + formatoNum_(r.horas) + ' horas</td></tr>' : '') +
        (r.ects ? '<tr><th>ECTS</th><td>' + formatoNum_(r.ects) + '</td></tr>' : '') +
        '<tr><th>Expedido</th><td>' + esc_(r.enviado) + '</td></tr>' +
        '<tr><th>Firmado por</th><td>' + leerFirmantes_().map(function (f) { return esc_(f.nombre) + ' <span class="peq">(' + esc_(f.titulo) + ')</span>'; }).join('<br>') + '</td></tr>' +
        '</table>';
    }
  }
  const html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<style>body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#eef3f7;color:#263746}' +
    '.cab{background:#2a6096;color:#fff;padding:28px 20px;text-align:center}.cab h1{margin:0;font-size:22px}.cab p{margin:6px 0 0;color:#dceff8}' +
    '.main{max-width:620px;margin:24px auto;background:#fff;border-radius:12px;padding:24px 22px}' +
    'form{display:flex;gap:8px;margin-bottom:18px}input{flex:1;padding:11px;font-size:16px;border:1px solid #b7c9d4;border-radius:6px;text-transform:uppercase}' +
    'button{background:#2a6096;color:#fff;border:0;border-radius:6px;padding:0 18px;font-size:15px;font-weight:bold;cursor:pointer}' +
    '.caja{padding:14px 16px;border-radius:8px;margin-bottom:14px;line-height:1.5}.bien{background:#e3f4ea;color:#0b5d33}.mal{background:#fbe7e7;color:#8a1c1c}.aviso{background:#fff4dc;color:#7a5200}' +
    'table{width:100%;border-collapse:collapse;font-size:15px}th{text-align:left;color:#5b6b76;font-weight:normal;padding:8px 10px 8px 0;vertical-align:top;width:120px}td{padding:8px 0;border-bottom:1px solid #e3ebf0}' +
    '.peq{color:#8a99a3;font-size:12px}.pie{text-align:center;font-size:12px;color:#5b6b76;padding:10px 16px 30px}</style>' +
    '<title>Verificación de certificados · Pastoral C.U. SAFA</title></head><body>' +
    '<div class="cab"><h1>Verificación de certificados</h1><p>' + esc_(CONFIG.NOMBRE_SERVICIO) + ' · C.U. «Sagrada Familia» · Úbeda</p></div>' +
    '<div class="main"><form method="get" action="' + esc_(urlVerificacion_() || '') + '" target="_top"><input name="c" placeholder="' + esc_(CONFIG.PREFIJO_CODIGO) + '-2627-XXXXXX" value="' + esc_(codigo) + '"><button>Comprobar</button></form>' +
    cuerpo + '</div><div class="pie">Centro Universitario «Sagrada Familia» · ' + esc_(CONFIG.DIRECCION_PIE) + '</div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('Verificación de certificados · Pastoral C.U. SAFA')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function buscarCertificado_(codigo) {
  const ss = SpreadsheetApp.openById(idHoja_());
  const sh = ss.getSheetByName(HOJA.PART);
  if (sh.getLastRow() < 2) return null;
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, CAB_PART.length).getValues()
    .filter(function (f) { return String(f[P.CODIGO - 1]).toUpperCase() === codigo; })[0];
  if (!v) return null;
  const a = leerActividades_().filter(function (x) { return x.id === v[P.ACT_ID - 1]; })[0] || {};
  return {
    estado: v[P.ESTADO - 1], actividad: v[P.ACT - 1], rol: v[P.ROL - 1], iniciales: iniciales_(v[P.NOMBRE - 1]),
    fechas: a.fechas || '', horas: a.horas || 0, ects: a.ects || 0,
    enviado: v[P.ENVIADO - 1] instanceof Date ? fechaLarga_(v[P.ENVIADO - 1]) : ''
  };
}

// ─────────────────────────────── PRIVACIDAD ─────────────────────────────────
function abrirBoveda() {
  if (!esPropietario_()) return;
  avisar_('Bóveda de datos personales (no la compartas):\n\n' + boveda_().getUrl() +
    '\n\nTambién puedes corregir nombre, apellidos y DNI desde el editor (pestaña «Generar»).');
}

function anonimizarCurso() {
  if (!esPropietario_()) return;
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Anonimizar un curso terminado',
    'Escribe el curso (por ejemplo 2025-26).\n\n' +
    '· En «Participaciones» el nombre se sustituye por las iniciales (la verificación sigue funcionando).\n' +
    '· En la bóveda se borran las personas que no tengan participaciones en cursos posteriores.\n' +
    '· Los PDF de ese curso (llevan DNI) se envían a la papelera de Drive.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const curso = r.getResponseText().trim();
  if (!/^\d{4}-\d{2}$/.test(curso)) { avisar_('Formato no válido. Ejemplo: 2025-26'); return; }
  if (curso >= cursoAcademico_(new Date())) { avisar_('Solo se pueden anonimizar cursos ya terminados.'); return; }
  if (ui.alert('¿Seguro? Esta acción no se puede deshacer.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = hoja_(HOJA.PART);
    const n = sh.getLastRow() - 1;
    const datos = n > 0 ? sh.getRange(2, 1, n, CAB_PART.length).getValues() : [];
    const sigue = {};
    let filas = 0, pdfs = 0;
    datos.forEach(function (v, i) {
      if (String(v[P.CURSO - 1]) > curso) { sigue[v[P.PERSONA - 1]] = true; return; }
      const nombre = String(v[P.NOMBRE - 1]);
      if (nombre && nombre !== iniciales_(nombre)) { sh.getRange(i + 2, P.NOMBRE).setValue(iniciales_(nombre)); filas++; }
      if (v[P.ARCHIVO - 1]) {
        try { DriveApp.getFileById(v[P.ARCHIVO - 1]).setTrashed(true); pdfs++; } catch (err) { }
        sh.getRange(i + 2, P.PDF).setValue('(retirado)');
        sh.getRange(i + 2, P.ARCHIVO).setValue('');
      }
    });
    const shV = boveda_().getSheetByName('Personas');
    const nv = shV.getLastRow() - 1;
    let borradas = 0;
    if (nv > 0) {
      const pers = shV.getRange(2, 1, nv, 1).getValues();
      for (let i = pers.length - 1; i >= 0; i--) if (!sigue[pers[i][0]]) { shV.deleteRow(i + 2); borradas++; }
    }
    registrar_('Anonimización', 'Curso ' + curso + ' y anteriores · ' + filas + ' nombres → iniciales · ' + borradas + ' personas borradas de la bóveda · ' + pdfs + ' PDF retirados');
    avisar_('Hecho.\n\nNombres sustituidos por iniciales: ' + filas + '\nPersonas borradas de la bóveda: ' + borradas + '\nPDF retirados: ' + pdfs);
  } finally {
    lock.releaseLock();
  }
}

// ─────────────────────────────── ENLACES ────────────────────────────────────
function mostrarEnlaces() {
  const form = obtenerFormulario_();
  const url = urlVerificacion_();
  avisar_('Formulario para el alumnado:\n' + form.getPublishedUrl() +
    '\n\nEditar el formulario:\n' + form.getEditUrl() +
    '\n\nCarpetas de firma:\n' + carpetaRaiz_().getUrl() +
    '\n\nVerificación pública:\n' + (url || '(no publicada todavía: ver la guía)'));
}

// ─────────────────────────────── ACTUALIZACIÓN DESDE GITHUB ─────────────────
/** Dirección del archivo único de la app en GitHub (lo que se copia y pega para instalar o actualizar). */
function urlArchivoApp_() {
  return 'https://raw.githubusercontent.com/' + CONFIG.REPO_GITHUB + '/' + CONFIG.RAMA_GITHUB + '/dist/CertificadosPastoral.gs';
}

/** Comprueba si hay versión nueva en GitHub y explica cómo ponerla (copiar y pegar un archivo). */
function actualizarApp() {
  if (!esPropietario_()) return;
  let info;
  try {
    const res = UrlFetchApp.fetch('https://raw.githubusercontent.com/' + CONFIG.REPO_GITHUB + '/' + CONFIG.RAMA_GITHUB +
      '/dist/version.json?t=' + Date.now(), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error('GitHub respondió ' + res.getResponseCode());
    info = JSON.parse(res.getContentText('UTF-8'));
  } catch (err) { avisar_('No se pudo consultar GitHub.\n\n' + err.message); return; }
  if (compararVersiones_(info.version, VERSION_APP) <= 0) { avisar_('Ya tienes la última versión (' + VERSION_APP + ').'); return; }
  const editor = 'https://script.google.com/home/projects/' + ScriptApp.getScriptId() + '/edit';
  const html = '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#1f2a33">' +
    '<p>Tienes la versión <b>' + esc_(VERSION_APP) + '</b>. Hay disponible la <b>' + esc_(info.version) + '</b> (' + esc_(info.fecha) + ').</p>' +
    (info.novedades ? '<p style="background:#eaf2f9;padding:10px 12px;border-radius:8px;white-space:pre-line">' + esc_(info.novedades) + '</p>' : '') +
    '<ol style="padding-left:20px">' +
    '<li><a href="' + urlArchivoApp_() + '" target="_blank">Abre el archivo nuevo</a>, pulsa <b>Ctrl/Cmd + A</b> y <b>Ctrl/Cmd + C</b>.</li>' +
    '<li><a href="' + editor + '" target="_blank">Abre Apps Script</a>, entra en <b>CertificadosPastoral.gs</b> (o Código.gs), selecciona todo y pega. Guarda (💾).</li>' +
    '<li>Vuelve aquí, recarga la hoja y pulsa ⛪ Certificados &gt; <b>Instalar / reparar</b>.</li></ol>' +
    '<p style="color:#5d6b75;font-size:12.5px">Solo cambia el código: tus hojas, la bóveda, las carpetas y los diseños se quedan como están.</p></div>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(520).setHeight(420), '🔄 Versión nueva disponible');
}

function compararVersiones_(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); }
  return 0;
}

// ─────────────────────────────── PLANTILLA DE EMAIL ─────────────────────────
function plantillaEmail_(o) {
  let filas = '<tr><td style="padding:32px 42px 12px;">' + o.parrafos.map(function (p, i) {
    return '<p style="font-size:16px; line-height:1.7; margin:0 0 ' + (i === o.parrafos.length - 1 ? '0' : '17px') + ';">' + p + '</p>';
  }).join('') + '</td></tr>';
  if (o.destacado) {
    filas += '<tr><td style="padding:22px 42px;">' +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eaf5fb; border-radius:11px;"><tr><td style="padding:22px 25px;">' +
      '<div style="font-size:18px; line-height:1.3; font-weight:bold; color:#005b8f; text-align:center;">' + (o.destacado.icono || '') + ' ' + o.destacado.titulo + '</div>' +
      (o.destacado.lineas || []).map(function (l) {
        return '<div style="font-size:15px; line-height:1.6; color:#465864; margin-top:8px;">' + l + '</div>';
      }).join('') + '</td></tr></table></td></tr>';
  }
  if (o.boton) {
    filas += '<tr><td align="center" style="padding:10px 42px 14px;">' +
      '<a href="' + o.boton.url + '" style="display:inline-block; background:#006fae; color:#ffffff; text-decoration:none; font-size:15px; font-weight:bold; padding:12px 26px; border-radius:6px;">' +
      o.boton.texto + '</a></td></tr>';
  }
  filas += '<tr><td style="padding:10px 42px 26px;">' +
    (o.cierre ? '<p style="font-size:16px; line-height:1.7; margin:0 0 17px;">' + o.cierre + '</p>' : '') +
    '<p style="font-size:16px; line-height:1.7; margin:0;">Un saludo,<br>' + CONFIG.NOMBRE_SERVICIO + '<br>Centro Universitario «Sagrada Familia»</p>' +
    '</td></tr>';
  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + o.titulo + '</title></head>' +
    '<body style="margin:0; padding:0; background-color:#eef3f7; font-family:Arial, Helvetica, sans-serif; color:#263746;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eef3f7; margin:0; padding:25px 0;">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="680" cellspacing="0" cellpadding="0" border="0" style="width:680px; max-width:94%; background:#ffffff; border-radius:14px; overflow:hidden;">' +
    '<tr><td align="center" style="background:#006fae; padding:30px 25px 25px;">' +
    '<img src="cid:logo" width="200" alt="SAFA Centro Universitario Sagrada Familia" style="display:block; width:200px; max-width:60%; height:auto; margin:0 auto;">' +
    '</td></tr>' +
    '<tr><td align="center" style="background:#006fae; padding:0 35px 32px;">' +
    '<div style="font-size:27px; line-height:1.25; font-weight:bold; color:#ffffff;">' + o.titular + '</div>' +
    '<div style="font-size:16px; line-height:1.5; color:#dceff8; margin-top:9px;">' + o.subtitular + '</div>' +
    '</td></tr>' + filas +
    '<tr><td align="center" style="background:#006fae; padding:24px 30px;">' +
    '<div style="font-size:17px; line-height:1.5; font-weight:bold; color:#ffffff;">Pastoral y Compromiso Solidario · C.U. SAFA</div>' +
    '<div style="font-size:15px; color:#dceff8; margin-top:10px;">' + esc_(CONFIG.LEMA) + '</div>' +
    '</td></tr>' +
    '<tr><td align="center" style="background:#005b8f; padding:15px 25px;">' +
    '<div style="font-size:12.5px; line-height:1.5; color:#ffffff;"><strong>Centro Universitario «Sagrada Familia» · Úbeda</strong><br>' +
    CONFIG.DIRECCION_PIE + '</div></td></tr>' +
    '</table></td></tr></table></body></html>';
}

// ─────────────────────────────── UTILIDADES ─────────────────────────────────
function enviarEmail_(para, asunto, html, adjuntos) {
  const opciones = { htmlBody: html, name: CONFIG.NOMBRE_REMITENTE };
  try { opciones.inlineImages = { logo: Utilities.newBlob(Utilities.base64Decode(LOGO_CORREO_B64), 'image/png', 'logo.png') }; } catch (err) { }
  if (adjuntos) opciones.attachments = adjuntos;
  const textoPlano = html.replace(/<title>[\s\S]*?<\/title>/i, '').replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<\/(p|div|tr)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  MailApp.sendEmail(para, asunto, textoPlano, opciones);
}

function cursoAcademico_(fecha) {
  const d = new Date(fecha);
  const a = d.getMonth() + 1 >= CONFIG.MES_INICIO_CURSO ? d.getFullYear() : d.getFullYear() - 1;
  return a + '-' + String((a + 1) % 100).padStart(2, '0');
}

function normalizarDni_(v) { return String(v || '').toUpperCase().replace(/[\s.\-]/g, ''); }

function dniValido_(dni) {
  const m = String(dni).match(/^([0-9XYZ])(\d{7})([A-Z])$/);
  if (!m) return false;
  const num = Number(({ X: '0', Y: '1', Z: '2' }[m[1]] || m[1]) + m[2]);
  return LETRAS_DNI.charAt(num % 23) === m[3];
}

function nuevoCodigo_(curso, existentes) {
  const c = String(curso).replace(/^20(\d\d)-(\d\d)$/, '$1$2');
  for (let intento = 0; intento < 50; intento++) {
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Date.now() + intento);
    let s = '';
    for (let i = 0; i < 6; i++) s += ALFABETO_CODIGO.charAt((bytes[i] + 256) % ALFABETO_CODIGO.length);
    const codigo = CONFIG.PREFIJO_CODIGO + '-' + c + '-' + s;
    if (!existentes[codigo]) return codigo;
  }
  throw new Error('No se pudo generar un código único');
}

function nombreArchivo_(codigo, actividad) { return codigo + ' · ' + slug_(actividad).slice(0, 60) + '.pdf'; }
function limpiarNombre_(t) { return slug_(t).slice(0, 80) || 'archivo'; }

function capitalizar_(texto) {
  const menores = ['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'van', 'von'];
  return String(texto || '').trim().replace(/\s+/g, ' ').toLowerCase().split(' ')
    .map(function (p, i) {
      if (i > 0 && menores.indexOf(p) > -1) return p;
      return p.split('-').map(function (s) { return s.charAt(0).toUpperCase() + s.slice(1); }).join('-');
    }).join(' ');
}
/** Para correcciones manuales: respeta lo que escribe la coordinación (solo quita espacios sobrantes). */
function capitalizarSuave_(t) { return String(t || '').trim().replace(/\s+/g, ' '); }

function normalizarTexto_(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Evita que un texto escrito en el formulario se interprete como fórmula en la hoja. */
function limpiar_(t) {
  const s = String(t == null ? '' : t).trim().slice(0, 2000);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function iniciales_(nombre) {
  return String(nombre || '').replace(/^'/, '').split(/\s+/)
    .filter(function (p) { return p && ['de', 'del', 'la', 'las', 'los', 'y'].indexOf(p.toLowerCase()) < 0; })
    .map(function (p) { return p.charAt(0).toUpperCase() + '.'; }).join(' ');
}

const MESES_ = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
  'octubre', 'noviembre', 'diciembre'];
function fechaLarga_(f) { const d = new Date(f); return d.getDate() + ' de ' + MESES_[d.getMonth()] + ' de ' + d.getFullYear(); }
function fechaCorta_(d) { return Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), 'dd/MM/yyyy'); }
function formatoNum_(n) { return String(Math.round(Number(n) * 100) / 100).replace('.', ','); }
function slug_(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, ' ').trim(); }
function escRegex_(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function esc_(t) {
  return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function enlace_(url, texto) { return '=HYPERLINK("' + url + '","' + texto + '")'; }

function leerPersonas_() {
  const sh = boveda_().getSheetByName('Personas'), r = {};
  if (sh.getLastRow() < 2) return r;
  sh.getRange(2, 1, sh.getLastRow() - 1, CAB_PERSONAS.length).getValues().forEach(function (f) {
    r[f[V.PERSONA - 1]] = { id: f[V.PERSONA - 1], dni: normalizarDni_(f[V.DNI - 1]), nombre: String(f[V.NOMBRE - 1]),
      apellidos: String(f[V.APELLIDOS - 1]), email: String(f[V.EMAIL - 1]).trim() };
  });
  return r;
}

function esPropietario_() {
  const propietario = PropertiesService.getScriptProperties().getProperty(PROP.PROPIETARIO);
  const yo = Session.getActiveUser().getEmail();
  if (!propietario || !yo || yo === propietario) return true;
  avisar_('Esta acción solo la puede hacer la cuenta propietaria (' + propietario + ').');
  return false;
}

/** Para las funciones que llama el editor: nunca se confía en el navegador. */
function exigirPropietario_() {
  const propietario = PropertiesService.getScriptProperties().getProperty(PROP.PROPIETARIO);
  const yo = Session.getActiveUser().getEmail();
  if (!propietario || !yo || yo !== propietario) throw new Error('SIN_PERMISO: solo la cuenta propietaria puede usar el editor.');
}

function quitarAccesos_(archivo) {
  try {
    archivo.getEditors().forEach(function (u) { if (u.getEmail() !== Session.getEffectiveUser().getEmail()) archivo.removeEditor(u); });
    archivo.getViewers().forEach(function (u) { archivo.removeViewer(u); });
    archivo.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  } catch (err) { }
}

function quitarSeguro_(archivo) {
  try { archivo.setTrashed(true); } catch (err) { /* lo subió otra persona: se ignora en las próximas pasadas */ }
}

function boveda_() { return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty(PROP.BOVEDA)); }
function carpetas_() { return JSON.parse(PropertiesService.getScriptProperties().getProperty(PROP.CARPETAS)); }
function carpetaRaiz_() {
  const c = carpetas_();
  if (c.raiz) return DriveApp.getFolderById(c.raiz);
  return DriveApp.getFolderById(c.bandeja[0]).getParents().next();
}
function idHoja_() { return PropertiesService.getScriptProperties().getProperty(PROP.SS) || SpreadsheetApp.getActive().getId(); }
function urlVerificacion_() { return PropertiesService.getScriptProperties().getProperty(PROP.URL_WEB) || ''; }
function hoja_(nombre) { return SpreadsheetApp.openById(idHoja_()).getSheetByName(nombre); }

function obtenerFormulario_() {
  const id = PropertiesService.getScriptProperties().getProperty(PROP.FORM_ID);
  if (!id) throw new Error('Falta instalar: ejecuta «Instalar / reparar».');
  return FormApp.openById(id);
}

function prepararHoja_(ss, nombre, cabecera, color) {
  const sh = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
  sh.getRange(1, 1, 1, cabecera.length).setValues([cabecera])
    .setFontWeight('bold').setBackground(color || '#006fae').setFontColor('#ffffff').setWrap(true).setVerticalAlignment('middle');
  sh.setFrozenRows(1);
  return sh;
}

function reglasColor_(sh) {
  const rango = sh.getRange(2, P.ESTADO, sh.getMaxRows() - 1, 1);
  const regla = function (texto, fondo) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextStartsWith(texto).setBackground(fondo).setRanges([rango]).build();
  };
  sh.setConditionalFormatRules([
    regla('✅', '#e3f4ea'), regla('✍️', '#eaf5fb'), regla('⏳', '#fff8e1'), regla('🖨️', '#fff8e1'), regla('⚠️', '#fbe7e7'), regla('⛔', '#eeeeee')
  ]);
}

function proteger_(rango, descripcion) {
  const sh = rango.getSheet();
  const ya = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).some(function (p) { return p.getDescription() === descripcion; });
  if (!ya) rango.protect().setDescription(descripcion).setWarningOnly(true);
}

function obtenerOCrearCarpeta_(padre, nombre) {
  const it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

function registrar_(accion, detalle) {
  try {
    const sh = hoja_(HOJA.REG);
    if (sh) sh.appendRow([new Date(), Session.getActiveUser().getEmail() || 'automático', accion, limpiar_(detalle)]);
  } catch (err) { Logger.log(accion + ': ' + detalle); }
}

function toast_(msg) { try { SpreadsheetApp.getActive().toast(msg, 'Certificados', 6); } catch (err) { Logger.log(msg); } }
function avisar_(msg) { try { SpreadsheetApp.getUi().alert(msg); } catch (err) { Logger.log(msg); } }
