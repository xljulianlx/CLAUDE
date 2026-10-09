// Fuente única de datos del sitio: productos, reseñas, blog y textos generales.
// Halo Nutrition es la tienda; los productos son de sus fabricantes. Precios de ejemplo.

export const sitio = {
  nombre: 'Halo Nutrition',
  marca: 'HALO',
  url: (process.env.SITE_URL || 'https://halo.example').replace(/\/$/, ''),
  idioma: 'es-CO',
  pais: 'CO',
  moneda: 'COP',
  envio: 12000,
  envioGratisDesde: 200000,
  diasDevolucion: 30,
  email: 'hola@halo.example',
  horario: 'Lunes a viernes, 8 a. m. a 6 p. m.',
  // Las reseñas de este archivo son de ejemplo. Con datos reales, poner en false para quitar el aviso.
  resenasDeEjemplo: true,
  // Combos: si el carrito tiene una unidad de cada producto del combo, esas unidades llevan el descuento.
  // El navegador y el servidor usan las mismas reglas (src/assets/js/precios.js).
  combos: [
    { slug: 'basico', nombre: 'Combo Básico', lema: 'Proteína y fuerza, lo que más funciona', items: ['gold-standard-100-whey', 'micronized-creatine-powder'], descuento: 10, color: '#b9471a' },
    { slug: 'energia', nombre: 'Combo Energía', lema: 'Para sesiones largas e intensas', items: ['venom-inferno', 'bcaa-2-1-1-watermelon-candy', 'botella-deportiva-negra'], descuento: 15, color: '#7349c2' },
    { slug: 'snack', nombre: 'Combo Proteína a toda hora', lema: 'Proteína en polvo, barra para llevar y botella', items: ['gold-standard-100-whey', 'fit-bar-chocolate', 'botella-deportiva-negra'], descuento: 12, color: '#1f8f50' },
  ],
  // Cupones (se validan otra vez en el servidor). Cambia o quita estos de ejemplo antes de vender.
  cupones: { BIENVENIDA10: { pct: 10, texto: '10 % de bienvenida' } },
};

export const categorias = [
  { slug: 'proteinas', nombre: 'Proteínas' },
  { slug: 'rendimiento', nombre: 'Rendimiento' },
  { slug: 'accesorios', nombre: 'Accesorios' },
];

