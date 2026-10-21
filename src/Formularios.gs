// ─────────────────────────────── FORMULARIOS PROPIOS ────────────────────────
// Cada actividad tiene un formulario de inscripción y otro de evaluación, diseñados en el panel.
// El alumnado los abre en ?p=f&a=A-001 (inscripción) y ?p=e&a=A-001 (evaluación, anónima).

const TIPOS_PREGUNTA = { escala: 'Escala de 1 a 5', unica: 'Una opción', multiple: 'Varias opciones', corto: 'Respuesta corta', largo: 'Respuesta larga' };
const COLOR_FORMULARIO = '#136EA1';

function formularioPorDefecto_(a, tipo) {
  if (tipo === 'evaluacion') {
    return {
      titulo: '¿Cómo lo has vivido?',
      intro: 'Tu opinión sobre «' + a.nombre + '» nos ayuda a preparar mejor las próximas actividades. Es anónima: no te pedimos ningún dato personal.',
      color: COLOR_FORMULARIO,
      preguntas: [
        { id: 'general', tipo: 'escala', texto: 'Valoración general de la actividad', obligatoria: true, clave: 'general' },
        { id: 'crecer', tipo: 'escala', texto: '¿Cuánto te ha ayudado a crecer como persona y como futuro/a docente?' },
        { id: 'recomendar', tipo: 'unica', texto: '¿Se la recomendarías a un compañero o compañera?', opciones: ['Sí', 'Quizá', 'No'] },
        { id: 'llevo', tipo: 'largo', texto: '¿Qué te llevas de esta experiencia?', clave: 'comentario' },
        { id: 'mejora', tipo: 'largo', texto: '¿Qué mejorarías para la próxima vez?', clave: 'mejora' }
      ],
      cierre: '¡Gracias! Tu respuesta es anónima y nos ayuda a mejorar.'
    };
  }
  return {
    titulo: a.nombre,
    intro: 'Regístrate para que podamos expedir tu certificado. Te llegará un correo para confirmar tus datos.',
    color: COLOR_FORMULARIO, preguntas: [],
    cierre: 'Revisa tu correo y confirma el registro. Cuando el certificado esté firmado, te llegará otro correo para descargarlo.'
  };
}

function formularioDe_(a, tipo) {
  const f = jsonDe_(a.formularios, {}) || {};
  return limpiarFormulario_(f[tipo] || formularioPorDefecto_(a, tipo), tipo);
}

