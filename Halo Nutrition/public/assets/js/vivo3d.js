// Envase en 3D con la foto real del producto (portada y ficha).
// La foto de un envase cilíndrico ya es una proyección del cilindro: por cada fila se mide su silueta
// (borde izquierdo y derecho) y el shader "gira" la etiqueta alrededor de ese eje. La silueta de un cilindro
// no cambia al girar, así que la foto encaja exacta y no hace falta un modelo. Los envases planos (barra)
// giran como una lámina con perspectiva. Se muestra siempre, sin pedir permiso, y se pausa fuera de pantalla.

const tactil = matchMedia('(pointer: coarse)').matches;
const gamaBaja = tactil && ((navigator.deviceMemory && navigator.deviceMemory <= 3) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4));

const VS = `
attribute vec2 a;
uniform vec2 uTam;   // tamaño del cuadrado de la foto en coordenadas de recorte
uniform vec2 uPos;   // desplazamiento (flotar, saltar)
uniform vec2 uAplasta;
uniform float uGiroZ, uGiroPlano;
varying vec2 v;
void main() {
  v = vec2(a.x, 1.0 - a.y);
  vec2 q = a - 0.5;
  // Pivote abajo: el envase se apoya y se aplasta desde la base.
  q.y += 0.38; q *= uAplasta; q.y -= 0.38;
  float c = cos(uGiroZ), s = sin(uGiroZ);
  q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  // Envase plano: giro real alrededor del eje vertical con perspectiva.
  float x = q.x * cos(uGiroPlano); float z = q.x * sin(uGiroPlano);
  gl_Position = vec4(vec2(x, q.y) * uTam + uPos, 0.0, 1.0 + z * 0.9);
}`;

const FS = `
precision highp float;
uniform sampler2D uFoto, uPerfil;
uniform float uGiro, uPlano, uBrillo;
varying vec2 v;
void main() {
  vec4 base = texture2D(uFoto, v);
  if (uPlano > 0.5) { gl_FragColor = vec4(base.rgb * base.a, base.a); return; }
  vec4 p = texture2D(uPerfil, vec2(v.y, 0.5));
  float L = p.r + p.g / 255.0; float R = p.b + p.a / 255.0;
  float r = (R - L) * 0.5;
  if (r < 0.004) { gl_FragColor = vec4(base.rgb * base.a, base.a); return; }
  float c = (L + R) * 0.5;
  float th = asin(clamp((v.x - c) / r, -1.0, 1.0));
  float t2 = th - uGiro;
  // Lo que no sale en la foto (la parte de atrás) se completa con el borde, más oscuro, como el costado del envase.
  float atras = smoothstep(1.15, 1.55, abs(t2));
  vec4 col = texture2D(uFoto, vec2(c + sin(clamp(t2, -1.3, 1.3)) * r * 0.985, v.y));
  col.rgb *= 1.0 - 0.38 * atras;
  col.rgb *= 0.9 + 0.1 * cos(th);
  // Reflejo fijo de estudio: queda en su sitio mientras la etiqueta gira debajo.
  col.rgb += pow(max(0.0, cos(th + 0.62)), 30.0) * 0.2 * uBrillo;
  float al = base.a;
  gl_FragColor = vec4(min(col.rgb, 1.0) * al, al);
}`;

function compilar(gl, tipo, src) {
  const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

// Silueta por fila: borde izquierdo y derecho (0..1), suavizada, codificada en 16 bits (alto/bajo) en RGBA.
function perfil(img) {
  const W = Math.min(img.naturalWidth, 600); const H = Math.round(img.naturalHeight * (W / img.naturalWidth));
  const k = document.createElement('canvas'); k.width = W; k.height = H;
  const x = k.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H).data;
  const L = new Float32Array(H); const R = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    let a = -1; let b = -1; const f = y * W * 4;
    for (let i = 0; i < W; i++) if (d[f + i * 4 + 3] > 120) { a = i; break; }
    if (a >= 0) for (let i = W - 1; i >= a; i--) if (d[f + i * 4 + 3] > 120) { b = i; break; }
    L[y] = a < 0 ? 0 : a / W; R[y] = a < 0 ? 0 : (b + 1) / W;
  }
  // Mediana de 7 filas: quita dientes del recorte sin redondear las esquinas de la tapa.
  const med = (arr, y) => { const v = []; for (let j = -3; j <= 3; j++) v.push(arr[Math.min(H - 1, Math.max(0, y + j))]); v.sort((m, n) => m - n); return v[3]; };
  const out = new Uint8Array(H * 4);
  for (let y = 0; y < H; y++) {
    const l = med(L, y); const r = med(R, y);
    const lh = Math.floor(l * 255); const rh = Math.floor(r * 255);
    out[y * 4] = lh; out[y * 4 + 1] = Math.round((l * 255 - lh) * 255); out[y * 4 + 2] = rh; out[y * 4 + 3] = Math.round((r * 255 - rh) * 255);
  }
  return { out, H };
}

