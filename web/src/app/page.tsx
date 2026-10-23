import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { COORDINADORA, ESTUDIANTES, ESTUDIANTE_ACTUAL, DOCUMENTOS } from "@/lib/mock/documentos";
import { formatEntero } from "@/lib/format";

export default function Entrada() {
  const est = ESTUDIANTES.find((e) => e.id === ESTUDIANTE_ACTUAL)!;
  const enRevision = DOCUMENTOS.filter((d) => d.asignadoA === est.id && d.etapa === "revision").length;

  return (
    <main className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Lado del producto: el mecanismo, mostrado como en un estado. */}
      <section className="flex flex-col justify-between bg-rail px-8 py-10 text-rail-ink lg:px-14 lg:py-14">
        <div>
          <p className="text-[1.375rem] font-extrabold tracking-[-0.02em]">Folio</p>
          <h1 className="mt-10 max-w-[18ch] text-[2.125rem] font-bold leading-[1.1] tracking-[-0.02em] text-white">
            Ningún dato sin su cita y su folio.
          </h1>
          <p className="mt-4 max-w-[46ch] text-[0.9375rem] text-rail-muted">
            Extracción verificable de los estados financieros municipales. El sistema propone; usted confirma o corrige con el PDF a la vista.
          </p>
        </div>

        <figure aria-label="Ejemplo de una variable verificada" className="mt-12 max-w-[440px]">
          <div className="rounded-md bg-sheet p-4 text-ink shadow-pop">
            <div className="flex items-baseline justify-between text-2xs font-semibold text-ink-3">
              <span>Estado de situación financiera</span>
              <span>Vigencia 2025</span>
            </div>
            <dl className="cifra mt-2 grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 gap-y-1 text-[0.8125rem]">
              <dt className="text-ink-2">Pasivo total</dt>
              <dd className="text-right font-semibold">31.204.775.120</dd>
              <dd className="text-2xs font-bold text-sello">f. 7</dd>
              <dt className="text-ink-2">Patrimonio</dt>
              <dd className="text-right font-semibold">117.327.643.786</dd>
              <dd className="text-2xs font-bold text-sello">f. 7</dd>
              <dt className="regla-simple pt-1 font-bold">Activo total</dt>
              <dd className="regla-simple pt-1 text-right">
                <span className="doble-regla font-bold">148.532.418.906</span>
              </dd>
              <dd className="pt-1 text-2xs font-bold text-sello">f. 6</dd>
            </dl>
            <p className="mt-3 rounded-sm border border-sello-line bg-sello-bg/60 px-2 py-1 text-xs text-ink">
              «TOTAL ACTIVO 148.532.418.906»
              <span className="block text-2xs font-semibold text-sello-ink">Cita literal · folio 6</span>
            </p>
          </div>
          <figcaption className="mt-3 text-2xs text-rail-muted">Municipio ficticio. Cifras de demostración.</figcaption>
        </figure>
      </section>

      {/* Ingreso simulado */}
      <section className="flex items-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-[420px]">
          <h2 className="text-[1.25rem] font-bold text-ink">Entrar</h2>
          <p className="mt-1 text-[0.8125rem] text-ink-2">Elija con qué rol quiere ver la aplicación.</p>

          <ul className="mt-6 grid grid-cols-1 gap-2">
            <li>
              <Link
                href="/revision"
                className="group flex items-center gap-3 rounded-md border border-line-strong bg-sheet px-4 py-3 transition-colors hover:border-rail hover:bg-paper"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-rail text-xs font-bold text-rail-ink">
                  {est.iniciales}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">Estudiante revisor</span>
                  <span className="block truncate text-xs text-ink-2">
                    {est.nombre} · {enRevision} documentos en revisión
                  </span>
                </span>
                <ArrowRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
              </Link>
            </li>
            <li>
              <Link
                href="/coordinacion"
                className="group flex items-center gap-3 rounded-md border border-line-strong bg-sheet px-4 py-3 transition-colors hover:border-rail hover:bg-paper"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sello text-xs font-bold text-white">
                  {COORDINADORA.iniciales}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">Coordinación</span>
                  <span className="block truncate text-xs text-ink-2">
                    {COORDINADORA.nombre} · lote de {formatEntero(DOCUMENTOS.length)} PDF
                  </span>
                </span>
                <ArrowRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
              </Link>
            </li>
          </ul>

          <p className="mt-6 flex items-start gap-2 text-xs text-ink-3">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            Ingreso simulado. La autenticación con Supabase se conecta en la fase funcional; todos los datos de esta versión son de demostración.
          </p>
        </div>
      </section>
    </main>
  );
}
