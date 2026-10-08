// Generador estático del sitio. Lee los productos de Supabase (si hay credenciales en el entorno) o de
// src/data/catalogo.mjs, y escribe HTML, sitemap.xml (con imágenes) y robots.txt.
// Uso:  node scripts/build.mjs                  -> public/  (producción, URLs limpias)
//       node scripts/build.mjs --preview <dir>  -> <dir>   (vista previa: enlaces a index.html explícitos)
// Entorno opcional: SITE_URL, SUPABASE_URL, SUPABASE_ANON_KEY (pública, va al navegador),
//                   SUPABASE_SERVICE_ROLE_KEY (solo en el build/servidor, nunca al navegador).
import { mkdir, writeFile, cp, rm, readdir, readFile } from 'node:fs/promises';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sitio, categorias, productos as catalogoBase, resenas, blog } from '../src/data/catalogo.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const PREVIEW = args.includes('--preview');
const salida = PREVIEW ? args[args.indexOf('--preview') + 1] : join(raiz, 'public');
const HOY = new Date().toISOString().slice(0, 10);
const VALIDO_HASTA = `${new Date().getFullYear() + 1}-12-31`;
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_ANON = process.env.SUPABASE_ANON_KEY || '';
// Versión de los archivos CSS y JS (huella de su contenido): cambia en cada cambio y evita que el navegador use uno viejo.
const VERSION = (() => { const h = createHash('sha1'); for (const d of ['css', 'js']) for (const f of readdirSync(join(raiz, 'src/assets', d)).sort()) h.update(f).update(readFileSync(join(raiz, 'src/assets', d, f))); return h.digest('hex').slice(0, 10); })();

/* ---------- datos ---------- */
const SABOR_UNICO = { slug: 'unico', nombre: 'Único', c1: '#3b3f47', c2: '#15171b' };
async function cargarProductos() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY || SB_ANON;
  if (!SB_URL || !clave) return catalogoBase.map((p) => ({ ...p, imagenUrl: null, stock: null, stockMinimo: 5 }));
  const r = await fetch(`${SB_URL}/rest/v1/productos?select=*&visible=eq.true&order=orden.asc`, { headers: { apikey: clave, Authorization: `Bearer ${clave}` } });
  if (!r.ok) throw new Error(`Supabase respondió ${r.status} al leer productos`);
  return (await r.json()).map((f) => ({
    slug: f.slug, nombre: f.nombre, categoria: f.categoria, precio: f.precio, porciones: f.porciones, forma: f.forma, presentacion: f.presentacion,
    resumen: f.resumen, descripcion: f.descripcion, beneficios: f.beneficios || [], datos: f.datos || [], nutricion: f.nutricion, uso: f.uso,
    palabrasClave: f.palabras_clave || [], sabores: f.sabores && f.sabores.length ? f.sabores : [SABOR_UNICO], faq: f.faq || [],
    imagenUrl: f.imagen_url, stock: f.stock, stockMinimo: f.stock_minimo,
  }));
}
const productos = await cargarProductos();

/* ---------- utilidades ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const cop = (n) => `$ ${num.format(n)}`;
const porPorcion = (p) => (p.porciones ? Math.round(p.precio / p.porciones / 100) * 100 : null);
const abs = (ruta) => sitio.url + ruta;
const cat = (slug) => categorias.find((c) => c.slug === slug) || { slug, nombre: slug };
const prod = (slug) => productos.find((p) => p.slug === slug);
const foto = (p, s, t) => `img/productos/${p.slug}-${s.slug}-${t}.webp`;
const tieneRender = (p) => existsSync(join(raiz, 'src/assets', foto(p, p.sabores[0], 600)));
const con3D = (p) => !p.imagenUrl && tieneRender(p);
const fotoAbs = (p, s) => (p.imagenUrl ? p.imagenUrl : tieneRender(p) ? abs('/assets/' + foto(p, s, 1000)) : abs('/assets/img/og-halo.jpg'));
const disponible = (p) => p.stock == null || p.stock > 0;
// Imágenes de ambiente generadas con scripts/render-escenas.mjs (ancho grande y mitad).
const ESCENAS = { familia: [1600, 800, 900], 'cat-proteinas': [1200, 600, 900], 'cat-rendimiento': [1200, 600, 900], 'cat-accesorios': [1200, 600, 900], laboratorio: [1000, 600, 1000] };
const escenaImg = (c, nombre, { alt = '', sizes = '100vw', lazy = true, clase = '' } = {}) => {
  const [g, m, alto] = ESCENAS[nombre] || [1200, 600, 630];
  if (!existsSync(join(raiz, `src/assets/img/escenas/${nombre}-${m}.webp`))) return '';
  return `<img${clase ? ` class="${clase}"` : ''} src="${c.a(`img/escenas/${nombre}-${m}.webp`)}" srcset="${c.a(`img/escenas/${nombre}-${m}.webp`)} ${m}w, ${c.a(`img/escenas/${nombre}-${g}.webp`)} ${g}w" sizes="${sizes}" width="${g}" height="${alto}" alt="${esc(alt)}"${lazy ? ' loading="lazy"' : ''} decoding="async">`;
};
const portadaGuia = (b) => (existsSync(join(raiz, `src/assets/img/escenas/guia-${b.slug}-600.webp`)) ? `guia-${b.slug}` : null);
const iniciales = (n) => n.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
const tono = (n) => [...n].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 360, 7);
const resumenResenas = (slug) => {
  const r = resenas[slug] || [];
  if (!r.length) return null;
  const media = r.reduce((a, x) => a + x.rating, 0) / r.length;
  return { media: Math.round(media * 10) / 10, total: r.length };
};
const estrellas = (n) => '★★★★★'.slice(0, Math.round(n)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(n));
const fechaLarga = (f) => new Date(f + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

/* ---------- plantilla ---------- */
function contexto(ruta) {
  const prof = ruta.split('/').filter(Boolean).length;
  const base = prof ? '../'.repeat(prof) : './';
  return {
    ruta, base,
    h: (p) => {
      const [camino, ancla] = p.replace(/^\//, '').split('#');
      let destino = base + camino;
      if (PREVIEW && (destino.endsWith('/') || camino === '')) destino += 'index.html';
      return destino + (ancla ? '#' + ancla : '');
    },
    a: (p) => base + 'assets/' + p + (/\.(css|js)$/.test(p) ? `?v=${VERSION}` : ''),
  };
}

function buscador(c, id) {
  return `<form class="buscador" role="search" action="${c.h('/buscar/')}" method="get" data-buscador>
      <label class="sr" for="${id}">Buscar productos</label>
      <input id="${id}" name="q" type="search" placeholder="Buscar proteína, creatina…" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="search" role="combobox" aria-expanded="false" aria-controls="${id}-lista" aria-autocomplete="list">
      <button class="buscador-cerrar" type="button" data-cerrar-busqueda>Cancelar</button>
      <div class="buscador-panel" id="${id}-lista" role="listbox" aria-label="Resultados" hidden></div>
    </form>`;
}

function cabecera(c) {
  const enlaces = [['/tienda/', 'Tienda'], ['/blog/', 'Guías'], ['/nosotros/', 'Nosotros']];
  const actual = (r) => (c.ruta.startsWith(r) ? ' aria-current="page"' : '');
  return `<header class="cabecera">
  <div class="cabecera-in">
    <a class="logo" href="${c.h('/')}" aria-label="Halo Nutrition, ir al inicio"><span class="logo-aro" aria-hidden="true"></span>HALO</a>
    <nav class="menu" aria-label="Principal"><ul>${enlaces.map(([r, t]) => `<li><a href="${c.h(r)}"${actual(r)}>${t}</a></li>`).join('')}</ul></nav>
    ${buscador(c, 'q-cab')}
    <a class="btn-cuenta" href="${c.h('/cuenta/')}" data-enlace-cuenta>Entrar</a>
    <a class="btn-carrito" href="${c.h('/carrito/')}" data-abrir-carrito data-destino-carrito>Carrito <span class="cuenta" data-cuenta aria-hidden="true">0</span><span class="sr" data-cuenta-texto>, 0 productos</span></a>
  </div>
</header>`;
}

function barraMovil(c) {
  const actual = (r) => (r === '/' ? c.ruta === '/' : c.ruta.startsWith(r)) ? ' aria-current="page"' : '';
  return `<nav class="tabbar" aria-label="Navegación rápida">
  <a href="${c.h('/')}"${actual('/')}><span class="tab-ico tab-inicio" aria-hidden="true"></span>Inicio</a>
  <a href="${c.h('/tienda/')}"${actual('/tienda/')}><span class="tab-ico tab-tienda" aria-hidden="true"></span>Tienda</a>
  <button type="button" data-abrir-busqueda><span class="tab-ico tab-buscar" aria-hidden="true"></span>Buscar</button>
  <a href="${c.h('/cuenta/')}"${actual('/cuenta/')} data-enlace-cuenta-tab><span class="tab-ico tab-cuenta" aria-hidden="true"></span>Cuenta</a>
  <a href="${c.h('/carrito/')}" data-abrir-carrito data-destino-carrito><span class="tab-ico tab-carrito" aria-hidden="true"><span class="cuenta" data-cuenta>0</span></span>Carrito</a>
</nav>`;
}

function pie(c) {
  return `<footer class="pie">
  <div class="pie-in">
    <div class="pie-marca">
      <a class="logo" href="${c.h('/')}"><span class="logo-aro" aria-hidden="true"></span>HALO</a>
      <p>Suplementos deportivos con dosis declaradas y análisis por lote. Envíos a toda Colombia.</p>
      <form class="boletin" data-boletin novalidate>
        <label for="boletin-correo">Recibe guías y lanzamientos, un correo al mes</label>
        <div class="boletin-fila"><input id="boletin-correo" name="correo" type="email" autocomplete="email" required placeholder="tu@correo.com"><button class="btn btn-sec" type="submit">Suscribirme</button></div>
        <p class="campo-ayuda" data-boletin-msg role="status"></p>
      </form>
    </div>
    <nav aria-label="Tienda"><h2>Tienda</h2><ul>${categorias.map((k) => `<li><a href="${c.h(`/tienda/${k.slug}/`)}">${k.nombre}</a></li>`).join('')}<li><a href="${c.h('/tienda/')}">Todo</a></li></ul></nav>
    <nav aria-label="Ayuda"><h2>Ayuda</h2><ul><li><a href="${c.h('/envios-y-devoluciones/')}">Envíos y devoluciones</a></li><li><a href="${c.h('/nosotros/#preguntas')}">Preguntas frecuentes</a></li><li><a href="${c.h('/nosotros/#contacto')}">Contacto</a></li><li><a href="${c.h('/cuenta/')}">Mi cuenta</a></li></ul></nav>
    <nav aria-label="Guías"><h2>Guías</h2><ul>${blog.map((b) => `<li><a href="${c.h(`/blog/${b.slug}/`)}">${esc(b.titulo.split(':')[0])}</a></li>`).join('')}</ul></nav>
  </div>
  <div class="pie-legal"><p>Pagos procesados por Mercado Pago. Los suplementos no reemplazan una alimentación variada.</p><p>Sitio de demostración con marca, precios y contenido de ejemplo.</p></div>
</footer>`;
}

function cajon() {
  return `<div class="cajon" id="cajon" role="dialog" aria-modal="true" aria-labelledby="cajon-titulo" hidden>
  <div class="cajon-fondo" data-cerrar-carrito></div>
  <div class="cajon-panel">
    <div class="cajon-cab"><h2 id="cajon-titulo">Tu carrito</h2><button class="btn-icono" type="button" data-cerrar-carrito aria-label="Cerrar carrito">×</button></div>
    <div class="cajon-envio" data-envio></div>
    <div class="cajon-lista" data-lista></div>
    <div class="cajon-pie" data-pie-cajon></div>
  </div>
</div>`;
}

function migasHTML(c, migas) {
  if (!migas) return '';
  return `<nav class="migas wrap" aria-label="Ruta de navegación"><ol>${migas.map(([t, r], i) => (i === migas.length - 1 ? `<li><span aria-current="page">${esc(t)}</span></li>` : `<li><a href="${c.h(r)}">${esc(t)}</a></li>`)).join('')}</ol></nav>`;
}
const migasLD = (migas) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: migas.map(([t, r], i) => ({ '@type': 'ListItem', position: i + 1, name: t, item: abs(r) })) });

