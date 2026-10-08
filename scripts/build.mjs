// Generador estático del sitio. Lee src/data/catalogo.mjs y escribe HTML, sitemap.xml y robots.txt.
// Uso:  node scripts/build.mjs                  -> public/  (producción, URLs limpias)
//       node scripts/build.mjs --preview <dir>  -> <dir>   (vista previa: enlaces a index.html explícitos)
import { mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sitio, categorias, productos, resenas, blog } from '../src/data/catalogo.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const PREVIEW = args.includes('--preview');
const salida = PREVIEW ? args[args.indexOf('--preview') + 1] : join(raiz, 'public');
const HOY = new Date().toISOString().slice(0, 10);

/* ---------- utilidades ---------- */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const cop = (n) => `$ ${num.format(n)}`;
const porPorcion = (p) => (p.porciones ? Math.round(p.precio / p.porciones / 100) * 100 : null);
const abs = (ruta) => sitio.url + ruta;
const cat = (slug) => categorias.find((c) => c.slug === slug);
const prod = (slug) => productos.find((p) => p.slug === slug);
const foto = (p, s, t) => `img/productos/${p.slug}-${s.slug}-${t}.webp`;
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
    ruta,
    h: (p) => {
      const limpio = p.replace(/^\//, '');
      const conAncla = limpio.split('#');
      let destino = base + conAncla[0];
      if (PREVIEW && (destino.endsWith('/') || conAncla[0] === '')) destino += 'index.html';
      if (destino === './') destino = './';
      return destino + (conAncla[1] ? '#' + conAncla[1] : '');
    },
    a: (p) => base + 'assets/' + p,
  };
}

function cabecera(c) {
  const enlaces = [['/tienda/', 'Tienda'], ['/blog/', 'Guías'], ['/nosotros/', 'Nosotros']];
  const actual = (r) => (c.ruta.startsWith(r) ? ' aria-current="page"' : '');
  return `<header class="cabecera">
  <div class="cabecera-in">
    <a class="logo" href="${c.h('/')}" aria-label="Halo Nutrition, ir al inicio"><span class="logo-aro" aria-hidden="true"></span>HALO</a>
    <nav class="menu" aria-label="Principal"><ul>${enlaces.map(([r, t]) => `<li><a href="${c.h(r)}"${actual(r)}>${t}</a></li>`).join('')}</ul></nav>
    <a class="btn-carrito" href="${c.h('/carrito/')}" data-abrir-carrito>Carrito <span class="cuenta" data-cuenta aria-hidden="true">0</span><span class="sr" data-cuenta-texto>, 0 productos</span></a>
  </div>
</header>`;
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
    <nav aria-label="Ayuda"><h2>Ayuda</h2><ul><li><a href="${c.h('/envios-y-devoluciones/')}">Envíos y devoluciones</a></li><li><a href="${c.h('/nosotros/#preguntas')}">Preguntas frecuentes</a></li><li><a href="${c.h('/nosotros/#contacto')}">Contacto</a></li></ul></nav>
    <nav aria-label="Empresa"><h2>Halo</h2><ul><li><a href="${c.h('/nosotros/')}">Nosotros</a></li><li><a href="${c.h('/blog/')}">Guías</a></li></ul></nav>
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

function migasLD(migas) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: migas.map(([t, r], i) => ({ '@type': 'ListItem', position: i + 1, name: t, item: abs(r) })) };
}

