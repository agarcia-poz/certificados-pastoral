#!/usr/bin/env python3
"""Genera dist/ a partir de src/ y assets/.

    python3 build.py

dist/CertificadosPastoral.gs  la app entera en UN archivo (código, páginas del editor y logos):
                              es lo que se copia y pega en Apps Script para instalar o actualizar.
dist/version.json             versión, fecha y novedades (lo consulta «Actualizar la app»).
"""
import base64, json, pathlib, re, shutil

RAIZ = pathlib.Path(__file__).resolve().parent
SRC, DIST, ASSETS = RAIZ / 'src', RAIZ / 'dist', RAIZ / 'assets'


def b64(nombre):
    return base64.b64encode((ASSETS / nombre).read_bytes()).decode()


def main():
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()
    codigo = (SRC / 'Codigo.gs').read_text(encoding='utf-8')
    motor = (SRC / 'motor.js').read_text(encoding='utf-8')
    assert '</script' not in motor
    logos = {'pastoral': 'data:image/png;base64,' + b64('logo-pastoral.png'),
             'safa': 'data:image/png;base64,' + b64('logo-cusafa.png'),
             'uja': 'data:image/png;base64,' + b64('logo-uja.png')}
    paginas = {
        'Editor': (SRC / 'Editor.html').read_text(encoding='utf-8'),
        'Motor': '<script>\n' + motor + '\n</script>\n',
        'Logos': '<script>\nconst LOGOS = ' + json.dumps(logos) + ';\n</script>\n',
    }
    unico = (codigo.rstrip() + '\n\n'
             '// ─────────────────────────────── RECURSOS INCRUSTADOS ───────────────────────\n'
             '// Generado por build.py: páginas del editor, motor de PDF y logos. No editar a mano.\n'
             "const LOGO_CORREO_B64 = '" + b64('logo-cusafa-blanco.png') + "';\n"
             'const ARCHIVOS_HTML = ' + json.dumps(paginas, ensure_ascii=False) + ';\n')
    (DIST / 'CertificadosPastoral.gs').write_text(unico, encoding='utf-8')

    version = re.search(r"const VERSION_APP = '([^']+)'", codigo).group(1)
    novedades = (RAIZ / 'NOVEDADES.md').read_text(encoding='utf-8')
    m = re.search(r'^## ' + re.escape(version) + r' \((\d{4}-\d{2}-\d{2})\)\n(.*?)(?=^## |\Z)', novedades, re.S | re.M)
    if not m:
        raise SystemExit(f'Falta la sección «## {version} (AAAA-MM-DD)» en NOVEDADES.md')
    (DIST / 'version.json').write_text(json.dumps({'version': version, 'fecha': m.group(1), 'novedades': m.group(2).strip()},
                                                  ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for f in sorted(DIST.iterdir()):
        print(f'{f.name:28} {f.stat().st_size // 1024:>5} KB')


if __name__ == '__main__':
    main()
