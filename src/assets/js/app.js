// Lógica de la tienda: carrito (localStorage), cajón accesible, buscador, fichas de producto, datos en vivo
// (precio, stock y visibilidad desde el panel) y pago con Mercado Pago.
import { datos, modoDemo, productosPublico, haySesionGuardada, sesion, pagoSimulado } from './datos.js';

const P = Object.fromEntries(datos.productos.map((p) => [p.slug, p]));
const reducido = matchMedia('(prefers-reduced-motion: reduce)');
const num = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const cop = (n) => `$ ${num.format(Math.round(n))}`;
// Fotos renderizadas por sabor; si el producto tiene foto propia (subida en el panel) se usa esa.
const foto = (slug, sabor, t = 160) => { const p = P[slug]; return p && !p.con3D ? p.img : `${datos.assets}img/productos/${slug}-${sabor}-${t}.webp`; };
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sabor = (slug, s) => P[slug]?.sabores.find((x) => x.slug === s) || P[slug]?.sabores[0];
const movil = matchMedia('(max-width: 860px)');

/* ---------- almacenamiento ---------- */
const CLAVE = 'halo-carrito';
let memoria = [];
const leer = () => {
  try { const v = JSON.parse(localStorage.getItem(CLAVE) || '[]'); return Array.isArray(v) ? v.filter((i) => i && typeof i.p === 'string' && i.q > 0) : []; } catch { return memoria; }
};
// Los productos nuevos llegan con los datos en vivo; mientras tanto se guardan pero no se muestran.
const validos = (c) => c.filter((i) => P[i.p]);
const guardar = (c) => { memoria = c; try { localStorage.setItem(CLAVE, JSON.stringify(c)); } catch { /* sin almacenamiento: queda en memoria */ } };
const cuenta = (c) => validos(c).reduce((n, i) => n + i.q, 0);
const subtotal = (c) => validos(c).reduce((n, i) => n + i.q * P[i.p].precio, 0);
const envio = (s) => (s === 0 || s >= datos.gratisDesde ? 0 : datos.envio);

/* ---------- avisos y contador ---------- */
let avisoT;
function avisar(msg) {
  const a = $('[data-aviso]'); if (!a) return;
  a.textContent = msg; a.classList.add('visible'); clearTimeout(avisoT);
  avisoT = setTimeout(() => a.classList.remove('visible'), 2200);
}
function pintarContador(saltar) {
  const n = cuenta(leer());
  $$('[data-cuenta]').forEach((el) => { el.textContent = n; if (saltar) { el.classList.remove('salta'); void el.offsetWidth; el.classList.add('salta'); } });
  $$('[data-cuenta-texto]').forEach((el) => { el.textContent = `, ${n} ${n === 1 ? 'producto' : 'productos'}`; });
}

/* ---------- líneas del carrito (cajón y página) ---------- */
function lineaHTML(i, idx, entra) {
  const p = P[i.p]; const s = sabor(i.p, i.s); const clave = `${i.p}|${s.slug}`;
  return `<div class="linea${entra ? ' entra' : ''}" data-clave="${clave}" style="--i:${idx}">
  <div class="linea-img"><img src="${foto(p.slug, s.slug)}" width="160" height="160" alt="" loading="lazy" decoding="async"></div>
  <div><p class="linea-nombre">${p.url ? `<a href="${p.url}">${esc(p.nombre)}</a>` : esc(p.nombre)}</p><p class="linea-meta">${s.nombre}, ${cop(p.precio)} c/u</p>
    <div class="linea-ctrl"><div class="mini" role="group" aria-label="Cantidad de ${p.nombre}"><button type="button" data-menos="${clave}" aria-label="Quitar una unidad">−</button><output data-q="${clave}">${i.q}</output><button type="button" data-mas="${clave}" aria-label="Agregar una unidad">+</button></div><button class="quitar" type="button" data-quitar="${clave}">Quitar<span class="sr"> ${p.nombre}</span></button></div></div>
  <p class="linea-total">${cop(p.precio * i.q)}</p>
</div>`;
}

let vistas = new Set();
let subAnterior = 0;
function contar(el, desde, hasta) {
  if (!el) return;
  if (reducido.matches || desde === hasta) { el.textContent = cop(hasta); return; }
  const t0 = performance.now();
  const paso = (t) => { const u = Math.min(1, (t - t0) / 500); const e = 1 - (1 - u) ** 3; el.textContent = cop(desde + (hasta - desde) * e); if (u < 1) requestAnimationFrame(paso); };
  requestAnimationFrame(paso);
}