function layout(pg) {
  const c = contexto(pg.ruta);
  const titulo = pg.titulo;
  const ld = [...(pg.jsonld || [])];
  if (pg.migas) ld.push(migasLD(pg.migas));
  const og = abs('/assets/' + (pg.ogImagen || 'img/og-halo.jpg'));
  const preload = pg.lcp ? `<link rel="preload" as="image" href="${c.a(pg.lcp.src)}" imagesrcset="${pg.lcp.srcset.split(', ').map((x) => { const [u, w] = x.split(' '); return c.a(u) + ' ' + w; }).join(', ')}" imagesizes="${pg.lcp.sizes}" fetchpriority="high">` : '';
  const html = `<!doctype html>
<html lang="es-CO">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(pg.descripcion)}">
<link rel="canonical" href="${abs(pg.ruta)}">
<meta name="robots" content="${pg.indexar === false ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">
<meta property="og:type" content="${pg.tipoOg || 'website'}">
<meta property="og:locale" content="es_CO">
<meta property="og:site_name" content="${sitio.nombre}">
<meta property="og:title" content="${esc(pg.ogTitulo || titulo)}">
<meta property="og:description" content="${esc(pg.descripcion)}">
<meta property="og:url" content="${abs(pg.ruta)}">
<meta property="og:image" content="${og}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f3f4f6">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0e1013">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="${c.a('img/favicon.svg')}" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400..800&family=Geist+Mono:wght@500;600&display=swap">
<link rel="stylesheet" href="${c.a('css/main.css')}">
${preload}
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n')}
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js" defer></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js" defer></script>
<script type="module" src="${c.a('js/app.js')}"></script>
</head>
<body data-pagina="${pg.tipo}"${pg.frasco ? ` data-frasco="${pg.frasco.p}" data-sabor="${pg.frasco.s}"` : ''}>
<a class="saltar" href="#contenido">Saltar al contenido</a>
${cabecera(c)}
${migasHTML(c, pg.migas)}
<main id="contenido" tabindex="-1">
${pg.cuerpo(c)}
</main>
${pie(c)}
${cajon()}
<div class="aviso" data-aviso role="status" aria-live="polite"></div>
<canvas class="frasco-lienzo" id="frasco-lienzo" aria-hidden="true"></canvas>
<script type="application/json" id="catalogo">${JSON.stringify({ productos: productos.map(({ slug, nombre, precio, porciones, presentacion, forma, sabores, categoria }) => ({ slug, nombre, precio, porciones, presentacion, forma, sabores, categoria, url: c.h(`/productos/${slug}/`) })), envio: sitio.envio, gratisDesde: sitio.envioGratisDesde, assets: c.a(''), carrito: c.h('/carrito/'), tienda: c.h('/tienda/') })}</script>
</body>
</html>
`;
  return html.replace(/\n{3,}/g, '\n\n');
}

/* ---------- piezas ---------- */
function imgProducto(c, p, s, { tam = '600', sizes = '(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 80vw', alt = '', lazy = true, prioridad = true, extra = '' } = {}) {
  return `<img src="${c.a(foto(p, s, tam))}" srcset="${c.a(foto(p, s, 600))} 600w, ${c.a(foto(p, s, 1000))} 1000w" sizes="${sizes}" width="${tam}" height="${tam}" alt="${esc(alt)}"${lazy ? ' loading="lazy"' : (prioridad ? ' fetchpriority="high"' : '')} decoding="async"${extra}>`;
}

function valoracion(slug, c, enlace, corta = false) {
  const r = resumenResenas(slug);
  if (!r) return '';
  if (corta) return `<p class="valoracion"><span class="estrellas" aria-hidden="true">${estrellas(r.media)}</span><span aria-hidden="true">${String(r.media).replace('.', ',')} (${r.total})</span><span class="sr">${String(r.media).replace('.', ',')} de 5 estrellas, ${r.total} ${r.total === 1 ? 'reseña' : 'reseñas'}</span></p>`;
  const txt = `${String(r.media).replace('.', ',')} de 5, ${r.total} ${r.total === 1 ? 'reseña' : 'reseñas'}${sitio.resenasDeEjemplo ? ' de ejemplo' : ''}`;
  const inner = `<span class="estrellas" aria-hidden="true">${estrellas(r.media)}</span><span>${txt}</span>`;
  return enlace ? `<a class="valoracion" href="${enlace}">${inner}</a>` : `<p class="valoracion">${inner}</p>`;
}

function tarjeta(c, p, i = 0, eager = false) {
  const s = p.sabores[0];
  const pp = porPorcion(p);
  return `<article class="tarjeta" style="--i:${i}" data-revelar>
  <div class="tarjeta-img">${imgProducto(c, p, s, { lazy: !eager, prioridad: false })}</div>
  <div class="tarjeta-info">
    <p class="tarjeta-cat">${cat(p.categoria).nombre}</p>
    <h3><a href="${c.h(`/productos/${p.slug}/`)}">${esc(p.nombre)}</a></h3>
    <p class="tarjeta-resumen">${esc(p.resumen)}</p>
    ${valoracion(p.slug, c, null, true)}
    <div class="tarjeta-pie"><p class="precio"><span>${cop(p.precio)}</span>${pp ? `<small>${cop(pp)} por porción</small>` : `<small>${esc(p.presentacion)}</small>`}</p>
    <button class="btn btn-sec btn-sm" type="button" data-agregar="${p.slug}" data-sabor="${s.slug}" aria-label="Agregar ${esc(p.nombre)} sabor ${esc(s.nombre)} al carrito">Agregar</button></div>
  </div>
</article>`;
}

function selectorSabor(p, nombre, sel = 0) {
  return `<fieldset class="sabores"><legend>Sabor: <span data-sabor-nombre>${esc(p.sabores[sel].nombre)}</span></legend><div class="sabores-op">${p.sabores.map((s, i) => `<label class="sabor"><input type="radio" name="${nombre}" value="${s.slug}"${i === sel ? ' checked' : ''}><span class="sabor-muestra" style="--c1:${s.c1};--c2:${s.c2}" aria-hidden="true"></span><span>${esc(s.nombre)}</span></label>`).join('')}</div></fieldset>`;
}

