// Gráficas del panel en SVG/HTML propio (sin librerías): ligeras y nítidas en el celular.
// Reglas (skill dataviz): una sola escala por gráfica, líneas de 2 px, barras de máx. 24 px con punta redondeada,
// relleno de área al 10 %, cuadrícula de 1 px muy suave, leyenda con 2 series o más, textos con color de texto
// (nunca el de la serie), tooltip en todas, y siempre una tabla equivalente para quien no ve la gráfica.
// Paleta validada con scripts/validate_palette.js: actual #b9471a (acento), anterior #2a78d6.
// Embudo de estados: rampa ordinal azul #86b6ef → #1c5cab (validada --ordinal).

const NS = 'http://www.w3.org/2000/svg';
export const COLORES = { actual: '#b9471a', anterior: '#2a78d6', cat: ['#b9471a', '#2a78d6', '#1baf7a'], ordinal: ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab'], bien: '#0ca30c', aviso: '#fab219', critico: '#d03b3b' };
const compacto = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });
const entero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
export const cop = (n) => `$ ${entero.format(Math.round(n || 0))}`;
export const copCorto = (n) => `$ ${compacto.format(Math.round(n || 0))}`;
const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function techo(v) {
  if (v <= 0) return 1;
  const e = 10 ** Math.floor(Math.log10(v)); const f = v / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
}
const el = (t, a = {}) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); return n; };

