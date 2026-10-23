"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import type { Documento, Estudiante } from "@/lib/types";
import { NOMBRE_ETAPA } from "@/lib/etapas";
import { Boton } from "@/components/ui/base";

/** Asignación y reproceso. Mock: cambia estado local; con API, PATCH /documentos/:id. */
export function AccionesDocumento({ documento, estudiantes }: { documento: Documento; estudiantes: Estudiante[] }) {
  const [asignado, setAsignado] = useState(documento.asignadoA ?? "");
  const [guardado, setGuardado] = useState<string | null>(null);
  const [reproceso, setReproceso] = useState(false);
  const puedeAsignar = documento.etapa === "revision";

  return (
    <div className="grid gap-4">
      <label className="grid gap-1">
        <span className="text-2xs font-semibold text-ink-2">Asignado a</span>
        <select
          value={asignado}
          disabled={!puedeAsignar}
          onChange={(e) => {
            setAsignado(e.target.value);
            const est = estudiantes.find((x) => x.id === e.target.value);
            setGuardado(est ? `Asignado a ${est.nombre}` : "Sin asignar");
          }}
          className="h-8 rounded-md border border-line-strong bg-sheet px-2.5 text-[0.8125rem] text-ink disabled:opacity-60"
        >
          <option value="">Sin asignar</option>
          {estudiantes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre} · {e.grupo}
            </option>
          ))}
        </select>
        <span className="text-2xs text-ink-3" role="status">
          {!puedeAsignar
            ? "Se asigna cuando el documento llega a revisión."
            : guardado ?? "El documento aparece al instante en la cola de quien lo revise."}
        </span>
      </label>

      {documento.estadoEtapa === "error" && (
        <div className="grid gap-2 rounded-md border border-rojo-line bg-rojo-bg/50 p-3">
          <p className="text-xs text-rojo">
            <b>{NOMBRE_ETAPA[documento.etapa]}:</b> {documento.errorEtapa}
          </p>
          <Boton tamano="sm" variante="peligro" onClick={() => setReproceso(true)} disabled={reproceso} className="justify-self-start">
            <RotateCcw className="size-3.5" aria-hidden />
            {reproceso ? "En cola para reprocesar" : `Reprocesar ${NOMBRE_ETAPA[documento.etapa].toLowerCase()}`}
          </Boton>
        </div>
      )}
    </div>
  );
}