function preguntasHTML(lista, id = 'preguntas', titulo = 'Preguntas frecuentes') {
  return `<section class="seccion wrap preguntas" id="${id}" aria-labelledby="${id}-t"><h2 class="h2" id="${id}-t">${titulo}</h2><div class="acordeon">${lista.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>`;
}

const preguntasGenerales = [
  ['¿Cuánto tarda el envío?', 'Entre 2 y 5 días hábiles según la ciudad. Los pedidos confirmados antes de las 2 p. m. salen el mismo día.'],
  ['¿Cuánto cuesta el envío?', `${cop(sitio.envio)} a todo el país. Es gratis en pedidos desde ${cop(sitio.envioGratisDesde)}.`],
  ['¿Cómo pago?', 'Al finalizar tu pedido te llevamos a Mercado Pago, donde eliges el medio de pago disponible para tu cuenta. No guardamos datos de tu tarjeta.'],
  ['¿Y si no me gusta?', `Tienes ${sitio.diasDevolucion} días desde que recibes el pedido para pedir el cambio o el reembolso, incluso si el envase está abierto.`],
];

/* ---------- páginas ---------- */
const paginas = [];
const estrella = productos[0];
const orgLD = { '@context': 'https://schema.org', '@type': 'Organization', name: sitio.nombre, url: sitio.url, logo: abs('/assets/img/favicon.svg'), email: sitio.email };

