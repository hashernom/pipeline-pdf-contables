"use client";

import { useEffect, useRef, useState } from "react";
import { FileUp, OctagonX, Check, X } from "lucide-react";
import { Boton, Hoja, cx } from "@/components/ui/base";

// Subida SIMULADA. Con backend: URL firmada de Supabase Storage por archivo y,
// al terminar, POST /ingesta para encolar el trabajo en BullMQ.

interface Archivo {
  id: string;
  nombre: string;
  tamano: number;
  progreso: number;
  estado: "subiendo" | "en_cola" | "rechazado";
  motivo?: string;
}

const MAX_MB = 150;

function validar(f: File, existentes: Set<string>): string | null {
  if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return "No es un PDF";
  if (f.size > MAX_MB * 1024 * 1024) return `Supera ${MAX_MB} MB`;
  if (existentes.has(f.name)) return "Ya está en el lote con ese nombre";
  return null;
}

const mb = (b: number) => `${(b / 1024 / 1024).toLocaleString("es-CO", { maximumFractionDigits: 1 })} MB`;

export function Subida() {
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [sobre, setSobre] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Avance simulado de las subidas.
  useEffect(() => {
    if (!archivos.some((a) => a.estado === "subiendo")) return;
    const t = setInterval(() => {
      setArchivos((xs) =>
        xs.map((a) => {
          if (a.estado !== "subiendo") return a;
          const p = Math.min(100, a.progreso + 6 + (a.tamano % 9));
          return { ...a, progreso: p, estado: p >= 100 ? "en_cola" : "subiendo" };
        }),
      );
    }, 180);
    return () => clearInterval(t);
  }, [archivos]);

  const agregar = (lista: FileList | null) => {
    if (!lista) return;
    setArchivos((xs) => {
      const nombres = new Set(xs.filter((a) => a.estado !== "rechazado").map((a) => a.nombre));
      const nuevos: Archivo[] = [];
      for (const f of Array.from(lista)) {
        const motivo = validar(f, nombres);
        nombres.add(f.name);
        nuevos.push({
          id: `${f.name}-${f.size}-${xs.length + nuevos.length}`,
          nombre: f.name,
          tamano: f.size,
          progreso: 0,
          estado: motivo ? "rechazado" : "subiendo",
          motivo: motivo ?? undefined,
        });
      }
      return [...nuevos, ...xs];
    });
  };

  const enCola = archivos.filter((a) => a.estado === "en_cola").length;
  const subiendo = archivos.filter((a) => a.estado === "subiendo").length;
  const rechazados = archivos.filter((a) => a.estado === "rechazado").length;

  return (
    <div className="grid gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSobre(true);
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSobre(false);
          agregar(e.dataTransfer.files);
        }}
        className={cx(
          "flex flex-col items-center justify-center gap-3 rounded-md border-[1.5px] border-dashed px-6 py-12 text-center transition-colors",
          sobre ? "border-rail bg-[#e3ece8]" : "border-line-strong bg-sheet",
        )}
      >
        <FileUp className={cx("size-7", sobre ? "text-rail" : "text-ink-3")} strokeWidth={1.5} aria-hidden />
        <div>
          <p className="text-sm font-semibold text-ink">Arrastre aquí los PDF del lote</p>
          <p className="mt-0.5 text-xs text-ink-2">Hasta {MAX_MB} MB por archivo. Pueden ser digitales o escaneados: el sistema detecta cada página.</p>
        </div>
        <Boton variante="primario" onClick={() => inputRef.current?.click()}>
          Elegir archivos
        </Boton>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          onChange={(e) => {
            agregar(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {archivos.length > 0 && (
        <Hoja>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2 text-xs text-ink-2">
            <span className="cifra">
              <b className="text-ink">{enCola}</b> en cola
            </span>
            {subiendo > 0 && <span className="cifra">{subiendo} subiendo</span>}
            {rechazados > 0 && <span className="cifra font-semibold text-rojo">{rechazados} rechazados</span>}
            <Boton tamano="sm" variante="fantasma" className="ml-auto" onClick={() => setArchivos([])}>
              Limpiar lista
            </Boton>
          </div>
          <ul>
            {archivos.map((a) => (
              <li key={a.id} className="flex items-center gap-3 border-b border-line px-4 py-2 text-[0.8125rem] last:border-b-0">
                {a.estado === "rechazado" ? (
                  <OctagonX className="size-3.5 shrink-0 text-rojo" aria-hidden />
                ) : a.estado === "en_cola" ? (
                  <Check className="size-3.5 shrink-0 text-verde" strokeWidth={2.5} aria-hidden />
                ) : (
                  <span className="size-3.5 shrink-0 rounded-full border-2 border-line border-t-rail animate-spin" aria-hidden />
                )}
                <span className="min-w-0 flex-1 truncate text-ink">{a.nombre}</span>
                <span className="cifra hidden text-xs text-ink-3 sm:block">{mb(a.tamano)}</span>
                <span className="w-40 text-right text-xs">
                  {a.estado === "rechazado" ? (
                    <span className="font-semibold text-rojo">{a.motivo}</span>
                  ) : a.estado === "en_cola" ? (
                    <span className="text-verde">En cola de OCR</span>
                  ) : (
                    <span className="block h-1 overflow-hidden rounded-full bg-panel">
                      <span className="block h-full bg-rail transition-[width] duration-150" style={{ width: `${a.progreso}%` }} />
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setArchivos((xs) => xs.filter((x) => x.id !== a.id))}
                  className="rounded p-0.5 text-ink-3 hover:bg-panel hover:text-ink"
                  aria-label={`Quitar ${a.nombre}`}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </Hoja>
      )}
    </div>
  );
}
