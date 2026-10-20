// Prueba del instalador inicial contra un GitHub simulado.
import fs from 'fs'; import vm from 'vm'; import { crearGoogle } from './fakes.mjs';
const RAIZ = new URL('..', import.meta.url).pathname;
const { ctx, estado } = crearGoogle();
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(RAIZ + 'instalador/Instalador.gs', 'utf8') + '\n;this.I = instalarDesdeGitHub;', ctx);
const commit = 'b'.repeat(40), base = 'https://raw.githubusercontent.com/agarcia-poz/certificados-pastoral/' + commit + '/dist/';
const man = JSON.parse(fs.readFileSync(RAIZ + 'dist/version.json', 'utf8'));
estado.web['https://github.com/agarcia-poz/certificados-pastoral.git/info/refs?service=git-upload-pack'] = { code: 200, text: '001e# service=git-upload-pack\n0000015a' + commit + ' HEAD\u0000multi_ack\n003f' + commit + ' refs/heads/main\n0000' };
estado.web[base + 'version.json'] = { code: 200, text: JSON.stringify(man) };
man.archivos.forEach(a => { estado.web[base + a.archivo] = { code: 200, text: fs.readFileSync(RAIZ + 'dist/' + a.archivo, 'utf8') }; });
ctx.I();
const put = estado.peticiones.find(p => p.op.method === 'put');
const ok = put && JSON.parse(put.op.payload).files.length === man.archivos.length;
console.log(ok ? 'instalador: OK' : 'instalador: FALLO'); process.exit(ok ? 0 : 1);
