# Halo Nutrition

Tienda de suplementos deportivos (demostración) que vende productos de marcas como Optimum Nutrition, Dragon Pharma y Nutramerican. El producto estrella gira en 3D en la portada y en cada ficha usando su foto real (flota, gira, sigue el cursor, se arrastra con el dedo y salta al tocarlo), siempre activo y sin pedir permiso. Incluye buscador, combos con descuento, cuentas de cliente (correo, Google y Facebook), panel de administración y pago con Mercado Pago Checkout Pro. Los precios son de ejemplo; los datos de cada producto salen solo de lo que dice su etiqueta.

## Estructura

```
src/data/catalogo.mjs       Catálogo base (productos, combos, reseñas, blog, envíos). Se usa si no hay Supabase.
fuentes/productos/          Fotos recortadas (PNG con fondo transparente) de cada producto. De aquí salen todas las imágenes.
src/assets/css/main.css     Sistema de diseño (tema claro).
src/assets/js/datos.js      Capa de datos: Supabase o, sin configurar, "modo demostración" en el navegador.
src/assets/js/app.js        Carrito, buscador, datos en vivo (precio, stock, visibilidad), fichas, pago.
src/assets/js/precios.js     Combos, cupón y envío: el mismo cálculo en el carrito y en el servidor.
src/assets/js/checkout.js    /finalizar-compra/: contacto, envío (departamentos de Colombia), cupón, pago y recibo.
src/assets/js/cuenta.js     /cuenta/: entrar, crear cuenta, Google, Facebook, recuperar clave, mis pedidos.
src/assets/js/admin.js      /admin/: resumen de ventas, productos (foto, precio, stock, visible, eliminar), pedidos.
src/assets/js/vivo3d.js     3D con la foto real: WebGL que gira la etiqueta sobre la silueta del envase.
src/assets/js/movimiento.js Animaciones: entradas al hacer scroll (más rápidas en celular), foto viva, contadores.
scripts/build.mjs           Genera public/: páginas, sitemap.xml con imágenes, robots.txt, JSON-LD.
scripts/semilla-sql.mjs     Genera supabase/semilla.sql con los productos del catálogo.
scripts/render-escenas.mjs  Genera las fotos WebP de producto (160/600/1000) y las imágenes de ambiente desde fuentes/productos/.
scripts/auditar.cjs         Auditoría de SEO, accesibilidad, rendimiento y enlaces.
supabase/esquema.sql        Tablas, seguridad por filas (RLS), inventario y almacenamiento de fotos.
api/crear-preferencia.js    Valida el carrito (precio, visibilidad y stock), registra el pedido y crea la preferencia.
api/webhook-mercadopago.js  Confirma el pago, marca el pedido como pagado y descuenta el stock.
api/publicar.js             Regenera el sitio cuando un administrador publica cambios.
```

## Modo demostración

Sin variables de Supabase, el sitio funciona igual pero todo se guarda en el navegador: cuentas, cambios del panel y pedidos simulados. Cuenta de administrador de prueba: `admin@halo.example` con la clave `demo1234`. El botón del carrito dice "Simular pago" y el pedido aparece en el panel.

## Comandos

```bash
npm install              # SDK de Mercado Pago (solo lo usan las funciones de api/)
npm run build            # genera public/
npm run fotos            # regenera fotos y escenas desde fuentes/productos/ (Playwright + Chromium)
node scripts/semilla-sql.mjs   # genera supabase/semilla.sql
npx http-server public   # servir en local; luego: node scripts/auditar.cjs http://127.0.0.1:8080
```

## Conectar Supabase (cuentas, panel y pedidos reales)

