// Auditoría automática del sitio generado: SEO, accesibilidad (WCAG 2.2 AA básico), rendimiento y enlaces.
// Uso: servir public/ (p. ej. npx http-server public -p 8090) y luego: node scripts/auditar.cjs http://127.0.0.1:8090
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8090';

(async () => {
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const rutas = [...sitemap.matchAll(/<loc>[^<]*?(\/[^<]*)<\/loc>/g)].map((m) => new URL(m[1], 'http://x').pathname);
  const extra = ['/carrito/', '/pago/exito/', '/404.html', '/buscar/', '/buscar/?q=proteina', '/cuenta/', '/admin/'];
  const problemas = []; const titulos = new Map(); const descs = new Map(); const enlaces = new Set();
  const anotar = (ruta, tipo, msg) => problemas.push({ ruta, tipo, msg });

  for (const [modo, viewport] of [['escritorio', { width: 1440, height: 900 }], ['movil', { width: 390, height: 844 }]]) {
    for (const ruta of [...rutas, ...extra]) {
      const ctx = await nav.newContext({ viewport, colorScheme: modo === 'movil' ? 'light' : 'dark' });
      const p = await ctx.newPage();
      const errores = [];
      p.on('pageerror', (e) => errores.push(e.message));
      await p.addInitScript(() => {
        window.__lcp = 0; window.__cls = 0;
        new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
      });
      const r = await p.goto(BASE + ruta, { waitUntil: 'load' });
      await p.waitForTimeout(1200);
      if (!r.ok() && ruta !== '/404.html') anotar(ruta, 'enlaces', `HTTP ${r.status()}`);
      errores.forEach((e) => anotar(ruta, 'js', e));
      const d = await p.evaluate(() => {
        const q = (s) => [...document.querySelectorAll(s)];
        const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden],[inert]'); };
        const nombre = (el) => (el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent) || el.textContent || el.querySelector('img')?.alt || el.title || '').trim();
        const lum = (c) => { let m = c.match(/[\d.]+/g).map(Number); if (c.startsWith('color(')) m = m.map((v, i) => (i < 3 ? v * 255 : v)); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
        const fondo = (el) => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none' && e !== document.body && e !== document.documentElement) return null; const b = cs.backgroundColor; const a = (b.match(/[\d.]+/g) || [])[3]; if (b !== 'transparent' && !(a !== undefined && +a < 0.9)) return b; } return getComputedStyle(document.body).backgroundColor; };
        const contraste = [];
        q('main *, header *, footer *').filter((el) => vis(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).forEach((el) => {
          const cs = getComputedStyle(el); const bg = fondo(el); if (!bg || +cs.opacity < 1) return;
          const a = lum(cs.color); const b = lum(bg); const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          const grande = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
          if (ratio < (grande ? 3 : 4.5)) contraste.push(`${ratio.toFixed(2)} "${el.textContent.trim().slice(0, 40)}"`);
        });
        const ids = q('[id]').map((e) => e.id); const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
        const hs = q('h1,h2,h3,h4').filter(vis).map((h) => +h.tagName[1]); const saltos = hs.filter((n, i) => i && n > hs[i - 1] + 1);
        const objetivos = q('a, button, input, select, summary').filter((el) => vis(el) && !el.closest('p, li > p') && !(el.tagName === 'A' && el.closest('p, .migas, figcaption'))).filter((el) => { const r = el.getBoundingClientRect(); return r.width < 24 || r.height < 24; }).map((el) => `${el.tagName} "${nombre(el).slice(0, 30)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
        const ld = q('script[type="application/ld+json"]').map((s) => { try { return JSON.parse(s.textContent)['@type']; } catch { return 'INVALIDO'; } });
        const recursos = performance.getEntriesByType('resource');
        return {
          title: document.title, desc: document.querySelector('meta[name="description"]')?.content || '', canon: document.querySelector('link[rel="canonical"]')?.href || '',
          robots: document.querySelector('meta[name="robots"]')?.content || '', lang: document.documentElement.lang, h1: q('h1').length, saltos, dup,
          sinAlt: q('img').filter((i) => !i.hasAttribute('alt')).length, sinDim: q('img').filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).length,
          lazyMal: q('img[loading="lazy"]').filter((i) => i.getBoundingClientRect().top < innerHeight && vis(i)).length,
          sinNombre: q('a, button').filter((e) => vis(e) && !nombre(e)).map((e) => e.outerHTML.slice(0, 80)),
          sinLabel: q('input:not([type=hidden]), select, textarea').filter((i) => !(i.labels && i.labels.length) && !i.getAttribute('aria-label')).map((i) => i.id || i.name),
          contraste: contraste.slice(0, 6), objetivos: objetivos.slice(0, 6), ld,
          enlaces: q('a[href]').map((a) => a.href).filter((h) => h.startsWith(location.origin)),
          lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(3), peso: Math.round(recursos.reduce((n, r) => n + (r.transferSize || r.encodedBodySize || 0), 0) / 1024), peticiones: recursos.length,
          dom: document.getElementsByTagName('*').length, overflow: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      const indexable = !d.robots.includes('noindex');
      if (modo === 'escritorio') {
        if (indexable) {
          if (d.title.length < 25 || d.title.length > 65) anotar(ruta, 'seo', `title de ${d.title.length} caracteres: "${d.title}"`);
          if (d.desc.length < 70 || d.desc.length > 160) anotar(ruta, 'seo', `meta description de ${d.desc.length} caracteres`);
          if (!d.canon) anotar(ruta, 'seo', 'sin canonical');
          if (titulos.has(d.title)) anotar(ruta, 'seo', `title duplicado con ${titulos.get(d.title)}`); titulos.set(d.title, ruta);
          if (descs.has(d.desc)) anotar(ruta, 'seo', `description duplicada con ${descs.get(d.desc)}`); descs.set(d.desc, ruta);
          if (d.ld.includes('INVALIDO')) anotar(ruta, 'seo', 'JSON-LD inválido');
          if (ruta.startsWith('/productos/') && !d.ld.includes('Product')) anotar(ruta, 'seo', 'falta Product en JSON-LD');
        }
        if (d.h1 !== 1) anotar(ruta, 'a11y', `${d.h1} elementos h1`);
        if (d.lang !== 'es-CO') anotar(ruta, 'a11y', 'lang incorrecto');
        d.enlaces.forEach((e) => enlaces.add(e.split('#')[0]));
      }
      if (d.saltos.length) anotar(ruta, 'a11y', `salto de encabezados: ${d.saltos.join(',')}`);
      if (d.dup.length) anotar(ruta, 'a11y', `ids duplicados: ${[...new Set(d.dup)].join(', ')}`);
      if (d.sinAlt) anotar(ruta, 'a11y', `${d.sinAlt} imágenes sin alt`);
      if (d.sinNombre.length) anotar(ruta, 'a11y', `controles sin nombre: ${d.sinNombre.join(' | ')}`);
      if (d.sinLabel.length) anotar(ruta, 'a11y', `campos sin etiqueta: ${d.sinLabel.join(', ')}`);
      d.contraste.forEach((c) => anotar(ruta, `contraste-${modo}`, c));
      d.objetivos.forEach((o) => anotar(ruta, `tamano-objetivo-${modo}`, o));
      if (d.sinDim) anotar(ruta, 'rendimiento', `${d.sinDim} imágenes sin width/height`);
      if (d.lazyMal) anotar(ruta, 'rendimiento', `${d.lazyMal} imágenes visibles al cargar con loading=lazy`);
      if (d.cls > 0.1) anotar(ruta, 'rendimiento', `CLS ${d.cls} (${modo})`);
      if (d.overflow) anotar(ruta, 'movil', `scroll horizontal (${modo})`);
      console.log(`${modo.padEnd(10)} ${ruta.padEnd(40)} LCP ${String(d.lcp).padStart(5)} ms  CLS ${d.cls}  ${String(d.peso).padStart(5)} KB  ${d.peticiones} pet.  DOM ${d.dom}`);
      await ctx.close();
    }
  }
  for (const e of enlaces) { const r = await fetch(e); if (!r.ok) anotar(new URL(e).pathname, 'enlaces', `enlace roto ${r.status}`); }
  for (const f of ['/robots.txt', '/sitemap.xml']) { const r = await fetch(BASE + f); if (!r.ok) anotar(f, 'seo', 'no existe'); }
  await nav.close();
  console.log(`\n${problemas.length} hallazgos`);
  const porTipo = {}; problemas.forEach((x) => { (porTipo[x.tipo] = porTipo[x.tipo] || []).push(x); });
  Object.entries(porTipo).forEach(([t, l]) => { console.log(`\n[${t}] ${l.length}`); l.slice(0, 12).forEach((x) => console.log(`  ${x.ruta}: ${x.msg}`)); });
})();
