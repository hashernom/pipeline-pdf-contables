// Modelo de dominio del frontend. Refleja la ficha técnica v4: cada dato extraído
// trae valor, cita literal, folio y estado; el sistema lo verifica y le asigna un
// color. Cuando exista el backend (NestJS + Supabase), estas formas son el contrato.

export type Role = "estudiante" | "coordinador";

export type Semaforo = "verde" | "amarillo" | "rojo";

/** Etapas del pipeline, en orden. */
export type Etapa =
  | "ingesta"
  | "ocr"
  | "localizacion"
  | "extraccion"
  | "verificacion"
  | "revision"
  | "dataset";

export type EstadoEtapa = "pendiente" | "en_curso" | "completa" | "error";

export type TipoVariable = "texto" | "cifra" | "fecha" | "nit" | "porcentaje" | "opcion" | "anio";

export type SeccionVariable =
  | "identificacion"
  | "situacion_financiera"
  | "resultados"
  | "presupuesto"
  | "deuda_indicadores";

export interface Variable {
  key: string;
  nombre: string;
  seccion: SeccionVariable;
  tipo: TipoVariable;
  /** Regla de extracción: "regex" para datos estructurados, "llm" para el resto. */
  metodo: "regla" | "llm";
  /** Descripción de la regla tal como la aprueba el equipo en Fase 0. */
  regla: string;
  /** Campo crítico: doble pasada del LLM. */
  critica: boolean;
  opciones?: string[];
  /** Palabras clave que usa la etapa de localización. */
  palabrasClave: string[];
  estado: "borrador" | "aprobada";
}

/** Caja en puntos PDF, origen arriba-izquierda. */
export interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ResultadoCheck = "pasa" | "alerta" | "falla" | "no_aplica";

export type TipoCheck =
  | "cita_en_pagina"
  | "valor_de_cita"
  | "formato"
  | "coherencia"
  | "doble_pasada"
  | "confianza_ocr";

export interface Check {
  tipo: TipoCheck;
  resultado: ResultadoCheck;
  detalle: string;
}

export type EstadoExtraccion = "ENCONTRADO" | "NO_ENCONTRADO";

export type EstadoRevision = "pendiente" | "confirmado" | "corregido" | "no_encontrado";

export interface Extraccion {
  variableKey: string;
  estado: EstadoExtraccion;
  /** Valor normalizado como texto (cifras sin separadores, fechas ISO). */
  valor: string | null;
  /** Valor tal como aparece en el documento. */
  valorDocumento: string | null;
  cita: string | null;
  folio: number | null;
  caja: Caja | null;
  /** Confianza media del OCR en la cita (0-1). null si la página es digital. */
  confianzaOcr: number | null;
  metodo: "regla" | "llm";
  checks: Check[];
  semaforo: Semaforo;
  /** Incluido en la auditoría aleatoria de verdes. */
  auditoria: boolean;
}

export interface Pagina {
  n: number;
  tipo: "digital" | "escaneada";
  titulo: string;
  /** Marcada por la etapa de localización como relevante. */
  localizada: boolean;
  confianzaOcr: number | null;
}

export interface Estudiante {
  id: string;
  nombre: string;
  iniciales: string;
  grupo: string;
}

export interface Documento {
  id: string;
  entidad: string;
  departamento: string;
  nit: string;
  vigencia: number;
  archivo: string;
  /** PDF servido al visor. */
  pdfUrl: string | null;
  folios: number;
  foliosEscaneados: number;
  tamanoMb: number;
  subidoEl: string;
  lote: string;
  etapa: Etapa;
  estadoEtapa: EstadoEtapa;
  errorEtapa?: string;
  asignadoA: string | null;
  conteo: Record<Semaforo, number>;
  /** Variables ya resueltas por el estudiante. */
  revisadas: number;
  totalVariables: number;
  actualizadoEl: string;
}

export interface Correccion {
  id: string;
  documentoId: string;
  variableKey: string;
  estudianteId: string;
  antes: string | null;
  despues: string | null;
  folio: number | null;
  motivo: string;
  tipo: "correccion" | "no_encontrado" | "confirmacion_auditoria";
  fecha: string;
}

export interface LoteIngesta {
  id: string;
  nombre: string;
  subidoPor: string;
  fecha: string;
  archivos: number;
  procesados: number;
  conError: number;
}

export interface ResumenEtapa {
  etapa: Etapa;
  pendiente: number;
  enCurso: number;
  completa: number;
  error: number;
}