// Inicio
paginas.push({
  ruta: '/', tipo: 'inicio', titulo: 'Halo Nutrition | Proteína whey, creatina y pre-entreno',
  descripcion: 'Suplementos deportivos con dosis declaradas y análisis por lote: whey isolate, creatina y pre-entreno. Envío a toda Colombia y 30 días de garantía.',
  frasco: { p: estrella.slug, s: estrella.sabores[0].slug },
  lcp: { src: foto(estrella, estrella.sabores[0], 1000), srcset: `${foto(estrella, estrella.sabores[0], 600)} 600w, ${foto(estrella, estrella.sabores[0], 1000)} 1000w`, sizes: '(min-width: 1024px) 46vw, 90vw' },
  jsonld: [orgLD, { '@context': 'https://schema.org', '@type': 'WebSite', name: sitio.nombre, url: sitio.url, inLanguage: sitio.idioma }],
  cuerpo: (c) => {
    const w = estrella; const ppw = porPorcion(w); const cre = prod('creatina-monohidratada');
    return `
<section class="hero wrap" aria-labelledby="hero-t">
  <div class="hero-copy">
    <h1 id="hero-t" class="h1" data-hero-titulo>Más fuerza, cero relleno.</h1>
    <p class="hero-sub" data-hero-sub>Proteína aislada, creatina y pre-entreno con dosis declaradas y análisis de laboratorio por lote. Envío en 48 horas.</p>
    <div class="cta" data-hero-cta><a class="btn btn-pri" href="${c.h(`/productos/${w.slug}/`)}">Comprar Whey Isolate</a><a class="btn btn-sec" href="${c.h('/tienda/')}">Ver la tienda</a></div>
  </div>
  <figure class="hero-media" data-pose="d:el:.9;m:el:.9" data-frasco-ancla>
    ${imgProducto(c, w, w.sabores[0], { tam: '1000', sizes: '(min-width: 1024px) 46vw, 90vw', alt: 'Tarro de Whey Isolate de Halo, sabor chocolate, 2 libras', lazy: false })}
  </figure>
</section>

<section class="garantias wrap" aria-label="Por qué comprar en Halo">
  <div><strong>48 h</strong><span>Despacho el mismo día y entrega en ciudades principales</span></div>
  <div><strong>${sitio.diasDevolucion} días</strong><span>Garantía de satisfacción, aunque el envase esté abierto</span></div>
  <div><strong>Por lote</strong><span>Análisis de laboratorio independiente publicado</span></div>
</section>

<section class="ciencia wrap" aria-labelledby="ciencia-t">
  <div class="ciencia-escena" data-pose="d:el:.78;m:off" aria-hidden="true"></div>
  <div class="ciencia-texto">
    <p class="eyebrow">Fórmulas claras</p>
    <h2 class="h2" id="ciencia-t">Lo que dice la etiqueta es lo que hay en el tarro.</h2>
    <ol class="ciencia-lista">
      <li data-paso><strong>25 g</strong><p>de proteína por porción en Whey Isolate. Medido, no redondeado hacia arriba.</p></li>
      <li data-paso><strong>0</strong><p>mezclas propietarias. Cada ingrediente aparece con su dosis exacta.</p></li>
      <li data-paso><strong>1 lote, 1 análisis</strong><p>Un laboratorio independiente revisa cada lote antes de venderlo.</p></li>
    </ol>
  </div>
</section>

<section class="configurador wrap" aria-labelledby="sabor-t" data-configurador="${w.slug}">
  <h2 class="h2" id="sabor-t">Elige tu sabor de Whey Isolate</h2>
  <div class="configurador-escena" data-pose="d:el:.9;m:el:.9" aria-hidden="true"><img data-config-img src="${c.a(foto(w, w.sabores[0], 600))}" width="600" height="600" alt="" loading="lazy" decoding="async"></div>
  <div class="configurador-panel">
    ${selectorSabor(w, 'sabor-inicio')}
    <p class="precio precio-g"><span>${cop(w.precio)}</span><small>${cop(ppw)} por porción, ${esc(w.presentacion)}</small></p>
    <button class="btn btn-pri" type="button" data-agregar="${w.slug}" data-sabor-desde="sabor-inicio">Agregar al carrito</button>
  </div>
</section>

<section class="seccion carril-sec" aria-labelledby="vendidos-t">
  <div class="wrap carril-cab"><h2 class="h2" id="vendidos-t">Lo que más se pide</h2><a class="enlace" href="${c.h('/tienda/')}">Ver la tienda</a></div>
  <div class="carril" tabindex="0" aria-label="Productos más vendidos, desplázate horizontalmente">${productos.map((p, i) => tarjeta(c, p, i)).join('')}</div>
</section>

<section class="seccion wrap resenas-sec" aria-labelledby="resenas-t" data-pose="d:.9,.14,.14;m:off">
  <h2 class="h2" id="resenas-t">Lo que dicen quienes ya entrenan con Halo</h2>
  ${sitio.resenasDeEjemplo ? '<p class="nota">Reseñas de ejemplo para esta demostración.</p>' : ''}
  <div class="resenas-muro">${Object.entries(resenas).flatMap(([slug, l]) => l.slice(0, 1).map((r) => ({ ...r, slug }))).slice(0, 5).map((r) => `<figure class="resena" data-revelar><blockquote>“${esc(r.texto)}”</blockquote><figcaption><span class="estrellas" aria-label="${r.rating} de 5 estrellas">${estrellas(r.rating)}</span> ${esc(r.autor)}, ${esc(r.ciudad)}. Compró <a href="${c.h(`/productos/${r.slug}/`)}">${esc(prod(r.slug).nombre)}</a></figcaption></figure>`).join('')}</div>
</section>

<section class="seccion wrap combo" aria-labelledby="combo-t" data-revelar>
  <div class="combo-img" aria-hidden="true">${imgProducto(c, w, w.sabores[1], { tam: '600', sizes: '(min-width: 768px) 20vw, 40vw' })}${imgProducto(c, cre, cre.sabores[0], { tam: '600', sizes: '(min-width: 768px) 20vw, 40vw' })}</div>
  <div>
    <h2 class="h2" id="combo-t">Empieza por lo básico</h2>
    <p class="lead">Whey Isolate y Creatina cubren lo que más funciona: proteína suficiente y fuerza. Juntos suman ${cop(w.precio + cre.precio)} y el envío te sale gratis.</p>
    <button class="btn btn-pri" type="button" data-agregar-combo="${w.slug}:${w.sabores[0].slug},${cre.slug}:${cre.sabores[0].slug}">Agregar los dos</button>
  </div>
</section>

<section class="seccion wrap guias-sec" aria-labelledby="guias-t">
  <h2 class="h2" id="guias-t">Guías para elegir bien</h2>
  <ul class="guias-lista">${blog.map((b) => `<li><a href="${c.h(`/blog/${b.slug}/`)}"><span class="guia-t">${esc(b.titulo)}</span><span class="guia-d">${esc(b.descripcion)}</span></a></li>`).join('')}</ul>
</section>

${preguntasHTML(preguntasGenerales)}`;
  },
});

