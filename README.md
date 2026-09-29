# Actuaria Flipbook

Visor de PDF con efecto de hoja para el sitio de Actuaria Consultores (Webflow). Reemplaza a
DearFlip, que es de pago, con un desarrollo propio sobre dos librerías de código abierto.

Demo: https://renatopuente-ux.github.io/actuaria-flipbook/

## Cómo se usa

Se instala una sola vez, a nivel de sitio:

```html
<script src="https://renatopuente-ux.github.io/actuaria-flipbook/flipbook.js"
        integrity="sha384-…" crossorigin="anonymous" defer></script>
```

- **Enlaces a PDF:** cualquier `<a href="….pdf">` abre el visor en una ventana emergente sobre la
  misma página. Título opcional con `data-flipbook-title="…"`.
- **Excluir un enlace:** `data-flipbook="off"` en el enlace o en un contenedor. Los enlaces con
  atributo `download` no se tocan.
- **Incrustado:** `<div data-flipbook-inline data-src="URL.pdf" data-title="…"></div>`
- **Desde JS:** `ActuariaFlipbook.open(url, {title})`, `ActuariaFlipbook.mount(el, url, {title})`
  (devuelve `{load(url, title), destroy()}`), `ActuariaFlipbook.close()`.

El PDF tiene que permitir CORS (los assets de Webflow lo permiten). Si no se puede cargar, el
visor ofrece abrirlo en una pestaña nueva.

Controles: página anterior y siguiente (también flechas del teclado, arrastre y clic en la
esquina), ampliar, pantalla completa, descargar, abrir el original y cerrar (Esc). En pantallas
angostas muestra una página a la vez. Respeta "reducir movimiento" del sistema.

Las librerías solo se descargan al abrir el primer PDF, así que no pesan en las páginas que no lo
usan. Antes de ejecutarlas, `flipbook.js` comprueba su SHA-384: si alguien cambiara un archivo,
el visor no lo ejecuta.

## Procedencia de lo vendorizado

Los archivos salen de los tarballs oficiales de npm. El sha512 de cada tarball se comparó con el
`dist.integrity` que publica el registro antes de extraerlo (2026-09-29).

| Librería | Versión | Licencia | Tarball sha512 (= registro npm) | Archivos |
|---|---|---|---|---|
| pdfjs-dist (Mozilla) | 4.10.38 | Apache-2.0 | `/Y3fcFrXEAsMjJXeL9J8+ZG9U01LbuWaYypvDW2ycW1jL269L3js3DVBjDJ0Up9Np1uqDXsDrRihHANhZOlwdQ==` | `build/pdf.min.mjs`, `build/pdf.worker.min.mjs`, `standard_fonts/`, `LICENSE` |
| page-flip / StPageFlip (Oleg Litovski) | 2.0.7 | MIT | `96lQFUUz7r/LZzEUZJ3yBIMEKU9+m8HMFDzTvTdD6P7Ag/wXINjp9n0W7b4wanwnDbQETo4uNUoL3zMqpFxwGA==` | `dist/js/page-flip.browser.js`, `LICENSE` |

SHA-384 de los archivos que se ejecutan (los mismos que verifica `flipbook.js`):

| Archivo | SHA-384 |
|---|---|
| `vendor/pdfjs-4.10.38/pdf.min.mjs` | `+0ti2moQlmLN7WZHE2RHIf5lV8hHxhxEalN0il3YZceG26fUPyOkR0hp9daxk1i7` |
| `vendor/pdfjs-4.10.38/pdf.worker.min.mjs` | `ToeVvShCxKc6CEvhHeMt0Q8A06pSPDbAlngO9nokrDmh914gk/pYd0N7D0a4Lz2o` |
| `vendor/page-flip-2.0.7/page-flip.browser.js` | `L4eWrYFdqQ+LoGA0MMuqLqzV13x7SKkQaqacy4MED8e815dS37tTKlO/6xBEUpZW` |

No se incluyen los `cmaps` de PDF.js: solo hacen falta para texto asiático con fuentes sin
incrustar.

Para actualizar una librería: bajar el tarball nuevo, repetir la verificación contra el
registro, reemplazar los archivos, recalcular los SHA-384, ponerlos en `VENDOR` dentro de
`flipbook.js` y actualizar esta tabla y el `integrity` del script en Webflow.
