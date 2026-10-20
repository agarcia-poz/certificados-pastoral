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
  const commit = JSON.parse(get('https://api.github.com/repos/' + REPO + '/commits/' + RAMA)).sha;
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
