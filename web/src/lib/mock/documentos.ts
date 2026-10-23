import type { Correccion, Documento, Estudiante, Etapa, LoteIngesta, Semaforo } from "@/lib/types";
import { nitDigitoVerificacion } from "@/lib/format";
import { VARIABLES } from "./variables";
import { DOCS_PDF, construirExtracciones } from "./extracciones";

// Lote SIMULADO de 1.200 PDFs. Municipios ficticios, generados con una semilla fija
// para que servidor y cliente vean exactamente los mismos datos.

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(20261023);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
const entre = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

export const ESTUDIANTE_ACTUAL = "est-01";

export const ESTUDIANTES: Estudiante[] = [
  ["est-01", "Valentina Rojas Gómez", "Grupo A"],
  ["est-02", "Samuel Ortiz Cárdenas", "Grupo A"],
  ["est-03", "Isabella Moreno Díaz", "Grupo A"],
  ["est-04", "Juan Esteban Prieto", "Grupo A"],
  ["est-05", "Mariana López Quintero", "Grupo B"],
  ["est-06", "Daniel Felipe Vargas", "Grupo B"],
  ["est-07", "Sofía Herrera Ramírez", "Grupo B"],
  ["est-08", "Andrés Camilo Ríos", "Grupo B"],
  ["est-09", "Laura Sofía Medina", "Grupo C"],
  ["est-10", "Tomás Arango Mejía", "Grupo C"],
  ["est-11", "Gabriela Suárez León", "Grupo C"],
  ["est-12", "Nicolás Bermúdez Paz", "Grupo C"],
].map(([id, nombre, grupo]) => ({
  id,
  nombre,
  grupo,
  iniciales: nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join(""),
}));

// La estudiante actual solo recibe los documentos de demostración (y algunos enviados).
const OTROS_ESTUDIANTES = ESTUDIANTES.filter((e) => e.id !== ESTUDIANTE_ACTUAL);

export const COORDINADORA = { nombre: "Mariana Acero", iniciales: "MA" };

const PREFIJOS = ["San", "Santa", "Villa", "Puerto", "La", "El", "Nueva", "Alto", "Valle de"];
const NOMBRES = [
  "Ramón", "Lucía", "Fe", "Rosario", "Esperanza", "Palmar", "Cedral", "Guayabal", "Mirador",
  "Tablón", "Carmen", "Peñón", "Encino", "Laurel", "Retiro", "Naranjal", "Socorro", "Pradera",
  "Cumbre", "Trinidad", "Arenal", "Hato", "Junín", "Mesitas", "Ocobo", "Paramillo", "Quebradas",
  "Remolino", "Sabanal", "Tambo", "Urumita", "Venadillo", "Yarumal Bajo", "Zipacón Alto",
];
const DEPARTAMENTOS = [
  "Antioquia", "Boyacá", "Caldas", "Cauca", "Cesar", "Córdoba", "Cundinamarca", "Huila",
  "Meta", "Nariño", "Santander", "Tolima", "Valle del Cauca", "Norte de Santander", "Sucre",
];

const ORDEN_ETAPAS: Etapa[] = ["ingesta", "ocr", "localizacion", "extraccion", "verificacion", "revision", "dataset"];

// Distribución del lote por etapa (suma 1.200).
const DISTRIBUCION: [Etapa, number][] = [
  ["dataset", 214],
  ["revision", 388],
  ["verificacion", 41],
  ["extraccion", 63],
  ["localizacion", 70],
  ["ocr", 96],
  ["ingesta", 328],
];

const ERRORES: Partial<Record<Etapa, string[]>> = {
  ocr: ["El trabajo de OCR superó el tiempo límite (GPU L4)", "Página 87 ilegible: resolución menor a 150 ppp"],
  localizacion: ["No se encontró el estado de situación financiera"],
  extraccion: ["La respuesta del modelo no cumple el esquema"],
  ingesta: ["El archivo está protegido con contraseña", "El archivo no es un PDF válido"],
};

