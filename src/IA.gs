// ─────────────────────────────── INTELIGENCIA ARTIFICIAL (Groq) ─────────────
// La clave de Groq solo se guarda en las propiedades privadas del script (desde «Ajustes», por
// administración). Nunca se escribe en el código, en las hojas ni en el registro, y nunca llega al navegador.
// Antes de enviar comentarios del alumnado se quitan correos, DNI, teléfonos y los nombres de las personas
// inscritas en la actividad.

const URL_GROQ = 'https://api.groq.com/openai/v1';
const CONTEXTO_CENTRO = 'El Servicio de Pastoral y Compromiso Solidario del Centro Universitario «Sagrada Familia» de Úbeda ' +
  '(Fundación SAFA, de inspiración ignaciana, adscrito a la Universidad de Jaén) organiza actividades voluntarias para el alumnado ' +
  'de los Grados de Educación Infantil y Primaria (futuros maestros y maestras). Muchos no son creyentes o están en búsqueda: ' +
  'el tono es cercano, inclusivo y nunca moralizante. Lema del curso: «Libres para servir».';

function iaConfigurada_() { return !!PropertiesService.getScriptProperties().getProperty('GROQ_CLAVE'); }
function iaAjustes_() {
  const c = PropertiesService.getScriptProperties().getProperty('GROQ_CLAVE') || '';
  return { configurada: !!c, terminacion: c ? '…' + c.slice(-4) : '', modelo: leerAjuste_('iaModelo', CONFIG.MODELO_IA),
    comentarios: leerAjuste_('iaComentarios', true) !== false };
}

/** Guarda (o borra) la clave y las preferencias de IA. Solo administración. */
function api_iaGuardar(token, o) {
  const u = sesion_(token, NIVEL.admin);
  o = o || {};
  const props = PropertiesService.getScriptProperties();
  if (o.borrar === true) { props.deleteProperty('GROQ_CLAVE'); registrar_(u.email, 'IA desactivada', 'Clave de Groq borrada'); return iaAjustes_(); }
  if (o.modelo !== undefined) {
    const m = String(o.modelo || '').trim();
    if (!/^[A-Za-z0-9._\-\/:]{3,80}$/.test(m)) throw new Error('El nombre del modelo no es válido.');
    guardarAjuste_('iaModelo', m);
  }
  if (o.comentarios !== undefined) guardarAjuste_('iaComentarios', o.comentarios === true);
  if (o.clave) {
    const clave = String(o.clave).trim();
    if (!/^gsk_[A-Za-z0-9]{20,}$/.test(clave)) throw new Error('Eso no parece una clave de Groq (empieza por «gsk_»).');
    const r = UrlFetchApp.fetch(URL_GROQ + '/models', { method: 'get', headers: { Authorization: 'Bearer ' + clave }, muteHttpExceptions: true });
    if (r.getResponseCode() === 401 || r.getResponseCode() === 403) throw new Error('Groq ha rechazado la clave. Comprueba que la has copiado entera.');
    if (r.getResponseCode() !== 200) throw new Error('No se pudo comprobar la clave ahora mismo (Groq respondió ' + r.getResponseCode() + '). Inténtalo más tarde.');
    props.setProperty('GROQ_CLAVE', clave);
    registrar_(u.email, 'IA configurada', 'Clave de Groq guardada (termina en ' + clave.slice(-4) + ')');
  }
  return iaAjustes_();
}

function groq_(mensajes, op) {
  op = op || {};
  const clave = PropertiesService.getScriptProperties().getProperty('GROQ_CLAVE');
  if (!clave) throw new Error('La IA no está activada: administración tiene que guardar la clave de Groq en «Ajustes».');
  const cuerpo = { model: leerAjuste_('iaModelo', CONFIG.MODELO_IA), messages: mensajes, temperature: op.temperatura === undefined ? 0.6 : op.temperatura,
    max_tokens: op.max || 1200 };
  if (op.json) cuerpo.response_format = { type: 'json_object' };
  const r = UrlFetchApp.fetch(URL_GROQ + '/chat/completions', { method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + clave }, payload: JSON.stringify(cuerpo), muteHttpExceptions: true });
  const code = r.getResponseCode();
  if (code === 401) throw new Error('Groq ha rechazado la clave guardada. Administración debe guardar una nueva en «Ajustes».');
  if (code === 429) throw new Error('Se ha alcanzado el límite de uso de Groq. Espera un minuto y vuelve a probar.');
  if (code !== 200) throw new Error('La IA no ha respondido bien (código ' + code + '). Inténtalo de nuevo.');
  const d = JSON.parse(r.getContentText());
  const t = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
  if (!t) throw new Error('La IA ha devuelto una respuesta vacía.');
  return String(t).trim();
}
function groqJson_(mensajes, op) {
  const t = groq_(mensajes, Object.assign({ json: true, temperatura: 0.5 }, op || {}));
  try { return JSON.parse(t.replace(/^```(json)?\s*/i, '').replace(/```\s*$/, '')); }
  catch (err) { throw new Error('La IA ha devuelto un formato inesperado. Vuelve a intentarlo.'); }
}

