// Regenera el sitio (páginas, sitemap y datos estructurados) cuando un administrador publica cambios del panel.
// Llama al Deploy Hook de Vercel: https://vercel.com/docs/deployments/deploy-hooks
// Variables: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, VERCEL_DEPLOY_HOOK_URL.
import { hayBase, usuarioDeToken, esAdministrador } from './_supabase.js';

let ultimo = 0;

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Método no permitido' }); }
  if (!hayBase() || !process.env.VERCEL_DEPLOY_HOOK_URL) return res.status(500).json({ error: 'Falta configurar Supabase o VERCEL_DEPLOY_HOOK_URL' });
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try {
    const email = await usuarioDeToken(token);
    if (!email) return res.status(401).json({ error: 'Inicia sesión otra vez' });
    if (!(await esAdministrador(email))) return res.status(403).json({ error: 'Tu cuenta no es de administrador' });
    if (Date.now() - ultimo < 30_000) return res.status(429).json({ error: 'Ya se está publicando. Espera unos segundos.' });
    ultimo = Date.now();
    const r = await fetch(process.env.VERCEL_DEPLOY_HOOK_URL, { method: 'POST' });
    if (!r.ok) return res.status(502).json({ error: 'Vercel no aceptó la publicación' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('publicar:', e?.message || e);
    return res.status(500).json({ error: 'No se pudo publicar' });
  }
}