1. Crea un proyecto en [Supabase](https://supabase.com). En el editor SQL ejecuta `supabase/esquema.sql` y luego `supabase/semilla.sql`.
2. Crea tu cuenta en `/cuenta/` y después, en el editor SQL: `insert into public.admins (email) values ('tu-correo@dominio.com');`. Ese correo verá el panel `/admin/`. Puedes agregar varios.
3. Authentication > URL Configuration: pon tu dominio en *Site URL* y agrega `https://TU-DOMINIO/cuenta/` en *Redirect URLs*.
4. Google: crea un cliente OAuth en Google Cloud con la URL de retorno que muestra Supabase (`https://TU-PROYECTO.supabase.co/auth/v1/callback`) y pega el Client ID y el secreto en Authentication > Providers > Google. Guía: https://supabase.com/docs/guides/auth/social-login/auth-google
5. Facebook: crea una app en Meta for Developers con el producto "Inicio de sesión con Facebook", la misma URL de retorno, y pega el App ID y el secreto en Providers > Facebook. Guía: https://supabase.com/docs/guides/auth/social-login/auth-facebook

La seguridad está en la base de datos: los clientes solo leen productos visibles y sus propios pedidos; solo los correos de `admins` pueden cambiar productos, subir fotos o actualizar pedidos.

## Publicar en Vercel

1. Importa el repositorio en Vercel. `vercel.json` ya define el build, la carpeta `public/` y las URLs limpias.
2. Variables de entorno (Settings > Environment Variables; nunca en el código):
   - `SITE_URL`: tu dominio con https, sin barra final.
   - `MP_ACCESS_TOKEN`: Access Token de Mercado Pago. Primero el de prueba, luego el de producción.
   - `SUPABASE_URL` y `SUPABASE_ANON_KEY`: datos públicos del proyecto (van al navegador).
   - `SUPABASE_SERVICE_ROLE_KEY`: clave privada, solo para el build y las funciones. No la compartas.
   - `VERCEL_DEPLOY_HOOK_URL`: crea un Deploy Hook en Settings > Git y pega su URL. Lo usa el botón "Publicar cambios en la web".
3. En Mercado Pago, configura la URL de notificaciones: `https://TU-DOMINIO/api/webhook-mercadopago`.

Precio, stock y visibilidad se actualizan solos en la tienda apenas se guardan en el panel. Productos nuevos, fotos y textos llegan a las páginas que lee Google cuando el administrador toca "Publicar cambios en la web".

## Combos, cupones y pago

- Combos y cupones se definen en `sitio.combos` y `sitio.cupones` de `src/data/catalogo.mjs`. El descuento baja el precio de cada unidad (Mercado Pago no acepta ítems negativos) y el servidor lo recalcula con los precios de la base de datos.
- La página no contiene los códigos de cupón, solo su huella SHA-256. Cambia o quita `BIENVENIDA10` antes de vender.
- `/finalizar-compra/` envía a la preferencia los datos del comprador (`payer`: nombre, apellido, correo, celular, documento CC/CE/NIT, dirección) y guarda la dirección de envío en el pedido. Ejecuta de nuevo `supabase/esquema.sql` para agregar las columnas nuevas (es seguro repetirlo).

## SEO

- Cada página tiene title, description, canonical, hreflang, Open Graph y JSON-LD (Organization, WebSite con búsqueda, CollectionPage, Product con Offer, envío y devoluciones, BreadcrumbList, Blog).
- La disponibilidad del Product sale del stock real en cada publicación. El sitemap incluye las fotos de cada producto.
- El texto para buscadores está en la página, en bloques plegados, para que el cliente vea primero los productos.
- `/buscar/`, `/cuenta/`, `/admin/`, `/carrito/` y `/pago/` no se indexan.

## Antes de vender de verdad

- Para agregar un producto: su foto recortada en `fuentes/productos/<slug>.png`, su ficha en el catálogo (solo datos de la etiqueta) y `npm run fotos` (o subir la foto desde el panel).
- Confirmar que se pueden usar las fotos y marcas de cada fabricante, y completar la marca del BCAA (no se lee en la foto).
- Reseñas: la tienda no muestra reseñas hasta conectar reseñas reales (`resenas` en el catálogo). Si se cargan reseñas de ejemplo, poner `resenasDeEjemplo: true`.
- Mercado Pago: probar el flujo completo con credenciales y usuarios de prueba.
- Webhook: implementar la validación de la firma `x-signature` según la documentación oficial ("Validar origen de la notificación"). Está marcado como pendiente en `api/webhook-mercadopago.js`.
- Correos de confirmación de pedido y de envío (por ejemplo con Resend o el SMTP de Supabase).
- Textos legales: términos, privacidad y tratamiento de datos (Ley 1581 de 2012). Registro sanitario Invima de cada producto.
- Probar en teléfonos reales (iOS Safari y Android Chrome).
