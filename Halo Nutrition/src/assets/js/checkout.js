// Finalizar compra: datos de contacto y envío, cupón, resumen y pago con Mercado Pago Checkout Pro.
// También pinta el recibo en /pago/exito/ y /pago/pendiente/ con el pedido guardado antes de pagar.
import { datos, modoDemo, sesion, pagoSimulado } from './datos.js';
import { leer, guardar, validos, resumen, aplicarCupon, cuponActual, P, foto, cop, esc, refrescar } from './app.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ico = (n) => `<svg class="ico" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const reducido = false; // animaciones siempre activas (ver movimiento.js)
const PRINCIPALES = ['bogotá', 'medellín', 'cali', 'barranquilla', 'cartagena', 'bucaramanga', 'pereira', 'manizales', 'armenia', 'cúcuta', 'ibagué', 'santa marta', 'villavicencio', 'envigado', 'itagüí', 'bello', 'soacha', 'chía', 'floridablanca'];
const CLAVE = 'halo-checkout';
const ULTIMO = 'halo-ultimo-pedido';

// Días hábiles desde hoy (lunes a viernes).
function habiles(n) { const d = new Date(); let k = 0; while (k < n) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) k++; } return d; }
const fCorta = (d) => d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
function estimado(ciudad) {
  const c = String(ciudad || '').trim().toLowerCase(); if (!c) return null;
  const rapido = PRINCIPALES.includes(c); const [a, b] = rapido ? [1, 3] : [3, 5];
  return { texto: `${rapido ? 'Entrega rápida' : 'Entrega estándar'}: llega entre el ${fCorta(habiles(a))} y el ${fCorta(habiles(b))}.`, a, b };
}

