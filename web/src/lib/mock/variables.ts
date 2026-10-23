import type { SeccionVariable, Variable } from "@/lib/types";

// Catálogo BORRADOR de variables. La Fase 0 define la lista real (30-40 variables
// con tipo y regla); esto solo sirve para construir la interfaz.

export const SECCIONES: { key: SeccionVariable; nombre: string }[] = [
  { key: "identificacion", nombre: "Identificación" },
  { key: "situacion_financiera", nombre: "Situación financiera" },
  { key: "resultados", nombre: "Resultados" },
  { key: "presupuesto", nombre: "Ejecución presupuestal" },
  { key: "deuda_indicadores", nombre: "Deuda e indicadores" },
];

type Def = Omit<Variable, "estado" | "palabrasClave"> & { palabrasClave?: string[]; estado?: Variable["estado"] };

const cifra = (key: string, nombre: string, seccion: SeccionVariable, critica = false, palabrasClave: string[] = []): Def => ({
  key,
  nombre,
  seccion,
  tipo: "cifra",
  metodo: "regla",
  regla: `Fila «${nombre}» del estado; cifra en pesos, paréntesis = negativo`,
  critica,
  palabrasClave,
});

const DEFS: Def[] = [
  { key: "entidad", nombre: "Entidad", seccion: "identificacion", tipo: "texto", metodo: "llm", regla: "Nombre oficial del municipio en la portada", critica: false, palabrasClave: ["municipio de"] },
  { key: "departamento", nombre: "Departamento", seccion: "identificacion", tipo: "texto", metodo: "regla", regla: "Texto tras «Departamento de»", critica: false, palabrasClave: ["departamento de"] },
  { key: "nit", nombre: "NIT", seccion: "identificacion", tipo: "nit", metodo: "regla", regla: "\\d{3}\\.\\d{3}\\.\\d{3}-\\d con dígito de verificación", critica: true, palabrasClave: ["nit"] },
  { key: "categoria", nombre: "Categoría municipal", seccion: "identificacion", tipo: "opcion", metodo: "regla", regla: "Categoría según Ley 617 de 2000", critica: false, opciones: ["Especial", "Primera", "Segunda", "Tercera", "Cuarta", "Quinta", "Sexta"], palabrasClave: ["categoría", "ley 617"] },
  { key: "vigencia", nombre: "Vigencia", seccion: "identificacion", tipo: "anio", metodo: "regla", regla: "Año fiscal reportado", critica: true, palabrasClave: ["vigencia"] },
  { key: "fecha_corte", nombre: "Fecha de corte", seccion: "identificacion", tipo: "fecha", metodo: "regla", regla: "Fecha tras «Fecha de corte» o «A 31 de diciembre»", critica: false, palabrasClave: ["fecha de corte", "a 31 de diciembre"] },
  { key: "fecha_firma", nombre: "Fecha de firma", seccion: "identificacion", tipo: "fecha", metodo: "llm", regla: "Fecha en que se firma la certificación", critica: false, palabrasClave: ["se firma", "certificamos"] },
  { key: "representante_legal", nombre: "Representante legal", seccion: "identificacion", tipo: "texto", metodo: "llm", regla: "Nombre sobre «Representante legal»", critica: false, palabrasClave: ["representante legal", "alcalde"] },
  { key: "contador", nombre: "Contador y tarjeta profesional", seccion: "identificacion", tipo: "texto", metodo: "llm", regla: "Nombre del contador y su T.P.", critica: false, palabrasClave: ["contador público", "t.p."] },
  { key: "opinion", nombre: "Opinión del dictamen", seccion: "identificacion", tipo: "opcion", metodo: "llm", regla: "Tipo de opinión emitida en el dictamen", critica: true, opciones: ["Limpia", "Con salvedades", "Adversa", "Abstención"], palabrasClave: ["opinión", "dictamen"] },

  cifra("efectivo", "Efectivo y equivalentes", "situacion_financiera", false, ["efectivo y equivalentes"]),
  cifra("cxc_impuestos", "Cuentas por cobrar · impuestos", "situacion_financiera", false, ["cuentas por cobrar"]),
  cifra("activo_corriente", "Activo corriente", "situacion_financiera", false, ["total activo corriente"]),
  cifra("ppe", "Propiedades, planta y equipo", "situacion_financiera", false, ["propiedades, planta y equipo"]),
  cifra("activo_no_corriente", "Activo no corriente", "situacion_financiera", false, ["total activo no corriente"]),
  cifra("activo_total", "Activo total", "situacion_financiera", true, ["total activo"]),
  cifra("pasivo_corriente", "Pasivo corriente", "situacion_financiera", false, ["total pasivo corriente"]),
  cifra("pasivo_no_corriente", "Pasivo no corriente", "situacion_financiera", false, ["total pasivo no corriente"]),
  cifra("pasivo_total", "Pasivo total", "situacion_financiera", true, ["total pasivo"]),
  cifra("patrimonio", "Patrimonio", "situacion_financiera", true, ["total patrimonio"]),

  cifra("ingresos_fiscales", "Ingresos fiscales", "resultados", false, ["ingresos fiscales"]),
  cifra("transferencias", "Transferencias y subvenciones", "resultados", false, ["transferencias"]),
  cifra("gastos_admin", "Gastos de administración", "resultados", false, ["gastos de administración"]),
  cifra("gasto_social", "Gasto público social", "resultados", false, ["gasto público social"]),
  cifra("resultado", "Resultado del ejercicio", "resultados", true, ["resultado del ejercicio"]),

  cifra("ppto_ingresos", "Presupuesto definitivo de ingresos", "presupuesto", false, ["presupuesto definitivo"]),
  cifra("recaudo", "Recaudo", "presupuesto", false, ["recaudo"]),
  cifra("ppto_gastos", "Presupuesto definitivo de gastos", "presupuesto", false, ["presupuesto definitivo de gastos"]),
  cifra("compromisos", "Compromisos", "presupuesto", false, ["compromisos"]),
  cifra("obligaciones", "Obligaciones", "presupuesto", false, ["obligaciones"]),
  cifra("pagos", "Pagos", "presupuesto", false, ["pagos"]),
  cifra("superavit", "Superávit o déficit presupuestal", "presupuesto", true, ["superávit", "déficit"]),

  cifra("deuda", "Saldo de deuda pública", "deuda_indicadores", false, ["deuda pública", "crédito público"]),
  { key: "ley617", nombre: "Indicador Ley 617", seccion: "deuda_indicadores", tipo: "porcentaje", metodo: "regla", regla: "Porcentaje de gastos de funcionamiento sobre ICLD", critica: false, palabrasClave: ["ley 617", "gastos de funcionamiento"] },
  { key: "chip", nombre: "Estado del reporte CHIP", seccion: "deuda_indicadores", tipo: "opcion", metodo: "llm", regla: "Si el reporte CHIP fue presentado a la CGN", critica: false, opciones: ["Presentado", "No presentado"], palabrasClave: ["chip", "contaduría general"] },
];

export const VARIABLES: Variable[] = DEFS.map((d, i) => ({
  palabrasClave: [],
  // Las primeras de identificación quedan aprobadas; el resto sigue en borrador.
  estado: i < 6 ? "aprobada" : "borrador",
  ...d,
}));

export const VARIABLE_POR_KEY = new Map(VARIABLES.map((v) => [v.key, v]));
