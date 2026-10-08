// Página /cuenta/: iniciar sesión (correo y contraseña, Google, Facebook), crear cuenta, recuperar contraseña
// y, con sesión, ver los pedidos propios. Si el correo es de administrador, enlaza al panel.
import { datos, modoDemo, DEMO_ADMIN, sesion, entrar, registrar, entrarCon, recuperarClave, cambiarClave, alRecuperar, salir, esAdmin, pedidos } from './datos.js';

const app = document.querySelector('[data-cuenta-app]');
const $ = (s, r = app) => r.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const cop = (n) => `$ ${num.format(Math.round(n || 0))}`;
const fecha = (f) => new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const P = Object.fromEntries(datos.productos.map((p) => [p.slug, p]));
const ESTADOS = { pendiente: 'Pago pendiente', pagado: 'Pagado', preparando: 'Preparando', enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado' };
const volver = new URLSearchParams(location.search).get('volver');

const G = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9h-4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>';
const F = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/></svg>';

const titulo = '<h1 class="h1 h1-pag">Mi cuenta</h1>';
const notaDemo = () => (modoDemo ? `<div class="demo-nota"><p><strong>Modo demostración.</strong> Las cuentas se guardan solo en este navegador. Para probar el panel de administración entra con <code>${DEMO_ADMIN.email}</code> y la clave <code>${DEMO_ADMIN.clave}</code>.</p><button class="btn btn-sec btn-sm" type="button" data-usar-demo>Usar la cuenta de administrador de prueba</button></div>` : '');

function vistaAcceso(modo = 'entrar', mensaje = '') {
  const reg = modo === 'registro';
  app.innerHTML = `${titulo}
  <div class="auth">
    <div class="pestanas" role="tablist" aria-label="Acceso">
      <button type="button" role="tab" id="tab-entrar" aria-selected="${!reg}" aria-controls="panel-acceso" data-modo="entrar">Entrar</button>
      <button type="button" role="tab" id="tab-registro" aria-selected="${reg}" aria-controls="panel-acceso" data-modo="registro">Crear cuenta</button>
    </div>
    <div id="panel-acceso" role="tabpanel" aria-labelledby="${reg ? 'tab-registro' : 'tab-entrar'}" class="auth-panel">
      <div class="sociales">
        <button class="btn-social" type="button" data-proveedor="google">${G}Continuar con Google</button>
        <button class="btn-social" type="button" data-proveedor="facebook">${F}Continuar con Facebook</button>
      </div>
      <p class="separador">o con tu correo</p>
      <form data-form-acceso novalidate>
        ${reg ? '<div class="campo"><label for="c-nombre">Nombre</label><input id="c-nombre" name="nombre" autocomplete="name" required></div>' : ''}
        <div class="campo"><label for="c-email">Correo</label><input id="c-email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" required></div>
        <div class="campo"><label for="c-clave">Contraseña</label><div class="campo-clave"><input id="c-clave" name="clave" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" minlength="8" required${reg ? ' aria-describedby="c-clave-ayuda"' : ''}><button type="button" data-ver-clave aria-pressed="false">Mostrar</button></div>${reg ? '<p class="campo-ayuda" id="c-clave-ayuda">Mínimo 8 caracteres.</p>' : ''}</div>
        <p class="campo-error" role="alert" data-error>${esc(mensaje)}</p>
        <button class="btn btn-pri btn-grande" type="submit">${reg ? 'Crear cuenta' : 'Entrar'}</button>
        ${reg ? '' : '<button class="enlace-btn" type="button" data-olvide>¿Olvidaste tu contraseña?</button>'}
        <p class="ok-msg" role="status" data-ok></p>
      </form>
    </div>
    ${notaDemo()}
  </div>`;
}

function vistaNuevaClave() {
  app.innerHTML = `${titulo}<div class="auth"><h2>Elige una contraseña nueva</h2><form data-form-clave novalidate>
    <div class="campo"><label for="n-clave">Contraseña nueva</label><input id="n-clave" type="password" autocomplete="new-password" minlength="8" required></div>
    <p class="campo-error" role="alert" data-error></p><button class="btn btn-pri" type="submit">Guardar contraseña</button></form></div>`;
  $('[data-form-clave]').addEventListener('submit', async (e) => {
    e.preventDefault(); const v = $('#n-clave').value;
    if (v.length < 8) { $('[data-error]').textContent = 'Usa al menos 8 caracteres.'; return; }
    try { await cambiarClave(v); iniciar(); } catch (er) { $('[data-error]').textContent = er.message; }
  });
}

async function vistaCuenta(s) {
  const admin = await esAdmin();
  if (admin && volver === 'admin') { location.replace(datos.admin); return; }
  app.innerHTML = `${titulo}
  <div class="mi-cuenta">
    <div class="mi-cuenta-cab"><p>Hola${s.nombre ? `, <strong>${esc(s.nombre)}</strong>` : ''}. Entraste como <strong>${esc(s.email)}</strong>.</p><button class="btn btn-sec btn-sm" type="button" data-salir>Cerrar sesión</button></div>
    ${admin ? `<div class="tarjeta-admin"><div><h2>Panel de administración</h2><p>Productos, precios, inventario, fotos y pedidos.</p></div><a class="btn" href="${datos.admin}">Abrir el panel</a></div>` : ''}
    <section aria-labelledby="mis-t"><h2 class="h2 h2-sec" id="mis-t">Mis pedidos</h2><div class="mis-pedidos" data-mis-pedidos><p class="nota">Cargando pedidos…</p></div></section>
  </div>`;
  $('[data-salir]').addEventListener('click', async () => { await salir(); location.reload(); });
  try {
    const l = await pedidos({ propios: true });
    $('[data-mis-pedidos]').innerHTML = l.length ? l.map((p) => `<article class="pedido">
      <div class="pedido-cab"><div><strong>${cop(p.total)}</strong> <span class="pedido-ref">${esc(p.referencia)}</span></div><span class="estado estado-${p.estado}">${ESTADOS[p.estado] || esc(p.estado)}</span></div>
      <p class="nota">${fecha(p.creado)}${p.guia ? `. Guía de envío: <strong>${esc(p.guia)}</strong>` : ''}</p>
      <ul>${(p.items || []).map((it) => `<li>${it.cantidad} × ${esc(P[it.slug]?.nombre || it.slug)}${P[it.slug]?.sabores?.find((x) => x.slug === it.sabor) ? `, ${esc(P[it.slug].sabores.find((x) => x.slug === it.sabor).nombre)}` : ''}</li>`).join('')}</ul>
    </article>`).join('') : `<div class="vacio"><p>Todavía no tienes pedidos.</p><a class="btn btn-pri" href="${datos.tienda}">Ver productos</a></div>`;
  } catch {
    $('[data-mis-pedidos]').innerHTML = '<p class="campo-error">No pudimos cargar tus pedidos. Recarga la página.</p>';
  }
}

app.addEventListener('click', async (e) => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.modo) { vistaAcceso(t.dataset.modo); $(`#tab-${t.dataset.modo}`).focus(); return; }
  if (t.hasAttribute('data-ver-clave')) { const i = $('#c-clave'); const ver = i.type === 'password'; i.type = ver ? 'text' : 'password'; t.textContent = ver ? 'Ocultar' : 'Mostrar'; t.setAttribute('aria-pressed', String(ver)); return; }
  if (t.hasAttribute('data-usar-demo')) { if (!$('#c-email')) vistaAcceso('entrar'); $('#c-email').value = DEMO_ADMIN.email; $('#c-clave').value = DEMO_ADMIN.clave; $('[data-form-acceso]').requestSubmit(); return; }
  if (t.dataset.proveedor) {
    const err = $('[data-error]'); err.textContent = '';
    try { t.disabled = true; await entrarCon(t.dataset.proveedor); } catch (er) { err.textContent = er.message; t.disabled = false; }
    return;
  }
  if (t.hasAttribute('data-olvide')) {
    const email = $('#c-email'); const err = $('[data-error]'); const ok = $('[data-ok]'); err.textContent = ''; ok.textContent = '';
    if (!email.value || !email.checkValidity()) { err.textContent = 'Escribe tu correo arriba y vuelve a tocar “¿Olvidaste tu contraseña?”.'; email.focus(); return; }
    try { await recuperarClave(email.value); ok.textContent = 'Te enviamos un enlace para crear una contraseña nueva. Revisa tu correo.'; } catch (er) { err.textContent = er.message; }
  }
});

