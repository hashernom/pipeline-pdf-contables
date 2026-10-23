import type { Metadata } from "next";
import { Encabezado, Hoja, Pagina, TituloSeccion } from "@/components/ui/base";
import { Subida } from "@/components/coordinacion/subida";
import { listarLotes } from "@/lib/data";
import { formatFechaHora } from "@/lib/format";

export const metadata: Metadata = { title: "Ingesta" };

export default async function Ingesta() {
  const lotes = await listarLotes();
  return (
    <Pagina>
      <Encabezado
        titulo="Ingesta"
        descripcion="Los PDF se guardan y entran a la cola de trabajo. Desde ahí pasan solos por OCR, localización, extracción y verificación."
      />
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Subida />
        <section>
          <TituloSeccion>Cargas anteriores</TituloSeccion>
          <Hoja>
            <table className="w-full text-[0.8125rem]">
              <thead>
                <tr className="border-b border-line">
                  <th className="th py-2 pl-4">Carga</th>
                  <th className="th py-2 pr-4 text-right">Procesados</th>
                </tr>
              </thead>
              <tbody>
                {lotes.map((l) => (
                  <tr key={l.id} className="border-b border-line last:border-b-0">
                    <td className="py-2.5 pl-4">
                      <span className="block font-semibold text-ink">{l.nombre}</span>
                      <span className="cifra block text-2xs text-ink-3">
                        {formatFechaHora(l.fecha)} · {l.subidoPor}
                      </span>
                    </td>
                    <td className="cifra py-2.5 pr-4 text-right align-top">
                      <span className="font-semibold text-ink">{l.procesados}</span>
                      <span className="text-ink-3">/{l.archivos}</span>
                      {l.conError > 0 && <span className="block text-2xs font-semibold text-rojo">{l.conError} con error</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Hoja>
        </section>
      </div>
    </Pagina>
  );
}