// Productos que vende la tienda. Todo dato de producto sale de lo que se lee en la etiqueta de su foto
// (fuentes/productos/). Los precios son de ejemplo. marca: fabricante que figura en el envase (null si no se lee).
// forma: tarro | lata | shaker | caja (solo afecta detalles de diseño).
export const productos = [
  {
    slug: 'gold-standard-100-whey',
    nombre: 'Gold Standard 100% Whey',
    marca: 'Optimum Nutrition',
    categoria: 'proteinas',
    precio: 189900,
    porciones: 29,
    forma: 'tarro',
    presentacion: '1,98 lb (899 g), 29 porciones',
    resumen: '24 g de proteína y 5,5 g de BCAA por porción. Aislado de suero como fuente principal.',
    descripcion:
      'Proteína en polvo Gold Standard 100% Whey de Optimum Nutrition, sabor Strawberries & Cream (fresas con crema, saborizado artificialmente). Según su etiqueta aporta 24 g de proteína y 5,5 g de BCAA por porción, su fuente principal es el aislado de proteína de suero (whey protein isolate) y es probado contra sustancias prohibidas. Envase de 1,98 lb (899 g) con 29 porciones.',
    beneficios: [
      'Para apoyo y recuperación muscular (For muscle support & recovery).',
      '24 g de proteína por porción que ayudan a construir y mantener músculo.',
      '5,5 g de BCAA por porción que apoyan la recuperación muscular.',
    ],
    datos: [
      { k: 'Proteína', v: '24 g', por: 'por porción' },
      { k: 'BCAA', v: '5,5 g', por: 'por porción' },
      { k: 'Porciones', v: '29', por: 'por envase' },
      { k: 'Banned substance tested', v: 'Sí', por: 'probado contra sustancias prohibidas' },
    ],
    nutricion: null,
    uso: null,
    palabrasClave: ['Gold Standard 100% Whey', 'proteína Optimum Nutrition', 'whey protein Colombia', 'proteína fresas con crema'],
    sabores: [{ slug: 'strawberries-cream', nombre: 'Strawberries & Cream', c1: '#d8283a', c2: '#5e0c16' }],
    faq: [
      ['¿Cuál es la fuente principal de proteína?', 'El aislado de proteína de suero (whey protein isolate), según la etiqueta del envase.'],
      ['¿Cuántas porciones trae?', '29 porciones en un envase de 1,98 lb (899 g).'],
      ['¿Dónde veo la tabla nutricional completa?', 'En el envase. Revísala antes de usarlo, junto con el modo de uso y las advertencias del fabricante.'],
    ],
  },
  {
    slug: 'micronized-creatine-powder',
    nombre: 'Micronized Creatine Powder',
    marca: 'Optimum Nutrition',
    categoria: 'rendimiento',
    precio: 99900,
    porciones: 60,
    forma: 'tarro',
    presentacion: '300 g (10,58 oz), 60 porciones',
    resumen: '5 g de creatina monohidratada por porción. 100 % creatina monohidratada pura, sin sabor.',
    descripcion:
      'Creatina micronizada en polvo de Optimum Nutrition, sin sabor (Unflavored). Según su etiqueta es 100 % creatina monohidratada pura, aporta 5 g por porción y es probada contra sustancias prohibidas. La etiqueta indica que la creatina apoya la construcción muscular cuando se toma con el tiempo junto con ejercicio. Envase de 300 g (10,58 oz) con 60 porciones.',
    beneficios: [
      'Para apoyar la construcción muscular (For muscle building support).',
      '100 % creatina monohidratada pura que apoya los movimientos explosivos.',
      '5 g por porción que apoyan la fuerza y la potencia muscular.',
    ],
    datos: [
      { k: 'Creatina', v: '5 g', por: 'monohidratada, por porción' },
      { k: 'Pureza', v: '100 %', por: 'creatina monohidratada' },
      { k: 'Porciones', v: '60', por: 'por envase' },
      { k: 'Sabor', v: 'Sin sabor', por: 'Unflavored' },
    ],
    nutricion: null,
    uso: null,
    palabrasClave: ['creatina Optimum Nutrition', 'creatina micronizada', 'creatina monohidratada Colombia'],
    sabores: [{ slug: 'sin-sabor', nombre: 'Sin sabor', c1: '#2f9a4a', c2: '#103b1d' }],
    faq: [
      ['¿Qué contiene?', 'Creatina monohidratada: 100 % pura y 5 g por porción, según la etiqueta.'],
      ['¿Cuántas porciones trae?', '60 porciones en un envase de 300 g (10,58 oz).'],
      ['¿Dónde veo el modo de uso?', 'En el envase. Sigue las indicaciones y advertencias del fabricante.'],
    ],
  },
  {
    slug: 'venom-inferno',
    nombre: 'Venom Inferno',
    marca: 'Dragon Pharma',
    categoria: 'rendimiento',
    precio: 129900,
    porciones: null,
    forma: 'lata',
    presentacion: '280 g (9,87 oz)',
    resumen: 'Pre-entreno de estimulación extrema (Extreme High Stim Pre-Workout), sabor Cotton Candy.',
    descripcion:
      'Venom Inferno de Dragon Pharma es un suplemento dietario pre-entreno de estimulación extrema (Extreme High Stim Pre-Workout), sabor Cotton Candy (algodón de azúcar). Envase de 280 g (9,87 oz).',
    beneficios: [
      'Pre-entreno de estimulación extrema, según la etiqueta.',
      'Sabor Cotton Candy (algodón de azúcar).',
      'Envase de 280 g (9,87 oz).',
    ],
    datos: [
      { k: 'Tipo', v: 'Pre-entreno', por: 'Extreme High Stim' },
      { k: 'Contenido', v: '280 g', por: '9,87 oz' },
      { k: 'Sabor', v: 'Cotton Candy', por: 'algodón de azúcar' },
      { k: 'Marca', v: 'Dragon Pharma', por: 'fabricante' },
    ],
    nutricion: null,
    uso: null,
    palabrasClave: ['Venom Inferno', 'pre entreno Dragon Pharma', 'pre workout Colombia'],
    sabores: [{ slug: 'cotton-candy', nombre: 'Cotton Candy', c1: '#d3141e', c2: '#2a0507' }],
    faq: [
      ['¿Es fuerte?', 'La etiqueta lo describe como un pre-entreno de estimulación extrema (Extreme High Stim). Lee las advertencias del envase antes de usarlo.'],
      ['¿Dónde veo los ingredientes y la dosis?', 'En la tabla del envase. Sigue las indicaciones y advertencias del fabricante.'],
    ],
  },
  {
    slug: 'bcaa-2-1-1-watermelon-candy',
    nombre: 'BCAA 2:1:1 Watermelon Candy',
    marca: null,
    categoria: 'rendimiento',
    precio: 109900,
    porciones: 30,
    forma: 'tarro',
    presentacion: '600 g (21,16 oz), 30 servicios',
    resumen: 'BCAA en proporción 2:1:1 (6 g) con sales de electrolitos. Sabor sandía chicle, con stevia.',
    descripcion:
      'Alimento en polvo a base de maltodextrina con aminoácidos esenciales de cadena ramificada en proporción 2:1:1 (6 g) y sales de electrolitos. Sabor Watermelon Candy (sandía chicle), con polvo de fresa pulverizada y stevia. Su etiqueta lleva el sello "Contiene edulcorantes" (MinSalud). Envase de 600 g (21,16 oz) con 30 servicios.',
    beneficios: [
      'BCAA en proporción 2:1:1 (6 g).',
      'Con sales de electrolitos.',
      'Con aminoácidos esenciales de cadena ramificada.',
    ],
    datos: [
      { k: 'BCAA', v: '6 g', por: 'proporción 2:1:1' },
      { k: 'Electrolitos', v: 'Sí', por: 'sales de electrolitos' },
      { k: 'Servicios', v: '30', por: 'por envase' },
      { k: 'Endulzado', v: 'Stevia', por: 'contiene edulcorantes' },
    ],
    nutricion: null,
    uso: null,
    palabrasClave: ['BCAA 2:1:1', 'aminoácidos ramificados', 'BCAA sandía', 'BCAA con electrolitos'],
    sabores: [{ slug: 'watermelon-candy', nombre: 'Watermelon Candy', c1: '#e2335f', c2: '#6d0f2a' }],
    faq: [
      ['¿Qué significa 2:1:1?', 'Es la proporción de los tres aminoácidos de cadena ramificada que indica la etiqueta (6 g en total).'],
      ['¿Tiene azúcar o edulcorantes?', 'La etiqueta lleva el sello "Contiene edulcorantes" (MinSalud) e indica stevia. Es un alimento en polvo a base de maltodextrina.'],
    ],
  },
  {
    slug: 'fit-bar-chocolate',
    nombre: 'Fit Bar Chocolate',
    marca: 'Nutramerican',
    categoria: 'proteinas',
    precio: 12900,
    porciones: null,
    forma: 'caja',
    presentacion: 'Barra de 60 g',
    resumen: '25 g de proteína por barra, con whey protein isolate. Sabor chocolate.',
    descripcion:
      'Barra de proteína Fit Bar de Nutramerican, sabor chocolate, con whey protein isolate (proteína de suero). Según su empaque aporta 25 g de proteína por barra. Contenido neto: 60 g.',
    beneficios: [
      '25 g de proteína por barra.',
      'Con whey protein isolate (proteína de suero).',
      'Barra de 60 g para llevar.',
    ],
    datos: [
      { k: 'Proteína', v: '25 g', por: 'por barra' },
      { k: 'Fuente', v: 'Whey isolate', por: 'proteína de suero' },
      { k: 'Contenido', v: '60 g', por: 'una barra' },
      { k: 'Sabor', v: 'Chocolate', por: 'flavor / sabor' },
    ],
    nutricion: null,
    uso: null,
    palabrasClave: ['Fit Bar', 'barra de proteína', 'barra proteica Nutramerican', 'barra de proteína chocolate'],
    sabores: [{ slug: 'chocolate', nombre: 'Chocolate', c1: '#6b3f2c', c2: '#1d0f09' }],
    faq: [
      ['¿Cuánta proteína tiene?', '25 g de proteína por barra, según el empaque.'],
      ['¿Cuánto pesa?', 'Contenido neto de 60 g.'],
    ],
  },
  {
    slug: 'botella-deportiva-negra',
    nombre: 'Botella deportiva negra',
    marca: null,
    categoria: 'accesorios',
    precio: 39900,
    porciones: null,
    forma: 'shaker',
    presentacion: 'Color negro',
    resumen: 'Botella deportiva negra con tapa de pico y argolla para colgar.',
    descripcion: 'Botella deportiva de color negro con tapa de pico y argolla para colgarla o llevarla en la mano.',
    beneficios: [
      'Tapa de pico.',
      'Argolla en la tapa para colgarla o llevarla.',
      'Color negro.',
    ],
    datos: [
      { k: 'Color', v: 'Negro', por: 'cuerpo y tapa' },
      { k: 'Tapa', v: 'De pico', por: 'con argolla' },
    ],
    nutricion: null,
    uso: null,
    palabrasClave: ['botella deportiva', 'botella para gimnasio', 'botella negra'],
    sabores: [{ slug: 'negro', nombre: 'Negro', c1: '#3b3f47', c2: '#111317' }],
    faq: [],
  },
];