function conteoDe(slug: string): Record<Semaforo, number> {
  const c = { verde: 0, amarillo: 0, rojo: 0 };
  for (const e of construirExtracciones(slug)) c[e.semaforo] += 1;
  return c;
}

function nitAleatorio(): string {
  const base = String(entre(890100000, 892999999));
  return `${base}${nitDigitoVerificacion(base)}`;
}

function fechaIso(diaOffset: number, hora: number, min: number) {
  // Base fija: 1 oct 2026. Sin Date() en el render.
  const d = new Date(Date.UTC(2026, 9, 1 + diaOffset, hora, min));
  return d.toISOString().slice(0, 19);
}

function construirLote(): Documento[] {
  const docs: Documento[] = [];
  const total = VARIABLES.length;
  let i = 0;

  // Los tres documentos con PDF sintético, asignados a la estudiante actual.
  const demo: [string, string, number][] = [
    ["valle-alto-2025", "doc-0001", 4],
    ["san-ramon-2025", "doc-0002", 0],
    ["la-esperanza-2025", "doc-0003", 0],
  ];
  for (const [slug, id, revisadas] of demo) {
    const g = DOCS_PDF[slug];
    docs.push({
      id,
      entidad: g.entidad,
      departamento: g.departamento,
      nit: g.nit.replace(/\D/g, ""),
      vigencia: g.vigencia,
      archivo: `${slug}.pdf`,
      pdfUrl: `/mock/pdfs/${slug}.pdf`,
      folios: g.pageCount,
      foliosEscaneados: g.pages.filter((p) => p.kind === "escaneada").length,
      tamanoMb: 0.1,
      subidoEl: fechaIso(2, 9, 12),
      lote: "Lote 01 · Boyacá y Santander",
      etapa: "revision",
      estadoEtapa: "en_curso",
      asignadoA: ESTUDIANTE_ACTUAL,
      conteo: conteoDe(slug),
      revisadas,
      totalVariables: total,
      actualizadoEl: fechaIso(21, 16, 40 - i * 7),
    });
    i += 1;
  }

  const lotes = ["Lote 01 · Boyacá y Santander", "Lote 02 · Andina", "Lote 03 · Caribe", "Lote 04 · Llanos y sur"];
  let n = docs.length;
  for (const [etapa, cantidad] of DISTRIBUCION) {
    const restante = etapa === "revision" ? cantidad - demo.length : cantidad;
    for (let k = 0; k < restante; k++) {
      n += 1;
      const vigencia = pick([2023, 2024, 2025]);
      const nombre = `${pick(PREFIJOS)} ${pick(NOMBRES)}`;
      const folios = entre(140, 260);
      const escaneados = rnd() < 0.35 ? entre(20, folios) : entre(0, 6);
      const idx = ORDEN_ETAPAS.indexOf(etapa);
      const conError = !!ERRORES[etapa] && rnd() < 0.08;
      const revisionAvanzada = etapa === "dataset" ? total : etapa === "revision" ? entre(0, total) : 0;
      const rojo = idx >= 4 ? entre(0, 6) : 0;
      const amarillo = idx >= 4 ? entre(2, 11) : 0;
      const asignado =
        etapa === "dataset" || (etapa === "revision" && rnd() < 0.86) ? pick(OTROS_ESTUDIANTES).id : null;
      docs.push({
        id: `doc-${String(n).padStart(4, "0")}`,
        entidad: `Municipio de ${nombre}`,
        departamento: pick(DEPARTAMENTOS),
        nit: nitAleatorio(),
        vigencia,
        archivo: `${nombre.toLowerCase().replace(/[^a-z]+/g, "-")}-${vigencia}.pdf`,
        pdfUrl: null,
        folios,
        foliosEscaneados: escaneados,
        tamanoMb: Math.round((folios * (escaneados > 20 ? 0.42 : 0.06)) * 10) / 10,
        subidoEl: fechaIso(entre(0, 20), entre(7, 18), entre(0, 59)),
        lote: pick(lotes),
        etapa,
        estadoEtapa: conError ? "error" : etapa === "dataset" ? "completa" : etapa === "ingesta" ? "pendiente" : rnd() < 0.5 ? "en_curso" : "pendiente",
        errorEtapa: conError ? pick(ERRORES[etapa]!) : undefined,
        asignadoA: asignado,
        conteo: { rojo, amarillo, verde: idx >= 4 ? total - rojo - amarillo : 0 },
        revisadas: revisionAvanzada,
        totalVariables: total,
        actualizadoEl: fechaIso(entre(10, 22), entre(7, 19), entre(0, 59)),
      });
    }
  }

  // Cola de la estudiante actual: además de los tres en curso, algunos ya enviados.
  let enviados = 0;
  for (const d of docs) {
    if (d.etapa === "dataset" && enviados < 5) {
      d.asignadoA = ESTUDIANTE_ACTUAL;
      enviados += 1;
    }
  }
  return docs;
}

