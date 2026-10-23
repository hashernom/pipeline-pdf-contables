import type { Etapa, Semaforo, TipoCheck } from "@/lib/types";

export const ETAPAS: { key: Etapa; nombre: string; descripcion: string; herramienta: string }[] = [
  { key: "ingesta", nombre: "Ingesta", descripcion: "PDF guardado y en cola", herramienta: "Supabase Storage · BullMQ" },
  { key: "ocr", nombre: "Texto y OCR", descripcion: "Texto directo u OCR por página", herramienta: "PyMuPDF · PaddleOCR (L4)" },
  { key: "localizacion", nombre: "Localización", descripcion: "Folios donde están las variables", herramienta: "Palabras clave y regex" },
  { key: "extraccion", nombre: "Extracción", descripcion: "Reglas y LLM, siempre con cita", herramienta: "Python · DeepSeek V4.1 Flash" },
  { key: "verificacion", nombre: "Verificación", descripcion: "Cada dato recibe su color", herramienta: "Pydantic · rapidfuzz" },
  { key: "revision", nombre: "Revisión", descripcion: "Estudiantes validan con el PDF", herramienta: "Next.js · PDF.js" },
  { key: "dataset", nombre: "Dataset final", descripcion: "Valores aprobados", herramienta: "Postgres" },
];

export const NOMBRE_ETAPA = Object.fromEntries(ETAPAS.map((e) => [e.key, e.nombre])) as Record<Etapa, string>;

export const SEMAFORO: Record<Semaforo, { nombre: string; accion: string }> = {
  rojo: { nombre: "Rojo", accion: "Corrección manual" },
  amarillo: { nombre: "Amarillo", accion: "Revisión obligatoria" },
  verde: { nombre: "Verde", accion: "Confirmación rápida" },
};

export const NOMBRE_CHECK: Record<TipoCheck, string> = {
  cita_en_pagina: "Cita en el folio",
  valor_de_cita: "Valor sale de la cita",
  formato: "Formato",
  coherencia: "Coherencia contable",
  doble_pasada: "Doble pasada",
  confianza_ocr: "Confianza OCR",
};
