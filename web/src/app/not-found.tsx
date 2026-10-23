import Link from "next/link";

export default function NoEncontrado() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md">
        <p className="cifra text-sm font-bold text-sello">f. —</p>
        <h1 className="mt-2 text-[1.375rem] font-bold text-ink">Esta página no está en el documento.</h1>
        <p className="mt-2 text-[0.8125rem] text-ink-2">
          La dirección no corresponde a ningún documento ni pantalla. Puede que el documento se haya reasignado o que el enlace esté incompleto.
        </p>
        <div className="mt-5 flex gap-4 text-[0.8125rem] font-semibold">
          <Link href="/revision" className="text-rail underline">
            Ir a mi cola
          </Link>
          <Link href="/coordinacion" className="text-rail underline">
            Ir al lote
          </Link>
        </div>
      </div>
    </main>
  );
}
