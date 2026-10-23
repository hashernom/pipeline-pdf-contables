import type { Metadata } from "next";
import { Encabezado, Pagina } from "@/components/ui/base";
import { CatalogoVariables } from "@/components/coordinacion/catalogo-variables";
import { listarVariables } from "@/lib/data";

export const metadata: Metadata = { title: "Variables" };

export default async function Variables() {
  const variables = await listarVariables();
  return (
    <Pagina ancho="amplio">
      <Encabezado
        titulo="Variables"
        descripcion="El catálogo que se extrae de cada PDF: tipo, regla y palabras clave. La lista actual es un borrador para construir la interfaz; la definitiva sale de la Fase 0."
      />
      <div className="mt-6">
        <CatalogoVariables inicial={variables} />
      </div>
    </Pagina>
  );
}
