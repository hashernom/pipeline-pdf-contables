import type {
  Correccion,
  Documento,
  Estudiante,
  Etapa,
  Extraccion,
  LoteIngesta,
  Pagina,
  ResumenEtapa,
  Semaforo,
  Variable,
} from "@/lib/types";
import { VARIABLES } from "@/lib/mock/variables";
import {
  CORRECCIONES,
  DOCUMENTOS,
  DOCUMENTO_POR_ID,
  ESTUDIANTES,
  ESTUDIANTE_ACTUAL,
  LOTES,
  ORDEN_ETAPAS,
  slugDe,
} from "@/lib/mock/documentos";
import { construirExtracciones, paginasDe } from "@/lib/mock/extracciones";
import { formatCifra } from "@/lib/format";

// Capa de datos del frontend. HOY responde con mocks en memoria; cuando exista la
// API (NestJS) cada función se reemplaza por su llamada HTTP sin tocar las páginas.
// Mantener las firmas async aunque el mock sea síncrono.

export interface FiltroDocumentos {
  q?: string;
  etapa?: Etapa | "todas";
  semaforo?: Semaforo | "todos";
  asignado?: string | "sin_asignar" | "todos";
  estado?: "error" | "todos";
}

export async function listarDocumentos(f: FiltroDocumentos = {}): Promise<Documento[]> {
  const q = f.q?.trim().toLowerCase();
  return DOCUMENTOS.filter((d) => {
    if (q && !`${d.entidad} ${d.departamento} ${d.nit} ${d.id}`.toLowerCase().includes(q)) return false;
    if (f.etapa && f.etapa !== "todas" && d.etapa !== f.etapa) return false;
    if (f.semaforo && f.semaforo !== "todos" && d.conteo[f.semaforo] === 0) return false;
    if (f.asignado === "sin_asignar" && d.asignadoA) return false;
    if (f.asignado && !["todos", "sin_asignar"].includes(f.asignado) && d.asignadoA !== f.asignado) return false;
    if (f.estado === "error" && d.estadoEtapa !== "error") return false;
    return true;
  });
}

export async function obtenerDocumento(id: string): Promise<Documento | null> {
  return DOCUMENTO_POR_ID.get(id) ?? null;
}

export async function idsDocumentosConPdf(): Promise<string[]> {
  return DOCUMENTOS.filter((d) => d.pdfUrl).map((d) => d.id);
}

export async function obtenerExtracciones(documentoId: string): Promise<Extraccion[]> {
  const doc = DOCUMENTO_POR_ID.get(documentoId);
  const slug = doc && slugDe(doc);
  return slug ? construirExtracciones(slug) : [];
}

export async function obtenerPaginas(documentoId: string): Promise<Pagina[]> {
  const doc = DOCUMENTO_POR_ID.get(documentoId);
  const slug = doc && slugDe(doc);
  if (slug) return paginasDe(slug);
  if (!doc) return [];
  // Documento sin PDF de demostración: páginas sintéticas para la vista de detalle.
  return Array.from({ length: doc.folios }, (_, i) => ({
    n: i + 1,
    tipo: i % 7 < Math.round((doc.foliosEscaneados / doc.folios) * 7) ? "escaneada" : "digital",
    titulo: "",
    localizada: [3, 4, 12, 13, 14, 15, 41, 42, 88, 89, 90, 131].includes(i + 1),
    confianzaOcr: null,
  }));
}

export async function listarVariables(): Promise<Variable[]> {
  return VARIABLES;
}

export async function listarEstudiantes(): Promise<Estudiante[]> {
  return ESTUDIANTES;
}

export async function estudianteActual(): Promise<Estudiante> {
  return ESTUDIANTES.find((e) => e.id === ESTUDIANTE_ACTUAL)!;
}

export async function colaDeEstudiante(estudianteId: string): Promise<Documento[]> {
  return DOCUMENTOS.filter((d) => d.asignadoA === estudianteId);
}

export async function listarCorrecciones(f: { documentoId?: string } = {}): Promise<Correccion[]> {
  return f.documentoId ? CORRECCIONES.filter((c) => c.documentoId === f.documentoId) : CORRECCIONES;
}

export async function listarLotes(): Promise<LoteIngesta[]> {
  return LOTES;
}

export async function resumenPipeline(): Promise<ResumenEtapa[]> {
  return ORDEN_ETAPAS.map((etapa, idx) => {
    const r: ResumenEtapa = { etapa, pendiente: 0, enCurso: 0, completa: 0, error: 0 };
    for (const d of DOCUMENTOS) {
      const di = ORDEN_ETAPAS.indexOf(d.etapa);
      if (di > idx) r.completa += 1;
      else if (di === idx) {
        if (d.estadoEtapa === "error") r.error += 1;
        else if (d.estadoEtapa === "completa") r.completa += 1;
        else if (d.estadoEtapa === "en_curso") r.enCurso += 1;
        else r.pendiente += 1;
      }
    }
    return r;
  });
}

