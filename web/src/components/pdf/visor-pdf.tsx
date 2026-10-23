"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { ChevronLeft, ChevronRight, Crosshair, Minus, Plus, ScanText } from "lucide-react";
import type { Caja, Pagina } from "@/lib/types";
import { cx, Kbd } from "@/components/ui/base";

export interface Resaltado {
  folio: number;
  caja: Caja;
  etiqueta: string;
  /** Cambia cuando el usuario pide volver a enfocar la misma cita. */
  pulso?: number;
}

export interface Marca {
  folio: number;
  caja: Caja;
  texto: string;
}

interface Props {
  url: string;
  folio: number;
  onFolio: (n: number) => void;
  paginas: Pagina[];
  resaltado: Resaltado | null;
  /** Modo de marcado: arrastrar un rectángulo para fijar una cita nueva. */
  marcando?: boolean;
  onMarca?: (m: Marca) => void;
}

const ZOOMS = [0.75, 0.9, 1, 1.15, 1.35, 1.6, 2];

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
function cargarPdfjs() {
  pdfjsPromise ??= import("pdfjs-dist").then((m) => {
    m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return m;
  });
  return pdfjsPromise;
}

export function VisorPdf({ url, folio, onFolio, paginas, resaltado, marcando = false, onMarca }: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomIdx, setZoomIdx] = useState(2);
  const [ancho, setAncho] = useState(0);
  const [tamPagina, setTamPagina] = useState<{ w: number; h: number } | null>(null);
  // Clave del último render terminado; mientras no coincida con la vista pedida, está renderizando.
  const [renderListo, setRenderListo] = useState<string | null>(null);
  const marcoRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const paginaRef = useRef<PDFPageProxy | null>(null);

  // Carga del documento.
  useEffect(() => {
    let vivo = true;
    let tarea: { destroy: () => Promise<void> } | null = null;
    cargarPdfjs()
      .then((pdfjs) => {
        const t = pdfjs.getDocument({ url });
        tarea = t;
        return t.promise;
      })
      .then((d) => vivo && setDoc(d))
      .catch(() => vivo && setError("No se pudo abrir el PDF. Revise la conexión y vuelva a intentarlo."));
    return () => {
      vivo = false;
      tarea?.destroy();
    };
  }, [url]);

  // Ancho disponible.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = doc?.numPages ?? paginas.length;
  // Ancho cuantizado: evita re-renderizar por cambios mínimos (p. ej. al aparecer la barra de scroll).
  const anchoQ = Math.round(ancho / 16) * 16;
  const claveRender = `${folio}|${zoomIdx}|${anchoQ}`;
  const renderizando = renderListo !== claveRender;
  const escalaBase = tamPagina && anchoQ ? Math.max(0.4, (anchoQ - 48) / tamPagina.w) : 1;
  const escala = escalaBase * ZOOMS[zoomIdx];

  // Render de la página actual. Los renders se encadenan: PDF.js no admite dos
  // render() simultáneos sobre el mismo canvas, ni siquiera mientras uno se cancela.
  const colaRender = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (!doc || !anchoQ) return;
    let cancelado = false;
    let tarea: ReturnType<PDFPageProxy["render"]> | null = null;
    const clave = `${folio}|${zoomIdx}|${anchoQ}`;
    const anterior = colaRender.current;
    const actual = (async () => {
      await anterior;
      if (cancelado) return;
      const page = await doc.getPage(Math.min(Math.max(folio, 1), doc.numPages));
      if (cancelado) return;
      paginaRef.current = page;
      const v1 = page.getViewport({ scale: 1 });
      setTamPagina({ w: v1.width, h: v1.height });
      const vp = page.getViewport({ scale: Math.max(0.4, (anchoQ - 48) / v1.width) * ZOOMS[zoomIdx] });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(vp.width * dpr);
      canvas.height = Math.floor(vp.height * dpr);
      canvas.style.width = `${vp.width}px`;
      canvas.style.height = `${vp.height}px`;
      tarea = page.render({ canvas, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
      await tarea.promise;
      if (!cancelado) setRenderListo(clave);
    })().catch(() => {
      /* render cancelado o fallido: el siguiente lo reemplaza */
    });
    colaRender.current = actual;
    return () => {
      cancelado = true;
      tarea?.cancel();
    };
  }, [doc, folio, anchoQ, zoomIdx]);

  // Llevar la cita a la vista.
  useEffect(() => {
    if (!resaltado || resaltado.folio !== folio || renderizando) return;
    const el = marcoRef.current;
    const sc = scrollRef.current;
    if (!el || !sc) return;
    const top = el.offsetTop - sc.clientHeight * 0.3;
    sc.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [resaltado, folio, renderizando]);

  // Atajos del visor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "[") onFolio(Math.max(1, folio - 1));
      else if (e.key === "]") onFolio(Math.min(total, folio + 1));
      else if (e.key === "+" || e.key === "=") setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1));
      else if (e.key === "-") setZoomIdx((z) => Math.max(0, z - 1));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [folio, total, onFolio]);

  // Marcado de una cita nueva arrastrando sobre la página.
  const [arrastre, setArrastre] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const superficieRef = useRef<HTMLDivElement>(null);

  const puntoLocal = (e: React.PointerEvent) => {
    const r = superficieRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const terminarMarca = useCallback(async () => {
    if (!arrastre || !paginaRef.current || !onMarca) return setArrastre(null);
    const x = Math.min(arrastre.x0, arrastre.x1) / escala;
    const y = Math.min(arrastre.y0, arrastre.y1) / escala;
    const w = Math.abs(arrastre.x1 - arrastre.x0) / escala;
    const h = Math.abs(arrastre.y1 - arrastre.y0) / escala;
    setArrastre(null);
    if (w < 6 || h < 4) return;
    const page = paginaRef.current;
    const alto = page.getViewport({ scale: 1 }).height;
    const contenido = await page.getTextContent();
    const palabras: string[] = [];
    for (const it of contenido.items) {
      if (!("str" in it) || !it.str.trim()) continue;
      const ix = it.transform[4];
      const ih = it.height || Math.abs(it.transform[3]);
      const iy = alto - it.transform[5] - ih;
      const solapa = ix < x + w && ix + it.width > x && iy < y + h && iy + ih > y;
      if (solapa) palabras.push(it.str.trim());
    }
    onMarca({ folio, caja: { x, y, w, h }, texto: palabras.join(" ") });
  }, [arrastre, escala, folio, onMarca]);

  const pagina = paginas.find((p) => p.n === folio);
  const localizadas = paginas.filter((p) => p.localizada);
  const rect = arrastre && {
    left: Math.min(arrastre.x0, arrastre.x1),
    top: Math.min(arrastre.y0, arrastre.y1),
    width: Math.abs(arrastre.x1 - arrastre.x0),
    height: Math.abs(arrastre.y1 - arrastre.y0),
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#dfe4e0]">
      {/* Barra del visor */}
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-line bg-panel px-2">
        <button
          type="button"
          onClick={() => onFolio(Math.max(1, folio - 1))}
          disabled={folio <= 1}
          className="flex size-7 items-center justify-center rounded-md text-ink-2 hover:bg-sheet disabled:opacity-35"
          aria-label="Folio anterior"
          title="Folio anterior  ["
        >
          <ChevronLeft className="size-4" />
        </button>
        <label className="flex items-center gap-1.5 text-xs text-ink-2">
          <span className="sr-only">Ir al folio</span>
          <span className="font-semibold text-sello">f.</span>
          <input
            key={folio}
            defaultValue={folio}
            inputMode="numeric"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const n = Number((e.target as HTMLInputElement).value);
                if (n >= 1 && n <= total) onFolio(n);
              }
            }}
            className="cifra h-7 w-11 rounded-md border border-line-strong bg-sheet text-center text-xs font-semibold text-ink"
          />
          <span className="cifra">de {total}</span>
        </label>
        <button
          type="button"
          onClick={() => onFolio(Math.min(total, folio + 1))}
          disabled={folio >= total}
          className="flex size-7 items-center justify-center rounded-md text-ink-2 hover:bg-sheet disabled:opacity-35"
          aria-label="Folio siguiente"
          title="Folio siguiente  ]"
        >
          <ChevronRight className="size-4" />
        </button>

        {pagina && (
          <span className="ml-2 hidden min-w-0 items-center gap-1.5 truncate text-xs text-ink-2 xl:flex">
            {pagina.tipo === "escaneada" && (
              <span className="inline-flex items-center gap-1 text-2xs font-semibold text-ink-2">
                <ScanText className="size-3" aria-hidden />
                Escaneada · OCR ·
              </span>
            )}
            <span className="truncate">{pagina.titulo}</span>
          </span>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setZoomIdx((z) => Math.max(0, z - 1))}
            className="flex size-7 items-center justify-center rounded-md text-ink-2 hover:bg-sheet"
            aria-label="Alejar"
            title="Alejar  −"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="cifra w-10 text-center text-xs text-ink-2">{Math.round(ZOOMS[zoomIdx] * 100)} %</span>
          <button
            type="button"
            onClick={() => setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1))}
            className="flex size-7 items-center justify-center rounded-md text-ink-2 hover:bg-sheet"
            aria-label="Acercar"
            title="Acercar  +"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Folios localizados */}
      {localizadas.length > 0 && (
        <div className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b border-line bg-panel/60 px-2">
          <span className="mr-1 shrink-0 text-2xs font-semibold text-ink-3">Localizados</span>
          {localizadas.map((p) => (
            <button
              key={p.n}
              type="button"
              onClick={() => onFolio(p.n)}
              title={p.titulo}
              className={cx(
                "cifra h-6 shrink-0 rounded-sm px-1.5 text-2xs font-semibold transition-colors",
                p.n === folio ? "bg-sello text-white" : "text-sello-ink hover:bg-sello-bg",
              )}
            >
              f. {p.n}
              {p.tipo === "escaneada" && <span className="ml-0.5 opacity-70">·OCR</span>}
            </button>
          ))}
        </div>
      )}

      {/* Página */}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
        {error ? (
          <div className="p-8 text-sm text-rojo">{error}</div>
        ) : (
          <div className="flex min-h-full justify-center p-6">
            <div
              ref={superficieRef}
              className={cx("relative shrink-0 bg-white shadow-sheet", marcando && "cursor-crosshair")}
              style={tamPagina ? { width: tamPagina.w * escala, height: tamPagina.h * escala } : { width: 600, height: 776 }}
              onPointerDown={(e) => {
                if (!marcando) return;
                try {
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                } catch {
                  /* puntero sin captura (p. ej. eventos sintéticos): el arrastre sigue funcionando */
                }
                const p = puntoLocal(e);
                setArrastre({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
              }}
              onPointerMove={(e) => {
                if (!marcando || !arrastre) return;
                const p = puntoLocal(e);
                setArrastre({ ...arrastre, x1: p.x, y1: p.y });
              }}
              onPointerUp={() => marcando && terminarMarca()}
            >
              <canvas ref={canvasRef} className={cx("block transition-opacity duration-200", renderizando && "opacity-60")} />
              {!doc && (
                <div className="absolute inset-0 animate-pulse bg-[repeating-linear-gradient(180deg,transparent_0_22px,#eef1ee_22px_30px)]" />
              )}

              {resaltado && resaltado.folio === folio && !renderizando && (
                <div key={`${resaltado.etiqueta}-${resaltado.folio}-${resaltado.pulso ?? 0}`} className="pointer-events-none">
                  <div
                    ref={marcoRef}
                    className="marco-cita absolute"
                    title={resaltado.etiqueta}
                    style={{
                      left: resaltado.caja.x * escala,
                      top: resaltado.caja.y * escala,
                      width: resaltado.caja.w * escala,
                      height: resaltado.caja.h * escala,
                    }}
                  />
                  <span
                    className="llamada-folio absolute -translate-x-full -translate-y-1/2 rounded-sm bg-sello px-1 py-0.5 text-[0.625rem] font-bold leading-none whitespace-nowrap text-white"
                    style={{
                      left: resaltado.caja.x * escala - 6,
                      top: (resaltado.caja.y + resaltado.caja.h / 2) * escala,
                    }}
                  >
                    f. {resaltado.folio}
                  </span>
                </div>
              )}

              {rect && (
                <div
                  className="pointer-events-none absolute border-[1.5px] border-dashed border-sello bg-sello/10"
                  style={rect}
                />
              )}
            </div>
          </div>
        )}

        {marcando && (
          <div className="pointer-events-none sticky bottom-3 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-md bg-sello px-3 py-1.5 text-xs font-semibold text-white shadow-pop">
              <Crosshair className="size-3.5" aria-hidden />
              Arrastre sobre la página para marcar la cita
              <Kbd oscuro>Esc</Kbd>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
