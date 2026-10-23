"use client";

import { forwardRef } from "react";
import { CheckCheck, PenLine, SearchX, Undo2 } from "lucide-react";
import type { Extraccion, Variable } from "@/lib/types";
import { formatValor } from "@/lib/format";
import { NOMBRE_CHECK } from "@/lib/etapas";
import { Boton, Etiqueta, Kbd, cx } from "@/components/ui/base";
import { IconoSemaforo, MarcaCheck, NOMBRE_RESULTADO } from "@/components/ui/marcas";
import type { Decision } from "./estado";

/** Llamada de folio: la firma del producto. Lleva al folio y enmarca la cita. */
export function LlamadaFolio({ folio, onClick, activa }: { folio: number | null; onClick?: () => void; activa?: boolean }) {
  if (!folio) return <span className="w-11 shrink-0 text-right text-2xs font-semibold text-ink-3">sin f.</span>;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cx(
        "cifra w-11 shrink-0 rounded-sm px-1 py-0.5 text-right text-2xs font-bold transition-colors",
        activa ? "bg-sello text-white" : "text-sello hover:bg-sello-bg",
      )}
      title={`Ver la cita en el folio ${folio}`}
    >
      f. {folio}
    </button>
  );
}

const ESTADO_DECISION: Record<Decision["estado"], { label: string; icon: typeof CheckCheck; clase: string }> = {
  confirmado: { label: "Confirmado", icon: CheckCheck, clase: "text-verde" },
  corregido: { label: "Corregido", icon: PenLine, clase: "text-sello" },
  no_encontrado: { label: "No encontrado", icon: SearchX, clase: "text-ink-2" },
};

interface Props {
  variable: Variable;
  extraccion: Extraccion;
  decision?: Decision;
  activa: boolean;
  onSeleccionar: () => void;
  onFolio: () => void;
  onConfirmar: () => void;
  onCorregir: () => void;
  onNoEncontrado: () => void;
  onDeshacer: () => void;
  editor?: React.ReactNode;
}

