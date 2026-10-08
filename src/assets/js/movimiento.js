// Movimiento del sitio. Cada efecto tiene un motivo y es corto:
// - Revelar al entrar en pantalla (solo páginas de venta y lectura, una sola vez, escalonado).
// - Cabecera que se esconde al bajar y vuelve al subir (más espacio para el contenido).
// - Inclinación leve de tarjetas y portadas al pasar el cursor (solo con mouse).
// - Cifras que cuentan, barra de lectura en las guías y celebración al pagar.
// GSAP + ScrollTrigger (cdnjs) solo agregan el paso activo de "Fórmulas claras" y el deslizamiento de carriles.
// Con prefers-reduced-motion todo queda quieto y el contenido se ve desde el inicio.

const reducido = matchMedia('(prefers-reduced-motion: reduce)');
const conMouse = matchMedia('(hover: hover) and (pointer: fine)');

export function iniciarMovimiento() {
  cabecera();
  if (reducido.matches) return;
  document.documentElement.classList.add('js-mov');
  revelar();
  contadores();
  inclinar();
  lectura();
  celebrar();
  conGsap();
}

/* ---------- revelar al entrar en pantalla ---------- */
// Páginas funcionales (cuenta, panel, carrito, pago) no se revelan: se usan a diario y el contenido debe estar ya.
const SELECTOR = [
  'main .h2', 'main .lead', '.tarjeta', '.resena', '.guia-card', '.objetivo', '.dato', '.garantias > div', '.combo', '.familia',
  '.ciencia-img', '.configurador-escena', '.configurador-panel', '.acordeon details', '.seo-bloque',
  '.texto-largo > p', '.texto-largo > h2', '.texto-largo > ul', '.articulo-cta', '.otras-guias', '.historia p', '.historia-con-img figure',
  '.contacto-dato', '.pie-in > *',
].join(',');
function revelar() {
  const tipo = document.body.dataset.pagina;
  if (['cuenta', 'admin', 'carrito', 'pago'].includes(tipo) || !('IntersectionObserver' in window)) return;
  const alto = innerHeight;
  // Solo lo que todavía no se ve: lo que ya está en pantalla al cargar no parpadea.
  const els = [...document.querySelectorAll(SELECTOR)].filter((el) => el.getBoundingClientRect().top > alto * 0.92);
  els.forEach((el) => el.classList.add('rv'));
  let lote = []; let pendiente = false;
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { lote.push(e.target); io.unobserve(e.target); } });
    if (lote.length && !pendiente) {
      pendiente = true;
      requestAnimationFrame(() => {
        // Escalonado de 60 ms entre los que entran juntos, ordenados como se leen.
        lote.sort((a, b) => { const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect(); return ra.top - rb.top || ra.left - rb.left; })
          .forEach((el, i) => { el.style.setProperty('--rv', `${Math.min(i, 6) * 60}ms`); el.classList.add('visto'); });
        lote = []; pendiente = false;
      });
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach((el) => io.observe(el));
  // Lo que se agrega después (resultados de búsqueda, productos nuevos) entra con su propia transición CSS.
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
    const paso = (t) => { const u = Math.min(1, (t - t0) / 1100); el.textContent = Math.round(fin * (1 - (1 - u) ** 3)); if (u < 1) requestAnimationFrame(paso); };
    requestAnimationFrame(paso);
  }), { threshold: 0.6 });
  els.forEach((el) => { if (el.getBoundingClientRect().top > innerHeight) { el.textContent = '0'; io.observe(el); } });
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

/* ---------- GSAP: paso activo y carriles ---------- */
function conGsap() {
  const pasos = [...document.querySelectorAll('[data-paso]')];
  const g = window.gsap; const ST = window.ScrollTrigger;
  if (!g || !ST) {
    if (!pasos.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('activo', e.isIntersecting)), { rootMargin: '-38% 0px -38% 0px' });
    pasos.forEach((p) => io.observe(p));
    return;
  }
  g.registerPlugin(ST);
  pasos.forEach((el) => ST.create({ trigger: el, start: 'top 62%', end: 'bottom 38%', onToggle: (s) => el.classList.toggle('activo', s.isActive) }));
  if (innerWidth > 860) document.querySelectorAll('.carril').forEach((c) => g.fromTo(c, { x: 40 }, { x: -40, ease: 'none', scrollTrigger: { trigger: c, start: 'top bottom', end: 'bottom top', scrub: 0.6 } }));
}