function catalogoJSON(c) {
  return JSON.stringify({
    productos: productos.map((p) => ({
      slug: p.slug, nombre: p.nombre, precio: p.precio, porciones: p.porciones, presentacion: p.presentacion, forma: p.forma, sabores: p.sabores,
      categoria: p.categoria, categoriaNombre: cat(p.categoria).nombre, resumen: p.resumen, palabras: [...(p.palabrasClave || []), ...p.sabores.map((s) => s.nombre)].join(' '),
      img: p.imagenUrl || (tieneRender(p) ? c.a(foto(p, p.sabores[0], 160)) : c.a('img/sin-foto.svg')), con3D: con3D(p), url: c.h(`/productos/${p.slug}/`),
    })),
    envio: sitio.envio, gratisDesde: sitio.envioGratisDesde, assets: c.a(''), raiz: c.base,
    carrito: c.h('/carrito/'), tienda: c.h('/tienda/'), buscar: c.h('/buscar/'), cuenta: c.h('/cuenta/'), admin: c.h('/admin/'), exito: c.h('/pago/exito/'),
    categorias, supabase: SB_URL && SB_ANON ? { url: SB_URL, anon: SB_ANON } : null,
  }).replace(/</g, '\\u003c');
}

function layout(pg) {
  const c = contexto(pg.ruta);
  const ld = [...(pg.jsonld || [])];
  if (pg.migas) ld.push(migasLD(pg.migas));
  const og = pg.ogImagenAbs || abs('/assets/' + (pg.ogImagen || 'img/og-halo.jpg'));
  const preload = pg.lcp ? `<link rel="preload" as="image" href="${c.a(pg.lcp.src)}" imagesrcset="${pg.lcp.srcset.split(', ').map((x) => { const [u, w] = x.split(' '); return c.a(u) + ' ' + w; }).join(', ')}" imagesizes="${pg.lcp.sizes}" fetchpriority="high">` : '';
  const html = `<!doctype html>
<html lang="es-CO">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
<title>${esc(pg.titulo)}</title>
<meta name="description" content="${esc(pg.descripcion)}">
${pg.canonical === false ? '' : `<link rel="canonical" href="${abs(pg.ruta)}">
<link rel="alternate" hreflang="es-CO" href="${abs(pg.ruta)}">
<link rel="alternate" hreflang="x-default" href="${abs(pg.ruta)}">`}
<meta name="robots" content="${pg.indexar === false ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1'}">
<meta property="og:type" content="${pg.tipoOg || 'website'}">
<meta property="og:locale" content="es_CO">
<meta property="og:site_name" content="${sitio.nombre}">
<meta property="og:title" content="${esc(pg.ogTitulo || pg.titulo)}">
<meta property="og:description" content="${esc(pg.descripcion)}">
<meta property="og:url" content="${abs(pg.ruta)}">
<meta property="og:image" content="${og}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#f3f4f6">
<meta name="color-scheme" content="light">
<link rel="icon" href="${c.a('img/favicon.svg')}" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400..800&family=Geist+Mono:wght@500;600&display=swap">
<link rel="stylesheet" href="${c.a('css/main.css')}">
${preload}
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n')}
${pg.sinGsap ? '' : `<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js" defer></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js" defer></script>`}
<script type="module" src="${c.a('js/app.js')}"></script>
${pg.modulo ? `<script type="module" src="${c.a(`js/${pg.modulo}`)}"></script>` : ''}
</head>
<body data-pagina="${pg.tipo}"${pg.frasco ? ` data-frasco="${pg.frasco.p}" data-sabor="${pg.frasco.s}"` : ''}>
<a class="saltar" href="#contenido">Saltar al contenido</a>
${cabecera(c)}
${migasHTML(c, pg.migas)}
<main id="contenido" tabindex="-1">
${pg.cuerpo(c)}
</main>
${pie(c)}
${barraMovil(c)}
${cajon()}
<div class="aviso" data-aviso role="status" aria-live="polite"></div>
<canvas class="frasco-lienzo" id="frasco-lienzo" aria-hidden="true"></canvas>
<script>
/* Cada página nueva empieza arriba, también si la tienda se ve dentro de un marco alto (vistas previas, apps).
   Al volver con "atrás" o al recargar se respeta la posición. Va en línea para no depender de archivos en caché. */
(function () {
  var n = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  if (location.hash || (n && (n.type === 'back_forward' || n.type === 'reload'))) return;
  function arriba() {
    window.scrollTo(0, 0);
    if (window.top !== window) {
      var h = document.documentElement, pr = h.style.scrollPaddingTop; h.style.scrollPaddingTop = '0px';
      try { h.scrollIntoView({ block: 'start', behavior: 'instant' }); } catch (e) { /* nada */ }
      h.style.scrollPaddingTop = pr;
    }
  }
  arriba(); addEventListener('load', arriba, { once: true });
})();
</script>
<script type="application/json" id="catalogo">${catalogoJSON(c)}</script>
</body>
</html>
`;
  return html.replace(/\n{3,}/g, '\n\n');
}

