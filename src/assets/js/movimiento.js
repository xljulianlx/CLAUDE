// Movimiento del sitio. Cada efecto tiene un motivo y es corto:
// - Revelar al entrar en pantalla (solo páginas de venta y lectura, una sola vez, escalonado).
// - Cabecera que se esconde al bajar y vuelve al subir (más espacio para el contenido).
// - Inclinación leve de tarjetas y portadas al pasar el cursor (solo con mouse).
// - Cifras que cuentan, barra de lectura en las guías y celebración al pagar.
// Con prefers-reduced-motion todo queda quieto y el contenido se ve desde el inicio.

const reducido = matchMedia('(prefers-reduced-motion: reduce)');
const conMouse = matchMedia('(hover: hover) and (pointer: fine)');
// En celular todo entra antes y más corto: al deslizar con el dedo el contenido llega rápido y no debe esperar.
const tactil = matchMedia('(pointer: coarse)').matches || innerWidth < 760;

export function iniciarMovimiento() {
  cabecera();
  etiqueta(); // los puntos se pueden tocar siempre; solo el recorrido automático depende del movimiento
  if (reducido.matches) return;
  document.documentElement.classList.add('js-mov');
  if (tactil) document.documentElement.classList.add('mov-rapido');
  vivo();
  revelar();
  contadores();
  inclinar();
  lectura();
  celebrar();
  lema();
  anillos();
  ruta();
  conGsap();
}

/* ---------- revelar al entrar en pantalla ---------- */
// Páginas funcionales (cuenta, panel, carrito, pago) no se revelan: se usan a diario y el contenido debe estar ya.
const SELECTOR = [
  'main .h2', 'main .lead', '.rejilla .tarjeta', '.resena', '.guia-card', '.objetivo', '.dato', '.garantias > div', '.combo', '.familia',
  '.ciencia-img', '.configurador-escena', '.configurador-panel', '.acordeon details', '.seo-bloque',
  '.texto-largo > p', '.texto-largo > h2', '.texto-largo > ul', '.articulo-cta', '.otras-guias', '.historia p', '.historia-con-img figure',
  '.contacto-dato', '.pie-in > *',
].join(',');
function revelar() {
  const tipo = document.body.dataset.pagina;
  if (['cuenta', 'admin', 'carrito', 'pago'].includes(tipo) || !('IntersectionObserver' in window)) return;
  const alto = innerHeight;
  // Solo lo que todavía no se ve: lo que ya está en pantalla al cargar no parpadea.
  // Las secciones lejanas no se dibujan todavía (content-visibility): se mide la sección, que sí tiene tamaño.
  const arriba = (el) => (el.closest('main > section, main > article, footer') || el).getBoundingClientRect().top;
  const els = [...document.querySelectorAll(SELECTOR)].filter((el) => Math.max(el.getBoundingClientRect().top, arriba(el)) > alto * 0.92);
  els.forEach((el) => el.classList.add('rv'));
  let lote = []; let pendiente = false;
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { lote.push(e.target); io.unobserve(e.target); } });
    if (lote.length && !pendiente) {
      pendiente = true;
      requestAnimationFrame(() => {
        // Escalonado de 60 ms entre los que entran juntos, ordenados como se leen.
        lote.sort((a, b) => { const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect(); return ra.top - rb.top || ra.left - rb.left; })
          .forEach((el, i) => { el.style.setProperty('--rv', `${Math.min(i, tactil ? 3 : 6) * (tactil ? 35 : 60)}ms`); el.classList.add('visto'); });
        lote = []; pendiente = false;
      });
    }
  }, { rootMargin: tactil ? '0px 0px 12% 0px' : '0px 0px -8% 0px' });
  els.forEach((el) => io.observe(el));
  // Lo que se agrega después (resultados de búsqueda, productos nuevos) entra con su propia transición CSS.
}