/* ---------- minigráfica (12 puntos: atenuada, el último en el acento) ---------- */
export function sparkline(valores, { w = 120, h = 34 } = {}) {
  const max = Math.max(...valores, 1); const n = valores.length;
  const pts = valores.map((v, i) => [2 + (i * (w - 6)) / (n - 1), h - 3 - (v / max) * (h - 8)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const [ux, uy] = pts[n - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".35"/><circle cx="${ux}" cy="${uy}" r="4" fill="${COLORES.actual}" stroke="var(--surface)" stroke-width="2"/></svg>`;
}

/* ---------- ventas por día: línea actual + periodo anterior, con cruz y tooltip ---------- */
export function lineaVentas(cont, { actual, anterior, fechas }) {
  const tt = document.createElement('div'); tt.className = 'g-tt'; tt.hidden = true; cont.appendChild(tt);
  let svg = null; let idx = -1;
  function pintar() {
    svg?.remove();
    const W = Math.max(280, cont.clientWidth); const H = W < 520 ? 210 : 260; const m = { l: 52, r: 14, t: 14, b: 28 };
    const n = actual.length; const max = techo(Math.max(...actual, ...anterior, 1));
    const x = (i) => m.l + (i * (W - m.l - m.r)) / Math.max(1, n - 1); const y = (v) => H - m.b - (v / max) * (H - m.t - m.b);
    svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': `Ventas por día. Total del periodo ${cop(actual.reduce((a, b) => a + b, 0))}` });
    for (let k = 0; k <= 4; k++) {
      const v = (max * k) / 4; const yy = y(v);
      svg.append(el('line', { x1: m.l, x2: W - m.r, y1: yy, y2: yy, class: 'g-grid' }));
      const t = el('text', { x: m.l - 8, y: yy + 4, 'text-anchor': 'end', class: 'g-eje' }); t.textContent = k ? copCorto(v) : '0'; svg.append(t);
    }
    const pasoX = Math.ceil(n / (W < 520 ? 4 : 6));
    for (let i = 0; i < n; i += pasoX) { const t = el('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', class: 'g-eje' }); t.textContent = fechas[i].toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }); svg.append(t); }
    const camino = (serie) => serie.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    svg.append(el('path', { d: `${camino(actual)}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`, fill: COLORES.actual, opacity: 0.1 }));
    svg.append(el('path', { d: camino(anterior), class: 'g-linea', stroke: COLORES.anterior }));
    const linea = el('path', { d: camino(actual), class: 'g-linea', stroke: COLORES.actual }); svg.append(linea);
    // Punto y valor al final de la serie actual (una sola etiqueta directa).
    svg.append(el('circle', { cx: x(n - 1), cy: y(actual[n - 1]), r: 4, fill: COLORES.actual, class: 'g-punto' }));
    const cruz = el('line', { y1: m.t, y2: H - m.b, class: 'g-cruz', visibility: 'hidden' }); svg.append(cruz);
    const pA = el('circle', { r: 4.5, fill: COLORES.actual, class: 'g-punto', visibility: 'hidden' }); const pB = el('circle', { r: 4.5, fill: COLORES.anterior, class: 'g-punto', visibility: 'hidden' });
    svg.append(pB, pA);
    const zona = el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent', tabindex: 0, class: 'g-zona', 'aria-label': 'Recorre los días con las flechas' });
    svg.append(zona);
    const mostrar = (i) => {
      idx = Math.max(0, Math.min(n - 1, i)); const xx = x(idx);
      cruz.setAttribute('x1', xx); cruz.setAttribute('x2', xx); cruz.setAttribute('visibility', 'visible');
      pA.setAttribute('cx', xx); pA.setAttribute('cy', y(actual[idx])); pA.setAttribute('visibility', 'visible');
      pB.setAttribute('cx', xx); pB.setAttribute('cy', y(anterior[idx])); pB.setAttribute('visibility', 'visible');
      tt.replaceChildren();
      const f = document.createElement('p'); f.className = 'g-tt-f'; f.textContent = fechas[idx].toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }); tt.append(f);
      [['Este periodo', actual[idx], COLORES.actual], ['Periodo anterior', anterior[idx], COLORES.anterior]].forEach(([t, v, c]) => {
        const r = document.createElement('p'); r.className = 'g-tt-r'; const k = document.createElement('i'); k.style.background = c; const s = document.createElement('strong'); s.textContent = cop(v); const l = document.createElement('span'); l.textContent = t; r.append(k, s, l); tt.append(r);
      });
      tt.hidden = false; const ancho = tt.offsetWidth; tt.style.left = `${Math.min(W - ancho - 4, Math.max(4, xx - ancho / 2))}px`; tt.style.top = `${Math.max(0, m.t - 6)}px`;
    };
    const ocultar = () => { [cruz, pA, pB].forEach((n2) => n2.setAttribute('visibility', 'hidden')); tt.hidden = true; idx = -1; };
    const desdeX = (cx) => { const r = svg.getBoundingClientRect(); const px = ((cx - r.left) / r.width) * W; return Math.round(((px - m.l) / (W - m.l - m.r)) * (n - 1)); };
    zona.addEventListener('pointermove', (e) => mostrar(desdeX(e.clientX)));
    zona.addEventListener('pointerdown', (e) => mostrar(desdeX(e.clientX)));
    zona.addEventListener('click', (e) => mostrar(desdeX(e.clientX))); // toque en el celular
    zona.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') ocultar(); });
    zona.addEventListener('blur', () => { if (!matchMedia('(pointer: coarse)').matches) ocultar(); });
    zona.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); mostrar((idx < 0 ? n - 1 : idx) + (e.key === 'ArrowRight' ? 1 : -1)); } else if (e.key === 'Escape') ocultar(); });
    cont.prepend(svg);
    // La línea se dibuja de izquierda a derecha la primera vez.
    if (!reducido() && !cont.dataset.animada) { cont.dataset.animada = '1'; const L = linea.getTotalLength(); linea.style.strokeDasharray = L; linea.style.strokeDashoffset = L; linea.getBoundingClientRect(); linea.style.transition = 'stroke-dashoffset 1100ms cubic-bezier(0.23, 1, 0.32, 1)'; linea.style.strokeDashoffset = 0; }
  }
  pintar();
  let t; const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(pintar, 120); }); ro.observe(cont);
  return () => ro.disconnect();
}

/* ---------- calendario de ventas (13 semanas, rampa secuencial azul) ---------- */
export function calendario(dias) {
  // dias: [{ fecha: Date, total, pedidos }] de más antiguo a más reciente.
  const pasos = ['#e9ebee', '#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'];
  const max = Math.max(...dias.map((d) => d.total), 1);
  const nivel = (v) => (v <= 0 ? 0 : Math.min(5, 1 + Math.floor((v / max) * 4.999)));
  const inicio = dias[0].fecha.getDay(); // 0 = domingo
  const celdas = Array(inicio).fill('<span class="cal-v" aria-hidden="true"></span>').concat(dias.map((d) => {
    const txt = `${d.fecha.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}: ${cop(d.total)}, ${d.pedidos} ${d.pedidos === 1 ? 'pedido' : 'pedidos'}`;
    return `<span class="cal-c" style="background:${pasos[nivel(d.total)]}" title="${txt}" aria-label="${txt}" role="img"></span>`;
  }));
  return `<div class="cal" role="group" aria-label="Ventas por día, últimas 13 semanas">${celdas.join('')}</div>
  <div class="cal-ley" aria-hidden="true"><span>Menos</span>${pasos.map((c) => `<i style="background:${c}"></i>`).join('')}<span>Más</span></div>`;
}

/* ---------- barras horizontales (HTML): productos o categorías ---------- */
export function barras(filas, { color = COLORES.actual, formato = (v) => v, colores = null } = {}) {
  const max = Math.max(...filas.map((f) => f.valor), 1);
  return `<ul class="g-barras">${filas.map((f, i) => `<li>
    ${f.img ? `<img src="${f.img}" width="36" height="36" alt="" loading="lazy">` : `<i class="g-key" style="background:${colores ? colores[i % colores.length] : color}" aria-hidden="true"></i>`}
    <span class="g-b-n">${f.nombre}</span>
    <span class="g-b-pista"><span class="g-b-fill" style="--p:${((f.valor / max) * 100).toFixed(1)}%;background:${colores ? colores[i % colores.length] : color}"></span></span>
    <strong class="g-b-v">${formato(f.valor)}</strong></li>`).join('')}</ul>`;
}

/* ---------- embudo de estados (barra apilada 100 %, separaciones de 2 px) ---------- */
export function embudo(etapas) {
  // etapas: [{ nombre, valor, color, icono }]
  const total = etapas.reduce((a, e) => a + e.valor, 0) || 1;
  return `<div class="g-pila" role="img" aria-label="${etapas.map((e) => `${e.nombre}: ${e.valor}`).join(', ')}">${etapas.filter((e) => e.valor).map((e) => `<span style="flex:${e.valor};background:${e.color}" title="${e.nombre}: ${e.valor}"></span>`).join('')}</div>
  <ul class="g-ley">${etapas.map((e) => `<li><i style="background:${e.color}" aria-hidden="true"></i><span>${e.nombre}</span><strong>${e.valor}</strong><small>${Math.round((e.valor / total) * 100)} %</small></li>`).join('')}</ul>`;
}

/* ---------- medidor de inventario (estado con color + ícono + texto) ---------- */
export function medidor(stock, minimo) {
  const meta = Math.max(minimo * 4, 20); const p = Math.min(100, (stock / meta) * 100);
  const [estado, color, icono] = stock <= 0 ? ['Agotado', COLORES.critico, 'cero'] : stock <= minimo ? ['Bajo', COLORES.aviso, 'info'] : ['Bien', COLORES.bien, 'check'];
  return { estado, html: `<span class="med" aria-hidden="true"><span class="med-f" style="width:${p.toFixed(1)}%;background:${color}"></span></span><span class="med-e" style="--c:${color}"><svg class="ico" aria-hidden="true"><use href="#i-${icono}"/></svg>${estado}</span>` };
}