/* ---------- piezas ---------- */
function imgProducto(c, p, s, { tam = '600', sizes = '(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 48vw', alt = '', lazy = true, prioridad = true, extra = '' } = {}) {
  const carga = lazy ? ' loading="lazy"' : (prioridad ? ' fetchpriority="high"' : '');
  if (p.imagenUrl || !tieneRender(p)) return `<img src="${esc(p.imagenUrl || c.a('img/sin-foto.svg'))}" width="${tam}" height="${tam}" alt="${esc(alt)}"${carga} decoding="async"${extra}>`;
  return `<img src="${c.a(foto(p, s, tam))}" srcset="${c.a(foto(p, s, 600))} 600w, ${c.a(foto(p, s, 1000))} 1000w" sizes="${sizes}" width="${tam}" height="${tam}" alt="${esc(alt)}"${carga} decoding="async"${extra}>`;
}

function valoracion(slug, c, enlace, corta = false) {
  const r = resumenResenas(slug);
  if (!r) return '';
  const media = String(r.media).replace('.', ',');
  if (corta) return `<p class="valoracion"><span class="estrellas" aria-hidden="true">${estrellas(r.media)}</span><span aria-hidden="true">${media} (${r.total})</span><span class="sr">${media} de 5 estrellas, ${r.total} ${r.total === 1 ? 'reseña' : 'reseñas'}</span></p>`;
  const inner = `<span class="estrellas" aria-hidden="true">${estrellas(r.media)}</span><span>${media} de 5, ${r.total} ${r.total === 1 ? 'reseña' : 'reseñas'}${sitio.resenasDeEjemplo ? ' de ejemplo' : ''}</span>`;
  return enlace ? `<a class="valoracion" href="${enlace}">${inner}</a>` : `<p class="valoracion">${inner}</p>`;
}

function tarjeta(c, p, i = 0, eager = false) {
  const s = p.sabores[0]; const pp = porPorcion(p); const agotado = !disponible(p);
  return `<article class="tarjeta" style="--i:${i}" data-revelar data-tarjeta="${p.slug}" data-precio="${p.precio}" data-orden-base="${i}">
  <div class="tarjeta-img">${imgProducto(c, p, s, { lazy: !eager, prioridad: false })}<p class="sello" data-stock-de="${p.slug}"${agotado ? '' : ' hidden'}>${agotado ? 'Agotado' : ''}</p></div>
  <div class="tarjeta-info">
    <p class="tarjeta-cat">${cat(p.categoria).nombre}</p>
    <h3><a href="${c.h(`/productos/${p.slug}/`)}">${esc(p.nombre)}</a></h3>
    ${p.sabores.length > 1 && tieneRender(p) && !p.imagenUrl ? `<div class="muestras" role="group" aria-label="Sabores de ${esc(p.nombre)}">${p.sabores.map((x, k) => `<button type="button" class="muestra" style="--c1:${x.c1};--c2:${x.c2}" data-muestra="${x.slug}" aria-pressed="${k === 0}" aria-label="${esc(x.nombre)}" title="${esc(x.nombre)}"></button>`).join('')}</div>` : ''}
    <p class="tarjeta-resumen">${esc(p.resumen)}</p>
    ${valoracion(p.slug, c, null, true)}
    <div class="tarjeta-pie"><p class="precio"><span data-precio-de="${p.slug}">${cop(p.precio)}</span>${pp ? `<small>${cop(pp)} por porción</small>` : `<small>${esc(p.presentacion)}</small>`}</p>
    <button class="btn btn-sec btn-sm" type="button" data-agregar="${p.slug}" data-sabor="${s.slug}"${agotado ? ' disabled' : ''} aria-label="Agregar ${esc(p.nombre)} sabor ${esc(s.nombre)} al carrito">Agregar</button></div>
  </div>
</article>`;
}

function selectorSabor(p, nombre, sel = 0) {
  return `<fieldset class="sabores"><legend>Sabor: <span data-sabor-nombre>${esc(p.sabores[sel].nombre)}</span></legend><div class="sabores-op">${p.sabores.map((s, i) => `<label class="sabor"><input type="radio" name="${nombre}" value="${s.slug}"${i === sel ? ' checked' : ''}><span class="sabor-muestra" style="--c1:${s.c1};--c2:${s.c2}" aria-hidden="true"></span><span>${esc(s.nombre)}</span></label>`).join('')}</div></fieldset>`;
}

function preguntasHTML(lista, id = 'preguntas', titulo = 'Preguntas frecuentes') {
  return `<section class="seccion wrap preguntas" id="${id}" aria-labelledby="${id}-t"><h2 class="h2 h2-sec" id="${id}-t">${titulo}</h2><div class="acordeon">${lista.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>`;
}

// Bloque de texto para buscadores: contenido real e indexable, plegado para que el cliente vea primero los productos.
function bloqueSEO(titulo, parrafos, enlaces = '') {
  return `<section class="wrap seo-bloque" aria-label="${esc(titulo)}"><details><summary><span>${esc(titulo)}</span></summary><div class="seo-texto">${parrafos.map((t) => `<p>${t}</p>`).join('')}${enlaces}</div></details></section>`;
}

function guiasTarjetas(c, lista, conFecha = false, eager = 0) {
  return `<ul class="guias-tarjetas">${lista.map((b, i) => { const img = portadaGuia(b); return `<li data-revelar><a class="guia-card" href="${c.h(`/blog/${b.slug}/`)}">${img ? `<img src="${c.a(`img/escenas/${img}-600.webp`)}" width="600" height="315" alt=""${i < eager ? '' : ' loading="lazy"'} decoding="async">` : ''}<span class="guia-card-txt">${conFecha ? `<time datetime="${b.fecha}">${fechaLarga(b.fecha)}</time>` : ''}<span class="guia-t">${esc(b.titulo)}</span><span class="guia-d">${esc(b.descripcion)}</span></span></a></li>`; }).join('')}</ul>`;
}

const preguntasGenerales = [
  ['¿Cuánto tarda el envío?', 'Entre 2 y 5 días hábiles según la ciudad. Los pedidos confirmados antes de las 2 p. m. salen el mismo día.'],
  ['¿Cuánto cuesta el envío?', `${cop(sitio.envio)} a todo el país. Es gratis en pedidos desde ${cop(sitio.envioGratisDesde)}.`],
  ['¿Cómo pago?', 'Al finalizar tu pedido te llevamos a Mercado Pago, donde eliges el medio de pago disponible para tu cuenta. No guardamos datos de tu tarjeta.'],
  ['¿Y si no me gusta?', `Tienes ${sitio.diasDevolucion} días desde que recibes el pedido para pedir el cambio o el reembolso, incluso si el envase está abierto.`],
];

function filtrosHTML(c, actual) {
  return `<nav class="filtros" aria-label="Categorías"><ul><li><a href="${c.h('/tienda/')}"${!actual ? ' aria-current="page"' : ''}>Todo</a></li>${categorias.map((k) => `<li><a href="${c.h(`/tienda/${k.slug}/`)}"${actual === k.slug ? ' aria-current="page"' : ''}>${k.nombre}</a></li>`).join('')}</ul></nav>`;
}

/* ---------- páginas ---------- */
const paginas = [];
const estrella = productos.find((p) => p.slug === 'whey-isolate' && con3D(p)) || productos.find(con3D) || productos[0];
const creatina = prod('creatina-monohidratada');
const orgLD = { '@context': 'https://schema.org', '@type': 'Organization', name: sitio.nombre, url: sitio.url, logo: abs('/assets/img/favicon.svg'), email: sitio.email };

