import { AppShell } from "@/components/shell/app-shell";
import { COORDINADORA } from "@/lib/mock/documentos";

export default function LayoutCoordinacion({ children }: { children: React.ReactNode }) {
  return (
    <AppShell rol="coordinador" usuario={COORDINADORA}>
      {children}
    </AppShell>
  );
}
