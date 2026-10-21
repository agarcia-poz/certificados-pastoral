// ─────────────────────────────── HOJAS DE CÁLCULO DE DRIVE ──────────────────
// Importar las respuestas de un formulario (Google Forms u otro) guardadas en una hoja de Drive,
// una vez o enlazada: la tarea automática trae las filas nuevas cada hora.
// Los DNI y correos van directos a la bóveda; en «Datos» solo queda una huella con sal secreta.

const CAMPOS_HOJA = {
  nombreCompleto: 'Nombre y apellidos (en una columna)', nombre: 'Nombre', apellidos: 'Apellidos', dni: 'DNI/NIE', email: 'Correo',
  rol: 'Rol o forma de participar', actividad: 'Actividad (si el formulario sirve para varias)', valor: 'Valoración (1 a 5)',
  comentario: 'Comentario u opinión'
};

function idDeHoja_(url) {
  const t = String(url || '').trim();
  const m = t.match(/\/d\/([a-zA-Z0-9_-]{20,})/) || t.match(/^([a-zA-Z0-9_-]{25,})$/);
  if (!m) throw new Error('Pega la dirección completa de la hoja de cálculo (https://docs.google.com/spreadsheets/d/…).');
  return m[1];
}
function abrirHoja_(id) {
  try { return SpreadsheetApp.openById(id); }
  catch (err) {
    const prop = PropertiesService.getScriptProperties().getProperty('PROPIETARIO');
    throw new Error('No puedo abrir esa hoja. Compártela (como lector) con la cuenta propietaria de la app (' + enmascararEmail_(prop) + ').');
  }
}
function valoresHoja_(sh) {
  const nf = sh.getLastRow(), nc = sh.getLastColumn();
  if (nf < 1 || nc < 1) return [];
  return sh.getRange(1, 1, nf, nc).getValues();
}
function huellaSecreta_(t) {
  const props = PropertiesService.getScriptProperties();
  let sal = props.getProperty('SAL_HUELLAS');
  if (!sal) { sal = hexAleatorio_(); props.setProperty('SAL_HUELLAS', sal); }
  return huella_(sal + '|' + t);
}

function sugerirColumnas_(cabeceras) {
  const n = cabeceras.map(function (c) { return normalizarTexto_(c); });
  const r = {};
  const usar = function (campo, re, excluir) {
    for (let i = 0; i < n.length; i++) {
      if (Object.keys(r).some(function (k) { return r[k] === i; })) continue;
      if (re.test(n[i]) && !(excluir && excluir.test(n[i]))) { r[campo] = i; return; }
    }
  };
  usar('dni', /\b(dni|nie|documento|pasaporte)\b/);
  usar('email', /(correo|e-?mail|mail)/);
  usar('nombreCompleto', /nombre (y|completo)|nombre y apellidos|apellidos y nombre/);
  usar('apellidos', /apellido/);
  usar('nombre', /nombre/, /apellido|actividad|centro|tutor/);
  usar('rol', /\b(rol|papel|funcion)\b|particip(aste|as|o|acion)? como|como particip/);
  usar('valor', /(valora|puntua|satisfac|del 1 al 5|de 1 a 5)/);
  usar('comentario', /(coment|opinion|sugerencia|observac|que te llevas)/);
  usar('actividad', /(actividad|evento|jornada|retiro|voluntariado)/);
  if (r.nombreCompleto !== undefined && r.nombre !== undefined && r.apellidos === undefined) delete r.nombre;
  if (r.nombreCompleto !== undefined && r.nombre !== undefined && r.apellidos !== undefined) delete r.nombreCompleto;
  return r;
}
function enmascararCelda_(v) {
  const s = String(v == null ? '' : v instanceof Date ? fechaCorta_(v) : v).trim();
  if (/^[^@\s]+@[^@\s]+$/.test(s)) return enmascararEmail_(s);
  if (/^[0-9XYZxyz][\d.\s-]{6,10}[A-Za-z]$/.test(s)) return enmascararDni_(normalizarDni_(s));
  return s.length > 40 ? s.slice(0, 38) + '…' : s;
}
function rolDeTexto_(t) {
  const s = normalizarTexto_(t);
  if (!s) return '';
  if (/coordin/.test(s)) return 'Coordinación';
  if (/organiz|monitor|voluntari[oa] organiz|equipo/.test(s)) return 'Organización';
  return 'Participante';
}