// Reseñas de ejemplo. Con reseñas reales, conectar aquí la fuente (plataforma de reseñas o base de datos).
export const resenas = {
  'gold-standard-100-whey': [
    { autor: 'Camila Restrepo', ciudad: 'Medellín', rating: 5, fecha: '2026-08-14', texto: 'Se mezcla sin grumos y no me cae pesada. Llevo seis meses con la de chocolate.' },
    { autor: 'Andrés Moreno', ciudad: 'Bogotá', rating: 5, fecha: '2026-07-30', texto: 'Buen sabor sin ser empalagosa. Me gusta que digan cuánto trae cada porción.' },
    { autor: 'Laura Peñaloza', ciudad: 'Cali', rating: 4, fecha: '2026-07-02', texto: 'La de vainilla es muy buena con avena. Le doy cuatro porque quisiera un tarro más grande.' },
  ],
  'micronized-creatine-powder': [
    { autor: 'Julián Ospina', ciudad: 'Pereira', rating: 5, fecha: '2026-08-21', texto: 'Una cucharada en el batido y listo. Se disuelve rápido.' },
    { autor: 'Daniela Vargas', ciudad: 'Bogotá', rating: 5, fecha: '2026-06-11', texto: 'Sin sabor de verdad, no cambia el gusto del jugo.' },
  ],
  'venom-inferno': [
    { autor: 'Sebastián Gil', ciudad: 'Barranquilla', rating: 5, fecha: '2026-08-02', texto: 'Me da energía sin ponerme nervioso. El de mango es el mejor.' },
    { autor: 'Natalia Ortiz', ciudad: 'Bucaramanga', rating: 4, fecha: '2026-07-19', texto: 'Funciona bien. El hormigueo al principio me sorprendió, pero pasa rápido.' },
  ],
  'bcaa-2-1-1-watermelon-candy': [
    { autor: 'Felipe Cárdenas', ciudad: 'Manizales', rating: 4, fecha: '2026-07-08', texto: 'Lo tomo en las salidas largas en bici. La limonada es suave y refrescante.' },
  ],
  'fit-bar-chocolate': [
    { autor: 'Valentina Rojas', ciudad: 'Bogotá', rating: 5, fecha: '2026-08-25', texto: 'Por fin una barra que no sabe a cartón. La de maní es mi favorita.' },
    { autor: 'Mateo Castaño', ciudad: 'Medellín', rating: 4, fecha: '2026-06-29', texto: 'Muy prácticas para la oficina. Un poco duras si están frías.' },
  ],
  'botella-deportiva-negra': [
    { autor: 'Paula Guerrero', ciudad: 'Cali', rating: 5, fecha: '2026-08-10', texto: 'No gotea en la maleta, que era lo que necesitaba.' },
  ],
};

