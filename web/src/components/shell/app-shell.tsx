import type { ReactNode } from "react";
import type { Role } from "@/lib/types";
import { Rail } from "./rail";

export function AppShell({
  rol,
  usuario,
  children,
}: {
  rol: Role;
  usuario: { nombre: string; iniciales: string };
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <Rail rol={rol} usuario={usuario} />
      <main id="contenido" className="min-w-0 flex-1 max-md:pb-14">
        {children}
      </main>
    </div>
  );
}
