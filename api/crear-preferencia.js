// Función serverless (Vercel, Node 18+): crea una preferencia de Mercado Pago Checkout Pro y devuelve su init_point.
// Documentación seguida:
//   - Crear preferencia (POST /checkout/preferences): https://www.mercadopago.com.co/developers/es/reference/preferences/_checkout_preferences/post
//   - URLs de retorno (back_urls, auto_return): https://www.mercadopago.com.co/developers/es/docs/checkout-pro/configure-back-urls
//   - SDK Node v2 (MercadoPagoConfig + Preference): https://github.com/mercadopago/sdk-nodejs
// Antes de salir a producción, confirmar los nombres de campos contra la referencia vigente y probar con credenciales de prueba.
//
// Variables de entorno: MP_ACCESS_TOKEN (token privado, nunca en el navegador) y SITE_URL (dominio público, https).
// Con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY, los precios, la visibilidad y el stock salen de la base de datos
// y el pedido se registra como "pendiente" hasta que el webhook confirme el pago.
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { productos as catalogo, sitio } from '../src/data/catalogo.mjs';
import { hayBase, rest } from './_supabase.js';
import { calcularPedido } from '../src/assets/js/precios.js';

const SABOR_UNICO = { slug: 'unico', nombre: 'Único' };
const txt = (v, max = 120) => String(v ?? '').trim().slice(0, max);
const correoValido = (e) => typeof e === 'string' && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function cargar(slugs) {
  if (!hayBase()) return Object.fromEntries(catalogo.map((p) => [p.slug, { ...p, visible: true, stock: null }]));
  const lista = slugs.map((s) => encodeURIComponent(s)).join(',');
  const filas = await rest(`productos?select=slug,nombre,precio,sabores,visible,stock&slug=in.(${lista})`);
  return Object.fromEntries(filas.map((f) => [f.slug, { ...f, sabores: f.sabores?.length ? f.sabores : [SABOR_UNICO] }]));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Método no permitido' }); }
  const token = process.env.MP_ACCESS_TOKEN;
  const base = (process.env.SITE_URL || sitio.url).replace(/\/$/, '');
  if (!token) return res.status(500).json({ error: 'Falta configurar MP_ACCESS_TOKEN' });

  // El navegador solo envía qué producto, sabor y cantidad. Precios, visibilidad y stock los decide el servidor.
  const entrada = (Array.isArray(req.body?.items) ? req.body.items : []).slice(0, 30);
  const slugs = [...new Set(entrada.map((it) => String(it?.slug || '')).filter((s) => /^[a-z0-9-]{1,80}$/.test(s)))];
  if (!slugs.length) return res.status(400).json({ error: 'El carrito está vacío' });
  let P;
  try { P = await cargar(slugs); } catch (e) { console.error(e.message); return res.status(502).json({ error: 'No pudimos revisar el inventario' }); }

  const lineas = []; const porProducto = {};
  for (const it of entrada) {
    const p = P[it?.slug];
    const sabor = p?.sabores.find((s) => s.slug === it?.sabor);
    const cantidad = Number.parseInt(it?.cantidad, 10);
    if (!p || !sabor || !(cantidad >= 1 && cantidad <= 20)) return res.status(400).json({ error: 'Carrito inválido' });
    if (!p.visible) return res.status(409).json({ error: `${p.nombre} ya no está disponible` });
    porProducto[p.slug] = (porProducto[p.slug] || 0) + cantidad;
    if (p.stock != null && porProducto[p.slug] > p.stock) return res.status(409).json({ error: p.stock ? `Solo quedan ${p.stock} unidades de ${p.nombre}` : `${p.nombre} está agotado` });
    lineas.push({ slug: p.slug, sabor: sabor.slug, saborNombre: sabor.nombre, nombre: p.nombre, cantidad, precio: p.precio });
  }

  // Mismas reglas que el carrito: combos, cupón y envío. El precio final de cada unidad ya trae el descuento.
  const r = calcularPedido(lineas, { combos: sitio.combos || [], cupones: sitio.cupones || {}, envio: sitio.envio, gratisDesde: sitio.envioGratisDesde }, req.body?.cupon);
  if (r.cuponError) return res.status(400).json({ error: r.cuponError });
  const items = r.lineas.map((l) => ({ id: `${l.slug}-${l.sabor}`, title: `${l.nombre} ${l.saborNombre}${l.combo ? ' (combo)' : ''}`, quantity: l.cantidad, unit_price: l.precioFinal, currency_id: sitio.moneda }));
  const { subtotal, envio } = r;
  if (envio) items.push({ id: 'envio', title: 'Envío nacional', quantity: 1, unit_price: envio, currency_id: sitio.moneda });
  const referencia = `halo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Datos del comprador y de envío (validados aquí también, no solo en el navegador).
  const cb = req.body?.comprador || {}; const en = req.body?.envio || {};
  const email = correoValido(cb.email || req.body?.email) ? String(cb.email || req.body?.email).trim().toLowerCase() : null;
  const celular = /^3\d{9}$/.test(String(cb.celular || '')) ? String(cb.celular) : null;
  const tipoDoc = ['CC', 'CE', 'NIT'].includes(cb.documento?.tipo) ? cb.documento.tipo : null;
  const numDoc = /^\d{5,12}$/.test(String(cb.documento?.numero || '')) ? String(cb.documento.numero) : null;
  const envioDatos = en.direccion ? { departamento: txt(en.departamento, 60), ciudad: txt(en.ciudad, 80), direccion: txt(en.direccion, 160), detalle: txt(en.detalle, 120), barrio: txt(en.barrio, 80) } : null;
  if (cb.email && (!email || !celular || !envioDatos?.ciudad || !envioDatos?.direccion)) return res.status(400).json({ error: 'Revisa tus datos de contacto y envío' });
  // Campos del comprador según la referencia de preferencias de Mercado Pago (payer).
  const payer = email ? {
    email, name: txt(cb.nombre, 60) || undefined, surname: txt(cb.apellido, 60) || undefined,
    ...(celular ? { phone: { area_code: '57', number: celular } } : {}),
    ...(tipoDoc && numDoc ? { identification: { type: tipoDoc, number: numDoc } } : {}),
    ...(envioDatos ? { address: { street_name: envioDatos.direccion } } : {}),
  } : null;

  try {
    if (hayBase()) await rest('pedidos', { method: 'POST', prefer: 'return=minimal', body: { referencia, estado: 'pendiente', cliente_email: email, cliente_nombre: payer ? `${payer.name || ''} ${payer.surname || ''}`.trim() || null : null, cliente_telefono: celular, documento: tipoDoc && numDoc ? `${tipoDoc} ${numDoc}` : null, envio_datos: envioDatos, cupon: r.cupon?.codigo || null, descuento: subtotal - r.productos, items: r.lineas.map((l) => ({ slug: l.slug, sabor: l.sabor, cantidad: l.cantidad, precio: l.precioFinal })), subtotal, envio, total: r.total } });
    const cliente = new MercadoPagoConfig({ accessToken: token });
    const preferencia = await new Preference(cliente).create({
      body: {
        items,
        ...(payer ? { payer } : {}),
        back_urls: { success: `${base}/pago/exito/`, pending: `${base}/pago/pendiente/`, failure: `${base}/pago/error/` },
        auto_return: 'approved',
        notification_url: `${base}/api/webhook-mercadopago`,
        external_reference: referencia,
      },
    });
    return res.status(200).json({ id: preferencia.id, init_point: preferencia.init_point, referencia, total: r.total });
  } catch (e) {
    console.error('Crear preferencia:', e?.message || e);
    return res.status(502).json({ error: 'Mercado Pago no respondió' });
  }
}
