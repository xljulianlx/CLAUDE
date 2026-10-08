// Motor WebGL del frasco: dibuja tarro, lata, shaker o caja con raymarching y una etiqueta generada en canvas 2D.
// Lo usan la escena del sitio (frasco-escena.js) y el script que renderiza las fotos de producto (scripts/render-fotos.mjs).

export const FORMAS = { tarro: 0, lata: 1, shaker: 2, caja: 3 };

const FS = `precision highp float;
uniform vec2 R;uniform vec2 C;uniform float S;uniform vec2 A;uniform int T;uniform sampler2D uTex;uniform vec3 uBase;uniform int uSteps;
vec3 tilt(vec3 p){float c=cos(A.x),s=sin(A.x);return vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z);}
vec3 spin(vec3 p){float c=cos(A.y),s=sin(A.y);return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}
vec3 toObj(vec3 p){return spin(tilt(p));}
float sdCyl(vec3 p,float r,float hh,float rr){vec2 d=vec2(length(p.xz)-r+rr,abs(p.y)-hh+rr);return min(max(d.x,d.y),0.)+length(max(d,0.))-rr;}
float sdBox(vec3 p,vec3 b,float rr){vec3 q=abs(p)-b+rr;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-rr;}
float yoff(){if(T==0)return .17;if(T==1)return .08;if(T==2)return .22;return 0.;}
vec2 map(vec3 p){vec3 q=toObj(p);q.y+=yoff();
 if(T==0){float b=sdCyl(q,.95,.62,.05);float l=sdCyl(q-vec3(0.,.79,0.),.98,.17,.06);return b<l?vec2(b,0.):vec2(l,1.);}
 if(T==1){float b=sdCyl(q,.62,.85,.06);float l=sdCyl(q-vec3(0.,.93,0.),.52,.08,.03);return b<l?vec2(b,0.):vec2(l,1.);}
 if(T==2){float b=sdCyl(q,.6,.95,.07);float l=sdCyl(q-vec3(0.,1.07,0.),.64,.12,.04);float c=sdCyl(q-vec3(0.,1.27,0.),.34,.09,.04);float m=min(l,c);return b<m?vec2(b,0.):vec2(m,1.);}
 return vec2(sdBox(q,vec3(.95,.62,.34),.08),0.);}
vec3 nrm(vec3 p){vec2 e=vec2(.002,0.);return normalize(vec3(map(p+e.xyy).x-map(p-e.xyy).x,map(p+e.yxy).x-map(p-e.yxy).x,map(p+e.yyx).x-map(p-e.yyx).x));}
float g(float v,float m,float w){float d=(v-m)/w;return exp(-d*d);}
vec3 env(vec3 r){float y=r.y,x=r.x;vec3 c=vec3(.035,.038,.045)*(1.-y*.5);
 c+=g(y,.62,.12)*g(x,0.,.9)*2.2*vec3(1.,1.,1.02);
 c+=g(x,-.82,.07)*g(y,.1,.55)*1.6*vec3(1.,.48,.22);
 c+=g(x,.85,.06)*g(y,-.1,.5)*1.3*vec3(.82,.88,1.);
 c+=g(y,-.7,.1)*vec3(.25,.22,.2);return c;}
void main(){vec2 uv=(gl_FragCoord.xy-C)/(S*.5)*1.55;vec3 ro=vec3(0.,0.,5.2);vec3 rd=normalize(vec3(uv,-3.4));
 float bb=dot(ro,rd);float cc=dot(ro,ro)-3.9;float hh=bb*bb-cc;if(hh<0.){gl_FragColor=vec4(0.);return;}
 float t=-bb-sqrt(hh);bool hit=false;vec3 p;vec2 m;
 for(int k=0;k<90;k++){if(k>=uSteps)break;p=ro+rd*t;m=map(p);if(m.x<.0015){hit=true;break;}t+=m.x;if(t>7.4)break;}
 if(!hit){gl_FragColor=vec4(0.);return;}
 vec3 n=nrm(p);vec3 q=toObj(p);q.y+=yoff();vec3 alb=uBase;float metal=0.;
 if(m.y>.5){alb=vec3(.1,.105,.115);metal=1.;}
 else if(T<3){float h2=T==0?.62:(T==1?.85:.95);float u=atan(q.x,q.z)/6.28318+.5;float v=(q.y+h2)/(2.*h2);alb=texture2D(uTex,vec2(u,1.-clamp(v,0.,1.))).rgb;}
 else{vec3 qn=toObj(n);if(qn.z>.55){vec2 ub=vec2(q.x/1.9+.5,q.y/1.24+.5);alb=texture2D(uTex,vec2(ub.x,1.-ub.y)).rgb;}}
 vec3 V=-rd;vec3 L=normalize(vec3(.55,.8,.6));float diff=max(dot(n,L),0.);float fr=pow(1.-max(dot(n,V),0.),3.);vec3 e=env(reflect(rd,n));
 vec3 col=alb*(.36+.74*diff);float sp=pow(max(dot(reflect(-L,n),V),0.),metal>.5?60.:36.);
 col+=e*(metal*.95+.10*fr)+sp*(metal>.5?.9:.28)+vec3(1.,.45,.2)*fr*.16;
 gl_FragColor=vec4(pow(min(col,vec3(1.)),vec3(.9)),1.);}`;

