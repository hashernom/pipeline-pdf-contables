"use client";

import { useEffect, useRef } from "react";
import type { Documento } from "@/lib/types";
import { Boton } from "@/components/ui/base";
import type { Decision } from "./estado";

export function DialogoEnviar({
  documento,
  decisiones,
  onCancelar,
  onEnviar,
}: {
  documento: Documento;
  decisiones: Record<string, Decision>;
  onCancelar: () => void;
  onEnviar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  const lista = Object.values(decisiones);
  const n = (e: Decision["estado"]) => lista.filter((d) => d.estado === e).length;
  const filas: [string, number][] = [
    ["Confirmadas", n("confirmado")],
    ["Corregidas", n("corregido")],
    ["No encontradas", n("no_encontrado")],
  ];

  return (
    <dialog
      ref={ref}
      onClose={onCancelar}
      aria-labelledby="titulo-enviar"
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-md border border-line bg-sheet p-0 text-ink shadow-pop backdrop:bg-ink/25"
    >
      <div className="px-5 pt-4 pb-3">
        <h2 id="titulo-enviar" className="text-[0.9375rem] font-bold">
          Enviar {documento.entidad} al dataset
        </h2>
        <p className="mt-1 text-[0.8125rem] text-ink-2">
          Los valores quedan aprobados para la vigencia {documento.vigencia}. Las correcciones se guardan en el registro con su
          cita y su folio.
        </p>
      </div>
      <dl className="cifra mx-5 grid grid-cols-[1fr_auto] gap-y-1 border-y border-line py-2.5 text-[0.8125rem]">
        {filas.map(([l, v]) => (
          <div key={l} className="contents">
            <dt className="text-ink-2">{l}</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
        <dt className="regla-simple mt-1 pt-1 font-bold">Total</dt>
        <dd className="regla-simple mt-1 pt-1 text-right">
          <span className="doble-regla font-bold">{lista.length}</span>
        </dd>
      </dl>
      <div className="flex justify-end gap-2 px-5 py-4">
        <Boton tamano="sm" variante="fantasma" onClick={onCancelar}>
          Seguir revisando
        </Boton>
        <Boton tamano="sm" variante="primario" onClick={onEnviar} autoFocus>
          Enviar al dataset
        </Boton>
      </div>
    </dialog>
  );
}
