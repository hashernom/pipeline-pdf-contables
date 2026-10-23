import type { Metadata } from "next";
import { Suspense } from "react";
import { Cola } from "@/components/revision/cola";
import { Encabezado, Pagina } from "@/components/ui/base";
import { colaDeEstudiante, estudianteActual } from "@/lib/data";

export const metadata: Metadata = { title: "Mi cola" };

export default async function MiCola() {
  const est = await estudianteActual();
  const docs = await colaDeEstudiante(est.id);
  const enRevision = docs.filter((d) => d.etapa === "revision");
  const enviados = docs.filter((d) => d.etapa === "dataset");
  const pendientes = enRevision.reduce((a, d) => a + d.totalVariables - d.revisadas, 0);

  return (
    <Pagina>
      <Encabezado
        titulo="Mi cola"
        descripcion={`Hola, ${est.nombre.split(" ")[0]}. Tiene ${enRevision.length} documentos asignados y unas ${pendientes} variables por revisar. Empiece por los que tienen rojos.`}
      />
      <div className="mt-6">
        <Suspense>
          <Cola enRevision={enRevision} enviados={enviados} />
        </Suspense>
      </div>
    </Pagina>
  );
}
