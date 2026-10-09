// Genera supabase/semilla.sql con los productos de src/data/catalogo.mjs para cargarlos en Supabase.
// Uso: node scripts/semilla-sql.mjs   (luego pegar el archivo en el editor SQL de Supabase)
import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { productos } from '../src/data/catalogo.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const txt = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const js = (v) => (v == null ? 'null' : `${txt(JSON.stringify(v))}::jsonb`);
const arr = (a) => `array[${a.map(txt).join(', ')}]::text[]`;

const filas = productos.map((p, i) => `(${[
  txt(p.slug), txt(p.nombre), txt(p.categoria), p.precio, p.porciones ?? 'null', txt(p.forma), txt(p.presentacion),
  txt(p.resumen), txt(p.descripcion), js(p.beneficios), js(p.datos), js(p.nutricion), txt(p.uso), arr(p.palabrasClave),
  js(p.sabores), js(p.faq), 'true', 40, 5, i,
].join(', ')})`);

const sql = `-- Productos iniciales (generado desde src/data/catalogo.mjs). Stock inicial de ejemplo: 40 unidades.
insert into public.productos (slug, nombre, categoria, precio, porciones, forma, presentacion, resumen, descripcion,
  beneficios, datos, nutricion, uso, palabras_clave, sabores, faq, visible, stock, stock_minimo, orden)
values
${filas.join(',\n')}
on conflict (slug) do nothing;
`;
await writeFile(join(raiz, 'supabase/semilla.sql'), sql);
console.log(`semilla.sql con ${productos.length} productos`);
