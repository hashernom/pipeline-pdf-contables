import { AppShell } from "@/components/shell/app-shell";
import { estudianteActual } from "@/lib/data";

export default async function LayoutEstudiante({ children }: { children: React.ReactNode }) {
  const est = await estudianteActual();
  return (
    <AppShell rol="estudiante" usuario={est}>
      {children}
    </AppShell>
  );
}
