// Webhook de Mercado Pago (notification_url de la preferencia). Responde 200 rápido y consulta el pago
// en la API para conocer su estado real: nunca confiar solo en el cuerpo de la notificación.
// Documentación: https://www.mercadopago.com.co/developers/es/docs/your-integrations/notifications/webhooks
//
// PENDIENTE antes de producción (no implementado a propósito para no inventar el formato):
//   1. Validar la firma del encabezado x-signature con la clave secreta del webhook, siguiendo la sección
//      "Validar origen de la notificación" de la documentación vigente.
//   2. Guardar el pedido (external_reference, estado, ítems) en tu base de datos y enviar el correo de confirmación.
import { MercadoPagoConfig, Payment } from 'mercadopago';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const tipo = req.body?.type || req.query?.type || req.query?.topic;
  const id = req.body?.data?.id || req.query?.['data.id'] || req.query?.id;
  res.status(200).end();
  if (tipo !== 'payment' || !id || !process.env.MP_ACCESS_TOKEN) return;
  try {
    const pago = await new Payment(new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN })).get({ id });
    console.log('Pago', id, pago.status, pago.external_reference);
  } catch (e) {
    console.error('No se pudo consultar el pago', id, e?.message || e);
  }
}
