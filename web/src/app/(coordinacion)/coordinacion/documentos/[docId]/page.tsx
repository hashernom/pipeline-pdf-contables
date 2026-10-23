import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Check, Loader, OctagonX } from "lucide-react";
import type { Documento, Etapa, Pagina as PaginaPdf } from "@/lib/types";
import { BotonLink, Encabezado, Hoja, Pagina, TituloSeccion, Vacio, cx } from "@/components/ui/base";
import { ConteoSemaforo, IconoSemaforo } from "@/components/ui/marcas";
import { AccionesDocumento } from "@/components/coordinacion/acciones-documento";
import { TablaCorrecciones } from "@/components/coordinacion/tabla-correcciones";
import { ETAPAS } from "@/lib/etapas";
import { SECCIONES } from "@/lib/mock/variables";
import type { SeccionVariable } from "@/lib/types";

const CAPTION: Record<SeccionVariable, string> = {
  identificacion: "Identificación de la entidad",
  situacion_financiera: "Estado de situación financiera · cifras en pesos",
  resultados: "Estado de resultados · cifras en pesos",
  presupuesto: "Ejecución presupuestal · cifras en pesos",
  deuda_indicadores: "Deuda e indicadores de ley",
};

/** Totales del estado: van con regla simple encima y doble regla debajo. */
const TOTALES = new Set(["activo_total", "pasivo_total", "patrimonio", "resultado", "superavit"]);
import { formatFecha, formatNit, formatValor } from "@/lib/format";
import {
  listarCorrecciones,
  listarDocumentos,
  listarEstudiantes,
  listarVariables,
  obtenerDocumento,
  obtenerExtracciones,
  obtenerPaginas,
} from "@/lib/data";

export async function generateStaticParams() {
  const docs = await listarDocumentos();
  return docs.slice(0, 12).map((d) => ({ docId: d.id }));
}

export async function generateMetadata({ params }: PageProps<"/coordinacion/documentos/[docId]">): Promise<Metadata> {
  const { docId } = await params;
  const d = await obtenerDocumento(docId);
  return { title: d ? d.entidad : "Documento" };
}

export default function PaginaDocumento({ params }: PageProps<"/coordinacion/documentos/[docId]">) {
  return (
    <Pagina ancho="amplio">
      <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-panel" aria-label="Cargando documento" />}>
        {params.then(({ docId }) => (
          <Detalle docId={docId} />
        ))}
      </Suspense>
    </Pagina>
  );
}