/* ---------- foto "viva": el envase se inclina hacia el cursor y salta al tocarlo ---------- */
// La flotación es CSS ([data-vivo] > img). Aquí solo la inclinación (con mouse) y el salto (con toque o clic).
function vivo() {
  document.querySelectorAll('[data-vivo]').forEach((fig) => {
    const img = fig.querySelector('img'); if (!img) return;
    fig.addEventListener('click', (e) => {
      if (fig.classList.contains('con-3d') || e.target.closest('a, button, input, label') || !img.animate) return;
      img.animate([{ scale: '1' }, { scale: '1.07 0.9', offset: 0.16 }, { scale: '0.95 1.07', offset: 0.42 }, { scale: '1.02 0.98', offset: 0.7 }, { scale: '1' }], { duration: 620, easing: 'ease-out' });
    });
    if (!conMouse.matches) return;
    let raf = 0; let ev = null;
    fig.addEventListener('pointermove', (e) => { if (fig.classList.contains('con-3d')) return; ev = e; if (!raf) raf = requestAnimationFrame(() => { raf = 0; const r = fig.getBoundingClientRect(); fig.style.setProperty('--ry', `${(((ev.clientX - r.left) / r.width - 0.5) * 12).toFixed(2)}deg`); fig.style.setProperty('--rx', `${(-((ev.clientY - r.top) / r.height - 0.5) * 10).toFixed(2)}deg`); }); });
    fig.addEventListener('pointerleave', () => { fig.style.setProperty('--rx', '0deg'); fig.style.setProperty('--ry', '0deg'); });
  });
}

/* ---------- cabecera que se esconde al bajar ---------- */
function cabecera() {
  const cab = document.querySelector('.cabecera'); if (!cab) return;
  let ultimo = scrollY; let pedido = false;
  const actualizar = () => {
    pedido = false; const y = scrollY; const dy = y - ultimo;
    cab.classList.toggle('con-sombra', y > 8);
    const ocupado = document.body.classList.contains('buscando') || cab.contains(document.activeElement) || !document.getElementById('cajon')?.hidden;
    if (!reducido.matches && !ocupado) {
      if (dy > 6 && y > 240) cab.classList.add('oculta');
      else if (dy < -6 || y < 120) cab.classList.remove('oculta');
    } else cab.classList.remove('oculta');
    ultimo = y;
  };
  addEventListener('scroll', () => { if (!pedido) { pedido = true; requestAnimationFrame(actualizar); } }, { passive: true });
  cab.addEventListener('focusin', () => cab.classList.remove('oculta'));
}

/* ---------- cifras que cuentan desde cero ---------- */
function contadores() {
  const els = [...document.querySelectorAll('[data-contar]')];
  if (!els.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; io.unobserve(e.target);
    const el = e.target; const fin = +el.dataset.contar; const t0 = performance.now();
    const paso = (t) => { const u = Math.min(1, (t - t0) / (tactil ? 700 : 1100)); el.textContent = Math.round(fin * (1 - (1 - u) ** 3)); if (u < 1) requestAnimationFrame(paso); };
    requestAnimationFrame(paso);
  }), { threshold: 0.6 });
  els.forEach((el) => { const sec = el.closest('main > section') || el; if (Math.max(el.getBoundingClientRect().top, sec.getBoundingClientRect().top) > innerHeight) { el.textContent = '0'; io.observe(el); } });
}

/* ---------- inclinación leve con el cursor ---------- */
// Máximo 5 grados, vuelve al centro al salir. Solo con mouse: en el celular un toque no debe mover la tarjeta.
function inclinar() {
  if (!conMouse.matches) return;
  let activo = null; let raf = 0; let pos = null;
  const aplicar = () => {
    raf = 0; if (!activo || !pos) return;
    const r = activo.getBoundingClientRect(); const x = (pos.x - r.left) / r.width - 0.5; const y = (pos.y - r.top) / r.height - 0.5;
    activo.style.transform = `perspective(900px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg) translateY(-3px)`;
    activo.style.setProperty('--lx', `${((x + 0.5) * 100).toFixed(1)}%`); activo.style.setProperty('--ly', `${((y + 0.5) * 100).toFixed(1)}%`);
  };
  const soltar = () => { if (activo) { activo.style.transform = ''; activo.classList.remove('inclinada'); } activo = null; };
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest('.tarjeta, .objetivo, .guia-card');
    if (el !== activo) { soltar(); if (el) { activo = el; el.classList.add('inclinada'); } }
    if (!activo) return; pos = { x: e.clientX, y: e.clientY }; if (!raf) raf = requestAnimationFrame(aplicar);
  }, { passive: true });
  document.addEventListener('pointerleave', soltar);
  addEventListener('scroll', soltar, { passive: true });
}

/* ---------- barra de lectura en las guías ---------- */
function lectura() {
  const art = document.querySelector('.articulo'); if (!art) return;
  const barra = document.createElement('div'); barra.className = 'lectura'; barra.setAttribute('aria-hidden', 'true'); document.body.appendChild(barra);
  let pedido = false;
  const pintar = () => { pedido = false; const r = art.getBoundingClientRect(); const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight))); barra.style.transform = `scaleX(${p.toFixed(4)})`; };
  addEventListener('scroll', () => { if (!pedido) { pedido = true; requestAnimationFrame(pintar); } }, { passive: true });
  pintar();
}

