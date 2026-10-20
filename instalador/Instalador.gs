/**
 * INSTALADOR · Certificados de Pastoral · C.U. «Sagrada Familia»
 * Pega este archivo (y el appsscript.json que lo acompaña) en un proyecto de Apps
 * Script nuevo, creado desde la hoja de cálculo, y ejecuta «instalarDesdeGitHub».
 * Descarga la última versión de la app desde GitHub y sustituye este archivo por ella.
 */
const REPO = 'agarcia-poz/certificados-pastoral';
const RAMA = 'main';

function instalarDesdeGitHub() {
  if (!SpreadsheetApp.getActive()) throw new Error('Crea este proyecto desde la hoja: Extensiones > Apps Script.');
  const get = function (url) {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { 'User-Agent': 'certificados-pastoral' } });
    if (res.getResponseCode() !== 200) throw new Error('GitHub respondió ' + res.getResponseCode() + ' en ' + url);
    return res.getContentText('UTF-8');
  };
  const commit = ultimoCommit_(REPO, RAMA);
  const base = 'https://raw.githubusercontent.com/' + REPO + '/' + commit + '/dist/';
  const manifiesto = JSON.parse(get(base + 'version.json'));
  const files = manifiesto.archivos.map(function (a) {
    const fuente = get(base + a.archivo);
    const huella = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, fuente, Utilities.Charset.UTF_8)
      .map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join('');
    if (huella !== a.sha256) throw new Error('El archivo ' + a.archivo + ' no coincide con su huella. Inténtalo en unos minutos.');
    return { name: a.nombre, type: a.tipo, source: fuente };
  });
  const res = UrlFetchApp.fetch('https://script.googleapis.com/v1/projects/' + ScriptApp.getScriptId() + '/content', {
    method: 'put', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({ files: files })
  });
  if (res.getResponseCode() !== 200) {
    const t = res.getContentText();
    if (/has not been used|disabled|not enabled/i.test(t)) {
      throw new Error('Activa la «API de Google Apps Script» en https://script.google.com/home/usersettings, espera dos minutos y vuelve a ejecutar.');
    }
    throw new Error('Google respondió ' + res.getResponseCode() + ': ' + t.slice(0, 300));
  }
  Logger.log('✅ Versión ' + manifiesto.version + ' descargada. Recarga esta página del editor, elige la función «instalar» y pulsa Ejecutar.');
}

/**
 * Último commit de una rama, leído del protocolo git de GitHub (no tiene el límite de 60 consultas
 * por hora de la API, que los servidores de Google agotan al compartir IP). Si falla, se usa el
 * nombre de la rama: las huellas de version.json siguen garantizando que los archivos coinciden.
 */
function ultimoCommit_(repo, rama) {
  try {
    const res = UrlFetchApp.fetch('https://github.com/' + repo + '.git/info/refs?service=git-upload-pack',
      { muteHttpExceptions: true, headers: { 'User-Agent': 'git/2.40 certificados-pastoral' } });
    if (res.getResponseCode() === 200) {
      const m = res.getContentText().match(new RegExp('([0-9a-f]{40}) refs/heads/' + rama.replace(/[^\w.-]/g, '') + '\\n'));
      if (m) return m[1];
    }
  } catch (err) { }
  return rama;
}
