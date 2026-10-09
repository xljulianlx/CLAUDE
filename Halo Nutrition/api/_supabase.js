// Ayudante del servidor para la API REST de Supabase (PostgREST) con la clave service_role.
// Los archivos que empiezan por "_" dentro de /api no se publican como funciones en Vercel.
// Referencia: https://supabase.com/docs/guides/api
const URL_SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const CLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const hayBase = () => Boolean(URL_SB && CLAVE);

export async function rest(ruta, { method = 'GET', body, prefer } = {}) {
  const r = await fetch(`${URL_SB}/rest/v1/${ruta}`, {
    method,
    headers: { apikey: CLAVE, Authorization: `Bearer ${CLAVE}`, 'content-type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : null;
}

// Devuelve el correo del usuario dueño del token de sesión, o null si el token no es válido.
export async function usuarioDeToken(token) {
  if (!token) return null;
  const r = await fetch(`${URL_SB}/auth/v1/user`, { headers: { apikey: process.env.SUPABASE_ANON_KEY || CLAVE, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.email ? String(u.email).toLowerCase() : null;
}

export async function esAdministrador(email) {
  if (!email) return false;
  const filas = await rest('admins?select=email');
  return filas.some((f) => String(f.email).toLowerCase() === email);
}