// Tienda y categorías
function paginaTienda(categoria) {
  const lista = categoria ? productos.filter((p) => p.categoria === categoria.slug) : productos;
  const ruta = categoria ? `/tienda/${categoria.slug}/` : '/tienda/';
  const textos = {
    null: ['Suplementos deportivos', 'Proteína, creatina, pre-entreno y accesorios con dosis declaradas. Elige por objetivo o por categoría.'],
    proteinas: ['Proteínas', 'Proteína whey aislada y barras proteicas para completar tu proteína diaria sin cocinar más.'],
    rendimiento: ['Rendimiento', 'Creatina monohidratada, pre-entreno y BCAA para entrenar con más fuerza y foco.'],
    accesorios: ['Accesorios', 'Shakers y accesorios para preparar y llevar tus suplementos.'],
  }[categoria ? categoria.slug : null];
  const migas = categoria ? [['Inicio', '/'], ['Tienda', '/tienda/'], [categoria.nombre, ruta]] : [['Inicio', '/'], ['Tienda', '/tienda/']];
  paginas.push({
    ruta, tipo: 'tienda', migas,
    titulo: categoria ? `${categoria.nombre} | Halo Nutrition Colombia` : 'Tienda de suplementos deportivos | Halo Nutrition',
    descripcion: `${textos[1]} Envío a toda Colombia, gratis desde ${cop(sitio.envioGratisDesde)}.`,
    frasco: { p: lista[0].slug, s: lista[0].sabores[0].slug },
    jsonld: [{ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: lista.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(`/productos/${p.slug}/`), name: p.nombre })) }],
    cuerpo: (c) => `
<section class="wrap tienda-cab">
  <div class="tienda-texto"><h1 class="h1 h1-pag">${textos[0]}</h1><p class="lead">${textos[1]}</p></div>
  <div class="tienda-escena" data-pose="d:el:.95;m:off" aria-hidden="true"></div>
</section>
<div class="wrap tienda-barra">
  <nav class="filtros" aria-label="Categorías"><ul><li><a href="${c.h('/tienda/')}"${!categoria ? ' aria-current="page"' : ''}>Todo</a></li>${categorias.map((k) => `<li><a href="${c.h(`/tienda/${k.slug}/`)}"${categoria && categoria.slug === k.slug ? ' aria-current="page"' : ''}>${k.nombre}</a></li>`).join('')}</ul></nav>
  <div class="orden"><label for="orden">Ordenar por</label><select id="orden" data-orden><option value="destacados">Más vendidos</option><option value="precio-asc">Precio: menor a mayor</option><option value="precio-desc">Precio: mayor a menor</option></select></div>
</div>
<section class="wrap" aria-label="Productos"><p class="cuenta-prod">${lista.length} ${lista.length === 1 ? 'producto' : 'productos'}</p><h2 class="sr">Productos</h2><div class="rejilla" data-rejilla data-pose="d:.92,.22,.16;m:off">${lista.map((p, i) => tarjeta(c, p, i, i < 4).replace('<article class="tarjeta"', `<article class="tarjeta" data-precio="${p.precio}" data-orden-base="${i}"`)).join('')}</div></section>
${preguntasHTML(preguntasGenerales.slice(0, 3))}`,
  });
}
paginaTienda(null);
categorias.forEach(paginaTienda);

