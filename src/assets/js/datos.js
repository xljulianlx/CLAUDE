// Capa de datos compartida por la tienda, la cuenta y el panel de administración.
// - Con Supabase configurado (SUPABASE_URL y SUPABASE_ANON_KEY en el build) usa la base real y su autenticación.
// - Sin configurar funciona en "modo demostración": todo se guarda solo en este navegador (localStorage).
// Referencias: https://supabase.com/docs/reference/javascript/auth-signinwithpassword
//              https://supabase.com/docs/guides/auth/social-login/auth-google
//              https://supabase.com/docs/reference/javascript/storage-from-getpublicurl

export const datos = JSON.parse(document.getElementById('catalogo').textContent);
const SB = datos.supabase || null;
export const modoDemo = !(SB && SB.url && SB.anon);
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const leerLS = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const guardarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

/* ---------- cliente Supabase (se carga solo cuando hace falta) ---------- */
let clienteP = null;
export function cliente() {
  if (modoDemo) return Promise.resolve(null);
  if (!clienteP) clienteP = import(SUPABASE_JS).then((m) => m.createClient(SB.url, SB.anon, { auth: { persistSession: true, detectSessionInUrl: true } }));
  return clienteP;
}
// Indicio rápido de sesión sin cargar la librería (para el ícono de cuenta en la cabecera).
export function haySesionGuardada() {
  if (modoDemo) return !!leerLS('halo-demo-sesion', null);
  try { return Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token')); } catch { return false; }
}

/* ---------- productos ---------- */
const DEMO_PROD = 'halo-demo-productos';
function baseDemo() {
  return datos.productos.map((p, i) => ({ slug: p.slug, nombre: p.nombre, categoria: p.categoria, precio: p.precio, porciones: p.porciones, presentacion: p.presentacion, forma: p.forma, sabores: p.sabores, resumen: p.resumen || '', imagen_url: null, visible: true, stock: [40, 8, 25, 3, 18, 0][i % 6], stock_minimo: 5, orden: i, base: true }));
}
function estadoDemo() {
  const guardado = leerLS(DEMO_PROD, null);
  if (guardado) return guardado;
  const inicial = { lista: baseDemo() }; guardarLS(DEMO_PROD, inicial); return inicial;
}
export async function productos({ todos = false } = {}) {
  if (modoDemo) { const l = estadoDemo().lista; return todos ? l : l.filter((p) => p.visible); }
  const sb = await cliente();
  const { data, error } = await sb.from('productos').select('slug,nombre,categoria,precio,porciones,presentacion,forma,sabores,resumen,imagen_url,visible,stock,stock_minimo,orden').order('orden');
  if (error) throw error;
  return todos ? data : data.filter((p) => p.visible);
}
// Lectura pública y liviana para la tienda (precio, stock, visibilidad): una petición REST, sin cargar la librería.
// Con RLS, el visitante anónimo solo recibe los productos visibles.
export async function productosPublico() {
  if (modoDemo) return productos();
  const r = await fetch(`${SB.url}/rest/v1/productos?select=slug,nombre,categoria,precio,porciones,presentacion,forma,sabores,resumen,imagen_url,visible,stock,stock_minimo,orden&order=orden.asc`, { headers: { apikey: SB.anon, Authorization: `Bearer ${SB.anon}` } });
  if (!r.ok) throw new Error(`productos ${r.status}`);
  return (await r.json()).filter((p) => p.visible);
}
// nuevo=true crea el producto; si no, solo cambia los campos enviados (precio, stock, visible…).
export async function guardarProducto(p, nuevo = false) {
  if (modoDemo) {
    if (nuevo && estadoDemo().lista.some((x) => x.slug === p.slug)) throw new Error('Ya existe un producto con esa dirección. Cambia el nombre.');
    const e = estadoDemo(); const i = e.lista.findIndex((x) => x.slug === p.slug);
    if (i >= 0) e.lista[i] = { ...e.lista[i], ...p }; else e.lista.push({ visible: true, stock: 0, stock_minimo: 5, orden: e.lista.length, sabores: [], forma: 'tarro', ...p });
    if (!guardarLS(DEMO_PROD, e)) throw new Error('El navegador no tiene espacio para guardar. Usa una imagen más pequeña.');
    return;
  }
  const sb = await cliente();
  const { slug, ...cambios } = p;
  const { error } = nuevo ? await sb.from('productos').insert(p) : await sb.from('productos').update(cambios).eq('slug', slug);
  if (error) throw new Error(error.code === '23505' ? 'Ya existe un producto con esa dirección. Cambia el nombre.' : error.message);
}
export async function eliminarProducto(slug) {
  if (modoDemo) { const e = estadoDemo(); e.lista = e.lista.filter((x) => x.slug !== slug); guardarLS(DEMO_PROD, e); return; }
  const sb = await cliente();
  const { error } = await sb.from('productos').delete().eq('slug', slug);
  if (error) throw error;
}
// Reduce la imagen en el navegador (máx. 1000 px, WebP) antes de subirla: carga más rápida y menos espacio.
export async function prepararImagen(archivo, lado = 1000) {
  const bmp = await createImageBitmap(archivo);
  const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob((b) => ok(b), 'image/webp', 0.85));
}
export async function subirImagen(archivo, slug) {
  const blob = await prepararImagen(archivo, modoDemo ? 600 : 1000);
  if (modoDemo) return new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
  const sb = await cliente(); const ruta = `${slug}/${Date.now()}.webp`;
  const { error } = await sb.storage.from('productos').upload(ruta, blob, { contentType: 'image/webp', upsert: false });
  if (error) throw error;
  return sb.storage.from('productos').getPublicUrl(ruta).data.publicUrl;
}