// Inicio
paginas.push({
  ruta: '/', tipo: 'inicio', titulo: 'Halo Nutrition | Proteína whey, creatina y pre-entreno',
  descripcion: 'Suplementos deportivos con dosis declaradas y análisis por lote: whey isolate, creatina y pre-entreno. Envío a toda Colombia y 30 días de garantía.',
  frasco: con3D(estrella) ? { p: estrella.slug, s: estrella.sabores[0].slug } : null,
  lcp: con3D(estrella) ? { src: foto(estrella, estrella.sabores[0], 1000), srcset: `${foto(estrella, estrella.sabores[0], 600)} 600w, ${foto(estrella, estrella.sabores[0], 1000)} 1000w`, sizes: '(min-width: 1024px) 46vw, 90vw' } : null,
  jsonld: [orgLD, {
    '@context': 'https://schema.org', '@type': 'WebSite', name: sitio.nombre, url: sitio.url, inLanguage: sitio.idioma,
    potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${abs('/buscar/')}?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
  }],
  cuerpo: (c) => {
    const w = estrella; const ppw = porPorcion(w);
    return `
<section class="hero" aria-labelledby="hero-t" data-hero="${w.slug}" style="--hc1:${w.sabores[0].c1};--hc2:${w.sabores[0].c2}">
  <div class="orbes" aria-hidden="true"><span class="orbe o1"></span><span class="orbe o2"></span><span class="orbe o3"></span></div>
  <div class="wrap hero-in">
    <div class="hero-copy">
      <p class="hero-chip"><span aria-hidden="true"></span>Envío gratis desde ${cop(sitio.envioGratisDesde)}</p>
      <h1 id="hero-t" class="h1 titular"><span class="pal" style="--w:0">Más</span> <span class="pal" style="--w:1">fuerza,</span> <span class="pal" style="--w:2">cero</span> <span class="pal hueca" style="--w:3">relleno.</span></h1>
      <p class="hero-sub">Proteína aislada, creatina y pre-entreno con dosis declaradas y análisis de laboratorio por lote.</p>
    </div>
    <figure class="hero-media" data-pose="d:el:.8;m:el:.9" data-frasco-ancla>
      ${imgProducto(c, w, w.sabores[0], { tam: '1000', sizes: '(min-width: 1024px) 46vw, 80vw', alt: `Envase de ${w.nombre} de Halo, sabor ${w.sabores[0].nombre}`, lazy: false })}
      <span class="hero-sombra" aria-hidden="true"></span>
    </figure>
    <div class="hero-acciones">
      <div class="hero-sabor"><a class="hero-prod" href="${c.h(`/productos/${w.slug}/`)}" data-hero-enlace><strong>${esc(w.nombre)}</strong><span>${cop(w.precio)} · ${esc(w.presentacion)}</span></a>${selectorSabor(w, 'sabor-hero')}</div>
      <div class="cta"><button class="btn btn-pri btn-grande" type="button" data-agregar="${w.slug}" data-sabor-desde="sabor-hero">Agregar al carrito</button><a class="btn btn-sec btn-grande" href="#productos">Ver productos</a></div>
    </div>
    <a class="hero-bajar" href="#productos" aria-label="Bajar a los productos"><span aria-hidden="true"></span></a>
  </div>
  <div class="cinta" aria-hidden="true"><div class="cinta-in">${Array(2).fill(['Análisis de laboratorio por lote', 'Envío a toda Colombia', `${sitio.diasDevolucion} días de garantía`, '0 mezclas propietarias', 'Pago seguro con Mercado Pago', 'Despacho en 48 h'].map((t) => `<span>${t}</span>`).join('')).join('')}</div></div>
</section>

<section class="seccion wrap productos-sec" id="productos" aria-labelledby="productos-t">
  <div class="productos-cab"><h2 class="h2" id="productos-t">Nuestros productos</h2>${filtrosHTML(c, null)}</div>
  <div class="rejilla compacta" data-rejilla>${productos.map((p, i) => tarjeta(c, p, i, i < 6)).join('')}</div>
</section>

<section class="seccion wrap objetivos" aria-labelledby="obj-t">
  <h2 class="h2 h2-sec" id="obj-t">Compra por objetivo</h2>
  <ul class="objetivos-lista">${[['proteinas', 'Ganar músculo', 'Proteína whey y barras para llegar a tu meta diaria.'], ['rendimiento', 'Fuerza y energía', 'Creatina, pre-entreno y BCAA para rendir más.'], ['accesorios', 'Para llevar', 'Shakers que no gotean ni dejan grumos.']].map(([k, t, d]) => `<li data-revelar><a class="objetivo" href="${c.h(`/tienda/${k}/`)}">${escenaImg(c, `cat-${k}`, { sizes: '(min-width: 860px) 31vw, 92vw' })}<span class="objetivo-txt"><span class="objetivo-t">${t}</span><span>${d}</span><span class="objetivo-ir" aria-hidden="true">Ver ${cat(k).nombre.toLowerCase()} →</span></span></a></li>`).join('')}</ul>
</section>

<section class="lema" aria-hidden="true">
  <p class="lema-fila" data-lema="-1">Fuerza <i></i> Foco <i></i> Recuperación <i></i> Fuerza <i></i> Foco <i></i> Recuperación <i></i></p>
  <p class="lema-fila hueca" data-lema="1">Cero relleno <i></i> Dosis completas <i></i> Cero relleno <i></i> Dosis completas <i></i></p>
</section>

<section class="seccion wrap bento-sec" aria-labelledby="bento-t">
  <h2 class="h2 h2-sec" id="bento-t">Por qué Halo</h2>
  <div class="bento">
    <article class="bt bt-macro" data-revelar>
      <div class="anillo" data-anillo aria-hidden="true"><svg viewBox="0 0 120 120"><circle class="an-fondo" cx="60" cy="60" r="50"/><circle class="an-p" cx="60" cy="60" r="50" pathLength="100" style="--v:83"/><circle class="an-c" cx="60" cy="60" r="50" pathLength="100" style="--v:4;--o:83"/><circle class="an-g" cx="60" cy="60" r="50" pathLength="100" style="--v:2;--o:87"/></svg><span><strong><span data-contar="25">25</span> g</strong>proteína</span></div>
      <div><h3>Cada porción de 30 g</h3><ul class="macros"><li><i class="m-p"></i>Proteína <strong>25 g</strong></li><li><i class="m-c"></i>Carbohidratos <strong>1,2 g</strong></li><li><i class="m-g"></i>Grasa <strong>0,6 g</strong></li></ul><p>El 83 % de cada medida es proteína. Sin azúcar añadida ni mezclas propietarias.</p></div>
    </article>
    <article class="bt bt-envio" data-revelar><h3><strong><span data-contar="48">48</span> h</strong> y está en tu puerta</h3><p>Despacho el mismo día si pides antes de las 2 p. m.</p><div class="ruta" aria-hidden="true"><span class="camion"></span></div></article>
    <article class="bt bt-garantia" data-revelar><span class="g-ico g-garantia" aria-hidden="true"></span><h3><strong><span data-contar="${sitio.diasDevolucion}">${sitio.diasDevolucion}</span> días</strong></h3><p>para devolverlo, aunque el envase esté abierto.</p></article>
    <article class="bt bt-lab" data-revelar>${escenaImg(c, 'laboratorio', { sizes: '(min-width: 860px) 25vw, 46vw' })}<p><span class="g-ico g-lab" aria-hidden="true"></span>Cada lote pasa por un laboratorio independiente.</p></article>
  </div>
</section>

<section class="seccion wrap calc-sec" aria-labelledby="calc-t">
  <div class="calc-texto"><p class="eyebrow">Calculadora</p><h2 class="h2" id="calc-t">¿Cuánta proteína necesitas al día?</h2><p class="lead">Mueve la barra con tu peso y elige tu objetivo. Usamos el rango de 1,4 a 2 g por kilo que recomiendan las guías de nutrición deportiva.</p><a class="enlace" href="${c.h('/blog/cuanta-proteina-necesitas/')}">Lee la guía completa</a></div>
  <form class="calc" data-calc onsubmit="return false">
    <div class="calc-peso"><label for="calc-kg">Tu peso</label><output for="calc-kg" data-calc-kg>70 kg</output><input id="calc-kg" type="range" min="40" max="140" step="1" value="70"></div>
    <fieldset class="calc-obj"><legend>Tu objetivo</legend>${[['mantener', 'Mantenerme', 1.4], ['ganar', 'Ganar músculo', 1.8, true], ['definir', 'Definir', 2]].map(([v, t, f, sel]) => `<label><input type="radio" name="calc-obj" value="${f}"${sel ? ' checked' : ''}><span>${t}</span></label>`).join('')}</fieldset>
    <div class="calc-res" role="status"><p><strong data-calc-g>126</strong> g de proteína al día</p><p class="nota" data-calc-txt>Con 1 porción de ${esc(w.nombre)} cubres 25 g. Un tarro te dura 30 días.</p></div>
    <button class="btn btn-pri" type="button" data-agregar="${w.slug}" data-sabor="${w.sabores[0].slug}">Agregar ${esc(w.nombre)} · ${cop(w.precio)}</button>
  </form>
</section>

<section class="seccion wrap pasos-sec" aria-labelledby="pasos-t">
  <h2 class="h2 h2-sec" id="pasos-t">Así de simple</h2>
  <ol class="pasos">
    ${[['01', 'Elige tu suplemento', 'Pocas opciones, todas con la dosis completa en la etiqueta. Si dudas, la calculadora y las guías te ayudan.', 'whey-isolate', 0], ['02', 'Recíbelo en 48 horas', `Pagas seguro con Mercado Pago y te enviamos la guía por correo. Envío gratis desde ${cop(sitio.envioGratisDesde)}.`, 'pre-entreno-pulse', 0], ['03', 'Entrena y nota la diferencia', `Si no te convence, tienes ${sitio.diasDevolucion} días para devolverlo, aunque el envase esté abierto.`, 'creatina-monohidratada', 1]].map(([n, t, d, slug, si], i) => { const x = prod(slug) || w; const sb = x.sabores[si] || x.sabores[0]; return `<li class="paso" style="--i:${i};--c1:${sb.c1}"><span class="paso-n">${n}</span><div><h3>${t}</h3><p>${d}</p></div>${imgProducto(c, x, sb, { sizes: '(min-width: 860px) 220px, 120px', extra: ' class="paso-img"' })}</li>`; }).join('')}
  </ol>
</section>

<section class="seccion wrap resenas-sec" aria-labelledby="resenas-t">
  <h2 class="h2" id="resenas-t">Lo que dicen quienes ya entrenan con Halo</h2>
  ${sitio.resenasDeEjemplo ? '<p class="nota">Reseñas de ejemplo para esta demostración.</p>' : ''}
  <div class="resenas-muro">${Object.entries(resenas).filter(([slug]) => prod(slug)).flatMap(([slug, l]) => l.slice(0, 1).map((r) => ({ ...r, slug }))).slice(0, 4).map((r) => `<figure class="resena" data-revelar><span class="estrellas" aria-label="${r.rating} de 5 estrellas">${estrellas(r.rating)}</span><blockquote>“${esc(r.texto)}”</blockquote><figcaption><span class="avatar" style="--h:${tono(r.autor)}" aria-hidden="true">${esc(iniciales(r.autor))}</span><span><strong>${esc(r.autor)}</strong>, ${esc(r.ciudad)}<br>Compró <a href="${c.h(`/productos/${r.slug}/`)}">${esc(prod(r.slug).nombre)}</a></span><img class="resena-prod" src="${prod(r.slug).imagenUrl || c.a(foto(prod(r.slug), prod(r.slug).sabores[0], 160))}" width="160" height="160" alt="" loading="lazy" decoding="async"></figcaption></figure>`).join('')}</div>
</section>

${creatina ? `<section class="seccion wrap combo" aria-labelledby="combo-t" data-revelar>
  <div class="combo-img" aria-hidden="true">${imgProducto(c, w, w.sabores[1] || w.sabores[0], { sizes: '(min-width: 768px) 20vw, 40vw' })}${imgProducto(c, creatina, creatina.sabores[0], { sizes: '(min-width: 768px) 20vw, 40vw' })}</div>
  <div>
    <h2 class="h2" id="combo-t">Empieza por lo básico</h2>
    <p class="lead">${esc(w.nombre)} y Creatina cubren lo que más funciona: proteína suficiente y fuerza. Juntos suman ${cop(w.precio + creatina.precio)} y el envío te sale gratis.</p>
    <button class="btn btn-pri" type="button" data-agregar-combo="${w.slug}:${w.sabores[0].slug},${creatina.slug}:${creatina.sabores[0].slug}">Agregar los dos</button>
  </div>
</section>` : ''}

<section class="ciencia wrap" aria-labelledby="ciencia-t">
  <div class="ciencia-texto">
    <p class="eyebrow">Fórmulas claras</p>
    <h2 class="h2" id="ciencia-t">Lo que dice la etiqueta es lo que hay en el tarro.</h2>
    <figure class="ciencia-img">${escenaImg(c, 'laboratorio', { alt: `${w.nombre} de Halo en el laboratorio`, sizes: '(min-width: 860px) 44vw, 92vw' })}
      <span class="flota f1" aria-hidden="true">25 g proteína</span><span class="flota f2" aria-hidden="true">Lote analizado</span><span class="flota f3" aria-hidden="true">0 rellenos</span></figure>
  </div>
  <ol class="ciencia-lista">
    <li data-paso><strong>25 g</strong><p>de proteína por porción en Whey Isolate. Medido, no redondeado hacia arriba.</p></li>
    <li data-paso><strong>0</strong><p>mezclas propietarias. Cada ingrediente aparece con su dosis exacta.</p></li>
    <li data-paso><strong>1 lote, 1 análisis</strong><p>Un laboratorio independiente revisa cada lote antes de venderlo.</p></li>
  </ol>
</section>

<section class="seccion wrap familia" aria-labelledby="familia-t" data-revelar>
  ${escenaImg(c, 'familia', { alt: 'Toda la línea de suplementos Halo', sizes: '(min-width: 1320px) 1240px, 100vw', clase: 'familia-img' })}
  <div class="familia-txt"><h2 class="h2" id="familia-t">Pocos productos. Todos con dosis completas.</h2><p>Seis productos que se combinan entre sí, para que armes tu rutina sin pagar por rellenos.</p><a class="btn btn-pri" href="${c.h('/tienda/')}">Ver toda la tienda</a></div>
</section>

<section class="seccion wrap guias-sec" aria-labelledby="guias-t">
  <h2 class="h2 h2-sec" id="guias-t">Guías para elegir bien</h2>
  ${guiasTarjetas(c, blog)}
</section>

${preguntasHTML(preguntasGenerales)}

${bloqueSEO('Suplementos deportivos en Colombia: cómo elegir', [
  'En Halo Nutrition vendemos suplementos deportivos en Colombia con dosis declaradas en la etiqueta y análisis de laboratorio por lote. Nuestra línea incluye proteína whey isolate, creatina monohidratada micronizada, pre-entreno con cafeína, BCAA 2:1:1, barras de proteína y accesorios como shakers.',
  'Si buscas ganar masa muscular o recuperarte mejor, empieza por cubrir tu proteína diaria: la proteína whey aislada aporta 25 g por porción con muy poca grasa y lactosa. Para ganar fuerza en entrenamientos cortos e intensos, la creatina monohidratada es el suplemento con más estudios. El pre-entreno ayuda con energía y foco antes de entrenar.',
  `Enviamos a todas las ciudades de Colombia en 2 a 5 días hábiles. El envío cuesta ${cop(sitio.envio)} y es gratis en compras desde ${cop(sitio.envioGratisDesde)}. Pagas de forma segura con Mercado Pago y tienes ${sitio.diasDevolucion} días de garantía.`,
], `<p>Explora por categoría: ${categorias.map((k) => `<a href="${c.h(`/tienda/${k.slug}/`)}">${k.nombre.toLowerCase()}</a>`).join(', ')}. O lee nuestras <a href="${c.h('/blog/')}">guías de suplementación</a>.</p>`)}`;
  },
});

