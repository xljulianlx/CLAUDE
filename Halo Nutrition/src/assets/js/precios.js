// Cálculo del pedido: combos, cupón, envío y total. Lo usan el carrito (navegador) y el servidor
// (api/crear-preferencia.js), así el precio que ve el cliente es exactamente el que se cobra.
// Los descuentos bajan el precio unitario de las unidades que aplican (Mercado Pago no acepta ítems negativos).

// lineas: [{ slug, sabor, cantidad, precio }]  ·  reglas: { combos, cupones, envio, gratisDesde }
export function calcularPedido(lineas, reglas, codigo = '') {
  const combos = reglas.combos || []; const cupones = reglas.cupones || {};
  const unidades = {}; lineas.forEach((l) => { unidades[l.slug] = (unidades[l.slug] || 0) + l.cantidad; });
  const libres = { ...unidades }; const porSlug = {}; const aplicados = [];
  for (const c of combos) {
    const veces = Math.min(...c.items.map((s) => libres[s] || 0));
    if (!(veces > 0)) continue;
    let ahorro = 0;
    c.items.forEach((s) => {
      libres[s] -= veces; (porSlug[s] ||= []).push({ unidades: veces, pct: c.descuento, combo: c.slug });
      const precio = lineas.find((l) => l.slug === s)?.precio || 0; ahorro += (precio - Math.round(precio * (1 - c.descuento / 100))) * veces;
    });
    aplicados.push({ slug: c.slug, nombre: c.nombre, veces, pct: c.descuento, ahorro });
  }
  const clave = String(codigo || '').trim().toUpperCase();
  const cupon = clave && cupones[clave] ? { codigo: clave, ...cupones[clave] } : null;
  const salida = [];
  for (const l of lineas) {
    let q = l.cantidad;
    for (const d of porSlug[l.slug] || []) {
      const t = Math.min(q, d.unidades); if (!t) continue;
      salida.push({ ...l, cantidad: t, precioFinal: Math.round(l.precio * (1 - d.pct / 100)), combo: d.combo });
      d.unidades -= t; q -= t;
    }
    if (q > 0) salida.push({ ...l, cantidad: q, precioFinal: l.precio, combo: null });
  }
  const conCombos = salida.reduce((s, l) => s + l.precioFinal * l.cantidad, 0);
  if (cupon) salida.forEach((l) => { l.precioFinal = Math.round(l.precioFinal * (1 - cupon.pct / 100)); });
  const subtotal = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
  const productos = salida.reduce((s, l) => s + l.precioFinal * l.cantidad, 0);
  const envio = productos === 0 || productos >= reglas.gratisDesde ? 0 : reglas.envio;
  return {
    lineas: salida, subtotal, descuentoCombos: subtotal - conCombos, descuentoCupon: conCombos - productos,
    productos, envio, total: productos + envio, combos: aplicados, cupon,
    cuponError: clave && !cupon ? 'Ese cupón no existe o ya no está vigente.' : '',
  };
}

// Qué combo está a un producto de completarse (para sugerirlo en el carrito).
export function comboCercano(lineas, combos) {
  const tiene = new Set(lineas.map((l) => l.slug));
  return combos.map((c) => ({ c, faltan: c.items.filter((s) => !tiene.has(s)) })).filter((x) => x.faltan.length === 1 && x.c.items.length > 1).sort((a, b) => b.c.descuento - a.c.descuento)[0] || null;
}
