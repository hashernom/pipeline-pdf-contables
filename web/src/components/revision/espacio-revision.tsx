"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCheck, Keyboard, PenLine, SearchX, Send } from "lucide-react";
import type { Documento, Extraccion, Pagina, Semaforo, Variable } from "@/lib/types";
import { formatNit } from "@/lib/format";
import { SECCIONES } from "@/lib/mock/variables";
import { SEMAFORO } from "@/lib/etapas";
import { Avance, Boton, Kbd, cx } from "@/components/ui/base";
import { IconoSemaforo } from "@/components/ui/marcas";
import { VisorPdf, type Marca, type Resaltado } from "@/components/pdf/visor-pdf";
import { useRevision } from "./estado";
import { FilaVariable } from "./fila-variable";
import { EditorCorreccion } from "./editor-correccion";
import { Coherencia } from "./coherencia";
import { PanelAtajos } from "./panel-atajos";
import { DialogoEnviar } from "./dialogo-enviar";

type Filtro = "pendientes" | Semaforo | "todas";

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "pendientes", label: "Pendientes" },
  { key: "rojo", label: "Rojo" },
  { key: "amarillo", label: "Amarillo" },
  { key: "verde", label: "Verde" },
  { key: "todas", label: "Todas" },
];


export function EspacioRevision({
  documento,
  extracciones,
  variables,
  paginas,
}: {
  documento: Documento;
  extracciones: Extraccion[];
  variables: Variable[];
  paginas: Pagina[];
}) {
  const router = useRouter();
  const rev = useRevision(documento.id, extracciones);
  const varPorKey = useMemo(() => new Map(variables.map((v) => [v.key, v])), [variables]);
  const extPorKey = useMemo(() => new Map(extracciones.map((e) => [e.variableKey, e])), [extracciones]);

  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [activaElegida, setActiva] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [marcando, setMarcando] = useState(false);
  const [marca, setMarca] = useState<Marca | null>(null);
  const [folioElegido, setFolio] = useState<number | null>(null);
  const [pulso, setPulso] = useState(0);
  const [atajos, setAtajos] = useState(false);
  const [enviar, setEnviar] = useState(false);
  const filasRef = useRef(new Map<string, HTMLLIElement>());

  const conteo = useMemo(() => {
    const c = { rojo: 0, amarillo: 0, verde: 0, pendientes: 0, todas: extracciones.length };
    for (const e of extracciones) {
      c[e.semaforo] += 1;
      if (!rev.decisiones[e.variableKey]) c.pendientes += 1;
    }
    return c;
  }, [extracciones, rev.decisiones]);

  // Lista visible. "Pendientes" se agrupa por color, en orden de atención;
  // los demás filtros siguen el orden de las secciones del estado.
  const grupos = useMemo(() => {
    if (filtro === "pendientes") {
      return (["rojo", "amarillo", "verde"] as const)
        .map((s) => ({
          key: s,
          nombre: `${SEMAFORO[s].nombre} · ${SEMAFORO[s].accion.toLowerCase()}`,
          items: extracciones.filter((e) => e.semaforo === s && !rev.decisiones[e.variableKey]),
        }))
        .filter((g) => g.items.length > 0);
    }
    const pasa = (e: Extraccion) => filtro === "todas" || e.semaforo === filtro;
    return SECCIONES.map((s) => ({
      key: s.key,
      nombre: s.nombre,
      items: extracciones.filter((e) => varPorKey.get(e.variableKey)?.seccion === s.key && pasa(e)),
    })).filter((g) => g.items.length > 0);
  }, [extracciones, filtro, rev.decisiones, varPorKey]);

  const visibles = useMemo(() => grupos.flatMap((g) => g.items.map((e) => e.variableKey)), [grupos]);

  // Sin elección explícita, la activa es la primera por atención.
  const activa = activaElegida ?? visibles[0] ?? null;
  const folio = folioElegido ?? (activa ? (rev.decisiones[activa]?.folio ?? extPorKey.get(activa)?.folio) : null) ?? 1;

  const seleccionar = (key: string) => {
    setActiva(key);
    setEditando(null);
    setMarcando(false);
    setMarca(null);
    const d = rev.decisiones[key];
    const f = d ? d.folio : extPorKey.get(key)?.folio;
    if (f) setFolio(f);
    requestAnimationFrame(() => filasRef.current.get(key)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };

  const mover = (delta: number) => {
    if (!visibles.length) return;
    const i = activa ? visibles.indexOf(activa) : -1;
    const n = Math.min(visibles.length - 1, Math.max(0, i + delta));
    seleccionar(visibles[n]);
  };

  // Después de resolver una variable: pasar a la siguiente pendiente.
  const siguientePendiente = (desde: string) => {
    const orden = visibles.length ? visibles : extracciones.map((e) => e.variableKey);
    const i = orden.indexOf(desde);
    const resto = [...orden.slice(i + 1), ...orden.slice(0, i)];
    const sig = resto.find((k) => !rev.decisiones[k] && k !== desde);
    if (sig) seleccionar(sig);
    else setEditando(null);
  };

  const confirmar = (key: string) => {
    const e = extPorKey.get(key);
    if (!e) return;
    rev.confirmar(e);
    siguientePendiente(key);
  };

  const noEncontrado = (key: string) => {
    rev.noEncontrado(key, "El documento no reporta el dato");
    siguientePendiente(key);
  };

  const empezarCorreccion = (key: string) => {
    setActiva(key);
    setEditando(key);
    setMarca(null);
    setMarcando(false);
  };

  const verdesSinAuditoria = useMemo(
    () => extracciones.filter((e) => e.semaforo === "verde" && !e.auditoria && !rev.decisiones[e.variableKey]),
    [extracciones, rev.decisiones],
  );

  // Atajos de la revisión.
  const onKey = useEffectEvent((ev: KeyboardEvent) => {
    const enCampo = (ev.target as HTMLElement)?.closest("input, textarea, select, [contenteditable]");
    if (ev.key === "Escape") {
      if (marcando) setMarcando(false);
      else if (atajos) setAtajos(false);
      else if (editando && !enCampo) setEditando(null);
      return;
    }
    if (enCampo || ev.metaKey || ev.ctrlKey || ev.altKey || enviar) return;
    const e = activa ? extPorKey.get(activa) : undefined;
    const d = activa ? rev.decisiones[activa] : undefined;
    switch (ev.key) {
      case "j":
      case "ArrowDown":
        mover(1);
        break;
      case "k":
      case "ArrowUp":
        mover(-1);
        break;
      case "Enter":
        if (!e || d || editando) return;
        if (e.semaforo === "rojo") empezarCorreccion(e.variableKey);
        else confirmar(e.variableKey);
        break;
      case "e":
        if (e && !d) empezarCorreccion(e.variableKey);
        break;
      case "n":
        if (e && !d && !editando) noEncontrado(e.variableKey);
        break;
      case "u":
        if (activa && d) rev.deshacer(activa);
        break;
      case "m":
        if (editando) setMarcando((m) => !m);
        break;
      case "f":
        setPulso((p) => p + 1);
        if (e?.folio) setFolio(d?.folio ?? e.folio);
        break;
      case "?":
        setAtajos((a) => !a);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
        setFiltro(FILTROS[Number(ev.key) - 1].key);
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

  const extActiva = activa ? extPorKey.get(activa) : undefined;
  const decActiva = activa ? rev.decisiones[activa] : undefined;
  const varActiva = activa ? varPorKey.get(activa) : undefined;

  const resaltado: Resaltado | null = useMemo(() => {
    if (marca && editando) return { folio: marca.folio, caja: marca.caja, etiqueta: "cita nueva", pulso };
    const caja = decActiva ? decActiva.caja : extActiva?.caja;
    const f = decActiva ? decActiva.folio : extActiva?.folio;
    if (!caja || !f || !varActiva) return null;
    return { folio: f, caja, etiqueta: varActiva.nombre, pulso };
  }, [marca, editando, decActiva, extActiva, varActiva, pulso]);

  const completo = rev.resueltas === extracciones.length;

  return (
    <div className="grid h-dvh grid-cols-1 grid-rows-[auto_minmax(0,1fr)] max-md:h-[calc(100dvh-56px)]">
      {/* Barra del documento */}
      <header className="flex min-h-13 flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-sheet px-4 py-2">
        <Link
          href="/revision"
          className="flex items-center gap-1 text-xs font-semibold text-ink-2 hover:text-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Mi cola
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-[0.9375rem] font-bold leading-tight text-ink">{documento.entidad}</h1>
          <p className="cifra truncate text-2xs text-ink-3">
            {documento.departamento} · NIT {formatNit(documento.nit)} · Vigencia {documento.vigencia} · {documento.folios} folios
            {documento.foliosEscaneados > 0 && `, ${documento.foliosEscaneados} escaneados`}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <div className="hidden w-44 md:block">
            <div className="cifra mb-1 flex justify-between text-2xs text-ink-2">
              <span>
                <b className="text-ink">{rev.resueltas}</b> de {extracciones.length} resueltas
              </span>
              <span>{Math.round((rev.resueltas / Math.max(1, extracciones.length)) * 100)} %</span>
            </div>
            <Avance valor={rev.resueltas} total={extracciones.length} />
          </div>
          <Boton tamano="sm" variante="fantasma" onClick={() => setAtajos(true)} aria-label="Atajos de teclado">
            <Keyboard className="size-3.5" aria-hidden />
            <Kbd>?</Kbd>
          </Boton>
          <Boton
            tamano="sm"
            variante="primario"
            disabled={!completo}
            onClick={() => setEnviar(true)}
            title={completo ? "Enviar al dataset" : `Faltan ${extracciones.length - rev.resueltas} variables`}
          >
            <Send className="size-3.5" aria-hidden />
            {completo ? "Enviar al dataset" : `Faltan ${extracciones.length - rev.resueltas}`}
          </Boton>
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1.12fr)_minmax(440px,0.88fr)]">
        {/* PDF */}
        <div className="hidden min-h-0 border-r border-line lg:block">
          {documento.pdfUrl && (
            <VisorPdf
              url={documento.pdfUrl}
              folio={folio}
              onFolio={setFolio}
              paginas={paginas}
              resaltado={resaltado}
              marcando={marcando}
              onMarca={(m) => {
                setMarca(m);
                setMarcando(false);
              }}
            />
          )}
        </div>

        {/* Variables */}
        <section aria-label="Variables extraídas" className="flex min-h-0 flex-col bg-sheet">
          <div className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-line bg-panel px-2" role="tablist">
            {FILTROS.map((f, i) => {
              const n = conteo[f.key];
              const on = filtro === f.key;
              return (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setFiltro(f.key)}
                  title={`${f.label}  ${i + 1}`}
                  className={cx(
                    "flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors",
                    on ? "bg-sheet text-ink shadow-[0_1px_2px_rgb(24_33_30/0.12)]" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {f.key !== "pendientes" && f.key !== "todas" && <IconoSemaforo s={f.key} className="size-3" />}
                  {f.label}
                  <span className={cx("cifra text-2xs", on ? "text-ink-2" : "text-ink-3")}>{n}</span>
                </button>
              );
            })}
            {filtro === "verde" && verdesSinAuditoria.length > 0 && (
              <Boton
                tamano="sm"
                variante="secundario"
                className="ml-auto"
                onClick={() => rev.confirmarVarias(verdesSinAuditoria)}
                title="Los verdes de la muestra de auditoría se confirman uno a uno"
              >
                Confirmar {verdesSinAuditoria.length} verdes
              </Boton>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {grupos.length === 0 ? (
              <div className="px-6 py-12">
                <p className="text-sm font-semibold text-ink">
                  {filtro === "pendientes" ? "No queda nada pendiente en este documento." : "Ninguna variable en este color."}
                </p>
                <p className="mt-1 max-w-[52ch] text-[0.8125rem] text-ink-2">
                  {filtro === "pendientes"
                    ? "Revise que la prueba contable cuadre y envíe el documento al dataset."
                    : "Cambie de filtro para ver el resto de variables."}
                </p>
                {filtro === "pendientes" && completo && (
                  <Boton variante="primario" tamano="sm" className="mt-4" onClick={() => setEnviar(true)}>
                    <Send className="size-3.5" aria-hidden />
                    Enviar al dataset
                  </Boton>
                )}
              </div>
            ) : (
              grupos.map((g) => (
                <div key={g.key}>
                  <h2 className="sticky top-0 z-10 flex items-baseline justify-between border-b border-line bg-sheet/95 py-1.5 pr-3 pl-4 text-2xs font-bold text-ink-2 backdrop-blur-[2px]">
                    {g.nombre}
                    <span className="cifra font-semibold text-ink-3">{g.items.length}</span>
                  </h2>
                  <ul>
                    {g.items.map((e) => {
                      const v = varPorKey.get(e.variableKey)!;
                      return (
                        <FilaVariable
                          key={e.variableKey}
                          ref={(el) => {
                            if (el) filasRef.current.set(e.variableKey, el);
                            else filasRef.current.delete(e.variableKey);
                          }}
                          variable={v}
                          extraccion={e}
                          decision={rev.decisiones[e.variableKey]}
                          activa={activa === e.variableKey}
                          onSeleccionar={() => seleccionar(e.variableKey)}
                          onFolio={() => {
                            if (activa !== e.variableKey) seleccionar(e.variableKey);
                            setPulso((p) => p + 1);
                          }}
                          onConfirmar={() => confirmar(e.variableKey)}
                          onCorregir={() => empezarCorreccion(e.variableKey)}
                          onNoEncontrado={() => noEncontrado(e.variableKey)}
                          onDeshacer={() => rev.deshacer(e.variableKey)}
                          editor={
                            editando === e.variableKey ? (
                              <EditorCorreccion
                                variable={v}
                                extraccion={e}
                                marca={marca}
                                marcando={marcando}
                                onMarcar={() => setMarcando((m) => !m)}
                                onCancelar={() => {
                                  setEditando(null);
                                  setMarcando(false);
                                  setMarca(null);
                                }}
                                onGuardar={(c) => {
                                  rev.corregir(e.variableKey, c);
                                  setEditando(null);
                                  setMarca(null);
                                  siguientePendiente(e.variableKey);
                                }}
                              />
                            ) : undefined
                          }
                        />
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>

          {/* Leyenda fija de las marcas de cada fila */}
          <p className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-line bg-sheet px-4 py-1.5 text-2xs text-ink-3">
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-line-strong" aria-hidden /> Pendiente
            </span>
            <span className="inline-flex items-center gap-1">
              <CheckCheck className="size-3 text-verde" aria-hidden /> Confirmado
            </span>
            <span className="inline-flex items-center gap-1">
              <PenLine className="size-3 text-sello" aria-hidden /> Corregido
            </span>
            <span className="inline-flex items-center gap-1">
              <SearchX className="size-3 text-ink-2" aria-hidden /> No encontrado
            </span>
            <span className="ml-auto inline-flex items-center gap-1">
              <span className="cifra font-bold text-sello">f. N</span> folio de la cita
            </span>
          </p>
          <Coherencia valor={rev.valorVigente} onSeleccionar={seleccionar} activa={activa} />
        </section>
      </div>

      {atajos && <PanelAtajos onCerrar={() => setAtajos(false)} />}
      {enviar && (
        <DialogoEnviar
          documento={documento}
          decisiones={rev.decisiones}
          onCancelar={() => setEnviar(false)}
          onEnviar={() => {
            try {
              const enviados = JSON.parse(localStorage.getItem("folio:enviados") ?? "[]") as string[];
              localStorage.setItem("folio:enviados", JSON.stringify([...new Set([...enviados, documento.id])]));
            } catch {
              /* sin persistencia */
            }
            router.push(`/revision?enviado=${documento.id}`);
          }}
        />
      )}
    </div>
  );
}