// Tienda y categorías
const textosCategoria = {
  null: ['Suplementos deportivos', 'Proteína, creatina, pre-entreno y accesorios con dosis declaradas.', 'Todos los suplementos de Halo tienen la dosis de cada ingrediente en la etiqueta y un análisis de laboratorio por lote. Elige proteína whey para completar tu proteína diaria, creatina monohidratada para fuerza, pre-entreno para energía y foco, o BCAA para hidratarte en sesiones largas. Enviamos a toda Colombia.'],
  proteinas: ['Proteínas', 'Whey isolate y barras proteicas para completar tu proteína diaria.', 'La proteína whey isolate aporta 25 g de proteína por porción con muy poca grasa y lactosa, y se mezcla sin grumos. Las barras proteicas suman 20 g de proteína con solo 2 g de azúcar. Ambas sirven para alcanzar tu meta de proteína sin cocinar más, después de entrenar o como snack.'],
  rendimiento: ['Rendimiento', 'Creatina, pre-entreno y BCAA para entrenar con más fuerza y foco.', 'La creatina monohidratada micronizada es el suplemento con más evidencia para fuerza y potencia: 5 g al día, sin fase de carga. El pre-entreno combina 200 mg de cafeína con citrulina y beta-alanina. Los BCAA 2:1:1 incluyen electrolitos para sesiones largas.'],
  accesorios: ['Accesorios', 'Shakers para preparar y llevar tus suplementos.', 'Nuestro shaker de 700 ml en tritán libre de BPA tiene tapa de rosca antiderrame y bolita de acero para mezclar sin grumos. Va al lavavajillas.'],
};
function paginaTienda(categoria) {
  const lista = categoria ? productos.filter((p) => p.categoria === categoria.slug) : productos;
  if (!lista.length) return;
  const ruta = categoria ? `/tienda/${categoria.slug}/` : '/tienda/';
  const textos = textosCategoria[categoria ? categoria.slug : null] || [categoria.nombre, '', ''];
  const migas = categoria ? [['Inicio', '/'], ['Tienda', '/tienda/'], [categoria.nombre, ruta]] : [['Inicio', '/'], ['Tienda', '/tienda/']];
  paginas.push({
    ruta, tipo: 'tienda', migas,
    titulo: categoria ? `${categoria.nombre}: suplementos deportivos | Halo Nutrition` : 'Tienda de suplementos deportivos | Halo Nutrition',
    descripcion: `${textos[1]} Envío a toda Colombia, gratis desde ${cop(sitio.envioGratisDesde)}. Pago seguro y ${sitio.diasDevolucion} días de garantía.`,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: textos[0], url: abs(ruta), inLanguage: sitio.idioma, mainEntity: { '@type': 'ItemList', numberOfItems: lista.length, itemListElement: lista.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(`/productos/${p.slug}/`), name: p.nombre })) } }],
    cuerpo: (c) => `
<section class="wrap tienda-cab"><div><h1 class="h1 h1-pag">${textos[0]}</h1><p class="lead">${textos[1]}</p></div>${escenaImg(c, categoria ? `cat-${categoria.slug}` : 'familia', { sizes: '(min-width: 760px) 360px, 92vw', lazy: false, clase: 'tienda-banner' })}</section>
<div class="wrap tienda-barra">
  ${filtrosHTML(c, categoria?.slug)}
  <div class="orden"><label for="orden">Ordenar por</label><select id="orden" data-orden><option value="destacados">Más vendidos</option><option value="precio-asc">Precio: menor a mayor</option><option value="precio-desc">Precio: mayor a menor</option></select></div>
</div>
<section class="wrap" aria-label="Productos"><h2 class="sr">Productos</h2><div class="rejilla compacta" data-rejilla data-categoria="${categoria ? categoria.slug : ''}">${lista.map((p, i) => tarjeta(c, p, i, i < 6)).join('')}</div><p class="cuenta-prod" data-cuenta-prod>${lista.length} ${lista.length === 1 ? 'producto' : 'productos'}</p></section>
${preguntasHTML(preguntasGenerales.slice(0, 3))}
${bloqueSEO(`Sobre ${textos[0].toLowerCase()}`, [textos[2], `Enviamos a toda Colombia en 2 a 5 días hábiles, gratis desde ${cop(sitio.envioGratisDesde)}. Pagas con Mercado Pago y tienes ${sitio.diasDevolucion} días de garantía.`])}`,
  });
}
paginaTienda(null);
categorias.forEach(paginaTienda);