/** Abre una hoja y propone qué columna es cada dato. Los ejemplos van enmascarados. */
function api_hojaAbrir(token, url, nombreHoja) {
  sesion_(token, NIVEL.coordinacion);
  const id = idDeHoja_(url);
  const ss = abrirHoja_(id);
  const hojas = ss.getSheets().map(function (s) { return s.getName(); });
  const sh = (nombreHoja && ss.getSheetByName(nombreHoja)) || ss.getSheets().filter(function (s) { return s.getLastRow() > 0; })[0] || ss.getSheets()[0];
  const v = valoresHoja_(sh);
  const cabeceras = (v[0] || []).map(function (c) { return String(c).trim(); });
  const filas = v.slice(1).filter(function (f) { return f.some(function (x) { return x !== '' && x != null; }); });
  return { id: id, nombre: ss.getName(), hojas: hojas, hoja: sh.getName(), cabeceras: cabeceras,
    ejemplos: filas.slice(0, 3).map(function (f) { return f.map(enmascararCelda_); }), filas: filas.length,
    sugerencia: sugerirColumnas_(cabeceras), campos: CAMPOS_HOJA, roles: CONFIG.ROLES_ACTIVIDAD };
}

function limpiarCfgHoja_(cfg, cabeceras) {
  cfg = cfg || {};
  const col = {};
  Object.keys(CAMPOS_HOJA).forEach(function (k) {
    const n = Number(cfg.columnas && cfg.columnas[k]);
    if (cfg.columnas && cfg.columnas[k] !== '' && cfg.columnas[k] !== null && n >= 0 && n < (cabeceras ? cabeceras.length : 200)) col[k] = Math.floor(n);
  });
  if (col.dni === undefined) throw new Error('Indica qué columna tiene el DNI/NIE.');
  if (col.nombreCompleto === undefined && (col.nombre === undefined || col.apellidos === undefined)) throw new Error('Indica las columnas del nombre y los apellidos (o la de «nombre y apellidos»).');
  if (cfg.consentimiento !== true) throw new Error('Confirma que el formulario recoge el consentimiento del alumnado (RGPD 6.1.a y 9.2.a).');
  return { id: String(cfg.id || ''), hoja: String(cfg.hoja || ''), columnas: col,
    rol: CONFIG.ROLES_ACTIVIDAD.indexOf(cfg.rol) > -1 ? cfg.rol : 'Participante', filtro: limpiar_(String(cfg.filtro || '').slice(0, 120)),
    consentimiento: true };
}

/** Importa (y opcionalmente deja enlazada) una hoja en una actividad. */
function api_hojaImportar(token, actId, cfg, enlazar) {
  const u = sesion_(token, NIVEL.coordinacion);
  const a = actividad_(actId);
  if (!a) throw new Error('La actividad no existe.');
  const ss = abrirHoja_(String(cfg && cfg.id || ''));
  const sh = ss.getSheetByName(String(cfg.hoja || '')) || ss.getSheets()[0];
  const limpia = limpiarCfgHoja_(Object.assign({}, cfg, { hoja: sh.getName() }), (valoresHoja_(sh)[0] || []));
  const r = conCerrojo_(function () { return importarHoja_(a, limpia, u.email); });
  if (enlazar) {
    conCerrojo_(function () {
      const x = actividad_(actId);
      actualizar_('Actividades', x._fila, { enlace: JSON.stringify(Object.assign({}, limpia, { nombre: ss.getName(), ultima: new Date(), total: r.nuevas })) });
    });
    asegurarDisparadores_();
    registrar_(u.email, 'Hoja enlazada', actId + ' · ' + ss.getName());
  }
  return r;
}

function api_hojaSincronizar(token, actId) {
  const u = sesion_(token, NIVEL.coordinacion);
  const a = actividad_(actId);
  const enl = a && jsonDe_(a.enlace, null);
  if (!enl) throw new Error('Esta actividad no tiene ninguna hoja enlazada.');
  return conCerrojo_(function () { return sincronizarUna_(a, enl, u.email); });
}

function api_hojaDesenlazar(token, actId) {
  const u = sesion_(token, NIVEL.coordinacion);
  return conCerrojo_(function () {
    const a = actividad_(actId);
    if (!a) throw new Error('La actividad no existe.');
    actualizar_('Actividades', a._fila, { enlace: '' });
    registrar_(u.email, 'Hoja desenlazada', actId);
    return true;
  });
}

/** Debe llamarse con el cerrojo puesto. */
function sincronizarUna_(a, enl, quien) {
  const r = importarHoja_(a, enl, quien);
  const x = actividad_(a.id);
  actualizar_('Actividades', x._fila, { enlace: JSON.stringify(Object.assign({}, enl, { ultima: new Date(), total: (Number(enl.total) || 0) + r.nuevas })) });
  return r;
}

