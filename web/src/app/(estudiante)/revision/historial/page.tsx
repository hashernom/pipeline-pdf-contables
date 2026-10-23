import type { Metadata } from "next";
import { Encabezado, Hoja, Pagina, TituloSeccion, Vacio } from "@/components/ui/base";
import { TablaCorrecciones } from "@/components/coordinacion/tabla-correcciones";
import { colaDeEstudiante, estudianteActual, listarCorrecciones, listarVariables } from "@/lib/data";

export const metadata: Metadata = { title: "Enviados" };

export default async function Historial() {
  const est = await estudianteActual();
  const [docs, todas, variables] = await Promise.all([colaDeEstudiante(est.id), listarCorrecciones(), listarVariables()]);
  const mias = todas.filter((c) => c.estudianteId === est.id);
  const enviados = docs.filter((d) => d.etapa === "dataset");

  return (
    <Pagina>
      <Encabezado
        titulo="Enviados"
        descripcion="Documentos que usted aprobó y las correcciones que dejó en el registro. Coordinación puede auditarlas."
      />
      <section className="mt-6">
        <TituloSeccion extra={`${mias.length} entradas`}>Mis correcciones</TituloSeccion>
        <Hoja>
          {mias.length === 0 ? (
            <Vacio titulo="Aún no ha hecho correcciones.">Cada valor que corrija aparecerá aquí con su cita, su folio y el motivo.</Vacio>
          ) : (
            <TablaCorrecciones correcciones={mias} documentos={enviados.concat(docs)} variables={variables} sinEstudiante />
          )}
        </Hoja>
      </section>
    </Pagina>
  );
}
