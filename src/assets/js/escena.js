// Escena 3D: el frasco vive en su lugar (la portada, la ficha del producto o una guía) y no viaja con el scroll.
// "Cobra vida": flota, respira, se balancea mostrando la etiqueta, sigue el puntero, da saltitos con una vuelta
// de vez en cuando y gira al tocarlo. Al cambiar de página llega volando desde donde estaba (sessionStorage).
// Solo se carga si hay WebGL, sin ahorro de datos y sin movimiento reducido (salvo que la persona lo active).
import { crearRender, crearEtiqueta, hexARgb } from './frasco-gl.js';

const CLAVE = 'halo-frasco';

export function iniciarEscena(datos) {
  const lienzo = document.getElementById('frasco-lienzo'); if (!lienzo) return;
  const ancla = document.querySelector('main [data-frasco-ancla][data-pose]'); if (!ancla) return;
  const r = crearRender(lienzo); if (!r) return;
  const P = Object.fromEntries(datos.productos.map((p) => [p.slug, p]));
  const movil = matchMedia('(max-width: 860px)').matches;
  const finoPuntero = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const dprMax = movil ? 1 : 1.5; const pasos = movil ? 64 : 90;
  let dpr = 1;
  const etiquetas = new Map();
  const etiqueta = (p, s) => { const k = `${p}|${s}`; if (!etiquetas.has(k)) etiquetas.set(k, crearEtiqueta(P[p], P[p].sabores.find((x) => x.slug === s) || P[p].sabores[0])); return etiquetas.get(k); };

  let modelo = { p: document.body.dataset.frasco, s: document.body.dataset.sabor };
  let firma = '';
  const cur = { x: 0, y: 0, h: 0 };
  const FRENTE = 0.3; const TAU = Math.PI * 2;
  let giro = FRENTE; let extra = 0; let cambio = null; let pulso = 0; let primero = true; let pintado = false;
  const t0 = performance.now(); let llegada = t0;

  try {
    const previo = JSON.parse(sessionStorage.getItem(CLAVE) || 'null');
    if (previo && Date.now() - previo.t < 5000) { Object.assign(cur, { x: previo.x, y: previo.y, h: previo.h }); giro = previo.giro; primero = false; }
  } catch { /* sin sessionStorage */ }
  // Gira hacia adelante (menos de una vuelta) hasta mostrar la etiqueta de frente.
  extra = TAU * Math.ceil((giro - FRENTE) / TAU);

  const guardar = () => { try { sessionStorage.setItem(CLAVE, JSON.stringify({ ...cur, giro, t: Date.now() })); } catch { /* nada */ } };
  addEventListener('pagehide', guardar);
  document.addEventListener('click', (e) => { const a = e.target.closest('a[href]'); if (a && a.origin === location.origin) guardar(); });

  function medir() {
    dpr = Math.min(devicePixelRatio || 1, dprMax);
    const w = Math.round(innerWidth * dpr); const h = Math.round(innerHeight * dpr);
    if (lienzo.width !== w || lienzo.height !== h) { lienzo.width = w; lienzo.height = h; }
  }
  const factorDe = () => { const seg = ancla.dataset.pose.split(';').find((x) => x.startsWith(innerWidth < 860 ? 'm:' : 'd:')) || ancla.dataset.pose; return parseFloat((seg.match(/el:([\d.]+)/) || [])[1] || '0.9'); };
  function objetivo() {
    const rc = ancla.getBoundingClientRect();
    return { x: rc.left + rc.width / 2, y: rc.top + rc.height / 2, h: Math.min(rc.height, rc.width * 1.15) * factorDe() };
  }

  // Puntero: el frasco mira un poco hacia donde está el cursor.
  const punt = { x: 0, y: 0, tx: 0, ty: 0 };
  if (finoPuntero) {
    addEventListener('pointermove', (e) => {
      punt.tx = Math.max(-1, Math.min(1, (e.clientX - cur.x) / (innerWidth * 0.45)));
      punt.ty = Math.max(-1, Math.min(1, (e.clientY - cur.y) / (innerHeight * 0.6)));
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { punt.tx = 0; punt.ty = 0; });
  }
  // Saltito con una vuelta: cada pocos segundos y al tocar el frasco.
  let salto = null; let proximoSalto = t0 + 2600;
  const saltar = (ts) => { if (salto) return; salto = { t0: ts }; extra += TAU; };
  ancla.addEventListener('click', () => { saltar(performance.now()); pulso = 1; });

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) despertar(); }).observe(ancla);

  let vivo = false;
  function cuadro(ts) {
    vivo = false;
    if (!visible || document.hidden) { r.dibujar({ S: 0 }); return; }
    const t = (ts - t0) / 1000;
    const tp = objetivo();
    if (primero) { cur.x = tp.x; cur.y = tp.y; cur.h = 0; primero = false; llegada = ts; }
    const k = ts - llegada < 1100 ? 0.12 : 0.4; // llega volando y después sigue a su lugar sin retraso
    cur.x += (tp.x - cur.x) * k; cur.y += (tp.y - cur.y) * k; cur.h += (tp.h - cur.h) * (k * 0.8);

    punt.x += (punt.tx - punt.x) * 0.06; punt.y += (punt.ty - punt.y) * 0.06;
    if (ts > proximoSalto) { saltar(ts); proximoSalto = ts + 7000 + Math.random() * 4000; }
    let dy = Math.sin(t * 1.15) * cur.h * 0.022;
    let escala = 1 + Math.sin(t * 2.3) * 0.008;
    if (salto) {
      const u = (ts - salto.t0) / 950;
      if (u >= 1) salto = null;
      else {
        dy -= Math.sin(Math.PI * Math.min(1, u * 1.1)) * cur.h * 0.09;
        if (u > 0.82) escala *= 1 - Math.sin(((u - 0.82) / 0.18) * Math.PI) * 0.035; // pequeño rebote al caer
      }
    }
    const meta = FRENTE + extra + Math.sin(t * 0.45) * 0.26 + punt.x * 0.45;
    giro += (meta - giro) * (salto ? 0.07 : 0.09);
    if (pulso > 0) { pulso = Math.max(0, pulso - 1 / 30); escala *= 1 + Math.sin(pulso * Math.PI) * 0.1; }
    if (cambio) {
      const u = (ts - cambio.t0) / 520;
      if (u >= 0.5 && !cambio.hecho) { modelo = cambio.a; cambio.hecho = true; }
      escala *= 1 - 0.55 * Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
      if (u >= 1) cambio = null;
    }
    const p = P[modelo.p];
    if (p) {
      const f = `${modelo.p}|${modelo.s}`;
      if (f !== firma) { r.setEtiqueta(etiqueta(modelo.p, modelo.s)); firma = f; }
      const sab = p.sabores.find((x) => x.slug === modelo.s) || p.sabores[0];
      const incl = 0.14 + Math.sin(t * 0.9) * 0.035 + punt.y * 0.14;
      r.dibujar({ cx: cur.x, cy: cur.y + dy, S: (cur.h * escala) / 0.485, giro, inclinacion: incl, forma: p.forma, base: hexARgb(sab.c1), dpr, recorte: true, pasos });
      if (!pintado && cur.h > 4) { pintado = true; document.documentElement.classList.add('frasco-activo'); }
    }
    despertar();
  }
  function despertar() { if (!vivo && !document.hidden) { vivo = true; requestAnimationFrame(cuadro); } }

  addEventListener('resize', () => { medir(); despertar(); });
  document.addEventListener('visibilitychange', despertar);
  document.addEventListener('frasco:sabor', (e) => {
    const a = e.detail; if (a.p === modelo.p && a.s === modelo.s) return;
    cambio = { t0: performance.now(), a, hecho: false }; extra += TAU; despertar();
  });
  document.addEventListener('carrito:agregado', () => { extra += TAU; pulso = 1; despertar(); });

  medir(); despertar();
}
