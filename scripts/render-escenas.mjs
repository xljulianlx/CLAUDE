// Genera las imágenes de ambiente del sitio (familia de productos, categorías, portadas de guías, laboratorio)
// componiendo los envases 3D con fondos de estudio. Uso: node scripts/render-escenas.mjs (Playwright + Chromium).
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { productos } from '../src/data/catalogo.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const server = createServer(async (req, res) => {
  try { const ruta = join(raiz, decodeURIComponent(new URL(req.url, 'http://x').pathname)); const d = await readFile(ruta); res.writeHead(200, { 'content-type': TIPOS[extname(ruta)] || 'application/octet-stream' }); res.end(d); } catch { res.writeHead(404); res.end(); }
}).listen(0);

const P = Object.fromEntries(productos.map((p) => [p.slug, p]));
const it = (slug, sabor, x, h, extra = {}) => ({ p: P[slug], s: P[slug].sabores.find((s) => s.slug === sabor), x, h, ...extra });
const ANCHA = { w: 1600, h: 900, tamanos: [1600, 800] };
const TILE = { w: 1200, h: 900, tamanos: [1200, 600] };
const PORTADA = { w: 1200, h: 630, tamanos: [1200, 600] };

const escenas = {
  familia: { ...ANCHA, piso: 0.84, fondo: ['#1a1d22', '#0c0d10'], brillos: [[0.5, 0.42, 0.55, 'rgba(239,106,47,0.30)'], [0.15, 0.1, 0.4, 'rgba(120,140,170,0.18)']], aro: [0.5, 0.46, 0.3, 'rgba(239,106,47,0.22)', 0.012], reflejo: true, particulas: 70, colorParticulas: ['#ef6a2f', '#f2b443', '#ffffff'], semilla: 3,
    items: [it('bcaa-2-1-1', 'limonada', 0.13, 0.5, { giro: 0.5, dy: -0.04 }), it('creatina-monohidratada', 'sin-sabor', 0.3, 0.52, { giro: 0.2, dy: -0.02 }), it('pre-entreno-pulse', 'mango', 0.87, 0.5, { giro: 0.1, dy: -0.04 }), it('shaker-halo', 'naranja', 0.71, 0.56, { giro: 0.6, dy: -0.02 }), it('whey-isolate', 'chocolate', 0.5, 0.62, { giro: 0.3 }), it('barras-proteicas', 'cacao', 0.5, 0.36, { giro: 0.4, incl: 0.2, dy: 0.08 })] },
  'cat-proteinas': { ...TILE, piso: 0.86, fondo: ['#f3dcc0', '#c9925e'], brillos: [[0.62, 0.35, 0.5, 'rgba(255,240,220,0.75)']], aro: [0.58, 0.45, 0.3, 'rgba(107,63,44,0.18)', 0.02], particulas: 45, colorParticulas: ['#6b3f2c', '#fff4e4'], semilla: 11,
    items: [it('whey-isolate', 'vainilla', 0.35, 0.56, { giro: 0.9, dy: -0.05 }), it('whey-isolate', 'chocolate', 0.6, 0.7, { giro: 0.3 }), it('barras-proteicas', 'cacao', 0.83, 0.42, { giro: 0.5, incl: 0.22, dy: 0.04 })] },
  'cat-rendimiento': { ...TILE, piso: 0.86, fondo: ['#ffb347', '#e0461f'], brillos: [[0.45, 0.3, 0.55, 'rgba(255,236,170,0.7)']], aro: [0.52, 0.44, 0.31, 'rgba(255,255,255,0.32)', 0.02], particulas: 55, colorParticulas: ['#fff3c4', '#ffffff', '#7e1d0a'], semilla: 19,
    items: [it('bcaa-2-1-1', 'limonada', 0.2, 0.55, { giro: 0.7, dy: -0.04 }), it('creatina-monohidratada', 'limon', 0.5, 0.6, { giro: 0.25 }), it('pre-entreno-pulse', 'mango', 0.79, 0.62, { giro: 0.2, dy: -0.01 })] },
  'cat-accesorios': { ...TILE, piso: 0.86, fondo: ['#5a6474', '#1b1f26'], brillos: [[0.5, 0.3, 0.5, 'rgba(200,215,235,0.4)'], [0.8, 0.8, 0.4, 'rgba(239,106,47,0.3)']], aro: [0.5, 0.42, 0.31, 'rgba(255,255,255,0.18)', 0.018], reflejo: true, particulas: 40, colorParticulas: ['#ffffff', '#ef6a2f'], semilla: 23,
    items: [it('shaker-halo', 'plata', 0.25, 0.6, { giro: 0.8, dy: -0.04 }), it('shaker-halo', 'grafito', 0.75, 0.6, { giro: 0.1, dy: -0.04 }), it('shaker-halo', 'naranja', 0.5, 0.7, { giro: 0.4 })] },
  laboratorio: { w: 1000, h: 1000, tamanos: [1000, 600], piso: 0.84, fondo: ['#20242b', '#0d0f12'], cuadricula: 'rgba(255,255,255,0.05)', brillos: [[0.5, 0.45, 0.5, 'rgba(239,106,47,0.28)']], aro: [0.5, 0.5, 0.36, 'rgba(239,106,47,0.35)', 0.01], reflejo: true, particulas: 30, colorParticulas: ['#ef6a2f', '#ffffff'], semilla: 5,
    items: [it('whey-isolate', 'chocolate', 0.5, 0.72, { giro: 0.3 })] },
  'guia-como-tomar-creatina': { ...PORTADA, piso: 0.88, fondo: ['#e4ef8a', '#6d8a1a'], brillos: [[0.6, 0.3, 0.5, 'rgba(255,255,230,0.7)']], aro: [0.62, 0.48, 0.28, 'rgba(255,255,255,0.35)', 0.016], particulas: 50, colorParticulas: ['#ffffff', '#3a4a08'], semilla: 31,
    items: [it('creatina-monohidratada', 'mora', 0.45, 0.62, { giro: 0.9, dy: -0.05 }), it('creatina-monohidratada', 'limon', 0.7, 0.78, { giro: 0.3 })] },
  'guia-whey-isolate-o-concentrada': { ...PORTADA, piso: 0.88, fondo: ['#f6e7c8', '#b98a4e'], brillos: [[0.55, 0.3, 0.5, 'rgba(255,250,235,0.8)']], aro: [0.58, 0.46, 0.28, 'rgba(107,63,44,0.2)', 0.016], particulas: 40, colorParticulas: ['#6b3f2c', '#ffffff'], semilla: 37,
    items: [it('whey-isolate', 'vainilla', 0.4, 0.74, { giro: 0.6 }), it('whey-isolate', 'chocolate', 0.68, 0.74, { giro: 0.2 })] },
  'guia-que-es-el-pre-entreno': { ...PORTADA, piso: 0.88, fondo: ['#ff8a3d', '#b0156b'], brillos: [[0.5, 0.25, 0.55, 'rgba(255,220,150,0.6)']], aro: [0.55, 0.46, 0.3, 'rgba(255,255,255,0.3)', 0.016], particulas: 60, colorParticulas: ['#ffffff', '#ffe08a'], semilla: 41,
    items: [it('pre-entreno-pulse', 'uva', 0.3, 0.64, { giro: 0.7, dy: -0.04 }), it('pre-entreno-pulse', 'sandia', 0.75, 0.64, { giro: 0.0, dy: -0.04 }), it('pre-entreno-pulse', 'mango', 0.53, 0.76, { giro: 0.3 })] },
  'guia-cuanta-proteina-necesitas': { ...PORTADA, piso: 0.88, fondo: ['#ffc2cf', '#c23a5c'], brillos: [[0.6, 0.3, 0.5, 'rgba(255,240,245,0.75)']], aro: [0.6, 0.46, 0.28, 'rgba(255,255,255,0.35)', 0.016], particulas: 45, colorParticulas: ['#ffffff', '#86203f'], semilla: 43,
    items: [it('whey-isolate', 'fresa', 0.52, 0.78, { giro: 0.3 }), it('barras-proteicas', 'mani', 0.78, 0.46, { giro: 0.45, incl: 0.2, dy: 0.02 })] },
};

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await nav.newPage();
pg.on('pageerror', (e) => console.error('Error en la página:', e.message));
await pg.goto(`http://127.0.0.1:${server.address().port}/scripts/escenas.html`);
await pg.waitForFunction(() => window.listo !== undefined);
if (!(await pg.evaluate(() => window.listo))) throw new Error('WebGL no disponible');
const destino = join(raiz, 'src/assets/img/escenas'); await mkdir(destino, { recursive: true });
for (const [nombre, spec] of Object.entries(escenas)) {
  const urls = await pg.evaluate((s) => window.escena(s), spec);
  await Promise.all(urls.map((u, i) => writeFile(join(destino, `${nombre}-${spec.tamanos[i]}.webp`), Buffer.from(u.split(',')[1], 'base64'))));
  console.log(nombre);
}
await nav.close(); server.close();
