// Escena 3D persistente: un frasco que gira con el scroll, se ubica en los "anclajes" [data-pose] de cada
// página y, al navegar, retoma su posición en la página siguiente (sessionStorage) para que el recorrido sea continuo.
// Solo se carga si hay WebGL, sin ahorro de datos y sin movimiento reducido. En móvil baja resolución y pasos.
import { crearRender, crearEtiqueta, hexARgb } from './frasco-gl.js';

const CLAVE = 'halo-frasco';

export function iniciarEscena(datos) {
  const lienzo = document.getElementById('frasco-lienzo'); if (!lienzo) return;
  const r = crearRender(lienzo); if (!r) return;
  const P = Object.fromEntries(datos.productos.map((p) => [p.slug, p]));
  const movil = matchMedia('(max-width: 860px)').matches;
  const dprMax = movil ? 1 : 1.5; const pasos = movil ? 64 : 90;
  let dpr = 1;
  const etiquetas = new Map();
  const etiqueta = (p, s) => { const k = `${p}|${s}`; if (!etiquetas.has(k)) etiquetas.set(k, crearEtiqueta(P[p], P[p].sabores.find((x) => x.slug === s) || P[p].sabores[0])); return etiquetas.get(k); };

  let modelo = { p: document.body.dataset.frasco, s: document.body.dataset.sabor };
  let firma = '';
  const cur = { x: 0, y: 0, h: 0 };
  let giro = 0; let impulso = 0; let extra = 0; let cambio = null; let pulso = 0; let primero = true; let vivo = false; let pintado = false;

  try {
    const previo = JSON.parse(sessionStorage.getItem(CLAVE) || 'null');
    if (previo && Date.now() - previo.t < 5000) { Object.assign(cur, { x: previo.x, y: previo.y, h: previo.h }); giro = previo.giro; primero = false; }
  } catch { /* sin sessionStorage */ }

  // La etiqueta mira al frente cuando el giro vale FRENTE (mod 2π). Al llegar a una página, el frasco sigue
  // girando hacia adelante desde donde venía hasta mostrar la etiqueta.
  const FRENTE = 0.3; const K = 0.0042; const TAU = Math.PI * 2;
  const alFrente = giro + ((((FRENTE - giro) % TAU) + TAU) % TAU);
  impulso = alFrente - scrollY * K;
  // Si la página marca una parada final [data-pose-final], el giro se reparte entre el inicio y esa parada:
  // VUELTAS vueltas completas que terminan con la etiqueta de frente justo cuando el frasco llega.
  const VUELTAS = 2;
  const giroMeta = () => {
    const fin = document.querySelector('main [data-pose-final]');
    if (!fin) return scrollY * K + impulso + extra;
    const r = fin.getBoundingClientRect();
    const llegada = Math.max(1, r.top + scrollY + r.height / 2 - (64 + innerHeight) / 2);
    const p = Math.min(1, Math.max(0, scrollY / llegada));
    return alFrente + TAU * VUELTAS * p + extra;
  };
  const guardar = () => { try { sessionStorage.setItem(CLAVE, JSON.stringify({ ...cur, giro, t: Date.now() })); } catch { /* nada */ } };
  addEventListener('pagehide', guardar);
  document.addEventListener('click', (e) => { const a = e.target.closest('a[href]'); if (a && a.origin === location.origin) guardar(); });

  function medir() {
    dpr = Math.min(devicePixelRatio || 1, dprMax);
    const w = Math.round(innerWidth * dpr); const h = Math.round(innerHeight * dpr);
    if (lienzo.width !== w || lienzo.height !== h) { lienzo.width = w; lienzo.height = h; }
  }

  function pose(el) {
    let s = el._pose;
    if (!s) { s = {}; el.dataset.pose.split(';').forEach((seg) => { const i = seg.indexOf(':'); s[seg.slice(0, i)] = seg.slice(i + 1); }); el._pose = s; }
    const v = innerWidth < 860 && s.m ? s.m : s.d; const rc = el.getBoundingClientRect();
    let o;
    if (v === 'off') { o = { x: innerWidth / 2, y: rc.top + rc.height / 2, h: 0 }; }
    else if (v.startsWith('el')) { const f = parseFloat(v.split(':')[1] || '0.9'); o = { x: rc.left + rc.width / 2, y: rc.top + rc.height / 2, h: Math.min(rc.height, rc.width * 1.15) * f }; }
    else { const a = v.split(',').map(Number); o = { x: a[0] * innerWidth, y: a[1] * innerHeight, h: a[2] * innerHeight }; }
    o.c = rc.top + rc.height / 2; o.ok = rc.height > 0 || rc.width > 0;
    return o;
  }
  function objetivo() {
    const l = [...document.querySelectorAll('main [data-pose]')].map(pose).filter((o) => o.ok).sort((a, b) => a.c - b.c);
    if (!l.length) return null;
    const vc = (64 + innerHeight) / 2;
    if (l.length === 1 || vc <= l[0].c) return l[0];
    if (vc >= l[l.length - 1].c) return l[l.length - 1];
    for (let i = 0; i < l.length - 1; i++) {
      if (vc < l[i + 1].c) {
        let t = (vc - l[i].c) / (l[i + 1].c - l[i].c); t = t * t * (3 - 2 * t);
        // En pantallas angostas no hay columnas libres: el frasco se encoge al viajar para no tapar texto.
        const viaje = innerWidth < 860 ? 1 - Math.sin(Math.PI * t) : 1;
        return { x: l[i].x + (l[i + 1].x - l[i].x) * t, y: l[i].y + (l[i + 1].y - l[i].y) * t, h: (l[i].h + (l[i + 1].h - l[i].h) * t) * viaje };
      }
    }
    return l[0];
  }

  function cuadro(ts) {
    vivo = false;
    const tp = objetivo(); let mueve = false;
    if (tp) {
      if (primero) { cur.x = tp.x; cur.y = tp.y; cur.h = 0; primero = false; }
      const dx = tp.x - cur.x; const dy = tp.y - cur.y; const dh = tp.h - cur.h;
      if (Math.abs(dx) + Math.abs(dy) + Math.abs(dh) > 0.3) { cur.x += dx * 0.14; cur.y += dy * 0.14; cur.h += dh * 0.14; mueve = true; }
    }
    const meta = giroMeta(); const dg = meta - giro;
    if (Math.abs(dg) > 0.0005) { giro += dg * 0.12; mueve = true; }
    let escala = 1;
    if (pulso > 0) { pulso = Math.max(0, pulso - 1 / 30); escala *= 1 + Math.sin(pulso * Math.PI) * 0.1; mueve = true; }
    if (cambio) {
      const u = (ts - cambio.t0) / 520;
      if (u >= 0.5 && !cambio.hecho) { modelo = cambio.a; cambio.hecho = true; }
      escala *= 1 - 0.55 * Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
      if (u >= 1) cambio = null; mueve = true;
    }
    const p = P[modelo.p];
    if (p && (mueve || !pintado)) {
      const f = `${modelo.p}|${modelo.s}`;
      if (f !== firma) { r.setEtiqueta(etiqueta(modelo.p, modelo.s)); firma = f; }
      const sab = p.sabores.find((x) => x.slug === modelo.s) || p.sabores[0];
      r.dibujar({ cx: cur.x, cy: cur.y, S: (cur.h * escala) / 0.485, giro, inclinacion: 0.16 + Math.sin(giro * 0.5) * 0.05, forma: p.forma, base: hexARgb(sab.c1), dpr, recorte: true, pasos });
      if (!pintado && cur.h > 4) { pintado = true; document.documentElement.classList.add('frasco-activo'); }
    }
    if (mueve) despertar();
  }
  function despertar() { if (!vivo && !document.hidden) { vivo = true; requestAnimationFrame(cuadro); } }

  // Despertadores: scroll (ScrollTrigger si está, si no un listener pasivo), tamaño, eventos de la tienda.
  if (window.ScrollTrigger) window.ScrollTrigger.create({ start: 0, end: 'max', onUpdate: despertar });
  else addEventListener('scroll', despertar, { passive: true });
  addEventListener('resize', () => { medir(); despertar(); });
  document.addEventListener('visibilitychange', despertar);
  document.addEventListener('frasco:sabor', (e) => {
    const a = e.detail; if (a.p === modelo.p && a.s === modelo.s) return;
    cambio = { t0: performance.now(), a, hecho: false }; extra += TAU; despertar();
  });
  document.addEventListener('frasco:giro', () => { if (!document.querySelector('main [data-pose-final]')) { extra += TAU; despertar(); } });
  document.addEventListener('carrito:agregado', () => { extra += TAU; pulso = 1; despertar(); });

  medir(); despertar();
}
