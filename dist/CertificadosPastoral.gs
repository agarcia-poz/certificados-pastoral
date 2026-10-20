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

const VERSION_APP = '2.2.1';

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
  // Cada paso por separado: si Google rechaza uno accesorio, se sigue; si es imprescindible, se dice cuál.
  const paso = function (nombre, fn, opcional) {
    try { return fn(); }
    catch (err) {
      registrar_('Aviso formulario', nombre + ': ' + err.message);
      if (opcional) return null;
      try { DriveApp.getFileById(form.getId()).setTrashed(true); } catch (e) { }
      throw new Error('No se pudo crear el formulario (paso «' + nombre + '»): ' + err.message);
    }
  };
  paso('descripción', function () {
    form.setDescription('Centro Universitario «Sagrada Familia» · ' + CONFIG.NOMBRE_SERVICIO + '\n\n' +
      'Registra aquí las actividades de Pastoral en las que has participado, organizado o coordinado, ' +
      'y cuéntanos qué te han aportado. Con este registro preparamos tu certificado, que te llegará firmado por correo.');
  }, true);
  paso('sin edición de respuestas', function () { form.setAllowResponseEdits(false); }, true);
  paso('sin resumen público', function () { form.setPublishingSummary(false); }, true);
  paso('mensaje de confirmación', function () {
    form.setConfirmationMessage('¡Gracias! Te hemos enviado un correo de confirmación. ' +
      'Cuando el certificado esté firmado te llegará a este mismo correo.');
  }, true);
  paso('recoger correo', function () {
    try { form.setEmailCollectionType(FormApp.EmailCollectionType.VERIFIED); }
    catch (err) { form.setCollectEmail(true); }
  });
  if (CONFIG.SOLO_CUENTAS_DEL_CENTRO) paso('solo cuentas del centro', function () { form.setRequireLogin(true); }, true);

  const nombre = paso('campo Nombre', function () { return form.addTextItem().setTitle('Nombre').setRequired(true); });
  const apellidos = paso('campo Apellidos', function () { return form.addTextItem().setTitle('Apellidos').setRequired(true); });
  const dni = paso('campo DNI', function () {
    return form.addTextItem().setTitle('DNI / NIE').setRequired(true)
      .setHelpText('Aparecerá en tu certificado. Con letra y sin espacios, por ejemplo 12345678Z.');
  });
  paso('validación del DNI', function () {
    dni.setValidation(FormApp.createTextValidation()
      .requireTextMatchesPattern('[0-9XYZxyz][0-9]{7}[A-Za-z]')
      .setHelpText('Escribe el DNI o NIE con su letra y sin espacios, por ejemplo 12345678Z').build());
  }, true);   // si falla, da igual: la app comprueba la letra del DNI y avisa por correo
  const roles = paso('tabla de actividades', function () {
    const g = form.addGridItem().setTitle('¿En qué actividades has estado y cómo?');
    g.setColumns(CONFIG.ROLES);
    g.setRows(['(sin actividades)']);
    return g.setHelpText('Marca solo las actividades en las que has estado. Deja en blanco el resto.');
  });
  const valor = paso('tabla de valoración', function () {
    const g = form.addGridItem().setTitle('Valora esas actividades');
    g.setColumns(['1', '2', '3', '4', '5']);
    g.setRows(['(sin actividades)']);
    return g.setHelpText('1 = me ha aportado poco · 5 = me ha aportado mucho. Es anónimo.');
  });
  const comentario = paso('comentario', function () {
    return form.addParagraphTextItem().setTitle('¿Qué te ha aportado? (opcional y anónimo)')
      .setHelpText('Una frase, una experiencia, algo que te llevas…');
  });
  const citar = paso('casilla del boletín', function () {
    const c = form.addCheckboxItem().setTitle('Boletín de Pastoral (opcional)');
    c.setChoiceValues(['Podéis citar mi comentario en el boletín, siempre sin mi nombre']);
    return c;
  });
  paso('texto de privacidad', function () {
    form.addSectionHeaderItem().setTitle('Protección de datos').setHelpText(CONFIG.TEXTO_PRIVACIDAD);
  }, true);
  const c1 = paso('consentimiento 1', function () {
    const c = form.addCheckboxItem().setTitle('Información y tratamiento de datos');
    c.setChoiceValues(['He leído la información sobre protección de datos y acepto el tratamiento de mis datos para gestionar y expedir mi certificado.']);
    return c.setRequired(true);
  });
  const c2 = paso('consentimiento 2', function () {
    const c = form.addCheckboxItem().setTitle('Consentimiento explícito');
    c.setChoiceValues(['Consiento expresamente que se trate la información sobre mi participación en actividades del Servicio de Pastoral, que podría revelar convicciones religiosas (art. 9.2.a RGPD).']);
    return c.setRequired(true);
  });

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
  try {
    form.getItemById(items.roles).asGridItem().setRows(visibles);
    form.getItemById(items.valor).asGridItem().setRows(visibles);
  } catch (err) {
    throw new Error('Google no acepta los nombres de las actividades en el formulario (' + err.message + '). ' +
      'Revisa que no haya dos iguales ni nombres vacíos o muy largos en «Actividades».');
  }
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

