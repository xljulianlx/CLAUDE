// Panel de administración (/admin/). Solo para correos registrados como administradores.
// Resumen de ventas, productos (foto, precio, stock, visible, eliminar, crear) y pedidos (estado, guía, CSV).
// La seguridad real está en la base de datos (RLS): este panel solo muestra lo que el servidor permite.
import { datos, modoDemo, sesion, esAdmin, productos, guardarProducto, eliminarProducto, subirImagen, pedidos, actualizarPedido, publicar } from './datos.js';

const app = document.querySelector('[data-admin-app]');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const cop = (n) => `$ ${num.format(Math.round(n || 0))}`;
const fecha = (f) => new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
const fechaHora = (f) => new Date(f).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const PC = Object.fromEntries(datos.productos.map((p) => [p.slug, p]));
const SIN_FOTO = `${datos.assets}img/sin-foto.svg`;
const imgDe = (p) => p?.imagen_url || PC[p?.slug]?.img || SIN_FOTO;
const catNombre = (slug) => (datos.categorias || []).find((c) => c.slug === slug)?.nombre || slug;
const ESTADOS = { pendiente: 'Pago pendiente', pagado: 'Pagado', preparando: 'Preparando', enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado' };
const VENDIDOS = ['pagado', 'preparando', 'enviado', 'entregado'];
const slugDe = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

const st = { tab: 'resumen', prods: [], peds: [], filtroP: 'todos', qP: '', filtroE: 'despachar', qE: '' };
const leerSP = () => { try { return sessionStorage.getItem('halo-sin-publicar') === '1'; } catch { return false; } };
const marcarCambio = (v = true) => { try { sessionStorage.setItem('halo-sin-publicar', v ? '1' : '0'); } catch { /* nada */ } pintarPublicar(); };

let avisoT;
function avisar(msg) { const a = $('[data-aviso]'); if (!a) return; a.textContent = msg; a.classList.add('visible'); clearTimeout(avisoT); avisoT = setTimeout(() => a.classList.remove('visible'), 2400); }

/* ---------- acceso ---------- */
async function arrancar() {
  let s;
  try { s = await sesion(); } catch { app.innerHTML = '<div class="wrap"><h1 class="h1 h1-pag">Panel de administración</h1><p class="campo-error">No pudimos conectar con el servicio de cuentas.</p></div>'; return; }
  if (!s) { location.replace(`${datos.cuenta}?volver=admin`); return; }
  if (!(await esAdmin())) {
    app.innerHTML = `<div class="wrap"><h1 class="h1 h1-pag">Panel de administración</h1><p class="lead">La cuenta <strong>${esc(s.email)}</strong> no tiene permisos de administrador.</p><div class="cta"><a class="btn btn-pri" href="${datos.cuenta}">Ir a mi cuenta</a></div></div>`;
    return;
  }
  app.innerHTML = `<div class="wrap">
    <div class="admin-cab"><div><p class="eyebrow">Administración</p><h1 class="h1 h1-pag">Panel de Halo</h1></div>
      <div class="cta" style="margin-top:0"><a class="btn btn-sec btn-sm" href="${datos.tienda}">Ver la tienda</a><button class="btn btn-pri btn-sm" type="button" data-nuevo>Nuevo producto</button></div></div>
    <div data-publicar></div>
    <div class="admin-tabs" role="tablist" aria-label="Secciones del panel">
      <button type="button" role="tab" id="t-resumen" aria-controls="panel-admin" data-tab="resumen">Resumen</button>
      <button type="button" role="tab" id="t-productos" aria-controls="panel-admin" data-tab="productos">Productos</button>
      <button type="button" role="tab" id="t-pedidos" aria-controls="panel-admin" data-tab="pedidos">Pedidos<span class="n" data-n-pedidos hidden></span></button>
    </div>
    <div id="panel-admin" role="tabpanel" tabindex="-1" data-panel></div>
  </div>
  <dialog class="dialogo" data-dlg-prod aria-labelledby="dlg-prod-t"></dialog>
  <dialog class="dialogo" data-dlg-ped aria-labelledby="dlg-ped-t"></dialog>`;
  const h = location.hash.slice(1); if (['resumen', 'productos', 'pedidos'].includes(h)) st.tab = h;
  await cargar();
}
async function cargar() {
  try { [st.prods, st.peds] = await Promise.all([productos({ todos: true }), pedidos()]); }
  catch (e) { $('[data-panel]').innerHTML = `<p class="campo-error">No se pudieron cargar los datos: ${esc(e.message)}</p>`; return; }
  pintar();
}

/* ---------- estructura ---------- */
function pintarPublicar() {
  const el = $('[data-publicar]'); if (!el) return;
  if (modoDemo) { el.innerHTML = '<div class="publicar"><p><strong>Modo demostración.</strong> Los cambios se guardan en este navegador y se ven al instante en la tienda. Conecta Supabase para guardarlos de verdad.</p></div>'; return; }
  el.innerHTML = leerSP() ? '<div class="publicar"><p>Precio, stock y visibilidad ya se actualizan solos en la tienda. <strong>Publica</strong> para regenerar las páginas que lee Google (nuevos productos, fotos y textos).</p><button class="btn btn-pri btn-sm" type="button" data-publicar-ya>Publicar cambios en la web</button></div>' : '';
}
function pintar() {
  pintarPublicar();
  $$('[data-tab]').forEach((b) => { const on = b.dataset.tab === st.tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
  $('[data-panel]').setAttribute('aria-labelledby', `t-${st.tab}`);
  const porDespachar = st.peds.filter((p) => p.estado === 'pagado' || p.estado === 'preparando').length;
  const n = $('[data-n-pedidos]'); n.hidden = !porDespachar; n.textContent = porDespachar; n.setAttribute('aria-label', `${porDespachar} por despachar`);
  ({ resumen: pintarResumen, productos: pintarProductos, pedidos: pintarPedidos })[st.tab]();
}

/* ---------- resumen ---------- */
function pintarResumen() {
  const ahora = new Date(); const ini = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const vendidos = st.peds.filter((p) => VENDIDOS.includes(p.estado));
  const mes = vendidos.filter((p) => new Date(p.creado) >= ini);
  const ventasMes = mes.reduce((s, p) => s + p.total, 0);
  const ticket = vendidos.length ? vendidos.reduce((s, p) => s + p.total, 0) / vendidos.length : 0;
  const despachar = st.peds.filter((p) => p.estado === 'pagado' || p.estado === 'preparando');
  const bajos = st.prods.filter((p) => p.stock <= p.stock_minimo).sort((a, b) => a.stock - b.stock);
  const inventario = st.prods.reduce((s, p) => s + p.precio * Math.max(0, p.stock), 0);
  const unidades = {}; vendidos.forEach((p) => (p.items || []).forEach((it) => { unidades[it.slug] = (unidades[it.slug] || 0) + it.cantidad; }));
  const top = Object.entries(unidades).sort((a, b) => b[1] - a[1]).slice(0, 5); const max = top[0]?.[1] || 1;
  const nombre = (slug) => st.prods.find((p) => p.slug === slug)?.nombre || PC[slug]?.nombre || slug;
  $('[data-panel]').innerHTML = `
  <div class="kpis">
    <div class="kpi"><span>Ventas de este mes</span><strong>${cop(ventasMes)}</strong><span>${mes.length} ${mes.length === 1 ? 'pedido' : 'pedidos'}</span></div>
    <div class="kpi${despachar.length ? ' alerta' : ''}"><span>Por despachar</span><strong>${despachar.length}</strong><span>pagados sin enviar</span></div>
    <div class="kpi"><span>Ticket promedio</span><strong>${cop(ticket)}</strong><span>pedidos pagados</span></div>
    <div class="kpi${bajos.length ? ' alerta' : ''}"><span>Stock bajo o agotado</span><strong>${bajos.length}</strong><span>de ${st.prods.length} productos</span></div>
    <div class="kpi"><span>Valor del inventario</span><strong>${cop(inventario)}</strong><span>a precio de venta</span></div>
  </div>
  <div class="admin-col">
    <section class="caja" aria-labelledby="r-bajo"><h2 id="r-bajo">Inventario por reponer</h2>${bajos.length ? `<ul class="lista-simple">${bajos.map((p) => `<li><span>${esc(p.nombre)}</span><span class="estado ${p.stock <= 0 ? 'estado-cancelado' : 'estado-pagado'}">${p.stock <= 0 ? 'Agotado' : `Quedan ${p.stock}`}</span></li>`).join('')}</ul><button class="btn btn-sec btn-sm" type="button" data-ir="productos" data-filtro-p="bajo">Actualizar inventario</button>` : '<p class="nota">Todo el inventario está por encima del mínimo.</p>'}</section>
    <section class="caja" aria-labelledby="r-top"><h2 id="r-top">Más vendidos (unidades)</h2>${top.length ? `<ul class="barras">${top.map(([slug, u]) => `<li><div><span>${esc(nombre(slug))}</span><strong>${u}</strong></div><i style="--p:${(u / max).toFixed(3)}" aria-hidden="true"></i></li>`).join('')}</ul>` : '<p class="nota">Aún no hay ventas.</p>'}</section>
    <section class="caja" aria-labelledby="r-ult" style="grid-column:1/-1"><h2 id="r-ult">Últimos pedidos</h2>${st.peds.length ? `<div class="filas">${st.peds.slice(0, 5).map(filaPedido).join('')}</div><button class="btn btn-sec btn-sm" type="button" data-ir="pedidos">Ver todos los pedidos</button>` : '<p class="nota">Todavía no hay pedidos.</p>'}</section>
  </div>`;
}

/* ---------- productos ---------- */
function filaProducto(p) {
  const bajo = p.stock <= p.stock_minimo; const id = `s-${p.slug}`;
  return `<div class="fila-prod${p.visible ? '' : ' oculto'}" data-slug="${p.slug}">
    <img class="fila-img" src="${esc(imgDe(p))}" width="64" height="64" alt="" loading="lazy" decoding="async">
    <div class="fila-info"><p class="fila-nombre">${esc(p.nombre)}</p><p class="fila-meta"><span>${esc(catNombre(p.categoria))}</span>${p.visible ? '' : '<span class="estado">Oculto en la tienda</span>'}${p.stock <= 0 ? '<span class="estado estado-cancelado">Agotado</span>' : bajo ? '<span class="estado estado-pagado">Stock bajo</span>' : ''}<span class="guardado" data-guardado role="status"></span></p></div>
    <label class="mini-campo f-precio">Precio (COP)<input type="number" inputmode="numeric" min="0" step="100" value="${p.precio}" data-precio></label>
    <div class="mini-campo f-stock${bajo ? ' stock-bajo' : ''}"><label for="${id}">Stock (mín. ${p.stock_minimo})</label><div class="stock-ctrl"><button type="button" data-stock="-1" aria-label="Quitar una unidad del stock de ${esc(p.nombre)}">−</button><input id="${id}" type="number" inputmode="numeric" min="0" value="${p.stock}" data-stock-input><button type="button" data-stock="1" aria-label="Agregar una unidad al stock de ${esc(p.nombre)}">+</button></div></div>
    <div class="acciones">
      <button class="interruptor" type="button" aria-pressed="${p.visible}" data-visible aria-label="Mostrar ${esc(p.nombre)} en la tienda"><span class="sw" aria-hidden="true"></span>${p.visible ? 'Visible' : 'Oculto'}</button>
      <button class="btn-mini" type="button" data-editar>Editar</button>
      <button class="btn-mini btn-peligro" type="button" data-eliminar>Eliminar</button>
    </div>
  </div>`;
}
function pintarProductos() {
  const q = slugDe(st.qP).replace(/-/g, ' ');
  const lista = st.prods.filter((p) => (st.filtroP === 'todos' || (st.filtroP === 'visibles' && p.visible) || (st.filtroP === 'ocultos' && !p.visible) || (st.filtroP === 'bajo' && p.stock <= p.stock_minimo))
    && (!q || slugDe(`${p.nombre} ${catNombre(p.categoria)}`).replace(/-/g, ' ').includes(q)));
  const chip = (k, t) => `<button type="button" aria-pressed="${st.filtroP === k}" data-filtro-p="${k}">${t}</button>`;
  const panel = $('[data-panel]');
  const conservar = document.activeElement?.matches('[data-q-prod]');
  panel.innerHTML = `<div class="herramientas"><label class="sr" for="q-prod">Buscar en productos</label><input id="q-prod" type="search" placeholder="Buscar producto" value="${esc(st.qP)}" data-q-prod autocomplete="off"><div class="chips" role="group" aria-label="Filtrar productos">${chip('todos', `Todos (${st.prods.length})`)}${chip('visibles', 'Visibles')}${chip('ocultos', 'Ocultos')}${chip('bajo', 'Stock bajo')}</div></div>
  <div class="filas" data-filas>${lista.map(filaProducto).join('') || '<p class="nota">No hay productos con ese filtro.</p>'}</div>`;
  if (conservar) { const i = $('[data-q-prod]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}
const prodDe = (el) => st.prods.find((p) => p.slug === el.closest('[data-slug]')?.dataset.slug);
async function guardarCampos(fila, p, cambios, texto = 'Guardado') {
  const previo = { ...p }; Object.assign(p, cambios);
  const msg = $('[data-guardado]', fila);
  try { await guardarProducto({ slug: p.slug, ...cambios }); if (msg) { msg.textContent = texto; setTimeout(() => { if (msg.isConnected) msg.textContent = ''; }, 1600); } marcarCambio(); return true; }
  catch (e) { Object.assign(p, previo); avisar(`No se guardó: ${e.message}`); return false; }
}
const temporizadores = new Map();
function guardarStockLuego(fila, p, valor) {
  clearTimeout(temporizadores.get(p.slug));
  temporizadores.set(p.slug, setTimeout(async () => { if (await guardarCampos(fila, p, { stock: valor }, `Stock: ${valor}`)) { fila.querySelector('.f-stock').classList.toggle('stock-bajo', valor <= p.stock_minimo); } }, 450));
}

/* ---------- diálogo de producto ---------- */
function abrirProducto(p) {
  const nuevo = !p; p = p || { slug: '', nombre: '', categoria: datos.categorias?.[0]?.slug || '', precio: 0, stock: 0, stock_minimo: 5, presentacion: '', porciones: null, forma: 'tarro', resumen: '', descripcion: '', visible: true, imagen_url: null };
  const dlg = $('[data-dlg-prod]'); let archivo = null; let quitarFoto = false;
  dlg.innerHTML = `<form novalidate data-form-prod>
    <div class="dialogo-cab"><h2 id="dlg-prod-t">${nuevo ? 'Nuevo producto' : `Editar ${esc(p.nombre)}`}</h2><button class="btn-icono" type="button" data-cerrar-dlg aria-label="Cerrar">×</button></div>
    <div class="imagen-campo"><img src="${esc(imgDe(p))}" width="96" height="96" alt="" data-vista><div class="campo"><label for="f-img">Foto del producto</label><input id="f-img" type="file" accept="image/*" data-img><p class="campo-ayuda">JPG, PNG o WebP. Se reduce y se convierte a WebP antes de subirla.</p>${p.imagen_url ? '<button class="enlace-btn" type="button" data-quitar-foto>Quitar foto propia</button>' : ''}</div></div>
    <div class="campo"><label for="f-nombre">Nombre</label><input id="f-nombre" name="nombre" value="${esc(p.nombre)}" required maxlength="80"></div>
    ${nuevo ? '<p class="campo-ayuda" data-slug-vista></p>' : ''}
    <div class="dos"><div class="campo"><label for="f-cat">Categoría</label><select id="f-cat" name="categoria">${(datos.categorias || []).map((c) => `<option value="${c.slug}"${c.slug === p.categoria ? ' selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div>
      <div class="campo"><label for="f-precio">Precio (COP)</label><input id="f-precio" name="precio" type="number" inputmode="numeric" min="0" step="100" value="${p.precio}" required></div></div>
    <div class="dos"><div class="campo"><label for="f-stock">Stock disponible</label><input id="f-stock" name="stock" type="number" inputmode="numeric" min="0" value="${p.stock}"></div>
      <div class="campo"><label for="f-min">Avisar cuando queden</label><input id="f-min" name="stock_minimo" type="number" inputmode="numeric" min="0" value="${p.stock_minimo}"></div></div>
    <div class="dos"><div class="campo"><label for="f-pres">Presentación</label><input id="f-pres" name="presentacion" value="${esc(p.presentacion)}" placeholder="900 g, 30 porciones"></div>
      <div class="campo"><label for="f-porc">Porciones</label><input id="f-porc" name="porciones" type="number" inputmode="numeric" min="0" value="${p.porciones ?? ''}"></div></div>
    <div class="campo"><label for="f-forma">Envase (para el 3D)</label><select id="f-forma" name="forma">${[['tarro', 'Tarro'], ['lata', 'Lata'], ['shaker', 'Shaker'], ['caja', 'Caja']].map(([v, t]) => `<option value="${v}"${v === p.forma ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="campo"><label for="f-res">Resumen (se ve en la tarjeta)</label><textarea id="f-res" name="resumen" maxlength="160" rows="2">${esc(p.resumen)}</textarea></div>
    ${modoDemo && nuevo ? '' : `<div class="campo"><label for="f-desc">Descripción (página del producto y Google)</label><textarea id="f-desc" name="descripcion" rows="4">${esc(p.descripcion || '')}</textarea></div>`}
    <label class="check"><input type="checkbox" name="visible"${p.visible ? ' checked' : ''}> Visible en la tienda</label>
    <p class="campo-error" role="alert" data-error></p>
    <div class="dialogo-pie"><button class="btn btn-sec" type="button" data-cerrar-dlg>Cancelar</button><button class="btn btn-pri" type="submit">${nuevo ? 'Crear producto' : 'Guardar cambios'}</button></div>
  </form>`;
  const f = $('[data-form-prod]', dlg);
  const vistaSlug = () => { const v = $('[data-slug-vista]', dlg); if (v) v.textContent = f.elements.nombre.value ? `Dirección: /productos/${slugDe(f.elements.nombre.value)}/` : ''; };
  f.elements.nombre.addEventListener('input', vistaSlug);
  $('[data-img]', dlg).addEventListener('change', (e) => { archivo = e.target.files[0] || null; if (archivo) { quitarFoto = false; $('[data-vista]', dlg).src = URL.createObjectURL(archivo); } });
  $('[data-quitar-foto]', dlg)?.addEventListener('click', (e) => { quitarFoto = true; archivo = null; $('[data-vista]', dlg).src = PC[p.slug]?.img || SIN_FOTO; e.target.remove(); });
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const err = $('[data-error]', dlg); err.textContent = '';
    const el = f.elements; const nombre = el.nombre.value.trim(); const precio = Number(el.precio.value);
    if (!nombre) { err.textContent = 'Escribe el nombre del producto.'; el.nombre.focus(); return; }
    if (!(precio >= 0) || el.precio.value === '') { err.textContent = 'Escribe un precio válido.'; el.precio.focus(); return; }
    const slug = nuevo ? slugDe(nombre) : p.slug;
    if (!slug) { err.textContent = 'El nombre necesita letras o números.'; return; }
    const datosP = { slug, nombre, categoria: el.categoria.value, precio: Math.round(precio), stock: Math.max(0, parseInt(el.stock.value, 10) || 0), stock_minimo: Math.max(0, parseInt(el.stock_minimo.value, 10) || 0), presentacion: el.presentacion.value.trim(), porciones: parseInt(el.porciones.value, 10) || null, forma: el.forma.value, resumen: el.resumen.value.trim(), visible: el.visible.checked };
    if (el.descripcion) datosP.descripcion = el.descripcion.value.trim();
    const boton = f.querySelector('[type="submit"]'); boton.disabled = true; boton.textContent = archivo ? 'Subiendo foto…' : 'Guardando…';
    try {
      if (archivo) datosP.imagen_url = await subirImagen(archivo, slug);
      else if (quitarFoto) datosP.imagen_url = null;
      await guardarProducto(datosP, nuevo);
      if (nuevo) st.prods.push({ orden: st.prods.length, sabores: [], ...datosP }); else Object.assign(p, datosP);
      dlg.close(); marcarCambio(); avisar(nuevo ? `Creaste ${nombre}` : `Guardaste ${nombre}`);
      if (nuevo) { st.tab = 'productos'; st.filtroP = 'todos'; } pintar();
    } catch (er) { err.textContent = er.message; boton.disabled = false; boton.textContent = nuevo ? 'Crear producto' : 'Guardar cambios'; }
  });
  dlg.showModal(); f.elements.nombre.focus(); vistaSlug();
}

/* ---------- pedidos ---------- */
function filaPedido(p) {
  const n = (p.items || []).reduce((s, it) => s + it.cantidad, 0);
  return `<button class="fila-ped" type="button" data-pedido="${esc(p.id)}"><span><strong>${esc(p.cliente_nombre || p.cliente_email || 'Cliente')}</strong><span class="pedido-ref">${esc(p.referencia)}</span></span><span class="f-fecha nota">${fecha(p.creado)} · ${n} ${n === 1 ? 'unidad' : 'unidades'}</span><strong>${cop(p.total)}</strong><span class="estado estado-${p.estado}">${ESTADOS[p.estado] || esc(p.estado)}</span></button>`;
}
const filtroPedido = (p) => (st.filtroE === 'todos' || (st.filtroE === 'despachar' ? (p.estado === 'pagado' || p.estado === 'preparando') : p.estado === st.filtroE));
function pedidosFiltrados() {
  const q = st.qE.trim().toLowerCase();
  return st.peds.filter((p) => filtroPedido(p) && (!q || `${p.referencia} ${p.cliente_email} ${p.cliente_nombre} ${p.guia || ''}`.toLowerCase().includes(q)));
}
function pintarPedidos() {
  const cuenta = (k) => st.peds.filter((p) => (k === 'todos' ? true : k === 'despachar' ? p.estado === 'pagado' || p.estado === 'preparando' : p.estado === k)).length;
  const chip = (k, t) => `<button type="button" aria-pressed="${st.filtroE === k}" data-filtro-e="${k}">${t} (${cuenta(k)})</button>`;
  const lista = pedidosFiltrados();
  const conservar = document.activeElement?.matches('[data-q-ped]');
  $('[data-panel]').innerHTML = `<div class="herramientas"><label class="sr" for="q-ped">Buscar pedidos</label><input id="q-ped" type="search" placeholder="Referencia, correo, nombre o guía" value="${esc(st.qE)}" data-q-ped autocomplete="off"><button class="btn btn-sec btn-sm" type="button" data-csv>Exportar CSV</button></div>
  <div class="chips" role="group" aria-label="Filtrar por estado" style="margin-bottom:14px">${chip('despachar', 'Por despachar')}${chip('todos', 'Todos')}${Object.entries(ESTADOS).map(([k, t]) => chip(k, t)).join('')}</div>
  <div class="filas">${lista.map(filaPedido).join('') || '<p class="nota">No hay pedidos con ese filtro.</p>'}</div>
  ${modoDemo ? '<p class="nota" style="margin-top:12px">Los pedidos de ejemplo son ficticios. Los que hagas con “Simular pago” en el carrito aparecen aquí.</p>' : ''}`;
  if (conservar) { const i = $('[data-q-ped]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}
function abrirPedido(p) {
  const dlg = $('[data-dlg-ped]');
  const nombre = (it) => st.prods.find((x) => x.slug === it.slug)?.nombre || PC[it.slug]?.nombre || it.slug;
  const sabor = (it) => PC[it.slug]?.sabores?.find((s) => s.slug === it.sabor)?.nombre || '';
  dlg.innerHTML = `<form novalidate data-form-ped>
    <div class="dialogo-cab"><h2 id="dlg-ped-t">Pedido ${esc(p.referencia)}</h2><button class="btn-icono" type="button" data-cerrar-dlg aria-label="Cerrar">×</button></div>
    <p class="nota">${fechaHora(p.creado)}${p.mp_payment_id ? ` · Pago Mercado Pago ${esc(p.mp_payment_id)}` : ''}</p>
    <div class="caja"><h3>Cliente</h3><p>${esc(p.cliente_nombre || 'Sin nombre')}<br><a href="mailto:${esc(p.cliente_email)}">${esc(p.cliente_email)}</a></p></div>
    <ul class="items-ped">${(p.items || []).map((it) => `<li><img src="${esc(imgDe(st.prods.find((x) => x.slug === it.slug) || { slug: it.slug }))}" width="44" height="44" alt=""><span>${it.cantidad} × ${esc(nombre(it))}${sabor(it) ? `, ${esc(sabor(it))}` : ''}</span><strong>${cop(it.precio * it.cantidad)}</strong></li>`).join('')}</ul>
    <div><div class="fila-total"><span>Subtotal</span><span>${cop(p.subtotal)}</span></div><div class="fila-total"><span>Envío</span><span>${p.envio ? cop(p.envio) : 'Gratis'}</span></div><div class="fila-total total"><span>Total</span><span>${cop(p.total)}</span></div></div>
    <div class="dos"><div class="campo"><label for="p-estado">Estado</label><select id="p-estado" name="estado">${Object.entries(ESTADOS).map(([k, t]) => `<option value="${k}"${k === p.estado ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="campo"><label for="p-guia">Número de guía</label><input id="p-guia" name="guia" value="${esc(p.guia || '')}" autocomplete="off"></div></div>
    <div class="campo"><label for="p-notas">Notas internas</label><textarea id="p-notas" name="notas" rows="2">${esc(p.notas || '')}</textarea></div>
    <p class="campo-error" role="alert" data-error></p>
    <div class="dialogo-pie">${p.estado === 'pagado' || p.estado === 'preparando' ? '<button class="btn btn-sec" type="button" data-marcar-enviado>Marcar como enviado</button>' : '<button class="btn btn-sec" type="button" data-cerrar-dlg>Cerrar</button>'}<button class="btn btn-pri" type="submit">Guardar</button></div>
  </form>`;
  const f = $('[data-form-ped]', dlg);
  const guardar = async (cambios) => {
    const err = $('[data-error]', dlg); err.textContent = '';
    if (cambios.estado === 'enviado' && !cambios.guia) { err.textContent = 'Escribe el número de guía antes de marcarlo como enviado.'; f.elements.guia.focus(); return; }
    try { await actualizarPedido(p.id, cambios); Object.assign(p, cambios); dlg.close(); avisar(`Pedido ${p.referencia}: ${ESTADOS[p.estado]}`); pintar(); } catch (er) { err.textContent = er.message; }
  };
  const valores = () => ({ estado: f.elements.estado.value, guia: f.elements.guia.value.trim(), notas: f.elements.notas.value.trim() });
  f.addEventListener('submit', (e) => { e.preventDefault(); guardar(valores()); });
  $('[data-marcar-enviado]', dlg)?.addEventListener('click', () => guardar({ ...valores(), estado: 'enviado' }));
  dlg.showModal();
}
function exportarCSV() {
  const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const filas = [['Referencia', 'Fecha', 'Estado', 'Cliente', 'Correo', 'Productos', 'Subtotal', 'Envío', 'Total', 'Guía']]
    .concat(pedidosFiltrados().map((p) => [p.referencia, new Date(p.creado).toISOString().slice(0, 16).replace('T', ' '), ESTADOS[p.estado] || p.estado, p.cliente_nombre, p.cliente_email, (p.items || []).map((it) => `${it.cantidad}x ${PC[it.slug]?.nombre || it.slug}`).join('; '), p.subtotal, p.envio, p.total, p.guia]));
  const blob = new Blob(['﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `pedidos-halo-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- eventos ---------- */
app.addEventListener('click', async (e) => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.matches('[data-cerrar-dlg]')) { t.closest('dialog').close(); return; }
  if (t.dataset.tab) { st.tab = t.dataset.tab; history.replaceState(null, '', `#${st.tab}`); pintar(); return; }
  if (t.dataset.ir) { st.tab = t.dataset.ir; if (t.dataset.filtroP) st.filtroP = t.dataset.filtroP; history.replaceState(null, '', `#${st.tab}`); pintar(); $('[data-panel]').focus(); return; }
  if (t.matches('[data-nuevo]')) { abrirProducto(null); return; }
  if (t.matches('[data-publicar-ya]')) {
    t.disabled = true; t.textContent = 'Publicando…';
    try { await publicar(); marcarCambio(false); avisar('Listo: la web se está regenerando, tarda uno o dos minutos.'); } catch (er) { avisar(er.message); t.disabled = false; t.textContent = 'Publicar cambios en la web'; }
    return;
  }
  if (t.dataset.filtroP && st.tab === 'productos') { st.filtroP = t.dataset.filtroP; pintarProductos(); return; }
  if (t.dataset.filtroE) { st.filtroE = t.dataset.filtroE; pintarPedidos(); return; }
  if (t.matches('[data-csv]')) { exportarCSV(); return; }
  if (t.dataset.pedido) { const p = st.peds.find((x) => String(x.id) === t.dataset.pedido); if (p) abrirPedido(p); return; }
  const p = prodDe(t); if (!p) return; const fila = t.closest('[data-slug]');
  if (t.dataset.stock) {
    const inp = $('[data-stock-input]', fila); const v = Math.max(0, (parseInt(inp.value, 10) || 0) + Number(t.dataset.stock));
    inp.value = v; guardarStockLuego(fila, p, v); return;
  }
  if (t.matches('[data-visible]')) {
    const v = !p.visible;
    if (await guardarCampos(fila, p, { visible: v }, v ? 'Visible en la tienda' : 'Oculto en la tienda')) {
      t.setAttribute('aria-pressed', String(v)); t.lastChild.textContent = v ? 'Visible' : 'Oculto'; fila.classList.toggle('oculto', !v);
      avisar(v ? `${p.nombre} vuelve a verse en la tienda` : `${p.nombre} ya no se ve en la tienda`);
    }
    return;
  }
  if (t.matches('[data-editar]')) { abrirProducto(p); return; }
  if (t.matches('[data-eliminar]')) {
    // Doble toque para confirmar, sin ventanas del navegador.
    if (!t.classList.contains('confirmar')) { t.classList.add('confirmar'); t.textContent = '¿Eliminar? Toca otra vez'; setTimeout(() => { if (t.isConnected) { t.classList.remove('confirmar'); t.textContent = 'Eliminar'; } }, 4000); return; }
    try { await eliminarProducto(p.slug); st.prods = st.prods.filter((x) => x !== p); marcarCambio(); avisar(`Eliminaste ${p.nombre}`); pintar(); } catch (er) { avisar(`No se pudo eliminar: ${er.message}`); }
  }
});
app.addEventListener('change', (e) => {
  const t = e.target; const p = prodDe(t); if (!p) return; const fila = t.closest('[data-slug]');
  if (t.matches('[data-precio]')) { const v = Math.round(Number(t.value)); if (!(v >= 0) || t.value === '') { t.value = p.precio; return; } if (v !== p.precio) guardarCampos(fila, p, { precio: v }, `Precio: ${cop(v)}`); }
  if (t.matches('[data-stock-input]')) { const v = Math.max(0, parseInt(t.value, 10) || 0); t.value = v; guardarStockLuego(fila, p, v); }
});
app.addEventListener('input', (e) => {
  if (e.target.matches('[data-q-prod]')) { st.qP = e.target.value; pintarProductos(); }
  if (e.target.matches('[data-q-ped]')) { st.qE = e.target.value; pintarPedidos(); }
});
app.addEventListener('keydown', (e) => {
  const t = e.target.closest('[role="tab"]'); if (!t || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const tabs = $$('[role="tab"]', app); const i = (tabs.indexOf(t) + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[i].focus(); tabs[i].click();
});
// Cerrar el diálogo tocando el fondo.
app.addEventListener('pointerdown', (e) => { if (e.target.matches('dialog[open]')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } });

arrancar();
