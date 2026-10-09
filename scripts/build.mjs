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

/* ---------- íconos (un solo sprite SVG por página, trazo de 2 px) ---------- */
// Íconos duotono: una capa de relleno suave (fill) y el trazo encima (line), estilo de los sets modernos.
const ICONOS = {
  camion: ['<path d="M2 6h12v10H2z"/><path d="M14 10h4l4 3v3h-8z"/>', '<path d="M2 6h12v10H2zM14 10h4l4 3v3h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>'],
  escudo: ['<path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z"/>', '<path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'],
  candado: ['<rect x="4" y="10" width="16" height="11" rx="2.5"/>', '<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.2"/>'],
  matraz: ['<path d="M8 15h8l4 5a1 1 0 0 1-1 2H5a1 1 0 0 1-1-2z"/>', '<path d="M9 2h6M10 2v7L4 20a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-11V2"/><path d="M7 15h10"/>'],
  rayo: ['<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'],
  balanza: ['<path d="m5 7-3 7a3.5 3.5 0 0 0 6 0zM19 7l-3 7a3.5 3.5 0 0 0 6 0z"/>', '<path d="M12 3v18M6 21h12M5 7h14"/><path d="m5 7-3 7a3.5 3.5 0 0 0 6 0zM19 7l-3 7a3.5 3.5 0 0 0 6 0z"/>'],
  hoja: ['<path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15z"/>', '<path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15"/><path d="M5 19 13 11"/>'],
  reloj: ['<circle cx="12" cy="12" r="9"/>', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
  caja: ['<path d="m3 7 9 4 9-4v10l-9 4-9-4z"/>', '<path d="m3 7 9-4 9 4v10l-9 4-9-4z"/><path d="m3 7 9 4 9-4M12 11v10"/>'],
  vuelta: ['<circle cx="12" cy="12" r="7"/>', '<path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5"/>'],
  sobre: ['<rect x="3" y="5" width="18" height="14" rx="2.5"/>', '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>'],
  chat: ['<path d="M4 5h16v11H9l-5 4z"/>', '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>'],
  check: ['<circle cx="12" cy="12" r="9"/>', '<path d="m7 12.5 3.5 3.5L17 9"/>'],
  info: ['<circle cx="12" cy="12" r="9"/>', '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'],
  pregunta: ['<circle cx="12" cy="12" r="9"/>', '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7v.5M12 17v.5"/>'],
  cuchara: ['<ellipse cx="8" cy="8" rx="5" ry="4" transform="rotate(-35 8 8)"/>', '<ellipse cx="8" cy="8" rx="5" ry="4" transform="rotate(-35 8 8)"/><path d="m11.5 11 9 9"/>'],
  tabla: ['<rect x="3" y="4" width="18" height="6" rx="2"/>', '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 10h18M9 10v10"/>'],
  tarjeta: ['<rect x="2.5" y="5" width="19" height="14" rx="2.5"/>', '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/>'],
  mapa: ['<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/>', '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>'],
  corazon: ['<path d="M12 20s-8-4.8-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.2 12 20 12 20z"/>', '<path d="M12 20s-8-4.8-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.2 12 20 12 20z"/>'],
  chispa: ['<path d="M12 3c.6 4.5 2.5 6.4 7 7-4.5.6-6.4 2.5-7 7-.6-4.5-2.5-6.4-7-7 4.5-.6 6.4-2.5 7-7z"/>', '<path d="M12 3c.6 4.5 2.5 6.4 7 7-4.5.6-6.4 2.5-7 7-.6-4.5-2.5-6.4-7-7 4.5-.6 6.4-2.5 7-7z"/><path d="M19 16v4M17 18h4"/>'],
  pesa: ['<rect x="4" y="7" width="4" height="10" rx="1.5"/><rect x="16" y="7" width="4" height="10" rx="1.5"/>', '<rect x="4" y="7" width="4" height="10" rx="1.5"/><rect x="16" y="7" width="4" height="10" rx="1.5"/><path d="M8 12h8M2 10v4M22 10v4"/>'],
  gota: ['<path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z"/>', '<path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z"/><path d="M9 14.5a3 3 0 0 0 3 3"/>'],
  cero: ['<circle cx="12" cy="12" r="8"/>', '<circle cx="12" cy="12" r="8"/><path d="M6.5 17.5 17.5 6.5"/>'],
  casa: ['<path d="M4 10.5 12 4l8 6.5V20H4z"/>', '<path d="M3 11 12 3.5 21 11"/><path d="M5 9.5V20h5v-5.5h4V20h5V9.5"/>'],
  tienda: ['<rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/>', '<rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/>'],
  lupa: ['<circle cx="10.5" cy="10.5" r="7"/>', '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>'],
  persona: ['<circle cx="12" cy="8" r="4.5"/>', '<circle cx="12" cy="8" r="4.5"/><path d="M3.5 21c1.2-4.2 4.4-6.5 8.5-6.5s7.3 2.3 8.5 6.5"/>'],
  bolsa: ['<path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z"/>', '<path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>'],
};
const sprite = () => `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${Object.entries(ICONOS).map(([k, [relleno, linea]]) => `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><g class="i-r" fill="currentColor" stroke="none">${relleno}</g>${linea}</symbol>`).join('')}</defs></svg>`;
const ico = (n, cls = '') => `<svg class="ico${cls ? ' ' + cls : ''}" aria-hidden="true" focusable="false"><use href="#i-${n}"/></svg>`;
// Ícono en círculo de color. Colores: naranja, verde, azul, ámbar, violeta, rosa.
const TONOS = ['naranja', 'verde', 'azul', 'ambar', 'violeta', 'rosa'];
const chip = (n, t = 'naranja') => `<span class="chip-ico t-${t}" aria-hidden="true">${ico(n)}</span>`;
const GOOGLE_G = '<svg class="g-logo" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9h-4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>';
// Encabezado de reseñas con el sello de Google. Mientras sean de ejemplo, se dice claramente.
function cabeceraGoogle(lista) {
  if (!lista.length) return '';
  const media = (lista.reduce((a, r) => a + r.rating, 0) / lista.length).toFixed(1).replace('.', ',');
  return `<div class="google-cab">${GOOGLE_G}<div><p class="google-t"><strong>${media}</strong><span class="estrellas" aria-hidden="true">${estrellas(+media.replace(',', '.'))}</span><span class="sr">${media} de 5</span></p><p class="google-d">${sitio.resenasDeEjemplo ? `Reseñas de ejemplo con el formato de Google. Al conectar el Perfil de Empresa de Google se muestran las reales.` : `${lista.length} reseñas en Google`}</p></div></div>`;
}

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
  <a href="${c.h('/')}"${actual('/')}><span class="tab-ico" aria-hidden="true">${ico('casa')}</span>Inicio</a>
  <a href="${c.h('/tienda/')}"${actual('/tienda/')}><span class="tab-ico" aria-hidden="true">${ico('tienda')}</span>Tienda</a>
  <button type="button" data-abrir-busqueda><span class="tab-ico" aria-hidden="true">${ico('lupa')}</span>Buscar</button>
  <a href="${c.h('/cuenta/')}"${actual('/cuenta/')} data-enlace-cuenta-tab><span class="tab-ico" aria-hidden="true">${ico('persona')}</span>Cuenta</a>
  <a href="${c.h('/carrito/')}" data-abrir-carrito data-destino-carrito><span class="tab-ico tab-carrito" aria-hidden="true">${ico('bolsa')}<span class="cuenta" data-cuenta>0</span></span>Carrito</a>
</nav>`;
}

function pie(c) {
  return `<footer class="pie">
  <ul class="pie-confianza">
    <li>${chip('camion', 'verde')}<span><strong>Envío a toda Colombia</strong>Gratis desde ${cop(sitio.envioGratisDesde)}</span></li>
    <li>${chip('candado', 'violeta')}<span><strong>Pago seguro</strong>Con Mercado Pago</span></li>
    <li>${chip('vuelta', 'azul')}<span><strong>${sitio.diasDevolucion} días de garantía</strong>Aunque esté abierto</span></li>
    <li>${chip('matraz', 'naranja')}<span><strong>Análisis por lote</strong>Laboratorio independiente</span></li>
  </ul>
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
  <div class="pie-legal"><ul class="medios" aria-label="Medios de pago disponibles en Mercado Pago"><li>${ico('tarjeta')}Tarjeta crédito y débito</li><li>${ico('candado')}PSE</li><li>${ico('caja')}Efectivo</li></ul><p>Pagos procesados por Mercado Pago. Los suplementos no reemplazan una alimentación variada.</p><p>Sitio de demostración con marca, precios y contenido de ejemplo.</p></div>
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
    checkout: c.h('/finalizar-compra/'),
    combos: (sitio.combos || []).filter((k) => k.items.every((x) => prod(x))).map((k) => ({ slug: k.slug, nombre: k.nombre, items: k.items, descuento: k.descuento })),
    // Solo la huella de cada cupón: el código real no queda escrito en la página.
    cuponesHash: Object.fromEntries(Object.entries(sitio.cupones || {}).map(([k, v]) => [createHash('sha256').update(k.toUpperCase()).digest('hex'), v])),
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
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Geist:wght@400..800&family=Geist+Mono:wght@500;600&display=swap" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400..800&family=Geist+Mono:wght@500;600&display=swap"></noscript>
<link rel="stylesheet" href="${c.a('css/main.css')}">
${preload}
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n')}
<script type="module" src="${c.a('js/app.js')}"></script>
${pg.modulo ? `<script type="module" src="${c.a(`js/${pg.modulo}`)}"></script>` : ''}
</head>
<body data-pagina="${pg.tipo}"${pg.frasco ? ` data-frasco="${pg.frasco.p}" data-sabor="${pg.frasco.s}"` : ''}>
<a class="saltar" href="#contenido">Saltar al contenido</a>
${sprite()}
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
    try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); }
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
  const icoDe = (q) => (/envío|tarda|llega/i.test(q) ? 'camion' : /cuesta|precio|cuánto/i.test(q) ? 'tarjeta' : /pago|pagar/i.test(q) ? 'candado' : /gusta|devol|garant/i.test(q) ? 'vuelta' : 'pregunta');
  return `<section class="seccion wrap preguntas" id="${id}" aria-labelledby="${id}-t"><div class="preguntas-lado"><h2 class="h2 h2-sec" id="${id}-t">${titulo}</h2><div class="ayuda-card">${chip('chat', 'azul')}<div><strong>¿Otra duda?</strong><p>Escríbenos a <a href="mailto:${sitio.email}">${sitio.email}</a>. Respondemos el mismo día hábil.</p></div></div></div><div class="acordeon">${lista.map(([q, a], i) => `<details><summary>${chip(icoDe(q), TONOS[i % TONOS.length])}<span>${esc(q)}</span></summary><p>${esc(a)}</p></details>`).join('')}</div></section>`;
}