// ─────────────────────────────── RECURSOS INCRUSTADOS ───────────────────────
// Generado por build.py: páginas del editor, motor de PDF y logos. No editar a mano.
const LOGO_CORREO_B64 = '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';
const ARCHIVOS_HTML = {"Editor": "<!DOCTYPE html>\n<html lang=\"es\">\n<head>\n<meta charset=\"UTF-8\">\n<base target=\"_top\">\n<script src=\"https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js\"></script>\n<script src=\"https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js\"></script>\n<script src=\"https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js\"></script>\n<?!= incluir_('Motor') ?>\n<?!= incluir_('Logos') ?>\n<style>\n  :root {\n    --azul: #2a6096; --azul-osc: #1d4a77; --azul-claro: #eaf2f9; --texto: #1f2a33; --suave: #5d6b75;\n    --borde: #d9e2e9; --fondo: #f3f6f9; --ok: #0b7a45; --mal: #b3261e; --aviso: #8a5a00;\n  }\n  * { box-sizing: border-box; }\n  html, body { margin: 0; height: 100%; font-family: \"Open Sans\", Arial, Helvetica, sans-serif; color: var(--texto); background: var(--fondo); font-size: 13px; }\n  .app { display: grid; grid-template-rows: auto 1fr; height: 100vh; }\n  header { display: flex; align-items: center; gap: 14px; padding: 10px 16px; background: #fff; border-bottom: 1px solid var(--borde); }\n  header select { min-width: 360px; }\n  .pestanas { display: flex; gap: 4px; margin-left: auto; }\n  .pestanas button { border: 1px solid var(--borde); background: #fff; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; color: var(--suave); }\n  .pestanas button.activa { background: var(--azul); border-color: var(--azul); color: #fff; }\n  .contador { display: inline-block; min-width: 20px; padding: 0 6px; border-radius: 10px; background: #f2a33a; color: #fff; font-size: 11px; margin-left: 6px; }\n  main { display: grid; grid-template-columns: 440px 1fr; min-height: 0; }\n  .panel { overflow-y: auto; background: #fff; border-right: 1px solid var(--borde); display: flex; flex-direction: column; }\n  .panel-scroll { flex: 1; overflow-y: auto; padding: 6px 16px 16px; }\n  .panel-pie { border-top: 1px solid var(--borde); padding: 10px 16px; background: #fafcfd; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }\n  details { border-bottom: 1px solid var(--borde); padding: 10px 0; }\n  summary { font-weight: 700; cursor: pointer; color: var(--azul-osc); font-size: 13.5px; list-style: none; }\n  summary::-webkit-details-marker { display: none; }\n  summary::before { content: '▸ '; color: var(--suave); }\n  details[open] summary::before { content: '▾ '; }\n  label { display: block; font-weight: 600; margin: 10px 0 4px; font-size: 12px; color: var(--suave); }\n  input[type=text], textarea, select { width: 100%; padding: 7px 9px; border: 1px solid var(--borde); border-radius: 6px; font: inherit; color: var(--texto); background: #fff; }\n  textarea { resize: vertical; min-height: 58px; line-height: 1.45; }\n  input:focus, textarea:focus, select:focus { outline: 2px solid #9cc0e4; border-color: var(--azul); }\n  .fila { display: flex; gap: 8px; align-items: center; }\n  .fila > * { flex: 1; }\n  .ayuda { font-size: 11.5px; color: var(--suave); margin-top: 4px; line-height: 1.4; }\n  .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }\n  .chip { border: 1px solid var(--borde); background: var(--azul-claro); color: var(--azul-osc); border-radius: 12px; padding: 2px 8px; font-size: 11px; cursor: pointer; font-family: monospace; }\n  .plantillas { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }\n  .plantilla { border: 2px solid var(--borde); border-radius: 8px; padding: 6px 4px 5px; cursor: pointer; text-align: center; font-size: 10.5px; background: #fff; color: var(--suave); }\n  .plantilla.activa { border-color: var(--azul); color: var(--azul-osc); font-weight: 700; }\n  .plantilla canvas { display: block; margin: 0 auto 4px; border: 1px solid #e5ebf0; }\n  .colores { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }\n  .muestra { width: 30px; height: 22px; border-radius: 5px; cursor: pointer; border: 1px solid rgba(0,0,0,.15); position: relative; overflow: hidden; }\n  .muestra span { position: absolute; right: 0; bottom: 0; width: 40%; height: 40%; }\n  input[type=color] { width: 44px; height: 30px; padding: 0; border: 1px solid var(--borde); border-radius: 6px; background: #fff; }\n  .boton { border: 1px solid var(--borde); background: #fff; padding: 7px 12px; border-radius: 7px; font: inherit; font-weight: 600; cursor: pointer; color: var(--texto); }\n  .boton:hover { background: var(--fondo); }\n  .boton.primario { background: var(--azul); border-color: var(--azul); color: #fff; }\n  .boton.primario:hover { background: var(--azul-osc); }\n  .boton.verde { background: var(--ok); border-color: var(--ok); color: #fff; }\n  .boton:disabled { opacity: .5; cursor: default; }\n  .boton.peq { padding: 4px 8px; font-size: 11.5px; }\n  .interruptor { display: flex; align-items: center; gap: 8px; margin: 8px 0; font-weight: 600; color: var(--texto); font-size: 12.5px; }\n  .interruptor input { width: 16px; height: 16px; }\n  .vista { display: flex; flex-direction: column; min-height: 0; }\n  .vista-barra { display: flex; gap: 10px; align-items: center; padding: 10px 16px; background: #fff; border-bottom: 1px solid var(--borde); flex-wrap: wrap; }\n  .vista-barra select { width: auto; min-width: 200px; }\n  .lienzo { flex: 1; overflow: auto; display: flex; justify-content: center; align-items: flex-start; padding: 18px; }\n  .lienzo canvas { box-shadow: 0 6px 24px rgba(20,40,60,.18); background: #fff; }\n  .avisos { font-size: 12px; color: var(--aviso); flex-basis: 100%; min-height: 16px; }\n  .estado-guardado { font-size: 12px; color: var(--suave); margin-left: auto; }\n  .estado-guardado.sin { color: var(--aviso); font-weight: 700; }\n  .ia { background: #f7f3ff; border: 1px solid #e0d6f5; border-radius: 8px; padding: 10px; margin-top: 8px; }\n  .ia h4 { margin: 0 0 4px; font-size: 12.5px; color: #5b2c83; }\n  .ia textarea { min-height: 46px; }\n  .persona { display: grid; grid-template-columns: 22px 1fr 1fr 34px; gap: 5px 6px; align-items: center; padding: 8px 6px; border: 1px solid var(--borde); border-radius: 8px; margin-bottom: 6px; }\n  .persona input[type=text], .persona select { padding: 5px 7px; font-size: 12px; }\n  .persona .sel { grid-row: span 2; width: 16px; height: 16px; }\n  .persona .ver { grid-row: span 2; height: 100%; }\n  .persona.mal input.dni { border-color: var(--mal); background: #fff4f3; }\n  .persona.hecho { opacity: .5; }\n  .persona .aviso-email { grid-column: 2 / span 2; font-size: 11px; color: var(--mal); }\n  .barra-progreso { height: 10px; background: #e5ebf0; border-radius: 6px; overflow: hidden; margin: 10px 0 6px; }\n  .barra-progreso div { height: 100%; width: 0; background: var(--ok); transition: width .2s; }\n  .registro { font-size: 12px; max-height: 160px; overflow: auto; background: var(--fondo); border-radius: 6px; padding: 8px; white-space: pre-wrap; }\n  .vacio { padding: 30px 10px; text-align: center; color: var(--suave); }\n  .cargando { position: fixed; inset: 0; background: rgba(255,255,255,.85); display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 10px; z-index: 10; font-weight: 600; color: var(--azul-osc); }\n  .oculto { display: none !important; }\n  .nota { background: var(--azul-claro); border-radius: 8px; padding: 9px 11px; font-size: 12px; line-height: 1.45; margin: 10px 0; }\n  .toast { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); background: #1f2a33; color: #fff; padding: 9px 16px; border-radius: 8px; font-size: 12.5px; z-index: 20; }\n</style>\n</head>\n<body>\n<div class=\"app\">\n  <header>\n    <strong style=\"color:var(--azul-osc)\">Actividad</strong>\n    <select id=\"actividad\"></select>\n    <span class=\"estado-guardado\" id=\"estadoGuardado\"></span>\n    <div class=\"pestanas\">\n      <button id=\"tabDiseno\" class=\"activa\">🎨 Diseño</button>\n      <button id=\"tabGenerar\">🖨️ Generar <span class=\"contador\" id=\"contador\">0</span></button>\n    </div>\n  </header>\n  <main>\n    <!-- ───────────── PANEL DISEÑO ───────────── -->\n    <section class=\"panel\" id=\"panelDiseno\">\n      <div class=\"panel-scroll\">\n        <details open>\n          <summary>Estilo</summary>\n          <label>Plantilla</label>\n          <div class=\"plantillas\" id=\"plantillas\"></div>\n          <label>Colores</label>\n          <div class=\"fila\" style=\"flex:0\">\n            <div style=\"flex:0\"><input type=\"color\" id=\"color\" title=\"Color principal\"></div>\n            <div style=\"flex:0\"><input type=\"color\" id=\"acento\" title=\"Color de acento\"></div>\n            <div class=\"ayuda\" style=\"flex:1\">Principal (banda, nombre) y acento (filetes).<br>O elige una combinación:</div>\n          </div>\n          <div class=\"colores\" id=\"presets\"></div>\n          <label>Tipografía</label>\n          <select id=\"tipografia\"></select>\n          <div id=\"bloqueBanda\">\n            <label>Texto de la banda lateral</label>\n            <input type=\"text\" id=\"textoBanda\">\n          </div>\n        </details>\n\n        <details>\n          <summary>Fondo, logos y QR</summary>\n          <label>Fondo de página (imagen creada con otra IA, por ejemplo)</label>\n          <div class=\"fila\">\n            <button class=\"boton\" id=\"btnFondo\">📁 Subir fondo…</button>\n            <button class=\"boton\" id=\"btnQuitarFondo\">Quitar fondo</button>\n          </div>\n          <input type=\"file\" id=\"archivoFondo\" accept=\"image/png,image/jpeg,image/webp\" class=\"oculto\">\n          <div class=\"ayuda\">Se recorta y adapta solo a A4 vertical. Consejo: con un fondo propio, la plantilla «Limpio» suele quedar mejor.</div>\n          <label>Velo blanco bajo el texto: <span id=\"veloValor\">0</span> %</label>\n          <input type=\"range\" id=\"velo\" min=\"0\" max=\"90\" step=\"5\" style=\"width:100%\">\n          <div class=\"ia\">\n            <h4>✨ Crear el fondo con IA</h4>\n            <input type=\"text\" id=\"ideaFondo\" placeholder=\"Idea: acuarela suave de olivos y luz de amanecer…\">\n            <div class=\"fila\" style=\"margin-top:6px\"><button class=\"boton peq\" id=\"btnPromptFondo\">Copiar instrucción para la IA</button></div>\n            <textarea id=\"promptFondo\" class=\"oculto\" readonly></textarea>\n          </div>\n          <label class=\"interruptor\"><input type=\"checkbox\" id=\"logoSuperior\"> Logo superior</label>\n          <div class=\"fila\">\n            <button class=\"boton peq\" id=\"btnLogo\">Cambiar logo superior…</button>\n            <button class=\"boton peq\" id=\"btnLogoOriginal\">Volver al logo de Pastoral</button>\n          </div>\n          <input type=\"file\" id=\"archivoLogo\" accept=\"image/png,image/jpeg\" class=\"oculto\">\n          <label class=\"interruptor\"><input type=\"checkbox\" id=\"logosPie\"> Logos SAFA y UJA al pie</label>\n          <label class=\"interruptor\"><input type=\"checkbox\" id=\"qr\"> Código QR de verificación</label>\n        </details>\n\n        <details open>\n          <summary>Textos del certificado</summary>\n          <div class=\"nota\">Escribe <b>**así**</b> para negrita y <i>*así*</i> para cursiva. Los campos entre llaves se rellenan solos: pulsa uno para insertarlo donde está el cursor.\n            <div class=\"chips\" id=\"chips\"></div></div>\n          <label>Rótulo superior (opcional)</label><input type=\"text\" id=\"etiqueta\">\n          <label>Título</label><input type=\"text\" id=\"titulo\">\n          <label>Frase de entrada</label><input type=\"text\" id=\"intro\">\n          <label>Línea del DNI</label><input type=\"text\" id=\"lineaDni\">\n          <label>Párrafo principal</label><textarea id=\"cuerpo\"></textarea>\n          <label>Texto sobre la actividad (cada línea, un párrafo)</label>\n          <textarea id=\"descripcion\" style=\"min-height:120px\" placeholder=\"Pega aquí el texto generado con IA…\"></textarea>\n          <div class=\"ia\">\n            <h4>✨ Texto con IA</h4>\n            <textarea id=\"notasIA\" placeholder=\"Qué se hizo, con quién, objetivos… (cuanto más concreto, mejor texto)\"></textarea>\n            <div class=\"fila\" style=\"margin-top:6px\"><button class=\"boton peq\" id=\"btnPromptTexto\">Copiar instrucción para la IA</button></div>\n            <textarea id=\"promptTexto\" class=\"oculto\" readonly></textarea>\n            <div class=\"ayuda\">Pégala en Claude u otra IA, revisa el resultado y pégalo arriba.</div>\n          </div>\n          <label>Frase de horas (solo si la actividad tiene horas)</label><textarea id=\"textoHoras\"></textarea>\n          <label>Frase de ECTS (solo si la actividad tiene ECTS)</label><textarea id=\"textoEcts\"></textarea>\n          <label>Cierre (opcional, por ejemplo con la fecha)</label>\n          <textarea id=\"cierre\" placeholder=\"Y para que así conste, se expide el presente certificado en Úbeda, a {fecha}.\"></textarea>\n        </details>\n\n        <details>\n          <summary>Frase según el rol</summary>\n          <div class=\"ayuda\">Es lo que sustituye a <code>{verbo}</code>.</div>\n          <div id=\"verbos\"></div>\n        </details>\n\n        <details>\n          <summary>Firmas</summary>\n          <div class=\"ayuda\">Por defecto salen los firmantes de la hoja «Ajustes». Aquí puedes cambiar cómo aparecen en esta actividad (el orden y quién firma no cambian).</div>\n          <div id=\"firmas\"></div>\n          <button class=\"boton peq\" id=\"btnFirmasAjustes\" style=\"margin-top:8px\">Volver a los de «Ajustes»</button>\n        </details>\n      </div>\n      <div class=\"panel-pie\">\n        <button class=\"boton primario\" id=\"btnGuardar\">💾 Guardar diseño</button>\n        <label class=\"interruptor\" style=\"margin:0\"><input type=\"checkbox\" id=\"comoBase\"> usar también como base</label>\n        <button class=\"boton peq\" id=\"btnBase\" title=\"Descarta los cambios no guardados\">Deshacer cambios</button>\n      </div>\n    </section>\n\n    <!-- ───────────── PANEL GENERAR ───────────── -->\n    <section class=\"panel oculto\" id=\"panelGenerar\">\n      <div class=\"panel-scroll\">\n        <div class=\"nota\">Aquí están las personas con <b>✔ Certificar</b> marcado en esta actividad. Puedes corregir nombre, apellidos, DNI y rol antes de generar: las correcciones se guardan en la bóveda.</div>\n        <div id=\"sinPendientes\" class=\"vacio oculto\">No hay certificados pendientes en esta actividad.<br>Marca «✔ Certificar» en la hoja «Participaciones».</div>\n        <div id=\"tablaCola\">\n          <label class=\"interruptor\"><input type=\"checkbox\" id=\"todos\" checked> Seleccionar todas</label>\n          <div id=\"listaCola\"></div>\n        </div>\n        <div id=\"progreso\" class=\"oculto\">\n          <div class=\"barra-progreso\"><div id=\"barra\"></div></div>\n          <div id=\"textoProgreso\" class=\"ayuda\"></div>\n          <div class=\"registro\" id=\"registro\"></div>\n        </div>\n      </div>\n      <div class=\"panel-pie\">\n        <button class=\"boton verde\" id=\"btnGenerar\">🖨️ Generar certificados</button>\n        <span class=\"ayuda\">Mantén esta ventana abierta mientras se generan.</span>\n      </div>\n    </section>\n\n    <!-- ───────────── VISTA PREVIA ───────────── -->\n    <section class=\"vista\">\n      <div class=\"vista-barra\">\n        <strong>Vista previa con</strong>\n        <select id=\"verCon\"></select>\n        <select id=\"verRol\"></select>\n        <button class=\"boton peq\" id=\"btnPrueba\">📄 Guardar PDF de prueba</button>\n        <span class=\"avisos\" id=\"avisos\"></span>\n      </div>\n      <div class=\"lienzo\" id=\"lienzo\"><canvas id=\"canvas\"></canvas></div>\n    </section>\n  </main>\n</div>\n<div class=\"cargando\" id=\"cargando\"><div>Cargando el editor…</div><div class=\"ayuda\" id=\"cargandoDetalle\"></div></div>\n<textarea id=\"portapapeles\" style=\"position:fixed;left:-9999px;top:0\"></textarea>\n\n<script>\n(function () {\n  'use strict';\n  const $ = (id) => document.getElementById(id);\n  const PRESETS = [\n    ['Verde Pastoral', '#2e7d4f', '#f2c14e'], ['Azul SAFA', '#2a6096', '#f2a33a'], ['Adviento', '#5b2c83', '#c9a227'], ['Navidad', '#a61e2a', '#d4af37'],\n    ['Cuaresma', '#6b3f86', '#a7a9ac'], ['Pascua', '#b8860b', '#2a6096'], ['Ordinario', '#3f8f3a', '#e8d8a8'],\n    ['Solidaridad', '#c0392b', '#2a6096'], ['Voluntariado', '#d35400', '#2a6096'], ['Mar', '#0f6c81', '#9bd0d8'],\n    ['Sobrio', '#33414c', '#b08d57']\n  ];\n  const CAMPOS_TEXTO = ['etiqueta', 'titulo', 'intro', 'lineaDni', 'cuerpo', 'descripcion', 'textoHoras', 'textoEcts', 'cierre', 'textoBanda', 'notasIA'];\n  const CHIPS = ['{nombre}', '{dni}', '{actividad}', '{fechas}', '{lugar}', '{verbo}', '{horas}', '{ects}', '{creditos}', '{rol}', '{curso}', '{fecha}', '{codigo}'];\n\n  const S = {\n    ini: null, act: null, diseno: null, guardado: '', cola: [], fuentes: {}, imgs: {}, ultimoCampo: null,\n    pestana: 'diseno', generando: false\n  };\n\n  // ─────────── servidor ───────────\n  function llamar(fn) {\n    const args = Array.prototype.slice.call(arguments, 1);\n    return new Promise(function (ok, ko) {\n      google.script.run.withSuccessHandler(ok).withFailureHandler(function (e) { ko(e && e.message ? e : new Error(String(e))); })[fn].apply(null, args);\n    });\n  }\n  function aviso(t) {\n    const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d);\n    setTimeout(() => d.remove(), 3200);\n  }\n  function cargando(si, detalle) { $('cargando').classList.toggle('oculto', !si); $('cargandoDetalle').textContent = detalle || ''; }\n\n  // ─────────── recursos (fuentes e imágenes) ───────────\n  async function fuente(tipo) {\n    if (S.fuentes[tipo]) return S.fuentes[tipo];\n    const bytes = {}, css = {};\n    await Promise.all(Object.keys(Motor.ESTILOS).map(async (estilo) => {\n      try {\n        const r = await fetch(Motor.urlFuente(tipo, estilo));\n        if (!r.ok) throw new Error(r.status);\n        bytes[estilo] = new Uint8Array(await r.arrayBuffer());\n        const nombre = 'CP_' + tipo + '_' + estilo;\n        const ff = new FontFace(nombre, bytes[estilo]);\n        await ff.load(); document.fonts.add(ff); css[estilo] = nombre;\n      } catch (e) { css[estilo] = 'Helvetica'; }\n    }));\n    const medir = await Motor.crearMedidor(PDFLib, window.fontkit, bytes);\n    S.fuentes[tipo] = { bytes, css, medir };\n    return S.fuentes[tipo];\n  }\n\n  function dataUriABytes(uri) {\n    const b64 = uri.split(',')[1], bin = atob(b64), u = new Uint8Array(bin.length);\n    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);\n    return u;\n  }\n  function bytesABase64(u8) {\n    let s = ''; const paso = 0x8000;\n    for (let i = 0; i < u8.length; i += paso) s += String.fromCharCode.apply(null, u8.subarray(i, i + paso));\n    return btoa(s);\n  }\n  function imagenDesdeUri(uri) {\n    return new Promise((ok, ko) => { const im = new Image(); im.onload = () => ok(im); im.onerror = ko; im.src = uri; });\n  }\n  async function registrarImagen(clave, uri) {\n    const el = await imagenDesdeUri(uri);\n    S.imgs[clave] = { el, w: el.naturalWidth, h: el.naturalHeight, bytes: dataUriABytes(uri), tipo: uri.indexOf('image/png') > -1 ? 'png' : 'jpg' };\n  }\n  async function imagenDrive(clave, id) {\n    if (!id) { delete S.imgs[clave]; return; }\n    if (S.imgs[clave] && S.imgs[clave].id === id) return;\n    const r = await llamar('api_imagen', id);\n    await registrarImagen(clave, 'data:' + r.mime + ';base64,' + r.base64);\n    S.imgs[clave].id = id;\n  }\n  async function prepararImagenes() {\n    await imagenDrive('fondo', S.diseno.fondoId);\n    await imagenDrive('logoPropio', S.diseno.logoId);\n  }\n  function imagenesPara(d) {\n    const r = {};\n    if (S.imgs.safa) r.safa = S.imgs.safa;\n    if (S.imgs.uja) r.uja = S.imgs.uja;\n    const sup = d.logoId && S.imgs.logoPropio ? S.imgs.logoPropio : S.imgs.pastoral;\n    if (sup) r.pastoral = sup;\n    if (d.fondoId && S.imgs.fondo) r.fondo = S.imgs.fondo;\n    return r;\n  }\n\n  function matrizQr(texto) {\n    if (typeof qrcode === 'undefined') return null;\n    const q = qrcode(0, 'M'); q.addData(texto); q.make();\n    const n = q.getModuleCount(), m = [];\n    for (let r = 0; r < n; r++) { m.push([]); for (let c = 0; c < n; c++) m[r].push(q.isDark(r, c)); }\n    return m;\n  }\n\n  // ─────────── datos para dibujar ───────────\n  function hoyLargo() {\n    const M = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];\n    const d = new Date(); return d.getDate() + ' de ' + M[d.getMonth()] + ' de ' + d.getFullYear();\n  }\n  function datosDe(persona, rol, codigo) {\n    const a = S.act;\n    return {\n      nombre: persona.nombre, apellidos: persona.apellidos, dni: persona.dni,\n      actividad: a.nombre, fechas: a.fechas, lugar: a.lugar || S.ini.lugarPorDefecto, horas: a.horas, ects: a.ects,\n      rol: rol || persona.rol || 'Participante', curso: a.curso, fecha: hoyLargo(),\n      codigo: codigo || 'SAFA-PAS-' + String(a.curso || '').replace(/^20(\\d\\d)-(\\d\\d)$/, '$1$2') + '-XXXXXX',\n      url: S.ini.url || 'https://script.google.com/…/exec', firmantes: S.ini.firmantes\n    };\n  }\n  const EJEMPLO = { nombre: 'María José', apellidos: 'Valero Moro', dni: '12345678Z', rol: 'Participante' };\n\n  function personaVista() {\n    const v = $('verCon').value;\n    if (v === '_ej') return EJEMPLO;\n    const fila = S.cola.find((p) => p.reg === v);\n    return fila ? leerFilaEditada(fila) : EJEMPLO;\n  }\n\n  // ─────────── vista previa ───────────\n  let temporizador = null;\n  function programarVista() { clearTimeout(temporizador); temporizador = setTimeout(dibujarVista, 180); }\n\n  async function dibujarVista() {\n    if (!S.diseno || !S.act) return;\n    const d = Motor.mezclar(S.diseno);\n    const f = await fuente(d.tipografia);\n    const imgs = imagenesPara(d);\n    const per = personaVista();\n    const r = Motor.componer(d, datosDe(per, $('verRol').value), f.medir, imgs, matrizQr);\n    $('avisos').textContent = r.avisos.join(' ');\n    const lienzo = $('lienzo'), canvas = $('canvas');\n    const alto = Math.max(300, lienzo.clientHeight - 36);\n    const escalaVista = alto / Motor.ALTO, dpr = window.devicePixelRatio || 1;\n    canvas.style.height = alto + 'px'; canvas.style.width = (Motor.ANCHO * escalaVista) + 'px';\n    canvas.width = Math.round(Motor.ANCHO * escalaVista * dpr); canvas.height = Math.round(alto * dpr);\n    const els = {}; Object.keys(imgs).forEach((k) => { els[k] = imgs[k].el; });\n    Motor.aCanvas(canvas.getContext('2d'), r.ops, escalaVista * dpr, f.css, els);\n  }\n\n  async function pdfDe(persona, rol, codigo) {\n    const d = Motor.mezclar(S.diseno);\n    const f = await fuente(d.tipografia);\n    const imgs = imagenesPara(d);\n    const r = Motor.componer(d, datosDe(persona, rol, codigo), f.medir, imgs, matrizQr);\n    const bytesImg = {}; Object.keys(imgs).forEach((k) => { bytesImg[k] = { bytes: imgs[k].bytes, tipo: imgs[k].tipo }; });\n    return Motor.aPdf(PDFLib, window.fontkit, r.ops, f.bytes, bytesImg,\n      { titulo: d.titulo + ' · ' + S.act.nombre, asunto: codigo || 'Prueba de diseño' });\n  }\n\n  // ─────────── formulario de diseño ───────────\n  function miniPlantillas() {\n    const cont = $('plantillas'); cont.innerHTML = '';\n    Object.keys(Motor.PLANTILLAS).forEach((k) => {\n      const b = document.createElement('div'); b.className = 'plantilla'; b.dataset.k = k;\n      const c = document.createElement('canvas'); c.width = 54; c.height = 76;\n      b.appendChild(c); b.appendChild(document.createTextNode(Motor.PLANTILLAS[k].split(' (')[0]));\n      b.onclick = () => { S.diseno.plantilla = k; refrescarControles(); cambio(); };\n      cont.appendChild(b);\n    });\n  }\n  function pintarMinis() {\n    document.querySelectorAll('.plantilla').forEach((b) => {\n      b.classList.toggle('activa', b.dataset.k === S.diseno.plantilla);\n      const c = b.querySelector('canvas'), x = c.getContext('2d'), C = S.diseno.color || '#2a6096', A = S.diseno.acento || '#f2a33a';\n      x.fillStyle = '#fff'; x.fillRect(0, 0, 54, 76);\n      const k = b.dataset.k;\n      if (k === 'banda') { x.fillStyle = C; x.fillRect(0, 0, 8, 76); x.fillStyle = A; x.fillRect(8, 0, 1, 76); }\n      if (k === 'marco') { x.strokeStyle = C; x.lineWidth = 1.5; x.strokeRect(3, 3, 48, 70); x.strokeStyle = A; x.lineWidth = .6; x.strokeRect(6, 6, 42, 64); }\n      if (k === 'cabecera') { x.fillStyle = C; x.fillRect(0, 0, 54, 4); x.fillRect(0, 74, 54, 2); x.fillStyle = A; x.fillRect(0, 4, 54, 1); }\n      x.fillStyle = '#c5ced6'; [20, 30, 36, 42, 48].forEach((y, i) => x.fillRect(k === 'banda' ? 14 : 10, y, i === 0 ? 30 : 34, 2));\n      x.fillStyle = C; x.fillRect(18, 25, 20, 2.5);\n    });\n  }\n\n  function refrescarControles() {\n    const d = Motor.mezclar(S.diseno);\n    CAMPOS_TEXTO.forEach((k) => { if (document.activeElement !== $(k)) $(k).value = d[k] || ''; });\n    $('color').value = d.color; $('acento').value = d.acento; $('tipografia').value = d.tipografia;\n    $('velo').value = d.velo; $('veloValor').textContent = d.velo;\n    $('logoSuperior').checked = !!d.logoSuperior; $('logosPie').checked = !!d.logosPie; $('qr').checked = !!d.qr;\n    $('bloqueBanda').classList.toggle('oculto', d.plantilla !== 'banda');\n    $('btnQuitarFondo').disabled = !d.fondoId;\n    $('btnLogoOriginal').disabled = !d.logoId;\n    const vb = $('verbos'); vb.innerHTML = '';\n    S.ini.roles.forEach((rol) => {\n      vb.insertAdjacentHTML('beforeend', '<label>' + rol + '</label>');\n      const i = document.createElement('input'); i.type = 'text'; i.value = d.verbos[rol] || '';\n      i.oninput = () => { S.diseno.verbos = Object.assign({}, Motor.mezclar(S.diseno).verbos, { [rol]: i.value }); cambio(); };\n      vb.appendChild(i);\n    });\n    const fi = $('firmas'); fi.innerHTML = '';\n    const lista = d.firmas && d.firmas.length ? d.firmas : S.ini.firmantes;\n    S.ini.firmantes.forEach((_, n) => {\n      const f = lista[n] || S.ini.firmantes[n];\n      fi.insertAdjacentHTML('beforeend', '<label>Firma ' + (n + 1) + ' · cargo y nombre</label>');\n      const t = document.createElement('textarea'); t.value = f.titulo; t.style.minHeight = '38px';\n      const nom = document.createElement('input'); nom.type = 'text'; nom.value = f.nombre; nom.style.marginTop = '4px';\n      const leer = () => {\n        const actual = (S.diseno.firmas && S.diseno.firmas.length ? S.diseno.firmas : S.ini.firmantes).map((x) => ({ titulo: x.titulo, nombre: x.nombre }));\n        actual[n] = { titulo: t.value, nombre: nom.value };\n        S.diseno.firmas = actual; cambio();\n      };\n      t.oninput = leer; nom.oninput = leer;\n      fi.appendChild(t); fi.appendChild(nom);\n    });\n    pintarMinis();\n  }\n\n  function cambio() { marcarGuardado(); programarVista(); pintarMinis(); }\n  function marcarGuardado() {\n    const sin = JSON.stringify(S.diseno) !== S.guardado;\n    $('estadoGuardado').textContent = sin ? '● Cambios sin guardar' : (S.act && S.act.conDiseno ? '✓ Diseño guardado' : 'Usando el diseño base');\n    $('estadoGuardado').classList.toggle('sin', sin);\n  }\n\n  function enlazarControles() {\n    CAMPOS_TEXTO.forEach((k) => {\n      $(k).addEventListener('input', () => { S.diseno[k] = $(k).value; cambio(); });\n      $(k).addEventListener('focus', () => { S.ultimoCampo = $(k); });\n    });\n    $('color').oninput = () => { S.diseno.color = $('color').value; cambio(); };\n    $('acento').oninput = () => { S.diseno.acento = $('acento').value; cambio(); };\n    $('tipografia').onchange = () => { S.diseno.tipografia = $('tipografia').value; cambio(); };\n    $('velo').oninput = () => { S.diseno.velo = Number($('velo').value); $('veloValor').textContent = $('velo').value; cambio(); };\n    ['logoSuperior', 'logosPie', 'qr'].forEach((k) => { $(k).onchange = () => { S.diseno[k] = $(k).checked; cambio(); }; });\n    $('verCon').onchange = programarVista; $('verRol').onchange = programarVista;\n    window.addEventListener('resize', programarVista);\n\n    const chips = $('chips');\n    CHIPS.forEach((c) => {\n      const b = document.createElement('span'); b.className = 'chip'; b.textContent = c;\n      b.onmousedown = (e) => e.preventDefault();\n      b.onclick = () => {\n        const el = S.ultimoCampo || $('cuerpo');\n        const ini = el.selectionStart || el.value.length, fin = el.selectionEnd || ini;\n        el.value = el.value.slice(0, ini) + c + el.value.slice(fin);\n        el.focus(); el.selectionStart = el.selectionEnd = ini + c.length;\n        el.dispatchEvent(new Event('input'));\n      };\n      chips.appendChild(b);\n    });\n    PRESETS.forEach((p) => {\n      const m = document.createElement('div'); m.className = 'muestra'; m.title = p[0];\n      m.style.background = p[1]; m.innerHTML = '<span style=\"background:' + p[2] + '\"></span>';\n      m.onclick = () => { S.diseno.color = p[1]; S.diseno.acento = p[2]; refrescarControles(); cambio(); };\n      $('presets').appendChild(m);\n    });\n    Object.keys(Motor.TIPOGRAFIAS).forEach((k) => {\n      $('tipografia').insertAdjacentHTML('beforeend', '<option value=\"' + k + '\">' + Motor.TIPOGRAFIAS[k].nombre + '</option>');\n    });\n\n    $('btnFondo').onclick = () => $('archivoFondo').click();\n    $('archivoFondo').onchange = (e) => subirImagen(e.target.files[0], 'fondo');\n    $('btnQuitarFondo').onclick = () => { S.diseno.fondoId = ''; refrescarControles(); cambio(); };\n    $('btnLogo').onclick = () => $('archivoLogo').click();\n    $('archivoLogo').onchange = (e) => subirImagen(e.target.files[0], 'logo');\n    $('btnLogoOriginal').onclick = () => { S.diseno.logoId = ''; refrescarControles(); cambio(); };\n    $('btnFirmasAjustes').onclick = () => { S.diseno.firmas = []; refrescarControles(); cambio(); };\n    $('btnPromptTexto').onclick = () => copiar(promptTexto(), 'promptTexto');\n    $('btnPromptFondo').onclick = () => copiar(promptFondo(), 'promptFondo');\n    $('btnGuardar').onclick = guardar;\n    $('btnBase').onclick = restablecer;\n    $('btnPrueba').onclick = pdfPrueba;\n    $('actividad').onchange = cambiarActividad;\n    $('tabDiseno').onclick = () => pestana('diseno');\n    $('tabGenerar').onclick = () => pestana('generar');\n    $('btnGenerar').onclick = generar;\n    $('todos').onchange = () => document.querySelectorAll('#listaCola input.sel').forEach((c) => { c.checked = $('todos').checked; });\n  }\n\n  // ─────────── imágenes subidas ───────────\n  async function subirImagen(archivo, tipo) {\n    if (!archivo) return;\n    try {\n      cargando(true, 'Preparando la imagen…');\n      const uri = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(archivo); });\n      const im = await imagenDesdeUri(uri);\n      const c = document.createElement('canvas'), x = c.getContext('2d');\n      let salida, mime;\n      if (tipo === 'fondo') {\n        // Recorte «cubrir» a A4 vertical a 200 ppp\n        c.width = 1654; c.height = 2339;\n        const esc = Math.max(c.width / im.width, c.height / im.height);\n        const w = im.width * esc, h = im.height * esc;\n        x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);\n        x.drawImage(im, (c.width - w) / 2, (c.height - h) / 2, w, h);\n        mime = 'image/jpeg'; salida = c.toDataURL(mime, 0.86);\n      } else {\n        const esc = Math.min(1, 1100 / im.width);\n        c.width = Math.round(im.width * esc); c.height = Math.round(im.height * esc);\n        x.drawImage(im, 0, 0, c.width, c.height);\n        mime = 'image/png'; salida = c.toDataURL(mime);\n      }\n      cargando(true, 'Subiendo a Drive…');\n      const id = await llamar('api_subirImagen', salida.split(',')[1], mime, (tipo === 'fondo' ? 'Fondo ' : 'Logo ') + S.act.nombre);\n      await registrarImagen(tipo === 'fondo' ? 'fondo' : 'logoPropio', salida);\n      S.imgs[tipo === 'fondo' ? 'fondo' : 'logoPropio'].id = id;\n      if (tipo === 'fondo') { S.diseno.fondoId = id; if (!S.diseno.velo) S.diseno.velo = 0; }\n      else { S.diseno.logoId = id; S.diseno.logoSuperior = true; }\n      refrescarControles(); cambio();\n      aviso(tipo === 'fondo' ? 'Fondo añadido. Recuerda guardar el diseño.' : 'Logo cambiado. Recuerda guardar el diseño.');\n    } catch (e) { alert('No se pudo usar la imagen: ' + e.message); }\n    finally { cargando(false); $('archivoFondo').value = ''; $('archivoLogo').value = ''; }\n  }\n\n  // ─────────── IA ───────────\n  function promptTexto() {\n    const a = S.act, d = Motor.mezclar(S.diseno);\n    const frase = Motor.rellenar(d.cuerpo, datosDe({ nombre: '[nombre]', apellidos: '', dni: '' }, 'Participante'), d).replace(/\\*\\*/g, '');\n    return [\n      'Redacta el texto descriptivo de un certificado oficial del Servicio de Pastoral y Compromiso Solidario del Centro Universitario Sagrada Familia de Úbeda (centro de inspiración ignaciana adscrito a la Universidad de Jaén, que forma a futuros maestros y maestras de Educación Infantil y Primaria).',\n      '',\n      'Actividad: ' + a.nombre + (a.tipo ? ' (' + a.tipo.toLowerCase() + ')' : ''),\n      'Fechas: ' + (a.fechas || '—') + (a.horas ? ' · ' + a.horas + ' horas' : '') + (a.ects ? ' · ' + a.ects + ' ECTS' : ''),\n      'Lugar: ' + (a.lugar || S.ini.lugarPorDefecto),\n      'Qué se hizo y otros detalles: ' + ($('notasIA').value.trim() || '[escribe aquí qué se hizo, con qué entidades, objetivos…]'),\n      '',\n      'El texto irá justo después de esta frase del certificado: «' + frase + '»',\n      '',\n      'Requisitos:',\n      '- Dos párrafos, entre 80 y 130 palabras en total.',\n      '- Tercera persona e impersonal; no nombres a la persona certificada.',\n      '- Tono institucional, sobrio y cálido. Sin adjetivos grandilocuentes.',\n      '- Explica qué se trabajó y su objetivo formativo, y conéctalo con la futura labor docente; menciona la pedagogía ignaciana solo si encaja de forma natural.',\n      '- Sin lenguaje religioso explícito ni datos que yo no te haya dado.',\n      '- Si hay una entidad colaboradora, escríbela entre **dobles asteriscos** para que salga en negrita.',\n      '- Devuelve solo los dos párrafos, separados por un salto de línea, sin título ni comillas.',\n      '',\n      'Ejemplo del estilo buscado:',\n      'En dicho marco se han trabajado, desde la pedagogía ignaciana, la reflexión crítica sobre las desigualdades de género y la coeducación como clave para la construcción de una sociedad más justa, especialmente en el ámbito de la educación infantil y primaria.',\n      'Estas Jornadas han tenido como objetivo ofrecer herramientas concretas a los futuros y futuras docentes para integrar la perspectiva de género en el currículo, promoviendo contextos educativos inclusivos y corresponsables, en colaboración con la **ONG Entreculturas**.'\n    ].join('\\n');\n  }\n  function promptFondo() {\n    const d = Motor.mezclar(S.diseno);\n    return [\n      'Crea una imagen de fondo para un certificado en formato A4 vertical (proporción 1:1,414; idealmente 2480 × 3508 píxeles).',\n      'Idea: ' + ($('ideaFondo').value.trim() || 'decoración sobria y luminosa relacionada con «' + S.act.nombre + '»') + '.',\n      'Paleta: color principal ' + d.color + ' y acento ' + d.acento + ', sobre blanco o crema muy claro.',\n      'MUY IMPORTANTE: deja limpia y muy clara toda la zona central (del 12 % al 88 % del ancho y del 10 % al 90 % del alto), porque ahí irá el texto. Los motivos decorativos, solo en los bordes y esquinas, suaves y con poco contraste.',\n      'Sin texto, letras, números, logotipos, marcos de foto ni personas reconocibles. Estilo elegante, apto para un documento oficial universitario. Sin marcas de agua.'\n    ].join('\\n');\n  }\n  async function copiar(texto, idArea) {\n    const area = $(idArea); area.value = texto; area.classList.remove('oculto'); area.style.minHeight = '120px';\n    try { await navigator.clipboard.writeText(texto); aviso('Instrucción copiada. Pégala en la IA.'); }\n    catch (e) {\n      const p = $('portapapeles'); p.value = texto; p.select();\n      try { document.execCommand('copy'); aviso('Instrucción copiada. Pégala en la IA.'); }\n      catch (e2) { area.select(); aviso('Selecciona el texto y cópialo con Ctrl/Cmd + C.'); }\n    }\n  }\n\n  // ─────────── guardar / cargar ───────────\n  async function guardar() {\n    try {\n      $('btnGuardar').disabled = true;\n      await llamar('api_guardarDiseno', S.act.id, S.diseno, $('comoBase').checked);\n      S.guardado = JSON.stringify(S.diseno); S.act.conDiseno = true;\n      if ($('comoBase').checked) S.ini.hayBase = true;\n      marcarGuardado(); aviso('Diseño guardado.');\n      return true;\n    } catch (e) { alert('No se pudo guardar: ' + e.message); return false; }\n    finally { $('btnGuardar').disabled = false; }\n  }\n  async function restablecer() {\n    if (!confirm(\"¿Descartar los cambios no guardados?\")) return;\n    S.diseno = JSON.parse(JSON.stringify(S.base || {}));\n    await prepararImagenes(); refrescarControles(); cambio();\n  }\n\n  async function cambiarActividad() {\n    if (S.diseno && JSON.stringify(S.diseno) !== S.guardado && !confirm('Hay cambios sin guardar. ¿Cambiar de actividad igualmente?')) {\n      $('actividad').value = S.act.id; return;\n    }\n    await cargarActividad($('actividad').value);\n  }\n\n  async function cargarActividad(id) {\n    cargando(true, 'Cargando la actividad…');\n    try {\n      S.act = S.ini.actividades.find((a) => a.id === id);\n      const [diseno, cola] = await Promise.all([llamar('api_diseno', id), llamar('api_cola', id)]);\n      S.diseno = Object.assign({}, diseno || {}); S.base = diseno || {};\n      S.guardado = JSON.stringify(S.diseno);\n      S.cola = cola || [];\n      await prepararImagenes();\n      refrescarControles(); pintarCola(); opcionesVista(); marcarGuardado();\n      await dibujarVista();\n    } catch (e) { alert('Error al cargar: ' + e.message); }\n    finally { cargando(false); }\n  }\n\n  function opcionesVista() {\n    const v = $('verCon'); const antes = v.value; v.innerHTML = '<option value=\"_ej\">Datos de ejemplo</option>';\n    S.cola.forEach((p) => v.insertAdjacentHTML('beforeend', '<option value=\"' + p.reg + '\">' + esc(p.nombre + ' ' + p.apellidos) + '</option>'));\n    if ([...v.options].some((o) => o.value === antes)) v.value = antes;\n    const r = $('verRol'); const rAntes = r.value; r.innerHTML = '';\n    S.ini.roles.forEach((x) => r.insertAdjacentHTML('beforeend', '<option>' + x + '</option>'));\n    if (rAntes) r.value = rAntes;\n    $('contador').textContent = S.cola.length;\n  }\n\n  function pestana(p) {\n    S.pestana = p;\n    $('tabDiseno').classList.toggle('activa', p === 'diseno'); $('tabGenerar').classList.toggle('activa', p === 'generar');\n    $('panelDiseno').classList.toggle('oculto', p !== 'diseno'); $('panelGenerar').classList.toggle('oculto', p !== 'generar');\n  }\n\n  // ─────────── generar ───────────\n  function esc(t) { return String(t == null ? '' : t).replace(/[&<>\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c])); }\n  function dniValido(dni) {\n    const m = String(dni).toUpperCase().replace(/[\\s.\\-]/g, '').match(/^([0-9XYZ])(\\d{7})([A-Z])$/);\n    if (!m) return false;\n    const n = Number(({ X: '0', Y: '1', Z: '2' }[m[1]] || m[1]) + m[2]);\n    return 'TRWAGMYFPDXBNJZSQVHLCKE'.charAt(n % 23) === m[3];\n  }\n  function pintarCola() {\n    const tb = $('listaCola'); tb.innerHTML = '';\n    $('sinPendientes').classList.toggle('oculto', S.cola.length > 0);\n    $('tablaCola').classList.toggle('oculto', S.cola.length === 0);\n    $('btnGenerar').disabled = S.cola.length === 0;\n    S.cola.forEach((p) => {\n      const tr = document.createElement('div'); tr.className = 'persona'; tr.dataset.reg = p.reg;\n      tr.innerHTML = '<input type=\"checkbox\" class=\"sel\" checked>' +\n        '<input type=\"text\" class=\"nombre\" value=\"' + esc(p.nombre) + '\" placeholder=\"Nombre\">' +\n        '<input type=\"text\" class=\"apellidos\" value=\"' + esc(p.apellidos) + '\" placeholder=\"Apellidos\">' +\n        '<button class=\"boton peq ver\" title=\"Ver en la vista previa\">👁</button>' +\n        '<input type=\"text\" class=\"dni\" value=\"' + esc(p.dni) + '\" placeholder=\"DNI/NIE\">' +\n        '<select class=\"rol\">' + S.ini.roles.map((r) => '<option' + (r === p.rol ? ' selected' : '') + '>' + r + '</option>').join('') + '</select>' +\n        (p.tieneEmail ? '' : '<div class=\"aviso-email\">⚠️ Sin correo en la bóveda: no se le podrá enviar.</div>');\n      tr.querySelectorAll('input[type=text], select').forEach((el) => el.addEventListener('input', () => {\n        tr.classList.toggle('mal', !dniValido(tr.querySelector('.dni').value));\n        if ($('verCon').value === p.reg) programarVista();\n      }));\n      tr.querySelector('.ver').onclick = () => { $('verCon').value = p.reg; $('verRol').value = tr.querySelector('.rol').value; programarVista(); };\n      tb.appendChild(tr);\n    });\n  }\n  function leerFilaEditada(p) {\n    const tr = document.querySelector('.persona[data-reg=\"' + p.reg + '\"]');\n    if (!tr) return p;\n    return { reg: p.reg, nombre: tr.querySelector('.nombre').value.trim(), apellidos: tr.querySelector('.apellidos').value.trim(),\n      dni: tr.querySelector('.dni').value.toUpperCase().replace(/[\\s.\\-]/g, ''), rol: tr.querySelector('.rol').value };\n  }\n\n  async function generar() {\n    if (S.generando) return;\n    const elegidos = S.cola.filter((p) => { const tr = document.querySelector('.persona[data-reg=\"' + p.reg + '\"]'); return tr && tr.querySelector('.sel').checked; });\n    if (!elegidos.length) { alert('Selecciona al menos una persona.'); return; }\n    const malos = elegidos.filter((p) => !dniValido(leerFilaEditada(p).dni));\n    if (malos.length) { alert('Hay ' + malos.length + ' DNI/NIE no válidos (en rojo). Corrígelos o desmárcalos.'); return; }\n    const avisos = $('avisos').textContent;\n    if (/no cabe/.test(avisos)) { alert('El texto no cabe en una página. Acórtalo antes de generar.'); return; }\n    if (!confirm('Se van a generar ' + elegidos.length + ' certificado(s) de «' + S.act.nombre + '» con el diseño actual.\\n\\n¿Continuar?')) return;\n    if (JSON.stringify(S.diseno) !== S.guardado && !(await guardar())) return;\n\n    S.generando = true; $('btnGenerar').disabled = true;\n    $('progreso').classList.remove('oculto'); $('registro').textContent = '';\n    const log = (t) => { $('registro').textContent += t + '\\n'; $('registro').scrollTop = 1e9; };\n    let hechos = 0, fallos = 0;\n    try {\n      const codigos = await llamar('api_reservar', elegidos.map((p) => p.reg));\n      for (let i = 0; i < elegidos.length; i++) {\n        const orig = elegidos[i], p = leerFilaEditada(orig), codigo = codigos[orig.reg];\n        $('textoProgreso').textContent = 'Generando ' + (i + 1) + ' de ' + elegidos.length + '…';\n        try {\n          if (!codigo) throw new Error('ya no estaba pendiente');\n          const bytes = await pdfDe(p, p.rol, codigo);\n          const cambios = {};\n          if (p.nombre !== orig.nombre) cambios.nombre = p.nombre;\n          if (p.apellidos !== orig.apellidos) cambios.apellidos = p.apellidos;\n          if (p.dni !== orig.dni) cambios.dni = p.dni;\n          if (p.rol !== orig.rol) cambios.rol = p.rol;\n          await llamar('api_guardarPdf', orig.reg, codigo, bytesABase64(bytes), Object.keys(cambios).length ? cambios : null);\n          hechos++; log('✓ ' + p.nombre + ' ' + p.apellidos + ' · ' + codigo);\n          const tr = document.querySelector('.persona[data-reg=\"' + orig.reg + '\"]'); if (tr) tr.classList.add('hecho');\n        } catch (e) { fallos++; log('✗ ' + p.nombre + ' ' + p.apellidos + ': ' + e.message); }\n        $('barra').style.width = Math.round((i + 1) * 100 / elegidos.length) + '%';\n      }\n      await llamar('api_finTanda', hechos);\n      $('textoProgreso').textContent = 'Terminado: ' + hechos + ' generado(s)' + (fallos ? ', ' + fallos + ' con error' : '') +\n        '. Están en la carpeta «Para firmar» del primer firmante, que ya ha recibido el aviso.';\n    } catch (e) { log('✗ ' + e.message); }\n    finally {\n      S.generando = false; $('btnGenerar').disabled = false;\n      S.cola = await llamar('api_cola', S.act.id); S.act.pendientes = S.cola.length;\n      pintarCola(); opcionesVista(); actualizarSelector();\n    }\n  }\n\n  async function pdfPrueba() {\n    try {\n      $('btnPrueba').disabled = true;\n      const per = personaVista();\n      const bytes = await pdfDe(per, $('verRol').value, null);\n      const url = await llamar('api_guardarPrueba', bytesABase64(bytes), 'Prueba ' + S.act.nombre);\n      window.open(url, '_blank');\n      aviso('PDF de prueba guardado en «Pruebas de diseño».');\n    } catch (e) { alert('No se pudo crear el PDF de prueba: ' + e.message); }\n    finally { $('btnPrueba').disabled = false; }\n  }\n\n  function actualizarSelector() {\n    const s = $('actividad'), v = s.value; s.innerHTML = '';\n    S.ini.actividades.forEach((a) => s.insertAdjacentHTML('beforeend', '<option value=\"' + a.id + '\">' +\n      esc(a.nombre) + (a.pendientes ? '  · ' + a.pendientes + ' pendiente(s)' : '') + (a.conDiseno ? '  · 🎨' : '') + '</option>'));\n    if (v) s.value = v;\n  }\n\n  // ─────────── arranque ───────────\n  async function arrancar() {\n    try {\n      if (typeof PDFLib === 'undefined') throw new Error('No se han podido cargar las librerías (¿sin conexión?).');\n      cargando(true, 'Preparando logos y tipografías…');\n      await Promise.all([registrarImagen('pastoral', LOGOS.pastoral), registrarImagen('safa', LOGOS.safa), registrarImagen('uja', LOGOS.uja)]);\n      S.ini = await llamar('api_inicio');\n      if (!S.ini.actividades.length) { cargando(true, 'No hay actividades. Escríbelas en la hoja «Actividades» y vuelve a abrir el editor.'); return; }\n      miniPlantillas(); enlazarControles(); actualizarSelector();\n      const primera = S.ini.actividades.find((a) => a.pendientes) || S.ini.actividades[0];\n      $('actividad').value = primera.id;\n      await fuente('opensans');\n      await cargarActividad(primera.id);\n      if (primera.pendientes) pestana('diseno');\n    } catch (e) { cargando(true, 'Error: ' + e.message); }\n  }\n  arrancar();\n})();\n</script>\n</body>\n</html>\n", "Motor": "<script>\n/**\n * MOTOR DE CERTIFICADOS · Pastoral C.U. SAFA\n * ------------------------------------------------------------------\n * Una sola maquetación, dos salidas idénticas:\n *   · vista previa en pantalla (canvas)  · PDF final (pdf-lib)\n * Funciona en el navegador (editor de la hoja) y en Node (pruebas).\n * Unidades: puntos tipográficos (A4 = 595,28 × 841,89), origen arriba a la izquierda.\n */\n(function (raiz) {\n  'use strict';\n\n  const ANCHO = 595.28, ALTO = 841.89;\n\n  const TIPOGRAFIAS = {\n    opensans:   { nombre: 'Open Sans (como el modelo)', pkg: 'open-sans',  base: 'OpenSans' },\n    lora:       { nombre: 'Lora (serif elegante)',       pkg: 'lora',       base: 'Lora' },\n    montserrat: { nombre: 'Montserrat (moderna)',        pkg: 'montserrat', base: 'Montserrat' }\n  };\n  const VERSION_FUENTES = '0.4.2';\n  const ESTILOS = { regular: '400Regular', bold: '700Bold', italic: '400Regular_Italic', semibold: '600SemiBold' };\n\n  function urlFuente(tipo, estilo) {\n    const t = TIPOGRAFIAS[tipo] || TIPOGRAFIAS.opensans;\n    return 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/' + t.pkg + '@' + VERSION_FUENTES + '/' +\n      ESTILOS[estilo] + '/' + t.base + '_' + ESTILOS[estilo] + '.ttf';\n  }\n\n  const PLANTILLAS = {\n    cabecera: 'Franjas (arriba y abajo)',\n    banda: 'Banda lateral (modelo anterior)',\n    marco: 'Marco con doble filete',\n    limpio: 'Limpio (para fondos propios)'\n  };\n\n  const DISENO_BASE = {\n    plantilla: 'cabecera',\n    color: '#2e7d4f',\n    acento: '#f2c14e',\n    colorTexto: '#1f2a33',\n    tipografia: 'opensans',\n    textoBanda: 'Centro Universitario Sagrada Familia (Úbeda)',\n    fondoId: '',\n    velo: 0,                 // 0-90: capa blanca semitransparente bajo el texto\n    logoSuperior: true,\n    logosPie: true,\n    qr: true,\n    etiqueta: 'Servicio de Pastoral y Compromiso Solidario',\n    titulo: 'Certificado de participación',\n    intro: 'Por la presente se certifica que:',\n    lineaDni: 'DNI: {dni}',\n    cuerpo: '{verbo} la actividad **{actividad}**, celebrada {lugar} **{fechas}**.',\n    descripcion: '',\n    textoHoras: 'La actividad ha tenido una duración de **{horas} horas**.',\n    textoEcts: 'La participación en esta actividad supone el reconocimiento de **{ects} {creditos} ECTS**, ' +\n      'en el marco de la formación integral del alumnado del Centro Universitario Sagrada Familia.',\n    cierre: '',\n    verbos: {\n      'Participante': 'ha participado en',\n      'Organización': 'ha colaborado en la organización de',\n      'Coordinación': 'ha coordinado'\n    },\n    firmas: []               // [{titulo, nombre}] ; vacío = los firmantes de la hoja «Ajustes»\n  };\n\n  // ─────────────────────────── utilidades ───────────────────────────\n  function mezclar(diseno) {\n    const d = JSON.parse(JSON.stringify(DISENO_BASE));\n    Object.keys(diseno || {}).forEach(function (k) {\n      if (diseno[k] === undefined || diseno[k] === null) return;\n      if (k === 'verbos') Object.assign(d.verbos, diseno.verbos);\n      else d[k] = diseno[k];\n    });\n    return d;\n  }\n\n  function hexARgb(hex) {\n    const h = String(hex || '#000').replace('#', '');\n    const n = parseInt(h.length === 3 ? h.split('').map(function (c) { return c + c; }).join('') : h, 16);\n    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];\n  }\n  function aclarar(hex, f) {\n    const c = hexARgb(hex).map(function (v) { return v + (1 - v) * f; });\n    return '#' + c.map(function (v) { return Math.round(v * 255).toString(16).padStart(2, '0'); }).join('');\n  }\n  function num(n) { return String(Math.round(Number(n) * 100) / 100).replace('.', ','); }\n\n  /** Sustituye {campos}. Los campos desconocidos se dejan tal cual para que se vean en la vista previa. */\n  function rellenar(plantilla, datos, d) {\n    const ects = Number(datos.ects) || 0;\n    const valores = {\n      nombre: ((datos.nombre || '') + ' ' + (datos.apellidos || '')).trim(),\n      dni: datos.dni || '', actividad: datos.actividad || '', fechas: datos.fechas || '',\n      lugar: datos.lugar || 'en el Centro Universitario de la Sagrada Familia de Úbeda',\n      horas: num(datos.horas || 0), ects: num(ects), creditos: ects === 1 ? 'crédito' : 'créditos',\n      verbo: (d.verbos && d.verbos[datos.rol]) || d.verbos['Participante'],\n      rol: datos.rol || '', curso: datos.curso || '', codigo: datos.codigo || '', fecha: datos.fecha || ''\n    };\n    return String(plantilla || '').replace(/\\{(\\w+)\\}/g, function (m, k) { return k in valores ? valores[k] : m; });\n  }\n\n  /** «texto **negrita** *cursiva*» → palabras formadas por trozos con estilo. */\n  function palabras(texto) {\n    const trozos = [];\n    const re = /(\\*\\*[^*]+\\*\\*|\\*[^*]+\\*)/g;\n    let ult = 0, m;\n    while ((m = re.exec(texto))) {\n      if (m.index > ult) trozos.push({ t: texto.slice(ult, m.index), f: 'regular' });\n      if (m[0].indexOf('**') === 0) trozos.push({ t: m[0].slice(2, -2), f: 'bold' });\n      else trozos.push({ t: m[0].slice(1, -1), f: 'italic' });\n      ult = re.lastIndex;\n    }\n    if (ult < texto.length) trozos.push({ t: texto.slice(ult), f: 'regular' });\n    const res = [];\n    let actual = [];\n    trozos.forEach(function (tr) {\n      tr.t.split(/(\\s+)/).forEach(function (s) {\n        if (!s) return;\n        if (/^\\s+$/.test(s)) { if (actual.length) { res.push(actual); actual = []; } return; }\n        actual.push({ t: s, f: tr.f });\n      });\n    });\n    if (actual.length) res.push(actual);\n    return res;\n  }\n\n  // ─────────────────────────── maquetación ──────────────────────────\n  /**\n   * @param diseno  objeto de diseño (se completa con DISENO_BASE)\n   * @param datos   {nombre, apellidos, dni, actividad, fechas, lugar, horas, ects, rol, codigo, url, fecha, firmantes:[{titulo,nombre}]}\n   * @param medir   function(fuente, texto, tamaño) → ancho en puntos\n   * @param imgs    {pastoral:{w,h}, safa:{w,h}, uja:{w,h}, fondo:{w,h}}  (las que existan)\n   * @param qr      function(texto) → matriz booleana (opcional)\n   */\n  function componer(diseno, datos, medir, imgs, qr) {\n    const d = mezclar(diseno);\n    imgs = imgs || {};\n    const ops = [], avisos = [];\n    const C = d.color, T = d.colorTexto, A = d.acento;\n    const gris = '#5d6b75';\n\n    // 1. Fondo y decoración\n    if (d.fondoId && imgs.fondo) ops.push({ t: 'img', k: 'fondo', x: 0, y: 0, w: ANCHO, h: ALTO });\n    let x0 = 72, x1 = ANCHO - 72, yTop = 54, yBottom = ALTO - 40;\n\n    if (d.plantilla === 'banda') {\n      const bw = 86;\n      ops.push({ t: 'rect', x: 0, y: 0, w: bw, h: ALTO, c: C });\n      ops.push({ t: 'rect', x: bw, y: 0, w: 3.2, h: ALTO, c: A });\n      if (d.textoBanda) {\n        let tam = 29;\n        const largo = medir('regular', d.textoBanda, tam);\n        if (largo > ALTO * 0.88) tam = tam * ALTO * 0.88 / largo;\n        const w = medir('regular', d.textoBanda, tam);\n        // Texto girado 90º: se lee de abajo arriba\n        ops.push({ t: 'text', s: d.textoBanda, f: 'regular', z: tam, c: '#ffffff', x: bw / 2 + tam * 0.36, y: (ALTO + w) / 2, rot: 90 });\n      }\n      x0 = bw + 46; x1 = ANCHO - 50;\n    } else if (d.plantilla === 'marco') {\n      ops.push({ t: 'box', x: 20, y: 20, w: ANCHO - 40, h: ALTO - 40, c: C, g: 2.6 });\n      ops.push({ t: 'box', x: 28, y: 28, w: ANCHO - 56, h: ALTO - 56, c: A, g: 0.8 });\n      [[20, 20], [ANCHO - 34, 20], [20, ALTO - 34], [ANCHO - 34, ALTO - 34]].forEach(function (p) {\n        ops.push({ t: 'rect', x: p[0], y: p[1], w: 14, h: 14, c: C });\n      });\n      x0 = 74; x1 = ANCHO - 74; yTop = 60; yBottom = ALTO - 46;\n    } else if (d.plantilla === 'cabecera') {\n      ops.push({ t: 'rect', x: 0, y: 0, w: ANCHO, h: 16, c: C });\n      ops.push({ t: 'rect', x: 0, y: 16, w: ANCHO, h: 3, c: A });\n      ops.push({ t: 'rect', x: 0, y: ALTO - 10, w: ANCHO, h: 10, c: C });\n      x0 = 70; x1 = ANCHO - 70; yTop = 50; yBottom = ALTO - 34;\n    }\n    const ancho = x1 - x0, cx = (x0 + x1) / 2;\n\n    if (d.velo > 0) {\n      const m = 18;\n      ops.push({ t: 'rect', x: x0 - m, y: yTop - m, w: ancho + 2 * m, h: yBottom - yTop + 2 * m, c: '#ffffff', o: Math.min(0.9, d.velo / 100) });\n    }\n\n    // 2. Pie (se coloca desde abajo): logos, código y QR\n    let yPie = yBottom;\n    const codigoTxt = datos.codigo || 'SAFA-PAS-0000-XXXXXX';\n    const tamQr = 48;\n    const conQr = d.qr && qr && datos.url;\n    if (conQr) {\n      const matriz = qr(datos.url + '?c=' + codigoTxt);\n      if (matriz) {\n        const n = matriz.length, celda = tamQr / n, xq = x1 - tamQr, yq = yPie - tamQr - 12;\n        for (let r = 0; r < n; r++) {\n          let ini = -1;\n          for (let c = 0; c <= n; c++) {\n            const on = c < n && matriz[r][c];\n            if (on && ini < 0) ini = c;\n            if (!on && ini >= 0) { ops.push({ t: 'rect', x: xq + ini * celda, y: yq + r * celda, w: (c - ini) * celda + 0.05, h: celda + 0.05, c: '#1d1d1d' }); ini = -1; }\n          }\n        }\n      }\n    }\n    // Línea del código\n    const lineaCodigo = 'Código de verificación: ' + codigoTxt;\n    ops.push({ t: 'text', s: lineaCodigo, f: 'regular', z: 7.2, c: gris,\n      x: conQr ? x1 - tamQr / 2 - medir('regular', lineaCodigo, 7.2) / 2 : cx - medir('regular', lineaCodigo, 7.2) / 2, y: yPie - 2 });\n    if (conQr && medir('regular', lineaCodigo, 7.2) / 2 > tamQr / 2) {\n      // si no cabe centrada bajo el QR, se alinea a la derecha\n      ops[ops.length - 1].x = x1 - medir('regular', lineaCodigo, 7.2);\n    }\n    yPie -= 14;\n    const altoPie = conQr ? tamQr : 46;\n    if (d.logosPie) {\n      const logos = [];\n      if (imgs.safa) logos.push({ k: 'safa', h: 46 });\n      if (imgs.uja) logos.push({ k: 'uja', h: 30 });\n      const areaW = conQr ? ancho - tamQr - 16 : ancho;\n      const hueco = areaW / Math.max(1, logos.length);\n      logos.forEach(function (l, i) {\n        const im = imgs[l.k];\n        let w = im.w * l.h / im.h, h = l.h;\n        if (w > hueco - 20) { w = hueco - 20; h = im.h * w / im.w; }\n        ops.push({ t: 'img', k: l.k, x: x0 + hueco * i + (hueco - w) / 2, y: yPie - altoPie / 2 - h / 2, w: w, h: h });\n      });\n    }\n    yPie -= altoPie + 16;\n\n    // 3. Firmas (encima del pie)\n    const firmantes = (d.firmas && d.firmas.length ? d.firmas : datos.firmantes) || [];\n    const nF = Math.max(1, firmantes.length);\n    const colW = ancho / nF;\n    const tamF = 10.5, interF = tamF * 1.35;\n    let maxLineasTitulo = 1;\n    const titulosPartidos = firmantes.map(function (f) {\n      const l = partir(palabras(f.titulo || ''), colW - 24, tamF, medir, 'bold');\n      maxLineasTitulo = Math.max(maxLineasTitulo, l.length);\n      return l;\n    });\n    const altoFirma = 78;              // hueco para la firma visible de Autofirma\n    const yNombres = yPie;\n    const yTitulos = yNombres - altoFirma - maxLineasTitulo * interF;\n    firmantes.forEach(function (f, i) {\n      const cxF = x0 + colW * i + colW / 2;\n      titulosPartidos[i].forEach(function (linea, j) {\n        dibujarLinea(ops, linea, cxF, yTitulos + j * interF + tamF, tamF, medir, T, 'center', colW - 24, false, 'bold');\n      });\n      const nom = f.nombre || '';\n      ops.push({ t: 'line', x: cxF - 70, y: yNombres - tamF - 5, x2: cxF + 70, y2: yNombres - tamF - 5, c: aclarar(C, 0.55), g: 0.6 });\n      ops.push({ t: 'text', s: nom, f: 'regular', z: tamF, c: T, x: cxF - medir('regular', nom, tamF) / 2, y: yNombres });\n    });\n    const limiteTexto = yTitulos - 22;\n\n    // 4. Cabecera y texto (de arriba abajo). Si no cabe, se reduce el tamaño del texto.\n    function cabecera(y, escala) {\n      const o = [];\n      if (d.logoSuperior && imgs.pastoral) {\n        const h = 84 * escala, w = imgs.pastoral.w * h / imgs.pastoral.h;\n        o.push({ t: 'img', k: 'pastoral', x: cx - w / 2, y: y, w: w, h: h });\n        y += h + 10 * escala;\n      }\n      if (d.etiqueta) {\n        const et = d.etiqueta.toUpperCase(), z = 8, esp = 1.8;\n        let w = 0; for (const ch of et) w += medir('semibold', ch, z) + esp; w -= esp;\n        let x = cx - w / 2;\n        for (const ch of et) { o.push({ t: 'text', s: ch, f: 'semibold', z: z, c: C, x: x, y: y + z }); x += medir('semibold', ch, z) + esp; }\n        y += z + 14 * escala;\n      }\n      if (d.titulo) {\n        let z = 27;\n        const w = medir('bold', d.titulo, z);\n        if (w > ancho) z = z * ancho / w;\n        o.push({ t: 'text', s: d.titulo, f: 'bold', z: z, c: T, x: cx - medir('bold', d.titulo, z) / 2, y: y + z * 0.9 });\n        y += z * 1.15 + 8 * escala;\n        o.push({ t: 'rect', x: cx - 28, y: y, w: 56, h: 2.2, c: A });\n        y += 20 * escala;\n      }\n      return { ops: o, y: y };\n    }\n\n    function cuerpo(y, z, escala) {\n      const o = [];\n      const inter = 1.52;\n      if (d.intro) {\n        const l = partir(palabras(rellenar(d.intro, datos, d)), ancho, z + 0.5, medir, 'bold');\n        l.forEach(function (linea) { dibujarLinea(o, linea, x0, y + z + 0.5, z + 0.5, medir, T, 'left', ancho, false, 'bold'); y += (z + 0.5) * inter; });\n        y += 10 * escala;\n      }\n      const nombre = rellenar('{nombre}', datos, d);\n      let zn = 22;\n      if (medir('bold', nombre, zn) > ancho) zn = zn * ancho / medir('bold', nombre, zn);\n      o.push({ t: 'text', s: nombre, f: 'bold', z: zn, c: C, x: cx - medir('bold', nombre, zn) / 2, y: y + zn * 0.9 });\n      y += zn * 1.2;\n      if (d.lineaDni) {\n        const ld = rellenar(d.lineaDni, datos, d);\n        o.push({ t: 'text', s: ld, f: 'regular', z: z, c: gris, x: cx - medir('regular', ld, z) / 2, y: y + z });\n        y += z * 1.5;\n      }\n      y += 16 * escala;\n      const parrafos = [rellenar(d.cuerpo, datos, d)];\n      String(d.descripcion || '').split(/\\n+/).forEach(function (p) { if (p.trim()) parrafos.push(rellenar(p.trim(), datos, d)); });\n      const extra = [];\n      if (Number(datos.horas) > 0 && d.textoHoras) extra.push(rellenar(d.textoHoras, datos, d));\n      if (Number(datos.ects) > 0 && d.textoEcts) extra.push(rellenar(d.textoEcts, datos, d));\n      if (extra.length) parrafos.push(extra.join(' '));\n      if (d.cierre) parrafos.push(rellenar(d.cierre, datos, d));\n      parrafos.forEach(function (p, i) {\n        const lineas = partir(palabras(p), ancho, z, medir, 'regular');\n        lineas.forEach(function (linea, j) {\n          dibujarLinea(o, linea, x0, y + z, z, medir, T, j === lineas.length - 1 ? 'left' : 'justify', ancho, true);\n          y += z * inter;\n        });\n        if (i < parrafos.length - 1) y += z * 0.75;\n      });\n      return { ops: o, y: y };\n    }\n\n    let z = 11.5, escala = 1, cab, cue;\n    for (let intento = 0; intento < 30; intento++) {\n      cab = cabecera(yTop, escala);\n      cue = cuerpo(cab.y, z, escala);\n      if (cue.y <= limiteTexto) break;\n      z -= 0.25; escala = Math.max(0.55, escala - 0.04);\n      if (z < 8.5) { avisos.push('El texto es demasiado largo: se ha reducido al mínimo y aun así no cabe. Acórtalo.'); break; }\n    }\n    if (z < 11.5 && avisos.length === 0) avisos.push('Para que todo quepa en una página, el texto se ha reducido a ' + num(z) + ' pt.');\n    // Se reparte el espacio sobrante entre cabecera y cuerpo para que la página respire\n    const sobra = Math.max(0, limiteTexto - cue.y);\n    const desplaza = Math.min(sobra * 0.35, 40);\n    cue.ops.forEach(function (op) { op.y += desplaza; if (op.y2 !== undefined) op.y2 += desplaza; });\n    return { ops: ops.concat(cab.ops, cue.ops), avisos: avisos, tamTexto: z };\n  }\n\n  /** Reparte palabras en líneas que caben en «ancho». */\n  function partir(lista, ancho, z, medir, fBase) {\n    const esp = medir('regular', ' ', z);\n    const lineas = [];\n    let linea = [], w = 0;\n    lista.forEach(function (pal) {\n      const wp = pal.reduce(function (s, tr) { return s + medir(fuenteDe(tr.f, fBase), tr.t, z); }, 0);\n      if (linea.length && w + esp + wp > ancho) { lineas.push(linea); linea = []; w = 0; }\n      w += (linea.length ? esp : 0) + wp;\n      linea.push({ trozos: pal, w: wp });\n    });\n    if (linea.length) lineas.push(linea);\n    return lineas;\n  }\n  function fuenteDe(f, base) { return f === 'regular' ? (base || 'regular') : f; }\n\n  function dibujarLinea(ops, linea, x, yBase, z, medir, color, alin, ancho, conEstilos, fBase) {\n    const esp = medir('regular', ' ', z);\n    const total = linea.reduce(function (s, p) { return s + p.w; }, 0) + esp * (linea.length - 1);\n    let hueco = esp, xi = x;\n    if (alin === 'center') xi = x - total / 2;\n    if (alin === 'justify' && linea.length > 1) hueco = (ancho - total + esp * (linea.length - 1)) / (linea.length - 1);\n    if (alin !== 'justify' || linea.length < 2) {\n      // Sin justificar: se agrupan las palabras con la misma fuente (el PDF se copia y busca mejor)\n      let seg = null;\n      linea.forEach(function (p, iw) {\n        p.trozos.forEach(function (tr, it) {\n          const f = fuenteDe(tr.f, fBase);\n          const sep = iw > 0 && it === 0 ? ' ' : '';\n          if (seg && seg.f === f) seg.s += sep + tr.t;\n          else {\n            if (seg) { if (sep) seg.s += ' '; ops.push(seg); }\n            seg = { t: 'text', s: tr.t, f: f, z: z, c: color, x: xi + (sep ? esp : 0), y: yBase };\n          }\n          xi += (sep ? esp : 0) + medir(f, tr.t, z);\n        });\n      });\n      if (seg) ops.push(seg);\n      return;\n    }\n    linea.forEach(function (p, iw) {\n      p.trozos.forEach(function (tr, it) {\n        const f = fuenteDe(tr.f, fBase);\n        // espacio final invisible: al copiar el texto del PDF las palabras no salen pegadas\n        const fin = it === p.trozos.length - 1 && iw < linea.length - 1 ? ' ' : '';\n        ops.push({ t: 'text', s: tr.t + fin, f: f, z: z, c: color, x: xi, y: yBase });\n        xi += medir(f, tr.t, z);\n      });\n      xi += hueco;\n    });\n  }\n\n  // ─────────────────────────── salidas ──────────────────────────────\n  /** Carga las fuentes en un documento pdf-lib. Si falla, usa Helvetica (siempre disponible). */\n  async function cargarFuentes(PDFLib, fontkit, doc, bytes) {\n    const f = {};\n    if (bytes && fontkit) {\n      doc.registerFontkit(fontkit);\n      for (const k of Object.keys(ESTILOS)) {\n        if (bytes[k]) { try { f[k] = await doc.embedFont(bytes[k], { subset: true }); } catch (e) { } }\n      }\n    }\n    const std = { regular: 'Helvetica', bold: 'HelveticaBold', italic: 'HelveticaOblique', semibold: 'HelveticaBold' };\n    for (const k of Object.keys(std)) if (!f[k]) f[k] = await doc.embedFont(PDFLib.StandardFonts[std[k]]);\n    return f;\n  }\n\n  /** Devuelve una función medir() basada en las fuentes reales. */\n  async function crearMedidor(PDFLib, fontkit, bytes) {\n    const doc = await PDFLib.PDFDocument.create();\n    const f = await cargarFuentes(PDFLib, fontkit, doc, bytes);\n    const cache = {};\n    return function (fuente, texto, z) {\n      const clave = fuente + '|' + texto;\n      if (!(clave in cache)) cache[clave] = f[fuente].widthOfTextAtSize(texto, 1000);\n      return cache[clave] * z / 1000;\n    };\n  }\n\n  /** ops → PDF (Uint8Array). imagenes: {clave: {bytes, tipo:'png'|'jpg'}} */\n  async function aPdf(PDFLib, fontkit, ops, bytesFuentes, imagenes, meta) {\n    const doc = await PDFLib.PDFDocument.create();\n    const f = await cargarFuentes(PDFLib, fontkit, doc, bytesFuentes);\n    const pagina = doc.addPage([ANCHO, ALTO]);\n    const emb = {};\n    for (const k of Object.keys(imagenes || {})) {\n      const im = imagenes[k];\n      if (!im || !im.bytes) continue;\n      try { emb[k] = im.tipo === 'png' ? await doc.embedPng(im.bytes) : await doc.embedJpg(im.bytes); } catch (e) { }\n    }\n    const col = function (hex) { const c = hexARgb(hex); return PDFLib.rgb(c[0], c[1], c[2]); };\n    ops.forEach(function (op) {\n      if (op.t === 'rect') pagina.drawRectangle({ x: op.x, y: ALTO - op.y - op.h, width: op.w, height: op.h, color: col(op.c), opacity: op.o === undefined ? 1 : op.o });\n      else if (op.t === 'box') pagina.drawRectangle({ x: op.x, y: ALTO - op.y - op.h, width: op.w, height: op.h, borderColor: col(op.c), borderWidth: op.g });\n      else if (op.t === 'line') pagina.drawLine({ start: { x: op.x, y: ALTO - op.y }, end: { x: op.x2, y: ALTO - op.y2 }, thickness: op.g, color: col(op.c) });\n      else if (op.t === 'img' && emb[op.k]) pagina.drawImage(emb[op.k], { x: op.x, y: ALTO - op.y - op.h, width: op.w, height: op.h });\n      else if (op.t === 'text') {\n        const o = { x: op.x, y: ALTO - op.y, size: op.z, font: f[op.f] || f.regular, color: col(op.c) };\n        if (op.rot) o.rotate = PDFLib.degrees(op.rot);\n        pagina.drawText(op.s, o);\n      }\n    });\n    if (meta) {\n      if (meta.titulo) doc.setTitle(meta.titulo);\n      doc.setAuthor('Servicio de Pastoral y Compromiso Solidario · C.U. Sagrada Familia');\n      doc.setCreator('Certificados Pastoral C.U. SAFA');\n      if (meta.asunto) doc.setSubject(meta.asunto);\n    }\n    return await doc.save();\n  }\n\n  /** ops → canvas. fuentes: {regular:'NombreCSS', …}; imagenes: {clave: HTMLImageElement} */\n  function aCanvas(ctx, ops, escala, fuentes, imagenes) {\n    ctx.save();\n    ctx.scale(escala, escala);\n    ctx.fillStyle = '#ffffff';\n    ctx.fillRect(0, 0, ANCHO, ALTO);\n    ops.forEach(function (op) {\n      ctx.globalAlpha = op.o === undefined ? 1 : op.o;\n      if (op.t === 'rect') { ctx.fillStyle = op.c; ctx.fillRect(op.x, op.y, op.w, op.h); }\n      else if (op.t === 'box') { ctx.strokeStyle = op.c; ctx.lineWidth = op.g; ctx.strokeRect(op.x + op.g / 2, op.y + op.g / 2, op.w - op.g, op.h - op.g); }\n      else if (op.t === 'line') { ctx.strokeStyle = op.c; ctx.lineWidth = op.g; ctx.beginPath(); ctx.moveTo(op.x, op.y); ctx.lineTo(op.x2, op.y2); ctx.stroke(); }\n      else if (op.t === 'img' && imagenes[op.k]) ctx.drawImage(imagenes[op.k], op.x, op.y, op.w, op.h);\n      else if (op.t === 'text') {\n        ctx.fillStyle = op.c;\n        ctx.font = op.z + 'px \"' + (fuentes[op.f] || fuentes.regular) + '\", Helvetica, Arial, sans-serif';\n        if (op.rot) { ctx.save(); ctx.translate(op.x, op.y); ctx.rotate(-op.rot * Math.PI / 180); ctx.fillText(op.s, 0, 0); ctx.restore(); }\n        else ctx.fillText(op.s, op.x, op.y);\n      }\n    });\n    ctx.restore();\n  }\n\n  const Motor = {\n    ANCHO: ANCHO, ALTO: ALTO, TIPOGRAFIAS: TIPOGRAFIAS, PLANTILLAS: PLANTILLAS, ESTILOS: ESTILOS,\n    DISENO_BASE: DISENO_BASE, mezclar: mezclar, rellenar: rellenar, componer: componer,\n    urlFuente: urlFuente, crearMedidor: crearMedidor, aPdf: aPdf, aCanvas: aCanvas, aclarar: aclarar\n  };\n  if (typeof module !== 'undefined' && module.exports) module.exports = Motor;\n  else raiz.Motor = Motor;\n})(typeof window !== 'undefined' ? window : this);\n\n</script>\n", "Logos": "<script>\nconst LOGOS = {\"pastoral\": \"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABEwAAAImCAMAAAB+YO+OAAABgFBMVEWbYywusGr0lwDjLinnLynpAG/zkQDnLymSXzblAH1WVVWSXzYuq2UqKI0wJoMdbZswJoL5AKApG3aTYDcuq2XoLynykQAwJoMuq2VWVVVkAGTlAH36WAF7dDdVVapVAKqqAFURcaUA/39/AAA6fzoJXnlXU1MRcKSvCgQQcKXqAIDpAIAAYdo/vz/pAICqAKqYbE3/f3////9VqqowJn8AmZl//3+qqgAAPz8Aqv9V/6qqqlX/oQAAAAAQa53nMCpXVlblAH3zkgCTYDcRcacxJ4Muq2UAf38QbaEAVakQapwQaZwQapwQapwNaZkQa50AAP8Qap0A///wAIMEe7f/AAARa6PmLykxtGtVVVX5AH7+fwAQa6GSXjYAP39/f38PbaEAf/8AqqoPbaAPbKEPbaEPbKH/qQCqVVU+Pj7//wAAAH8TXZr/VVVWVVVWVVV+Pj7lAH2/AH8A/wB/fwD2OjYQc5c+Pn5VqlXzkgBWVVX/AP/zkQC/Pz/lAH0AVVXC2JMLAAAAgHRSTlMaExoenxmgXlxgX6GgH54TXgcR0V/QUc7OjgKQAwQDAwNXAgIDBgqlA89nmAQE1AMHAgEDQgUCAwQDAwP/AP3+/v7+/v7+/gL8A08tb88QkgGvAf0HARX6/gcGAyz6BALRAgOOT7BuAwMEAQIJA9EuBM8EAQILDgQDz7ABcASxA6TJZcUAAHotSURBVHja7b2JY9PG1v+dBAIUGkJCgZbC7Urbuzzrb3u3cRfUjmRZsqzIpkmcfYEmYYcUSin/+jujdSTNaB3ZTjjf29tCYku2NPPR2ebMFAKBQCAJmoJLAAKBACYgEAhgAgKBACYgEAgEMAGBQAATEAgEMAGBQAATEAgEApiAQCCACQgEApiAQCCACQgEAgFMQCAQwAQEAgFMQCAQCGACAoEAJiAQCGACAoEAJiAQCAQwAYFAABMQCAQwAYFAABMQCAQCmIBAIIAJCAQCmIBAIIAJCAQCAUxAIBDABAQCAUxAIBAIYAICgQAmIBAIYAICgQAmIBAIBDABgUAAExAIBDABgUAAExAIBAKYgEAggAkIBAKYgEAggAkIBAIBTEAgEMAEBAIBTEAgEAhgAgKBACYgEAhgAgKBACYgEAgEMAGBQAATEAgEMAGBQAATEAgEApiAQCCACQgEApiAQCCACQgEAgFMQCAQwAQEAgFMQCAQCGACAoEAJiAQCGACAoEAJiAQCAQwAYFAABMQCAQwAYFAABMQCAQCmIBAIIAJCAQCmIBAIIAJCAQCAUxAIBDABAQCAUxAIBAIYHIi1H+xcQBXAQQwAdXUgw0XKA/gSoAAJqAaekFvDJH/RxAIYAKqZpag2xcu3SW6euEJ3CAQwARUnSVTV+/6ujqFwNUBAUxAlbSMLty9u0b+d5f+5+4FoAkIYAKqog00dTemC+g2XBUQwARUWi/6Vz2rJNTUQR8uCwhgAiqpB9TJSZom4OiAACag8vfjUsIwuXsJPYHrAgKYgMp6OehS0jK5hL6C6wICmIBK6gBdjaNk7e7V23BZQAATUEn1aY1Jws1Zm4I6WBDABFQeJmsJmKzdhcI1EMAEVAEmd5OWyd0LEIEFAUxAZXWwcfXuXYAJCGACqg2TZACW2CmX4C6BACYggAkIYAIaizh1JgQmEIAFAUxAJfUgBZO1u1fhsoAAJiApMLkN1wUEMAGVvh+XUnUmd6cQrBsGAUxAZe/HhVSdyV0ogQUBTEBl9STdguAulMCCACagSjBJrs2BjiYggAmotB6gKR5MbsOVAQFMQKX0ItkCFgpNQAATEMAEBDABjVFP0suGr6INuC4ggAmorK6mCk2u/idclerCGMNFAJi8n35OenHO2hQ6gCtTRbYGIAGYvLf6f9Pt6WmhySpcmaomiTmvw7UAmLyPus2DyakpNNnCWBvJiSzPJBm091qtzQ6yYGABTN4/cUtgT0uvNXeC2417Hj6xhvt7qqLuDGFQAUzeTz2oB5MXL148CDVpK3ow0vf3ic/RqHFir1NYDXZ3NhVCkvmQYSCAyfsIk7V0oYkYJv2DjQdPqHgx2gdPJmi9sYbaCpnge3qDs1vTXJIQk0Rp7Qyxa6bAoAKYvJ96QTe7SMMkbWT0X2w8uf0gFkt5MeXqgi/yR5dOEyLbNltqq9VS1P2GaOJyw+xQkqh7uyb9iQYjCmAyqTr8/TOL6Obvvx82c4J+GiZrd6+y9sWLBwQiEVx8ely6dOlqqrH91UsXJiervI06iksTVdlB7+SHRGnI1XFtEmVzH0gCMJlw3bzJ/u2zJoDSRw/WeE0I+j5F4hAhBOG8ei38lxtv6U+Eq2Mh1zChNGkpPdlxE9coGe5sukbJF5j6O5DBAZhMsFVC2LF45fINosuXr8wt0h/9rYHzXOUUmjwJb9R/piES/HFtLbXgmPzg0mSETTBqK6qh+zTpoHeSIyXHnlHiZW+wDcMVYDK5sj5DaO7yz5FuEKCQn8s2Tx5wSmDvTrmmiAuRhAmyxrFMYi9Zu3tpahLu8jvUIzBBuwqFiaoOpdkmFj3Q/D5N3hCUDPwgLAhgMrFKosTT5SvEPvlMKk6epGFCeMBSZK0IRGKRk4mIwmoEIa1jghTf0ZEThHUDI9QoUck/NFQCBfQAkwk3Sw7RYholHk+IefKZJP+872Z5LwitjLulIDJRFbRbSFeJi2PaQ9V1dFQdbctByeALYpS0VC/qColggMmE628IXflZqMuLruFSgyE0tPoknO8XxCippLVJaIiiUQdHbekIdZWsGGyZFAx9rb6j+ig5Ij+AoCvAZMJ1U2iWRDg5LOnrHPRfbDx4cPv2g+VEljcRFpGiCVh2jNE+gYg6RNbQs0xaA5SOktpa8fpYe9tDiRpaJYCSEw6T/sHq6une1eXQyjJLfF0pbpz0k9WsXqUIP8srhyVy+ttj7OAaMOkQmChtwgo/aqKnsOHi4duC0RSNpoIZlEDU9UTD5OD+6qr3wDtYvX9qG24s5pklYejksNCT0TNEbk+FxWZXr65J8mfEMKkfNKmbIvFhso+O/ISOkqyDtchfTYIHowhMNO+1qltQCyg50TDpr67e9/60OkNE/3D//ikNl8wVYUlh4+QBmrpw9SotVl1LB1cbs0xkRGC14f63+5ULONyYSUvZQQ7yq+p78VKTdR8PSjefDDZGZsdHCU0GQ9T1xMLkwOfGzPU/z517/RPR63PXKVDunz5/5zO0eOPngrq8iH7PO95tdOFqrEykQYbI3BPQbu/R6tLqGV2MaKxEMTTyJzcES/8YtzT2vUp4x84HE2pvUpSoyt4QYiUnGCauSXJ/5rqHkUjnrtPDnTJv529o8efiujGXZ5u43UrW1tbWRgAQti6l5m7FGton89wvXa3qUVCDhBarmait+BFYHEZj0B1adeYvqsk3S/bcT6Ns7pLPBsWuJxQmfRobSYPE0+vrqwQzp+nq3ERzP5fSFZSZ1NngbWQxApjUTQ1jZLgoqVO6+s4NvCr7BCbHnp+z6x+JBkt2iaVBUHKc77JsI0RMGG+94ADqSorr+atpV88nBCaUFDPnfhLq9Z8zaPX0tCtdLGWXeK4Ouik+3ov+eFhCvJyv6lwHCx0bqgcT4p2YuCKQ3AisQatD3HwOMXKw77Toe24p/BHKL2TTqFmihmYJMKKoXkV/mp4AmKweoKnrGSjxrJPTY5wcloiXRDTJWPu3zOvvOgJdIGeuZ5g4rQAmlAHrlaIuvp+jE9Ok48KkS9GBt9CRG3el0Y/cA2MbtQOz5AhtQ7CkxD2cnv7oow8/+mh6urGAdXGY9Akjrr/+KVfnZk5JK3XrswosybJNHozYyVnzA7y1UzkYzUcwUVtmtf7MnkFCEOJ4yWFipLjDmng4bsOkAoFUDeEdzyxR22CWlNGX6KNfff3y4TR6/nysMFnNdnBYXUenooxtEV3+uYrmRDR5wlsPLBUevAWAl+oXrGnEHGiFUvbRXLWjDN1+JqYddDbRiKFBPRzisuhF+kw71MVxP8KeCTmccj4OYckvnghPPkT4+RhhsopuFUQJNU5OQ+DkbwXqXgWmiTBBfLWBgrQ1YSeCq1cv0U5r9UtMEjAxrGrzGFu+aaJhN55LPJ7/i8ZSVXUfF3GdMNI3fRfn1JslG8uuJG0L+9ye/iVgicuTD5kQyshhch/NvP7ppxI0OfFb0B2WTeQwMDlsHiZrXoY5YZcQehB++P1fp7xNRQ/qD8g4TFrqfDWn26tbI6YJ9iOwu/rfXbOkXcQssdb9cAl1cQoncfquThxJoj//9t8SDvg1+pBliUuT6THB5OAWuv5TKZ2bOem2yXJFJycDJi/QVfl2CTU/Lvn0SN3MFw+eyHi2abR9AGOadLCJqcpaBx5ElA7yYEKL2Gjd2VERs8SiKwW9LE7B7vZfPXz5MPjzd2/fnhykkFv2zeOLVI+X3ZFY2zBB078k9OtHDdCkCEwO7qM/fyqpc2h1lLZJf2VhZWXl2eyKrBHze1UnJwMmT3i7WFSU68JQgtyOX4fl27efPHny4MGLF9Umj4W5EGCyOXQ6R78yj46OHMcxTa3QghrfNLG6fr81YmZ0CrksxBTZCcMlTv54eOhz5MzLM+Qf/4cvb50EoCyjx3/8EOjRxW9Q7efBHfTRr0mY/DItfzO0AjA5+D/o3E8/lafJ6Kph3yxEf15YkXFE63CxKkt+viKMmXw1VdPPcQMktOW878L45sfUbQ8fMmwQ3tT2e0FHfk633d7d7+71DCP40WavY+aXooamyY4ScElPRVJ5SwrJuA9Cr3fy2dN3SXLm/Pmz1+7d+/77e99fO3v2/JmX7nh/2594llz8IaaLtW2T6TRMGgmb5MOkv1qFJa5tMqLLT/CxMPuBq1ny58/HGX11szmimMmLmrlhgpKrF6ZCD+Y2IYjcqaEhc55uCMyHAGOb0FU0tHuz++/W3k576BwVDr6oqtnxDqfsrJNjY40picd8CHlpHBp6tfIeqNQke0k48n1SZ8+fP+MaKJPMkw30+IcfJNOEB5Nffp1GX44aJv371VjiZohHxJLZfz79ccnVj08/nUWo9mA5tDIME9qYfo78c+XyjZLxV6+cvkbHtLsX6B0hbkwjRh/eQu2/q5ucCg5/bV5S7r4S+7q/nMa27QI0cU2Tnt9tbYe6LxpizCFad7KbOr1tboZvsPKtkjNnPXpQsyT4070AKC5PHk4sT5aXH/0gmyb/xoWJfNMkFyarVVny00+jqV4jLPl3QhFfBCifrrypO1R+F0dfaQfpUHNX0jxZtDKW5zzxaVJlpd/a3atTaONBY84jmaW0IkyhUYnEdHaQrqpJlLjb5h3TN5phhT3WsvMsW14oV/VzzMQkIQAafrFr+hYJpnUnyY6Ohzb2fZxuLku+81EScSSS/7NrLk8mFCfL6JMUS3549E3NpwSaTsPkl1+m0fPRwmS1fOw1Kq2fGUHLpDcrK09DlHg8+Wthoe5IWfw5o3v07zcPqf72Ox3YVxLYWcxe6kdoUj2lM9Vkl00rqAjzcq92LCaL99WkUUJIQgOh2LNLTNNxnIH356xYrMY4TJ5hQpuY0DCshrw+BUGVbHR+jWFJzpd4i75zUfK9SB5QXPtkEnHCcXIkmCacbE4jCZ2c0Vk6J5wImzS/TOcZ+ivOEkKTD9B/1DRMrogSNeh39tF4SEOtMetkMa8JwW10+4K3k+da+SU2TbLEGgQrg72qMJtBye6mkjRKduaRv22eubvf2zRce8Mwdjp0t3Bx0ti0dYVZ5eOggV+HtktbJVmO9xmUNoONwMciHyonhdy/hc5cy0JJxBPXPPluAmHyBw8mP9QMmqTqTJrxc7KH5+rqzE91NNM4TWbRB0mWEFdntl8zCntDwJLFlNlx8xAthji5sYgW8w7tdymaytIl/trfFw0+S9f9bor+PN/zF+C4TYs2FSVulXj9mylJ3lFbgoZiXbl/2qR76gm8HYxYy6SN1h0fUzRfTOOzSqrRgbfauIhd0u+j87koiXhy/i2atFRxKpMTmSa/yY/ASvdzsmFyv3rAxHd0Gl6lk3ZyPEenVkrnM4GXc5lvddyksRMajL1xBWU1IAj14Ele2zNuPUqz+1UkC9N6lBV0VxoeSo5CX0aLMSiMpbT5K4A1dGcvermq2xFaaEMCJ4zzKpvmu8MgAeTVquWzxI2WFGHJ954ndO2MhFi9XMNk4xEfJjVNky+5fg6BCR4dTHKL1V6fO3fuXFad/Z8NmyYLHMOE0mS2Dk3+Jgi/zom2s6BNBxa9vYcLn6R/cHDwYoOr2xtcmDS9k9YgVkvixS20fbc9YiwrHN+ghhoOSjo2u6ej9AoeB5mMv0S7EXQiM8XQLDP6u9LzaISRoxZjyS3KkqIo8XFy9gx6eBIMk9pRE/v5x7/ygiavRgaT1YNMJ8fr+0qmxcyfYp7MHDSZ0Vl5s/IjFyZ/oTq1a3Mli9EITj4LoCJBB2hqjRsyedLkSN5O1pLsI7OTRgnt3xzrYEQX/tIQakAIRfF7xqNkpwIzXKjnezbH7u5+3j902Z/DwsVrnRQ0UiJos3LskpfXSrEkME5uTRBMhIbJD3/Uq4Od5gZNZEdgp6o6OedckkytrtIjzPw5nhjsAvqUxxLXNKlME0Gvxhs5Zoclb0l8n7OIh/ZebHTHNBwELMK+JV0jgRJ3TV4qO7tFN7DZbHkBk5ZB5BagKHuD+CUx3YV6aktpeVFWtYUpKFS13fUbr5nMR1Dd/UPdKIrq7kycx5Iz35dkiYeT8+jlCTBMfvjhcS2avBJUmowMJvczMjkUJfeDxO9qVq+TmX5zpsnKm9klAUw+Rc+q53IulzVMJOsJtyPbpbod5nPSOYmaeeqstJJmicnL+9IfbQ+G7d3d9nAwwMg0h22a7+2xUViLVr/S3YaVzaFXTa8YFB2q0vaiNQQYd1Cw259LExM5eEBtF2XPySmIe1iJJT5NzkxKxOQbMUtqhmC5yWECky9HBZPV1dfiUEh8HR8BxlfnRKZJc7UmQsOE+D6zlWNr1t+4uZzF0Y2qJ5zthtfuXm04WCgoc2XMEl20Ji9GGG/aD/b/3mUsE2y7i34pS0zkNW5TDdpYljgwWy7FFMNtnxT5Pe4rqd+jbpo5AZOvyvs4k2eb/MarV4sK1zZq3ty0n/PrxyPL5mQYJtdRKhJC2HJOZJo05eis9GcFLKG1Jv2KpomgkcllWRGRAhKs4Wl4w+AtXpkrk8TZMbOW2NHaV/J/m/LDwutaciwHxSIEDNv+Uh/V20gHe93qVcPxtsMgDs9u8Fo3+qrqOWv7+v0zFVni6jx6OxFOzuMfslTPz/maDxM0GpgciKOvM2iGZ8cIaHKusRDXQrpeTUJ2WLDG7woaoWmCbvOWF0+hDdQsTXpC06R001ULM/FXHPZb3PSIFO2cMY+2kWW4nQmO/V8ouwF5DG8lT14i5ww6W4Ml339/ptloVFGYPMqEST0/hxc0oYUm9khgMiVMCwuW3AhzP00t0RGkhQOtVAzBCkImc2iEPUcfcLvFNp0bxmLThLo4WuULYPl1riFLwugMcXLWfYTQRtV+i4I2djysqYoXicU5AZPztVhCadIfP0suZrLkh0e1HiWYW2kyIpj0X8yUXb43JfCLzjXD/TcrC08zYLL0QUWY8KtMLpcoIWkqaHKh6QeoJoqaFOtIJBzIlq663QpUbwkh9kIjLi2GlhY0OFCHyKtaI5aJbYZY83bEyHZyapGE9jt5Oe6FOhs5To7r59SMwP46LpgIF/jNiEe0yNFZbcTXfyaMvtYsNTm8Md5cDuJvikFzw08aPq+mGQqXJTjfxbE8RTEUx9GC5YLm7s7mpuGW2SO2alYx6Gj2m6i5MNl3LRMmSUwr67MNk35NJ4fS5Oy41+ksCxblSPNzMP6YB5MvRwCTvmhRzp8ZERCRo3O9iVqTWTSbxZIfl4if86aSSb7ID5ncHOHQ6nPL1q423qUbW+Zm2tFRdrIaPlsEG5pwoTDG7LPP+0tUm6Z0sROuvnG3IXb7Ou7S9JBvJNEtABt2cjxH5+FEOzlu3VqdIthXvAjsaGAiKqQ/x4u9Mgc7N6rCtf7nz55mwoT6OQtV7BI+TOZG6uYQalyVv/14Ec86DROV7k0hCJdYmhPOdNOZd47MsLWJ3u502kPak4CCRtOYBtRRGwKvc4m/LCja05zYItirMKEvsbRahsk9TzkwuXZrnHs9FXByfvjhUa2Ceh5MRmOZCFM52U3nBW97vSp/EuQ4OV7dWjWYzPFhMlJN8SKwBCaNlq0R+8PcU1Is6QhMA8tr1uoMdzvd3qbXDtbodQcUSk7Xr6vf2yd/T7HIDbj6NfQa8ee9jPCuZ5morQGxD9eDxcI5lkkfncnrXsL7S8rROT9O04TXXk1ycpi7cHgkMBGlcq5XW2UsvxPBQo6TQ2HytFLdGj8zfGPEo+sBJwJLc8PNpnO2rXRuON6oiAmv0KjoYLe7R3uzeQ1hDdoK1nMVnZa3RIfW1e8kat38TYfdonrFMLWwmWPbgwnBh0W9J9PP6GTv0vMyx8uhvaTPnz3rtYTNeuGZ8e2FkV2uJidoMjaYHKCZagttDvozI+kGy+88kNRClRDsZMCEX7bWcG7Y5CRzqI/DM2HIv453d1qqjwx1c2d3wPJC/4Jgxl3ao3pV+AyGXF9GMdw8tEJbrOFY3NVfIGwhvOO2XdvPhInYy7kXdGj0oHPmfFYPNhqDHZdpUiRgUjto8mpcMBGt8Mu3MG5x3yk9ObyS6+RUTg4LYDI36hGW3hWD5oZvS4yPaBpOLMTrJBf2uW1N7PQ7CRHc1Tdq0HZt13Sdm3gcdtBRoz6QUQjXi7cSZLhrdVTTor0baaF9G92hvyL/ddFjWWi4SQycnSyYiL2cewQlboD27cuXbx+6A/Dl+SzrZFymyQZaLsSSekGTccGEXNPXFQtG7vevc9/4leSAyQf5LKHJ4f+QBZPR1qy5xuElXqGJPJjgIBUTfC8nsWrYKzJzUnkcvEVeu7/pmR2uUeLaJNtx6GhuuNXcUfzisx0cIsGvTNv1OiO5ZSSun6PsogGi25gfB9eaHGG4/8UgqxjCXS0sMDXOsF3o+/233xGcCNsnjc80+S0/KxwGTZZPDUwKpHj7XAfp9YzUCOxKf2WpCEwqBU2EMLk50hHGjcBKLDSxiCPS9jap8OKo60hP2SVqelUMRYROjZKgyn5PR34v2PQ51hEKusdGLe8tP2QyOLQ6foGr5no+1J8x3eRRyK+t3O8hCpnco61Kkgv4+m8REq/iuTeeOtjfCjo5NYMm05MFk9f3C9iB/OzwjMwKif6zjDU5tZuaCLI5oy1a82Cy1hxMaN0YBcKm66BYW256Nr2ZRTvpYWwTW8GPhXg9CYbk3duWOD1EjROVraT3E8FKLzCF3PQwRgbd4cKiyZxY9bzmOJlFmm+FIZMzvOV7/ZfCfmz3xrN8eLlIVtjXJzUsk7HB5IALk0Jb9PFr6qUuz1kp5OR4QZPyK4cFRWs3Ruzm8ArqJXaBxY6XnVX8bItjmZtpJ6eTSOSQSU67qrG9GdGWlkMttO+9QyGUWEdByRo59r+8jLBb4up1enWQoRKkbJX4Ig/5MKFOy0tBVE+AH/qW0VsmhQMmddsQCGDSfDn9fYF5USDBy08EyYQJXd9XECZ/Vao0WbwxAX7OA15TaWkw2Wb6I9IdcMh03kuzxLDjoFhH5r4a9VXc3EW0m0AenNf9Zo0uTbAfMnFX79ne4mGCj233p0pnX1FVE5fpctzvXysZTu3fEhkz916OnibFAyZeW+nKOBEUrY0PJkV8lYOD140WmhQMmHhBk4UKo2ODv2p4lP1MkCA3LAsmFhrEfBpF7aULTJKrdfEWpYIadV07QluFbAgctJF2aWKhI5q5oYty/Gb0rmmCrXlCNWIp6aU6pgvir/e+vyaO+RNXR2DNjN7PeVI8YFKzrfRkweR1sbAH973yVuf0VwoGTFxVCZqIduDK3PaziahJuqWJLJike6qlG8xTR2Sd66/kdF3juTpBNxNCk4FXZbJDUBIs+HNDrpjuc0zDuVqp4YBeilyWlxnWTJ8XhR1DPqdMwKRmBBZPFEwK9l+c4RXPyoNJ4YBJ5eU5gn7SozZNeC1NpAVgk91eeSuF4xv+hu2N/EzvnTItCbD9bkcJNx6lIHPTRNjfqocGS9yAzHCASu7kIrRMMrunfSfIJ18bcTfYUgGTmmVrGKVWDY+m09oqHyaFgMDt9igtZlI8YFKjrTQ/aPLznDXeliby6kxwRks1vpOjBYEPDwm75bquIdv2ugy424AaiteikULNUP2s0baHEbvkrlC36B5+pWEiSiiPOjm8XCpgUmsvrudoerJgMlPsgDPNwWQFrZRgScWeJoJWa8Q0GWV2uM8Jmsha6Iczu71yyug1d5cKxsXBJXNb1rbvWalqh4ZMvKrWAGpB/yNceoM54cqcnP1wuBnlUa/2K7gkR8paP15zpMmHyYsGYdJ/tlAiYOL1qC/f00RQaUITOqNsA5v2c64eyHpuapxq14RhYjKNSNbZQnvKErN8zFfz80UulIh9gpnYDe3YWE1VYXKL153t3mhbSy+XC77WC5rw2jaOZqsLLkz+LAYEAUykFK0VWpJTOwJLaML3c24sfjZSmFxIeTnS1vk5edtasH0HYvFat718hTNaz9+FjhKFh4WYfb+YfcpHAxP0XxzTJDtsO/aAiVe2VhEmX44RJn9WXvrbIEwWygRfa6z1+0yQzxlxh/qNWBHs2t2rUxK7mWSHTdwNKCK7JMaSo4rzHkcbDQf95jEaCsrjikpYAHs+ByZv++e5MBldzKRYD5NUBLaiuN3p32OYrKDZpbIwqRaBtQQh2NE6Ol+9oNnhtYglMlsj2Zq5I6aJFxENXKKEXYIrnjKq2Ff2sccOjL2es/m7WZSDSb7DwksDjRQmFQImVN9UPN00HybTY4JJQTdntSmY9D8v0sMkWbZWqW5VVGry8425v42wqv4FrTVxQUIDJpLbrJHvsaOINrYw1rHQx9mqfErs1syz0d0tpLsVLl5yeLQw+e4ap9RtZF0IqgRM6kRgTyZMvuOkhl/PSLhH5QMmVSOwCN0UmSajzei8QLcveL1gr164LXsHLiuWoonDZDc0FEym8L6lqGZFHyceqVHD7mkY6d8qiko7NdojhQmhCadwbWQF9ZUCJnUisNwd/U6AZZJ+72sJt+hZ6YCJv3C4ysZ+wqjJz1fQZyOlCblDUxempvw/yxWtTOWliFXDtJPGRFB7sl3nhNgOu0QHByJM2d3ZVFqmVQkmpdf5TQhMsgMmj/4gkhuB5cLkI/RvzcOEW3hWGCbnmoBJhYBJ5YXDrhV6WUCT0ZauBSWv/QfeBJBNE7fbmXi1cLwxQbojQWnX6tgvvQ26qSG3YuX4C73iouwMmJR3c0YHk8yAySeP3dK0i4IIbDUDdeMkwoQbMqnftrE/m7V935IriRFYdGgJak1G6Oj0vWFzsPHgxUFop8gV1lB61y2auD30zQaTZUkXmfVOdxjW8auGE9a9aTWsnQyYfFchAHttNCzJCpj8QTfu21he/kbwmqoR2HQ1/ThhUqxojesh1YdJVsCEYOTpX3/99eMSPwL7ptIJf89wdEYWNnnADu3+bTQle3vQaG+9+Kqcd96vt+0eG3x1cM3oM44CMG4j6Sh8g+XC5PvcvMxDbmp4NDDZ2FjOiImg37yHiIAm1SKw3N1BCUxeTTJM+gdTrysXz4qVUWGytPTPWbeWhOsG0QhstfHx2eENIU1G0dnkwEXHkweeOfLiwRO6jlh2e3p/Y85U+NWzFdiuJ27A5F1tdoVwUtVjG9f/AkKY5OVlHgqK1h6OxMn5Q8ySjY3sl1XrQvCct2/5qGAyU5EIXAwVDbeI7ZK+MGCy9O+z9AWfrwiCKpVaN3omucjR+XlxFLv7baCpu5fcu3PgeTlTl+5KhwkaGOlejYZp8QImHVR38lto4LVWE++hIQ0mOWv2+v2XlcK2clhyMYMlrDP0mBuBrbJynFcAK71royibUxUmq7zWSLl7d+WZOwvCHiZLf62ghZW+OERbNQKL0KLQ0bl88/fRwOTu3UsX3LLXF1MXLjWwcc42b4mO22rE9T3mmXhKqu1aJcOEnk51/6EtkSzcHEy+z4bJQ9FCv7cjuLGPC+Z9N9AjWV0IRDDBY4NJvnnBN0zqNloTOzlL/6Q7mGe9bOnTipYJpcnlMQZhN/xVw2tXL126dLWZXbg03goddei5M1rcyRnWdnK806mq2YktFW4IJpkLgPu8dX4jWjW8jB4VsUtEJsyjSi1tuBtdTDZM+qv3X/8kvQXs58KtQCkpovhqf2UlHYSt1oXAs8pvzonCJv+z+bCJC5O1cHHOWgMwsXhNkhTDLyfDejyTs17/hLSLNTnSkaEG3RqbgklOC0ZR48YRZIbFmZyUA8O3YSr1geUuzSEweT4mmLzOL4lf5W9R/Pp+nXv05nNRVpiyhD0wbzNzGoGtqkN+o3o3bHLYdNgk7GeyFqJENkz4Xo6PjW12JaCqOrj2xPf2uFCHNgpNk9qe09uMVvMvM1jCX2s8gmp6caPGPzjlaMuyduKaHh9MDvgwyWdJxS2Ks6OvoqwwMTqexW7+Qp9nwsxWNk0y8sPNOzq85kjSYcLxcvzKNOnRV3+Vj2KYyDJ908SpfdS3VfateCjq9Xi2+ZDJ8jePiu/9ucHL51QqqOfC5ONpyV9OBJPXFVbrTfW5Tk69ZI4wYLL0dPbNm8T84/k5lSOwaKzVJgKYPJF5Do6Xo6pmrAlaUMaG6y9wtCzq5XSQ4wSmSacxmBAr4zuRmTGFXl6r1rdAhmHySYmtP7lBk0+qwYRTAPuxZMOkhGWSC5NVfvS1Xsjkzcos38mhOeGVVHTlryU5LU0imgjL6hvODzcIE6y5Mm2el2O4K+40NGQ4o+xLSONi95A0UGL7FAt6JDUCk+9F8Y++cIfQ5kMmYieHa29w4yuVCuonECaZTLglcHLqeTmirUCXlmbRbNoj+oAXga0eNUGHlihscqPhFX8NwcTdTzxQlxsycVCsvIxO+mPLlgCTferl0CMF/lXtxT4EJudFMDnDH65vRSwZRcma0Mnh+y6iCGx5/Q/+ouH/ZwQw6ff5bk4WTA5WZ14LDJMX1ZuZzAqdHN4uFjyXiHpDtZ4lc+NZP9wITNyp6wyGu+32rj4ccDa8UHapEUKtCFXQXLr6uXuK79lo/h4Xie00KkjYtlFUM/IyY+fyxnvTC9f3/SFyXZYlFdTbvKU5sjsQCKrJVnmbDWdvfsPtG+tFTKobJjffLAgW8HGdlxW0wimoX0F1aCIOmzRbCNuQZaLv9wx3i2GF38rEy9fGOiLRQGl9w8R2y1/9DTSsdUPx/RzcFEx40dR+n26NcU+0CeC4nJxHy0I8PJJTUD9xMPkzqwRWkBUmTs5BE05OMpETDBZOM7al2TpBk4ywSbO7cjUAE2wNv1XdVkQ+JDgsaTluGOOIKbOvbz94hklbYZq/SgrBvhS7OdfShsYtJGTJKCrWln97VDz46psy0tI53HV+44NJVj39fVHApFb09T8ETs7Sv6+scKvG5Edgs8ImjTo6TcAkf+8txaAsie+EEfUeqSMt8nLcdo2Bn7NV66iCTbj8rcvjefQ+cXHOil5MWzZ+1bRhcrFs9zR56Zz/PXEwuS+2S0QsqbMxaH+FX662JOyfxqtJqdrSJJS47VqT2w/Lh4mNnNxdQT0rJN731XAkfB1vv3Li1tj+Z5Hj54hhkvJziJlyXhgucSMm3zXKEmGnxj/EcOAX1Jc/t6gDwdejgAl/5/K+yMY4uLX6upFMzqdL5TaweCY9nTM2R6cJmORvMezuIY5i1PF336ttmOgK04QeS8rn9NEZMR5eMrZG/61rltzLQE/TTo6g8UBGwERaOgcLOhCMDybCQpO+MPj600y/upMzK1iTk7F2b5abzvm8ZpW0tShapHMFzZ0cmOBY7Yhw8y0nUWSi6jVdkYgeyn6AjqArk5+JrnGVXmbx4UyEEprFydKZhkvpM5ycLDjISefgkbQzKQkTPhlmRMHXek7OLH9ri6WnKyui9MwKmpWeziG6KcoP3/h98STBpK3kwmQX/Su+3Z9iaDK+jlv+2hpEdoiXl1aM7ZpX6UwGIM6jhy+n+v23txB6mWGWjMLJQRuCEpOcCMg3UlbnvBpJO5NSMBGg4ZaQJbXaNYpKTLIaznML6n+smc5BGd0Imquq58Bk7e4ldLv6ER22pwCTv4n9jQZbY4Fa3/GpbZjoamyrLf8cKsuXajC5lkkTT2fOf5/FEprJaZgloo5Ij+7kgOGRjHQOgcmvY4MJ32/5k+uzzIiq6Ikps1rdyVl5s8ItMclOzrxBT+WuzglsE5GjM3donRSYbMUq0fg0IT6NFu9MUL9K1WNHx/VynIhsftBkt16qqN/PCqp+f+38+TNnzp/NRInrEDW9KEfU9jWnaIQbaCnfbE0EE3sUMOE7LtyOJhksqePkoAV+9HXp6ZuFDOd2hZ8brg0TYSFsYzFY+TChfo6a2MRPbcX6NqqtY9qxXleZnwzlwIQaImZU5hdkn1nAVLtMZzNNDp8iWR4OYcnU1JhqX/P6pnHf90cFN+ejSYMJLwKbwZJzdRYLz3LbCWRkhQOYfCqzP1IkYUanqX10GoAJ3bpiJ44TtRUrPXG9jpg7RFsGSIiYUGNHMRgsYb/FgbJTzzJ5mAmT7+/dC/6VwZJrTQdfxa0aH1eBUPnc8NeCdiZojDC5fpDAw6qw8JWwZPV+jQ2GZ/m1r3lFI9zc8FMJddLWocDRaco0aQImdN4O9jeViCfK5l4KJvEqk56cirW2Ei93tfz0c93jv82GSb7u8UplZUuUFv4kz8bgh1qWpcDk4+WxwuRcwrUkaBHlhGv2ahREX5eeLnzeLw2TyttdsPqbqHStoSU6jcAE0a7Qx7s7LdVfm6MYPQ5MDCW5iri2l0O7vyZyzO5Zwl74FZVRT1+cJVONs+RixW3IlwUw2ZABk69HAxNBY+h4Z+jV+2hGzJJaAZM3nwvSwnnhDz6EViT4OYQml0fZdK0ZmNAeBDT8Oezs9FQBTNC8EYu/Smj+ijRDVY0j9id+W0jVOK514IcZ9fSTYpcIN93Kb03C949K54a5jdY+lF1mUhImr/v3fUS4fxCGS2oGTES7lC89nc2hAq/QhCaTF+pfKeGOoYvIOkEwoTPbcywoMpTNBEx0up05m8zRJbg5bhVcwqHxnSka8rVrXaYzk84SceeB/Bxvn1u1drE8TD6cPJgQRqD7q1NTqxQpGWZJTZaINt3Kz8u8EXRulAAToWnSTK0Jt2jtEpKzGM3auuO4bkbCMqGuiIn0VmyLi/rJHCeZGEbhZoJ0mfLYYOKy5LumWSLuR18ECssyCk0EMPl6vDD56Zy/cnjmegZKiD90UM8w4Udff5zNq2Xto9lmCk28GCy/DHYOjQomV+U9RrdcN0NtddVE0doddv/h+h1HPMuEnItgSWsEJvdqseRh0ywRLvAr6K6ceJisZngw5/68/uefmSSpu+vWM1Hta4Ele31e1dqnMmIm4hjslSYSOgLLRBpMNC5MlF10xFbdK4YUF84xVBqOseXDhFyoa9VNkxGwJGtn4QIw2eBXrclxc6ZHBJOZn2roej0nh1sTX7CZAG8n0frrhoOwCT89fLmJviZNw2TdjVmorZ04TPYJTDqSYeKuMFSMeNbL749UGyb9yrnhnI26pLFEuLNwEQuDG2+RA5OPTgRM6gVM+s9W/hL2fc2FybOmqtaoRC0c5xoIwfLdnBfSYBJUk3Rj9fR0vz3pMFmnjhM58hxqwDJ5WBUmo9mmXNyP3q0+y4XJE36D+vcGJq9nbtWoVhM6ORQm/VyYrPCr1iTp8PDGqEKw3GzO3dtIHkxcZigJmPSQSbvIM3+XsfvWjrdhDgdmatgvqaJqFJq8bH4Dvw1uALVEBPa3JmEymmzOQR2Y1NtZWLxLeSF3pVmYCKImTVTBNg0Tx2OG0jWUeNvG9RhM9mTFX5PNHwPLpG65/sOKMBnJ/n1ZAZMgarKcY9m81zC5Xqug8Oab2R+FMPlxZSXPX+F1VJLQ0SSQtXhjRH5O8zBpezBJVa3FYCLDzXF70SeSOUEPAnICXPM6Vc0Nn++/bZ4ln/yQrYsUGL8tL29slHCTHpVtQXBSYfJnvYDJiqAffRCBXejnWSYLPzYIE0HUZA4tjgAmBCdT6IWk42uo7a2NSezENUzARAJLaCMkWg4Xo4bfBbb22p/queEzqOEO0hkVJoyVcfGbrEP8Nzex/E3JD/Kcs9PFL9MyloMXgsn9sQRfxbuUR81MnvXzYLLUoGWCFkcUNGkaJn6DeMXYVxL7lsdgsjlX+0x0xxw30Bpfw+Qv9Ku72UUffXdtQmFShCXUzvjk4sXHj4XuDm9/jMcnCSYEJ68rBl/rLBXmRjziHQj+8TlCn688+3zl5ps3b/q8scVb1bMgKZ0jakVwGd2UPxanXMemKZhgr3Gi2mon0zlsnYmMojW3P4ra2kqcfujBZLduuX7l3PD5fuPblP9QRo8EklBPP2aYoNfVWFLLMKEBj0yY0C1z/sGUxvfTmu3L34eL0SHfNJlrYCjevJqEydrdKfRAEkv+hf3dw9vJCGwMJhLK6d2VOdQySXhZipzeSxWbEDQfgF3OCb7WUNkSWA5MaDuT5xMNk3qVryv9hR9zWEKNkx//+uCD2YWVlZUFPiHk78PF6h3XNJlroA/Bk+ZgotEJ7DVxVHZ34hFYk2201lKGtRf6uY2skzBxvGSOYtR+Or6tnBtutidSQSenkj45UTA5QOdGzpL+7MpfuSxxcULl/vEpTz82Vk8vDsE2UWmShgltTy8BJpQOw/1NryGsshPvWU/8jmFLagsCLky8bvUyei9VTee4W+U0R5ONkk5OOY+ofsxkhDBZrQKTej5OVoWJEClc8QpUFuRdssURNTXhw6TuzuVuQ5PdPTVot6b0TDURNBmwMOnUbo7Eg0nQZ1bC4Wss9TuLmlubs5ybFa6j5fow+Vh610aJMKkZL6GtSEqwpJSWni7IewRxOxFcHombIwMmxBDYZRs3qq35XjxoYsZ2uujJcnO24z/zVuaoeu2QTB89vFZ11fDZM00ZJxtZZfT1VXIfLi5MZLeTFsLkfmmYnLtVy8ehEZOnjcFEXm5YUAV7o4FsDi9mcqlui0FiEuwpcb9m2E62NIntwbVly4FJbNGwfRR4OfUzCrdqLPW7dh6ht03gpMmISfkI7HhhMlMSJrTNSS27JGNJjgyaLEhaN4xEpSbyd/bb+Ooqr9XaVE2WtNXETlzKfsrP6bC5Yaduda/n0sRskGBzwdpVJlQ1VueQtxHjpAmcNAyTT04tTM5dpyg5qPdB+itPG4SJxHQOMTAvjyKd8wBd4vUgqBWApd5Fch8uYh0kKuoddrOu+oUg3tbFsbU5W175K00d1S/Xr9kG9vuzLxvAyW+NhkwKdI+Ns2T6l7HC5M+CkRKXJOj+/Zqf46aoiYkcmHwqpddaRj7nivSeJgKYbNSa1rsplpAZjXeT+RxD5vagNjomJ2FDraFhImUfjbptYL///jyxTh7KLYfdaK7IpHxBPRcmH6L/PbIA7PXCIEH3pw5qf46bzYVfvXXD0mIm/G3M5eeGOTBZu3u1ZvSCu9uw7iTbEOzENi6vbTyYRqyftI39E6q6HJjcuva9BJzckmqdLDfKknIRWAFMXo0MJn/mgeTPGWqN9GtttRVpocmQidwILDdoMiqY1AqZaGiXAxNlB8UX+6mxkKxau2zNbTfLNC4J9xk25BR0r9bfiMuLnfSlNZdebjaZUzICO2aY3M+yTKhF4pskq7I+x0qjMJFZUE9osnxjBIUmT3gwWZuq07gxviU5k7DR1YRpwlaa1PZzvD5IxHvyyt/MoF6/fjgmiMDWhAmDE0mZ4oZDJiU3Lx87TGbEIHEJcn91VaZZ+Dn6q1GYfCAxaPIZJwJ7WXoTgie8mMndeiv9cDzWGiWD4yFY1ezG8zl1I7Btd1cNL2hi+rsMS4qYoDoF9RycSIrFfvOoWZj8cYLcHL5l4sdI0NTUquTo95tG469yC+q5K4flV601AROHGzQhtkfCNOkOlVhXgrreiOnu0dNG5joxTvRNz8lRTSxn2Wq9CGwcJ24stvbgbjgxXDYCO/aYyQy38RHdFHS1gSKfhX6jXo7cCCwvndMETC6kWxDUXJxD+8QH+RyV7jfs/oWGMxKmydCQ2Qd23WWYqrbJn4/3vUIXVdHRO1nX6sy172Xh5Nr5l/W9naZzOSUjsJMJk/urqBktNOvlEKtnQd4uEbwa2BvSL8ltAUxu1wtftP/uUURpqZs77XawQiYZNdmX2YbAttxYjar2ut1ND2aKnExOYJqcre/neDiR4u1sNB1+LRmBnVDLpCGY0K1ymtXSrLwa2BMME6qBru922rrudnL2G7GaiYSO0omXmtSuW/PcKxdiXgc3vfYKPzYCe14STFhvp7p5stx0+LVkDeyYYdLn9m1sDCbPms3lSI7AHnIKTeTD5AGBifQSWMRiwcIa1v2mJvg4bpoYbAhWrd1uTYv5UYqyd4S25V2qhzJh4ns7NcyTjaaLTMp2IRg7TEZpmfSLdEWanBpYHkzk91p7wLFMKEyW6x4Yaxqm/7eiSa70Yv3VkltgENOk5tS38PxmcDxV2dxF8nwcoq9qbDic4e1UjZ6UM0yC7ox/UH0S6I8/HsmLwI4ZJoQmr0cHk4XGDZMfl56uNBozkb/bxQOum3N1Q+pJND9Yog6xlVih01OZvxxZNePLGA32FEWl8ZrN/SOEJa8L6V/7XrK8YCw1T8riJD9i8uiPTy5e9LpILy8Lb+jy44ufPJIUgZ3++H2BSf/mbMFFfktZPZGyW1H/OCstnzMamLzgtKdfu7v2n3LP8i40TaxBwtGJt0iq65UQeuxvqq3NvV1NrllCld8H9p6r0jjxzJNyPMns/frok4uP+bblxm8x+S96/ImcCOxYYXKLt2y4IZg8y+1Jn+zU+Jerf/71KdUHH3xA/v0X7deYQZSlWWnd1n4fFUzWuJtdHMg8C/Zbwaptizg6amIJIBM1sXF9miDTPHLPKVt5Edh7Mf+lLE/KmScZhsmji48jcNCNt7Jti41liovHf4jK1pZPCkxWRwiTmwtiw8Tlw9N/EmL844PZ2ZWFhZVnC4K0zOzKBx/89ePSUuMR2M/4PQgkw6TP2+virrz+9PHQqFuOmliiE6+wX5dwKvovLH+TdzKK88rWzp4nOlueJ/dCd6coTsSGyUXKht+WSzmqG+Q9/AK4R/+NasFkdC0IRgkTccSEcuTTf8yuJP2TN7OeFp5RrayskH8veL3OVv4hoInEPrCHo4IJp2+jjC6wiRnud6lvI0fjFduHZbASfBO7CZKg/BpY11ehFozPk2rmya2vCrFEYJg8IlbJbxUiXhuictrl4kETLkzwCGHy54hg8uaNKJWz9OOn/vx3cTG7skI33uqLNijov5l9tkIMlH9ycbL0VF49/dxIths+QFc5uWHZMAlNE+MII2dTRBNVdSwbTayyy9Zob0YqOnDOnL9WjSdni1knIsPk0Tfom4pfTrD7eYmduMa8b87oYCIyTJaW/klR8uzZ529KhL9uEmR8wDdOZiVtu3eT2wRWft/G/+IuzrkkGyZbQaP4brQGj2ea9BqIdYwiaHKPsOSMP4K+ekibDJw5e60yTvKaFIgiJo+Wq+f0BccsUbY25h39uN2RmoAJsSe4hsnS0gfUIqlwQAGdyPHk+Dnc9vTyi9b4rdYITF5IPo+f0FHdAve2mCYdZE4sTMStG+n2OC+ZV35FrYszFdwdv4fS22qGyeOS22YlTJNP6i0c5sHk14+ef13iMzzHr159Pf0KV4HJ/VHBRJDKWaL17xVzuXyaSCtbs/gb50jf62KKwIRTaPJE9nmcoImisb3upFI6kaMjYfVwg26OuGztTHJP4f7b0N0pi5NrZ1DmNoB9gWFysZY9KTBNamVzaDqnEEzsL7/+t+kvo0O9qmKZzIwEJm/6XMNkqc5amjfPeHUrS3/J6ULArTIhMPmb7EvzhFtPL3Hv8iBmElgjtFd8Fk1krs2Tra/QNQEZrvG2t69ontBu9l9luTqCpkiPvqlXt8y3d4qXrXHdnF+mn3+ZY4tMvwpfMT09/RHRNEL4+aTC5JnQJ6kx87mmCW3dKKMI9nDxxmi29OPDRHZueDtqWE+XB2uZNDEnliaisjV3E1CuDVHJPPH2xsjonbn8Q81YqQAmF2sdlQsTYppMYxFFpqefMxD58MOPyeupfvn4IyTMKU8JUwmjgUmfW2NS14pYecM7qpTWjfy9hpvYbPgBmuKkhiWnc2hLxZAdyuYxtrGYJsrmxNJE1G2Nhl8FYQ7GPClRe3KPujoPhIbJxbr1ZSUgVTwC+yX6kGOZEJqg6Vd2xJAvX309HfElTpHg/b/++uG0iCZjhokgvLG00q8HE65pIqNs7SZ3C64mMsPceno3Antb3jnW44VqSg/RBcKpjboY2kxo3KSPXt77vhxMQvOkXHKHvPCM2MR9xI++1oUJd+3go8JuzjQXJr9QLlC9+joWCEnYIr+kdyl+bpeCSR/9n9cjgMkKtylS7cQLtwukjNaN1s25G1yYLDYxP7glsDJhoiXbOLq726wHnRV5NJHZh0Tu1eIGTbJhEjdPStgm/9XnT/nHTRkmXJOn8GEFMPnl118+/Gj6VejP0KhI2hbh+kelYIIOXqRhck42TD7n7paz9GO66LX0gdOQktG6kdf+tamNy4mu8tI5y9IO/w7pyeU4apuwZB2ZeyKaSNhqvBEJWtTnwSQyT4oHY2kcpl88TirBMBH4OYUjsCKYUGz88vHHHxKCfPzxLwFEhBQJ3zTNX9cjhAlv63LpMJlFny41soxmhdNTlkZg65WtWYKASSMhE+rnXLorvac0I1s7MhRuyob8b0cQOFHVXWRNIE4EDZKSZSZZ5klhb4cS6mHh8OsjOV/wUY2Fw2KYRATJRUh+VlkIk6kRwITfk55M+jd1TQhuH8ilWWKx1IqXiFjSwFbDiDZuTBea1O4pHXNyuoogZYNt1Ba4Oqqy824CjZM+elmkZk3ME4S+KhqMpY5Ov3D49WKderXo2J/UiMBmwqS8RCuOS8HktfSIyQdLPzYVKE3nc+rlmxc/Q4uXBSy5Yd1sYH4IcsOy0jlB9wF+ygYjc0fh40TZG6LDicPJf3H9HKFLIvB2iponZ9AtjmHyqF5tWdmgSWGbZ9ww4S7OmUFSt7l4g3jFZT/O9utPzWccB2rp00KFcIeHSSvj8ObvtCRNEHttyssR5YYvSbJMtNSOXF4Sx6cJ+ae9yfd1FHUfoe0Jw8nLPj85fO1t4UF761bBXDH1c14WDL9+IsMwEfSVLbp08Gv00Zhhcp0HE5l+zgI//Cql7J2Xcy7QuvFQmOCdmxOZJXSVn9XE0voDbnuku1cPZLVHMuKoUFpGSJNthCzN3eRG5bo6xDhBeKKWEd8StCG497LEE/ArLxibZ55wS+EE1a+lthgvGTQpemz5MCkXM+EuzrmOpiTe/mf88Ots//P6x+aHY1Zy/Bxikiwuzs3NLbKZXvqDK5eFVolrmHzW0AzhdTSRFYHFKB5+VdShvy0opYnj2i7E1+HjRFF3TNrpaJKCJoKtuLgeSV4wNts84UdiBOFXOSzhoqpoOOYVmpYKk4/Q/yhpmXCq1s6hGZl3n7csZ+npGylLaL56ww2aLGQHWkLz40akn/PUTMREFDRZk1VQH4+ZKMqeiWwU0ET3lgj7OFG4OOkOaKv7iTFPHgqCJrm5YV4wNs88SadzlhsMv4qiu8VdqHR7+hosEbVCKQsTiW7Os35j4Vc3uPtp2QgsdwuLAppDDcGEWwMrL53DlKwpymab/MBa91fqKGob/d/0NbT16/H+psIxT4jJskOcHbQ1IfYJvw0BNSLelj1U/kLAtO8kKDJZlmSZcFcO/1H03f9DZgSWGCavUCmYcOvpf5qR2M6YW/0qrYs8bwVhdjhGWN2ao+acHLelyVpzuWHshmCJ4aHS7SdcG0NzaUL+p3b8zs/2NsHsLjVPVA5O9nYHyNvOaxL8HO7Ev1Ypa+Amd17y27LxVw8u86tfv5L1/epEYGX6Ob9+aPMLYDNiIAernM0urvfvy2MJt8jkL0nbeK4QJyrtQt3M6EaxjC5XYcnlRjI5/oh+kOoDu3b36m1ZPQgwNg3iwmx2dRRuP2G6HQkIN5SdO345iVujNvhiZ5MDFPKTXnvgo2ki/ZzMpTS55kng7txLlJl81S/ihsjzcgSboReO7m7IMk1+/fVD4Z0Ww4TbUvockgaTZ4Iik/6CpOdUOiJDa2CFZs9iNSfnxuJNq7n58YLTVVpiQxOMzC/aepwEGOlqGDjZ8iMiGkXNYLi/5+0XrMZ50trbaQ/H7+cIVg6XSudwkjsvz5+9x/LEXen3X4XmOjUdZO2axqVVYVZ9+XxaDko+/kjcU0kME149vUw/R1BksiCrlIXnRS1ldCE4rGaYzDWzKkdAk7W78pwc1+jw+LEVJ4y/zk9RdyPKWC5PkDPc7e4Z1DWKq9Xa6wys8cJE5OecqTOkfHfnbLjxxT1e9FW0v/AfSNpKqmU+TIoWML6qnx12u5lMCxb5ZcNkhgsTaQuHVxosMvFP8MFSiejuoaC3QI4Wmwq+RmETQpMAJ8THmZLbUNrmRDs0dOSt81NphgdHv9/Cvi90PNzd7ex3qPY77fZwqJvm0Bx7q5MHfD9HsJCmuLtzi+GJe7yXxewGmV4O0Td1YPX8lV3H0XH7IrkdCyq0baS/4ZTA/vRaHkwEuZxZSZd+tlwEVriGL1P/s7ngK2Ob0PV+a2sUKJdk78El8H7Qvt/J0TVOmOyvhTVnYns3CtpK14RJGD4hPDnrdlq7VTCiQfe3kCdeuqjEIsLn9vTHv1bkCAXJR65F8m9Z22NkwYRTtUbr1uRETd6s8Lycp7N9WQX7b3hBE3EHt9+reDlX0GLzU+QF8nDiokR6b3oBTYKkMb/WldgzmuOL/FHbwrY9CfUmfW7dWn2Y0PDJQ/cgL88I5sxy44YJ1/j5psxNLUuTX0OOuCB5Pv1l9hmyYMLLDf/0emZVRtSEl2yR6uUg9B/poAlNPPflweRKg4mcuPmOpqjIA7A/GpYw++d4ta54gnfgygvBSoEJRdUtuo0X92knqFhblhZ+pQTnAatMsT6hyYdFOw14PQlCjiD761f52bqpjAciFyY//SnFNBF4ObNI3r573FMIT1ABJqNiCWGI59tsLI/mdIneBD5OcFUyjTIE+7IpyyQ4Q1/ggnzCXeMn9YbxKupLrfwht+KjX3Jw8muIkYAj6OvpV8X2/staa8MrNKEJnb6EsAk/l/OXRJaQQy3waCXIPH9WNjN8Y3FkLCE6ePDgwcGIzoWRGe9NoPo4KR8ssUdcfMItNTmDmrfnvnnU5Bq/IC7zuOYpnk+j6Y8+5jZC+jWkCIOR518zDadrweQA8WEio9ZE4OV8IG1zce8kaT9HfAbr91L1r5cXm4+9jkk42Rk2Kp3fLsMTm77YnNfR6FLG/f4ZyanhytNcal5YGIIte4ZXiODkw4/D9mpRmzWfIgFGXk2/wmX3Is6ACb/QRE6tCbdibelp/w2SCpMPlornhhdLpXOuoGbrS8YpG8eXE7tmCi2db1M6YK0QG7BbvDJst+dHuqloyjQRbpwj1wG52HTEhM+sR6Wr9d09Qb3+8x+63V8pQyKIkBv3dQWM5MJkVQST6/XTw7PcdTlyDRPepjxZywg/Kx41IWbJoXVaWRLsZB6yxC2a91YD7nxB0aA52WuFsVfgpu93O4MRf3iOaTICL4e7yO8TtCz/PBclpIte/Rv/rk1Pv3plP6/x8TJh8udPAj+nLkz63K0oni68kXvb0/aPOGZSgiaX59CpdXE4Xo6y7+z3PJ6olCe7rqlhEaJsJZFCF/w5XphkuL/X2z9GCI0Yug/iCZ2RGCb8ho1NRMuXNx5JOQfds+/VK2zjV6/In75+NY2fS/h0mW4OP53z0+vVunN+llf+Kt0wQf2VxKbDS9ntkYrQ5MYVihLr9LIk2c5RMTTXytjz2prQxX69zm7ou9jrtNYE038FF8Uc7u5stpQdeqzRXyjX0bkXVr+f7fcbN0y4tfQX0XLj2GroHI1YJgKY1O/eyC11f4o+l/3tPk+cZ+mv7HMc5sRNbly+cpOg5BCdamlsyERV2shxS+4dlyeefaKoxl5nd+jEN+SyTZ24Nj2DLgak+3kNxvHp+7dQtKXWtfMjyORwu7/+IbNeLXay0KN69Fh2UKY5mBwIYVK7CnaWvwhPOkyIqRNrkZTbEnJR3IH+58tX5ohRgv52ylFio0GLiZkoXbdSBLtlJoPdPT9prPqLhzd7ve5Ot9PZ6RKIGKq3plj1txodT1MCYol4bUiunT0/iqwwP5mzvNHUudDjT/549OiPTy6iCWNJZp2JKDdcPwLbT1eZLH0q28nxaRJha6nAXhefIXTlRtogISBxC+f/9hk67Up0c9wLl+J4PIltj6HGVg/H252orQEaU9lsH3115vz5M2cQKtX+tc4M/6OJXfz4+m8UUGTCWJJdtCZK59RtBcvp9rz07wsrb5oYV9SjCvQB+o/cNxweosUIJy5G5jxb5PD3m+g9UCyZQ1tLM2EPPKcdt2KpHmPTILZJt0vXDuvtWK3bGDcSfej/52EfjQgmyw0uykk5Or+5/1qeuKGTDRNhOud+3Sn+NJ1mmW3kC/bfoNl//EX0z38U9KOo8TF3hWouWMZ3+Pvvi+h9kWW2wtawm4M4EIjZEvOBjHgRWzxy20ZjW1/c/46ApD+68yUcnU+aZMnkKgsm9/nrhiXkhlM5W1ltpHn6nAnVFBNTJn/z999vHr5fQwIj3fdX3HYmKR+I5UUPzVkaXUGM6eJhbTcGk85kbnHejLWAHj9631mSY5mIcsN1S2D7K7OxCKzU1cIprax8TrSwUMKNIqYIpYj1Xo4J29stR6HJXZwKqMRKUHYQk8+xEqHbDnLQe0ST3z6ZzITtZMCkj269FsCkthnaZ2my9NfKf/QRaHJsE6TvbP69nW48kIRJO0ab7Zif837BxEuzEOvkj8cTFxidBJgII7ASNjC/iQhNlgKWzPbfwBSepLCJhmiRiMbBzDBWaB93gzQ0fH9hQo0T9M3jx+h9tUvGBxPaJZ6mWWjC9p8yu5iA5BgnmrfoNx1PYTwZxcBxR3CLNU3GGYAdk3Gy7DMFYMKDyXVRCWx99VfQ7D+e/vjjv/8DIbBLTorJghwWJknbQ2Pjs+8fTChPNt7j0ZEDk5nGmhAg5Baprcw+QysQLzlBNGFq7dVhMkDL9GhTW/PvUTYHlAeTPpp53SBMkLdF+QLchRPk/jAdHTkF8xZ21KAVdUtDFlwwgEn023NNwoRaJmCWnDCYRLUkqp72YzS/F7WqKN330MsBmIg1w6+BfQ3X7X2VHQVN+Cv5tlHHXeu3t+uAkwMwYSRoaQIweX9Fu514tgfPMHFf0N7p6MdwpQAmcfUBJqCkn6Nveg0IOgI3xguUaODjAEzi4leaAEzebx3rw939tjBXo21jDUKvAJM0TP4EmIDitgmAAlQNJjNNLPQDnWhZWNMwuDGgcjDpHxy8bqI9PQgEes9gwvdzzknZbhgEAr1fMJmR37YRBAK9fzDh5nP+BDcHBAKVhQmvd+NMHwKwIBCoJEz6B/dfp3a6uAUXDgQClYRJ2jS5XuBNIBAIYMKhybn/T+YOXCAQ6D2FSX91NYrBvp6BtDAIBKoGE7pd63UPJ6//vAUsAYFAVWGC+gQgMzPXr9PqEvBxQCBQZZggdN9nyCr0RQOBQHVggtDB/fv3ASUgEKg2TEAgEAhgAgKBACYgEAhgAgKBACYgEAgEMAGBQAATEAgEMAGBQAATEAgEApiAQCCACQgEApiAQCAQwAQEAgFMQCAQwAQEAgFMQCAQCGACAoEAJqBJkeULvhh8wkmEia3hSDBdqwwzuAQggAnC2Er+AG7G5Mo2PQ3mT9kXMwf+N5vY4ef4n3DgAEz4KNHIvwbtTrdH1e209a1JwwnGmoYn89HvzPs60ni/1kz3lxLHHkZmy5PSRdopQomGuor/zXSEJ3EsrKO2/wmVNsIAE949RIN9o6VEahndITpV47QxyCHTCPT3DtpOvWC7t0l/t2lsS4WJStVSeqcPJt430ydzqrow8S49wIRnMmOk76hK8EjwpCrqnk5+NyHBCOfIHOrtfXNSPhA7sQfe8Kfjq4vS9gc2FPpLpeVIPed7a5mQsTDQ9XZnMJaxAJZJzshE+2qcJP7VUrvvJuJ6EdgZlG8quX/aJMIkvGIdLkxUl84GwEQCTKghOM6xADDJMZl7PJS412vPnIQLRmDS8ibkSYYJWCZyYDLesQAwyRyXR5silpALZpjP8QQMMV1tAUwAJhMwFgAmGfGS56bBsoQGX1X27z1Nm4Ah5t9AgAnAZMxjAWCScfe2GB9HVVpGr9czWgxeyPzQxj9fOwCThK2vukk39dRlc3qK980UoZvTGTtM/EvfAZiIngRkKmx2TPpDc9hlcKKOP0cHMEnak2jQ87Q3+SO65J3+1v9mgsTduMfCO9T2P+G3bfIXgAlrM0Y+jbJzh5LXrV8z95TI0Rn7BHYC5AFM3ntN9Fh4n2Fi4SNDZSYCwt7DADvoKPJ+xm+abANM0kf1ddqWA1k5i8PWxz8WTs7ytamRzoMOa4CYFjN9TVWNYnw4fwRoFcc1faed+zl7FQYQOXCet4C3tNrTsQGY0GLxsRXn2RXPbudcbhtL+Vpa+bHgnbnC3M8fQQVGtzZG6ozUMjmODJOWGfvSTsQZtWVm395whFg47/Zq25qr8FoHPxe9EdM3mOtGMIC8t29j0UvJ76z4ocVzBhX+2I3CRNNi12Qr+OB4K/NKiq9EcJG3Ld5vtrVCF0XTcua97V9uu8CHxcwVzplc/l3kDYgSYyHUFnNmK8+awPGvhDO/ePCyLAMm+uPWaYcJDrNc6RSjbZutADSZzwD3N445nNcHZvj3wk8ZhExd1wfunc56pQ894nEVP/RgXs94jNJ/D3R9XjcH7uutscEkeTi0Tj7XkL54xOaJO+8scnJdP7bdaV/iItCLKboX9GCWQy+27i4GrvesLj4W/PM4pnvmo+jGFxxB5rxe/WLSL22a7sUsPTFOIEzeISYtPEj4Mlr0S+6KE/+SkTk43OnRF5H/b+4Mc6ig77apdgf+X3cM953Gzi73attI/8J9gw82teP+rf2Fngr1hy/dNZFFS5v2MkLHFDWdnuF/bKO7e1T9ZteFyXzbuyZt+mvLuybUxdzc0ZHYv3Ta4ZVIYTA44Bdm8nf0N7vtjNnjXhR6dqPXNrOuiY3ML6Jbgd3LbXDzL3Q8zO9HF7vX0cUHtoK76F2OimPBPxY5iTP0z6y695meWnhNwxO4R9T8r5T+hP4Xp5fXzkKRvr8XXsx93V0Cd3phEpsFveQ1jopzOL9kLlnHUIMyN/qHzXbGEMTIUKIiAoy6avTOPZ2TaKOhe7fsgK2p86orsOildM0GsblURQwTDZl0YaManlzZ3D+qSpN6MLHJu/0vpdOn2VHPvyb08+0doS3BOcV1JtvkKRAWQjicN/XQNveDIL0b3kr39DsZaylouC08iXvklsqFCTlCm8zK4GLTA7fIvd4SR0QEdSYlxkI4nb3BGZ2ZnHpXSBMcjqAO9dra3ldKB4AL1JnQi7kXv5iZE+Pkw0Rjw6+pC/MO6a28oMk6uWSxell6h8lIWc+AifeyIY2SxJYEKSqnoNBhy2BidbkcmPjfxi1M1OkIEsHEQ01ijfRm1eRAfZiEtqGmzSeuibByS1wBG9abJ00F/wqRY/LiEehdR02tG+9kzLzgcncIu01qdHAtE8LtvdQqUnpgEeaFFbAlxoJ3pKMdNTE4g/G5JYRJ8JVMfwTxYZJXAUt+vJP80u6Jt08xTLps+ncrPV5dAKui8ReblBGGFXGIJYSJe8BOYuymP0NVmDjeeQQwofOAeVgFf1QrlvrWh4kawMRMfl2lZR7ikjAhzkoYVo9NSC8nphom94BRZRFzUZQeFpjyLEz8j82DCcG6v/JLDRrlBO9abxQmGmpvcr5QNqEjmDjY8L9SBZgkL2Yrd2KcfJhYd8JBp7YGHLe8s9MhHrauCxrURZfVK8M3Wr6BLrxoLEzC52c2IarABGOvFI8Pk2i8eh+7Fc6casWkEmHCBMSz0/KZMAknRfwb+d3ZuEckvwumnr+iwn9KKLmFqEoHazrPEPKikP5xVdXodtrtTjdYqiFoICALJrQaM3y4+YOTWbzKLQdgYEJGkNKqChNsRRdTZU+tjpwmI4OJjY4jq8Aon8yIqmeVzY7LIrPTyl7QycDEOjJcZscs0dQjw/EbbzHmS9BfLMsy8R0oLkwii0gx2vRjD9qGUmcZkjSY6LbjRhRaTJsq6mFaJWHC+Dk9xtbDYi/Hxk5wDdSuTi2Xo3YvoMmWZmXChFzuriKCiX8nVHU3sPCHwU90vkGRDZNiY4F8oTAXqbiRZGZwChdHRjCJRlAFmFjaduCrKntuUm4QzotR13+ODCYaYxuQG8JZZuA2q6eFRjb30g/D23WM/EoRPZg3po1zLBMyFnvE6tlllgGlTQPh06grhona67TFCwHeRTNtjwwya50c5zi4+ZXutTyY0C/b3aXXJJoy/Cd4zqrh+SB7SqwdK56eU415ftgzfHYGBRLBzOoKfcXwcnunS8MkqD2gk8ivbCWv6CgZQy4LJp2iY4G1PtsoKJ/Rw0hsy+SHirvJEaRWgEl0bmWf/nWdObVizI+0ZHlkMElUmZSdRRj7YFCMO8h0741tBldNEBRjYHKs/t3P4Q9CZ4s3+Y+PBoPjQSccGuaA6sjhJH5CiyNMEaWPFy0gUI0jr+TXMlHg7ykGHiNMTF3ZC1Lmm9nlx9kwYfycaLxbxBBVRVOvHU0907NltGgJAzdgiTmXmwMT/wFP4yrBydwHBLVKTa57ktGC4IiOBTM5FkyHl+xiboh3fWwnWocmikF3OV+pLEy2oqdV1z+3fSf6WWekQdgRwiQrmZOn7fDd7OP8f4XGr+B2BTAxu4qJTGL6aCYKLVLibNl8h4w5l0jJBxfx/b9NfyvmY0dDAddqUSEPJr3NO8E10dXMZZZ5MNGj364nvmR6jlp28BHIy83oYeHfF/6DAScvt2rsdRMwCTNVqs5A2tZMQzW6bWe9XMwkNRbaGWOBJnmpC2Qwa0TCRRmC24wTZrA3gsrDJLDymJry/xUdeqStC0cIk24NmCAneJqzY83Gg5aaNQcC17xNn4F+7iEaHoaTDhBYlvUvKxpA1pxgM7U4TNTWzpD7jYJ5oxpbTGxSC82VeXtMMFFbHYJKM2UqG6VjJtRtD/2c4wijXdfLSUdAIi6oQxtzxofODdnGLrfa09NJoneBLaDqrNdrI32+QIaRc9aiYwG7bQKMZATa7ihZwz0OE7XV1c3MtAMXJtusYRLicgsPq/sApx4mmLGMLY3jfXPd0ggmLSNcUmFbprAMN8mJjHB4DCbKpo54C34YG6SLMN8v0MYDE9dBD86t2boq9NrzYYJZUy749bzr5XButG3yngtIs3S1lZH/YS63H2rRRO4T57Jg/tKfXMuk0FgIXmvGcKDxbz4fJqIRlAeTqKo8NjGs0CbPWej2PsJEY4w59tEZLx0Tw4S5nVYYL5QGE3WTOE8462PHP19smI0NJkonfH5HP43FUIvC5B1KPQiD3NswFfZkkj8di/mIFnJ8K9PAdiZMaHzV5Cbhgw6LKi3Nj9bgiiNTsmCiOVuY4/2pRWFCPzF/T8E8N8dkbhxm3lXjcXXKYWKH1ywRdQvzxayRx4MJc0kZe0UWTHRkZn9sOlbZrOkwzJHPo3HBJDZ9ooSMWR4mCFvBg9DQ2LyYwolKReMgEZe0w/vCmdeJiJvJJ0Novhr+UhtLy17WL9UyseLQKgUTwQjKg0lUL6EaNj890AWYpNyFMC/MPs2iInzVwFkxE3aoSIeJcC0RZrLhDgNBSzCjRwqTBDbqwSS6GMH3ccMoXC+HvSnssTS7Jy4wY86gGMIaxfByu0Vr/gJt2s3PHgVMQqa4NQ74XXGYiFej5cCEgUbcZ2S4OsK6tRMBkxhok2ZeSxg0YbDBBLWZRTpyYKLqtmjlR3RL4w+eIGJZwQqVBhMjZsrVhIkev7OBL5Oeoc8Zmh0lfheVl2dZJuSSidKdRyGjvfUWhtHrtIdbyG9L0DxMYg3RzMIwUXVLqwST7ciPji2132IeY8ej24lwhDDZrwwTdlmPkVCrlWEbh2Eoja2m6kqFiWLkM1BNbvxrqBk4GBFMkDSYROaG/4D0vjl/9cywJbyVqjA9zcR4UwxC8QxSbO2gt431rolES30lwsTnyPFAb3e6vV40NPNgQqwH4XzPhonNRgUdHt2T9t9pgUn1ojXGmFCVuLI6KmE2pt0cTLrijgnRcEm4073KLu1EwoQxHFwL0XaDKLxnRqwQmn8vs2GS4RJgJkYVRwptb6A1CxNqnVp6u9szvDGqqqpaECZZ0yEvAGtwV3oxMBnldjujLKfPW8adMYEM8S6A4TVbHxNM2vkwIc/oQ36W57TAxGSdkGAs61nlr0Lx0tMMTDKsWvHBaep1q0mYaF6bqQCJamzhcB5MMg5dFSbOqYaJHX0/gWdgaZqGHUfTtCow4cyr0cBEbEcyMIk/bKXBhNeTbnsMMIkKMd1v6k392Lo/XlpGuEdsJkyyJoeGOir/8PxFb9Jgso7MnVZYFa+2et1OW28XdXN02ZaJFdlopxIm8RYE8yUnUOgaGjpfQzPjbc3CxBFFuFjLxLaagAmv8HcclgmzEI8ewEML14ZgYdLWh9xbqefki7Yy7d89To8i9xYc2Y3BRIta7ajK5o7upZEKB2AzGjJWhYlzumES281vmPqGtK9nt9vtdNrtFBgYmPSqMGjsMFGNO/wYUPktx3JgYgcOx2hhEnVwU+jCBdO/vHZm6Mws862LwYR+uvkdQ1U4Tc86Wct9a8EEM+1MWu42lRhjExeEiSoFJt24m2Oeajcn5tByvmHQ5ZPG35M3lg1YYmeLJ80aE0wy6s7YbM50zEgTBOGLTasoypgJE2N7hDCJbpG7eq+tiFuSRQFYfYt7L7XshX6D7FQnrSk50mmn6qBxXxSKsZuByVbYHoN2QqK1+xYqUbSmZn2lbJhY+dmcUXZIGmVDabPVymrYFa4yMLbE/kKZPNC4YcLUmSQfPtVTw8ybeRWmW8Ew4jdvbxAmQS27gTWxlxNLDZco2Eumi7K05X5Cc9je91Ir0VZNqfPJgQnrhR+F64ZHAZOYiStMDZ9Cy4Td6oKM2cTyS2zp4uB3rNAvcUsta2Jhwt7SeAVs1AZhWPq5wZSQUlfGEkxqbvizOZgwB9b9PwqmiCOu/rWkwAS5C3P89zntXkb1gBSYMDtoq2aUUxwFTDBb7WTzPtJIt5we1yZcHXHLzXSWN9YZkHdfsIMnECbPY2XzW8ycOW5FFVhl6xO3mTb7SjtZfIuZlmXOCGESPSqUjuV7Oe8y/SFBzyANr9eHCfKq2tfd29sWhyIlwYRrHhReNVzLMonW5pgFn76nAybs9qDJTovbzLoK3ng2W4LBbpmO1phlkhG8KgITdpix8HzHLDWq0h0pvmNzAqvhkkiul9EcTCKTyPAW+Yn6HzMVI4kN1EzHrGmZuOtiYh/Q0hymsX0NmLi7EHDPGbXnJ99oLnqr1WkcJii2lJS7argzwoYmY9y4nHmoYnJDlEJNNuMrMyxrYKiG0evtZLYgqAyTjlULJkw/E3YrqmIVWGJCMY32aQM3ZvLjf4nW5DYOE7a7LDmYcIYw63jijphbDE/vZZfzEYrBBAcfJfZDbSCsDSsDk1jDhDhMuB10Y2XOTcHkHdPkghmrFndV2qmCCcJ3ouIzhVY4a9iyyNNEQyazGxTntm6xfo6TGGOqvytaAzDp1rNM7DBAoLaYdBPzuSo4tBZbNE5rsch08S4jfSZ3lMw+883BJLquai/TvI75OduMCWG2vB3uDA1XtUwcvd1Jd88MrpdeCyZdwWZv8dL18AzvsF6wArYOTLZZXyoK19hmawxezmhh8o59qHrNpTwNN5VWzrpUxmEI+2xqlhl0KrftJmImrSPaJdXm9L4vBBNm6RljJW/X7Pcba9Glqh3GN9B7SvYoahAm27Fa9qxFBlFbNxwdLbqgbVQJJuSBs+nVscebg2C/jRyvnKNMzKRl8scCCxMmTmWinhFlyxtzc7AW2SDhiuVodzV1yI9cnQKYxPfVU1q9jn5kDvR2j3nUGgPM5cI8E5Snz2IbE28Y9ZTMHRoqwURjtz2uE4ClzZPDYI9x7D85cNQy1TiushMBuRbxRsTdtn48ME29s9dSsvesaBImcYuJ27Et5bP27lDrlMiJ2lwZOXUmpnDTP91vb2uYyAkMQRwOEt5Hz4VJbCwcCb73cTR45/FhMJ/bqj4CmMTCvH6zNpPNI42QJSOGCRMZ8paNsv/JcPVjGFL3gwfPoKe0Cm11UQombCmEYnTauuOk9zcoBhP2XvfekZHt0LRTT6lXT5RYaq8qSuy/WZHdBmESK3HOeh27ZZURWqcdtVVoqwuxmxNeFs/mdZd60am1owhXwOTChM3uK5vuWEj3fdYMZn3wNt38iXZGImbnCGASD/IjzaEYNTfVrCfzaYEJeS7H9sqO7ZmWOb8iR8d7Fpt6O9hQS205lkSYWPEmOyq3/L8gTNjH8J43cfQ9pe6mJtq/kgsfE5dRIaNo5DBZj+otuIu42RkaVZ/32kNHH3aM7ItSBCbhXgXk33ttf8rrwZG5nzwXJuxOysFYSNdnM/0Xg80q2jTDMAqYWDjMXdAwJP1S7ZZaY5e3EwQTC+OucNmoqopzsRY+ZpqaqIxBQ98lKGmoBJP4KiLhTqLFYGJtab1oW91ut9tr5UX0ijg6ZuYyavpoxmjUMGEe0dzNpHkzxN+BKjSqchcSZgVgtyKaeTv+RhtSU7y+q7DQL7W7DRcmJrsVcVsf6J2esjnQRmKZJNBMRpihqAWIfhpgQitWRcvExXPAu2hHvdhGI7m7vVeFCU7vcl4ZJmSYzEcmlRJuUq/WcmdxLP2Vaga0Z+YncBuASazdj5b9+dvcMUCnnVUZJuz+4X4XLXbNjI0qwSR/LMQjgUoUBWbbMjQGEzfVyY4wNZoXGJ1umHjrg5X0UBK2w4rcDw6G1AwC4XCKGKVgEh8dNWFC3ninm/rYde80Rocd/lJ78tMOEi6sbRQmTD1mXjRIQ/pm6uPTTy6ISBdMDXMP6w+t7I16OevYC4+FtClLWaLhEcGEHNzcS35rd15o6NTDhH7H3b0Wu0rc7ayno8zF5dTTcbtVKLG37d/JXIDlr0M+iu+o7UuIoS0Um6oqL2bSDY6d15vFcjfzZTtvKa0cbubLtpC+01LiS+3p9TA6AyQstXNh4n/uOEyCnwr2zdGDS5ZdtzDfKnhNyFHWO0Z8CLR6ekZHxmBNuepkldNr6LizGbsodLzs7SIk2IQrfyxo8bHQUue5a2Si15AzuqZhNEQMkR0XXvMMmISL6cUFjrS+iP3WdBx07oycJWOBifv4GXZ6kS1q7O06tGykAIb0fSPoHtoio0TUKtibxZ2dLtVOV4uZ2N92PR0L05fYbcKnBucxUg824p8Hx8ZF6NkOD9dq9WhpiCYBySY9atgWl4ylXrd9J+fQpv/dd+L72vpXqts1uRfy2P/tt5kGVXBpvy1gdmH68feMaAh0dZTVMUQPPuAg77BH7lUJr4nRER+YGQtmxlgw99mxMOTWwZg7m4Ebu9d2TxgePDb8+OdG+V/824wYAL2Y5PncCr5z9rw4XTChy7mQu0p8t001PAp+lDsEtfB9u+3hADV2yeh5Bnq73aH998yjmkdzd1vQ3e/anjeLftki1wINhv5x2/q8O880C50M0Y9/NO99du9WYlmHRabuDi0yRo4RZyfR8kd0hv5YcI5Fr8HecHZbe+FxXEzHnxfuONDGcEenxjWUcGzoaIXz4Zj1qrWcoi8tUPwQ27yfps6T90GKHIX5JKKvXsfX0bYTjRwKTBv+NeH/NPX77ZxPrrkXZbvgdlWxs+VcFLvw5Y4fFtmZB5YzFhBiV5qFB8s5eLERFHzx7ewZYrEXXcNjeaKMDSYo2vus7Fe3t7Qqb6vw6Hc/3rqGZR5uS24Zke0fdgTXo9EhIPe4/hDBmqyireAqZ11k/zXWmC/m+MbBFAKBQCCACQgEApiAQCCACQgEAgFMQCAQwAQEAgFMQCAQwAQEAoEAJiAQCGACAoEAJiAQCGACAoFAABMQCAQwAYFAABMQCAQCmIBAIIAJCAQCmIBAIIAJCAQCAUxAIBDABAQCAUxAIBDABAQCgQAmIBAIYAICgQAmIBAIYAICgUAAExAIBDABgUAAExAIBAKYgEAggAkIBAKYgEAggAkIBAIBTEAgEMAEBAIBTEAgEMAEBAKBACaeMHa2vD9ojoaLvSOSVewc5NCW/1at6KFZFf42FvMmu8yJrJIXrcJn433GEt+34DkLHcvKe5H4Iha/YqVvBMDkhJMk/yd1ZWmJwaRpVQ6jYc1q+mJgzYanJwhgUmWar5MZpO93ewZVr9dt63TW5k0oc6iHGuRDgPx/uBuco9sZzouJZesCHc8XxNAges/QLPYV6Et13TwOiFIAWcfs20vzx5zX88R5lzPM/n1ARPfbMF9tUOD7p6/VQPSL8J3zZh6b5/1PknUj2G9lAkxOrt6RobFjtBQilYj+t7W5r3vzXyQbOYbaCqT0ULYlQ3472O+x51CNHcEpLGQyh06IcKhN5nu2dYJRTwnfoRqmkG9thXuG/V0TZX997ywd5u2qjkpZWvF3c6UaTmrSJc/Jv+wWGqQu4QBZqRvfS3wEpZ34EsFRVCN55YLDK53MW09uZnjwrugKYdRlP4iOMMDkhLo46GhHVRJDj0z2rpk1OzSks6OaM1Tjr9Y6m0p85JJz7nGHDR1/Apj4qCPvyxpviQOkZkgWTAKa9jomyhnTNjKYt+dMqkowaTnpdxU6J4FJ8hKmr4KNjnNfFJxNMURXrgBM1DyYIK3OlQSYTIwIFTa5o1pR2xk0WY8/TMgozBgA6/QcKu8UHWTZpSwTH0M7Zsb5EvOUDGJcwjIJaNrqHGbaGhjpsTcYyG4cJkXPyYNJ6ipsp7++0DJpFCbkW7EfNtfMBZhMqNaJwSoyAzIeJQgdG4kBoGWeQzBxlN6hbRe3TJhpNBCPOC1uvhNvwSoNE/r1NzPt7RQNylnnFWFS7JwcmKhGMgqkpbycscGkG/8g5mmnyemESfZ8EtNEiz9MyHjRqvCK0mQ7Gf8oAhNKE1GINGW+qzraKv/lPdvMKRaYKW+dV4RJsXNyYMIBT8rLGRNMiJejtgqbuQCTiY2X6NE8p7FR+kBmHBJhuCH1MCGv3BbySmWf924QNsv8ZmHivTxQwhZ6J/pSCUaIxjsLE9VXIoAipokdRRYrWedVArCFz8mDSfIqbMfuyxhhkvDdcsxcgMnEwiSKfNGYY3s41IftrhHNWlW3cZGHiTgwgdlxTbydXrfT7RmM20NGoyYaf2qr2+sG6hlGSymAr5T5rhj8eqmYZWL4/1ZjcWJVyEgODAZloibs++PIjJS0TDjnNLnn5MIkAZ7U82B8MEl8K5V8KwtgcuICJuFtVHpR0YK5ryrZj76kl8NNY/ov3YqmtmLsemlaU49+qLYGcWCx468XO5ajd1U25WuLTAY1z8JPTglVd0yigWkOOz0GWaow+6rx8qq4EkzUVo+rva6W7eUIzxnBhLW1EuCJngfqmGFipL/VNsDkhMkKa0XorNWwRouZaS19lODhOzrBTFCMnpJdZ6Exjx2lZ9KCM8ctpd9VGaNmWwgTjREdtEz4RTCRgoFOrJqcWogYTJifD3cYW6rlcEvrIo+jm+945cCEXICCb+GdU8uCiWq0zeAWxW9l4FwQJkeIHgdMIi+nm2vmAkwmOPqqq1GdCHP7TGRuql5+9Fvdwryp5D1MlE6bmREc2wRbkZlA50yQV9HWWY89/vSPWyax8YfvMG8TTCTNN9+JraXm2VcMTKw5i8reoqhjsuWCs+AQWWEem1rnFWGiCVTgnIPMmAl9SARfMj6Zg/I3elfaylhh4n0QQrXQuzXmIWZy4sKvgddMxtx6zJ8gmKGVW7t832UroJCqm9kJ2O3IMVcMm11AGH8yrxeDCeVcV2Eq5XiOjuPPow6K4jomOsyzTKITYYetdOHbZkH1KPmEXSUvXJ1vmRR6n+CcOBMmGg49ntgUDZ8HbRuPGSbht4rM3PbpDsGeSpiEFnDXchLRlO5em/6Iu4A4fJiQSRoNgCEvARsFAsl8Zb0ZS9Oix6vDBtwyYYJtXc1M+Ubmlh6bcuvFYUKRFWW51NaxbQnniNKx2mWhUBEmWHDObJig6BaxXzL0cloDe6yWSei7KW2ro7wnfs5pjJmE0zkFE++RrwlWjYdPNWJEd7JGFTtjEsYPm8GNT+VMmJDfGplP5cDcUg12xHN9FTFMyAxkQj2ddDgwqh7V2dzTPGoQJuvMOQeRR3CM8mASnIi9Q0HsnbzAGTNMgo/nRCliYTgfYDKxOmImberJLV6HH4bMyNiLBgCvthuzhouVHErHzDDDRWGiMfYGdxzPexOAHNNmpjlv7VAGTNgUA2eJDIGJb5sbWKtmnZeHSRgMMmLXlXdOFibRHGXv0FbwBdqENuOEyVbk5cwxaZ3TvdjvVMOEPBZweQudejnYZAMTOGnBmBmoWSfDyK1EM/5eESYcYzj0ctxJ1ss0YrJgwpbapd8ceTlddCQM/siFCeNZJc6JM2GiMQsS9SB0FN2ZwXhhYgu+VQdgcmJhQh0WBxeeB+HDBOMsQyF7zBFX4dtup62bjnj88WDSy3asfC+HmBPsLOFN8yyYsKZJ+lPEvBw0jKzzBmMm4adV6Tn1zA4LMZg4UZw9pGLgY3q3cIwwwbEryZi5NsDkhEVgmZxFl47JQn0Lw6caHUdsZ4teGiZdZraKizAsXBwmVvShubVNW0Y4izByMlbz58KEKSpL1plGgRknFsXJ/JY1YbIenhMnz6llwkRDw9TlDF0mcgvXxwkTLfIXySVmzNzhaTZNTiFMYs1xlNb+0Lu9eU0L2YcJueFMvWkqAYvZGgwOprwiOauEZRKrvU1nc94x4RwcCy1wplwOTMyMxkdO6OVsI5wXxZECEwsdhcEgnHfOGEzCMFJ0F6zgC9BbOFaYhB+0wLcCmEyyYRJv26W0jG576CYHsIMLeDkGHZnxwMRc3IQJkw7ea4spEyYOwwfDTB0zMumpMeFkhxYyYRLzczrxgrzQHHNTzgzfFMOyGoIJe04tfk5sZ8MkmqNBtDY4mHtbxgkT1nfT2A4rp7upySmEyVZyhQ1dW2b09tum606IGrSSgcrMz3j2N16vGkUTyiwEzYCJFkvZcuIgTNJ6K7YelRfOyINJVzTbo8AMfdKHNkOpLEQMJtjMbSafPOd8K+OccZhobBEsZg/m/n28MOn5vtsRSiyrOs2L/U5lzCTdHsdrQdDrUJeH32gVxx4mxLExRas92XhKiSqkGEzYaUaHYkfN6qETJa39Ib5tqOJ+qXkwEZepzBuMExEr8+1UgkmRNzixc2Z7BHGYRMv+lKBD0rp3MPdrj9XNOWa8nNzoOsBkgpVe/BsCpbW5L2iCGj1MzJQ7EB+LuFqqL2vVcE9tZdWSRWf00IEz88jZMNmKeRIW77L52RGtinUes+iGqb70puhW+efEmedMxEyYOepel+BgXm3YGGESHsc/8brYzAWYTD5NhB16CE+6R5mFAf7YEC+yEcHEslMSjD/V6ITq9npsPxNitKQ/3GHg5Rhea1mmAVBiOhSxTBgfaZ7vAHm2UcI6x2Vhwu2LhEVOV3DOQUZTkwRMcKIIFkeL/LSxwiTuu8Wi3mq59jAAk0mgSVcRt1Tc1NNRie3Ew4Q+waMBcCSKOlSzTMSd1hTDTK+YwfFwDj3UcUZoIRsmzHRNrmK1Qo8DJ93Fwl80GyZKEiaMl1PgnCmYmDErxrI85nrx2HG6Ocfhx3znvzx7sQTAZLLDJsJmz7QJqi6sQGUq1OfZwISWD5PephHXZm9eABNhs+edI85zK5ygYb3HdtaUy4OJyYdJKjCTFYSWZJnknfNdJkwiV9Q1AYLAuG8PjA8mUYaK9626p7dD0und6sJMb5vDNhp7lxgcTiv+iBQXuItgYigJg0OJWTS5MFGVzTbi2cA4Ec7JCS1Uhkk8MBNLW6mCRoq1YZI+py7etSgNkw5TBIujRX7aWGMm0QA59g/CBKrolXwOMDlpNEH6jqHweUK8iXhNWRQy60QwieZkbA4IYaKm2rCXgsnmvoa2eCVwSS+H+REvnJEbgOXDJHASFINxtIyyTU1KwgQbSiLDbdlsKTDOhEkUaaeXRosW+eHxBmD9okbi1OGEO1dhj0SAySR4OuSWme1evC+9aLeL7UQg0NWAH5iQARNOwEQV7VyKk+GcnNBCNkw0QTYn8jgiM6xCp6NSMRP+OYV1MCmYRA06XS6asVKOscEkylBFRYHZ+TeAyQnACb1ppt7puftdJCZ6Im5pBg+T6Mei6gBRNqcMTJjISlSzYoka4feUZL1LVjgjL5vDf2dYVsss/tfi1rlVGyZqEiYdJfk5E+fMhglTBKsjZpEfGidMog8VrYvYZs3cU5sbPs0wcfueuSbGfKdrtOL708R6uzIPk/U7QadSE0fTji2bx4jfEKw4TNg6EzNvx7eoNLeHneCzOZp4mlergA2CmWrreB0Hra7XmVa37YJ90xhWDfRBQo4Ik9E5t52WyCNIwSSqHySTP/ByOmOGib0V+G5HGIf3K5Z/2wKYnFCeeAtyzPl9dmPg+AoYttwBcSf6kLVY2BXFGhNfCDeGyYVJWAFr5qZf2Qoo3oRIrTLOhgnir81hPQ5WZa3zMhWwpc+ZdnPCHDnBQrTIb2ucMGEzVKx6p9/POfUwcW+9V7N+3GEjoLHng+/lqK12TAZvVwk2ycGa7e39oBCtgGUSjL911v494keSg2HYiX22nijZmLNqWOeuGo48jm7sLOF2EQVbq+eszbG5r1WE51zPdnNYV9RsK/HS+jHBxBFdScbMBZicggiKvqnydkRig5Lxved4+8bFVsDx+iaaJWCCmIMp/FaFUeEs/7MlaupK9DNx2CRP2J9ZUFBXLAtRJmaLi5xzKxMmkcuptDtKzNwaF0ysd0bOtzq1zRvfH5ggb6sLXtPCAhvksgGNLbY9gRUhKXj86mVgwsYwetlNGIVhzfhcyYSJbXE7rdlRw6WM7d6xVJjg5BbDuefkwSQqgvUjFQF/xgST1BbDnG/VAZicKDNE47YaWOe3T2XanAkHAJ893FVe0R5ghWAyzHxkaZwl0NlTLqcHrFIRp5xVQHVhUuScdiZMUivEI89obDDJ/1Y9gMnJ8WdwcMdTponF2+ZpS7DKWLSFfaye0Un2DcLh7i/F3BycE5o7zivCJxOocMxEY7vTM7tJvMtHVjHrvARMyp+TC5P43I0CSGODiZH/rczTSZNTapk47e63nJnJ9ChjArBOAS8nnoBdN8T7/a5HtQ8FYdIWd2Ut4uUkmVF035wuGwbKXTdU0DovDhM738tJnpMLEz1pQa6PEyYxQzPDzF0HmJwIjnhFJQpvOV800VvMUnAcxBHiEbN42IwdkJjdzPM47lDZmNnWpghM2Haz6SHM7HWa8dk68aKZrB39mMejhdNAS59FKWWdF4fJevlzcmDCbLmWYP64YNIp9K00gMnkS3O3E2Y2V4kNAW2bGUaHyZCZ2uqlxO5Pvs0LspGf34l/gK7SKgUTNgRrpPYtDTubpz+bwdTF43yYWPG9htkmTFFgpse5BK2Iv1geTLLOafDPyYMJc/WESfeRwqTAt1JPafPGU2eZ2PMG21RRE430TtglOip36KQP1+FWQbPuPjULokc8mzAqCBO2MVzSmopKc3vpz6bzi2a4MHF3V9c3lSjOcoyZxat+wZfKC7Jm2E01YGJlnXO9xV3sx4NJvK0e8/K6MNFMLaVcmET7pXC+ldPK3M0EYDJ54ddYWOAdcTvch73l/qetcqIT0cNEx06yykrnJmAxO4JVwqAtmj7aouhqq2VhQhfKinp4hM9dpY21+CfTNMyP3MRg4teNuZHcjqry1yZFRbZdlLoCsdS1Jg0mzDmt5DnZsmD2nFw3h12PyfZrrm2ZoAqWCVOHh4t+K4DJxMqyWFt+ky1BN/dVzqphzDxMOJsrGNxUi8Ya18qeHhoL3TBeUhwmsQBwItAfAiPdT0RUoRK3TPyfme0dtlsUmSsaxzXjPDGz48PVYcJgMhWNFJ2TC5Nt1krssXuY14JJV2+nFaJKBJPQd+PsWxarFzyGmMnJiJow+Q9FNTq6aZLHsql3jZiRb6UfJrxtORk/h5lnFnYMdqevXoe2S+70WkHnL9oiuihM2LxG3JVgvZytzC9qxtYOKanVya1YpyjBluq8DQItppytQMvB4jGT8JzHqfiBxV4Qhm9cmGC2dKYjCya0g1ZK0XEEMAk/IG/xAUbzrJm7DTA5ETSJheToFuJkMsVmE/vcwMzDJDX4t+I77bH2rK6qsbPQwRaNXr0ETNiHq9dZHXHCOesZpnZsmrNTQk3XcvsPcIuPLC0jUEp/Py0JJpGX0+NsPYr5HgEXJrZgPWZdmGSWGgtgghl/MY1dbBmne7HfKYSJpdmJaig60UX156GXQx4mvAi7yQYmmIm+njHwqBNBxk1hmDDrkONWfxRN0bmV9j2en5M7JehItgQeB87CQ3IVUA2YlDjncU7MJFrdEFtCNw6YRF4Oz/JwBOF8gMkkJ3Ti6cJ0B9h2rNVR9DBZzxj0yQSsO+BVUXm7O24KwwQxcR4WC2EFFC+cE9uOhU025kwJRe2gd3FsalFghjexddEqoDpuzp3onGmGb/HPyYdJcseL8cEkylBxv1VW2g5gMrG2iY06wub0Sowl0cOE3/1nmx1f8S3sBR3wVTJZNY3OhuIwiRWFR2le1stxeBPX5BVVZk4JRd3ThW0G+VVphxqbbJcDk8xgEL1Yzw3OrokimOi8DPkYYJLtuyXNXAwwORkiA2yvxTEcVEXtmqwFysT6uLsjWcLgKB2uek9ROC3mNepr0XGTgIkhhkmsCm6dE87hDU47lmvS8qYEjenspTvNRh4Hf4Cz9b6GpABstXPyYRKuhI669xeFiZqCiVocJumvuZ3puyW+1SksWzu9W10gfWeTbSZN46OqsTNEiXVZbT9GKUj9U8slkIGTrZvRbo/pL0vPsGOGm+Ymt7o4CkusU+d6x5yFmMiHgZcT/MjhfknqTKnRu6wIJgqv+N7o7Tq0JCbJSyf4XPx+gsSKiI7Szu1REnwkNauYwj6KzokLn5PChHMBHXqtqWJRzXXmMqRgEt7RlGWSKc4niX3N4IeCHHrs+Kewqcmp7WdC57222+0ZHkXIfDf2OjqZ3Vqi25f+hdsd7QvBzQ1fQOVwTjLc33PPodLZ2h6goNUxeVs7YX+0/cPst5NjjT3Lvu7/1ka617ztiza/vsNGZtjdrROO39hPQ7V1nX56TUvbXoPgU4mKSAbhUb7ImwLMF9lvC6tSmHOKMqR3uOfU2pxD22iw71+42PZGenAZ9pNzO2iKt99OXE+dc+UYMceZ76S+ph19K9HXdjqpuwwwORE4ceeNo+u0/EjXBziY/lItIDoinOGQnGKo04mhTbD1qmEbgUAAkyqB2HiLJIw1rgkT1I0LbZywgl3w62i2MijhvF7LOBBTdx0dw8o6MfuC+Me3cFqaJsboes5Zghckm7jmXK5Mblc8p8Z9m839cDbniubcCBtnyuIdA6e/vFbg6lgAk5Po77g7KDT5ULbcc2CMQCCwTEAgEAhgAgKBACYgEAhgAgKBQAATEAgEMAGBQAATEAgEMAGBQCCACQgEApiAQCCACQgEApiAQCAQwAQEAgFMQCAQwAQEAgFMQCAQCGACAoEAJiAQCGACAoFAABMQCAQwAYFAABMQCAQwAYFAIIAJCAQCmIBAIIAJCAQCmIBAIBDABAQCAUxAIBDABAQCAUzgEoBAIIAJCAQCmIBAIIAJCAQCAUxAIBDABAQCAUxAIBDABAQCgQAmIBAIYAICgQAmIBAIYAICgUAAExAIBDABgUAAExAIBAKYgEAggAkIBAKYgEAggAkIBAIBTEAgEMAEBAIBTEAgEMAEBAKBACYgEAhgAgKBACYgEAhgAgKBQAATEAgEMAGBQAATEAgEApiAQCCACQgEApiAQCCACQgEAgFMQCAQwAQEAgFMQCAQwAQEAoEAJiAQCGACAoEAJiAQCGACAoFAABMQCAQwAYFAABMQCAQCmIBAIKn6/wFLbZ6mlfzIuQAAAABJRU5ErkJggg==\", \"safa\": \"data:image/png;base64,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\", \"uja\": \"data:image/png;base64,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\"};\n</script>\n"};