function limpiarFormulario_(f, tipo) {
  f = f || {};
  const texto = function (t, n) { return limpiar_(String(t == null ? '' : t).slice(0, n)).replace(/^'/, ''); };
  const def = {
    titulo: texto(f.titulo, 140) || (tipo === 'evaluacion' ? 'Evaluación' : 'Inscripción'),
    intro: texto(f.intro, 1200), cierre: texto(f.cierre, 400),
    color: /^#[0-9a-fA-F]{6}$/.test(f.color || '') ? f.color : COLOR_FORMULARIO,
    preguntas: []
  };
  const ids = {}, claves = {};
  (Array.isArray(f.preguntas) ? f.preguntas : []).slice(0, 20).forEach(function (q, n) {
    if (!q || !TIPOS_PREGUNTA[q.tipo] || !texto(q.texto, 300)) return;
    let id = /^[a-z0-9_]{1,24}$/.test(q.id || '') ? q.id : 'q' + (n + 1);
    while (ids[id]) id = id + '_';
    ids[id] = true;
    const p = { id: id, tipo: q.tipo, texto: texto(q.texto, 300), obligatoria: q.obligatoria === true };
    if (q.ayuda) p.ayuda = texto(q.ayuda, 300);
    if (q.tipo === 'unica' || q.tipo === 'multiple') {
      const op = (Array.isArray(q.opciones) ? q.opciones : String(q.opciones || '').split('\n'))
        .map(function (o) { return texto(o, 120); }).filter(function (o, i, l) { return o && l.indexOf(o) === i; }).slice(0, 12);
      if (op.length < 2) return;
      p.opciones = op;
    }
    const compatible = { general: ['escala'], comentario: ['corto', 'largo'], mejora: ['corto', 'largo'] };
    if (tipo === 'evaluacion' && compatible[q.clave] && compatible[q.clave].indexOf(q.tipo) > -1 && !claves[q.clave]) { p.clave = q.clave; claves[q.clave] = true; }
    def.preguntas.push(p);
  });
  return def;
}

/** Comprueba las respuestas contra el formulario y devuelve solo lo válido. */
function validarRespuestas_(def, r) {
  r = r || {};
  const out = {};
  def.preguntas.forEach(function (q) {
    let v = r[q.id];
    let ok = null;
    if (q.tipo === 'escala') { const n = Math.round(Number(v)); if (n >= 1 && n <= 5) ok = n; }
    else if (q.tipo === 'unica') { if (q.opciones.indexOf(String(v)) > -1) ok = String(v); }
    else if (q.tipo === 'multiple') {
      const l = (Array.isArray(v) ? v : []).map(String).filter(function (x, i, a) { return q.opciones.indexOf(x) > -1 && a.indexOf(x) === i; });
      if (l.length) ok = l;
    } else {
      const t = limpiar_(String(v == null ? '' : v).slice(0, q.tipo === 'corto' ? 200 : 1500));
      if (t) ok = t;
    }
    if (ok === null) { if (q.obligatoria) throw new Error('Falta por responder: «' + q.texto + '».'); return; }
    out[q.id] = ok;
  });
  return out;
}

function api_formularios(token, actId) {
  sesion_(token, NIVEL.coordinacion);
  const a = actividad_(actId);
  if (!a) throw new Error('La actividad no existe.');
  const guardados = jsonDe_(a.formularios, {}) || {};
  const url = urlApp_();
  return {
    actividad: { id: a.id, nombre: a.nombre, fechas: a.fechas, tipo: a.tipo, lugar: a.lugar, contexto: a.contexto || '',
      abierta: a.abierta === true, evaluacion: a.evaluacion === true },
    inscripcion: formularioDe_(a, 'inscripcion'), evaluacion: formularioDe_(a, 'evaluacion'),
    propio: { inscripcion: !!guardados.inscripcion, evaluacion: !!guardados.evaluacion },
    tipos: TIPOS_PREGUNTA, roles: CONFIG.ROLES_ACTIVIDAD, ia: iaConfigurada_(),
    urls: { inscripcion: url + '?p=f&a=' + a.id, evaluacion: url + '?p=e&a=' + a.id }
  };
}

function api_guardarFormulario(token, actId, tipo, def) {
  const u = sesion_(token, NIVEL.coordinacion);
  if (['inscripcion', 'evaluacion'].indexOf(tipo) < 0) throw new Error('Tipo de formulario no válido.');
  return conCerrojo_(function () {
    const a = actividad_(actId);
    if (!a) throw new Error('La actividad no existe.');
    const todos = jsonDe_(a.formularios, {}) || {};
    if (def === null) delete todos[tipo]; else todos[tipo] = limpiarFormulario_(def, tipo);
    const texto = JSON.stringify(todos);
    if (texto.length > 40000) throw new Error('El formulario es demasiado largo.');
    actualizar_('Actividades', a._fila, { formularios: Object.keys(todos).length ? texto : '' });
    registrar_(u.email, def === null ? 'Formulario restablecido' : 'Formulario guardado', actId + ' · ' + tipo);
    return formularioDe_(Object.assign({}, a, { formularios: texto }), tipo);
  });
}

/** Lo que necesita la página pública de un formulario (sin datos de nadie). */
function api_publicoFormulario(tipo, actId) {
  if (!instalado_()) throw new Error('La aplicación aún no está configurada.');
  esquema_();
  if (['inscripcion', 'evaluacion'].indexOf(tipo) < 0) throw new Error('Formulario no válido.');
  const a = actividad_(String(actId || ''));
  if (!a) return { cerrado: true, mensaje: 'No encontramos esta actividad. Revisa el enlace.' };
  const abierto = tipo === 'evaluacion' ? a.evaluacion === true : a.abierta === true;
  const info = { id: a.id, nombre: a.nombre, fechas: a.fechas, tipo: a.tipo, lugar: a.lugar || '' };
  if (!abierto) return { cerrado: true, actividad: info,
    mensaje: tipo === 'evaluacion' ? 'La evaluación de esta actividad no está abierta ahora mismo.' : 'La inscripción de esta actividad está cerrada.' };
  return { actividad: info, formulario: formularioDe_(a, tipo), roles: CONFIG.ROLES_ACTIVIDAD, privacidad: CONFIG.TEXTO_PRIVACIDAD, servicio: CONFIG.NOMBRE_SERVICIO };
}

/** Evaluación anónima: no se guarda nada que identifique a quien responde. */
function api_publicoEvaluar(actId, respuestas, extra) {
  if (!instalado_()) throw new Error('La aplicación aún no está configurada.');
  extra = extra || {};
  if (extra.web) throw new Error('No se ha podido enviar.');
  const a = actividad_(String(actId || ''));
  if (!a || a.evaluacion !== true) throw new Error('La evaluación de esta actividad no está abierta.');
  const def = formularioDe_(a, 'evaluacion');
  const r = validarRespuestas_(def, respuestas);
  if (!Object.keys(r).length) throw new Error('Responde al menos una pregunta.');
  const cache = CacheService.getScriptCache();
  const hora = 'eva_' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHH');
  const n = Number(cache.get(hora) || 0);
  if (n >= CONFIG.MAX_EVALUACIONES_HORA) throw new Error('Ahora mismo hay muchas respuestas. Inténtalo dentro de un rato.');
  cache.put(hora, String(n + 1), 3700);
  const porClave = {};
  def.preguntas.forEach(function (q) { if (q.clave && r[q.id] !== undefined) porClave[q.clave] = r[q.id]; });
  let valor = porClave.general || '';
  if (!valor) {
    const escalas = def.preguntas.filter(function (q) { return q.tipo === 'escala' && r[q.id]; }).map(function (q) { return r[q.id]; });
    if (escalas.length) valor = Math.round(escalas.reduce(function (s, x) { return s + x; }, 0) / escalas.length);
  }
  conCerrojo_(function () {
    insertar_('Valoraciones', { fecha: new Date(), actividad: a.id, valor: valor, comentario: porClave.comentario || '',
      citable: porClave.comentario ? extra.citable === true : false, mejora: porClave.mejora || '', respuestas: JSON.stringify(r), origen: 'evaluación' });
  });
  return { ok: true, cierre: def.cierre || '¡Gracias por tu respuesta!' };
}