// Bloque de texto para buscadores: contenido real e indexable, plegado para que el cliente vea primero los productos.
function bloqueSEO(titulo, parrafos, enlaces = '') {
  return `<section class="wrap seo-bloque" aria-label="${esc(titulo)}"><details><summary>${chip('info', 'azul')}<span>${esc(titulo)}</span></summary><div class="seo-texto">${parrafos.map((t) => `<p>${t}</p>`).join('')}${enlaces}</div></details></section>`;
}

// Combos con descuento automático en el carrito.
function combosHTML(c) {
  const lista = (sitio.combos || []).filter((k) => k.items.every((x) => prod(x)));
  if (!lista.length) return '';
  return `<section class="seccion wrap combos-sec" id="combos" aria-labelledby="combos-t">
  <div class="combos-cab"><p class="eyebrow">Combos</p><h2 class="h2" id="combos-t">Arma tu rutina y ahorra</h2><p class="lead">Productos que funcionan mejor juntos. El descuento se aplica solo en el carrito.</p></div>
  <ul class="combos">${lista.map((k, i) => {
    const ps = k.items.map(prod); const lleno = ps.reduce((a, p) => a + p.precio, 0); const final = ps.reduce((a, p) => a + Math.round(p.precio * (1 - k.descuento / 100)), 0);
    return `<li class="combo-card" style="--c:${k.color};--i:${i}" data-revelar>
      <span class="combo-pct">−${k.descuento} %</span>
      <div class="combo-fotos n${ps.length}" aria-hidden="true">${ps.map((p, j) => `<span style="--j:${j}">${imgProducto(c, p, p.sabores[0], { sizes: '160px' })}</span>`).join('')}</div>
      <h3>${esc(k.nombre)}</h3><p class="combo-lema">${esc(k.lema)}</p>
      <ul class="combo-items">${ps.map((p) => `<li>${ico('check')}<a href="${c.h(`/productos/${p.slug}/`)}">${esc(p.nombre)}</a></li>`).join('')}</ul>
      <div class="combo-pie"><p class="combo-precio"><s>${cop(lleno)}</s><strong>${cop(final)}</strong><span>Ahorras ${cop(lleno - final)}${final >= sitio.envioGratisDesde ? ' + envío gratis' : ''}</span></p>
      <button class="btn btn-pri" type="button" data-agregar-combo="${ps.map((p) => `${p.slug}:${p.sabores[0].slug}`).join(',')}">${ico('caja')} Agregar combo</button></div>
    </li>`; }).join('')}</ul>
</section>`;
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

${combosHTML(c)}

<section class="seccion wrap objetivos" aria-labelledby="obj-t">
  <h2 class="h2 h2-sec" id="obj-t">Compra por objetivo</h2>
  <ul class="objetivos-lista">${[['proteinas', 'Ganar músculo', 'Proteína whey y barras para llegar a tu meta diaria.'], ['rendimiento', 'Fuerza y energía', 'Creatina, pre-entreno y BCAA para rendir más.'], ['accesorios', 'Para llevar', 'Shakers que no gotean ni dejan grumos.']].map(([k, t, d]) => `<li data-revelar><a class="objetivo" href="${c.h(`/tienda/${k}/`)}">${escenaImg(c, `cat-${k}`, { sizes: '(min-width: 860px) 31vw, 92vw' })}<span class="objetivo-txt"><span class="objetivo-t">${t}</span><span>${d}</span><span class="objetivo-ir" aria-hidden="true">Ver ${cat(k).nombre.toLowerCase()} →</span></span></a></li>`).join('')}</ul>
</section>

<section class="lema" aria-hidden="true">
  <p class="lema-fila" data-lema="-1">Fuerza <i></i> Foco <i></i> Recuperación <i></i> Fuerza <i></i> Foco <i></i> Recuperación <i></i></p>
  <p class="lema-fila hueca" data-lema="1">Cero relleno <i></i> Dosis completas <i></i> Cero relleno <i></i> Dosis completas <i></i></p>
</section>

<section class="seccion wrap bento-sec" aria-labelledby="bento-t">
  <div class="bento-cab"><h2 class="h2 h2-sec" id="bento-t">Por qué Halo</h2><p class="lead">Toca los puntos del envase para ver lo que lo hace distinto.</p></div>
  <div class="bento">
    <article class="bt bt-etiqueta" data-etiqueta>
      <div class="et-foto">
        <span class="et-halo" aria-hidden="true"></span>
        ${imgProducto(c, w, w.sabores[1] || w.sabores[0], { sizes: '(min-width: 860px) 30vw, 70vw', alt: `${w.nombre} de Halo` })}
        ${[['50%', '20%'], ['33%', '50%'], ['66%', '44%'], ['50%', '74%']].map(([x, y], i) => `<button class="hotspot" type="button" style="--x:${x};--y:${y};--i:${i}" data-hs="${i}" aria-pressed="${i === 0}" aria-controls="et-info" aria-label="${['Se mezcla en 10 segundos', 'Endulzada con stevia', 'Lote analizado', 'Sin mezclas propietarias'][i]}"><span></span></button>`).join('')}
      </div>
      <div class="et-info" id="et-info" aria-live="polite">
        ${[['gota', 'azul', 'Se mezcla en 10 segundos', 'Con agua o leche, sin grumos y sin licuadora.'], ['hoja', 'verde', 'Endulzada con stevia', 'Sin azúcar añadida y con muy poca lactosa.'], ['matraz', 'violeta', 'Lote analizado', 'Un laboratorio independiente confirma cada lote antes de venderlo.'], ['cero', 'naranja', 'Sin mezclas propietarias', 'Cada ingrediente aparece con su dosis exacta en la etiqueta.']].map(([n, t, h, d], i) => `<div class="et-dato" data-hs-dato="${i}"${i ? ' hidden' : ''}>${chip(n, t)}<h3>${h}</h3><p>${d}</p></div>`).join('')}
        <div class="et-nav" aria-hidden="true">${[0, 1, 2, 3].map((i) => `<i data-hs-punto="${i}"${i ? '' : ' class="activo"'}></i>`).join('')}</div>
      </div>
    </article>
    <article class="bt bt-ruta" data-revelar>
      <h3><strong><span data-contar="48">48</span> h</strong> y está en tu puerta</h3>
      <div class="ruta-mapa" aria-hidden="true">
        <svg viewBox="0 0 320 110" preserveAspectRatio="none"><path class="ruta-camino" d="M18 82 C 80 10, 150 110, 210 46 S 290 30, 302 30"/></svg>
        <span class="pin pin-a">${ico('caja')}</span><span class="pin pin-b">${ico('mapa')}</span>
        <span class="camion-ruta">${ico('camion')}</span>
      </div>
      <p class="ruta-txt">${ico('reloj')} Sale hoy hacia <strong data-ciudad>Medellín</strong></p>
    </article>
    <article class="bt bt-reloj" data-revelar>
      <div class="reloj" data-reloj aria-hidden="true"><svg viewBox="0 0 120 120"><defs><linearGradient id="g-reloj" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3fbf74"/><stop offset="1" stop-color="#1f6fd6"/></linearGradient></defs><circle class="rl-f" cx="60" cy="60" r="50"/><circle class="rl-v" cx="60" cy="60" r="50" pathLength="100"/></svg><span><strong data-contar="${sitio.diasDevolucion}">${sitio.diasDevolucion}</strong>días</span></div>
      <div><h3>Pruébalo sin riesgo</h3><p>Si no te convence, te devolvemos el dinero, aunque el envase esté abierto.</p></div>
    </article>
    <article class="bt bt-lab" data-revelar>${escenaImg(c, 'laboratorio', { sizes: '(min-width: 860px) 25vw, 46vw' })}<span class="escaneo" aria-hidden="true"></span>
      <p class="lab-sello">${ico('check')} <span>Lote HN-2410 · Aprobado<small>Ejemplo de certificado</small></span></p></article>
  </div>
</section>

<section class="seccion wrap calc-sec" aria-labelledby="calc-t">
  <div class="calc-texto"><p class="eyebrow">Calculadora</p><h2 class="h2" id="calc-t">¿Cuánta proteína necesitas al día?</h2><p class="lead">Mueve la barra, elige tu objetivo y cuántos días entrenas. Usamos el rango de 1,4 a 2 g por kilo que recomiendan las guías de nutrición deportiva.</p><a class="enlace" href="${c.h('/blog/cuanta-proteina-necesitas/')}">Lee la guía completa</a></div>
  <form class="calc" data-calc onsubmit="return false">
    <div class="calc-peso"><label for="calc-kg">${ico('balanza')} Tu peso</label><output for="calc-kg" data-calc-kg>70 kg</output><input id="calc-kg" type="range" min="40" max="140" step="1" value="70"></div>
    <fieldset class="calc-objetivo"><legend>Tu objetivo</legend>${[['mantener', 'Mantenerme', 1.4, 'corazon', 'rosa'], ['ganar', 'Ganar músculo', 1.8, 'pesa', 'naranja', true], ['definir', 'Definir', 2, 'rayo', 'violeta']].map(([v, t, f, n, tono, sel]) => `<label class="obj-card"><input type="radio" name="calc-obj" value="${f}"${sel ? ' checked' : ''}>${chip(n, tono)}<span>${t}</span></label>`).join('')}</fieldset>
    <fieldset class="calc-dias"><legend>Días que entrenas por semana</legend><div>${[1, 2, 3, 4, 5, 6, 7].map((d) => `<label><input type="radio" name="calc-dias" value="${d}"${d === 4 ? ' checked' : ''}><span>${d}</span></label>`).join('')}</div></fieldset>
    <div class="calc-res" role="status">
      <div class="medidor-g" aria-hidden="true"><svg viewBox="0 0 220 124"><defs><linearGradient id="g-calc" x1="0" x2="1"><stop offset="0" stop-color="#f2b443"/><stop offset=".55" stop-color="#e2662c"/><stop offset="1" stop-color="#b9471a"/></linearGradient></defs><path class="mg-f" d="M16 112 A 94 94 0 0 1 204 112" pathLength="100"/><path class="mg-v" d="M16 112 A 94 94 0 0 1 204 112" pathLength="100" data-calc-arco/></svg></div>
      <p class="calc-num"><strong data-calc-g>126</strong><span>g de proteína al día</span></p>
      <div class="reparto" data-calc-reparto></div>
      <p class="calc-tarro" data-calc-tarro></p>
    </div>
    <button class="btn btn-pri" type="button" data-agregar="${w.slug}" data-sabor="${w.sabores[0].slug}">${ico('caja')} Agregar ${esc(w.nombre)} · ${cop(w.precio)}</button>
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
  ${cabeceraGoogle(Object.values(resenas).flat())}
  <div class="resenas-muro">${Object.entries(resenas).filter(([slug]) => prod(slug)).flatMap(([slug, l]) => l.slice(0, 1).map((r) => ({ ...r, slug }))).slice(0, 4).map((r) => `<figure class="resena" data-revelar><span class="resena-g">${GOOGLE_G}</span><span class="estrellas" aria-label="${r.rating} de 5 estrellas">${estrellas(r.rating)}</span><blockquote>“${esc(r.texto)}”</blockquote><figcaption><span class="avatar" style="--h:${tono(r.autor)}" aria-hidden="true">${esc(iniciales(r.autor))}</span><span><strong>${esc(r.autor)}</strong>, ${esc(r.ciudad)}<br>Compró <a href="${c.h(`/productos/${r.slug}/`)}">${esc(prod(r.slug).nombre)}</a></span><img class="resena-prod" src="${prod(r.slug).imagenUrl || c.a(foto(prod(r.slug), prod(r.slug).sabores[0], 160))}" width="160" height="160" alt="" loading="lazy" decoding="async"></figcaption></figure>`).join('')}</div>
</section>



<section class="ciencia wrap" aria-labelledby="ciencia-t">
  <div class="ciencia-texto">
    <p class="eyebrow">Fórmulas claras</p>
    <h2 class="h2" id="ciencia-t">Lo que dice la etiqueta es lo que hay en el tarro.</h2>
    <figure class="ciencia-img">${escenaImg(c, 'laboratorio', { alt: `${w.nombre} de Halo en el laboratorio`, sizes: '(min-width: 860px) 44vw, 92vw' })}
      <span class="flota f1" aria-hidden="true">25 g proteína</span><span class="flota f2" aria-hidden="true">Lote analizado</span><span class="flota f3" aria-hidden="true">0 rellenos</span></figure>
  </div>
  <ol class="ciencia-lista">
    <li data-paso>${chip('balanza', 'naranja')}<strong>25 g</strong><p>de proteína por porción en Whey Isolate. Medido, no redondeado hacia arriba.</p></li>
    <li data-paso>${chip('cero', 'violeta')}<strong>0</strong><p>mezclas propietarias. Cada ingrediente aparece con su dosis exacta.</p></li>
    <li data-paso>${chip('matraz', 'verde')}<strong>1 lote, 1 análisis</strong><p>Un laboratorio independiente revisa cada lote antes de venderlo.</p></li>
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
<section class="wrap tienda-cab"><div><h1 class="h1 h1-pag">${textos[0]}</h1><p class="lead">${textos[1]}</p></div>${escenaImg(c, categoria ? `cat-${categoria.slug}` : 'familia', { sizes: '(min-width: 760px) 300px, 108px', lazy: false, clase: 'tienda-banner' })}</section>
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
      <li>${chip('camion', 'verde')}<span><strong>Llega en 2 a 5 días hábiles.</strong> Envío gratis desde ${cop(sitio.envioGratisDesde)}.</span></li>
      <li>${chip('vuelta', 'azul')}<span><strong>${sitio.diasDevolucion} días de garantía.</strong> Si no te gusta, te devolvemos el dinero.</span></li>
      <li>${chip('candado', 'violeta')}<span><strong>Pago seguro con Mercado Pago.</strong> No guardamos datos de tu tarjeta.</span></li>
    </ul>
    <ul class="beneficios">${p.beneficios.map((b) => `<li>${ico('check')}<span>${esc(b)}</span></li>`).join('')}</ul>
  </div>
</article>
${p.datos.length ? `<section class="wrap seccion" aria-labelledby="datos-t"><h2 class="h2 h2-sec" id="datos-t">Datos clave</h2><div class="datos">${p.datos.map((d, i) => `<div class="dato t-${TONOS[i % TONOS.length]}" data-revelar>${chip(['rayo', 'balanza', 'matraz', 'hoja', 'gota', 'pesa'][i % 6], TONOS[i % TONOS.length])}<strong>${esc(d.v)}</strong><span class="dato-k">${esc(d.k)}</span><span class="dato-p">${esc(d.por)}</span></div>`).join('')}</div></section>` : ''}
${rr.length ? `<section class="wrap seccion" id="resenas" aria-labelledby="resenas-t"><h2 class="h2 h2-sec" id="resenas-t">Reseñas</h2>${cabeceraGoogle(rr)}<div class="resenas-muro">${rr.map((r) => `<figure class="resena"><span class="resena-g">${GOOGLE_G}</span><span class="estrellas" aria-hidden="true">${estrellas(r.rating)}</span><blockquote>“${esc(r.texto)}”</blockquote><figcaption><span class="avatar" style="--h:${tono(r.autor)}" aria-hidden="true">${esc(iniciales(r.autor))}</span><span><strong>${esc(r.autor)}</strong>, ${esc(r.ciudad)}<br><time datetime="${r.fecha}">${fechaLarga(r.fecha)}</time><span class="sr">. ${r.rating} de 5 estrellas</span></span></figcaption></figure>`).join('')}</div></section>` : ''}
<section class="seccion carril-sec" aria-labelledby="rel-t"><div class="wrap carril-cab"><h2 class="h2 h2-sec" id="rel-t">Combina con</h2></div><div class="carril" tabindex="0" aria-label="Productos relacionados, desplázate horizontalmente">${relacionados.map((x, i) => tarjeta(c, x, i)).join('')}</div></section>
<section class="wrap seccion detalles" aria-labelledby="detalles-t">
  <h2 class="h2 h2-sec" id="detalles-t">Detalles de ${esc(p.nombre)}</h2>
  <div class="acordeon">
    <details><summary>${chip('info', 'azul')}<span>Descripción</span></summary><p>${esc(p.descripcion)}</p>${guia ? `<p>Lee la guía: <a href="${c.h(`/blog/${guia.slug}/`)}">${esc(guia.titulo)}</a>.</p>` : ''}</details>
    ${p.uso ? `<details><summary>${chip('cuchara', 'verde')}<span>Cómo se usa</span></summary><p>${esc(p.uso)}</p></details>` : ''}
    ${p.nutricion ? `<details open><summary>${chip('tabla', 'naranja')}<span>Información nutricional</span></summary><div class="tabla-env"><table class="nutricion"><caption class="sr">Información nutricional de ${esc(p.nombre)}</caption><tbody>${(() => { const porc = parseFloat(String((p.nutricion.find(([a]) => /porci/i.test(a)) || [])[1] || '').replace(',', '.')); return p.nutricion.map(([a, b]) => { const g = /\d\s*g$/.test(b) && !/porci/i.test(a) ? parseFloat(b.replace(',', '.')) : NaN; const pct = porc > 0 && g >= 0 ? Math.min(100, (g / porc) * 100) : null; return `<tr><th scope="row">${esc(a)}</th><td>${pct != null ? `<span class="barra-n" style="--p:${pct.toFixed(1)}%" aria-hidden="true"></span>` : ''}${esc(b)}</td></tr>`; }).join(''); })()}</tbody></table></div></details>` : ''}
    ${p.faq.map(([q, a], i) => `<details><summary>${chip('pregunta', ['violeta', 'ambar', 'rosa'][i % 3])}<span>${esc(q)}</span></summary><p>${esc(a)}</p></details>`).join('')}
    <details><summary>${chip('camion', 'verde')}<span>Envío, devoluciones y pago</span></summary><p>Enviamos a toda Colombia en 2 a 5 días hábiles por ${cop(sitio.envio)}, gratis desde ${cop(sitio.envioGratisDesde)}. Tienes ${sitio.diasDevolucion} días para pedir cambio o reembolso. El pago se hace en Mercado Pago.</p></details>
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
<section class="wrap seccion" aria-labelledby="valores-t"><h2 class="h2 h2-sec" id="valores-t">En qué creemos</h2><ul class="valores">${[['pesa', 'naranja', 'Dosis completas', 'Cada porción trae la cantidad que funciona según los estudios, no la mínima para poder nombrarla.'], ['matraz', 'verde', 'Análisis por lote', 'Un laboratorio independiente revisa cada lote antes de que salga a la venta.'], ['cero', 'violeta', 'Cero rellenos', 'Sin mezclas propietarias ni ingredientes para hacer bulto.'], ['corazon', 'rosa', 'Personas reales', 'Te responde alguien del equipo, el mismo día hábil.']].map(([n, t, h, d]) => `<li class="valor t-${t}" data-revelar>${chip(n, t)}<h3>${h}</h3><p>${d}</p></li>`).join('')}</ul></section>
${preguntasHTML(preguntasGenerales)}
<section class="wrap seccion contacto" id="contacto" aria-labelledby="contacto-t"><div class="contacto-card">${chip('sobre', 'naranja')}<div><h2 class="h2" id="contacto-t">Contacto</h2><p class="lead">Escríbenos y te respondemos el mismo día hábil.</p></div></div><p class="contacto-dato"><span data-copiable>${sitio.email}</span> <button class="btn btn-sec btn-sm" type="button" data-copiar="${sitio.email}">Copiar correo</button></p><p class="nota">${sitio.horario}</p></section>`,
});

// Envíos y devoluciones
paginas.push({
  ruta: '/envios-y-devoluciones/', tipo: 'texto', migas: [['Inicio', '/'], ['Envíos y devoluciones', '/envios-y-devoluciones/']],
  titulo: 'Envíos y devoluciones | Halo Nutrition',
  descripcion: `Envío a toda Colombia por ${cop(sitio.envio)}, gratis desde ${cop(sitio.envioGratisDesde)}. ${sitio.diasDevolucion} días para cambios o reembolso, incluso con el envase abierto.`,
  cuerpo: () => `
<article class="wrap envios-pag">
  <h1 class="h1 h1-pag">Envíos y devoluciones</h1>
  <p class="lead">Todo lo que pasa entre que pagas y abres tu pedido, sin letra pequeña.</p>
  <ul class="cifras">
    <li class="t-verde">${chip('camion', 'verde')}<strong>${cop(sitio.envio)}</strong><span>a toda Colombia. Gratis desde ${cop(sitio.envioGratisDesde)}.</span></li>
    <li class="t-azul">${chip('reloj', 'azul')}<strong>2 a 5 días</strong><span>hábiles según la ciudad.</span></li>
    <li class="t-naranja">${chip('vuelta', 'naranja')}<strong>${sitio.diasDevolucion} días</strong><span>para cambio o reembolso, aunque esté abierto.</span></li>
  </ul>
  <h2 class="h2 h2-sec">Así viaja tu pedido</h2>
  <ol class="linea-tiempo">
    <li>${chip('tarjeta', 'violeta')}<div><h3>Pagas</h3><p>Con Mercado Pago. Recibes la confirmación por correo.</p></div></li>
    <li>${chip('caja', 'ambar')}<div><h3>Lo preparamos</h3><p>Los pedidos confirmados antes de las 2 p. m. de lunes a viernes salen el mismo día.</p></div></li>
    <li>${chip('mapa', 'azul')}<div><h3>Va en camino</h3><p>Te enviamos el número de guía para que lo sigas.</p></div></li>
    <li>${chip('check', 'verde')}<div><h3>Llega a tu puerta</h3><p>Entre 2 y 5 días hábiles según la ciudad.</p></div></li>
  </ol>
  <div class="texto-largo">
    <h2>${ico('vuelta')} Garantía de ${sitio.diasDevolucion} días</h2>
    <p>Si un producto no te convence, escríbenos dentro de los ${sitio.diasDevolucion} días siguientes a la entrega. Te devolvemos el dinero o te lo cambiamos, aunque el envase esté abierto.</p>
    <h2>${ico('escudo')} Productos con defecto</h2>
    <p>Si algo llega dañado, envíanos una foto a ${sitio.email} y lo reponemos sin costo.</p>
  </div>
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

// Finalizar compra: datos, envío y pago con Mercado Pago (no indexable)
const DEPARTAMENTOS = { 'Amazonas': ['Leticia'], 'Antioquia': ['Medellín', 'Envigado', 'Itagüí', 'Bello', 'Rionegro', 'Sabaneta'], 'Arauca': ['Arauca'], 'Atlántico': ['Barranquilla', 'Soledad', 'Malambo'], 'Bogotá D.C.': ['Bogotá'], 'Bolívar': ['Cartagena', 'Magangué'], 'Boyacá': ['Tunja', 'Duitama', 'Sogamoso'], 'Caldas': ['Manizales'], 'Caquetá': ['Florencia'], 'Casanare': ['Yopal'], 'Cauca': ['Popayán'], 'Cesar': ['Valledupar'], 'Chocó': ['Quibdó'], 'Córdoba': ['Montería'], 'Cundinamarca': ['Soacha', 'Chía', 'Zipaquirá', 'Fusagasugá', 'Facatativá', 'Mosquera'], 'Guainía': ['Inírida'], 'Guaviare': ['San José del Guaviare'], 'Huila': ['Neiva', 'Pitalito'], 'La Guajira': ['Riohacha', 'Maicao'], 'Magdalena': ['Santa Marta'], 'Meta': ['Villavicencio'], 'Nariño': ['Pasto', 'Ipiales', 'Tumaco'], 'Norte de Santander': ['Cúcuta'], 'Putumayo': ['Mocoa'], 'Quindío': ['Armenia'], 'Risaralda': ['Pereira', 'Dosquebradas'], 'San Andrés y Providencia': ['San Andrés'], 'Santander': ['Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta'], 'Sucre': ['Sincelejo'], 'Tolima': ['Ibagué'], 'Valle del Cauca': ['Cali', 'Palmira', 'Buenaventura', 'Tuluá', 'Jamundí'], 'Vaupés': ['Mitú'], 'Vichada': ['Puerto Carreño'] };
const campo = (id, etiqueta, attrs = '', ayuda = '') => `<div class="campo"><label for="${id}">${etiqueta}</label><input id="${id}" name="${id.replace('co-', '')}" ${attrs}><p class="campo-msg" id="${id}-msg">${ayuda}</p></div>`;
paginas.push({
  ruta: '/finalizar-compra/', tipo: 'checkout', indexar: false, titulo: 'Finalizar compra | Halo Nutrition', descripcion: 'Completa tus datos de envío y paga de forma segura con Mercado Pago.', modulo: 'checkout.js',
  cuerpo: (c) => `
<noscript><style>.checkout { visibility: visible !important; }</style></noscript>
<section class="wrap checkout" data-checkout aria-labelledby="co-t">
  <ol class="co-pasos" aria-label="Pasos de la compra"><li class="hecho">${ico('check')}<span>Carrito</span></li><li class="actual" aria-current="step">${ico('mapa')}<span>Datos y envío</span></li><li>${ico('candado')}<span>Pago</span></li></ol>
  <h1 class="h1 h1-pag" id="co-t">Finalizar compra</h1>
  <div class="co-grid">
    <aside class="co-aside" aria-label="Resumen del pedido">
      <button class="co-toggle" type="button" aria-expanded="false" aria-controls="co-resumen" data-co-toggle>${ico('caja')}<span>Ver resumen</span><strong data-co-total-corto></strong></button>
      <div class="co-resumen" id="co-resumen" data-co-resumen><p class="nota">Cargando tu pedido…</p></div>
    </aside>
    <form class="co-form" data-co-form novalidate>
      <fieldset class="co-paso"><legend><span class="co-n">1</span>Contacto</legend>
        ${campo('co-email', 'Correo', 'type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" required', 'Aquí te llega la confirmación y la guía de envío.')}
        <div class="dos">${campo('co-nombre', 'Nombre', 'autocomplete="given-name" required')}${campo('co-apellido', 'Apellido', 'autocomplete="family-name" required')}</div>
        <div class="campo"><label for="co-celular">Celular</label><div class="prefijo"><span aria-hidden="true">🇨🇴 +57</span><input id="co-celular" name="celular" type="tel" inputmode="numeric" autocomplete="tel-national" required placeholder="300 123 4567"></div><p class="campo-msg" id="co-celular-msg">Para coordinar la entrega.</p></div>
      </fieldset>
      <fieldset class="co-paso"><legend><span class="co-n">2</span>Envío</legend>
        <div class="dos"><div class="campo"><label for="co-tipo">Documento</label><select id="co-tipo" name="tipo"><option value="CC">Cédula de ciudadanía</option><option value="CE">Cédula de extranjería</option><option value="NIT">NIT</option></select></div>${campo('co-documento', 'Número', 'inputmode="numeric" autocomplete="off" required')}</div>
        <div class="dos"><div class="campo"><label for="co-departamento">Departamento</label><select id="co-departamento" name="departamento" required><option value="">Elige…</option>${Object.keys(DEPARTAMENTOS).map((d) => `<option>${d}</option>`).join('')}</select><p class="campo-msg" id="co-departamento-msg"></p></div>${campo('co-ciudad', 'Ciudad o municipio', 'list="co-ciudades" autocomplete="address-level2" required')}</div>
        <datalist id="co-ciudades"></datalist>
        ${campo('co-direccion', 'Dirección', 'autocomplete="street-address" required placeholder="Calle 10 # 43-21"')}
        <div class="dos">${campo('co-detalle', 'Apartamento, torre u oficina (opcional)', 'autocomplete="address-line2"')}${campo('co-barrio', 'Barrio (opcional)', '')}</div>
        <div class="co-estimado" data-co-estimado hidden>${ico('camion')}<p></p></div>
      </fieldset>
      <fieldset class="co-paso"><legend><span class="co-n">3</span>Pago</legend>
        <div class="mp-card">
          <div class="mp-cab"><span class="mp-logo" aria-hidden="true">${ico('candado')}</span><div><strong>Mercado Pago</strong><p>Pagas en la ventana segura de Mercado Pago. Nunca vemos ni guardamos los datos de tu tarjeta.</p></div></div>
          <ul class="mp-medios">${[['tarjeta', 'Tarjeta de crédito', 'En cuotas según tu banco'], ['tarjeta', 'Tarjeta débito', 'Visa, Mastercard y más'], ['candado', 'PSE', 'Débito desde tu cuenta'], ['caja', 'Efectivo', 'Paga en puntos autorizados']].map(([n, t, d]) => `<li>${chip(n, 'azul')}<span><strong>${t}</strong>${d}</span></li>`).join('')}</ul>
        </div>
        <label class="check co-acepto"><input type="checkbox" name="acepto" required> <span>Acepto los <a href="${c.h('/envios-y-devoluciones/')}">términos de envío y devoluciones</a> y el tratamiento de mis datos para gestionar el pedido (Ley 1581 de 2012).</span></label>
        <p class="campo-error" data-co-error role="alert"></p>
        <button class="btn btn-pri btn-grande co-pagar" type="submit" data-co-pagar>${ico('candado')} <span>Pagar con Mercado Pago</span></button>
        <ul class="co-sellos"><li>${ico('escudo')} Conexión cifrada</li><li>${ico('vuelta')} ${sitio.diasDevolucion} días de garantía</li><li>${ico('camion')} Envío a toda Colombia</li></ul>
      </fieldset>
    </form>
  </div>
  <script type="application/json" id="departamentos">${JSON.stringify(DEPARTAMENTOS)}</script>
</section>
<div class="co-barra" data-co-barra><div><span>Total</span><strong data-co-total-barra></strong></div><button class="btn btn-pri" type="button" data-co-ir-pagar>${ico('candado')} Pagar</button></div>
<div class="co-cargando" data-co-cargando hidden role="status" aria-live="assertive"><div class="co-cargando-in"><span class="co-spin" aria-hidden="true"></span><p data-co-cargando-t>Conectando con Mercado Pago…</p><ol class="co-cargando-pasos"><li>Validando tus datos</li><li>Reservando tu pedido</li><li>Abriendo la pasarela segura</li></ol></div></div>`,
});

// Carrito y retorno de pago
paginas.push({
  ruta: '/carrito/', tipo: 'carrito', indexar: false, titulo: 'Tu carrito | Halo Nutrition', descripcion: 'Revisa tu pedido y paga de forma segura con Mercado Pago.', sinGsap: true,
  cuerpo: (c) => `
<section class="wrap carrito-pag" aria-labelledby="carrito-t">
  <h1 class="h1 h1-pag" id="carrito-t">Tu carrito</h1>
  <div class="carrito-rejilla">
    <div class="carrito-items" data-carrito-items><noscript><p>Necesitas JavaScript activado para ver tu carrito.</p></noscript></div>
    <aside class="resumen" aria-labelledby="resumen-t" data-resumen>
      <h2 id="resumen-t">Resumen</h2>
      <div data-resumen-cifras></div>
      <a class="btn btn-pri btn-grande" href="${c.h('/finalizar-compra/')}" data-pagar>${ico('candado')} Continuar con el pago</a>
      <p class="nota">En el siguiente paso pones tus datos de envío y pagas con Mercado Pago.</p>
      <ul class="confianza compacta"><li><strong>${sitio.diasDevolucion} días de garantía.</strong></li><li><strong>Envío gratis desde ${cop(sitio.envioGratisDesde)}.</strong></li></ul>
    </aside>
  </div>
</section>`,
});
[['exito', 'Pago aprobado', 'Gracias por tu compra. Te enviamos la confirmación por correo y el número de guía cuando salga tu pedido.', true],
  ['pendiente', 'Pago pendiente', 'Tu pago está en proceso. Te escribimos apenas Mercado Pago lo confirme.', true],
  ['error', 'El pago no se completó', 'No se hizo ningún cobro. Puedes intentarlo de nuevo con otro medio de pago.', false]].forEach(([slug, t, d, vaciar]) => {
  paginas.push({
    ruta: `/pago/${slug}/`, tipo: 'pago', indexar: false, titulo: `${t} | Halo Nutrition`, descripcion: d, sinGsap: true, modulo: slug === 'error' ? undefined : 'checkout.js',
    cuerpo: (c) => `<section class="wrap estado-pago"${vaciar ? ' data-vaciar-carrito' : ''}${slug === 'exito' ? ' data-celebrar' : ''}><h1 class="h1 h1-pag">${slug === 'exito' ? '<span class="check-grande" aria-hidden="true"></span>' : ''}${t}</h1><p class="lead">${d}</p>${slug === 'error' ? '' : '<div class="recibo" data-recibo hidden></div>'}<div class="cta">${slug === 'error' ? `<a class="btn btn-pri" href="${c.h('/carrito/')}">Volver al carrito</a>` : `<a class="btn btn-pri" href="${c.h('/tienda/')}">Seguir comprando</a><a class="btn btn-sec" href="${c.h('/cuenta/')}">Ver mis pedidos</a>`}</div></section>`,
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
  <aside class="resumen-guia">${chip('chispa', 'ambar')}<div><strong>En pocas palabras</strong><p>${esc(b.descripcion)}</p></div></aside>
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
Disallow: /finalizar-compra/

Sitemap: ${abs('/sitemap.xml')}
`);
console.log(`Páginas: ${paginas.length} en ${salida}${SB_URL ? ' (datos de Supabase)' : ' (datos del catálogo local)'}`);
