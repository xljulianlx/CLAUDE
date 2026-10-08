# Halo Nutrition

Tienda de suplementos deportivos (demostración) con un frasco 3D que gira con el scroll y viaja entre páginas, SEO técnico completo y pago con Mercado Pago Checkout Pro. Marca, precios, reseñas y textos son de ejemplo.

## Estructura

```
src/data/catalogo.mjs     Única fuente de datos: productos, sabores, reseñas, blog, envíos.
src/assets/css/main.css   Sistema de diseño (claro/oscuro automático).
src/assets/js/app.js      Carrito, cajón accesible, fichas, pago.
src/assets/js/escena.js   Escena 3D persistente entre páginas.
src/assets/js/frasco-gl.js Motor WebGL del frasco (también genera las fotos).
src/assets/js/movimiento.js Animaciones con GSAP + ScrollTrigger (con alternativa sin GSAP).
scripts/build.mjs         Genera public/: 21 páginas, sitemap.xml, robots.txt, JSON-LD.
scripts/render-fotos.mjs  Renderiza las fotos WebP de cada producto y sabor.
scripts/auditar.cjs       Auditoría de SEO, accesibilidad, rendimiento y enlaces.
api/crear-preferencia.js  Crea la preferencia de Mercado Pago (servidor).
api/webhook-mercadopago.js Recibe las notificaciones de pago.
```

## Comandos

```bash
npm install              # instala el SDK de Mercado Pago (solo lo usan las funciones de api/)
npm run build            # genera public/
npm run fotos            # vuelve a renderizar las fotos (necesita Playwright + Chromium)
npx http-server public   # servir en local; luego: node scripts/auditar.cjs http://127.0.0.1:8080
```

## Publicar en Vercel

1. Importa el repositorio en Vercel. `vercel.json` ya define el build (`node scripts/build.mjs`), la carpeta `public/` y las URLs limpias.
2. Variables de entorno:
   - `SITE_URL`: tu dominio con https, sin barra final (canonical, sitemap, URLs de retorno del pago).
   - `MP_ACCESS_TOKEN`: Access Token de tu aplicación de Mercado Pago. Primero el de prueba, luego el de producción.
3. En el panel de Mercado Pago, configura la URL de notificaciones: `https://TU-DOMINIO/api/webhook-mercadopago`.

## Antes de vender de verdad

- Reemplazar `src/data/catalogo.mjs` con la ficha real (productos, precios, tono, palabras clave) y volver a correr `npm run fotos`.
- Reseñas: conectar reseñas reales y poner `resenasDeEjemplo: false`. Solo entonces se publican como datos estructurados (Google no permite reseñas inventadas).
- Mercado Pago: probar el flujo completo con credenciales y usuarios de prueba. Confirmar contra la documentación vigente los campos de la preferencia y del SDK v2.
- Webhook: implementar la validación de la firma `x-signature` según la documentación oficial ("Validar origen de la notificación") y guardar los pedidos en una base de datos. Está marcado como pendiente en `api/webhook-mercadopago.js`.
- Fuentes: hoy se cargan desde Google Fonts. Para mejor rendimiento y privacidad, alojar Geist en el propio sitio.
- Textos legales: términos, privacidad y tratamiento de datos (Ley 1581 de 2012 en Colombia). Registro sanitario Invima de cada producto.
- Probar en teléfonos reales (iOS Safari y Android Chrome): el 3D, el cajón y la barra de compra fija.