async function Detalle({ docId }: { docId: string }) {
  const d = await obtenerDocumento(docId);
  if (!d) notFound();
  const [paginas, extracciones, variables, estudiantes, correcciones] = await Promise.all([
    obtenerPaginas(docId),
    obtenerExtracciones(docId),
    listarVariables(),
    listarEstudiantes(),
    listarCorrecciones({ documentoId: docId }),
  ]);
  const vari = new Map(variables.map((v) => [v.key, v]));

  return (
    <>
      <Encabezado
        migas={
          <Link href="/coordinacion/documentos" className="hover:text-ink">
            Documentos
          </Link>
        }
        titulo={d.entidad}
        descripcion={
          <span className="cifra">
            {d.departamento} · NIT {formatNit(d.nit)} · Vigencia {d.vigencia} · {d.archivo} · {d.tamanoMb.toLocaleString("es-CO")} MB · subido el{" "}
            {formatFecha(d.subidoEl)}
          </span>
        }
        acciones={
          d.pdfUrl && d.etapa === "revision" ? (
            <BotonLink href={`/revision/${d.id}`} variante="primario">
              Abrir en revisión
            </BotonLink>
          ) : undefined
        }
      />

      <LineaEtapas d={d} />

      <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 grid-cols-1 content-start gap-8">
          <MapaFolios paginas={paginas} />

          <section>
            <TituloSeccion extra={<ConteoSemaforo conteo={d.conteo} vacio="Sin verificar" />}>Variables</TituloSeccion>
            <Hoja className="overflow-x-auto">
              {extracciones.length > 0 ? (
                <table className="w-full text-[0.8125rem]">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="th py-2 pl-4">Variable</th>
                      <th className="th py-2 pl-3 text-right">Valor extraído</th>
                      <th className="th py-2 pr-4 pl-4 sm:pr-3">Folio</th>
                      <th className="th hidden py-2 pr-4 sm:table-cell">Método</th>
                    </tr>
                  </thead>
                  {SECCIONES.map((sec) => {
                    const filas = extracciones.filter((e) => vari.get(e.variableKey)?.seccion === sec.key);
                    if (!filas.length) return null;
                    return (
                      <tbody key={sec.key}>
                        <tr>
                          <th colSpan={4} className="border-b border-line bg-paper py-1.5 pl-4 text-left text-2xs font-bold text-ink-2">
                            {CAPTION[sec.key]}
                          </th>
                        </tr>
                        {filas.map((e) => {
                          const v = vari.get(e.variableKey)!;
                          const total = TOTALES.has(e.variableKey);
                          const sub = v.tipo === "cifra" && !total;
                          return (
                            <tr key={e.variableKey} className={cx("border-b border-line last:border-b-0", total && "font-semibold")}>
                              <td className={cx("py-1.5", sub ? "pl-8" : "pl-4")}>
                                <span className={cx("inline-flex items-center gap-2", total ? "text-ink" : "text-ink-2")}>
                                  <IconoSemaforo s={e.semaforo} />
                                  {v.nombre}
                                </span>
                              </td>
                              <td className="cifra py-1.5 pl-3 text-right whitespace-nowrap">
                                {e.estado === "NO_ENCONTRADO" ? (
                                  <span className="font-semibold text-rojo">NO_ENCONTRADO</span>
                                ) : (
                                  <span className={cx("font-semibold text-ink", total && "regla-simple doble-regla inline-block pt-0.5")}>
                                    {formatValor(v.tipo, e.valor)}
                                  </span>
                                )}
                              </td>
                              <td className="cifra py-1.5 pr-4 pl-4 text-2xs font-bold whitespace-nowrap text-sello sm:pr-3">{e.folio ? `f. ${e.folio}` : "—"}</td>
                              <td className="hidden py-1.5 pr-4 text-xs font-normal text-ink-3 sm:table-cell">{e.metodo === "regla" ? "Regla" : "LLM"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    );
                  })}
                </table>
              ) : (
                <Vacio titulo={d.conteo.verde + d.conteo.amarillo + d.conteo.rojo > 0 ? "Detalle disponible al conectar la API." : "Aún no hay variables extraídas."}>
                  {d.conteo.verde + d.conteo.amarillo + d.conteo.rojo > 0
                    ? "En esta demostración solo tres documentos traen el detalle completo. Pruebe con Valle Alto, San Ramón del Río o La Esperanza del Llano."
                    : "Las variables aparecen cuando el documento termina la etapa de extracción."}
                </Vacio>
              )}
            </Hoja>
          </section>

          {correcciones.length > 0 && (
            <section>
              <TituloSeccion extra={`${correcciones.length} entradas`}>Registro de correcciones</TituloSeccion>
              <Hoja>
                <TablaCorrecciones correcciones={correcciones} documentos={[d]} variables={variables} estudiantes={estudiantes} />
              </Hoja>
            </section>
          )}
        </div>

        <aside className="grid content-start gap-6">
          <Hoja className="p-4">
            <AccionesDocumento documento={d} estudiantes={estudiantes} />
          </Hoja>
          <Hoja className="p-4">
            <dl className="cifra grid grid-cols-[1fr_auto] gap-y-1.5 text-[0.8125rem]">
              <dt className="font-sans text-ink-2">Folios</dt>
              <dd className="text-right font-semibold">{d.folios}</dd>
              <dt className="font-sans text-ink-2">Escaneados (OCR)</dt>
              <dd className="text-right font-semibold">{d.foliosEscaneados}</dd>
              <dt className="font-sans text-ink-2">Localizados</dt>
              <dd className="text-right font-semibold">{paginas.filter((p) => p.localizada).length}</dd>
              <dt className="font-sans text-ink-2">Variables resueltas</dt>
              <dd className="text-right font-semibold">
                {d.revisadas} / {d.totalVariables}
              </dd>
              <dt className="font-sans text-ink-2">Carga</dt>
              <dd className="text-right font-sans text-ink-2">{d.lote.split(" · ")[0]}</dd>
            </dl>
          </Hoja>
        </aside>
      </div>
    </>
  );
}

function LineaEtapas({ d }: { d: Documento }) {
  const actual = ETAPAS.findIndex((e) => e.key === d.etapa);
  const estado = (k: Etapa, i: number) =>
    i < actual || d.estadoEtapa === "completa" && i === actual ? "completa" : i === actual ? d.estadoEtapa : "pendiente";

  return (
    <ol className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4 lg:grid-cols-7" aria-label="Etapas del pipeline">
      {ETAPAS.map((e, i) => {
        const s = estado(e.key, i);
        return (
          <li
            key={e.key}
            aria-current={i === actual ? "step" : undefined}
            className={cx("px-3 py-2.5", s === "error" ? "bg-rojo-bg" : i === actual ? "bg-sheet" : "bg-paper")}
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              {s === "completa" && <Check className="size-3.5 text-verde" strokeWidth={2.5} aria-hidden />}
              {s === "en_curso" && <Loader className="size-3.5 animate-spin text-rail [animation-duration:2.4s]" aria-hidden />}
              {s === "error" && <OctagonX className="size-3.5 text-rojo" aria-hidden />}
              {s === "pendiente" && <span className="size-3.5 rounded-full border border-dashed border-line-strong" aria-hidden />}
              <span className={cx(s === "pendiente" ? "text-ink-3" : s === "error" ? "text-rojo" : "text-ink")}>{e.nombre}</span>
            </span>
            <span className="mt-0.5 block text-2xs text-ink-3">
              {s === "completa" ? "Completa" : s === "en_curso" ? "En curso" : s === "error" ? "Con error" : i === actual ? "En cola" : "—"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Mapa de folios: una celda por página, todas numeradas. Los estados se combinan:
 * relleno de sello = localizada; borde inferior grueso = escaneada (pasó por OCR).
 */
function MapaFolios({ paginas }: { paginas: PaginaPdf[] }) {
  const escaneadas = paginas.filter((p) => p.tipo === "escaneada").length;
  return (
    <section>
      <TituloSeccion
        extra={
          <span className="flex flex-wrap gap-x-3">
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-[2px] border border-line-strong bg-sheet" /> Digital
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-[2px] border border-line-strong border-b-[3px] border-b-ink-2 bg-sheet" /> Escaneada ({escaneadas})
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-[2px] bg-sello" /> Localizada
            </span>
          </span>
        }
      >
        Folios
      </TituloSeccion>
      <Hoja className="p-3">
        <ol className="grid grid-cols-[repeat(auto-fill,minmax(28px,1fr))] gap-1" aria-label={`${paginas.length} folios`}>
          {paginas.map((p) => (
            <li
              key={p.n}
              title={`Folio ${p.n} · ${p.tipo === "escaneada" ? "escaneada" : "digital"}${p.localizada ? " · localizada" : ""}${p.titulo ? ` · ${p.titulo}` : ""}`}
              className={cx(
                "cifra flex h-7 items-center justify-center rounded-[2px] border text-[0.625rem] leading-none font-semibold",
                p.localizada ? "border-sello bg-sello text-white" : "border-line bg-sheet text-ink-3",
                p.tipo === "escaneada" && "border-b-[3px] border-b-ink-2",
              )}
            >
              {p.n}
            </li>
          ))}
        </ol>
      </Hoja>
    </section>
  );
}
