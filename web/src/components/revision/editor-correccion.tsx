"use client";

import { useEffect, useRef, useState } from "react";
import { Crosshair, TriangleAlert } from "lucide-react";
import type { Caja, Extraccion, Variable } from "@/lib/types";
import { formatValor, normalizar, parseCifra } from "@/lib/format";
import { Boton, Kbd, cx } from "@/components/ui/base";
import type { Marca } from "@/components/pdf/visor-pdf";

const MOTIVOS = [
  "El OCR leyó mal una cifra",
  "La cita no existe en el documento",
  "El modelo tomó otra fila o un subtotal",
  "El dato está en otro folio",
  "Formato o signo incorrecto",
  "Otro",
];

export interface Correccion {
  valor: string | null;
  folio: number | null;
  caja: Caja | null;
  cita: string | null;
  motivo: string;
}

export function EditorCorreccion({
  variable,
  extraccion,
  marca,
  marcando,
  onMarcar,
  onGuardar,
  onCancelar,
}: {
  variable: Variable;
  extraccion: Extraccion;
  /** Última marca hecha en el PDF mientras el editor está abierto. */
  marca: Marca | null;
  marcando: boolean;
  onMarcar: () => void;
  onGuardar: (c: Correccion) => void;
  onCancelar: () => void;
}) {
  const inicial = extraccion.valorDocumento ?? "";
  const [valor, setValor] = useState(variable.tipo === "fecha" ? (extraccion.valor ?? "") : inicial);
  const [tocado, setTocado] = useState(false);
  const [cita, setCita] = useState(extraccion.cita ?? "");
  const [folio, setFolio] = useState<number | null>(extraccion.folio);
  const [caja, setCaja] = useState<Caja | null>(extraccion.caja);
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [otro, setOtro] = useState("");
  const [error, setError] = useState<string | null>(null);
  const valorRef = useRef<HTMLInputElement & HTMLSelectElement>(null);

  useEffect(() => {
    valorRef.current?.focus();
    valorRef.current?.select?.();
  }, []);

  // Una marca nueva en el PDF reemplaza la cita y, si el valor no se ha tocado, lo propone.
  // Se ajusta durante el render al cambiar la marca (patrón de estado derivado de props).
  const [marcaVista, setMarcaVista] = useState<Marca | null>(null);
  if (marca && marca !== marcaVista) {
    setMarcaVista(marca);
    setCita(marca.texto);
    setFolio(marca.folio);
    setCaja(marca.caja);
    setError(null);
    if (!tocado && variable.tipo === "cifra") {
      const numeros = marca.texto.match(/\(?\d{1,3}(?:\.\d{3})+\)?/g);
      if (numeros?.length) setValor(numeros[numeros.length - 1]);
    }
  }

  const normalizado = valor.trim() ? normalizar(variable.tipo, valor) : null;
  const vistaPrevia =
    variable.tipo === "cifra" && valor.trim() ? (parseCifra(valor) ? formatValor("cifra", parseCifra(valor)) : null) : null;

  const guardar = () => {
    if (!normalizado) return setError(`Escriba un valor válido para «${variable.nombre}».`);
    if (!cita.trim() || !folio) {
      return setError("Falta la cita. Marque en el PDF de dónde sale el valor: ningún dato entra sin su folio.");
    }
    if (variable.tipo === "cifra" && !cita.replace(/\D/g, "").includes(normalizado.replace("-", ""))) {
      return setError("El valor no aparece dentro de la cita marcada. Revise la cifra o vuelva a marcar.");
    }
    onGuardar({ valor: normalizado, folio, caja, cita: cita.trim(), motivo: motivo === "Otro" ? otro.trim() || "Otro" : motivo });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      guardar();
    } else if (e.key === "Escape" && !marcando) {
      e.preventDefault();
      onCancelar();
    }
  };

  const campo = "h-8 w-full rounded-md border border-line-strong bg-sheet px-2.5 text-[0.8125rem] text-ink placeholder:text-ink-3";

  return (
    <div className="aparece mt-3 grid gap-3 rounded-md border border-line bg-paper p-3" onKeyDown={onKeyDown}>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="grid gap-1">
          <span className="text-2xs font-semibold text-ink-2">Valor correcto</span>
          {variable.tipo === "opcion" && variable.opciones ? (
            <select
              ref={valorRef}
              value={valor}
              onChange={(e) => {
                setValor(e.target.value);
                setTocado(true);
              }}
              className={campo}
            >
              <option value="">Seleccione…</option>
              {variable.opciones.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : (
            <input
              ref={valorRef}
              type={variable.tipo === "fecha" ? "date" : "text"}
              inputMode={variable.tipo === "cifra" ? "numeric" : undefined}
              value={valor}
              onChange={(e) => {
                setValor(e.target.value);
                setTocado(true);
                setError(null);
              }}
              className={cx(campo, variable.tipo === "cifra" && "cifra text-right font-semibold")}
            />
          )}
          {vistaPrevia && <span className="cifra text-right text-2xs text-ink-3">Se guardará como {vistaPrevia}</span>}
        </label>
        <label className="grid content-start gap-1">
          <span className="text-2xs font-semibold text-ink-2">Folio</span>
          <input
            inputMode="numeric"
            value={folio ?? ""}
            onChange={(e) => setFolio(Number(e.target.value) || null)}
            className={cx(campo, "cifra w-20 text-center")}
          />
        </label>
      </div>

      <div className="grid gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-2xs font-semibold text-ink-2">Cita literal</span>
          <Boton tamano="sm" variante={marcando ? "primario" : "secundario"} onClick={onMarcar}>
            <Crosshair className="size-3.5" aria-hidden />
            {marcando ? "Marcando en el PDF…" : "Marcar en el PDF"}
            <Kbd oscuro={marcando}>M</Kbd>
          </Boton>
        </div>
        <textarea
          value={cita}
          onChange={(e) => setCita(e.target.value)}
          rows={2}
          placeholder="Marque el fragmento en el PDF o cópielo tal cual aparece"
          className="w-full resize-none rounded-md border border-sello-line bg-sheet px-2.5 py-1.5 text-[0.8125rem] text-ink placeholder:text-ink-3"
        />
      </div>

      <label className="grid gap-1">
        <span className="text-2xs font-semibold text-ink-2">Motivo</span>
        <div className="flex gap-2">
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className={cx(campo, "flex-1")}>
            {MOTIVOS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          {motivo === "Otro" && (
            <input value={otro} onChange={(e) => setOtro(e.target.value)} placeholder="Describa el motivo" className={cx(campo, "flex-1")} />
          )}
        </div>
      </label>

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-xs font-semibold text-rojo">
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Boton tamano="sm" variante="fantasma" onClick={onCancelar}>
          Cancelar <Kbd>Esc</Kbd>
        </Boton>
        <Boton tamano="sm" variante="primario" onClick={guardar}>
          Guardar corrección <Kbd oscuro>Ctrl ↵</Kbd>
        </Boton>
      </div>
    </div>
  );
}
