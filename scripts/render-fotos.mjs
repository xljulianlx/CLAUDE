// Genera las fotos WebP de cada producto y sabor con el mismo motor 3D del sitio.
// Uso: node scripts/render-fotos.mjs   (requiere Playwright y Chromium disponibles)
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { productos } from '../src/data/catalogo.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const TAMANOS = [1000, 600, 160];

const server = createServer(async (req, res) => {
  try {
    const ruta = join(raiz, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const datos = await readFile(ruta);
    res.writeHead(200, { 'content-type': TIPOS[extname(ruta)] || 'application/octet-stream' });
    res.end(datos);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const puerto = server.address().port;

const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const pagina = await navegador.newPage();
pagina.on('pageerror', (e) => console.error('Error en la página:', e.message));
await pagina.goto(`http://127.0.0.1:${puerto}/scripts/render.html`);
await pagina.waitForFunction(() => window.listo !== undefined);
if (!(await pagina.evaluate(() => window.listo))) throw new Error('WebGL no disponible');

const destino = join(raiz, 'src/assets/img/productos');
await mkdir(destino, { recursive: true });
let total = 0;
for (const p of productos) {
  for (const s of p.sabores) {
    for (const t of TAMANOS) {
      const url = await pagina.evaluate(([prod, sab, tam]) => window.renderFoto(prod, sab, tam), [p, s, t]);
      await writeFile(join(destino, `${p.slug}-${s.slug}-${t}.webp`), Buffer.from(url.split(',')[1], 'base64'));
      total++;
    }
  }
}
// Imagen para compartir en redes (OG): producto estrella sobre fondo grafito.
const og = await pagina.evaluate((prod) => {
  const fondo = document.createElement('canvas'); fondo.width = 1200; fondo.height = 630; const x = fondo.getContext('2d');
  x.fillStyle = '#0e1013'; x.fillRect(0, 0, 1200, 630);
  const img = new Image(); img.src = window.renderFoto(prod, prod.sabores[0], 600, 0.5);
  return new Promise((ok) => { img.onload = () => { x.drawImage(img, 600, 15); x.fillStyle = '#f2f3f5'; x.font = '800 76px Geist, Inter, sans-serif'; x.fillText('Más fuerza,', 70, 270); x.fillText('cero relleno.', 70, 360); x.fillStyle = '#ef6a2f'; x.font = '600 34px Geist, Inter, sans-serif'; x.fillText('Halo Nutrition', 70, 440); ok(fondo.toDataURL('image/jpeg', 0.85)); }; });
}, productos[0]);
await writeFile(join(raiz, 'src/assets/img/og-halo.jpg'), Buffer.from(og.split(',')[1], 'base64'));

await navegador.close();
server.close();
console.log(`Fotos generadas: ${total} + og-halo.jpg`);