/** Cifra pseudoaleatoria determinista en [min, max). */
function cifraSintetica(semilla: number, min: number, max: number): number {
  let t = (semilla + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return Math.round(min + u * (max - min));
}

export interface MuestraAuditoria {
  id: string;
  documentoId: string;
  entidad: string;
  vigencia: number;
  variableKey: string;
  valor: string;
  /** Cita literal con la que se confirmó el verde. */
  cita: string;
  folio: number;
  /** URL del visor cuando el documento tiene PDF disponible. */
  pdfUrl: string | null;
  estudianteId: string;
  resultado: "pendiente" | "coincide" | "discrepancia";
}

/** Muestra aleatoria de verdes ya confirmados (mock determinista). */
export async function muestraAuditoria(): Promise<MuestraAuditoria[]> {
  const cifras = VARIABLES.filter((v) => v.tipo === "cifra");
  const docs = DOCUMENTOS.filter((d) => d.etapa === "dataset").slice(0, 60);
  return docs.flatMap((d, i) =>
    [0, 1].map((k) => {
      const v = cifras[(i * 7 + k * 11) % cifras.length];
      const semilla = (i * 31 + k * 17) % 100;
      const valor = String(cifraSintetica(i * 3 + k, 1e9, 9e10));
      return {
        id: `aud-${d.id}-${k}`,
        documentoId: d.id,
        entidad: d.entidad,
        vigencia: d.vigencia,
        variableKey: v.key,
        valor,
        cita: `${v.nombre} ${formatCifra(valor)}`,
        folio: 6 + ((i * 13 + k * 5) % 160),
        pdfUrl: d.pdfUrl,
        estudianteId: d.asignadoA ?? ESTUDIANTES[i % ESTUDIANTES.length].id,
        resultado: semilla < 55 ? "pendiente" : semilla < 99 ? "coincide" : "discrepancia",
      } satisfies MuestraAuditoria;
    }),
  );
}

export interface FilaDataset {
  documento: Documento;
  valores: Record<string, string | null>;
}

/** Valores aprobados por documento (mock determinista y contablemente coherente). */
export async function filasDataset(): Promise<FilaDataset[]> {
  return DOCUMENTOS.filter((d) => d.etapa === "dataset").map((d, i) => {
    const n = (k: number) => cifraSintetica(i * 97 + k, 1e9, 6e10);
    const ac = n(1);
    const anc = n(2) * 3;
    const pc = Math.round(ac * 0.7);
    const pnc = Math.round(anc * 0.15);
    const recaudo = n(7) * 2;
    const oblig = Math.round(recaudo * 0.93);
    const valores: Record<string, string | null> = {
      entidad: d.entidad,
      departamento: d.departamento,
      nit: d.nit,
      categoria: ["Cuarta", "Quinta", "Sexta"][i % 3],
      vigencia: String(d.vigencia),
      fecha_corte: `${d.vigencia}-12-31`,
      fecha_firma: `${d.vigencia + 1}-02-${String(10 + (i % 18)).padStart(2, "0")}`,
      representante_legal: null,
      contador: null,
      opinion: ["Limpia", "Limpia", "Con salvedades", "Abstención"][i % 4],
      activo_corriente: String(ac),
      activo_no_corriente: String(anc),
      activo_total: String(ac + anc),
      pasivo_corriente: String(pc),
      pasivo_no_corriente: String(pnc),
      pasivo_total: String(pc + pnc),
      patrimonio: String(ac + anc - pc - pnc),
      recaudo: String(recaudo),
      obligaciones: String(oblig),
      superavit: String(recaudo - oblig),
      deuda: i % 5 === 0 ? null : String(n(9)),
      ley617: (cifraSintetica(i * 97 + 3, 480, 860) / 10).toFixed(1),
      chip: i % 9 === 0 ? "No presentado" : "Presentado",
    };
    VARIABLES.forEach((v, k) => {
      if (v.tipo === "cifra" && !(v.key in valores)) valores[v.key] = String(n(20 + k));
    });
    return { documento: d, valores };
  });
}

export async function cargaPorEstudiante(): Promise<
  { estudiante: Estudiante; enRevision: number; enviados: number; pendientesRojo: number; variablesPendientes: number }[]
> {
  return ESTUDIANTES.map((e) => {
    const suyos = DOCUMENTOS.filter((d) => d.asignadoA === e.id);
    const enRevision = suyos.filter((d) => d.etapa === "revision");
    return {
      estudiante: e,
      enRevision: enRevision.length,
      enviados: suyos.filter((d) => d.etapa === "dataset").length,
      pendientesRojo: enRevision.reduce((a, d) => a + d.conteo.rojo, 0),
      variablesPendientes: enRevision.reduce((a, d) => a + (d.totalVariables - d.revisadas), 0),
    };
  });
}