/* ---------- página de pago ---------- */
const raiz = $('[data-checkout]');
if (raiz) {
  const form = $('[data-co-form]'); const caja = $('[data-co-resumen]'); const deps = JSON.parse($('#departamentos').textContent);
  const c0 = validos(leer());
  if (!c0.length) { raiz.style.minHeight = `${raiz.offsetHeight}px`; raiz.innerHTML = `<div class="vacio co-vacio">${ico('caja')}<h1 class="h1 h1-pag">Tu carrito está vacío</h1><p>Agrega productos para finalizar la compra.</p><a class="btn btn-pri" href="${datos.tienda}">Ver la tienda</a></div>`; $('[data-co-barra]')?.remove(); }
  else iniciar();
  raiz.classList.add('listo');

  function iniciar() {
    // Recuperar lo que la persona ya escribió en esta sesión y el correo de su cuenta.
    try { const g = JSON.parse(sessionStorage.getItem(CLAVE) || '{}'); Object.entries(g).forEach(([k, v]) => { const el = form.elements[k]; if (el && el.type !== 'checkbox') el.value = v; }); } catch { /* nada */ }
    sesion().then((s) => { if (s?.email && !form.elements.email.value) form.elements.email.value = s.email; if (s?.nombre && !form.elements.nombre.value) { const [n, ...a] = s.nombre.split(' '); form.elements.nombre.value = n; form.elements.apellido.value = a.join(' '); } }).catch(() => {});
    llenarCiudades(); pintarResumen(); pintarEstimado();
    form.addEventListener('input', (e) => {
      if (e.target.name === 'celular' || e.target.name === 'documento') e.target.value = e.target.value.replace(/\D/g, '').slice(0, e.target.name === 'celular' ? 10 : 12); // se aceptan espacios y puntos al escribir o pegar
      guardarBorrador(); if (e.target.getAttribute('aria-invalid') === 'true') validar(e.target);
      if (e.target.name === 'ciudad') pintarEstimado();
    });
    form.addEventListener('change', (e) => { if (e.target.name === 'departamento') { llenarCiudades(true); pintarEstimado(); } guardarBorrador(); });
    form.addEventListener('focusout', (e) => { if (e.target.matches('input[required], select[required]') && e.target.value) validar(e.target); });
    form.addEventListener('submit', (e) => { e.preventDefault(); pagar(); });
    $('[data-co-ir-pagar]')?.addEventListener('click', () => form.requestSubmit());
    $('[data-co-toggle]').addEventListener('click', (e) => { const b = e.currentTarget; const abierto = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', String(abierto)); caja.classList.toggle('abierto', abierto); $('span', b).textContent = abierto ? 'Ocultar resumen' : 'Ver resumen'; });
    caja.addEventListener('submit', async (e) => {
      if (!e.target.matches('[data-cupon]')) return; e.preventDefault();
      const inp = $('input', e.target); const msg = $('[data-cupon-msg]', caja);
      const r = await aplicarCupon(inp.value); if (!r.ok) { msg.textContent = r.error; msg.className = 'campo-msg error'; inp.setAttribute('aria-invalid', 'true'); return; }
      pintarResumen(r.cupon ? `Cupón ${r.cupon.codigo} aplicado: ${r.cupon.texto}.` : 'Cupón quitado.');
    });
    caja.addEventListener('click', async (e) => { if (e.target.closest('[data-quitar-cupon]')) { await aplicarCupon(''); pintarResumen('Cupón quitado.'); } });
    // La barra fija de pago (celular) se oculta cuando el botón principal está a la vista.
    const btn = $('[data-co-pagar]'); const barra = $('[data-co-barra]');
    if (btn && barra && 'IntersectionObserver' in window) new IntersectionObserver(([en]) => barra.classList.toggle('oculta', en.isIntersecting)).observe(btn);
  }
  function guardarBorrador() { const o = {}; ['email', 'nombre', 'apellido', 'celular', 'tipo', 'departamento', 'ciudad', 'direccion', 'detalle', 'barrio'].forEach((k) => { o[k] = form.elements[k].value; }); try { sessionStorage.setItem(CLAVE, JSON.stringify(o)); } catch { /* nada */ } }
  function llenarCiudades(limpiar) {
    const d = form.elements.departamento.value; const lista = deps[d] || [];
    $('#co-ciudades').innerHTML = lista.map((x) => `<option value="${esc(x)}"></option>`).join('');
    if (limpiar) form.elements.ciudad.value = lista.length === 1 ? lista[0] : '';
  }
  function pintarEstimado() {
    const box = $('[data-co-estimado]'); const e = estimado(form.elements.ciudad.value);
    box.hidden = !e; if (e) $('p', box).textContent = e.texto;
  }
  function pintarResumen(aviso = '') {
    const r = resumen(); const cu = cuponActual();
    caja.innerHTML = `<h2>${ico('caja')} Tu pedido</h2>
      <ul class="co-lineas">${validos(leer()).map((i) => { const p = P[i.p]; const s = p.sabores.find((x) => x.slug === i.s) || p.sabores[0]; return `<li><span class="co-img"><img src="${foto(p.slug, s.slug, 160)}" width="56" height="56" alt=""><b>${i.q}</b></span><span><strong>${esc(p.nombre)}</strong><small>${esc(s.nombre)}</small></span><span>${cop(p.precio * i.q)}</span></li>`; }).join('')}</ul>
      <form class="co-cupon" data-cupon novalidate><label class="sr" for="co-cupon">Cupón de descuento</label><input id="co-cupon" name="cupon" placeholder="Cupón de descuento" autocomplete="off" autocapitalize="characters" value="${esc(cu?.codigo || '')}"><button class="btn btn-sec btn-sm" type="submit">Aplicar</button></form>
      <p class="campo-msg${aviso ? ' ok' : ''}" data-cupon-msg role="status">${esc(aviso)}</p>
      <div class="co-cifras">
        <div class="fila-total"><span>Subtotal</span><span>${cop(r.subtotal)}</span></div>
        ${r.combos.map((k) => `<div class="fila-total ahorro"><span>${ico('chispa')}${esc(k.nombre)} (−${k.pct} %)</span><span>−${cop(k.ahorro)}</span></div>`).join('')}
        ${r.cupon ? `<div class="fila-total ahorro"><span>${ico('tarjeta')}Cupón ${esc(r.cupon.codigo)} <button type="button" class="enlace-btn" data-quitar-cupon>quitar</button></span><span>−${cop(r.descuentoCupon)}</span></div>` : ''}
        <div class="fila-total"><span>Envío</span><span>${r.envio ? cop(r.envio) : '<b class="gratis">Gratis</b>'}</span></div>
        ${r.envio ? `<div class="co-envio-barra"><i style="--p:${Math.min(1, r.productos / datos.gratisDesde).toFixed(3)}"></i></div><p class="nota">Te faltan ${cop(datos.gratisDesde - r.productos)} para envío gratis.</p>` : ''}
        <div class="fila-total total"><span>Total</span><span>${cop(r.total)}</span></div>
        ${r.subtotal - r.productos > 0 ? `<p class="co-ahorro">${ico('chispa')} Ahorras ${cop(r.subtotal - r.productos)} en este pedido</p>` : ''}
      </div>
      <a class="enlace co-editar" href="${datos.carrito}">Editar el carrito</a>`;
    $('[data-co-total-corto]').textContent = cop(r.total); $('[data-co-total-barra]').textContent = cop(r.total);
    $('[data-co-pagar] span').textContent = modoDemo ? `Pagar ${cop(r.total)} (simulación)` : `Pagar ${cop(r.total)} con Mercado Pago`;
  }
  const REGLAS = {
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || 'Escribe un correo válido, por ejemplo nombre@correo.com.',
    nombre: (v) => v.trim().length >= 2 || 'Escribe tu nombre.',
    apellido: (v) => v.trim().length >= 2 || 'Escribe tu apellido.',
    celular: (v) => /^3\d{9}$/.test(v) || 'Escribe un celular de 10 dígitos que empiece por 3.',
    documento: (v) => /^\d{5,12}$/.test(v) || 'Escribe el número de documento, solo dígitos.',
    departamento: (v) => !!v || 'Elige el departamento.',
    ciudad: (v) => v.trim().length >= 3 || 'Escribe la ciudad o municipio.',
    direccion: (v) => (v.trim().length >= 6 && /\d/.test(v)) || 'Escribe la dirección con número, por ejemplo Calle 10 # 43-21.',
  };
  function validar(el) {
    const regla = REGLAS[el.name]; if (!regla) return true;
    const r = regla(el.value); const ok = r === true; const msg = $(`#${el.id}-msg`);
    el.setAttribute('aria-invalid', String(!ok)); if (msg) { if (!ok) { msg.dataset.ayuda ??= msg.textContent; msg.textContent = r; msg.classList.add('error'); el.setAttribute('aria-describedby', msg.id); } else { msg.textContent = msg.dataset.ayuda || ''; msg.classList.remove('error'); } }
    el.closest('.campo')?.classList.toggle('valido', ok);
    return ok;
  }
  function sacudir(el) { if (!reducido) el.animate?.([{ translate: '0' }, { translate: '-6px' }, { translate: '5px' }, { translate: '-3px' }, { translate: '0' }], { duration: 320, easing: 'ease-out' }); }
  async function pagar() {
    const err = $('[data-co-error]'); err.textContent = '';
    const malos = Object.keys(REGLAS).map((k) => form.elements[k]).filter((el) => !validar(el));
    if (malos.length) { malos[0].focus(); sacudir(malos[0].closest('.campo')); err.textContent = malos.length === 1 ? 'Revisa el campo marcado.' : `Revisa los ${malos.length} campos marcados.`; return; }
    if (!form.elements.acepto.checked) { err.textContent = 'Acepta los términos para continuar.'; sacudir(form.elements.acepto.closest('label')); form.elements.acepto.focus(); return; }
    const f = form.elements; const r = resumen(); const cu = cuponActual();
    const comprador = { email: f.email.value.trim().toLowerCase(), nombre: f.nombre.value.trim(), apellido: f.apellido.value.trim(), celular: f.celular.value, documento: { tipo: f.tipo.value, numero: f.documento.value } };
    const envio = { departamento: f.departamento.value, ciudad: f.ciudad.value.trim(), direccion: f.direccion.value.trim(), detalle: f.detalle.value.trim(), barrio: f.barrio.value.trim() };
    const est = estimado(envio.ciudad);
    const recibo = (referencia) => ({ referencia, fecha: new Date().toISOString(), comprador: { nombre: `${comprador.nombre} ${comprador.apellido}`, email: comprador.email }, envio, estimado: est?.texto || '', lineas: r.lineas.map((l) => ({ nombre: P[l.slug]?.nombre || l.slug, sabor: (P[l.slug]?.sabores.find((x) => x.slug === l.sabor) || {}).nombre || '', cantidad: l.cantidad, precio: l.precioFinal, slug: l.slug, saborSlug: l.sabor })), subtotal: r.subtotal, ahorro: r.subtotal - r.productos, envioCosto: r.envio, total: r.total });
    const cargando = $('[data-co-cargando]'); const pasos = $$('.co-cargando-pasos li', cargando);
    cargando.hidden = false; document.body.classList.add('pagando');
    const paso = (i) => pasos.forEach((li, k) => { li.classList.toggle('hecho', k < i); li.classList.toggle('activo', k === i); });
    const esperar = (ms) => new Promise((ok) => setTimeout(ok, reducido ? 0 : ms));
    paso(0); await esperar(500);
    try {
      if (modoDemo) {
        paso(1); await esperar(600);
        const ped = await pagoSimulado(r, comprador, envio);
        paso(2); $('[data-co-cargando-t]').textContent = 'Pago simulado aprobado'; await esperar(700);
        sessionStorage.setItem(ULTIMO, JSON.stringify(recibo(ped.referencia))); sessionStorage.removeItem('halo-cupon');
        location.href = datos.exito; return;
      }
      paso(1);
      const res = await fetch(`${datos.raiz}api/crear-preferencia`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ comprador, envio, cupon: cu?.codigo || '', items: validos(leer()).map((i) => ({ slug: i.p, sabor: i.s, cantidad: i.q })) }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.init_point) throw new Error(j.error || 'sin-api');
      if (j.total && j.total !== r.total) throw new Error(`El total cambió a ${cop(j.total)} (precio o stock actualizado). Revisa tu carrito.`);
      paso(2); sessionStorage.setItem(ULTIMO, JSON.stringify(recibo(j.referencia)));
      location.href = j.init_point;
    } catch (e) {
      cargando.hidden = true; document.body.classList.remove('pagando');
      err.textContent = e.message === 'sin-api' || e instanceof TypeError ? 'El pago se activa cuando el sitio está publicado con las credenciales de Mercado Pago.' : `No pudimos iniciar el pago: ${e.message}`;
    }
  }
}

/* ---------- recibo en la página de pago aprobado o pendiente ---------- */
const reciboEl = $('[data-recibo]');
if (reciboEl) {
  let o = null; try { o = JSON.parse(sessionStorage.getItem(ULTIMO) || 'null'); } catch { /* nada */ }
  const q = new URLSearchParams(location.search);
  if (o && (!q.get('external_reference') || q.get('external_reference') === o.referencia)) {
    const pend = location.pathname.includes('pendiente');
    reciboEl.hidden = false;
    reciboEl.innerHTML = `<div class="recibo-cab"><div><p class="eyebrow">Pedido</p><p class="recibo-ref">${esc(o.referencia)}</p></div><p class="nota">${new Date(o.fecha).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}</p></div>
      <ol class="recibo-linea">${[['tarjeta', pend ? 'Pago en proceso' : 'Pago aprobado', true], ['caja', 'Preparando', false], ['camion', 'En camino', false], ['check', 'Entregado', false]].map(([n, t, h], i) => `<li class="${h ? 'hecho' : ''}" style="--i:${i}">${ico(n)}<span>${t}</span></li>`).join('')}</ol>
      ${o.estimado ? `<p class="recibo-est">${ico('camion')} ${esc(o.estimado)}</p>` : ''}
      <ul class="co-lineas">${o.lineas.map((l) => `<li><span class="co-img"><img src="${foto(l.slug, l.saborSlug, 160)}" width="56" height="56" alt=""><b>${l.cantidad}</b></span><span><strong>${esc(l.nombre)}</strong><small>${esc(l.sabor)}</small></span><span>${cop(l.precio * l.cantidad)}</span></li>`).join('')}</ul>
      <div class="co-cifras">${o.ahorro ? `<div class="fila-total ahorro"><span>Ahorro</span><span>−${cop(o.ahorro)}</span></div>` : ''}<div class="fila-total"><span>Envío</span><span>${o.envioCosto ? cop(o.envioCosto) : 'Gratis'}</span></div><div class="fila-total total"><span>Total</span><span>${cop(o.total)}</span></div></div>
      <div class="recibo-envio">${ico('mapa')}<p><strong>${esc(o.comprador.nombre)}</strong><br>${esc(o.envio.direccion)}${o.envio.detalle ? `, ${esc(o.envio.detalle)}` : ''}${o.envio.barrio ? ` · ${esc(o.envio.barrio)}` : ''}<br>${esc(o.envio.ciudad)}, ${esc(o.envio.departamento)}<br><small>Confirmación enviada a ${esc(o.comprador.email)}</small></p></div>`;
  }
  if (location.pathname.includes('exito')) { guardar([]); refrescar(); }
}
