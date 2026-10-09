// Genera las fotos de producto (160/600/1000 px) y las imágenes de ambiente del sitio (familia, categorías, guías,
// laboratorio) a partir de los recortes de fuentes/productos/. Uso: node scripts/render-escenas.mjs (Playwright + Chromium).
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { productos } from '../src/data/catalogo.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright');
const TIPOS = { '.html': 'text/html', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try { const ruta = join(raiz, decodeURIComponent(new URL(req.url, 'http://x').pathname)); const d = await readFile(ruta); res.writeHead(200, { 'content-type': TIPOS[extname(ruta)] || 'application/octet-stream' }); res.end(d); } catch { res.writeHead(404); res.end(); }
}).listen(0);

const it = (slug, x, h, extra = {}) => ({ slug, x, h, ...extra });
const ANCHA = { w: 1600, h: 900, tamanos: [1600, 800] };
const TILE = { w: 1200, h: 900, tamanos: [1200, 600] };
const PORTADA = { w: 1200, h: 630, tamanos: [1200, 600] };
const WHEY = 'gold-standard-100-whey', CREA = 'micronized-creatine-powder', PRE = 'venom-inferno', BCAA = 'bcaa-2-1-1-watermelon-candy', BARRA = 'fit-bar-chocolate', BOTELLA = 'botella-deportiva-negra';

