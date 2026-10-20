# Certificados de Pastoral · C.U. «Sagrada Familia» (Úbeda)

App de Google Apps Script para emitir los certificados de las actividades del **Servicio de Pastoral y Compromiso Solidario**.

```
Formulario (registro + valoración anónima)
   → validación en la hoja «Participaciones»
   → editor de diseño con vista previa exacta → PDF (nombrado por código, nunca por DNI)
   → firma 1 → firma 2 (Autofirma, carpetas «Para firmar» / «Firmados por…»)
   → envío automático al alumno/a → verificación pública por código o QR
```

Diseño por defecto: franjas arriba y abajo (color cambiable, admite imagen de fondo).

![Franjas en tres variantes](docs/franjas.png)

![Las cuatro plantillas](docs/plantillas.png)

![El editor](docs/editor.png)

## Qué hay aquí

| Carpeta | Contenido |
| --- | --- |
| `src/Codigo.gs` | Servidor: hojas, bóveda, formulario, circuito de firmas, correos, verificación y funciones del editor (`api_*`, todas exigen la cuenta propietaria). |
| `src/Editor.html` | Editor que se abre dentro de la hoja: diseño por actividad, textos, fondos, ayuda para IA y generación por lotes. |
| `src/motor.js` | Motor de maquetación: una sola maquetación con dos salidas idénticas, la vista previa (canvas) y el PDF (pdf-lib). |
| `assets/` | Logos de Pastoral, SAFA y UJA (se incrustan en la app). |
| `build.py` | Genera `dist/CertificadosPastoral.gs` (la app entera en un archivo: código, páginas del editor y logos) y `dist/version.json` (versión y novedades). |
| `tests/` | Simulación de Google + motor real: recorre el flujo completo y las reglas de privacidad. |

## Instalar y actualizar (sin instalar programas)

La app entera es un solo archivo: [`dist/CertificadosPastoral.gs`](dist/CertificadosPastoral.gs).

1. Crea una hoja de cálculo nueva > Extensiones > Apps Script.
2. Abre el [archivo en bruto](https://raw.githubusercontent.com/agarcia-poz/certificados-pastoral/main/dist/CertificadosPastoral.gs), copia todo y pégalo en `Código.gs`, sustituyendo lo que haya. Guarda.
3. Ejecuta la función `instalar` y acepta los permisos. Recarga la hoja.

Actualizar: **⛪ Certificados > 🔄 Actualizar la app** compara tu versión con `dist/version.json` y, si hay una nueva,
muestra sus novedades y el enlace para volver a copiar y pegar el archivo. Después, **Instalar / reparar**. Los datos no se tocan.

## Publicar una versión nueva

1. Cambia el código en `src/`, sube `VERSION_APP` en `src/Codigo.gs` y añade su sección en `NOVEDADES.md`.
2. `python3 build.py` (regenera `dist/`) y `cd tests && npm install && npm test`.
3. Sube los cambios a `main`. Las pruebas de GitHub comprueban también que `dist/` está al día.

## Reglas que el código no debe romper

1. Ningún DNI ni correo del alumnado en la hoja de gestión, nombres de archivo, asuntos, URL o registro. Solo en la bóveda.
2. Las funciones que llama el navegador (`api_*`) comprueban en el servidor que quien llama es la cuenta propietaria.
3. Cada correo se envía una sola vez. El formulario no guarda respuestas.
4. Datos de prueba siempre ficticios. Ni correos reales ni credenciales en el repositorio: es público.

La guía de instalación y uso para el equipo está en el documento «Certificados de Pastoral · Guía de instalación y uso».