export function crearRender(canvas) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  let U;
  let tex;
  try {
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr); gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    U = {}; ['R', 'C', 'S', 'A', 'T', 'uTex', 'uBase', 'uSteps'].forEach((n) => { U[n] = gl.getUniformLocation(pr, n); });
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(U.uTex, 0);
  } catch (e) {
    return null;
  }
  return {
    gl,
    setEtiqueta(c) { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); },
    // P: { cx, cy, S, giro, inclinacion, forma, base:[r,g,b], dpr, recorte, pasos }
    dibujar(P) {
      const W = canvas.width; const H = canvas.height; const d = P.dpr || 1;
      gl.viewport(0, 0, W, H); gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      if (!(P.S > 0)) return;
      if (P.recorte) {
        const half = P.S * 0.34 * d; gl.enable(gl.SCISSOR_TEST);
        gl.scissor(Math.floor(P.cx * d - half), Math.floor(H - P.cy * d - half), Math.ceil(half * 2), Math.ceil(half * 2));
      }
      gl.uniform2f(U.R, W, H); gl.uniform2f(U.C, P.cx * d, H - P.cy * d); gl.uniform1f(U.S, P.S * d);
      gl.uniform2f(U.A, P.inclinacion, P.giro); gl.uniform1i(U.T, FORMAS[P.forma] ?? 0); gl.uniform1i(U.uSteps, P.pasos || 90);
      gl.uniform3f(U.uBase, P.base[0], P.base[1], P.base[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
}

export const hexARgb = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const luz = (h) => { const c = hexARgb(h); return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; };
const FUENTE = 'Geist, Inter, system-ui, sans-serif';

function ajustar(x, texto, ancho, tam, peso) {
  let t = tam;
  do { x.font = `${peso} ${t}px ${FUENTE}`; if (x.measureText(texto).width <= ancho) break; t -= 2; } while (t > 14);
  return t;
}

// Etiqueta del envase. En cilindros la textura rodea el envase (2048x512); en la caja es solo la cara frontal (1024x512).
export function crearEtiqueta(producto, sabor, marca = 'HALO') {
  const caja = producto.forma === 'caja';
  const W = caja ? 1024 : 2048; const H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const cx = W / 2; const medio = caja ? 430 : 235; const oscuro = luz(sabor.c1) < 0.55;
  const tinta = oscuro ? '#f4f5f7' : '#121418'; const suave = oscuro ? 'rgba(244,245,247,.78)' : 'rgba(18,20,24,.72)';
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, sabor.c1); g.addColorStop(1, sabor.c2);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < H; i += 6) x.fillRect(0, i, W, 1);
  x.fillStyle = '#ef6a2f'; x.fillRect(0, H - 58, W, 14);
  x.fillStyle = 'rgba(10,11,13,.55)'; x.fillRect(0, H - 44, W, 44);
  x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.fillStyle = suave; x.font = `700 ${caja ? 34 : 30}px ${FUENTE}`;
  x.letterSpacing = '8px'; x.fillText(marca, cx, caja ? 92 : 98); x.letterSpacing = '0px';
  const palabras = producto.nombre.split(' ');
  const lineas = palabras.length > 2 ? [palabras.slice(0, Math.ceil(palabras.length / 2)).join(' '), palabras.slice(Math.ceil(palabras.length / 2)).join(' ')]
    : (palabras.length === 2 && producto.nombre.length > 12 ? palabras : [producto.nombre]);
  let tam = Math.min(caja ? 110 : 92, 330 / lineas.length);
  lineas.forEach((l) => { tam = Math.min(tam, ajustar(x, l, medio * 2, tam, 800)); });
  x.fillStyle = tinta; x.font = `800 ${tam}px ${FUENTE}`;
  const y0 = caja ? 200 : 192;
  lineas.forEach((l, i) => x.fillText(l, cx, y0 + i * tam * 1.02));
  const yy = y0 + lineas.length * tam * 1.02 + 22;
  x.fillStyle = suave; x.font = `600 ${caja ? 44 : 40}px ${FUENTE}`; x.fillText(sabor.nombre, cx, yy);
  x.font = `500 ${caja ? 32 : 28}px ${FUENTE}`; x.fillText(producto.presentacion, cx, yy + (caja ? 50 : 44));
  if (!caja) {
    [0, W - 260].forEach((ox) => {
      x.fillStyle = 'rgba(250,250,250,.94)'; x.fillRect(ox + 20, 120, 220, 250);
      x.fillStyle = '#1b1d21'; for (let r = 0; r < 10; r++) x.fillRect(ox + 36, 140 + r * 22, 90 + (r % 3) * 16, 6);
    });
  }
  return c;
}