app.addEventListener('submit', async (e) => {
  const f = e.target.closest('[data-form-acceso]'); if (!f) return;
  e.preventDefault();
  const reg = !!f.elements.nombre; const err = $('[data-error]'); err.textContent = '';
  const email = f.elements.email; const clave = f.elements.clave;
  [email, clave, f.elements.nombre].forEach((i) => i && i.removeAttribute('aria-invalid'));
  const malo = [f.elements.nombre, email, clave].find((i) => i && !i.checkValidity());
  if (malo) {
    malo.setAttribute('aria-invalid', 'true'); malo.focus();
    err.textContent = malo === email ? 'Escribe un correo válido, por ejemplo nombre@correo.com.' : malo === clave ? 'La contraseña debe tener al menos 8 caracteres.' : 'Escribe tu nombre.';
    return;
  }
  const boton = f.querySelector('[type="submit"]'); boton.disabled = true;
  try {
    if (reg) {
      const r = await registrar(email.value, clave.value, f.elements.nombre.value.trim());
      if (r.confirmar) { vistaAcceso('entrar'); $('[data-ok]').textContent = 'Te enviamos un correo para confirmar tu cuenta. Después inicia sesión aquí.'; return; }
    } else await entrar(email.value, clave.value);
    iniciar();
  } catch (er) { err.textContent = er.message; boton.disabled = false; }
});

async function iniciar() {
  try {
    const s = await sesion();
    if (s) await vistaCuenta(s); else vistaAcceso('entrar', volver === 'admin' ? 'Inicia sesión con el correo de administrador para abrir el panel.' : '');
  } catch {
    app.innerHTML = `${titulo}<p class="campo-error">No pudimos conectar con el servicio de cuentas. Revisa tu conexión y recarga la página.</p>`;
  }
}
alRecuperar(vistaNuevaClave).catch(() => {});
iniciar();
