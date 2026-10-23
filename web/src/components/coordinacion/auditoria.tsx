"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, CircleSlash, TriangleAlert, Undo2 } from "lucide-react";
import type { Estudiante, Variable } from "@/lib/types";
import type { MuestraAuditoria } from "@/lib/data";
import { formatCifra } from "@/lib/format";
import { Boton, Hoja, Kbd, TituloSeccion, cx } from "@/components/ui/base";

const UMBRAL = 0.02;

/**
 * Auditoría de verdes: una fila activa a la vez, con su cita y su folio, como en
 * la revisión. J/K para moverse, C si coincide con el PDF, N si no, U deshace.
 */
export function Auditoria({
  muestra,
  variables,
  estudiantes,
}: {
  muestra: MuestraAuditoria[];
  variables: Variable[];
  estudiantes: Estudiante[];
}) {
  const [items, setItems] = useState(muestra);
  const [ver, setVer] = useState<"pendiente" | "todas">("pendiente");
  const [activaElegida, setActiva] = useState<string | null>(null);
  const filas = useRef(new Map<string, HTMLLIElement>());
  const vari = useMemo(() => new Map(variables.map((v) => [v.key, v.nombre])), [variables]);
  const est = useMemo(() => new Map(estudiantes.map((e) => [e.id, e.nombre])), [estudiantes]);

  const revisadas = items.filter((i) => i.resultado !== "pendiente");
  const disc = items.filter((i) => i.resultado === "discrepancia").length;
  const tasa = revisadas.length ? disc / revisadas.length : 0;
  const visibles = (ver === "pendiente" ? items.filter((i) => i.resultado === "pendiente") : items).slice(0, 80);
  const activa = activaElegida && visibles.some((v) => v.id === activaElegida) ? activaElegida : (visibles[0]?.id ?? null);

  const seleccionar = (id: string) => {
    setActiva(id);
    requestAnimationFrame(() => filas.current.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };

  const marcar = (id: string, r: MuestraAuditoria["resultado"]) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, resultado: r } : x)));
    if (r !== "pendiente") {
      const i = visibles.findIndex((v) => v.id === id);
      const sig = visibles.slice(i + 1).find((v) => v.resultado === "pendiente");
      if (sig) seleccionar(sig.id);
    }
  };

  const onKey = useEffectEvent((ev: KeyboardEvent) => {
    if ((ev.target as HTMLElement)?.closest?.("input, textarea, select") || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const i = activa ? visibles.findIndex((v) => v.id === activa) : -1;
    const actual = visibles[i];
    switch (ev.key) {
      case "j":
      case "ArrowDown":
        if (visibles[i + 1]) seleccionar(visibles[i + 1].id);
        break;
      case "k":
      case "ArrowUp":
        if (i > 0) seleccionar(visibles[i - 1].id);
        break;
      case "c":
        if (actual?.resultado === "pendiente") marcar(actual.id, "coincide");
        break;
      case "n":
        if (actual?.resultado === "pendiente") marcar(actual.id, "discrepancia");
        break;
      case "u":
        if (actual && actual.resultado !== "pendiente") marcar(actual.id, "pendiente");
        break;
      default:
        return;
    }
    ev.preventDefault();
  });
  useEffect(() => {
    const h = (ev: KeyboardEvent) => onKey(ev);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-1" role="tablist">
          {(["pendiente", "todas"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={ver === k}
              onClick={() => setVer(k)}
              className={cx(
                "h-7 rounded-md px-2.5 text-xs font-semibold",
                ver === k ? "bg-sheet text-ink shadow-[0_1px_2px_rgb(24_33_30/0.12)]" : "text-ink-2 hover:text-ink",
              )}
            >
              {k === "pendiente" ? "Por revisar" : "Toda la muestra"}
              <span className="cifra ml-1.5 text-2xs text-ink-3">{k === "pendiente" ? items.length - revisadas.length : items.length}</span>
            </button>
          ))}
          <span className="ml-auto flex flex-wrap items-center gap-1.5 text-2xs text-ink-3">
            <Kbd>J</Kbd>
            <Kbd>K</Kbd> moverse · <Kbd>C</Kbd> coincide · <Kbd>N</Kbd> no coincide · <Kbd>U</Kbd> deshacer
          </span>
        </div>

        <Hoja>
          {visibles.length === 0 ? (
            <p className="px-4 py-8 text-[0.8125rem] text-ink-2">No queda nada por revisar en esta muestra.</p>
          ) : (
            <ul>
              {visibles.map((i) => {
                const on = i.id === activa;
                return (
                  <li
                    key={i.id}
                    ref={(el) => {
                      if (el) filas.current.set(i.id, el);
                      else filas.current.delete(i.id);
                    }}
                    aria-current={on ? "true" : undefined}
                    className={cx("relative border-b border-line bg-sheet last:border-b-0", !on && "hover:bg-paper")}
                  >
                    {on && <span aria-hidden className="absolute inset-y-0 left-0 w-px bg-sello" />}
                    <button
                      type="button"
                      onClick={() => seleccionar(i.id)}
                      className="grid w-full grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_9.5rem] items-baseline gap-x-4 px-4 py-2 text-left text-[0.8125rem] sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_9.5rem_3.5rem_6.5rem]"
                    >
                      <span className="min-w-0 truncate font-semibold text-ink">
                        {i.entidad} <span className="cifra font-normal text-ink-3">{i.vigencia}</span>
                      </span>
                      <span className="min-w-0 truncate text-ink-2">{vari.get(i.variableKey)}</span>
                      <span className="cifra text-right font-semibold whitespace-nowrap text-ink">{formatCifra(i.valor)}</span>
                      <span className="cifra hidden text-right text-2xs font-bold whitespace-nowrap text-sello sm:block">f. {i.folio}</span>
                      <span
                        className={cx(
                          "hidden text-right text-xs font-semibold sm:block",
                          i.resultado === "coincide" ? "text-verde" : i.resultado === "discrepancia" ? "text-rojo" : "text-ink-3",
                        )}
                      >
                        {i.resultado === "coincide" ? "Coincide" : i.resultado === "discrepancia" ? "No coincide" : "Por revisar"}
                      </span>
                    </button>

                    {on && (
                      <div className="aparece grid gap-3 pr-4 pb-3 pl-4">
                        <figure className="rounded-sm border border-sello-line bg-sello-bg/50 px-2.5 py-1.5">
                          <blockquote className="cifra text-[0.8125rem] text-ink">«{i.cita}»</blockquote>
                          <figcaption className="mt-0.5 text-2xs font-semibold text-sello-ink">
                            Cita con la que se confirmó · folio {i.folio} · {est.get(i.estudianteId)}
                          </figcaption>
                        </figure>
                        <div className="flex flex-wrap items-center gap-2">
                          {i.resultado === "pendiente" ? (
                            <>
                              <Boton tamano="sm" variante="primario" onClick={() => marcar(i.id, "coincide")}>
                                <Check className="size-3.5" aria-hidden />
                                Coincide con el PDF <Kbd oscuro>C</Kbd>
                              </Boton>
                              <Boton tamano="sm" variante="secundario" onClick={() => marcar(i.id, "discrepancia")}>
                                <CircleSlash className="size-3.5 text-rojo" aria-hidden />
                                No coincide <Kbd>N</Kbd>
                              </Boton>
                            </>
                          ) : (
                            <Boton tamano="sm" variante="fantasma" onClick={() => marcar(i.id, "pendiente")}>
                              <Undo2 className="size-3.5" aria-hidden />
                              Deshacer <Kbd>U</Kbd>
                            </Boton>
                          )}
                          {i.pdfUrl ? (
                            <Link href={`/revision/${i.documentoId}`} className="ml-auto text-xs font-semibold text-sello hover:underline">
                              Abrir el PDF en el folio {i.folio}
                            </Link>
                          ) : (
                            <Link
                              href={`/coordinacion/documentos/${i.documentoId}`}
                              className="ml-auto text-xs font-semibold text-ink-2 hover:text-ink hover:underline"
                            >
                              Ver documento
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Hoja>
      </section>

      <aside className="grid content-start gap-6">
        <section>
          <TituloSeccion>Resultado de la muestra</TituloSeccion>
          <Hoja className="px-4 py-3">
            <dl className="cifra grid grid-cols-[1fr_auto] gap-y-1.5 text-[0.8125rem]">
              <dt className="font-sans text-ink-2">Verdes muestreados</dt>
              <dd className="text-right font-semibold">{items.length}</dd>
              <dt className="font-sans text-ink-2">Revisados</dt>
              <dd className="text-right font-semibold">{revisadas.length}</dd>
              <dt className="font-sans text-ink-2">Coinciden</dt>
              <dd className="text-right font-semibold">{revisadas.length - disc}</dd>
              <dt className="font-sans text-ink-2">No coinciden</dt>
              <dd className={cx("text-right font-semibold", disc > 0 && "text-rojo")}>{disc}</dd>
              <dt className="regla-simple pt-1.5 font-sans font-bold">Tasa de error en verdes</dt>
              <dd className="regla-simple pt-1.5 text-right">
                <span className={cx("doble-regla font-bold", tasa > UMBRAL ? "text-rojo" : "text-verde")}>
                  {(tasa * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %
                </span>
              </dd>
            </dl>
          </Hoja>
          {tasa > UMBRAL ? (
            <p className="mt-3 flex items-start gap-2 text-xs text-rojo">
              <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
              La tasa supera el {UMBRAL * 100} %. Conviene revisar las reglas que dan verde antes de seguir confirmando en bloque.
            </p>
          ) : (
            <p className="mt-3 text-xs text-ink-3">Por debajo del {UMBRAL * 100} %, la confirmación rápida de verdes se mantiene.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
