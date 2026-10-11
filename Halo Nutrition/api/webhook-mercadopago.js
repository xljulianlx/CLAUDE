// Webhook de Mercado Pago (notification_url de la preferencia). Consulta el pago en la API para conocer su estado
// real (nunca se confía solo en el cuerpo de la notificación) y actualiza el pedido en Supabase.
// Documentación: https://www.mercadopago.com.co/developers/es/docs/your-integrations/notifications/webhooks
//
// PENDIENTE antes de producción: validar la firma del encabezado x-signature con la clave secreta del webhook,
// siguiendo la sección "Validar origen de la notificación" de la documentación vigente. Mientras tanto, una
// notificación falsa solo puede hacer que consultemos un pago real en Mercado Pago, que es la fuente de verdad.
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { hayBase, rest } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const tipo = req.body?.type || req.query?.type || req.query?.topic;
  const id = req.body?.data?.id || req.query?.['data.id'] || req.query?.id;
  if (tipo !== 'payment' || !id || !process.env.MP_ACCESS_TOKEN) return res.status(200).end();
  try {
    const pago = await new Payment(new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN })).get({ id });
    const ref = pago.external_reference;
    console.log('Pago', id, pago.status, ref);
    if (hayBase() && ref) {
      const r = encodeURIComponent(ref);
      if (pago.status === 'approved') {
        // Solo pasa de "pendiente" a "pagado" una vez: si Mercado Pago repite el aviso, no se descuenta stock dos veces.
        const filas = await rest(`pedidos?referencia=eq.${r}&estado=eq.pendiente`, { method: 'PATCH', prefer: 'return=representation', body: { estado: 'pagado', mp_payment_id: String(id) } });
        if (filas?.length) {
          await rest('rpc/descontar_stock', { method: 'POST', body: { p_items: filas[0].items } });
          // Si compró sin sesión, se guarda el correo de Mercado Pago para que vea el pedido al crear su cuenta.
          if (!filas[0].cliente_email && pago.payer?.email) await rest(`pedidos?referencia=eq.${r}`, { method: 'PATCH', prefer: 'return=minimal', body: { cliente_email: pago.payer.email.toLowerCase() } });
        }
      } else if (['rejected', 'cancelled'].includes(pago.status)) {
        await rest(`pedidos?referencia=eq.${r}&estado=eq.pendiente`, { method: 'PATCH', prefer: 'return=minimal', body: { estado: 'cancelado', mp_payment_id: String(id) } });
      }
    }
  } catch (e) {
    console.error('Webhook', id, e?.message || e);
    return res.status(500).end(); // Mercado Pago reintenta la notificación.
  }
  return res.status(200).end();
}
