"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Caja, EstadoRevision, Extraccion } from "@/lib/types";

// Estado local de la revisión de un documento. Hoy se guarda en localStorage;
// con backend, cada acción se envía a la API y queda en el registro de correcciones.

export interface Decision {
  estado: Exclude<EstadoRevision, "pendiente">;
  valor: string | null;
  folio: number | null;
  caja: Caja | null;
  cita: string | null;
  motivo?: string;
  fecha: string;
}

type Decisiones = Record<string, Decision>;

const VACIO: Decisiones = {};
const clave = (docId: string) => `folio:revision:${docId}`;

// Almacén mínimo por documento: caché en memoria + localStorage + suscriptores.
const cache = new Map<string, Decisiones>();
const oyentes = new Map<string, Set<() => void>>();

function leer(docId: string): Decisiones {
  if (!cache.has(docId)) {
    let d: Decisiones = {};
    try {
      const raw = localStorage.getItem(clave(docId));
      if (raw) d = JSON.parse(raw);
    } catch {
      /* almacenamiento no disponible: se trabaja en memoria */
    }
    cache.set(docId, d);
  }
  return cache.get(docId)!;
}

function escribir(docId: string, d: Decisiones) {
  cache.set(docId, d);
  try {
    localStorage.setItem(clave(docId), JSON.stringify(d));
  } catch {
    /* sin persistencia */
  }
  oyentes.get(docId)?.forEach((f) => f());
}

export function useRevision(docId: string, extracciones: Extraccion[]) {
  const suscribir = useCallback(
    (f: () => void) => {
      if (!oyentes.has(docId)) oyentes.set(docId, new Set());
      oyentes.get(docId)!.add(f);
      return () => oyentes.get(docId)!.delete(f);
    },
    [docId],
  );
  const decisiones = useSyncExternalStore(
    suscribir,
    () => leer(docId),
    () => VACIO,
  );

  const decidir = useCallback(
    (key: string, d: Omit<Decision, "fecha">) => escribir(docId, { ...leer(docId), [key]: { ...d, fecha: new Date().toISOString() } }),
    [docId],
  );

  const confirmar = useCallback(
    (e: Extraccion) => decidir(e.variableKey, { estado: "confirmado", valor: e.valor, folio: e.folio, caja: e.caja, cita: e.cita }),
    [decidir],
  );

  const confirmarVarias = useCallback(
    (es: Extraccion[]) => {
      const fecha = new Date().toISOString();
      const n = { ...leer(docId) };
      for (const e of es) n[e.variableKey] = { estado: "confirmado", valor: e.valor, folio: e.folio, caja: e.caja, cita: e.cita, fecha };
      escribir(docId, n);
    },
    [docId],
  );

  const corregir = useCallback(
    (key: string, d: Omit<Decision, "estado" | "fecha">) => decidir(key, { ...d, estado: "corregido" }),
    [decidir],
  );

  const noEncontrado = useCallback(
    (key: string, motivo: string) => decidir(key, { estado: "no_encontrado", valor: null, folio: null, caja: null, cita: null, motivo }),
    [decidir],
  );

  const deshacer = useCallback(
    (key: string) => {
      const n = { ...leer(docId) };
      delete n[key];
      escribir(docId, n);
    },
    [docId],
  );

  /** Valor vigente: la decisión del estudiante si existe, si no lo extraído. */
  const valorVigente = useCallback(
    (key: string) => {
      const d = decisiones[key];
      if (d) return d.valor;
      return extracciones.find((e) => e.variableKey === key)?.valor ?? null;
    },
    [decisiones, extracciones],
  );

  const resueltas = useMemo(() => Object.keys(decisiones).length, [decisiones]);

  return { decisiones, confirmar, confirmarVarias, corregir, noEncontrado, deshacer, valorVigente, resueltas };
}
