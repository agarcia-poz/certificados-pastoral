#!/usr/bin/env python3
"""Genera dist/ (lo que descarga la app al instalarse o actualizarse) a partir de src/ y assets/.

    python3 build.py

dist/ contiene Codigo.gs, LogoCorreo.gs, Editor.html, Motor.html, Logos.html, appsscript.json
y version.json (versión, novedades y huella SHA-256 de cada archivo). dist/ se guarda en el
repositorio: es lo que publica cada versión.
"""
import base64, hashlib, json, pathlib, re, shutil

RAIZ = pathlib.Path(__file__).resolve().parent
SRC, DIST, ASSETS = RAIZ / 'src', RAIZ / 'dist', RAIZ / 'assets'

def main():
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()
    shutil.copy(SRC / 'Codigo.gs', DIST / 'Codigo.gs')
    shutil.copy(SRC / 'Editor.html', DIST / 'Editor.html')
    shutil.copy(SRC / 'appsscript.json', DIST / 'appsscript.json')
    motor = (SRC / 'motor.js').read_text(encoding='utf-8')
    assert '</script' not in motor
    (DIST / 'Motor.html').write_text('<script>\n' + motor + '\n</script>\n', encoding='utf-8')
    logos = {}
    for clave, archivo in [('pastoral', 'logo-pastoral.png'), ('safa', 'logo-cusafa.png'), ('uja', 'logo-uja.png')]:
        logos[clave] = 'data:image/png;base64,' + base64.b64encode((ASSETS / archivo).read_bytes()).decode()
    (DIST / 'Logos.html').write_text('<script>\nconst LOGOS = ' + json.dumps(logos) + ';\n</script>\n', encoding='utf-8')
    correo = base64.b64encode((ASSETS / 'logo-cusafa-blanco.png').read_bytes()).decode()
    (DIST / 'LogoCorreo.gs').write_text("// Logo blanco de la cabecera de los correos (generado por build.py)\nconst LOGO_CORREO_B64 = '" + correo + "';\n", encoding='utf-8')

    codigo = (SRC / 'Codigo.gs').read_text(encoding='utf-8')
    version = re.search(r"const VERSION_APP = '([^']+)'", codigo).group(1)
    novedades = (RAIZ / 'NOVEDADES.md').read_text(encoding='utf-8')
    m = re.search(r'^## ' + re.escape(version) + r' \((\d{4}-\d{2}-\d{2})\)\n(.*?)(?=^## |\Z)', novedades, re.S | re.M)
    if not m:
        raise SystemExit(f'Falta la sección «## {version} (AAAA-MM-DD)» en NOVEDADES.md')
    tipos = {'.gs': 'SERVER_JS', '.html': 'HTML', '.json': 'JSON'}
    archivos = []
    for f in sorted(DIST.iterdir()):
        datos = f.read_text(encoding='utf-8')
        archivos.append({'archivo': f.name, 'nombre': f.stem, 'tipo': tipos[f.suffix],
                         'sha256': hashlib.sha256(datos.encode('utf-8')).hexdigest()})
    manifiesto = {'version': version, 'fecha': m.group(1),
                  'novedades': m.group(2).strip(), 'archivos': archivos}
    (DIST / 'version.json').write_text(json.dumps(manifiesto, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for f in sorted(DIST.iterdir()):
        print(f'{f.name:20} {f.stat().st_size // 1024:>5} KB')

if __name__ == '__main__':
    main()
