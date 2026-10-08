// Fuente única de datos del sitio: productos, reseñas, blog y textos generales.
// Todo el contenido es de ejemplo (marca ficticia). Reemplazar con la ficha real antes de publicar.

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
};

export const categorias = [
  { slug: 'proteinas', nombre: 'Proteínas' },
  { slug: 'rendimiento', nombre: 'Rendimiento' },
  { slug: 'accesorios', nombre: 'Accesorios' },
];

// forma: tarro | lata | shaker | caja (define el modelo 3D y el render de la foto)
export const productos = [
  {
    slug: 'whey-isolate',
    nombre: 'Whey Isolate',
    categoria: 'proteinas',
    precio: 189900,
    porciones: 30,
    forma: 'tarro',
    presentacion: '2 lb, 30 porciones',
    resumen: '25 g de proteína aislada por porción, sin azúcar añadida y fácil de mezclar.',
    descripcion:
      'Proteína aislada de suero con 25 g por porción y muy poca grasa y lactosa. Se disuelve en agua o leche sin grumos y no deja sensación pesada. Ideal después de entrenar o para completar la proteína del día.',
    beneficios: [
      'Ayuda a alcanzar tu meta diaria de proteína sin cocinar más.',
      'Se mezcla en 10 segundos con agua, sin grumos.',
      'Endulzada con stevia, sin azúcar añadida.',
    ],
    datos: [
      { k: 'Proteína', v: '25 g', por: 'por porción de 30 g' },
      { k: 'Azúcar añadida', v: '0 g', por: 'endulzada con stevia' },
      { k: 'Porciones', v: '30', por: 'un mes con una al día' },
      { k: 'Análisis', v: 'Por lote', por: 'laboratorio independiente' },
    ],
    nutricion: [['Porción', '30 g'], ['Energía', '112 kcal'], ['Proteína', '25 g'], ['Carbohidratos', '1,2 g'], ['Grasa', '0,6 g'], ['Sodio', '60 mg']],
    uso: 'Mezcla 1 scoop (30 g) con 250 ml de agua o leche. Tómalo después de entrenar o en cualquier momento del día.',
    palabrasClave: ['proteína whey isolate', 'proteína aislada Colombia', 'whey sin azúcar'],
    sabores: [
      { slug: 'chocolate', nombre: 'Chocolate', c1: '#6b3f2c', c2: '#2b160e' },
      { slug: 'vainilla', nombre: 'Vainilla', c1: '#e3cb98', c2: '#9f7f46' },
      { slug: 'fresa', nombre: 'Fresa', c1: '#d9566f', c2: '#86203f' },
    ],
    faq: [
      ['¿Sirve si soy intolerante a la lactosa?', 'El aislado tiene muy poca lactosa y muchas personas con intolerancia leve lo toleran bien. Si tu intolerancia es fuerte, consulta a un profesional antes de usarlo.'],
      ['¿Cuántas porciones al día?', 'Una o dos, según tu meta de proteína y lo que ya comes. No reemplaza las comidas.'],
    ],
  },
  {
    slug: 'creatina-monohidratada',
    nombre: 'Creatina Monohidratada',
    categoria: 'rendimiento',
    precio: 99900,
    porciones: 60,
    forma: 'tarro',
    presentacion: '300 g, 60 porciones',
    resumen: 'Creatina monohidratada micronizada, 5 g por porción y un solo ingrediente.',
    descripcion:
      'Creatina monohidratada micronizada, sin sabor y sin aditivos. Es el suplemento con más estudios para fuerza y potencia en entrenamientos cortos e intensos. Una porción de 5 g al día, sin fase de carga.',
    beneficios: [
      'Un solo ingrediente: creatina monohidratada.',
      'Micronizada para que se disuelva rápido.',
      'Sin sabor: va en agua, jugo o tu batido.',
    ],
    datos: [
      { k: 'Creatina', v: '5 g', por: 'por porción' },
      { k: 'Ingredientes', v: '1', por: 'creatina monohidratada' },
      { k: 'Porciones', v: '60', por: 'dos meses con una al día' },
      { k: 'Análisis', v: 'Por lote', por: 'laboratorio independiente' },
    ],
    nutricion: [['Porción', '5 g'], ['Creatina monohidratada', '5 g'], ['Energía', '0 kcal']],
    uso: 'Mezcla 5 g con agua o tu batido una vez al día, cualquier día de la semana. La constancia importa más que la hora.',
    palabrasClave: ['creatina monohidratada', 'creatina micronizada Colombia', 'cómo tomar creatina'],
    sabores: [
      { slug: 'sin-sabor', nombre: 'Sin sabor', c1: '#cfd4dc', c2: '#6c7380' },
      { slug: 'limon', nombre: 'Limón', c1: '#d8e05c', c2: '#7b861f' },
      { slug: 'mora', nombre: 'Mora', c1: '#80469a', c2: '#3a1c4d' },
    ],
    faq: [
      ['¿Necesito fase de carga?', 'No es necesaria. Con 5 g al día los depósitos se llenan en unas semanas.'],
      ['¿La tomo los días que no entreno?', 'Sí. Tomarla todos los días mantiene los niveles estables.'],
    ],
  },
  {
    slug: 'pre-entreno-pulse',
    nombre: 'Pre-entreno Pulse',
    categoria: 'rendimiento',
    precio: 129900,
    porciones: 30,
    forma: 'lata',
    presentacion: '300 g, 30 porciones',
    resumen: '200 mg de cafeína, 6 g de citrulina y beta-alanina para entrenar con foco.',
    descripcion:
      'Pre-entreno con dosis declaradas: 200 mg de cafeína, 6 g de citrulina malato y 3,2 g de beta-alanina. Energía y foco sin bajón fuerte al terminar. Sin azúcar y sin colorantes artificiales.',
    beneficios: [
      'Dosis completas y declaradas, sin mezclas ocultas.',
      '200 mg de cafeína: energía sin exagerar.',
      'Sin azúcar ni colorantes artificiales.',
    ],
    datos: [
      { k: 'Cafeína', v: '200 mg', por: 'por porción' },
      { k: 'Citrulina malato', v: '6 g', por: 'para el bombeo' },
      { k: 'Beta-alanina', v: '3,2 g', por: 'puede dar hormigueo leve' },
      { k: 'Azúcar', v: '0 g', por: 'endulzado con sucralosa' },
    ],
    nutricion: [['Porción', '10 g'], ['Cafeína', '200 mg'], ['Citrulina malato', '6 g'], ['Beta-alanina', '3,2 g'], ['Energía', '5 kcal']],
    uso: 'Mezcla 1 scoop (10 g) con 300 ml de agua 20 a 30 minutos antes de entrenar. No lo tomes en las 6 horas antes de dormir.',
    palabrasClave: ['pre entreno', 'pre workout Colombia', 'pre entreno con cafeína'],
    sabores: [
      { slug: 'mango', nombre: 'Mango', c1: '#f29a1c', c2: '#9c5300' },
      { slug: 'sandia', nombre: 'Sandía', c1: '#ea4f66', c2: '#851d37' },
      { slug: 'uva', nombre: 'Uva', c1: '#7e55c9', c2: '#352072' },
    ],
    faq: [
      ['¿Es normal el hormigueo?', 'Sí. Lo produce la beta-alanina, es inofensivo y pasa en unos minutos.'],
      ['¿Quién no debe tomarlo?', 'Menores de 18 años, personas embarazadas o sensibles a la cafeína. Si tienes una condición de salud, consulta primero.'],
    ],
  },
  {
    slug: 'bcaa-2-1-1',
    nombre: 'BCAA 2:1:1',
    categoria: 'rendimiento',
    precio: 109900,
    porciones: 40,
    forma: 'lata',
    presentacion: '280 g, 40 porciones',
    resumen: '7 g de aminoácidos ramificados con electrolitos para entrenar e hidratarte.',
    descripcion:
      'Aminoácidos ramificados en proporción 2:1:1 con sodio y potasio. Una bebida ligera para tomar mientras entrenas, sin azúcar y con sabores suaves.',
    beneficios: [
      '7 g de BCAA en proporción 2:1:1.',
      'Con sodio y potasio para sesiones largas.',
      'Sabor suave, sin azúcar.',
    ],
    datos: [
      { k: 'BCAA', v: '7 g', por: 'leucina, isoleucina, valina' },
      { k: 'Electrolitos', v: 'Na + K', por: 'para sesiones largas' },
      { k: 'Porciones', v: '40', por: 'por envase' },
      { k: 'Azúcar', v: '0 g', por: 'endulzado con sucralosa' },
    ],
    nutricion: [['Porción', '7 g'], ['L-leucina', '3,5 g'], ['L-isoleucina', '1,75 g'], ['L-valina', '1,75 g'], ['Sodio', '150 mg']],
    uso: 'Mezcla 1 scoop en 500 ml de agua y tómalo durante el entrenamiento.',
    palabrasClave: ['bcaa', 'aminoácidos ramificados', 'bcaa 2:1:1 Colombia'],
    sabores: [
      { slug: 'limonada', nombre: 'Limonada', c1: '#efdc49', c2: '#97850b' },
      { slug: 'cereza', nombre: 'Cereza', c1: '#cf3a50', c2: '#6e1226' },
      { slug: 'pina', nombre: 'Piña', c1: '#f2b443', c2: '#9b670c' },
    ],
    faq: [
      ['¿Necesito BCAA si tomo proteína?', 'Si ya cubres tu proteína diaria, el beneficio extra es pequeño. Es útil para hidratarte con sabor en sesiones largas.'],
      ['¿Lo puedo tomar en ayunas?', 'Sí, se tolera bien con el estómago vacío.'],
    ],
  },
  {
    slug: 'barras-proteicas',
    nombre: 'Barras Proteicas',
    categoria: 'proteinas',
    precio: 89900,
    porciones: 12,
    forma: 'caja',
    presentacion: 'Caja de 12 barras de 60 g',
    resumen: '20 g de proteína por barra y solo 2 g de azúcar. Para llevar en la maleta.',
    descripcion:
      'Barras con 20 g de proteína y 2 g de azúcar, con textura suave y cobertura de chocolate. Un snack para el trabajo, la universidad o después del gimnasio.',
    beneficios: [
      '20 g de proteína en cada barra.',
      'Solo 2 g de azúcar.',
      'Empaque individual, fácil de llevar.',
    ],
    datos: [
      { k: 'Proteína', v: '20 g', por: 'por barra' },
      { k: 'Azúcar', v: '2 g', por: 'por barra' },
      { k: 'Unidades', v: '12', por: 'barras de 60 g' },
      { k: 'Fibra', v: '6 g', por: 'por barra' },
    ],
    nutricion: [['Porción', '1 barra (60 g)'], ['Energía', '210 kcal'], ['Proteína', '20 g'], ['Azúcar', '2 g'], ['Fibra', '6 g']],
    uso: 'Una barra como snack entre comidas o después de entrenar.',
    palabrasClave: ['barras de proteína', 'barra proteica sin azúcar', 'snack proteico'],
    sabores: [
      { slug: 'cacao', nombre: 'Cacao', c1: '#5a3426', c2: '#25120a' },
      { slug: 'mani', nombre: 'Maní', c1: '#cf9548', c2: '#784b10' },
      { slug: 'coco', nombre: 'Coco', c1: '#e6ddcb', c2: '#a3957a' },
    ],
    faq: [
      ['¿Contienen gluten?', 'Se fabrican en una planta que procesa gluten. No son aptas para personas celíacas.'],
      ['¿Cuánto duran?', 'Nueve meses desde la fabricación. La fecha está en cada empaque.'],
    ],
  },
  {
    slug: 'shaker-halo',
    nombre: 'Shaker Halo 700 ml',
    categoria: 'accesorios',
    precio: 39900,
    porciones: null,
    forma: 'shaker',
    presentacion: '700 ml',
    resumen: 'Tapa de rosca antiderrame y bolita mezcladora de acero. Va al lavavajillas.',
    descripcion:
      'Shaker de 700 ml en tritán libre de BPA, con tapa de rosca que no gotea y bolita de acero para mezclar sin grumos. Las marcas de volumen están grabadas, no se borran.',
    beneficios: [
      'Tapa de rosca que no gotea en la maleta.',
      'Bolita de acero inoxidable incluida.',
      'Apto para lavavajillas.',
    ],
    datos: [
      { k: 'Capacidad', v: '700 ml', por: 'marcas grabadas' },
      { k: 'Material', v: 'Tritán', por: 'libre de BPA' },
      { k: 'Mezclador', v: 'Acero', por: 'inoxidable' },
      { k: 'Lavado', v: 'Lavavajillas', por: 'en la bandeja superior' },
    ],
    nutricion: null,
    uso: 'Agrega primero el líquido y luego el polvo. Cierra bien la tapa y agita 10 segundos.',
    palabrasClave: ['shaker para proteína', 'shaker 700 ml', 'mezclador de proteína'],
    sabores: [
      { slug: 'grafito', nombre: 'Grafito', c1: '#3b3f47', c2: '#15171b' },
      { slug: 'plata', nombre: 'Plata', c1: '#d4d8df', c2: '#7c838f' },
      { slug: 'naranja', nombre: 'Naranja', c1: '#ef6a2f', c2: '#8c3311' },
    ],
    faq: [
      ['¿Guarda olor?', 'El tritán no absorbe olores si lo lavas el mismo día.'],
      ['¿Sirve para bebidas calientes?', 'No. Úsalo solo con líquidos fríos o a temperatura ambiente.'],
    ],
  },
];

