#!/usr/bin/env python3
"""Genera dist/ a partir de src/ y assets/.

    python3 build.py

dist/CertificadosPastoral.gs  la aplicación web entera en UN archivo (servidor, páginas, motor de PDF
                              y logos): es lo que se pega en Apps Script para instalar o actualizar.
dist/version.json             versión, fecha y novedades.
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
    # Servidor primero; luego el resto de módulos .gs en orden fijo
    modulos = ['Servidor.gs', 'Formularios.gs', 'Hojas.gs', 'Automatico.gs', 'IA.gs']
    assert sorted(modulos) == sorted(f.name for f in SRC.glob('*.gs')), 'Añade el módulo nuevo a la lista de build.py'
    servidor = '\n\n'.join((SRC / m).read_text(encoding='utf-8').rstrip() for m in modulos)
    motor = (SRC / 'motor.js').read_text(encoding='utf-8')
    assert '</script' not in motor
    logos = {'pastoral': 'data:image/png;base64,' + b64('logo-pastoral.png'),
             'safa': 'data:image/png;base64,' + b64('logo-cusafa.png'),
             'uja': 'data:image/png;base64,' + b64('logo-uja.png')}
    paginas = {
        'Panel': (SRC / 'Panel.html').read_text(encoding='utf-8'),
        'Editor': (SRC / 'Editor.html').read_text(encoding='utf-8'),
        'Publico': (SRC / 'Publico.html').read_text(encoding='utf-8'),
        'Estilos': (SRC / 'Estilos.html').read_text(encoding='utf-8'),
        'Iconos': (SRC / 'Iconos.html').read_text(encoding='utf-8'),
        'FormVista': (SRC / 'FormVista.html').read_text(encoding='utf-8'),
        'Motor': '<script>\n' + motor + '\n</script>\n',
        'Logos': '<script>\nconst LOGOS = ' + json.dumps(logos) + ';\n</script>\n',
    }
    unico = (servidor.rstrip() + '\n\n'
             '// ─────────────────────────────── RECURSOS INCRUSTADOS ───────────────────────\n'
             '// Generado por build.py: páginas, motor de PDF y logos. No editar a mano.\n'
             "const LOGO_CORREO_B64 = '" + b64('logo-pastoral.png') + "';\n"
             'const ARCHIVOS_HTML = ' + json.dumps(paginas, ensure_ascii=False) + ';\n')
    (DIST / 'CertificadosPastoral.gs').write_text(unico, encoding='utf-8')

    version = re.search(r"const VERSION_APP = '([^']+)'", servidor).group(1)
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