/* ---------- sesión ---------- */
const DEMO_SES = 'halo-demo-sesion'; const DEMO_USR = 'halo-demo-usuarios';
export const DEMO_ADMIN = { email: 'admin@halo.example', clave: 'demo1234' };
async function huella(t) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }

export async function sesion() {
  if (modoDemo) return leerLS(DEMO_SES, null);
  const sb = await cliente(); const { data } = await sb.auth.getSession();
  return data.session ? { email: data.session.user.email, nombre: data.session.user.user_metadata?.full_name || '', token: data.session.access_token } : null;
}
export async function entrar(email, clave) {
  email = email.trim().toLowerCase();
  if (modoDemo) {
    const usuarios = leerLS(DEMO_USR, {});
    const ok = (email === DEMO_ADMIN.email && clave === DEMO_ADMIN.clave) || (usuarios[email] && usuarios[email] === await huella(clave));
    if (!ok) throw new Error('El correo o la contraseña no coinciden.');
    guardarLS(DEMO_SES, { email, nombre: '' }); return;
  }
  const sb = await cliente(); const { error } = await sb.auth.signInWithPassword({ email, password: clave });
  if (error) throw new Error('El correo o la contraseña no coinciden.');
}
export async function registrar(email, clave, nombre) {
  email = email.trim().toLowerCase();
  if (modoDemo) {
    const usuarios = leerLS(DEMO_USR, {});
    if (usuarios[email] || email === DEMO_ADMIN.email) throw new Error('Ese correo ya tiene una cuenta. Inicia sesión.');
    usuarios[email] = await huella(clave); guardarLS(DEMO_USR, usuarios); guardarLS(DEMO_SES, { email, nombre }); return { confirmar: false };
  }
  const sb = await cliente();
  const { data, error } = await sb.auth.signUp({ email, password: clave, options: { data: { full_name: nombre }, emailRedirectTo: `${location.origin}${location.pathname}` } });
  if (error) throw new Error(error.message);
  return { confirmar: !data.session };
}
export async function entrarCon(proveedor) {
  if (modoDemo) throw new Error(`El acceso con ${proveedor === 'google' ? 'Google' : 'Facebook'} se activa al conectar Supabase. En esta demostración usa correo y contraseña.`);
  const sb = await cliente();
  const { error } = await sb.auth.signInWithOAuth({ provider: proveedor, options: { redirectTo: `${location.origin}${location.pathname}` } });
  if (error) throw new Error(error.message);
}
export async function recuperarClave(email) {
  if (modoDemo) throw new Error('En la demostración no se envían correos. La cuenta de administrador de prueba es admin@halo.example con la clave demo1234.');
  const sb = await cliente(); const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}${location.pathname}` });
  if (error) throw new Error(error.message);
}
export async function cambiarClave(nueva) {
  if (modoDemo) throw new Error('En la demostración no se cambian contraseñas.');
  const sb = await cliente(); const { error } = await sb.auth.updateUser({ password: nueva });
  if (error) throw new Error(error.message);
}
// Avisa cuando Supabase detecta que el usuario llegó desde el enlace de "recuperar contraseña".
export async function alRecuperar(fn) {
  if (modoDemo) return;
  const sb = await cliente(); sb.auth.onAuthStateChange((evento) => { if (evento === 'PASSWORD_RECOVERY') fn(); });
}
export async function salir() {
  if (modoDemo) { try { localStorage.removeItem(DEMO_SES); } catch { /* nada */ } return; }
  const sb = await cliente(); await sb.auth.signOut();
}
export async function esAdmin() {
  const s = await sesion(); if (!s) return false;
  if (modoDemo) return s.email === DEMO_ADMIN.email;
  const sb = await cliente(); const { data, error } = await sb.rpc('es_admin');
  return !error && data === true;
}

/* ---------- pedidos ---------- */
const DEMO_PED = 'halo-demo-pedidos-v2';
// Historial de ejemplo (unos 90 días) para que el panel tenga gráficas con sentido. Siempre igual (semilla fija).
function pedidosEjemplo() {
  const P = datos.productos; const ahora = Date.now(); const dia = 864e5;
  let semilla = 42; const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  const nombres = ['Camila Restrepo', 'Andrés Moreno', 'Laura Peñaloza', 'Julián Ospina', 'Valentina Rojas', 'Mateo Castaño', 'Daniela Vélez', 'Santiago Gil', 'Mariana Duque', 'Felipe Cárdenas', 'Sara Montoya', 'Tomás Arango', 'Isabella Cruz', 'Samuel Pardo', 'Luciana Mejía', 'Nicolás Ríos'];
  const peso = [9, 6, 5, 3, 4, 2]; // whey y creatina se venden más
  const elegir = () => { let r = azar() * peso.reduce((a, b) => a + b, 0); for (let i = 0; i < P.length; i++) { r -= peso[i] || 1; if (r <= 0) return P[i]; } return P[0]; };
  const lista = []; let n = 0;
  for (let d = 89; d >= 0; d--) {
    const finde = new Date(ahora - d * dia).getDay() % 6 === 0;
    const cuantos = Math.floor(azar() * (finde ? 3 : 2.2) + (d < 30 ? 0.6 : 0.2));
    for (let k = 0; k < cuantos; k++) {
      const nombre = nombres[Math.floor(azar() * nombres.length)];
      const items = []; const lineas = 1 + (azar() < 0.35 ? 1 : 0);
      for (let l = 0; l < lineas; l++) { const p = elegir(); if (items.some((x) => x.slug === p.slug)) continue; items.push({ slug: p.slug, sabor: p.sabores[Math.floor(azar() * p.sabores.length)].slug, cantidad: 1 + (azar() < 0.2 ? 1 : 0), precio: p.precio }); }
      const subtotal = items.reduce((s, it) => s + it.precio * it.cantidad, 0); const envio = subtotal >= datos.gratisDesde ? 0 : datos.envio;
      const estado = d > 6 ? (azar() < 0.05 ? 'cancelado' : 'entregado') : d > 3 ? (azar() < 0.5 ? 'enviado' : 'entregado') : d > 1 ? (azar() < 0.6 ? 'preparando' : 'enviado') : (azar() < 0.15 ? 'pendiente' : 'pagado');
      const creado = new Date(ahora - d * dia - Math.floor(azar() * 10) * 36e5).toISOString();
      lista.push({ id: `demo-${n}`, referencia: `halo-ejemplo-${1040 + n}`, creado, estado, cliente_nombre: nombre, cliente_email: `${nombre.split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@correo.example`, items, subtotal, envio, total: subtotal + envio, guia: ['enviado', 'entregado'].includes(estado) ? `INT${88123400 + n}` : '', ejemplo: true });
      n++;
    }
  }
  return lista.reverse();
}
export async function pedidos({ propios = false } = {}) {
  if (modoDemo) {
    let l = leerLS(DEMO_PED, null); if (!l) { l = pedidosEjemplo(); guardarLS(DEMO_PED, l); }
    if (propios) { const s = await sesion(); return l.filter((p) => s && p.cliente_email === s.email); }
    return l;
  }
  const sb = await cliente(); const s = await sesion();
  let q = sb.from('pedidos').select('*').order('creado', { ascending: false }).limit(500);
  if (propios && s) q = q.eq('cliente_email', s.email);
  const { data, error } = await q; if (error) throw error; return data;
}
export async function actualizarPedido(id, cambios) {
  if (modoDemo) { const l = leerLS(DEMO_PED, []); const p = l.find((x) => x.id === id); if (p) Object.assign(p, cambios); guardarLS(DEMO_PED, l); return; }
  const sb = await cliente(); const { error } = await sb.from('pedidos').update(cambios).eq('id', id); if (error) throw error;
}
// Solo demostración: registra un pago simulado y descuenta inventario, como haría el webhook real.
// r: resultado de calcularPedido (precios con combos y cupón) · comprador y envio: datos del formulario.
export async function pagoSimulado(r, comprador = {}, envioDatos = null) {
  const lista = estadoDemo();
  const items = r.lineas.map((l) => ({ slug: l.slug, sabor: l.sabor, cantidad: l.cantidad, precio: l.precioFinal }));
  const l = leerLS(DEMO_PED, null) || pedidosEjemplo();
  const pedido = { id: `demo-${Date.now()}`, referencia: `halo-${Date.now().toString(36)}`, creado: new Date().toISOString(), estado: 'pagado', cliente_nombre: [comprador.nombre, comprador.apellido].filter(Boolean).join(' '), cliente_email: comprador.email || 'cliente.demo@correo.example', cliente_telefono: comprador.celular || '', envio_datos: envioDatos, items, subtotal: r.subtotal, descuento: r.subtotal - r.productos, cupon: r.cupon?.codigo || null, envio: r.envio, total: r.total, guia: '' };
  l.unshift(pedido); guardarLS(DEMO_PED, l);
  items.forEach((it) => { const p = lista.lista.find((x) => x.slug === it.slug); if (p) p.stock = Math.max(0, p.stock - it.cantidad); });
  guardarLS(DEMO_PROD, lista);
  return pedido;
}
// Publica los cambios del catálogo en las páginas (reconstruye el sitio con el deploy hook). En demo no hace falta.
export async function publicar() {
  if (modoDemo) return { demo: true };
  const s = await sesion();
  const r = await fetch(`${datos.raiz}api/publicar`, { method: 'POST', headers: { authorization: `Bearer ${s?.token || ''}` } });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'No se pudo publicar'); return j;
}
