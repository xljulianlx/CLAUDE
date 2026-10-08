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

const SABOR_UNICO = { slug: 'unico', nombre: 'Único' };
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

  const items = []; const lineas = []; const porProducto = {};
  for (const it of entrada) {
    const p = P[it?.slug];
    const sabor = p?.sabores.find((s) => s.slug === it?.sabor);
    const cantidad = Number.parseInt(it?.cantidad, 10);
    if (!p || !sabor || !(cantidad >= 1 && cantidad <= 20)) return res.status(400).json({ error: 'Carrito inválido' });
    if (!p.visible) return res.status(409).json({ error: `${p.nombre} ya no está disponible` });
    porProducto[p.slug] = (porProducto[p.slug] || 0) + cantidad;
    if (p.stock != null && porProducto[p.slug] > p.stock) return res.status(409).json({ error: p.stock ? `Solo quedan ${p.stock} unidades de ${p.nombre}` : `${p.nombre} está agotado` });
    items.push({ id: `${p.slug}-${sabor.slug}`, title: `${p.nombre} ${sabor.nombre}`, quantity: cantidad, unit_price: p.precio, currency_id: sitio.moneda });
    lineas.push({ slug: p.slug, sabor: sabor.slug, cantidad, precio: p.precio });
  }

  const subtotal = items.reduce((n, i) => n + i.unit_price * i.quantity, 0);
  const envio = subtotal >= sitio.envioGratisDesde ? 0 : sitio.envio;
  if (envio) items.push({ id: 'envio', title: 'Envío nacional', quantity: 1, unit_price: envio, currency_id: sitio.moneda });
  const referencia = `halo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = correoValido(req.body?.email) ? req.body.email.trim().toLowerCase() : null;

  try {
    if (hayBase()) await rest('pedidos', { method: 'POST', prefer: 'return=minimal', body: { referencia, estado: 'pendiente', cliente_email: email, items: lineas, subtotal, envio, total: subtotal + envio } });
    const cliente = new MercadoPagoConfig({ accessToken: token });
    const preferencia = await new Preference(cliente).create({
      body: {
        items,
        ...(email ? { payer: { email } } : {}),
        back_urls: { success: `${base}/pago/exito/`, pending: `${base}/pago/pendiente/`, failure: `${base}/pago/error/` },
        auto_return: 'approved',
        notification_url: `${base}/api/webhook-mercadopago`,
        external_reference: referencia,
      },
    });
    return res.status(200).json({ id: preferencia.id, init_point: preferencia.init_point });
  } catch (e) {
    console.error('Crear preferencia:', e?.message || e);
    return res.status(502).json({ error: 'Mercado Pago no respondió' });
  }
}