// Productos
productos.forEach((p) => {
  const ruta = `/productos/${p.slug}/`; const k = cat(p.categoria); const s0 = p.sabores[0]; const pp = porPorcion(p);
  const rr = resenas[p.slug] || []; const resu = resumenResenas(p.slug);
  const relacionados = productos.filter((x) => x.slug !== p.slug).slice(0, 4);
  const productoLD = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.nombre, description: p.descripcion, sku: p.slug, category: k.nombre,
    brand: { '@type': 'Brand', name: sitio.nombre },
    image: p.sabores.map((s) => abs('/assets/' + foto(p, s, 1000))),
    offers: {
      '@type': 'Offer', url: abs(ruta), priceCurrency: sitio.moneda, price: p.precio, availability: 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: sitio.nombre },
      shippingDetails: { '@type': 'OfferShippingDetails', shippingRate: { '@type': 'MonetaryAmount', value: sitio.envio, currency: sitio.moneda }, shippingDestination: { '@type': 'DefinedRegion', addressCountry: sitio.pais }, deliveryTime: { '@type': 'ShippingDeliveryTime', handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' }, transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 5, unitCode: 'DAY' } } },
      hasMerchantReturnPolicy: { '@type': 'MerchantReturnPolicy', applicableCountry: sitio.pais, returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow', merchantReturnDays: sitio.diasDevolucion, returnMethod: 'https://schema.org/ReturnByMail' },
    },
  };
  // Las reseñas solo se marcan como datos estructurados cuando son reales (resenasDeEjemplo: false).
  if (resu && !sitio.resenasDeEjemplo) {
    productoLD.aggregateRating = { '@type': 'AggregateRating', ratingValue: resu.media, reviewCount: resu.total };
    productoLD.review = rr.map((r) => ({ '@type': 'Review', author: { '@type': 'Person', name: r.autor }, datePublished: r.fecha, reviewBody: r.texto, reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 } }));
  }
  const titulo = `${p.nombre} ${p.presentacion.split(',')[0]} | ${k.nombre} | Halo Nutrition`;
  paginas.push({
    ruta, tipo: 'producto', migas: [['Inicio', '/'], ['Tienda', '/tienda/'], [k.nombre, `/tienda/${k.slug}/`], [p.nombre, ruta]],
    titulo: titulo.length > 62 ? `${p.nombre} | Halo Nutrition Colombia` : titulo,
    descripcion: `${p.resumen} ${cop(p.precio)}${pp ? ` (${cop(pp)} por porción)` : ''}. Envío a toda Colombia y ${sitio.diasDevolucion} días de garantía.`.slice(0, 160),
    frasco: { p: p.slug, s: s0.slug }, tipoOg: 'product', ogImagen: foto(p, s0, 1000),
    lcp: { src: foto(p, s0, 1000), srcset: `${foto(p, s0, 600)} 600w, ${foto(p, s0, 1000)} 1000w`, sizes: '(min-width: 1024px) 50vw, 92vw' },
    jsonld: [productoLD],
    cuerpo: (c) => `
<article class="wrap ficha" data-producto="${p.slug}">
  <figure class="ficha-galeria" data-pose="d:el:.92;m:el:.92" data-frasco-ancla>
    ${imgProducto(c, p, s0, { tam: '1000', sizes: '(min-width: 1024px) 50vw, 92vw', alt: `${p.nombre} de Halo, sabor ${s0.nombre}, ${p.presentacion}`, lazy: false, extra: ' data-ficha-img' })}
  </figure>
  <div class="ficha-info">
    <p class="tarjeta-cat"><a href="${c.h(`/tienda/${k.slug}/`)}">${k.nombre}</a></p>
    <h1 class="ficha-t">${esc(p.nombre)}</h1>
    ${valoracion(p.slug, c, rr.length ? '#resenas' : null)}
    <p class="precio precio-g"><span>${cop(p.precio)}</span><small>${pp ? `${cop(pp)} por porción, ` : ''}${esc(p.presentacion)}</small></p>
    <p class="lead">${esc(p.resumen)}</p>
    <form class="compra" data-compra="${p.slug}">
      ${selectorSabor(p, 'sabor')}
      <div class="compra-fila">
        <div class="cantidad"><button type="button" data-cant="-1" aria-label="Quitar una unidad">−</button><label class="sr" for="cantidad">Cantidad</label><input id="cantidad" name="cantidad" type="number" inputmode="numeric" min="1" max="9" value="1"><button type="button" data-cant="1" aria-label="Agregar una unidad">+</button></div>
        <button class="btn btn-pri btn-grande" type="submit" data-boton-compra>Agregar al carrito</button>
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
<section class="wrap seccion" aria-labelledby="datos-t">
  <h2 class="h2" id="datos-t">Datos clave</h2>
  <div class="datos">${p.datos.map((d) => `<div class="dato" data-revelar><strong>${esc(d.v)}</strong><span class="dato-k">${esc(d.k)}</span><span class="dato-p">${esc(d.por)}</span></div>`).join('')}</div>
  <p class="lead descripcion">${esc(p.descripcion)}</p>
</section>
<section class="wrap seccion uso" aria-labelledby="uso-t">
  <div><h2 class="h2" id="uso-t">Cómo se usa</h2><p class="lead">${esc(p.uso)}</p></div>
  ${p.nutricion ? `<div class="tabla-env"><table class="nutricion"><caption>Información nutricional</caption><tbody>${p.nutricion.map(([a, b]) => `<tr><th scope="row">${esc(a)}</th><td>${esc(b)}</td></tr>`).join('')}</tbody></table></div>` : ''}
</section>
${rr.length ? `<section class="wrap seccion" id="resenas" aria-labelledby="resenas-t"><h2 class="h2" id="resenas-t">Reseñas</h2>${valoracion(p.slug, c)}${sitio.resenasDeEjemplo ? '<p class="nota">Reseñas de ejemplo para esta demostración.</p>' : ''}<div class="resenas-muro">${rr.map((r) => `<figure class="resena"><blockquote>“${esc(r.texto)}”</blockquote><figcaption><span class="estrellas" aria-label="${r.rating} de 5 estrellas">${estrellas(r.rating)}</span> ${esc(r.autor)}, ${esc(r.ciudad)}. <time datetime="${r.fecha}">${fechaLarga(r.fecha)}</time></figcaption></figure>`).join('')}</div></section>` : ''}
${preguntasHTML(p.faq, 'preguntas', `Preguntas sobre ${esc(p.nombre)}`)}
<section class="seccion carril-sec" aria-labelledby="rel-t"><div class="wrap carril-cab"><h2 class="h2" id="rel-t">Combina con</h2></div><div class="carril" tabindex="0" aria-label="Productos relacionados, desplázate horizontalmente">${relacionados.map((x, i) => tarjeta(c, x, i)).join('')}</div></section>
<div class="barra-compra" data-barra-compra hidden><div><strong>${esc(p.nombre)}</strong><span>${cop(p.precio)}</span></div><button class="btn btn-pri" type="button" data-barra-agregar>Agregar al carrito</button></div>`,
  });
});