// Productos
productos.forEach((p) => {
  const ruta = `/productos/${p.slug}/`; const k = cat(p.categoria); const s0 = p.sabores[0]; const pp = porPorcion(p);
  const rr = resenas[p.slug] || []; const resu = resumenResenas(p.slug);
  const relacionados = productos.filter((x) => x.slug !== p.slug).slice(0, 4);
  const guia = blog.find((b) => b.producto === p.slug);
  const productoLD = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.nombre, description: p.descripcion, sku: p.slug, category: k.nombre,
    brand: { '@type': 'Brand', name: sitio.nombre },
    image: p.imagenUrl ? [p.imagenUrl] : p.sabores.map((s) => fotoAbs(p, s)),
    offers: {
      '@type': 'Offer', url: abs(ruta), priceCurrency: sitio.moneda, price: p.precio, priceValidUntil: VALIDO_HASTA,
      availability: disponible(p) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: sitio.nombre },
      shippingDetails: { '@type': 'OfferShippingDetails', shippingRate: { '@type': 'MonetaryAmount', value: sitio.envio, currency: sitio.moneda }, shippingDestination: { '@type': 'DefinedRegion', addressCountry: sitio.pais }, deliveryTime: { '@type': 'ShippingDeliveryTime', handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' }, transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 5, unitCode: 'DAY' } } },
      hasMerchantReturnPolicy: { '@type': 'MerchantReturnPolicy', applicableCountry: sitio.pais, returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow', merchantReturnDays: sitio.diasDevolucion, returnMethod: 'https://schema.org/ReturnByMail' },
    },
  };
  if (p.sabores.length > 1) productoLD.additionalProperty = [{ '@type': 'PropertyValue', name: 'Sabores', value: p.sabores.map((s) => s.nombre).join(', ') }];
  // Las reseñas solo se marcan como datos estructurados cuando son reales (resenasDeEjemplo: false).
  if (resu && !sitio.resenasDeEjemplo) {
    productoLD.aggregateRating = { '@type': 'AggregateRating', ratingValue: resu.media, reviewCount: resu.total };
    productoLD.review = rr.map((r) => ({ '@type': 'Review', author: { '@type': 'Person', name: r.autor }, datePublished: r.fecha, reviewBody: r.texto, reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 } }));
  }
  const titulo = `${p.nombre} ${p.presentacion.split(',')[0]} | ${k.nombre} | Halo Nutrition`;
  const agotado = !disponible(p);
  paginas.push({
    ruta, tipo: 'producto', migas: [['Inicio', '/'], ['Tienda', '/tienda/'], [k.nombre, `/tienda/${k.slug}/`], [p.nombre, ruta]],
    titulo: titulo.length > 62 ? `${p.nombre} | Halo Nutrition Colombia` : titulo,
    descripcion: `${p.resumen} ${cop(p.precio)}${pp ? ` (${cop(pp)} por porción)` : ''}. Envío a toda Colombia y ${sitio.diasDevolucion} días de garantía.`.slice(0, 160),
    frasco: con3D(p) ? { p: p.slug, s: s0.slug } : null, tipoOg: 'product', ogImagenAbs: fotoAbs(p, s0),
    lcp: con3D(p) ? { src: foto(p, s0, 1000), srcset: `${foto(p, s0, 600)} 600w, ${foto(p, s0, 1000)} 1000w`, sizes: '(min-width: 1024px) 50vw, 92vw' } : null,
    jsonld: [productoLD],
    cuerpo: (c) => `
<article class="wrap ficha" data-producto="${p.slug}">
  <figure class="ficha-galeria" style="--c1:${s0.c1}"${con3D(p) ? ' data-pose="d:el:.92;m:el:.92" data-frasco-ancla' : ''}>
    ${imgProducto(c, p, s0, { tam: '1000', sizes: '(min-width: 1024px) 50vw, 92vw', alt: `${p.nombre} de Halo, sabor ${s0.nombre}, ${p.presentacion}`, lazy: false, extra: ' data-ficha-img' })}
  </figure>
  <div class="ficha-info">
    <p class="tarjeta-cat"><a href="${c.h(`/tienda/${k.slug}/`)}">${k.nombre}</a></p>
    <h1 class="ficha-t">${esc(p.nombre)}</h1>
    ${valoracion(p.slug, c, rr.length ? '#resenas' : null)}
    <p class="precio precio-g"><span data-precio-de="${p.slug}">${cop(p.precio)}</span><small>${pp ? `${cop(pp)} por porción, ` : ''}${esc(p.presentacion)}</small></p>
    <p class="stock-linea" data-stock-ficha="${p.slug}"${agotado ? '' : ' hidden'}>${agotado ? 'Agotado por ahora' : ''}</p>
    <p class="lead">${esc(p.resumen)}</p>
    <form class="compra" data-compra="${p.slug}">
      ${selectorSabor(p, 'sabor')}
      <div class="compra-fila">
        <div class="cantidad"><button type="button" data-cant="-1" aria-label="Quitar una unidad">−</button><label class="sr" for="cantidad">Cantidad</label><input id="cantidad" name="cantidad" type="number" inputmode="numeric" min="1" max="9" value="1"><button type="button" data-cant="1" aria-label="Agregar una unidad">+</button></div>
        <button class="btn btn-pri btn-grande" type="submit" data-boton-compra${agotado ? ' disabled' : ''}>Agregar al carrito</button>
      </div>
    </form>
    <ul class="confianza">
      <li><strong>Llega en 2 a 5 días hábiles.</strong> Envío gratis desde ${cop(sitio.envioGratisDesde)}.</li>
      <li><strong>${sitio.diasDevolucion} días de garantía.</strong> Si no te gusta, te devolvemos el dinero.</li>
      <li><strong>Pago seguro con Mercado Pago.</strong> No guardamos datos de tu tarjeta.</li>
    </ul>
    <ul class="beneficios">${p.beneficios.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
  </div>
</article>
${p.datos.length ? `<section class="wrap seccion" aria-labelledby="datos-t"><h2 class="h2 h2-sec" id="datos-t">Datos clave</h2><div class="datos">${p.datos.map((d) => `<div class="dato" data-revelar><strong>${esc(d.v)}</strong><span class="dato-k">${esc(d.k)}</span><span class="dato-p">${esc(d.por)}</span></div>`).join('')}</div></section>` : ''}
${rr.length ? `<section class="wrap seccion" id="resenas" aria-labelledby="resenas-t"><h2 class="h2 h2-sec" id="resenas-t">Reseñas</h2>${valoracion(p.slug, c)}${sitio.resenasDeEjemplo ? '<p class="nota">Reseñas de ejemplo para esta demostración.</p>' : ''}<div class="resenas-muro">${rr.map((r) => `<figure class="resena"><blockquote>“${esc(r.texto)}”</blockquote><figcaption><span class="estrellas" aria-label="${r.rating} de 5 estrellas">${estrellas(r.rating)}</span> ${esc(r.autor)}, ${esc(r.ciudad)}. <time datetime="${r.fecha}">${fechaLarga(r.fecha)}</time></figcaption></figure>`).join('')}</div></section>` : ''}
<section class="seccion carril-sec" aria-labelledby="rel-t"><div class="wrap carril-cab"><h2 class="h2 h2-sec" id="rel-t">Combina con</h2></div><div class="carril" tabindex="0" aria-label="Productos relacionados, desplázate horizontalmente">${relacionados.map((x, i) => tarjeta(c, x, i)).join('')}</div></section>
<section class="wrap seccion detalles" aria-labelledby="detalles-t">
  <h2 class="h2 h2-sec" id="detalles-t">Detalles de ${esc(p.nombre)}</h2>
  <div class="acordeon">
    <details><summary>Descripción</summary><p>${esc(p.descripcion)}</p>${guia ? `<p>Lee la guía: <a href="${c.h(`/blog/${guia.slug}/`)}">${esc(guia.titulo)}</a>.</p>` : ''}</details>
    ${p.uso ? `<details><summary>Cómo se usa</summary><p>${esc(p.uso)}</p></details>` : ''}
    ${p.nutricion ? `<details><summary>Información nutricional</summary><div class="tabla-env"><table class="nutricion"><caption class="sr">Información nutricional de ${esc(p.nombre)}</caption><tbody>${p.nutricion.map(([a, b]) => `<tr><th scope="row">${esc(a)}</th><td>${esc(b)}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
    ${p.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
    <details><summary>Envío, devoluciones y pago</summary><p>Enviamos a toda Colombia en 2 a 5 días hábiles por ${cop(sitio.envio)}, gratis desde ${cop(sitio.envioGratisDesde)}. Tienes ${sitio.diasDevolucion} días para pedir cambio o reembolso. El pago se hace en Mercado Pago.</p></details>
  </div>
</section>
<div class="barra-compra" data-barra-compra hidden><div><strong>${esc(p.nombre)}</strong><span data-precio-de="${p.slug}">${cop(p.precio)}</span></div><button class="btn btn-pri" type="button" data-barra-agregar${agotado ? ' disabled' : ''}>Agregar al carrito</button></div>`,
  });
});

// Nosotros
paginas.push({
  ruta: '/nosotros/', tipo: 'nosotros', migas: [['Inicio', '/'], ['Nosotros', '/nosotros/']],
  titulo: 'Nosotros | Halo Nutrition, suplementos con dosis declaradas',
  descripcion: 'Halo nació para que entiendas lo que tomas: pocas fórmulas, dosis completas y análisis de laboratorio por lote. Conoce cómo trabajamos.',
  jsonld: [{ ...orgLD, '@type': 'Organization' }],
  cuerpo: (c) => `
<section class="wrap nosotros-cab">
  <div><h1 class="h1 h1-pag">Suplementos que se entienden.</h1><p class="lead">Halo empezó con dos nutricionistas cansadas de etiquetas confusas. Hoy hacemos pocos productos y los hacemos bien.</p></div>
  ${escenaImg(c, 'familia', { alt: 'Línea de productos Halo', sizes: '(min-width: 760px) 40vw, 92vw', lazy: false, clase: 'nosotros-img' })}
</section>
<section class="wrap seccion historia-con-img"><figure>${escenaImg(c, 'laboratorio', { alt: 'Envase de Halo en el laboratorio', sizes: '(min-width: 760px) 40vw, 92vw', lazy: false })}</figure><div class="historia">
  <p>Cada fórmula se diseña con nutricionistas deportivos y se fabrica en plantas con buenas prácticas de manufactura. Antes de vender un lote, un laboratorio independiente confirma que tiene lo que dice la etiqueta.</p>
  <p>Publicamos ese análisis para que cualquiera lo pueda revisar. Si algo no cuadra, preferimos no venderlo.</p>
</div></section>
${preguntasHTML(preguntasGenerales)}
<section class="wrap seccion contacto" id="contacto" aria-labelledby="contacto-t"><h2 class="h2" id="contacto-t">Contacto</h2><p class="lead">Escríbenos y te respondemos el mismo día hábil.</p><p class="contacto-dato"><span data-copiable>${sitio.email}</span> <button class="btn btn-sec btn-sm" type="button" data-copiar="${sitio.email}">Copiar correo</button></p><p class="nota">${sitio.horario}</p></section>`,
});

// Envíos y devoluciones
paginas.push({
  ruta: '/envios-y-devoluciones/', tipo: 'texto', migas: [['Inicio', '/'], ['Envíos y devoluciones', '/envios-y-devoluciones/']],
  titulo: 'Envíos y devoluciones | Halo Nutrition',
  descripcion: `Envío a toda Colombia por ${cop(sitio.envio)}, gratis desde ${cop(sitio.envioGratisDesde)}. ${sitio.diasDevolucion} días para cambios o reembolso, incluso con el envase abierto.`,
  cuerpo: () => `
<article class="wrap texto-largo">
  <h1 class="h1 h1-pag">Envíos y devoluciones</h1>
  <h2>Envíos</h2>
  <p>Enviamos a toda Colombia. El costo es ${cop(sitio.envio)} y es gratis en pedidos desde ${cop(sitio.envioGratisDesde)}. Los pedidos confirmados antes de las 2 p. m. de lunes a viernes salen el mismo día.</p>
  <p>La entrega tarda entre 2 y 5 días hábiles según la ciudad. Te enviamos el número de guía por correo para que sigas tu pedido.</p>
  <h2>Garantía de ${sitio.diasDevolucion} días</h2>
  <p>Si un producto no te convence, escríbenos dentro de los ${sitio.diasDevolucion} días siguientes a la entrega. Te devolvemos el dinero o te lo cambiamos, aunque el envase esté abierto.</p>
  <h2>Productos con defecto</h2>
  <p>Si algo llega dañado, envíanos una foto a ${sitio.email} y lo reponemos sin costo.</p>
</article>`,
});

// Búsqueda (no indexable: resultados generados en el navegador)
paginas.push({
  ruta: '/buscar/', tipo: 'buscar', indexar: false, titulo: 'Buscar productos | Halo Nutrition', descripcion: 'Busca suplementos de Halo Nutrition por nombre, sabor o categoría.',
  cuerpo: (c) => `
<section class="wrap buscar-pag" aria-labelledby="buscar-t">
  <h1 class="h1 h1-pag" id="buscar-t">Buscar</h1>
  <form class="buscar-grande" role="search" action="${c.h('/buscar/')}" method="get" data-buscar-pagina>
    <label class="sr" for="q-pagina">Buscar productos</label>
    <input id="q-pagina" name="q" type="search" placeholder="Nombre, sabor o categoría" autocomplete="off" autocapitalize="none" enterkeyhint="search">
    <button class="btn btn-pri" type="submit">Buscar</button>
  </form>
  <p class="cuenta-prod" data-buscar-resumen role="status">Todos los productos</p>
  <h2 class="sr">Resultados</h2>
  <div class="rejilla compacta" data-buscar-resultados>${productos.map((p, i) => tarjeta(c, p, i, i < 6)).join('')}</div>
</section>`,
});

// Cuenta y administración (no indexables)
paginas.push({
  ruta: '/cuenta/', tipo: 'cuenta', indexar: false, titulo: 'Mi cuenta | Halo Nutrition', descripcion: 'Inicia sesión o crea tu cuenta en Halo Nutrition para ver tus pedidos.', modulo: 'cuenta.js', sinGsap: true,
  cuerpo: () => `<section class="wrap cuenta-pag" data-cuenta-app aria-live="polite"><h1 class="h1 h1-pag">Mi cuenta</h1><p class="nota">Cargando…</p><noscript><p>Necesitas JavaScript activado para iniciar sesión.</p></noscript></section>`,
});
paginas.push({
  ruta: '/admin/', tipo: 'admin', indexar: false, titulo: 'Panel de administración | Halo Nutrition', descripcion: 'Panel de administración de la tienda.', modulo: 'admin.js', sinGsap: true,
  cuerpo: () => `<section class="admin" data-admin-app><div class="wrap"><h1 class="h1 h1-pag">Panel de administración</h1><p class="nota">Cargando…</p></div></section>`,
});

// Carrito y retorno de pago
paginas.push({
  ruta: '/carrito/', tipo: 'carrito', indexar: false, titulo: 'Tu carrito | Halo Nutrition', descripcion: 'Revisa tu pedido y paga de forma segura con Mercado Pago.', sinGsap: true,
  cuerpo: () => `
<section class="wrap carrito-pag" aria-labelledby="carrito-t">
  <h1 class="h1 h1-pag" id="carrito-t">Tu carrito</h1>
  <div class="carrito-rejilla">
    <div class="carrito-items" data-carrito-items><noscript><p>Necesitas JavaScript activado para ver tu carrito.</p></noscript></div>
    <aside class="resumen" aria-labelledby="resumen-t" data-resumen>
      <h2 id="resumen-t">Resumen</h2>
      <div data-resumen-cifras></div>
      <button class="btn btn-pri btn-grande" type="button" data-pagar disabled>Pagar con Mercado Pago</button>
      <p class="campo-error" data-pago-error role="alert"></p>
      <p class="nota" data-pago-nota>Te llevamos a Mercado Pago para elegir tu medio de pago. Volverás aquí al terminar.</p>
      <ul class="confianza compacta"><li><strong>${sitio.diasDevolucion} días de garantía.</strong></li><li><strong>Envío gratis desde ${cop(sitio.envioGratisDesde)}.</strong></li></ul>
    </aside>
  </div>
</section>`,
});
[['exito', 'Pago aprobado', 'Gracias por tu compra. Te enviamos la confirmación por correo y el número de guía cuando salga tu pedido.', true],
  ['pendiente', 'Pago pendiente', 'Tu pago está en proceso. Te escribimos apenas Mercado Pago lo confirme.', true],
  ['error', 'El pago no se completó', 'No se hizo ningún cobro. Puedes intentarlo de nuevo con otro medio de pago.', false]].forEach(([slug, t, d, vaciar]) => {
  paginas.push({
    ruta: `/pago/${slug}/`, tipo: 'pago', indexar: false, titulo: `${t} | Halo Nutrition`, descripcion: d, sinGsap: true,
    cuerpo: (c) => `<section class="wrap estado-pago"${vaciar ? ' data-vaciar-carrito' : ''}${slug === 'exito' ? ' data-celebrar' : ''}><h1 class="h1 h1-pag">${slug === 'exito' ? '<span class="check-grande" aria-hidden="true"></span>' : ''}${t}</h1><p class="lead">${d}</p><div class="cta">${slug === 'error' ? `<a class="btn btn-pri" href="${c.h('/carrito/')}">Volver al carrito</a>` : `<a class="btn btn-pri" href="${c.h('/tienda/')}">Seguir comprando</a><a class="btn btn-sec" href="${c.h('/cuenta/')}">Ver mis pedidos</a>`}</div></section>`,
  });
});

// Blog
paginas.push({
  ruta: '/blog/', tipo: 'blog', migas: [['Inicio', '/'], ['Guías', '/blog/']],
  titulo: 'Guías de suplementación deportiva | Halo Nutrition',
  descripcion: 'Guías claras sobre proteína, creatina y pre-entreno: cómo elegir, cuánto tomar y qué esperar. Escritas por el equipo de nutrición de Halo.',
  jsonld: [{ '@context': 'https://schema.org', '@type': 'Blog', name: 'Guías Halo', url: abs('/blog/'), inLanguage: sitio.idioma, blogPost: blog.map((b) => ({ '@type': 'BlogPosting', headline: b.titulo, url: abs(`/blog/${b.slug}/`), datePublished: b.fecha })) }],
  cuerpo: (c) => `
<section class="wrap blog-cab"><h1 class="h1 h1-pag">Guías para entrenar mejor</h1><p class="lead">Respuestas cortas a las dudas que más nos llegan.</p></section>
<section class="wrap seccion">${guiasTarjetas(c, [...blog].sort((a, b) => b.fecha.localeCompare(a.fecha)), true, 4)}</section>`,
});
blog.forEach((b) => {
  const ruta = `/blog/${b.slug}/`; const p = prod(b.producto) || estrella;
  const otras = blog.filter((x) => x.slug !== b.slug).slice(0, 3);
  paginas.push({
    ruta, tipo: 'articulo', migas: [['Inicio', '/'], ['Guías', '/blog/'], [b.titulo, ruta]], tipoOg: 'article',
    titulo: `${b.tituloSeo || b.titulo.split(":")[0]} | Guías Halo`, descripcion: b.descripcion,
    frasco: con3D(p) ? { p: p.slug, s: p.sabores[0].slug } : null,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: b.titulo, description: b.descripcion, datePublished: b.fecha, dateModified: b.fecha, inLanguage: sitio.idioma, author: { '@type': 'Organization', name: sitio.nombre }, publisher: { '@type': 'Organization', name: sitio.nombre, logo: { '@type': 'ImageObject', url: abs('/assets/img/favicon.svg') } }, mainEntityOfPage: abs(ruta), image: portadaGuia(b) ? abs(`/assets/img/escenas/${portadaGuia(b)}-1200.webp`) : abs('/assets/img/og-halo.jpg'), keywords: b.palabrasClave.join(', ') }],
    cuerpo: (c) => `
<article class="wrap texto-largo articulo">
  <header><h1 class="h1 h1-pag">${esc(b.titulo)}</h1><p class="nota">Por ${b.autor}. <time datetime="${b.fecha}">${fechaLarga(b.fecha)}</time></p></header>
  ${portadaGuia(b) ? `<figure class="articulo-portada"><img src="${c.a(`img/escenas/${portadaGuia(b)}-1200.webp`)}" srcset="${c.a(`img/escenas/${portadaGuia(b)}-600.webp`)} 600w, ${c.a(`img/escenas/${portadaGuia(b)}-1200.webp`)} 1200w" sizes="(min-width: 800px) 760px, 92vw" width="1200" height="630" alt="${esc(`${p.nombre} de Halo: ${b.titulo.split(':')[0].toLowerCase()}`)}" decoding="async"></figure>` : ''}
  ${b.cuerpo.map(([t, v]) => (t === 'ul' ? `<ul>${v.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : `<${t}>${esc(v)}</${t}>`)).join('\n  ')}
  <aside class="articulo-cta" aria-labelledby="cta-t"><div><h2 id="cta-t">${esc(p.nombre)}</h2><p>${esc(p.resumen)}</p><a class="btn btn-pri" href="${c.h(`/productos/${p.slug}/`)}">Ver ${esc(p.nombre)}</a></div><div class="articulo-cta-img" aria-hidden="true"${con3D(p) ? ' data-pose="d:el:.9" data-frasco-ancla' : ''}>${imgProducto(c, p, p.sabores[0], { sizes: '200px' })}</div></aside>
  <nav class="otras-guias" aria-labelledby="otras-t"><h2 id="otras-t">Otras guías</h2><ul>${otras.map((o) => `<li><a href="${c.h(`/blog/${o.slug}/`)}">${esc(o.titulo)}</a></li>`).join('')}</ul></nav>
</article>`,
  });
});

// 404
paginas.push({
  ruta: '/404.html', tipo: 'texto', indexar: false, canonical: false, titulo: 'Página no encontrada | Halo Nutrition', descripcion: 'Esta página no existe. Vuelve a la tienda de Halo Nutrition.',
  cuerpo: (c) => `<section class="wrap estado-pago"><h1 class="h1 h1-pag">No encontramos esta página.</h1><p class="lead">Puede que el enlace esté viejo. Busca lo que necesitas o vuelve a la tienda.</p><div class="cta"><a class="btn btn-pri" href="${c.h('/tienda/')}">Ir a la tienda</a><a class="btn btn-sec" href="${c.h('/buscar/')}">Buscar productos</a></div></section>`,
});

/* ---------- escritura ---------- */
await rm(salida, { recursive: true, force: true });
await mkdir(salida, { recursive: true });
await cp(join(raiz, 'src/assets'), join(salida, 'assets'), { recursive: true });
// Las importaciones entre módulos también llevan la versión.
for (const f of await readdir(join(salida, 'assets/js'))) {
  const ruta = join(salida, 'assets/js', f);
  await writeFile(ruta, (await readFile(ruta, 'utf8')).replace(/(from\s+|import\()'(\.\/[\w-]+\.js)'/g, `$1'$2?v=${VERSION}'`));
}
for (const pg of paginas) {
  const archivo = pg.ruta.endsWith('.html') ? join(salida, pg.ruta) : join(salida, pg.ruta, 'index.html');
  await mkdir(dirname(archivo), { recursive: true });
  // El 404 vive en la raíz: se genera con rutas relativas desde la raíz.
  await writeFile(archivo, layout(pg.ruta === '/404.html' ? { ...pg, ruta: '/' } : pg));
}
const indexables = paginas.filter((p) => p.indexar !== false);
const imagenesDe = (ruta) => {
  const m = ruta.match(/^\/productos\/([^/]+)\/$/); if (!m) return '';
  const p = prod(m[1]);
  return (p.imagenUrl ? [p.imagenUrl] : p.sabores.map((s) => fotoAbs(p, s))).map((u) => `<image:image><image:loc>${esc(u)}</image:loc></image:image>`).join('');
};
await writeFile(join(salida, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${indexables.map((p) => `  <url><loc>${abs(p.ruta)}</loc><lastmod>${HOY}</lastmod>${imagenesDe(p.ruta)}</url>`).join('\n')}
</urlset>
`);
await writeFile(join(salida, 'robots.txt'), `User-agent: *
Allow: /
Disallow: /carrito/
Disallow: /pago/
Disallow: /api/
Disallow: /cuenta/
Disallow: /admin/
Disallow: /buscar/

Sitemap: ${abs('/sitemap.xml')}
`);
console.log(`Páginas: ${paginas.length} en ${salida}${SB_URL ? ' (datos de Supabase)' : ' (datos del catálogo local)'}`);