const escenas = {
  familia: { ...ANCHA, piso: 0.86, fondo: ['#1a1d22', '#0c0d10'], brillos: [[0.5, 0.42, 0.55, 'rgba(239,106,47,0.30)'], [0.15, 0.1, 0.4, 'rgba(120,140,170,0.18)']], aro: [0.5, 0.46, 0.3, 'rgba(239,106,47,0.22)', 0.012], reflejo: true, particulas: 70, colorParticulas: ['#ef6a2f', '#f2b443', '#ffffff'], semilla: 3,
    items: [it(BOTELLA, 0.08, 0.5, { dy: -0.03 }), it(BCAA, 0.22, 0.48, { dy: -0.03 }), it(CREA, 0.37, 0.52, { dy: -0.01 }), it(PRE, 0.66, 0.54, { dy: -0.01 }), it(WHEY, 0.51, 0.68), it(BARRA, 0.85, 0.42, { incl: 0.1, dy: -0.02 })] },
  'cat-proteinas': { ...TILE, piso: 0.88, fondo: ['#f3dcc0', '#c9925e'], brillos: [[0.62, 0.35, 0.5, 'rgba(255,240,220,0.75)']], aro: [0.5, 0.45, 0.3, 'rgba(107,63,44,0.18)', 0.02], particulas: 45, colorParticulas: ['#6b3f2c', '#fff4e4'], semilla: 11,
    items: [it(WHEY, 0.4, 0.74), it(BARRA, 0.74, 0.5, { incl: 0.12, dy: -0.01 })] },
  'cat-rendimiento': { ...TILE, piso: 0.88, fondo: ['#ffb347', '#e0461f'], brillos: [[0.45, 0.3, 0.55, 'rgba(255,236,170,0.7)']], aro: [0.52, 0.44, 0.31, 'rgba(255,255,255,0.32)', 0.02], particulas: 55, colorParticulas: ['#fff3c4', '#ffffff', '#7e1d0a'], semilla: 19,
    items: [it(BCAA, 0.2, 0.5, { dy: -0.03 }), it(PRE, 0.8, 0.52, { dy: -0.03 }), it(CREA, 0.5, 0.6)] },
  'cat-accesorios': { ...TILE, piso: 0.88, fondo: ['#5a6474', '#1b1f26'], brillos: [[0.5, 0.3, 0.5, 'rgba(200,215,235,0.4)'], [0.8, 0.8, 0.4, 'rgba(239,106,47,0.3)']], aro: [0.5, 0.42, 0.31, 'rgba(255,255,255,0.18)', 0.018], reflejo: true, particulas: 40, colorParticulas: ['#ffffff', '#ef6a2f'], semilla: 23,
    items: [it(BOTELLA, 0.5, 0.74, { incl: -0.06 })] },
  laboratorio: { w: 1000, h: 1000, tamanos: [1000, 600], piso: 0.86, fondo: ['#20242b', '#0d0f12'], cuadricula: 'rgba(255,255,255,0.05)', brillos: [[0.5, 0.45, 0.5, 'rgba(239,106,47,0.28)']], aro: [0.5, 0.5, 0.36, 'rgba(239,106,47,0.35)', 0.01], reflejo: true, particulas: 30, colorParticulas: ['#ef6a2f', '#ffffff'], semilla: 5,
    items: [it(WHEY, 0.5, 0.72)] },
  'guia-como-tomar-creatina': { ...PORTADA, piso: 0.9, fondo: ['#e4ef8a', '#6d8a1a'], brillos: [[0.6, 0.3, 0.5, 'rgba(255,255,230,0.7)']], aro: [0.6, 0.48, 0.28, 'rgba(255,255,255,0.35)', 0.016], particulas: 50, colorParticulas: ['#ffffff', '#3a4a08'], semilla: 31,
    items: [it(CREA, 0.6, 0.8)] },
  'guia-whey-isolate-o-concentrada': { ...PORTADA, piso: 0.9, fondo: ['#f6e7c8', '#b98a4e'], brillos: [[0.55, 0.3, 0.5, 'rgba(255,250,235,0.8)']], aro: [0.58, 0.46, 0.28, 'rgba(107,63,44,0.2)', 0.016], particulas: 40, colorParticulas: ['#6b3f2c', '#ffffff'], semilla: 37,
    items: [it(WHEY, 0.58, 0.84)] },
  'guia-que-es-el-pre-entreno': { ...PORTADA, piso: 0.9, fondo: ['#ff8a3d', '#b0156b'], brillos: [[0.5, 0.25, 0.55, 'rgba(255,220,150,0.6)']], aro: [0.58, 0.46, 0.3, 'rgba(255,255,255,0.3)', 0.016], particulas: 60, colorParticulas: ['#ffffff', '#ffe08a'], semilla: 41,
    items: [it(PRE, 0.6, 0.8)] },
  'guia-cuanta-proteina-necesitas': { ...PORTADA, piso: 0.9, fondo: ['#ffc2cf', '#c23a5c'], brillos: [[0.6, 0.3, 0.5, 'rgba(255,240,245,0.75)']], aro: [0.6, 0.46, 0.28, 'rgba(255,255,255,0.35)', 0.016], particulas: 45, colorParticulas: ['#ffffff', '#86203f'], semilla: 43,
    items: [it(WHEY, 0.5, 0.82), it(BARRA, 0.78, 0.5, { incl: 0.1, dy: -0.02 })] },
};

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const pg = await nav.newPage();
pg.on('pageerror', (e) => console.error('Error en la página:', e.message));
await pg.goto(`http://127.0.0.1:${server.address().port}/scripts/escenas.html`);
await pg.waitForFunction(() => window.listo !== undefined);
const fotosDir = join(raiz, 'src/assets/img/productos'); await mkdir(fotosDir, { recursive: true });
const TAM = [160, 600, 1000];
for (const p of productos) {
  const urls = await pg.evaluate(([slug, t]) => window.foto(slug, t), [p.slug, TAM]);
  await Promise.all(urls.map((u, i) => writeFile(join(fotosDir, `${p.slug}-${p.sabores[0].slug}-${TAM[i]}.webp`), Buffer.from(u.split(',')[1], 'base64'))));
  console.log('foto', p.slug);
}
const destino = join(raiz, 'src/assets/img/escenas'); await mkdir(destino, { recursive: true });
for (const [nombre, spec] of Object.entries(escenas)) {
  const urls = await pg.evaluate((s) => window.escena(s), spec);
  await Promise.all(urls.map((u, i) => writeFile(join(destino, `${nombre}-${spec.tamanos[i]}.webp`), Buffer.from(u.split(',')[1], 'base64'))));
  console.log(nombre);
}
await nav.close(); server.close();