export const FilaVariable = forwardRef<HTMLLIElement, Props>(function FilaVariable(
  { variable, extraccion: e, decision, activa, onSeleccionar, onFolio, onConfirmar, onCorregir, onNoEncontrado, onDeshacer, editor },
  ref,
) {
  const valor = decision ? decision.valor : e.valor;
  const folio = decision ? decision.folio : e.folio;
  const noEncontrado = decision ? decision.estado === "no_encontrado" : e.estado === "NO_ENCONTRADO";
  const esCifra = variable.tipo === "cifra";
  const est = decision && ESTADO_DECISION[decision.estado];
  const cita = decision ? decision.cita : e.cita;
  const rojo = e.semaforo === "rojo";

  return (
    <li
      ref={ref}
      aria-current={activa ? "true" : undefined}
      className={cx(
        "group relative scroll-mt-10 border-b border-line last:border-b-0",
        activa ? "bg-sheet" : decision ? "bg-paper/60" : "bg-sheet",
      )}
    >
      {activa && <span aria-hidden className="absolute inset-y-0 left-0 w-px bg-sello" />}
      <div
        onClick={onSeleccionar}
        className={cx(
          "flex w-full cursor-pointer items-center gap-2.5 py-2 pr-3 pl-4 text-left",
          !activa && "hover:bg-paper",
        )}
      >
        <IconoSemaforo s={e.semaforo} />
        <button
          type="button"
          onClick={(ev) => {
            ev.stopPropagation();
            onSeleccionar();
          }}
          className={cx(
            "min-w-0 flex-1 truncate text-left text-[0.8125rem]",
            activa ? "font-semibold text-ink" : "text-ink-2",
            decision && !activa && "text-ink-3",
          )}
        >
          {variable.nombre}
          {e.auditoria && !decision && (
            <span className="ml-1.5 align-[1px]">
              <Etiqueta tono="sello">Auditoría</Etiqueta>
            </span>
          )}
        </button>
        <span
          className={cx(
            "min-w-0 shrink truncate text-[0.8125rem]",
            esCifra && "cifra text-right",
            noEncontrado ? "font-semibold text-rojo" : "font-semibold text-ink",
            decision?.estado === "corregido" && "text-sello-ink",
          )}
        >
          {noEncontrado ? "NO_ENCONTRADO" : formatValor(variable.tipo, valor)}
        </span>
        <LlamadaFolio folio={folio} onClick={onFolio} activa={activa && !!folio} />
        <span className="flex w-4 shrink-0 justify-center" title={est?.label ?? "Pendiente"}>
          {est ? <est.icon aria-label={est.label} className={cx("size-3.5", est.clase)} strokeWidth={2.25} /> : <span className="size-1.5 rounded-full bg-line-strong" aria-label="Pendiente" />}
        </span>
      </div>

      {activa && (
        <div className="aparece pr-3 pb-3 pl-10">
          {cita ? (
            <figure className="rounded-sm border border-sello-line bg-sello-bg/50 px-2.5 py-1.5">
              <blockquote className="text-[0.8125rem] leading-snug text-ink">«{cita}»</blockquote>
              <figcaption className="mt-0.5 text-2xs font-semibold text-sello-ink">
                Cita literal · folio {folio}
                {e.confianzaOcr !== null && !decision && ` · OCR ${e.confianzaOcr.toFixed(2).replace(".", ",")}`}
                {decision?.estado === "corregido" && " · marcada por usted"}
              </figcaption>
            </figure>
          ) : (
            <p className="rounded-sm border border-dashed border-rojo-line bg-rojo-bg/50 px-2.5 py-2 text-xs text-rojo">
              {decision?.estado === "no_encontrado"
                ? `Usted confirmó que el documento no reporta este dato. ${decision.motivo ?? ""}`
                : "El sistema no encontró este dato. No se inventa: búsquelo en el PDF y márquelo, o confirme que el documento no lo trae."}
            </p>
          )}

          {!decision && (
            <ul className="mt-2.5 grid gap-x-4 gap-y-1 sm:grid-cols-2" aria-label="Verificaciones">
              {e.checks.map((c) => (
                <li key={c.tipo} className="flex items-start gap-1.5 text-xs" title={c.detalle}>
                  <MarcaCheck r={c.resultado} className="mt-px" />
                  <span className="sr-only">{NOMBRE_RESULTADO[c.resultado]}:</span>
                  <span className="min-w-0">
                    <span className={cx("font-semibold", c.resultado === "falla" ? "text-rojo" : c.resultado === "alerta" ? "text-ambar" : "text-ink-2")}>
                      {NOMBRE_CHECK[c.tipo]}
                    </span>
                    {(c.resultado === "falla" || c.resultado === "alerta") && <span className="block text-ink-2">{c.detalle}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {e.auditoria && !decision && (
            <p className="mt-2.5 text-xs text-sello-ink">
              Este verde salió en la muestra de auditoría. Compárelo con el folio antes de confirmar.
            </p>
          )}

          {editor ??
            (decision ? (
              <div className="mt-3 flex items-center gap-2">
                <span className={cx("text-xs font-semibold", est?.clase)}>{est?.label}</span>
                {decision.motivo && decision.estado === "corregido" && <span className="text-xs text-ink-3">· {decision.motivo}</span>}
                <Boton tamano="sm" variante="fantasma" className="ml-auto" onClick={onDeshacer}>
                  <Undo2 className="size-3.5" aria-hidden />
                  Deshacer <Kbd>U</Kbd>
                </Boton>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {e.estado === "ENCONTRADO" && !rojo && (
                  <Boton tamano="sm" variante="primario" onClick={onConfirmar}>
                    <CheckCheck className="size-3.5" aria-hidden />
                    Confirmar <Kbd oscuro>↵</Kbd>
                  </Boton>
                )}
                <Boton tamano="sm" variante={rojo && e.estado === "ENCONTRADO" ? "primario" : "secundario"} onClick={onCorregir}>
                  <PenLine className="size-3.5" aria-hidden />
                  {e.estado === "NO_ENCONTRADO" ? "Ubicar en el PDF" : "Corregir"}
                  <Kbd oscuro={rojo && e.estado === "ENCONTRADO"}>{rojo && e.estado === "ENCONTRADO" ? "↵" : "E"}</Kbd>
                </Boton>
                <Boton tamano="sm" variante={e.estado === "NO_ENCONTRADO" ? "primario" : "fantasma"} onClick={onNoEncontrado}>
                  <SearchX className="size-3.5" aria-hidden />
                  {e.estado === "NO_ENCONTRADO" ? "Confirmar que no está" : "No está en el documento"}
                  <Kbd oscuro={e.estado === "NO_ENCONTRADO"}>N</Kbd>
                </Boton>
              </div>
            ))}
        </div>
      )}
    </li>
  );
});