export const DOCUMENTOS: Documento[] = construirLote();
export const DOCUMENTO_POR_ID = new Map(DOCUMENTOS.map((d) => [d.id, d]));

/** Slug del PDF sintético que respalda un documento, si tiene. */
export function slugDe(doc: Documento): string | null {
  return doc.pdfUrl ? doc.archivo.replace(/\.pdf$/, "") : null;
}

export const LOTES: LoteIngesta[] = [
  { id: "lote-04", nombre: "Lote 04 · Llanos y sur", subidoPor: "Santiago Afanador", fecha: fechaIso(20, 10, 5), archivos: 300, procesados: 41, conError: 3 },
  { id: "lote-03", nombre: "Lote 03 · Caribe", subidoPor: "Mariana Acero", fecha: fechaIso(14, 15, 22), archivos: 300, procesados: 188, conError: 6 },
  { id: "lote-02", nombre: "Lote 02 · Andina", subidoPor: "Mariana Acero", fecha: fechaIso(8, 9, 40), archivos: 300, procesados: 276, conError: 4 },
  { id: "lote-01", nombre: "Lote 01 · Boyacá y Santander", subidoPor: "Santiago Afanador", fecha: fechaIso(2, 9, 12), archivos: 300, procesados: 300, conError: 2 },
];

const MOTIVOS = [
  "El OCR confundió un 3 con un 8",
  "La cifra correcta está en el folio siguiente",
  "El modelo tomó el subtotal en lugar del total",
  "La fecha corresponde a la vigencia anterior",
  "La cita no existe en el documento; se ubicó el dato real",
  "El documento no reporta el dato",
  "Faltaba el signo negativo (cifra entre paréntesis)",
];

function construirCorrecciones(): Correccion[] {
  const out: Correccion[] = [];
  const conDatos = DOCUMENTOS.filter((d) => d.etapa === "dataset" || (d.etapa === "revision" && d.revisadas > 0));
  for (let k = 0; k < 64; k++) {
    const d = pick(conDatos);
    const v = pick(VARIABLES.filter((x) => x.tipo === "cifra"));
    const base = entre(1_000_000_000, 90_000_000_000);
    const tipo = rnd() < 0.12 ? "no_encontrado" : rnd() < 0.15 ? "confirmacion_auditoria" : "correccion";
    out.push({
      id: `cor-${k + 1}`,
      documentoId: d.id,
      variableKey: v.key,
      estudianteId: d.asignadoA ?? pick(ESTUDIANTES).id,
      antes: tipo === "no_encontrado" ? null : String(base),
      despues: tipo === "no_encontrado" ? null : tipo === "confirmacion_auditoria" ? String(base) : String(base + entre(-9, 9) * 10 ** entre(2, 6)),
      folio: tipo === "no_encontrado" ? null : entre(6, 180),
      motivo: tipo === "confirmacion_auditoria" ? "Auditoría de verde: el valor coincide" : tipo === "no_encontrado" ? MOTIVOS[5] : pick(MOTIVOS.filter((_, i) => i !== 5)),
      tipo,
      fecha: fechaIso(entre(9, 22), entre(7, 20), entre(0, 59)),
    });
  }
  return out.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export const CORRECCIONES: Correccion[] = construirCorrecciones();
export { ORDEN_ETAPAS };