// Reseñas de ejemplo. Con reseñas reales, conectar aquí la fuente (plataforma de reseñas o base de datos).
export const resenas = {
  'whey-isolate': [
    { autor: 'Camila Restrepo', ciudad: 'Medellín', rating: 5, fecha: '2026-08-14', texto: 'Se mezcla sin grumos y no me cae pesada. Llevo seis meses con la de chocolate.' },
    { autor: 'Andrés Moreno', ciudad: 'Bogotá', rating: 5, fecha: '2026-07-30', texto: 'Buen sabor sin ser empalagosa. Me gusta que digan cuánto trae cada porción.' },
    { autor: 'Laura Peñaloza', ciudad: 'Cali', rating: 4, fecha: '2026-07-02', texto: 'La de vainilla es muy buena con avena. Le doy cuatro porque quisiera un tarro más grande.' },
  ],
  'creatina-monohidratada': [
    { autor: 'Julián Ospina', ciudad: 'Pereira', rating: 5, fecha: '2026-08-21', texto: 'Una cucharada en el batido y listo. Se disuelve rápido.' },
    { autor: 'Daniela Vargas', ciudad: 'Bogotá', rating: 5, fecha: '2026-06-11', texto: 'Sin sabor de verdad, no cambia el gusto del jugo.' },
  ],
  'pre-entreno-pulse': [
    { autor: 'Sebastián Gil', ciudad: 'Barranquilla', rating: 5, fecha: '2026-08-02', texto: 'Me da energía sin ponerme nervioso. El de mango es el mejor.' },
    { autor: 'Natalia Ortiz', ciudad: 'Bucaramanga', rating: 4, fecha: '2026-07-19', texto: 'Funciona bien. El hormigueo al principio me sorprendió, pero pasa rápido.' },
  ],
  'bcaa-2-1-1': [
    { autor: 'Felipe Cárdenas', ciudad: 'Manizales', rating: 4, fecha: '2026-07-08', texto: 'Lo tomo en las salidas largas en bici. La limonada es suave y refrescante.' },
  ],
  'barras-proteicas': [
    { autor: 'Valentina Rojas', ciudad: 'Bogotá', rating: 5, fecha: '2026-08-25', texto: 'Por fin una barra que no sabe a cartón. La de maní es mi favorita.' },
    { autor: 'Mateo Castaño', ciudad: 'Medellín', rating: 4, fecha: '2026-06-29', texto: 'Muy prácticas para la oficina. Un poco duras si están frías.' },
  ],
  'shaker-halo': [
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
    producto: 'creatina-monohidratada',
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
    producto: 'whey-isolate',
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
];