/** Quita lo que podría identificar a alguien antes de mandar un texto a la IA. */
function anonimizarTexto_(t, nombres) {
  let s = String(t || '')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[correo]')
    .replace(/\b[0-9XYZxyz][\s.\-]?\d{2}[\s.\-]?\d{3}[\s.\-]?\d{2,3}[\s.\-]?[A-Za-z]\b/g, '[DNI]')
    .replace(/(\+34[\s-]?)?\b[6789]\d{2}[\s-]?\d{2,3}[\s-]?\d{2,3}[\s-]?\d{0,3}\b/g, '[teléfono]')
    .replace(/https?:\/\/\S+/g, '[enlace]');
  (nombres || []).forEach(function (n) {
    if (n.length < 3) return;
    s = s.replace(new RegExp('(^|[^\\p{L}])' + escRegex_(n) + '(?=$|[^\\p{L}])', 'giu'), '$1[nombre]');
  });
  return s;
}
function nombresDeActividad_(actId) {
  const personas = leerPersonas_();
  const vistos = {};
  leer_('Inscripciones').forEach(function (i) {
    if (i.actividad !== actId) return;
    const p = personas[i.persona];
    const partes = (p ? p.nombre + ' ' + p.apellidos : String(i.nombre)).split(/\s+/);
    partes.forEach(function (x) { x = x.replace(/[^\p{L}'-]/gu, ''); if (x.length >= 3 && ['del', 'las', 'los'].indexOf(x.toLowerCase()) < 0) vistos[x] = true; });
  });
  return Object.keys(vistos).sort(function (a, b) { return b.length - a.length; });
}

function descripcionActividad_(a, notas) {
  return [
    'Actividad: ' + a.nombre + (a.tipo ? ' (' + String(a.tipo).toLowerCase() + ')' : ''),
    'Fechas: ' + (a.fechas || '—') + (Number(a.horas) ? ' · ' + a.horas + ' horas' : '') + (Number(a.ects) ? ' · ' + a.ects + ' ECTS' : ''),
    'Lugar: ' + (a.lugar || CONFIG.LUGAR_POR_DEFECTO),
    'Contexto y objetivos: ' + (String(a.contexto || '').trim() || '(sin detallar)'),
    notas ? 'Notas adicionales: ' + notas : ''
  ].filter(String).join('\n');
}

/** Texto descriptivo del certificado a partir del contexto de la actividad. */
function api_iaTextoCertificado(token, actId, notas, fraseCertificado) {
  sesion_(token, NIVEL.coordinacion);
  const a = actividad_(actId);
  if (!a) throw new Error('La actividad no existe.');
  if (!String(a.contexto || '').trim() && !String(notas || '').trim()) throw new Error('Escribe primero el contexto de la actividad (qué se hizo, objetivos, entidades) para que la IA tenga de dónde partir.');
  const t = groq_([
    { role: 'system', content: CONTEXTO_CENTRO + ' Redactas textos institucionales en español de España, sobrios y cálidos. Nunca inventas datos que no te den.' },
    { role: 'user', content: [
      'Redacta el texto descriptivo de un certificado oficial de este servicio.', '',
      descripcionActividad_(a, limpiar_(String(notas || '').slice(0, 1500))), '',
      fraseCertificado ? 'El texto irá justo después de esta frase del certificado: «' + String(fraseCertificado).slice(0, 400) + '»' : '',
      'Requisitos:',
      '- Dos párrafos, entre 70 y 120 palabras en total.',
      '- Tercera persona e impersonal; no nombres a la persona certificada.',
      '- Explica qué se trabajó y su objetivo formativo, y conéctalo con la futura labor docente; menciona la pedagogía ignaciana solo si encaja de forma natural.',
      '- Sin lenguaje religioso explícito, sin adjetivos grandilocuentes y sin datos que no aparezcan arriba.',
      '- Si hay una entidad colaboradora, escríbela entre **dobles asteriscos** para que salga en negrita.',
      '- Devuelve solo los dos párrafos separados por un salto de línea, sin título ni comillas.'
    ].join('\n') }
  ], { max: 600, temperatura: 0.5 });
  return { texto: t.replace(/^["«]|["»]$/g, '').replace(/\n{2,}/g, '\n').slice(0, 1500) };
}

/** Propuesta de formulario (introducción y preguntas). No se guarda: el equipo la revisa. */
function api_iaFormulario(token, actId, tipo) {
  sesion_(token, NIVEL.coordinacion);
  const a = actividad_(actId);
  if (!a) throw new Error('La actividad no existe.');
  if (['inscripcion', 'evaluacion'].indexOf(tipo) < 0) throw new Error('Tipo no válido.');
  const pide = tipo === 'evaluacion'
    ? 'Diseña un formulario de EVALUACIÓN anónima (5 a 7 preguntas). Incluye: una pregunta "escala" con clave "general" (valoración general), ' +
      '1 o 2 escalas más sobre aspectos concretos de esta actividad, alguna pregunta "unica" o "multiple" útil para mejorar, una pregunta "largo" con clave "comentario" ' +
      '(qué se lleva, en clave de crecimiento personal y vocación docente) y otra "largo" con clave "mejora" (propuestas de mejora).'
    : 'Diseña un formulario de INSCRIPCIÓN. Los datos personales (nombre, apellidos, DNI, correo, rol) y los consentimientos YA los pide la app: NO los incluyas. ' +
      'Propón de 0 a 3 preguntas breves y útiles para organizar la actividad (por ejemplo, disponibilidad o expectativas), nunca sobre salud, religión, ideología ni datos sensibles.';
  const r = groqJson_([
    { role: 'system', content: CONTEXTO_CENTRO + ' Devuelves exclusivamente JSON válido.' },
    { role: 'user', content: descripcionActividad_(a, '') + '\n\n' + pide + '\n\nFormato: {"titulo": "...", "intro": "2 frases cercanas, en segunda persona", ' +
      '"preguntas": [{"id": "minusculas_sin_espacios", "tipo": "escala|unica|multiple|corto|largo", "texto": "...", "opciones": ["..."] (solo unica/multiple), ' +
      '"obligatoria": true|false, "clave": "general|comentario|mejora" (solo evaluación)}], "cierre": "frase de agradecimiento"}' }
  ], { max: 1400 });
  return limpiarFormulario_(Object.assign({ color: (formularioDe_(a, tipo) || {}).color }, r), tipo);
}

// ─────────────────────────────── INFORMES ───────────────────────────────────
function estadisticasValoraciones_(a, vals) {
  const def = formularioDe_(a, 'evaluacion');
  const generales = vals.map(function (v) { return Number(v.valor) || 0; }).filter(function (x) { return x >= 1 && x <= 5; });
  const dist = [1, 2, 3, 4, 5].map(function (n) { return generales.filter(function (x) { return x === n; }).length; });
  const origen = {};
  vals.forEach(function (v) { const o = v.origen || 'web'; origen[o] = (origen[o] || 0) + 1; });
  const preguntas = def.preguntas.map(function (q) {
    const resp = vals.map(function (v) { return (jsonDe_(v.respuestas, {}) || {})[q.id]; }).filter(function (x) { return x !== undefined && x !== '' && x !== null; });
    const e = { id: q.id, texto: q.texto, tipo: q.tipo, n: resp.length };
    if (q.tipo === 'escala') {
      e.media = resp.length ? Math.round(resp.reduce(function (s, x) { return s + Number(x); }, 0) / resp.length * 10) / 10 : null;
      e.dist = [1, 2, 3, 4, 5].map(function (n) { return resp.filter(function (x) { return Number(x) === n; }).length; });
    } else if (q.tipo === 'unica' || q.tipo === 'multiple') {
      e.opciones = q.opciones.map(function (o) { return { o: o, n: resp.filter(function (x) { return Array.isArray(x) ? x.indexOf(o) > -1 : x === o; }).length }; });
    }
    return e;
  });
  return {
    n: vals.length, media: generales.length ? Math.round(generales.reduce(function (s, x) { return s + x; }, 0) / generales.length * 100) / 100 : null,
    nGeneral: generales.length, dist: dist, origen: origen, preguntas: preguntas,
    comentarios: vals.filter(function (v) { return v.comentario; }).length, mejoras: vals.filter(function (v) { return v.mejora; }).length,
    inscritos: leer_('Inscripciones').filter(function (i) { return i.actividad === a.id && ['rechazada', 'anulado'].indexOf(i.estado) < 0; }).length
  };
}

/** Datos del informe (sin llamar a la IA) y el último informe redactado, si lo hay. */
function api_informe(token, actId) {
  sesion_(token, NIVEL.coordinacion);
  const a = actividad_(actId);
  if (!a) throw new Error('La actividad no existe.');
  const vals = leer_('Valoraciones').filter(function (v) { return v.actividad === actId; });
  return { actividad: { id: a.id, nombre: a.nombre, fechas: a.fechas, tipo: a.tipo }, estadisticas: estadisticasValoraciones_(a, vals),
    guardado: leerAjuste_('informe_' + actId, null), ia: iaAjustes_() };
}

/** Redacta con IA el informe de valoraciones y propuestas de mejora (comentarios anonimizados). */
function api_iaInforme(token, actId) {
  const u = sesion_(token, NIVEL.coordinacion);
  const a = actividad_(actId);
  if (!a) throw new Error('La actividad no existe.');
  const vals = leer_('Valoraciones').filter(function (v) { return v.actividad === actId; });
  if (!vals.length) throw new Error('Esta actividad aún no tiene valoraciones.');
  const est = estadisticasValoraciones_(a, vals);
  const ajustes = iaAjustes_();
  const nombres = nombresDeActividad_(actId);
  const limpiarL = function (campo) {
    return vals.filter(function (v) { return v[campo]; }).slice(-120).map(function (v) { return '- ' + anonimizarTexto_(String(v[campo]).slice(0, 400), nombres).replace(/\s+/g, ' '); });
  };
  const resumen = [
    'Respuestas: ' + est.n + ' (de ' + est.inscritos + ' personas inscritas).',
    'Valoración general media: ' + (est.media == null ? 'sin datos' : String(est.media).replace('.', ',') + ' sobre 5') + '. Reparto 1→5: ' + est.dist.join(' / ') + '.',
    est.preguntas.map(function (q) {
      if (q.tipo === 'escala') return '«' + q.texto + '»: media ' + (q.media == null ? '—' : q.media) + ' (n=' + q.n + ')';
      if (q.opciones) return '«' + q.texto + '»: ' + q.opciones.map(function (o) { return o.o + ' ' + o.n; }).join(', ');
      return '';
    }).filter(String).join('\n')
  ].join('\n');
  const partes = [descripcionActividad_(a, ''), '', 'DATOS', resumen];
  if (ajustes.comentarios) {
    partes.push('', 'COMENTARIOS (anónimos)', limpiarL('comentario').join('\n') || '(ninguno)', '', 'PROPUESTAS DE MEJORA (anónimas)', limpiarL('mejora').join('\n') || '(ninguna)');
  } else partes.push('', '(Por decisión del centro no se envían los comentarios: analiza solo los datos.)');
  const texto = groq_([
    { role: 'system', content: CONTEXTO_CENTRO + ' Eres analista de calidad educativa. Escribes en español de España, con claridad y sin inventar nada que no esté en los datos.' },
    { role: 'user', content: partes.join('\n') + '\n\nRedacta un informe breve (350-550 palabras) para el equipo de Pastoral con estas secciones, usando "## " para los títulos y "- " para las listas:\n' +
      '## Síntesis\n## Lo que más se ha valorado\n## Aspectos a mejorar\n## Propuestas concretas para la próxima edición\n## Conexión con la vocación docente\n' +
      'No cites nombres de personas. Si hay pocas respuestas, dilo y sé prudente con las conclusiones.' }
  ], { max: 1500, temperatura: 0.4 });
  const guardado = { fecha: fechaCorta_(new Date()), texto: texto.slice(0, 8000), modelo: ajustes.modelo, conComentarios: ajustes.comentarios, n: est.n };
  guardarAjuste_('informe_' + actId, guardado);
  registrar_(u.email, 'Informe con IA', actId + ' · ' + est.n + ' valoraciones');
  return { estadisticas: est, guardado: guardado };
}
