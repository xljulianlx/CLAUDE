// Lógica de la tienda: carrito (localStorage), cajón accesible, fichas de producto, pago con Mercado Pago.
const datos = JSON.parse(document.getElementById('catalogo').textContent);
const P = Object.fromEntries(datos.productos.map((p) => [p.slug, p]));
const reducido = matchMedia('(prefers-reduced-motion: reduce)');
const num = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const cop = (n) => `$ ${num.format(Math.round(n))}`;
const foto = (slug, sabor, t = 160) => `${datos.assets}img/productos/${slug}-${sabor}-${t}.webp`;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sabor = (slug, s) => P[slug]?.sabores.find((x) => x.slug === s) || P[slug]?.sabores[0];

/* ---------- almacenamiento ---------- */
const CLAVE = 'halo-carrito';
let memoria = [];
const leer = () => {
  try { const v = JSON.parse(localStorage.getItem(CLAVE) || '[]'); return Array.isArray(v) ? v.filter((i) => P[i.p] && i.q > 0) : []; } catch { return memoria; }
};
const guardar = (c) => { memoria = c; try { localStorage.setItem(CLAVE, JSON.stringify(c)); } catch { /* sin almacenamiento: queda en memoria */ } };
const cuenta = (c) => c.reduce((n, i) => n + i.q, 0);
const subtotal = (c) => c.reduce((n, i) => n + i.q * P[i.p].precio, 0);
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
  <div><p class="linea-nombre"><a href="${p.url}">${p.nombre}</a></p><p class="linea-meta">${s.nombre}, ${cop(p.precio)} c/u</p>
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
  const c = leer(); const s = subtotal(c); const e = envio(s);
  let n = 0;
  const lineas = c.map((i) => { const clave = `${i.p}|${i.s}`; const entra = todasEntran || !vistas.has(clave); return lineaHTML(i, entra ? n++ : 0, entra); }).join('');
  vistas = new Set(c.map((i) => `${i.p}|${i.s}`));
  const falta = datos.gratisDesde - s;
  $('[data-envio]', caj).className = `cajon-envio${s && falta <= 0 ? ' logrado' : ''}`;
  $('[data-envio]', caj).innerHTML = c.length ? `${falta > 0 ? `Te faltan <strong>${cop(falta)}</strong> para envío gratis` : '<strong>Tu envío es gratis</strong>'}<div class="envio-linea" aria-hidden="true"><i style="--p:${Math.min(1, s / datos.gratisDesde).toFixed(3)}"></i></div>` : '';
  // Sugerencia para alcanzar el envío gratis: el producto más barato que no está en el carrito y cubre lo que falta.
  let sugerencia = '';
  if (c.length && falta > 0) {
    const fuera = datos.productos.filter((x) => !c.some((i) => i.p === x.slug)).sort((a, b) => a.precio - b.precio);
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
  const destino = $('.btn-carrito'); if (!destino || reducido.matches || !desde) return Promise.resolve();
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
  const c = leer();
  items.forEach(({ p, s, q }) => { const f = c.find((i) => i.p === p && i.s === s); if (f) f.q = Math.min(20, f.q + q); else c.push({ p, s, q }); });
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
    if (t.dataset.mas) { f.q = Math.min(20, f.q + 1); guardar(c); refrescar(cambio); }
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
    if (!img) return;
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
  vincularSabor('sabor-inicio', slug, (s) => { if (img) img.src = foto(slug, s.slug, 600); });
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
  const c = leer(); const s = subtotal(c); const e = envio(s);
  cont.innerHTML = c.length ? c.map((i, idx) => lineaHTML(i, idx, false)).join('') : `<div class="vacio"><p>Tu carrito está vacío.</p><a class="btn btn-pri" href="${datos.tienda}">Ver la tienda</a></div>`;
  cifras.innerHTML = `<div class="fila-total"><span>Subtotal</span><span>${cop(s)}</span></div><div class="fila-total"><span>Envío</span><span>${c.length ? (e ? cop(e) : 'Gratis') : cop(0)}</span></div>${c.length && s < datos.gratisDesde ? `<p class="nota">Agrega ${cop(datos.gratisDesde - s)} más y el envío es gratis.</p>` : ''}<div class="fila-total total"><span>Total</span><span>${cop(s + e)}</span></div>`;
  pagar.disabled = !c.length;
}
const botonPagar = $('[data-pagar]');
if (botonPagar) {
  pintarPaginaCarrito();
  botonPagar.addEventListener('click', async () => {
    const err = $('[data-pago-error]'); err.textContent = '';
    const c = leer(); if (!c.length) return;
    botonPagar.disabled = true; const txt = botonPagar.textContent; botonPagar.textContent = 'Conectando con Mercado Pago…';
    try {
      const raizSitio = datos.assets.replace(/assets\/$/, '');
      const r = await fetch(`${raizSitio}api/crear-preferencia`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: c.map((i) => ({ slug: i.p, sabor: i.s, cantidad: i.q })) }) });
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

/* ---------- arranque ---------- */
pintarContador();
addEventListener('storage', (e) => { if (e.key === CLAVE) refrescar(); });
import('./movimiento.js').then((m) => m.iniciarMovimiento()).catch(() => {});
const ahorro = navigator.connection?.saveData;
const conGL = (() => { try { return !!document.createElement('canvas').getContext('webgl'); } catch { return false; } })();
if (document.body.dataset.frasco && conGL && !ahorro && !reducido.matches) {
  const iniciar = () => import('./escena.js').then((m) => m.iniciarEscena(datos)).catch(() => {});
  if (document.readyState === 'complete') (window.requestIdleCallback || setTimeout)(iniciar);
  else addEventListener('load', () => (window.requestIdleCallback || setTimeout)(iniciar), { once: true });
}
