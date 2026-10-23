import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, OctagonX } from "lucide-react";
import { BotonLink, Encabezado, Hoja, Pagina, TituloSeccion, cx } from "@/components/ui/base";
import { IconoSemaforo } from "@/components/ui/marcas";
import { ETAPAS, NOMBRE_ETAPA, SEMAFORO } from "@/lib/etapas";
import { cargaPorEstudiante, listarDocumentos, listarLotes, resumenPipeline } from "@/lib/data";
import { formatEntero, formatFecha } from "@/lib/format";

export const metadata: Metadata = { title: "Lote" };

const pct = (n: number, t: number) => (t ? `${((n / t) * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %` : "—");

export default async function Lote() {
  const [resumen, docs, carga, lotes] = await Promise.all([resumenPipeline(), listarDocumentos(), cargaPorEstudiante(), listarLotes()]);
  const total = docs.length;
  const errores = docs.filter((d) => d.estadoEtapa === "error");
  const verificados = docs.filter((d) => d.etapa === "revision" || d.etapa === "dataset");
  const vars = verificados.reduce(
    (a, d) => ({ rojo: a.rojo + d.conteo.rojo, amarillo: a.amarillo + d.conteo.amarillo, verde: a.verde + d.conteo.verde }),
    { rojo: 0, amarillo: 0, verde: 0 },
  );
  const totalVars = vars.rojo + vars.amarillo + vars.verde;
  const sinAsignar = docs.filter((d) => d.etapa === "revision" && !d.asignadoA).length;
  const enDataset = resumen.find((r) => r.etapa === "dataset")!.completa;
  const masCargados = [...carga].sort((a, b) => b.pendientesRojo - a.pendientesRojo).slice(0, 5);

  return (
    <Pagina ancho="amplio">
      <Encabezado
        titulo="Lote"
        descripcion={
          <>
            <b className="cifra text-ink">{formatEntero(total)}</b> PDF en {lotes.length} cargas.{" "}
            <b className="cifra text-ink">{formatEntero(enDataset)}</b> ya están en el dataset ({pct(enDataset, total)}). Corte de los datos: 23 oct 2026.
          </>
        }
        acciones={
          <>
            <BotonLink href="/coordinacion/ingesta" variante="secundario">
              Subir PDF
            </BotonLink>
            <BotonLink href="/coordinacion/asignacion" variante="primario">
              Asignar {sinAsignar} sin asignar
            </BotonLink>
          </>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)]">
        {/* Estado del pipeline como un estado de cuenta */}
        <section>
          <TituloSeccion extra="Un documento cuenta como completo en una etapa cuando ya pasó a la siguiente">Pipeline por etapa</TituloSeccion>
          <Hoja className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[0.8125rem]">
              <thead>
                <tr className="border-b border-line">
                  <th className="th py-2 pl-4">Etapa</th>
                  <th className="th w-[34%] py-2 pl-2">Avance</th>
                  <th className="th py-2 text-right">Pendiente</th>
                  <th className="th py-2 text-right">En curso</th>
                  <th className="th py-2 text-right">Con error</th>
                  <th className="th py-2 pr-4 text-right">Completa</th>
                </tr>
              </thead>
              <tbody className="cifra">
                {resumen.map((r, i) => {
                  const e = ETAPAS[i];
                  const seg = [
                    { n: r.completa, c: "bg-rail" },
                    { n: r.enCurso, c: "bg-[#6f9a8d]" },
                    { n: r.error, c: "bg-rojo" },
                    { n: r.pendiente, c: "bg-line" },
                  ];
                  return (
                    <tr key={r.etapa} className="border-b border-line last:border-b-0">
                      <td className="py-2.5 pl-4">
                        <span className="flex items-baseline gap-2">
                          <span className="w-3 text-2xs text-ink-3">{i + 1}</span>
                          <span>
                            <span className="block font-semibold text-ink">{e.nombre}</span>
                            <span className="block font-sans text-2xs text-ink-3">{e.herramienta}</span>
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 pl-2">
                        <span className="flex h-2 w-full overflow-hidden rounded-full bg-panel" aria-hidden>
                          {seg.map((s, k) => (
                            <span key={k} className={s.c} style={{ width: `${(s.n / total) * 100}%` }} />
                          ))}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-ink-2">{formatEntero(r.pendiente)}</td>
                      <td className="py-2.5 text-right text-ink-2">{formatEntero(r.enCurso)}</td>
                      <td className="py-2.5 text-right">
                        {r.error ? (
                          <Link
                            href={`/coordinacion/documentos?etapa=${r.etapa}&estado=error`}
                            className="font-semibold text-rojo underline decoration-rojo/30 hover:decoration-rojo"
                          >
                            {r.error}
                          </Link>
                        ) : (
                          <span className="text-ink-3">0</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-semibold text-ink">{formatEntero(r.completa)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Hoja>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-ink-3">
            <Ley c="bg-rail">Completa</Ley>
            <Ley c="bg-[#6f9a8d]">En curso</Ley>
            <Ley c="bg-rojo">Con error</Ley>
            <Ley c="bg-line">Pendiente</Ley>
          </p>

          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <section>
              <TituloSeccion extra={`${formatEntero(verificados.length)} documentos verificados`}>Variables por color</TituloSeccion>
              <Hoja className="px-4 py-3">
                <dl className="cifra grid grid-cols-[1fr_auto_auto] gap-x-6 gap-y-1.5 text-[0.8125rem]">
                  {(["rojo", "amarillo", "verde"] as const).map((s) => (
                    <div key={s} className="contents">
                      <dt className="flex items-center gap-1.5 font-sans text-ink-2">
                        <IconoSemaforo s={s} />
                        {SEMAFORO[s].nombre}
                        <span className="text-2xs text-ink-3">· {SEMAFORO[s].accion.toLowerCase()}</span>
                      </dt>
                      <dd className="text-right font-semibold text-ink">{formatEntero(vars[s])}</dd>
                      <dd className="w-14 text-right text-ink-3">{pct(vars[s], totalVars)}</dd>
                    </div>
                  ))}
                  <dt className="regla-simple pt-1.5 font-sans font-bold text-ink">Total</dt>
                  <dd className="regla-simple pt-1.5 text-right">
                    <span className="doble-regla font-bold">{formatEntero(totalVars)}</span>
                  </dd>
                  <dd className="regla-simple pt-1.5 text-right text-ink-3">100 %</dd>
                </dl>
              </Hoja>
            </section>

            <section>
              <TituloSeccion>Cargas</TituloSeccion>
              <Hoja>
                <ul>
                  {lotes.map((l) => (
                    <li key={l.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-[0.8125rem] last:border-b-0">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">{l.nombre}</span>
                        <span className="block text-2xs text-ink-3">
                          {formatFecha(l.fecha)} · {l.subidoPor}
                        </span>
                      </span>
                      <span className="cifra text-right text-xs text-ink-2">
                        {l.procesados}/{l.archivos}
                        {l.conError > 0 && <span className="block text-2xs font-semibold text-rojo">{l.conError} con error</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </Hoja>
            </section>
          </div>
        </section>

        {/* Dónde hace falta atención */}
        <aside className="grid content-start gap-8">
          <section>
            <TituloSeccion extra={<Link href="/coordinacion/documentos?estado=error" className="hover:text-ink">Ver todos</Link>}>
              Errores por resolver
            </TituloSeccion>
            <Hoja>
              <ul>
                {errores.slice(0, 6).map((d) => (
                  <li key={d.id} className="border-b border-line last:border-b-0">
                    <Link href={`/coordinacion/documentos/${d.id}`} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-paper">
                      <OctagonX className="mt-0.5 size-3.5 shrink-0 text-rojo" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.8125rem] font-semibold text-ink">
                          {d.entidad} <span className="cifra font-normal text-ink-3">{d.vigencia}</span>
                        </span>
                        <span className="block text-xs text-ink-2">
                          {NOMBRE_ETAPA[d.etapa]}: {d.errorEtapa}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {errores.length > 6 && (
                <p className="border-t border-line px-4 py-2 text-xs text-ink-3">Y {errores.length - 6} más.</p>
              )}
            </Hoja>
          </section>

          <section>
            <TituloSeccion extra={<Link href="/coordinacion/asignacion" className="hover:text-ink">Asignación</Link>}>
              Más rojos pendientes
            </TituloSeccion>
            <Hoja>
              <table className="w-full text-[0.8125rem]">
                <thead>
                  <tr className="border-b border-line">
                    <th className="th py-2 pl-4">Estudiante</th>
                    <th className="th py-2 text-right">Docs.</th>
                    <th className="th py-2 pr-4 text-right">Rojos</th>
                  </tr>
                </thead>
                <tbody className="cifra">
                  {masCargados.map((c) => (
                    <tr key={c.estudiante.id} className="border-b border-line last:border-b-0">
                      <td className="py-2 pl-4 font-sans text-ink">
                        {c.estudiante.nombre}
                        <span className="ml-1.5 text-2xs text-ink-3">{c.estudiante.grupo}</span>
                      </td>
                      <td className="py-2 text-right text-ink-2">{c.enRevision}</td>
                      <td className={cx("py-2 pr-4 text-right font-semibold", c.pendientesRojo > 60 ? "text-rojo" : "text-ink")}>
                        {c.pendientesRojo}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Hoja>
          </section>

          <Link
            href="/coordinacion/auditoria"
            className="group flex items-center gap-3 rounded-md border border-sello-line bg-sello-bg/50 px-4 py-3 text-[0.8125rem] text-sello-ink hover:bg-sello-bg"
          >
            <span className="flex-1">
              <b>Auditoría de verdes.</b> Hay muestras sin revisar del 5–10 % de los verdes confirmados.
            </span>
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </aside>
      </div>
    </Pagina>
  );
}

function Ley({ c, children }: { c: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cx("size-2 rounded-full", c)} />
      {children}
    </span>
  );
}
