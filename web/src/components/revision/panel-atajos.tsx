"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Kbd } from "@/components/ui/base";

const GRUPOS: { titulo: string; atajos: [string[], string][] }[] = [
  {
    titulo: "Moverse",
    atajos: [
      [["J", "↓"], "Variable siguiente"],
      [["K", "↑"], "Variable anterior"],
      [["1", "–", "5"], "Filtro: pendientes, rojo, amarillo, verde, todas"],
    ],
  },
  {
    titulo: "Decidir",
    atajos: [
      [["↵"], "Confirmar (en rojo: corregir)"],
      [["E"], "Corregir valor y cita"],
      [["N"], "No está en el documento"],
      [["U"], "Deshacer la decisión"],
    ],
  },
  {
    titulo: "Corregir",
    atajos: [
      [["M"], "Marcar la cita en el PDF"],
      [["Ctrl", "↵"], "Guardar corrección"],
      [["Esc"], "Cancelar"],
    ],
  },
  {
    titulo: "Documento",
    atajos: [
      [["F"], "Volver a enfocar la cita"],
      [["[", "]"], "Folio anterior / siguiente"],
      [["+", "−"], "Acercar / alejar"],
    ],
  },
];

export function PanelAtajos({ onCerrar }: { onCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      onClick={(e) => e.target === ref.current && onCerrar()}
      aria-labelledby="titulo-atajos"
      className="m-auto w-[min(640px,calc(100vw-32px))] rounded-md border border-line bg-sheet p-0 text-ink shadow-pop backdrop:bg-ink/25"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 id="titulo-atajos" className="text-[0.9375rem] font-bold">
          Atajos de teclado
        </h2>
        <button type="button" onClick={onCerrar} className="rounded-md p-1 text-ink-2 hover:bg-panel" aria-label="Cerrar">
          <X className="size-4" />
        </button>
      </div>
      <div className="grid gap-x-8 gap-y-5 px-5 py-4 sm:grid-cols-2">
        {GRUPOS.map((g) => (
          <section key={g.titulo}>
            <h3 className="mb-2 text-2xs font-bold text-ink-3">{g.titulo}</h3>
            <dl className="grid gap-1.5">
              {g.atajos.map(([teclas, desc]) => (
                <div key={desc} className="flex items-center justify-between gap-3 text-[0.8125rem]">
                  <dt className="text-ink-2">{desc}</dt>
                  <dd className="flex shrink-0 items-center gap-1">
                    {teclas.map((t) => (t === "–" ? <span key={t} className="text-ink-3">–</span> : <Kbd key={t}>{t}</Kbd>))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </dialog>
  );
}
