import type { TipoVariable } from "@/lib/types";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** 148532418906 → "148.532.418.906"; negativos entre paréntesis, como en los estados. */
export function formatCifra(valor: string | number | null): string {
  if (valor === null || valor === "") return "—";
  const n = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(n)) return String(valor);
  const s = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return n < 0 ? `(${s})` : s;
}

/** "(1.234.567)" o "1.234.567" → "-1234567" / "1234567". null si no es cifra. */
export function parseCifra(texto: string): string | null {
  const t = texto.trim();
  const negativo = /^\(.*\)$/.test(t) || t.startsWith("-");
  const digitos = t.replace(/[^\d]/g, "");
  if (!digitos) return null;
  return (negativo ? "-" : "") + digitos.replace(/^0+(?=\d)/, "");
}

/** Cifra en forma corta para resúmenes: 148,5 mil millones. */
export function formatCifraCorta(valor: number): string {
  const abs = Math.abs(valor);
  const f = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 1 });
  if (abs >= 1e12) return `${f(valor / 1e12)} billones`;
  if (abs >= 1e9) return `${f(valor / 1e9)} mil millones`;
  if (abs >= 1e6) return `${f(valor / 1e6)} millones`;
  return formatCifra(valor);
}

export function formatEntero(n: number): string {
  return n.toLocaleString("es-CO");
}

/** Dígito de verificación del NIT (algoritmo DIAN, módulo 11). */
export function nitDigitoVerificacion(base: string): number {
  const pesos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const digitos = base.replace(/\D/g, "").split("").reverse();
  const suma = digitos.reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
  const r = suma % 11;
  return r > 1 ? 11 - r : r;
}

export function validarNit(nit: string): { valido: boolean; esperado: number | null } {
  const m = nit.replace(/\s/g, "").match(/^([\d.]+)-(\d)$/);
  if (!m) return { valido: false, esperado: null };
  const esperado = nitDigitoVerificacion(m[1]);
  return { valido: esperado === Number(m[2]), esperado };
}

export function formatNit(nit: string): string {
  const m = nit.replace(/\D/g, "").match(/^(\d{9})(\d)$/);
  if (!m) return nit;
  return `${m[1].replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3")}-${m[2]}`;
}

/** "31 de diciembre de 2025" → "2025-12-31". */
export function parseFechaEs(texto: string): string | null {
  const m = texto.toLowerCase().match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/);
  if (!m) return /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto : null;
  const mes = MESES.indexOf(m[2]);
  if (mes < 0) return null;
  return `${m[3]}-${String(mes + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** "2025-12-31" → "31 dic 2025". Se formatea a mano para que servidor y cliente coincidan. */
export function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MESES_CORTOS[m - 1]} ${y}`;
}

export function formatFechaHora(iso: string): string {
  const hora = iso.slice(11, 16);
  return `${formatFecha(iso)} · ${hora}`;
}

/** Valor normalizado → texto para mostrar, según el tipo de variable. */
export function formatValor(tipo: TipoVariable, valor: string | null): string {
  if (valor === null) return "—";
  switch (tipo) {
    case "cifra":
      return formatCifra(valor);
    case "fecha":
      return formatFecha(valor);
    case "nit":
      return formatNit(valor);
    case "porcentaje":
      return `${valor.replace(".", ",")} %`;
    default:
      return valor;
  }
}

/** Texto del documento → valor normalizado. */
export function normalizar(tipo: TipoVariable, texto: string): string | null {
  switch (tipo) {
    case "cifra":
      return parseCifra(texto);
    case "fecha":
      return parseFechaEs(texto);
    case "nit":
      return texto.replace(/[^\d-]/g, "").replace("-", "") || null;
    case "porcentaje": {
      const m = texto.match(/(\d+(?:[.,]\d+)?)/);
      return m ? m[1].replace(",", ".") : null;
    }
    default:
      return texto.trim() || null;
  }
}

export function pluralizar(n: number, singular: string, plural: string): string {
  return `${formatEntero(n)} ${n === 1 ? singular : plural}`;
}