function pintarCajon({ todasEntran = false } = {}) {
  const caj = $('#cajon'); if (!caj) return;
  const c = validos(leer()); const s = subtotal(c); const e = envio(s);
  let n = 0;
  const lineas = c.map((i) => { const clave = `${i.p}|${i.s}`; const entra = todasEntran || !vistas.has(clave); return lineaHTML(i, entra ? n++ : 0, entra); }).join('');
  vistas = new Set(c.map((i) => `${i.p}|${i.s}`));
  const falta = datos.gratisDesde - s;
  $('[data-envio]', caj).className = `cajon-envio${s && falta <= 0 ? ' logrado' : ''}`;
  $('[data-envio]', caj).innerHTML = c.length ? `${falta > 0 ? `Te faltan <strong>${cop(falta)}</strong> para envío gratis` : '<strong>Tu envío es gratis</strong>'}<div class="envio-linea" aria-hidden="true"><i style="--p:${Math.min(1, s / datos.gratisDesde).toFixed(3)}"></i></div>` : '';
  // Sugerencia para alcanzar el envío gratis: el producto más barato que no está en el carrito y cubre lo que falta.
  let sugerencia = '';
  if (c.length && falta > 0) {
    const fuera = Object.values(P).filter((x) => !x.oculto && x.stock !== 0 && !c.some((i) => i.p === x.slug)).sort((a, b) => a.precio - b.precio);
    const s2 = fuera.find((x) => x.precio >= falta) || fuera[fuera.length - 1];
    if (s2) sugerencia = `<div class="sugerencia"><img src="${foto(s2.slug, s2.sabores[0].slug)}" width="160" height="160" alt="" loading="lazy" decoding="async"><p><span>Con esto tu envío es gratis</span><strong>${s2.nombre}</strong> ${cop(s2.precio)}</p><button class="btn btn-sec btn-sm" type="button" data-agregar="${s2.slug}" data-sabor="${s2.sabores[0].slug}" aria-label="Agregar ${s2.nombre} al carrito">Agregar</button></div>`;
  }
  $('[data-lista]', caj).innerHTML = (lineas + sugerencia) || `<div class="vacio"><p>Tu carrito está vacío.</p><a class="btn btn-sec" href="${datos.tienda}">Ver la tienda</a></div>`;
  $('[data-pie-cajon]', caj).innerHTML = c.length ? `<div class="fila-total"><span>Subtotal</span><span data-sub>${cop(subAnterior)}</span></div><div class="fila-total"><span>Envío</span><span>${e ? cop(e) : 'Gratis'}</span></div><a class="btn btn-pri btn-grande" href="${datos.carrito}">Ir a pagar</a><button class="btn btn-sec" type="button" data-cerrar-carrito>Seguir comprando</button>` : '';
  contar($('[data-sub]', caj), subAnterior, s); subAnterior = s;
}

/* ---------- cajón accesible ---------- */
let abridor = null;
const enfocables = (r) => $$('a[href], button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])', r).filter((x) => x.offsetParent !== null);
function abrirCajon() {
  const caj = $('#cajon'); if (!caj || !caj.hidden) { pintarCajon(); return; }
  abridor = document.activeElement;
  pintarCajon({ todasEntran: true });
  caj.hidden = false;
  $$('body > *').forEach((el) => { if (el !== caj && el.tagName !== 'SCRIPT' && !el.matches('[data-aviso]')) el.inert = true; });
  requestAnimationFrame(() => requestAnimationFrame(() => caj.classList.add('abierto')));
  $('[data-cerrar-carrito].btn-icono', caj)?.focus({ preventScroll: true });
}
function cerrarCajon() {
  const caj = $('#cajon'); if (!caj || caj.hidden) return;
  caj.classList.remove('abierto');
  $$('body > *').forEach((el) => { el.inert = false; });
  setTimeout(() => { if (!caj.classList.contains('abierto')) caj.hidden = true; }, reducido.matches ? 0 : 430);
  abridor?.focus?.({ preventScroll: true });
}
document.addEventListener('keydown', (ev) => {
  const caj = $('#cajon'); if (!caj || caj.hidden) return;
  if (ev.key === 'Escape') { cerrarCajon(); return; }
  if (ev.key === 'Tab') {
    const f = enfocables(caj); if (!f.length) return;
    if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
    else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
  }
});

