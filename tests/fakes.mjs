// Simulación mínima de los servicios de Google Apps Script (solo lo que usa Codigo.gs).
import crypto from 'crypto';

export function crearGoogle({ propietario = 'coordinacion@centro.test' } = {}) {
  const estado = { web: {}, peticiones: [], correos: [], alertas: [], respuestasBorradas: [], usuario: propietario, props: {}, libros: {}, archivos: {}, carpetas: {}, items: {} };
  let nId = 0; const nuevoId = (p) => p + (++nId);

  const encadenable = (base) => new Proxy(base, {
    get(t, k) { if (k in t) return t[k]; if (k === 'then') return undefined; return () => encadenable(t); }
  });

  function hojaFalsa(nombre, libro) {
    const datos = [];
    const sh = {
      getName: () => nombre, getMaxRows: () => 1000, getParent: () => libro,
      getLastRow: () => { for (let r = datos.length; r > 0; r--) if ((datos[r - 1] || []).some(v => v !== '' && v != null)) return r; return 0; },
      appendRow: (fila) => { datos[sh.getLastRow()] = fila.slice(); },
      deleteRow: (r) => { datos.splice(r - 1, 1); },
      getRange: (r, c, nr = 1, nc = 1) => {
        if (typeof r === 'string') { const m = r.match(/^([A-Z])(\d+)(?::([A-Z])(\d+))?$/); if (!m[3]) { m[3] = m[1]; m[4] = m[2]; } const col = (x) => x.charCodeAt(0) - 64; return rango(+m[2], col(m[1]), +m[4] - +m[2] + 1, col(m[3]) - col(m[1]) + 1); }
        return rango(r, c, nr, nc);
      },
      getProtections: () => [], datos
    };
    const celda = (r, c) => { const v = (datos[r - 1] || [])[c - 1]; return v === undefined ? '' : v; };
    const poner = (r, c, v) => { datos[r - 1] = datos[r - 1] || []; datos[r - 1][c - 1] = v; };
    function rango(r, c, nr, nc) {
      const self = encadenable({
        getSheet: () => sh, getRow: () => r, getColumn: () => c, getLastRow: () => r + nr - 1, getLastColumn: () => c + nc - 1,
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => celda(r + i, c + j))),
        getValue: () => celda(r, c),
        setValues: (vals) => { vals.forEach((f, i) => f.forEach((v, j) => poner(r + i, c + j, v))); return self; },
        setValue: (v) => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) poner(r + i, c + j, v); return self; },
        setFormulas: (vals) => self.setValues(vals),
        insertCheckboxes: () => { if (nr > 50) return self; for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (celda(r + i, c + j) === '') poner(r + i, c + j, false); return self; },
        protect: () => encadenable({})
      });
      return self;
    }
    return encadenable(sh);
  }

  function libroFalso(nombre) {
    const hojas = {}; const id = nuevoId('ss');
    const libro = encadenable({
      getId: () => id, getUrl: () => 'https://docs/' + id, getName: () => nombre,
      getSheetByName: (n) => hojas[n] || null, insertSheet: (n) => (hojas[n] = hojaFalsa(n, libro)),
      getSheets: () => Object.values(hojas), deleteSheet: (s) => { delete hojas[s.getName()]; }, hojas
    });
    estado.libros[id] = libro;
    return libro;
  }

  const iter = (l) => { let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; };
  function carpetaFalsa(nombre, padre) {
    const id = nuevoId('fold');
    const c = encadenable({
      getId: () => id, getName: () => nombre, getUrl: () => 'https://drive/' + id, padre,
      getFoldersByName: (n) => iter(Object.values(estado.carpetas).filter(x => x.padre === id && x.getName() === n)),
      createFolder: (n) => carpetaFalsa(n, id),
      createFile: (blob) => archivoFalso(blob.getName(), blob._bytes, id, 'propietario', blob.getContentType()),
      getFiles: () => iter(Object.values(estado.archivos).filter(f => f.carpeta === id && !f.papelera)),
      getFilesByType: () => c.getFiles(),
      getParents: () => iter(estado.carpetas[padre] ? [estado.carpetas[padre]] : []),
      addViewer: () => c, addEditor: () => c
    });
    estado.carpetas[id] = c; return c;
  }
  const raizDrive = carpetaFalsa('Mi unidad', null);
  const aBuffer = (b) => Buffer.isBuffer(b) ? b : Array.isArray(b) ? Buffer.from(b.map(x => (x + 256) % 256)) : Buffer.from(String(b));
  function blobFalso(bytes, nombre, tipo = 'application/pdf') {
    const b = {
      _bytes: aBuffer(bytes), getName: () => nombre, setName: (n) => { nombre = n; return b; },
      getBytes: () => [...b._bytes].map(x => x > 127 ? x - 256 : x), getContentType: () => tipo,
      copyBlob: () => blobFalso(b._bytes, nombre, tipo),
      getDataAsString: (cs) => b._bytes.toString(cs === 'ISO-8859-1' ? 'latin1' : 'utf8')
    };
    return b;
  }
  function archivoFalso(nombre, bytes, carpeta, duenio, tipo = 'application/pdf') {
    const id = nuevoId('file');
    const f = { id, nombre, bytes: aBuffer(bytes), carpeta, duenio, papelera: false, tipo,
      getId: () => id, getName: () => f.nombre, getUrl: () => 'https://drive/file/' + id, getMimeType: () => f.tipo,
      getBlob: () => blobFalso(f.bytes, f.nombre, f.tipo),
      getParents: () => iter(estado.carpetas[f.carpeta] ? [estado.carpetas[f.carpeta]] : []),
      setTrashed: (v) => { if (f.duenio !== 'propietario') throw new Error('Solo el propietario'); f.papelera = v; },
      getEditors: () => [], getViewers: () => [], setSharing: () => {} };
    estado.archivos[id] = f; return f;
  }

  let nItem = 0;
  function itemFalso() {
    const id = ++nItem; const it = encadenable({ getId: () => id, filas: [], titulo: '' });
    it.setTitle = (t) => { it.titulo = t; return it; };
    it.setRows = (r) => { it.filas = r; return it; }; it.getRows = () => it.filas;
    it.asGridItem = () => it; estado.items[id] = it; return it;
  }
  const formulario = encadenable({
    getId: () => 'form1', getPublishedUrl: () => 'https://forms/form1', getEditUrl: () => 'https://forms/form1/edit',
    addTextItem: itemFalso, addGridItem: itemFalso, addParagraphTextItem: itemFalso, addCheckboxItem: itemFalso, addSectionHeaderItem: itemFalso,
    getItemById: (id) => estado.items[id], deleteResponse: (id) => estado.respuestasBorradas.push(id)
  });

  const gestion = libroFalso('Pastoral · Certificados');
  const ctx = {
    console, Date, JSON, Math, String, Number, Object, Array, RegExp, Buffer,
    SpreadsheetApp: {
      getActive: () => gestion, getActiveSpreadsheet: () => gestion,
      openById: (id) => estado.libros[id], create: (n) => { const l = libroFalso(n); l.insertSheet('Hoja 1'); return l; },
      getUi: () => ({ alert: (m) => { estado.alertas.push(m); return 'YES'; }, ButtonSet: {}, Button: { YES: 'YES' } }),
      newDataValidation: () => encadenable({ build: () => ({}) }),
      newConditionalFormatRule: () => encadenable({ build: () => ({}) }),
      flush: () => {}, ProtectionType: { RANGE: 'RANGE' }, getActiveSheet: () => null
    },
    FormApp: { create: () => formulario, openById: () => formulario, createTextValidation: () => encadenable({ build: () => ({}) }), EmailCollectionType: { VERIFIED: 'VERIFIED' } },
    DriveApp: {
      getRootFolder: () => raizDrive, getFolderById: (id) => estado.carpetas[id],
      getFileById: (id) => { if (estado.archivos[id]) return estado.archivos[id]; if (estado.libros[id]) return archivoFalso('libro', '', null, 'propietario'); throw new Error('No existe ' + id); },
      Access: {}, Permission: {}
    },
    MailApp: { sendEmail: (para, asunto, texto, op) => estado.correos.push({ para, asunto, texto, html: op.htmlBody, adjuntos: op.attachments || [] }) },
    Utilities: {
      newBlob: (datos, tipo, nombre) => blobFalso(datos, nombre, tipo),
      computeDigest: (_, s) => [...crypto.createHash('sha256').update(s, 'utf8').digest()].map(b => b > 127 ? b - 256 : b),
      getUuid: () => crypto.randomUUID(),
      base64Encode: (b) => aBuffer(b).toString('base64'),
      base64Decode: (s) => [...Buffer.from(s, 'base64')].map(x => x > 127 ? x - 256 : x),
      formatDate: (d) => d.toISOString().slice(0, 10), DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 'utf8' }
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => estado.props[k] ?? null, setProperty: (k, v) => { estado.props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, tryLock: () => true, releaseLock: () => {} }) },
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger: () => {}, newTrigger: () => encadenable({}), getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/XYZ/exec' }),
      getScriptId: () => 'SCRIPT123', getOAuthToken: () => 'token' },
    UrlFetchApp: { fetch: (url, op = {}) => {
      estado.peticiones.push({ url, op });
      const r = estado.web[url] !== undefined ? estado.web[url] : (op.method === 'put' ? { code: 200, text: '{}' } : { code: 404, text: 'no' });
      return { getResponseCode: () => r.code, getContentText: () => r.text };
    } },
    Session: { getEffectiveUser: () => ({ getEmail: () => propietario }), getActiveUser: () => ({ getEmail: () => estado.usuario }), getScriptTimeZone: () => 'Europe/Madrid' },
    HtmlService: { createHtmlOutput: (h) => encadenable({ html: h }) },
    Logger: { log: () => {} }, MimeType: { PDF: 'application/pdf' }
  };
  return { ctx, estado, gestion, archivoFalso };
}