/** Trae a la actividad las filas que aún no se habían importado. Debe llamarse con el cerrojo puesto. */
function importarHoja_(a, cfg, quien) {
  const ss = abrirHoja_(cfg.id);
  const sh = ss.getSheetByName(cfg.hoja) || ss.getSheets()[0];
  const v = valoresHoja_(sh);
  const col = cfg.columnas;
  const vale = function (fila, campo) { return col[campo] === undefined ? '' : String(fila[col[campo]] == null ? '' : fila[col[campo]]).trim(); };
  const vistas = {};
  leer_('Importadas').forEach(function (x) { if (x.actividad === a.id) vistas[x.huella] = true; });
  const existentes = leer_('Inscripciones');
  let max = maxReg_(existentes);
  const auto = autoDe_(a);
  const filtro = normalizarTexto_(cfg.filtro || '');
  const r = { nuevas: 0, repetidas: 0, errores: [], total: 0, sinCorreo: 0, valoraciones: 0 };
  const fecha = fechaCorta_(new Date());
  v.slice(1).forEach(function (fila, k) {
    if (!fila.some(function (x) { return x !== '' && x != null; })) return;
    const numFila = k + 2;
    if (filtro && col.actividad !== undefined && normalizarTexto_(vale(fila, 'actividad')).indexOf(filtro) < 0) return;
    r.total++;
    const dni = normalizarDni_(vale(fila, 'dni'));
    const hk = huellaSecreta_(cfg.id + '|' + (dniValido_(dni) ? dni : 'fila' + numFila) + '|' + a.id);
    if (vistas[hk]) { r.repetidas++; return; }
    const marcar = function (res) { vistas[hk] = true; insertar_('Importadas', { huella: hk, actividad: a.id, fecha: new Date(), resultado: res }); };
    let nombre = capitalizar_(vale(fila, 'nombre')), apellidos = capitalizar_(vale(fila, 'apellidos'));
    if (!apellidos) {
      const partes = capitalizar_(vale(fila, 'nombreCompleto') || nombre).split(' ').filter(String);
      nombre = partes[0] || ''; apellidos = partes.slice(1).join(' ');
    }
    if (!nombre || !apellidos) { r.errores.push({ fila: numFila, motivo: 'falta el nombre o los apellidos' }); marcar('error'); return; }
    if (!dniValido_(dni)) { r.errores.push({ fila: numFila, motivo: 'el DNI/NIE no es válido' }); marcar('error'); return; }
    let email = vale(fila, 'email').toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { email = ''; r.sinCorreo++; }
    const persona = guardarPersona_(dni, nombre, apellidos, email, 'Formulario externo «' + limpiar_(ss.getName()).slice(0, 60) + '» · ' + fecha);
    const val = Number(String(vale(fila, 'valor')).replace(',', '.'));
    const valor = val >= 1 && val <= 5 ? Math.round(val) : val > 5 && val <= 10 ? Math.round(val / 2) : '';
    const comentario = limpiar_(vale(fila, 'comentario').slice(0, 1500));
    if (valor || comentario) { insertar_('Valoraciones', { fecha: new Date(), actividad: a.id, valor: valor, comentario: comentario, citable: false, origen: 'hoja' }); r.valoraciones++; }
    if (existentes.some(function (i) { return i.persona === persona.id && i.actividad === a.id; })) { r.repetidas++; marcar('repetida'); return; }
    const notas = [persona.aviso ? 'Aviso: ' + persona.aviso : '', email ? '' : 'Sin correo válido en la hoja'].filter(String).join(' · ');
    const ins = { reg: 'R-' + String(++max).padStart(5, '0'), fecha: new Date(), curso: a.curso || cursoAcademico_(new Date()),
      persona: persona.id, nombre: persona.nombreCompleto, actividad: a.id, rol: rolDeTexto_(vale(fila, 'rol')) || cfg.rol || 'Participante',
      estado: auto.validar && !notas ? 'validada' : 'pendiente', codigo: '', archivo: '', firmas: 0, enviado: '', notas: notas, origen: 'hoja' };
    insertar_('Inscripciones', ins);
    existentes.push(ins);
    marcar('ok');
    r.nuevas++;
  });
  r.errores = r.errores.slice(0, 50);
  registrar_(quien, 'Hoja importada', a.id + ' · ' + r.nuevas + ' nuevas · ' + r.repetidas + ' repetidas · ' + r.errores.length + ' con errores');
  return r;
}

/** Para la tarea automática: todas las actividades enlazadas. */
function sincronizarHojas_() {
  const res = [];
  leer_('Actividades').forEach(function (a) {
    const enl = jsonDe_(a.enlace, null);
    if (!enl) return;
    try { res.push({ id: a.id, r: conCerrojo_(function () { return sincronizarUna_(a, enl, 'automático'); }) }); }
    catch (err) { registrar_('automático', 'Error al sincronizar la hoja', a.id + ' · ' + err.message); }
  });
  return res;
}