/* ---------- celebración al aprobarse el pago (una vez) ---------- */
function celebrar() {
  const zona = document.querySelector('[data-celebrar]'); if (!zona || !zona.animate) return;
  const colores = ['#ef6a2f', '#f2b443', '#d9566f', '#7e55c9', '#d8e05c'];
  const r = zona.querySelector('h1').getBoundingClientRect(); const cx = r.left + 40; const cy = r.top + r.height / 2;
  for (let i = 0; i < 28; i++) {
    const p = document.createElement('i'); p.className = 'chispa'; p.style.background = colores[i % colores.length];
    p.style.left = `${cx}px`; p.style.top = `${cy}px`; document.body.appendChild(p);
    const ang = (Math.PI * 2 * i) / 28 + Math.random() * 0.3; const dist = 80 + Math.random() * 140;
    p.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist + 40}px) scale(0.6) rotate(${Math.random() * 360}deg)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', delay: 150 }).finished.then(() => p.remove(), () => p.remove());
  }
}

/* ---------- paso activo de "Fórmulas claras" ---------- */
function conGsap() {
  const pasos = [...document.querySelectorAll('[data-paso]')];
  if (!pasos.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('activo', e.isIntersecting)), { rootMargin: '-38% 0px -38% 0px' });
  pasos.forEach((p) => io.observe(p));
}
/* ---------- lema gigante que se desliza con el scroll (cada fila en un sentido) ---------- */
function lema() {
  const filas = [...document.querySelectorAll('[data-lema]')]; if (!filas.length) return;
  const sec = filas[0].parentElement; let visible = false; let pedido = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(sec);
  const mover = () => {
    pedido = false; if (!visible) return;
    const r = sec.getBoundingClientRect(); const p = (innerHeight - r.top) / (innerHeight + r.height);
    filas.forEach((f) => { f.style.transform = `translateX(${(f.dataset.lema * (p - 0.5) * 30).toFixed(2)}%)`; });
  };
  addEventListener('scroll', () => { if (!pedido) { pedido = true; requestAnimationFrame(mover); } }, { passive: true });
  mover();
}

/* ---------- anillo de macronutrientes: se dibuja al verlo ---------- */
function anillos() {
  const els = [...document.querySelectorAll('[data-anillo], [data-reloj]')]; if (!els.length || !('IntersectionObserver' in window)) return;
  els.forEach((el) => el.classList.add('espera'));
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.remove('espera'); io.unobserve(e.target); } }), { threshold: 0.5 });
  els.forEach((el) => io.observe(el));
}

/* ---------- "Por qué Halo": puntos del envase que se recorren solos hasta que la persona toca uno ---------- */
function etiqueta() {
  const raiz = document.querySelector('[data-etiqueta]'); if (!raiz) return;
  const puntos = [...raiz.querySelectorAll('[data-hs]')]; const datos = [...raiz.querySelectorAll('[data-hs-dato]')]; const nav = [...raiz.querySelectorAll('[data-hs-punto]')];
  let actual = 0; let auto = null;
  const mostrar = (i) => {
    actual = i;
    puntos.forEach((p, k) => p.setAttribute('aria-pressed', String(k === i)));
    nav.forEach((p, k) => p.classList.toggle('activo', k === i));
    datos.forEach((d, k) => { d.hidden = k !== i; if (k === i) { d.classList.remove('entra'); void d.offsetWidth; d.classList.add('entra'); } });
  };
  const ciclo = () => { auto = setInterval(() => mostrar((actual + 1) % puntos.length), 3600); };
  raiz.addEventListener('click', (e) => { const b = e.target.closest('[data-hs]'); if (!b) return; clearInterval(auto); mostrar(+b.dataset.hs); });
  if (!reducido.matches) new IntersectionObserver(([e]) => { clearInterval(auto); if (e.isIntersecting) ciclo(); }).observe(raiz);
}

/* ---------- ruta de entrega: la ciudad de destino cambia en cada viaje ---------- */
function ruta() {
  const el = document.querySelector('[data-ciudad]'); if (!el) return;
  const ciudades = ['Medellín', 'Bogotá', 'Cali', 'Barranquilla', 'Bucaramanga', 'Pereira', 'Cartagena'];
  let i = 0; const camion = document.querySelector('.camion-ruta');
  camion?.addEventListener('animationiteration', () => {
    i = (i + 1) % ciudades.length; el.classList.remove('cambia'); void el.offsetWidth; el.textContent = ciudades[i]; el.classList.add('cambia');
  });
}
