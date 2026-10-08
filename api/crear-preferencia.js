// Función serverless (Vercel, Node 18+): crea una preferencia de Mercado Pago Checkout Pro y devuelve su init_point.
// Documentación seguida:
//   - Crear preferencia (POST /checkout/preferences): https://www.mercadopago.com.co/developers/es/reference/preferences/_checkout_preferences/post
//   - URLs de retorno (back_urls, auto_return): https://www.mercadopago.com.co/developers/es/docs/checkout-pro/configure-back-urls
//   - SDK Node v2 (MercadoPagoConfig + Preference): https://github.com/mercadopago/sdk-nodejs
// Antes de salir a producción, confirmar los nombres de campos contra la referencia vigente y probar con credenciales de prueba.
//
// Variables de entorno: MP_ACCESS_TOKEN (token privado, nunca en el navegador) y SITE_URL (dominio público, https).
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { productos, sitio } from '../src/data/catalogo.mjs';

const PRODUCTOS = Object.fromEntries(productos.map((p) => [p.slug, p]));

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Método no permitido' }); }
  const token = process.env.MP_ACCESS_TOKEN;
  const base = (process.env.SITE_URL || sitio.url).replace(/\/$/, '');
  if (!token) return res.status(500).json({ error: 'Falta configurar MP_ACCESS_TOKEN' });

  // El navegador solo envía qué producto, sabor y cantidad. Los precios salen del catálogo del servidor.
  const entrada = Array.isArray(req.body?.items) ? req.body.items : [];
  const items = [];
  for (const it of entrada.slice(0, 30)) {
    const p = PRODUCTOS[it?.slug];
    const sabor = p?.sabores.find((s) => s.slug === it?.sabor);
    const cantidad = Number.parseInt(it?.cantidad, 10);
    if (!p || !sabor || !(cantidad >= 1 && cantidad <= 20)) return res.status(400).json({ error: 'Carrito inválido' });
    items.push({ id: `${p.slug}-${sabor.slug}`, title: `${p.nombre} ${sabor.nombre}`, quantity: cantidad, unit_price: p.precio, currency_id: sitio.moneda });
  }
  if (!items.length) return res.status(400).json({ error: 'El carrito está vacío' });

  const subtotal = items.reduce((n, i) => n + i.unit_price * i.quantity, 0);
  if (subtotal < sitio.envioGratisDesde) items.push({ id: 'envio', title: 'Envío nacional', quantity: 1, unit_price: sitio.envio, currency_id: sitio.moneda });

  try {
    const cliente = new MercadoPagoConfig({ accessToken: token });
    const preferencia = await new Preference(cliente).create({
      body: {
        items,
        back_urls: { success: `${base}/pago/exito/`, pending: `${base}/pago/pendiente/`, failure: `${base}/pago/error/` },
        auto_return: 'approved',
        notification_url: `${base}/api/webhook-mercadopago`,
        external_reference: `halo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    });
    return res.status(200).json({ id: preferencia.id, init_point: preferencia.init_point });
  } catch (e) {
    console.error('Mercado Pago:', e?.message || e);
    return res.status(502).json({ error: 'Mercado Pago no respondió' });
  }
}