// Nosotros
paginas.push({
  ruta: '/nosotros/', tipo: 'nosotros', migas: [['Inicio', '/'], ['Nosotros', '/nosotros/']],
  titulo: 'Nosotros | Halo Nutrition, suplementos con dosis declaradas',
  descripcion: 'Halo nació para que entiendas lo que tomas: pocas fórmulas, dosis completas y análisis de laboratorio por lote. Conoce cómo trabajamos.',
  frasco: { p: estrella.slug, s: estrella.sabores[1].slug },
  jsonld: [{ ...orgLD, '@type': 'Organization' }],
  cuerpo: (c) => `
<section class="wrap nosotros-cab">
  <div><h1 class="h1 h1-pag">Suplementos que se entienden.</h1><p class="lead">Halo empezó con dos nutricionistas cansadas de etiquetas confusas. Hoy hacemos pocos productos y los hacemos bien.</p></div>
  <div class="nosotros-escena" data-pose="d:el:.95;m:off" aria-hidden="true"></div>
</section>
<section class="wrap seccion historia">
  <p>Cada fórmula se diseña con nutricionistas deportivos y se fabrica en plantas con buenas prácticas de manufactura. Antes de vender un lote, un laboratorio independiente confirma que tiene lo que dice la etiqueta.</p>
  <p>Publicamos ese análisis para que cualquiera lo pueda revisar. Si algo no cuadra, preferimos no venderlo.</p>
</section>
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

// Carrito y retorno de pago
paginas.push({
  ruta: '/carrito/', tipo: 'carrito', indexar: false, titulo: 'Tu carrito | Halo Nutrition', descripcion: 'Revisa tu pedido y paga de forma segura con Mercado Pago.',
  cuerpo: (c) => `
<section class="wrap carrito-pag" aria-labelledby="carrito-t">
  <h1 class="h1 h1-pag" id="carrito-t">Tu carrito</h1>
  <div class="carrito-rejilla">
    <div class="carrito-items" data-carrito-items><noscript><p>Necesitas JavaScript activado para ver tu carrito.</p></noscript></div>
    <aside class="resumen" aria-labelledby="resumen-t" data-resumen>
      <h2 id="resumen-t">Resumen</h2>
      <div data-resumen-cifras></div>
      <button class="btn btn-pri btn-grande" type="button" data-pagar disabled>Pagar con Mercado Pago</button>
      <p class="campo-error" data-pago-error role="alert"></p>
      <p class="nota">Te llevamos a Mercado Pago para elegir tu medio de pago. Volverás aquí al terminar.</p>
      <ul class="confianza compacta"><li><strong>${sitio.diasDevolucion} días de garantía.</strong></li><li><strong>Envío gratis desde ${cop(sitio.envioGratisDesde)}.</strong></li></ul>
    </aside>
  </div>
</section>`,
});
[['exito', 'Pago aprobado', 'Gracias por tu compra. Te enviamos la confirmación por correo y el número de guía cuando salga tu pedido.', true],
  ['pendiente', 'Pago pendiente', 'Tu pago está en proceso. Te escribimos apenas Mercado Pago lo confirme.', true],
  ['error', 'El pago no se completó', 'No se hizo ningún cobro. Puedes intentarlo de nuevo con otro medio de pago.', false]].forEach(([slug, t, d, vaciar]) => {
  paginas.push({
    ruta: `/pago/${slug}/`, tipo: 'pago', indexar: false, titulo: `${t} | Halo Nutrition`, descripcion: d,
    cuerpo: (c) => `<section class="wrap estado-pago"${vaciar ? ' data-vaciar-carrito' : ''}><h1 class="h1 h1-pag">${t}</h1><p class="lead">${d}</p><div class="cta">${slug === 'error' ? `<a class="btn btn-pri" href="${c.h('/carrito/')}">Volver al carrito</a>` : `<a class="btn btn-pri" href="${c.h('/tienda/')}">Seguir comprando</a>`}</div></section>`,
  });
});

// Blog
paginas.push({
  ruta: '/blog/', tipo: 'blog', migas: [['Inicio', '/'], ['Guías', '/blog/']],
  titulo: 'Guías de suplementación deportiva | Halo Nutrition',
  descripcion: 'Guías claras sobre proteína, creatina y pre-entreno: cómo elegir, cuánto tomar y qué esperar. Escritas por el equipo de nutrición de Halo.',
  frasco: { p: estrella.slug, s: estrella.sabores[2].slug },
  jsonld: [{ '@context': 'https://schema.org', '@type': 'Blog', name: 'Guías Halo', url: abs('/blog/'), inLanguage: sitio.idioma }],
  cuerpo: (c) => `
<section class="wrap blog-cab"><h1 class="h1 h1-pag">Guías para entrenar mejor</h1><p class="lead">Respuestas cortas a las dudas que más nos llegan.</p></section>
<section class="wrap seccion"><ul class="guias-lista grande">${blog.map((b) => `<li data-revelar><a href="${c.h(`/blog/${b.slug}/`)}"><time datetime="${b.fecha}">${fechaLarga(b.fecha)}</time><span class="guia-t">${esc(b.titulo)}</span><span class="guia-d">${esc(b.descripcion)}</span></a></li>`).join('')}</ul></section>`,
});
blog.forEach((b) => {
  const ruta = `/blog/${b.slug}/`; const p = prod(b.producto);
  paginas.push({
    ruta, tipo: 'articulo', migas: [['Inicio', '/'], ['Guías', '/blog/'], [b.titulo, ruta]], tipoOg: 'article',
    titulo: `${b.titulo.split(':')[0]} | Guías Halo`, descripcion: b.descripcion,
    frasco: { p: p.slug, s: p.sabores[0].slug },
    jsonld: [{ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: b.titulo, description: b.descripcion, datePublished: b.fecha, dateModified: b.fecha, inLanguage: sitio.idioma, author: { '@type': 'Organization', name: sitio.nombre }, publisher: { '@type': 'Organization', name: sitio.nombre, logo: { '@type': 'ImageObject', url: abs('/assets/img/favicon.svg') } }, mainEntityOfPage: abs(ruta), image: abs('/assets/img/og-halo.jpg'), keywords: b.palabrasClave.join(', ') }],
    cuerpo: (c) => `
<article class="wrap texto-largo articulo">
  <header><h1 class="h1 h1-pag">${esc(b.titulo)}</h1><p class="nota">Por ${b.autor}. <time datetime="${b.fecha}">${fechaLarga(b.fecha)}</time></p></header>
  ${b.cuerpo.map(([t, v]) => (t === 'ul' ? `<ul>${v.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : `<${t}>${esc(v)}</${t}>`)).join('\n  ')}
  <aside class="articulo-cta" aria-labelledby="cta-t"><div><h2 id="cta-t">${esc(p.nombre)}</h2><p>${esc(p.resumen)}</p><a class="btn btn-pri" href="${c.h(`/productos/${p.slug}/`)}">Ver ${esc(p.nombre)}</a></div><div class="articulo-cta-img" aria-hidden="true" data-pose="d:el:.9" data-frasco-ancla>${imgProducto(c, p, p.sabores[0], { sizes: '200px' })}</div></aside>
</article>`,
  });
});

// 404
paginas.push({
  ruta: '/404.html', tipo: 'texto', indexar: false, titulo: 'Página no encontrada | Halo Nutrition', descripcion: 'Esta página no existe. Vuelve a la tienda de Halo Nutrition.',
  cuerpo: (c) => `<section class="wrap estado-pago"><h1 class="h1 h1-pag">No encontramos esta página.</h1><p class="lead">Puede que el enlace esté viejo. Lo que buscas seguramente está en la tienda.</p><div class="cta"><a class="btn btn-pri" href="${c.h('/tienda/')}">Ir a la tienda</a></div></section>`,
});

/* ---------- escritura ---------- */
await rm(salida, { recursive: true, force: true });
await mkdir(salida, { recursive: true });
await cp(join(raiz, 'src/assets'), join(salida, 'assets'), { recursive: true });
for (const pg of paginas) {
  // El 404 vive en la raíz; necesita rutas relativas desde la raíz.
  const archivo = pg.ruta.endsWith('.html') ? join(salida, pg.ruta) : join(salida, pg.ruta, 'index.html');
  await mkdir(dirname(archivo), { recursive: true });
  const html = pg.ruta === '/404.html' ? layout({ ...pg, ruta: '/' }).replace(`<link rel="canonical" href="${abs('/')}">`, '') : layout(pg);
  await writeFile(archivo, html);
}
const indexables = paginas.filter((p) => p.indexar !== false);
await writeFile(join(salida, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexables.map((p) => `  <url><loc>${abs(p.ruta)}</loc><lastmod>${HOY}</lastmod></url>`).join('\n')}
</urlset>
`);
await writeFile(join(salida, 'robots.txt'), `User-agent: *
Allow: /
Disallow: /carrito/
Disallow: /pago/
Disallow: /api/

Sitemap: ${abs('/sitemap.xml')}
`);
console.log(`Páginas: ${paginas.length} en ${salida}`);
