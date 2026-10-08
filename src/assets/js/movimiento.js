// Movimiento con GSAP + ScrollTrigger (cargados desde cdnjs con defer). Si no cargan, hay una alternativa
// con IntersectionObserver para lo esencial. Todo se apaga con prefers-reduced-motion.
// Cada animación tiene un motivo: revelar en orden (narrativa), marcar el paso activo (jerarquía).

export function iniciarMovimiento() {
  contadores();
  const g = window.gsap; const ST = window.ScrollTrigger;
  const pasos = [...document.querySelectorAll('[data-paso]')];
  if (!g || !ST) { alternativa(pasos); return; }
  g.registerPlugin(ST);
  const mm = g.matchMedia();
  mm.add({ normal: '(prefers-reduced-motion: no-preference)', movil: '(max-width: 860px)' }, (ctx) => {
    const { normal, movil } = ctx.conditions;
    if (!normal) return undefined;
    document.documentElement.classList.add('js-mov');

    // Aparición escalonada de tarjetas, reseñas y bloques al entrar en pantalla (solo los que aún no se ven).
    const alto = innerHeight;
    const pendientes = [...document.querySelectorAll('[data-revelar]')].filter((el) => el.getBoundingClientRect().top > alto * 0.92);
    if (pendientes.length) {
      g.set(pendientes, { opacity: 0, y: movil ? 16 : 28 });
      ST.batch(pendientes, {
        start: 'top 90%', once: true,
        onEnter: (lote) => g.to(lote, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.07, overwrite: true }),
      });
    }

    // Sección "Fórmulas claras": resalta el dato que está en el centro y hace girar el frasco.
    pasos.forEach((el) => {
      ST.create({
        trigger: el, start: 'top 62%', end: 'bottom 38%',
        onToggle: (s) => { el.classList.toggle('activo', s.isActive); if (s.isActive) document.dispatchEvent(new CustomEvent('frasco:giro')); },
      });
    });

    // Los carriles horizontales se desplazan un poco con el scroll vertical para invitar a deslizar.
    if (!movil) {
      document.querySelectorAll('.carril').forEach((c) => {
        g.fromTo(c, { x: 40 }, { x: -40, ease: 'none', scrollTrigger: { trigger: c, start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
      });
    }

    return () => document.documentElement.classList.remove('js-mov');
  });
}

function alternativa(pasos) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window) || !pasos.length) return;
  document.documentElement.classList.add('js-mov');
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    e.target.classList.toggle('activo', e.isIntersecting);
    if (e.isIntersecting) document.dispatchEvent(new CustomEvent('frasco:giro'));
  }), { rootMargin: '-38% 0px -38% 0px' });
  pasos.forEach((p) => io.observe(p));
}

// Cifras que cuentan desde cero cuando entran en pantalla (48 h, 30 días…).
function contadores() {
  const els = [...document.querySelectorAll('[data-contar]')];
  if (!els.length || matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; io.unobserve(e.target);
    const el = e.target; const fin = +el.dataset.contar; const t0 = performance.now();
    const paso = (t) => { const u = Math.min(1, (t - t0) / 1100); el.textContent = Math.round(fin * (1 - (1 - u) ** 3)); if (u < 1) requestAnimationFrame(paso); };
    requestAnimationFrame(paso);
  }), { threshold: 0.6 });
  els.forEach((el) => { if (el.getBoundingClientRect().top > innerHeight) { el.textContent = '0'; io.observe(el); } });
}