export const blog = [
  {
    slug: 'como-tomar-creatina',
    titulo: 'Cómo tomar creatina monohidratada: dosis, horario y errores comunes',
    descripcion: 'Cuánta creatina tomar al día, si necesitas fase de carga, a qué hora tomarla y qué esperar en las primeras semanas.',
    fecha: '2026-09-12',
    autor: 'Equipo Halo',
    palabrasClave: ['cómo tomar creatina', 'dosis de creatina', 'creatina monohidratada'],
    producto: 'micronized-creatine-powder',
    cuerpo: [
      ['p', 'La creatina monohidratada es uno de los suplementos más estudiados para fuerza y potencia. Tomarla bien es sencillo, pero hay dudas que se repiten.'],
      ['h2', '¿Cuánta creatina tomar al día?'],
      ['p', 'La pauta más usada es de 3 a 5 g al día. Con esa dosis los depósitos de creatina del músculo se llenan en unas tres o cuatro semanas.'],
      ['h2', '¿Hace falta la fase de carga?'],
      ['p', 'No es obligatoria. La fase de carga (unos 20 g al día repartidos durante 5 a 7 días) llena los depósitos más rápido, pero el resultado final es el mismo que con 5 g diarios. Muchas personas prefieren saltarla para evitar molestias estomacales.'],
      ['h2', '¿A qué hora tomarla?'],
      ['p', 'La hora importa poco. Lo importante es tomarla todos los días, también los días de descanso. Si te ayuda a recordarla, súmala a tu batido después de entrenar.'],
      ['h2', 'Errores comunes'],
      ['ul', ['Dejarla los días de descanso.', 'Esperar resultados en una semana: el efecto se nota con constancia.', 'Comprar mezclas con muchos ingredientes cuando basta la creatina monohidratada.']],
      ['p', 'Si tienes una condición renal o tomas medicamentos, consulta a un profesional de la salud antes de empezar.'],
    ],
  },
  {
    slug: 'whey-isolate-o-concentrada',
    titulo: 'Whey isolate o concentrada: cuál elegir según tu objetivo',
    descripcion: 'Diferencias entre proteína whey aislada y concentrada: proteína por porción, lactosa, precio y para quién conviene cada una.',
    fecha: '2026-08-28',
    autor: 'Equipo Halo',
    palabrasClave: ['whey isolate', 'whey concentrada', 'qué proteína comprar'],
    producto: 'gold-standard-100-whey',
    cuerpo: [
      ['p', 'Las dos vienen del suero de la leche. La diferencia está en cuánto se filtran y eso cambia la cantidad de proteína, grasa y lactosa por porción.'],
      ['h2', 'Proteína por porción'],
      ['p', 'La concentrada suele tener entre 70 % y 80 % de proteína. La aislada pasa por un filtrado extra y supera el 85 %, con menos grasa y carbohidratos.'],
      ['h2', 'Lactosa'],
      ['p', 'El aislado tiene muy poca lactosa, por eso muchas personas con intolerancia leve lo toleran mejor. Si tu intolerancia es fuerte, consulta antes de usarlo.'],
      ['h2', '¿Cuál conviene?'],
      ['ul', ['Aislada: si cuidas grasa y carbohidratos o te cae pesada la lactosa.', 'Concentrada: si buscas el menor precio por porción y la toleras bien.']],
      ['p', 'En ambos casos, la proteína en polvo complementa la comida, no la reemplaza.'],
    ],
  },
  {
    slug: 'que-es-el-pre-entreno',
    titulo: 'Pre-entreno: qué es, cuándo tomarlo y qué revisar en la etiqueta',
    tituloSeo: 'Pre-entreno: qué es y cuándo tomarlo',
    descripcion: 'Qué contiene un pre-entreno, cuánta cafeína es razonable, a qué hora tomarlo y quién debería evitarlo.',
    fecha: '2026-09-26',
    autor: 'Equipo Halo',
    palabrasClave: ['pre entreno', 'qué es el pre entreno', 'pre workout cafeína'],
    producto: 'venom-inferno',
    cuerpo: [
      ['p', 'Un pre-entreno es una mezcla en polvo que se toma antes de entrenar para tener más energía y foco. Casi todos combinan cafeína con otros ingredientes como citrulina o beta-alanina.'],
      ['h2', '¿Cuánta cafeína es razonable?'],
      ['p', 'Entre 150 y 300 mg por porción es lo habitual. Suma también el café o las bebidas energéticas del día y no tomes pre-entreno en las 6 horas antes de dormir.'],
      ['h2', '¿Cuándo tomarlo?'],
      ['p', 'De 20 a 30 minutos antes de entrenar, con agua. Empieza con media porción para ver cómo te sienta.'],
      ['h2', 'Qué revisar en la etiqueta'],
      ['ul', ['Que cada ingrediente tenga su dosis declarada, sin mezclas ocultas.', 'La cantidad total de cafeína por porción.', 'Que no tenga azúcar añadida si cuidas tu ingesta.']],
      ['p', 'No es recomendable para menores de 18 años, personas embarazadas o sensibles a la cafeína. Si tienes una condición de salud, consulta antes a un profesional.'],
    ],
  },
  {
    slug: 'cuanta-proteina-necesitas',
    titulo: 'Cuánta proteína necesitas al día si entrenas',
    descripcion: 'Cómo calcular tu proteína diaria según tu peso y tu objetivo, y cuándo tiene sentido usar proteína en polvo.',
    fecha: '2026-10-02',
    autor: 'Equipo Halo',
    palabrasClave: ['cuánta proteína necesito', 'proteína al día', 'proteína para ganar masa muscular'],
    producto: 'gold-standard-100-whey',
    cuerpo: [
      ['p', 'La proteína ayuda a recuperar y construir músculo. Cuánta necesitas depende de tu peso, de cuánto entrenas y de tu objetivo.'],
      ['h2', 'Una regla práctica'],
      ['p', 'Las guías de nutrición deportiva suelen hablar de 1,4 a 2 g de proteína por kilo de peso al día para personas que entrenan con regularidad. Una persona de 70 kg estaría entre 98 y 140 g diarios.'],
      ['h2', 'Repártela en el día'],
      ['p', 'Es más fácil llegar a la meta con 3 o 4 comidas que incluyan proteína, de 20 a 40 g cada una.'],
      ['h2', '¿Cuándo usar proteína en polvo?'],
      ['ul', ['Cuando no alcanzas tu meta solo con comida.', 'Después de entrenar, si no vas a comer pronto.', 'Como desayuno rápido con fruta y avena.']],
      ['p', 'Si tienes una condición renal o una dieta especial, consulta a un profesional de la salud antes de aumentar tu proteína.'],
    ],
  },
];