function cargar(src) {
  return new Promise((ok, mal) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.decoding = 'async'; i.onload = () => ok(i); i.onerror = mal; i.src = src; });
}

function montar(fig) {
  const img = fig.querySelector('img'); if (!img) return;
  const lienzo = document.createElement('canvas'); lienzo.className = 'vivo3d'; lienzo.setAttribute('aria-hidden', 'true');
  const gl = lienzo.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: 'low-power' });
  if (!gl) return;
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compilar(gl, gl.VERTEX_SHADER, VS)); gl.attachShader(prog, compilar(gl, gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  } catch { return; }
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const aLoc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(aLoc); gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  const U = Object.fromEntries(['uTam', 'uPos', 'uAplasta', 'uGiroZ', 'uGiroPlano', 'uFoto', 'uPerfil', 'uGiro', 'uPlano', 'uBrillo'].map((n) => [n, gl.getUniformLocation(prog, n)]));
  gl.uniform1i(U.uFoto, 0); gl.uniform1i(U.uPerfil, 1);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const plano = fig.dataset.forma === 'caja';
  gl.uniform1f(U.uPlano, plano ? 1 : 0); gl.uniform1f(U.uBrillo, 1);
  const texFoto = gl.createTexture(); const texPerfil = gl.createTexture();
  const ajustarTex = () => { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); };
  let listo = false;

  async function usarFoto(src) {
    const f = await cargar(src);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texFoto); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, f); ajustarTex();
    const p = perfil(f);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texPerfil);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, p.H, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, p.out);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  // La foto grande para nitidez; en celulares de gama baja, la de 600.
  const fuente = () => { const s = img.currentSrc || img.src; return gamaBaja ? s.replace(/-1000\.webp/, '-600.webp') : s.replace(/-600\.webp/, '-1000.webp'); };

  // El lienzo cubre la foto con un margen, para que el salto y el giro no se corten.
  const MARGEN = 0.14; let lado = 0; let cw = 1; let ch = 1;
  function medir() {
    const prev = img.style.animation; img.style.animation = 'none';
    const r = img.getBoundingClientRect(); const fr = fig.getBoundingClientRect(); img.style.animation = prev;
    lado = Math.min(r.width, r.height); if (!lado) return;
    const cx = r.left + r.width / 2 - fr.left; const cy = r.top + r.height / 2 - fr.top; const tam = lado * (1 + MARGEN * 2);
    Object.assign(lienzo.style, { left: `${cx - tam / 2}px`, top: `${cy - tam / 2}px`, width: `${tam}px`, height: `${tam}px` });
    const dpr = Math.min(devicePixelRatio || 1, gamaBaja ? 1.25 : tactil ? 1.75 : 2);
    cw = lienzo.width = Math.round(tam * dpr); ch = lienzo.height = Math.round(tam * dpr);
    gl.viewport(0, 0, cw, ch);
    gl.uniform2f(U.uTam, 2 / (1 + MARGEN * 2), 2 / (1 + MARGEN * 2));
  }

  // Estado del movimiento: giro automático suave + puntero/dedo + salto al tocar.
  let giro = 0; let objetivo = null; let arrastre = null; let salto = -1; let visible = true; let raf = 0; let t0 = performance.now(); let ultimo = 0;
  const amp = plano ? 0.55 : 0.42;
  function cuadro(ahora) {
    raf = 0; if (!visible || document.hidden) return;
    raf = requestAnimationFrame(cuadro);
    if (gamaBaja && ahora - ultimo < 31) return; // 30 cuadros por segundo en equipos modestos
    ultimo = ahora;
    const t = (ahora - t0) / 1000;
    const auto = Math.sin(t * 0.55) * amp;
    const meta = arrastre ? arrastre.giro : objetivo ?? auto;
    giro += (meta - giro) * (arrastre ? 0.5 : 0.06);
    let y = Math.sin(t * 1.15) * 0.022; let sx = 1; let sy = 1; let extra = 0;
    if (salto >= 0) {
      const u = (ahora - salto) / 700;
      if (u >= 1) salto = -1;
      else {
        // Se agacha, salta, cae y rebota; mientras, da medio giro de alegría.
        const sube = u < 0.18 ? 0 : Math.sin(Math.min(1, (u - 0.18) / 0.55) * Math.PI);
        y += sube * 0.13;
        const ap = u < 0.18 ? Math.sin((u / 0.18) * Math.PI) * 0.12 : u > 0.73 ? Math.sin(((u - 0.73) / 0.27) * Math.PI) * 0.09 : -sube * 0.04;
        sx = 1 + ap; sy = 1 - ap;
        extra = Math.sin(u * Math.PI) * 0.5;
      }
    }
    gl.uniform2f(U.uPos, 0, y * 2 / (1 + MARGEN * 2));
    gl.uniform2f(U.uAplasta, sx, sy);
    gl.uniform1f(U.uGiroZ, Math.sin(t * 0.9) * 0.022);
    const g = Math.max(-0.62, Math.min(0.62, giro + extra));
    gl.uniform1f(U.uGiro, plano ? 0 : g);
    gl.uniform1f(U.uGiroPlano, plano ? g : 0);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!listo) { listo = true; fig.classList.add('con-3d'); }
  }
  const arrancar = () => { if (!raf && visible && !document.hidden && lado) raf = requestAnimationFrame(cuadro); };

  // Con mouse: el envase gira hacia el cursor. Con el dedo: arrastrar de lado lo gira; tocar lo hace saltar.
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const zona = fig.closest('.hero') || fig;
    zona.addEventListener('pointermove', (e) => { const r = fig.getBoundingClientRect(); objetivo = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2)) * amp * 1.2; });
    zona.addEventListener('pointerleave', () => { objetivo = null; });
  }
  fig.addEventListener('pointerdown', (e) => { if (e.target.closest('a, button, input, label')) return; arrastre = { x: e.clientX, y: e.clientY, inicio: giro, giro, movio: false }; });
  addEventListener('pointermove', (e) => {
    if (!arrastre) return; const dx = e.clientX - arrastre.x;
    if (Math.abs(dx) > 6) arrastre.movio = true;
    arrastre.giro = Math.max(-0.62, Math.min(0.62, arrastre.inicio + (dx / (lado || 300)) * 2.2));
  }, { passive: true });
  const soltar = () => { if (!arrastre) return; const movio = arrastre.movio; arrastre = null; if (!movio) salto = performance.now(); };
  addEventListener('pointerup', soltar); addEventListener('pointercancel', () => { arrastre = null; });

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; arrancar(); }).observe(fig);
  document.addEventListener('visibilitychange', arrancar);
  new ResizeObserver(() => { medir(); arrancar(); }).observe(fig);
  lienzo.addEventListener('webglcontextlost', () => { fig.classList.remove('con-3d'); lienzo.remove(); cancelAnimationFrame(raf); visible = false; });
  // Si cambia la foto (otro sabor o foto subida en el panel), el 3D usa la nueva.
  new MutationObserver(() => { usarFoto(fuente()).catch(() => { fig.classList.remove('con-3d'); lienzo.remove(); visible = false; }); }).observe(img, { attributes: true, attributeFilter: ['src'] });

  fig.appendChild(lienzo);
  usarFoto(fuente()).then(() => { medir(); t0 = performance.now(); arrancar(); }).catch(() => lienzo.remove());
}

export function iniciar() {
  document.querySelectorAll('[data-vivo]').forEach((fig) => { try { montar(fig); } catch { /* se queda la foto animada en CSS */ } });
}