/* ---------- agregar con vuelo hacia el carrito ---------- */
function volar(slug, s, desde) {
  // Vuela hacia el carrito que se ve: el de la cabecera en escritorio o el de la barra inferior en el celular.
  const destino = $$('[data-destino-carrito]').find((el) => el.getBoundingClientRect().width > 0); if (!destino || reducido.matches || !desde) return Promise.resolve();
  const r = destino.getBoundingClientRect(); const v = document.createElement('div'); v.className = 'vuelo';
  v.innerHTML = `<img src="${foto(slug, s, 160)}" alt="">`; document.body.appendChild(v);
  const x0 = desde.x - 36; const y0 = desde.y - 36; const x1 = r.left + r.width / 2 - 36; const y1 = r.top + r.height / 2 - 36;
  const anim = v.animate([
    { transform: `translate(${x0}px, ${y0}px) scale(1)`, opacity: 1 },
    { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 90}px) scale(0.8) rotate(8deg)`, opacity: 1, offset: 0.55 },
    { transform: `translate(${x1}px, ${y1}px) scale(0.2) rotate(14deg)`, opacity: 0.2 },
  ], { duration: 640, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  return anim.finished.catch(() => {}).then(() => v.remove());
}
async function agregar(items, desde) {
  // No deja pasar del inventario disponible (si se conoce) ni de 20 unidades por producto.
  const c = leer(); let limitado = null; let agregados = 0;
  items.forEach(({ p, s, q }) => {
    const tope = Math.min(20, P[p]?.stock ?? 20); const enCarrito = c.filter((i) => i.p === p).reduce((n, i) => n + i.q, 0);
    const suma = Math.max(0, Math.min(q, tope - enCarrito)); if (suma < q) limitado = P[p];
    if (!suma) return; agregados += suma;
    const f = c.find((i) => i.p === p && i.s === s); if (f) f.q += suma; else c.push({ p, s, q: suma });
  });
  if (!agregados) { avisar(limitado?.stock ? `Ya tienes en el carrito las ${limitado.stock} unidades disponibles` : 'Este producto está agotado'); return; }
  guardar(c);
  document.dispatchEvent(new CustomEvent('carrito:agregado'));
  const primero = items[0]; const nombre = items.length > 1 ? `${items.length} productos` : P[primero.p].nombre;
  avisar(`Agregaste ${nombre} al carrito`);
  const cajonAbierto = !$('#cajon')?.hidden;
  if (!cajonAbierto) await volar(primero.p, primero.s, desde);
  pintarContador(true);
  if (cajonAbierto) pintarCajon(); else abrirCajon();
}
const centro = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

/* ---------- eventos generales ---------- */
document.addEventListener('click', (ev) => {
  const t = ev.target.closest('a, button'); if (!t) return;
  if (t.matches('[data-abrir-carrito]')) { ev.preventDefault(); abrirCajon(); return; }
  if (t.matches('[data-cerrar-carrito]')) { cerrarCajon(); if (t.tagName === 'A') return; return; }
  if (t.dataset.agregar) {
    const p = t.dataset.agregar; let s = t.dataset.sabor;
    if (t.dataset.saborDesde) s = $(`input[name="${t.dataset.saborDesde}"]:checked`)?.value || P[p].sabores[0].slug;
    agregar([{ p, s: s || P[p].sabores[0].slug, q: 1 }], centro(t)); return;
  }
  if (t.dataset.agregarCombo) { agregar(t.dataset.agregarCombo.split(',').map((x) => { const [p, s] = x.split(':'); return { p, s, q: 1 }; }), centro(t)); return; }
  const cambio = t.dataset.mas || t.dataset.menos || t.dataset.quitar;
  if (cambio) {
    const [p, s] = cambio.split('|'); const c = leer(); const f = c.find((i) => i.p === p && i.s === s); if (!f) return;
    const eliminar = () => { guardar(leer().filter((i) => !(i.p === p && i.s === s))); refrescar(); };
    if (t.dataset.mas) { const tope = Math.min(20, P[p]?.stock ?? 20); if (c.filter((i) => i.p === p).reduce((n, i) => n + i.q, 0) >= tope) { avisar(`Solo quedan ${tope} unidades`); return; } f.q++; guardar(c); refrescar(cambio); }
    else if (t.dataset.menos && f.q > 1) { f.q--; guardar(c); refrescar(cambio); }
    else {
      const lineasEl = $$(`.linea[data-clave="${cambio}"]`);
      if (lineasEl.length && !reducido.matches) { lineasEl.forEach((l) => { l.classList.remove('entra'); l.classList.add('sale'); }); setTimeout(eliminar, 280); } else eliminar();
      avisar(`Quitaste ${P[p].nombre} del carrito`);
    }
    return;
  }
  if (t.dataset.copiar) {
    const txt = t.dataset.copiar;
    const ok = () => { t.textContent = 'Copiado'; setTimeout(() => { t.textContent = 'Copiar correo'; }, 1800); };
    (navigator.clipboard?.writeText(txt) || Promise.reject()).then(ok, () => { const el = $('[data-copiable]'); const sel = getSelection(); const rg = document.createRange(); rg.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(rg); avisar('Correo seleccionado, cópialo con tu teclado'); });
  }
});
function refrescar(rebote) {
  pintarContador(); const caj = $('#cajon'); if (caj && !caj.hidden) pintarCajon();
  if ($('[data-carrito-items]')) pintarPaginaCarrito();
  if (rebote) $$(`output[data-q="${rebote}"]`).forEach((o) => { o.classList.remove('salta'); void o.offsetWidth; o.classList.add('salta'); });
}

/* ---------- ficha de producto ---------- */
function vincularSabor(nombre, slug, alCambiar) {
  $$(`input[name="${nombre}"]`).forEach((r) => r.addEventListener('change', () => {
    const s = sabor(slug, r.value); const fs = r.closest('fieldset');
    if (fs) $('[data-sabor-nombre]', fs).textContent = s.nombre;
    alCambiar?.(s);
    document.dispatchEvent(new CustomEvent('frasco:sabor', { detail: { p: slug, s: s.slug } }));
  }));
}
const compra = $('[data-compra]');
if (compra) {
  const slug = compra.dataset.compra; const img = $('[data-ficha-img]'); const cant = $('#cantidad');
  vincularSabor('sabor', slug, (s) => {
    $('.ficha-galeria')?.style.setProperty('--c1', s.c1);
    if (!img || !P[slug].con3D) return;
    img.src = foto(slug, s.slug, 1000); img.srcset = `${foto(slug, s.slug, 600)} 600w, ${foto(slug, s.slug, 1000)} 1000w`;
    img.alt = `${P[slug].nombre} de Halo, sabor ${s.nombre}, ${P[slug].presentacion}`;
  });
  $$('[data-cant]', compra).forEach((b) => b.addEventListener('click', () => { cant.value = Math.max(1, Math.min(9, (+cant.value || 1) + +b.dataset.cant)); }));
  compra.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const s = $('input[name="sabor"]:checked', compra)?.value; const q = Math.max(1, Math.min(9, +cant.value || 1));
    agregar([{ p: slug, s, q }], centro($('.ficha-galeria') || compra));
  });
  const barra = $('[data-barra-compra]'); const boton = $('[data-boton-compra]');
  if (barra && boton && 'IntersectionObserver' in window) {
    barra.hidden = false;
    new IntersectionObserver(([e]) => barra.classList.toggle('visible', !e.isIntersecting && e.boundingClientRect.top < 0)).observe(boton);
    $('[data-barra-agregar]', barra).addEventListener('click', () => compra.requestSubmit());
  }
}
const config = $('[data-configurador]');
if (config) {
  const slug = config.dataset.configurador; const img = $('[data-config-img]', config);
  // Al elegir sabor, el fondo toma el color del sabor y el envase "salta" con un giro corto.
  vincularSabor('sabor-inicio', slug, (s) => {
    config.style.setProperty('--c1', s.c1); config.style.setProperty('--c2', s.c2);
    if (!img) return;
    const cambiar = () => { img.src = foto(slug, s.slug, 600); };
    if (reducido.matches || !img.animate) { cambiar(); return; }
    img.animate([{ transform: 'none' }, { transform: 'scale(0.6) rotate(-14deg)', opacity: 0.2 }], { duration: 200, easing: 'ease-in' }).finished.then(() => {
      cambiar(); img.animate([{ transform: 'scale(0.6) rotate(14deg)', opacity: 0.2 }, { transform: 'scale(1.06)', offset: 0.7 }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    });
  });
}

/* ---------- orden en la tienda ---------- */
const orden = $('[data-orden]'); const rejilla = $('[data-rejilla]');
if (orden && rejilla) {
  orden.addEventListener('change', () => {
    const v = orden.value; const items = $$('.tarjeta', rejilla);
    items.sort((a, b) => (v === 'precio-asc' ? a.dataset.precio - b.dataset.precio : v === 'precio-desc' ? b.dataset.precio - a.dataset.precio : a.dataset.ordenBase - b.dataset.ordenBase));
    items.forEach((el, i) => { el.style.setProperty('--i', i); rejilla.appendChild(el); });
  });
}

/* ---------- página del carrito y pago ---------- */
function pintarPaginaCarrito() {
  const cont = $('[data-carrito-items]'); const cifras = $('[data-resumen-cifras]'); const pagar = $('[data-pagar]');
  const c = validos(leer()); const s = subtotal(c); const e = envio(s);
  cont.innerHTML = c.length ? c.map((i, idx) => lineaHTML(i, idx, false)).join('') : `<div class="vacio"><p>Tu carrito está vacío.</p><a class="btn btn-pri" href="${datos.tienda}">Ver la tienda</a></div>`;
  cifras.innerHTML = `<div class="fila-total"><span>Subtotal</span><span>${cop(s)}</span></div><div class="fila-total"><span>Envío</span><span>${c.length ? (e ? cop(e) : 'Gratis') : cop(0)}</span></div>${c.length && s < datos.gratisDesde ? `<p class="nota">Agrega ${cop(datos.gratisDesde - s)} más y el envío es gratis.</p>` : ''}<div class="fila-total total"><span>Total</span><span>${cop(s + e)}</span></div>`;
  pagar.disabled = !c.length;
}
const botonPagar = $('[data-pagar]');
if (botonPagar) {
  pintarPaginaCarrito();
  // Sin Supabase (modo demostración) el pago se simula: el pedido aparece en el panel y se descuenta el stock.
  if (modoDemo) { botonPagar.textContent = 'Simular pago (demostración)'; const nota = $('[data-pago-nota]'); if (nota) nota.textContent = 'Modo demostración: no se cobra nada. El pedido queda registrado en este navegador y lo ves en tu cuenta y en el panel.'; }
  botonPagar.addEventListener('click', async () => {
    const err = $('[data-pago-error]'); err.textContent = '';
    const c = validos(leer()); if (!c.length) return;
    if (modoDemo) {
      botonPagar.disabled = true;
      try { const s = await sesion(); await pagoSimulado(c, s?.email); location.href = datos.exito; } catch (e) { err.textContent = `No se pudo simular el pago: ${e.message}`; botonPagar.disabled = false; }
      return;
    }
    botonPagar.disabled = true; const txt = botonPagar.textContent; botonPagar.textContent = 'Conectando con Mercado Pago…';
    try {
      const s = await sesion().catch(() => null);
      const r = await fetch(`${datos.raiz}api/crear-preferencia`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: s?.email || '', items: c.map((i) => ({ slug: i.p, sabor: i.s, cantidad: i.q })) }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.init_point) throw new Error(j.error || 'sin-api');
      location.href = j.init_point;
    } catch (e) {
      err.textContent = e.message === 'sin-api' || e instanceof TypeError
        ? 'El pago se activa cuando el sitio está publicado con las credenciales de Mercado Pago. En esta vista previa no se puede pagar.'
        : `No pudimos iniciar el pago: ${e.message}. Inténtalo de nuevo.`;
      botonPagar.disabled = false; botonPagar.textContent = txt;
    }
  });
}
if ($('[data-vaciar-carrito]')) guardar([]);

/* ---------- boletín ---------- */
const boletin = $('[data-boletin]');
if (boletin) {
  boletin.addEventListener('submit', (ev) => {
    ev.preventDefault(); const inp = $('input', boletin); const msg = $('[data-boletin-msg]', boletin);
    if (!inp.checkValidity()) { inp.setAttribute('aria-invalid', 'true'); msg.textContent = 'Escribe un correo válido, por ejemplo nombre@correo.com.'; inp.focus(); return; }
    inp.removeAttribute('aria-invalid'); msg.textContent = 'Gracias. Suscripción de ejemplo: todavía no se envía a ningún servicio de correo.'; boletin.reset();
  });
}

/* ---------- tarjeta generada en el navegador (búsqueda y productos nuevos) ---------- */
const porPorcion = (p) => (p.porciones ? Math.round(p.precio / p.porciones / 100) * 100 : null);
function tarjetaJS(p, i) {
  const s = p.sabores[0]; const pp = porPorcion(p);
  const nombre = p.url ? `<a href="${p.url}">${esc(p.nombre)}</a>` : esc(p.nombre);
  return `<article class="tarjeta" style="--i:${i}" data-tarjeta="${p.slug}" data-precio="${p.precio}" data-orden-base="${i}">
  <div class="tarjeta-img"><img src="${esc(foto(p.slug, s.slug, 600))}" width="600" height="600" alt=""${i < 6 ? '' : ' loading="lazy"'} decoding="async"><p class="sello" data-stock-de="${p.slug}" hidden></p></div>
  <div class="tarjeta-info"><p class="tarjeta-cat">${esc(p.categoriaNombre || '')}</p><h3>${nombre}</h3><p class="tarjeta-resumen">${esc(p.resumen || '')}</p>
  <div class="tarjeta-pie"><p class="precio"><span data-precio-de="${p.slug}">${cop(p.precio)}</span><small>${pp ? `${cop(pp)} por porción` : esc(p.presentacion || '')}</small></p>
  <button class="btn btn-sec btn-sm" type="button" data-agregar="${p.slug}" data-sabor="${s.slug}" aria-label="Agregar ${esc(p.nombre)} al carrito">Agregar</button></div></div>
</article>`;
}

/* ---------- buscador ---------- */
// Ignora tildes y mayúsculas. Cada palabra escrita debe aparecer en el nombre, la categoría, las palabras clave o el resumen.
const norm = (t) => [...String(t ?? '')].map((ch) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().charAt(0) || ch).join('');
const reEsc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function buscar(q) {
  const toks = norm(q).trim().split(/\s+/).filter(Boolean); if (!toks.length) return [];
  const puntuar = (p, exigir) => {
    const n = norm(p.nombre); const k = norm(p.categoriaNombre); const w = norm(p.palabras); const r = norm(p.resumen);
    let s = 0;
    for (const t of toks) {
      let v = 0;
      if (n.startsWith(t)) v = 10; else if (new RegExp(`(^|\\s)${reEsc(t)}`).test(n)) v = 8; else if (n.includes(t)) v = 6;
      else if (k.includes(t)) v = 4; else if (w.includes(t)) v = 3; else if (r.includes(t)) v = 1;
      if (!v && exigir) return 0; s += v;
    }
    return s;
  };
  const visibles = Object.values(P).filter((p) => !p.oculto);
  let res = visibles.map((p) => [p, puntuar(p, true)]).filter((x) => x[1]);
  if (!res.length) res = visibles.map((p) => [p, puntuar(p, false)]).filter((x) => x[1]); // alguna palabra coincide
  return res.sort((a, b) => b[1] - a[1]).map((x) => x[0]);
}
function resaltar(texto, q) {
  const n = norm(texto); const t = norm(q).trim().split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length)[0];
  const i = t ? n.indexOf(t) : -1; if (i < 0) return esc(texto);
  return `${esc(texto.slice(0, i))}<mark>${esc(texto.slice(i, i + t.length))}</mark>${esc(texto.slice(i + t.length))}`;
}
const urlBuscar = (q) => `${datos.buscar}?q=${encodeURIComponent(q.trim())}`;
const urlDe = (p) => p.url || urlBuscar(p.nombre);
function iniciarBuscador(form) {
  const inp = $('input', form); const panel = $('.buscador-panel', form); const id = inp.id;
  let activo = -1;
  const opciones = () => $$('[role="option"]', panel);
  const marcar = (i) => {
    const op = opciones(); activo = op.length ? (i + op.length) % op.length : -1;
    op.forEach((o, j) => o.setAttribute('aria-selected', j === activo ? 'true' : 'false'));
    if (activo >= 0) { inp.setAttribute('aria-activedescendant', op[activo].id); op[activo].scrollIntoView({ block: 'nearest' }); } else inp.removeAttribute('aria-activedescendant');
  };
  const opcion = (p, j, q) => `<a class="res" role="option" id="${id}-op-${j}" aria-selected="false" href="${urlDe(p)}"><img src="${esc(foto(p.slug, p.sabores[0].slug, 160))}" width="60" height="60" alt="" loading="lazy" decoding="async"><span><span class="res-n">${resaltar(p.nombre, q)}</span><span class="res-c">${esc(p.categoriaNombre || '')}${p.stock === 0 ? ' · Agotado' : ''}</span></span><span class="res-p">${cop(p.precio)}</span></a>`;
  function pintar() {
    const q = inp.value; let html;
    if (!q.trim()) {
      const pop = Object.values(P).filter((p) => !p.oculto).slice(0, 5);
      html = `<p class="res-t" aria-hidden="true">Más vendidos</p>${pop.map((p, j) => opcion(p, j, '')).join('')}`;
    } else {
      const r = buscar(q);
      html = r.length
        ? `<p class="res-t" aria-hidden="true">${r.length} ${r.length === 1 ? 'producto' : 'productos'}</p>${r.slice(0, 6).map((p, j) => opcion(p, j, q)).join('')}<a class="res-todos" role="option" id="${id}-op-${Math.min(6, r.length)}" aria-selected="false" href="${urlBuscar(q)}">Ver todos los resultados</a>`
        : `<p class="res-vacio">No encontramos “${esc(q)}”. Prueba con proteína, creatina o pre-entreno.</p>`;
    }
    panel.innerHTML = html; panel.hidden = false; inp.setAttribute('aria-expanded', 'true'); activo = -1; inp.removeAttribute('aria-activedescendant');
  }
  const cerrarPanel = () => { panel.hidden = true; inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant'); activo = -1; };
  const abrirHoja = () => { if (movil.matches && !form.classList.contains('abierto')) { form.classList.add('abierto'); document.body.classList.add('buscando'); } };
  const cerrarHoja = () => { form.classList.remove('abierto'); document.body.classList.remove('buscando'); cerrarPanel(); inp.blur(); };
  inp.addEventListener('focus', () => { abrirHoja(); pintar(); });
  inp.addEventListener('input', pintar);
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (panel.hidden) pintar(); marcar(activo + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); marcar(activo - 1); }
    else if (e.key === 'Enter' && activo >= 0) { e.preventDefault(); location.href = opciones()[activo].href; }
    else if (e.key === 'Escape') { if (form.classList.contains('abierto')) cerrarHoja(); else if (!panel.hidden) cerrarPanel(); else inp.value = ''; }
  });
  form.addEventListener('submit', (e) => { if (!inp.value.trim()) { e.preventDefault(); return; } e.preventDefault(); location.href = urlBuscar(inp.value); });
  $('[data-cerrar-busqueda]', form).addEventListener('click', cerrarHoja);
  document.addEventListener('pointerdown', (e) => { if (!form.contains(e.target) && !form.classList.contains('abierto')) cerrarPanel(); });
  form.addEventListener('focusout', (e) => { if (e.relatedTarget && !form.contains(e.relatedTarget) && !form.classList.contains('abierto')) cerrarPanel(); });
  movil.addEventListener('change', () => { if (!movil.matches) { form.classList.remove('abierto'); document.body.classList.remove('buscando'); } });
  return inp;
}
const buscadorCab = $('[data-buscador]');
const inputCab = buscadorCab ? iniciarBuscador(buscadorCab) : null;
// El botón "Buscar" de la barra inferior abre el buscador a pantalla completa con el teclado listo.
document.addEventListener('click', (e) => { if (e.target.closest('[data-abrir-busqueda]') && inputCab) { e.preventDefault(); inputCab.focus(); } });

// Página /buscar/: resultados con tarjetas completas, sin recargar al buscar otra vez.
const formPag = $('[data-buscar-pagina]');
function pintarBusqueda() {
  const cont = $('[data-buscar-resultados]'); const resumen = $('[data-buscar-resumen]'); if (!cont) return;
  const q = new URLSearchParams(location.search).get('q') || ''; $('input', formPag).value = q;
  const r = q.trim() ? buscar(q) : Object.values(P).filter((p) => !p.oculto);
  resumen.textContent = q.trim() ? (r.length ? `${r.length} ${r.length === 1 ? 'resultado' : 'resultados'} para “${q}”` : `No encontramos “${q}”. Mira todos nuestros productos:`) : 'Todos los productos';
  const lista = r.length ? r : Object.values(P).filter((p) => !p.oculto);
  cont.innerHTML = lista.map((p, i) => tarjetaJS(p, i)).join('');
  if (q.trim()) document.title = `${q} | Buscar | Halo Nutrition`;
  pintarEstados();
}
if (formPag) {
  formPag.addEventListener('submit', (e) => { e.preventDefault(); const q = $('input', formPag).value; history.replaceState(null, '', `${location.pathname}?q=${encodeURIComponent(q.trim())}`); pintarBusqueda(); });
  pintarBusqueda();
}

/* ---------- datos en vivo: precio, stock, visibilidad y fotos editados en el panel ---------- */
function pintarEstados() {
  $$('[data-tarjeta]').forEach((el) => {
    const p = P[el.dataset.tarjeta]; if (!p) return;
    el.hidden = !!p.oculto; el.dataset.precio = p.precio;
    const sello = $('.sello', el); const agotado = p.stock != null && p.stock <= 0; const pocas = !agotado && p.stock != null && p.stock <= (p.stockMin ?? 5);
    el.classList.toggle('sin-stock', agotado);
    if (sello) { sello.hidden = !(agotado || pocas); sello.textContent = agotado ? 'Agotado' : pocas ? `Quedan ${p.stock}` : ''; sello.classList.toggle('pocas', pocas); }
    const img = $('.tarjeta-img img', el); if (img && p.fotoPropia && img.getAttribute('src') !== p.img) { img.removeAttribute('srcset'); img.src = p.img; }
  });
  $$('[data-precio-de]').forEach((el) => { const p = P[el.dataset.precioDe]; if (p) el.textContent = cop(p.precio); });
  $$('[data-agregar]').forEach((b) => { const p = P[b.dataset.agregar]; if (p) b.disabled = !!p.oculto || (p.stock != null && p.stock <= 0); });
  const ficha = $('[data-producto]');
  if (ficha) {
    const p = P[ficha.dataset.producto]; const linea = $('[data-stock-ficha]');
    if (p && linea) {
      const agotado = p.stock != null && p.stock <= 0; const pocas = !agotado && p.stock != null && p.stock <= (p.stockMin ?? 5);
      const no = p.oculto || agotado;
      linea.hidden = !(no || pocas); linea.textContent = p.oculto ? 'Este producto no está disponible por ahora' : agotado ? 'Agotado por ahora' : pocas ? `Últimas ${p.stock} unidades` : '';
      $$('[data-boton-compra], [data-barra-agregar]').forEach((b) => { b.disabled = no; });
      const cant = $('#cantidad'); if (cant && p.stock) cant.max = Math.min(9, p.stock);
      const img = $('[data-ficha-img]'); if (img && p.fotoPropia && img.getAttribute('src') !== p.img) { img.removeAttribute('srcset'); img.src = p.img; document.body.classList.add('sin-frasco'); }
    }
  }
}
function aplicarDatos(lista) {
  const vivos = new Set(lista.map((x) => x.slug));
  Object.values(P).forEach((p) => { p.oculto = !vivos.has(p.slug); });
  const nuevos = [];
  lista.forEach((x) => {
    let p = P[x.slug];
    if (!p) {
      const k = (datos.categorias || []).find((c) => c.slug === x.categoria);
      p = P[x.slug] = { slug: x.slug, nombre: x.nombre, porciones: x.porciones, presentacion: x.presentacion || '', forma: x.forma, categoria: x.categoria, categoriaNombre: k ? k.nombre : x.categoria, resumen: x.resumen || '', palabras: '', sabores: x.sabores?.length ? x.sabores : [{ slug: 'unico', nombre: 'Único', c1: '#3b3f47', c2: '#15171b' }], img: `${datos.assets}img/sin-foto.svg`, con3D: false, url: null };
      nuevos.push(p);
    }
    Object.assign(p, { oculto: false, nombre: x.nombre || p.nombre, precio: x.precio, stock: x.stock ?? null, stockMin: x.stock_minimo ?? 5 });
    if (x.imagen_url) { p.img = x.imagen_url; p.con3D = false; p.fotoPropia = true; }
  });
  // Productos creados en el panel que todavía no tienen página: se muestran en las rejillas del inicio y la tienda.
  nuevos.forEach((p) => {
    $$('[data-rejilla]').forEach((r) => { if (!r.dataset.categoria || r.dataset.categoria === p.categoria) r.insertAdjacentHTML('beforeend', tarjetaJS(p, r.children.length)); });
  });
  pintarEstados();
  if (formPag) pintarBusqueda();
  refrescar();
}
async function sincronizar() { try { aplicarDatos(await productosPublico()); } catch { /* sin conexión: queda el HTML publicado */ } }
if (modoDemo) sincronizar();
else if ($('[data-tarjeta], [data-producto], [data-buscar-resultados], [data-carrito-items]')) (window.requestIdleCallback || setTimeout)(sincronizar);

/* ---------- estado de la cuenta en la cabecera ---------- */
if (haySesionGuardada()) {
  $$('[data-enlace-cuenta]').forEach((a) => { a.textContent = 'Mi cuenta'; a.classList.add('con-sesion'); });
  $$('[data-enlace-cuenta-tab]').forEach((a) => a.classList.add('con-sesion'));
}

/* ---------- arranque ---------- */
pintarContador();
addEventListener('storage', (e) => { if (e.key === CLAVE) refrescar(); });
import('./movimiento.js').then((m) => m.iniciarMovimiento()).catch(() => {});
const ahorro = navigator.connection?.saveData;
const conGL = (() => { try { return !!document.createElement('canvas').getContext('webgl'); } catch { return false; } })();
const quiere3D = () => { try { return localStorage.getItem('halo-3d') === 'si'; } catch { return false; } };
let escenaIniciada = false;
function iniciar3D() {
  if (escenaIniciada) return; escenaIniciada = true;
  const iniciar = () => import('./escena.js').then((m) => m.iniciarEscena(datos)).catch(() => {});
  if (document.readyState === 'complete') (window.requestIdleCallback || setTimeout)(iniciar);
  else addEventListener('load', () => (window.requestIdleCallback || setTimeout)(iniciar), { once: true });
}
// El 3D respeta "reducir movimiento" y el ahorro de datos. Si está apagado por eso, se explica y se ofrece activarlo.
function avisar3D(texto, conBoton) {
  try { if (sessionStorage.getItem('halo-3d-aviso') === 'cerrado') return; } catch { /* nada */ }
  const el = document.createElement('div'); el.className = 'aviso-3d'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Animación 3D');
  el.innerHTML = `<p>${texto}</p>${conBoton ? '<button class="btn btn-sec btn-sm" type="button" data-activar-3d>Activar 3D</button>' : ''}<button class="btn-icono" type="button" data-cerrar-3d aria-label="Cerrar aviso">×</button>`;
  document.body.appendChild(el);
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-activar-3d]')) { try { localStorage.setItem('halo-3d', 'si'); } catch { /* nada */ } el.remove(); iniciar3D(); }
    if (e.target.closest('[data-cerrar-3d]')) { try { sessionStorage.setItem('halo-3d-aviso', 'cerrado'); } catch { /* nada */ } el.remove(); }
  });
}
if (document.body.dataset.frasco) {
  if (!conGL) avisar3D('El frasco 3D necesita WebGL. Activa la aceleración por hardware en tu navegador para verlo.', false);
  else if ((reducido.matches || ahorro) && !quiere3D()) avisar3D(reducido.matches ? 'El frasco 3D está en pausa porque tu sistema pide reducir el movimiento.' : 'El frasco 3D está en pausa porque tienes activado el ahorro de datos.', true);
  else iniciar3D();
}
