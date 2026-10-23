import type { Metadata } from "next";
import { Encabezado, Pagina } from "@/components/ui/base";
import { Auditoria } from "@/components/coordinacion/auditoria";
import { listarEstudiantes, listarVariables, muestraAuditoria } from "@/lib/data";

export const metadata: Metadata = { title: "Auditoría" };

export default async function PaginaAuditoria() {
  const [muestra, variables, estudiantes] = await Promise.all([muestraAuditoria(), listarVariables(), listarEstudiantes()]);
  return (
    <Pagina ancho="amplio">
      <Encabezado
        titulo="Auditoría de verdes"
        descripcion="Los verdes se confirman rápido, así que una muestra aleatoria del 5–10 % se vuelve a mirar contra el PDF. Si la tasa de error sube, se revisan las reglas."
      />
      <div className="mt-6">
        <Auditoria muestra={muestra} variables={variables} estudiantes={estudiantes} />
      </div>
    </Pagina>
  );
}
