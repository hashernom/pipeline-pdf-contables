import type { Caja, Check, Extraccion, Pagina, ResultadoCheck, Semaforo, Variable } from "@/lib/types";
import { normalizar, validarNit, formatNit } from "@/lib/format";
import { VARIABLES } from "./variables";
import valleAlto from "./generated/valle-alto-2025.json";
import sanRamon from "./generated/san-ramon-2025.json";
import laEsperanza from "./generated/la-esperanza-2025.json";

// Extracciones SIMULADAS construidas sobre los PDFs sintéticos de public/mock/pdfs.
// Cada documento trae fallas inyectadas a propósito para ver los tres colores:
// citas inventadas, lecturas de OCR erradas, descuadres contables y NO_ENCONTRADO.

interface CampoGenerado {
  page: number;
  valueText: string;
  cita: string;
  bbox: Caja;
  scanned: boolean;
}

interface DocGenerado {
  slug: string;
  entidad: string;
  departamento: string;
  nit: string;
  vigencia: number;
  pageSize: { w: number; h: number };
  pageCount: number;
  pages: { n: number; kind: string; title: string }[];
  fields: Record<string, CampoGenerado>;
}

export const DOCS_PDF: Record<string, DocGenerado> = {
  "valle-alto-2025": valleAlto as DocGenerado,
  "san-ramon-2025": sanRamon as DocGenerado,
  "la-esperanza-2025": laEsperanza as DocGenerado,
};

interface Falla {
  /** Valor que "leyó" el sistema, distinto al del documento. */
  leido?: string;
  /** Cita que devolvió el LLM y que no existe en la página. */
  citaInventada?: string;
  noEncontrado?: boolean;
  confianza?: number;
  doblePasada?: string;
  coherencia?: string;
  formato?: string;
}

const FALLAS: Record<string, Record<string, Falla>> = {
  "valle-alto-2025": {
    cxc_impuestos: {
      leido: "3.118.904.205",
      citaInventada: "Cuentas por cobrar de impuestos 3.118.904.205",
    },
    chip: { noEncontrado: true },
    fecha_firma: { doblePasada: "La segunda pasada leyó «14 de febrero de 2025»" },
    opinion: { doblePasada: "La segunda pasada propuso «Con salvedades»" },
    pagos: { confianza: 0.81 },
    compromisos: { confianza: 0.88 },
  },
  "san-ramon-2025": {
    obligaciones: {
      leido: "60.441.908.115",
      confianza: 0.74,
      coherencia: "Recaudo − Obligaciones = 3.873.864.293; el superávit reportado es 3.873.869.293",
    },
    superavit: { coherencia: "No cuadra con Recaudo − Obligaciones leídas" },
    fecha_firma: { leido: "21 de febrero de 2026", confianza: 0.79, doblePasada: "La segunda pasada leyó «27 de febrero de 2026»" },
    representante_legal: { confianza: 0.86 },
    contador: { confianza: 0.91 },
    compromisos: { confianza: 0.84 },
    deuda: { confianza: 0.89 },
  },
  "la-esperanza-2025": {
    activo_total: {
      leido: "62.287.020.991",
      confianza: 0.71,
    },
    deuda: { noEncontrado: true },
    efectivo: { confianza: 0.87 },
    ppe: { confianza: 0.83 },
    patrimonio: { confianza: 0.9 },
    opinion: { doblePasada: "La segunda pasada propuso «Adversa»" },
  },
};

const SECCION_BALANCE = new Set([
  "activo_corriente", "activo_no_corriente", "activo_total",
  "pasivo_corriente", "pasivo_no_corriente", "pasivo_total", "patrimonio",
]);
const SECCION_PPTO = new Set(["recaudo", "obligaciones", "superavit"]);

function confianzaBase(slug: string, key: string): number {
  // Determinista: 0,90-0,99 según el texto de la clave.
  let h = 0;
  for (const c of slug + key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 0.9 + (h % 10) / 100;
}

function checkFormato(v: Variable, texto: string, falla?: Falla): Check {
  if (falla?.formato) return { tipo: "formato", resultado: "alerta", detalle: falla.formato };
  switch (v.tipo) {
    case "nit": {
      const { valido, esperado } = validarNit(texto);
      return valido
        ? { tipo: "formato", resultado: "pasa", detalle: `NIT con dígito de verificación válido (${texto.slice(-1)})` }
        : { tipo: "formato", resultado: "falla", detalle: `Dígito de verificación no coincide; se esperaba ${esperado}` };
    }
    case "cifra":
      return { tipo: "formato", resultado: "pasa", detalle: "Cifra normalizada a pesos" };
    case "fecha":
      return { tipo: "formato", resultado: "pasa", detalle: "Fecha válida y dentro de la vigencia" };
    case "opcion":
      return { tipo: "formato", resultado: "pasa", detalle: "Valor dentro de las opciones permitidas" };
    default:
      return { tipo: "formato", resultado: "pasa", detalle: "Texto sin caracteres extraños" };
  }
}

function semaforoDe(checks: Check[], encontrado: boolean): Semaforo {
  if (!encontrado || checks.some((c) => c.resultado === "falla")) return "rojo";
  if (checks.some((c) => c.resultado === "alerta")) return "amarillo";
  return "verde";
}

export function construirExtracciones(slug: string): Extraccion[] {
  const doc = DOCS_PDF[slug];
  const fallas = FALLAS[slug] ?? {};
  let verdes = 0;

  return VARIABLES.map((v) => {
    const campo = doc.fields[v.key];
    const falla = fallas[v.key];

    if (!campo || falla?.noEncontrado) {
      const checks: Check[] = [
        { tipo: "cita_en_pagina", resultado: "no_aplica", detalle: "Sin cita: el modelo respondió NO_ENCONTRADO" },
        { tipo: "valor_de_cita", resultado: "no_aplica", detalle: "Sin valor que comprobar" },
      ];
      return {
        variableKey: v.key,
        estado: "NO_ENCONTRADO",
        valor: null,
        valorDocumento: null,
        cita: null,
        folio: null,
        caja: null,
        confianzaOcr: null,
        metodo: v.metodo,
        checks,
        semaforo: "rojo",
        auditoria: false,
      } satisfies Extraccion;
    }

    const leido = falla?.leido ?? campo.valueText;
    const cita = falla?.citaInventada ?? (falla?.leido ? campo.cita.replace(campo.valueText, falla.leido) : campo.cita);
    const confianza = campo.scanned ? (falla?.confianza ?? confianzaBase(slug, v.key)) : null;

    const checks: Check[] = [];
    checks.push(
      falla?.citaInventada
        ? { tipo: "cita_en_pagina", resultado: "falla", detalle: `La cita no aparece en el folio ${campo.page}. Posible alucinación.` }
        : { tipo: "cita_en_pagina", resultado: "pasa", detalle: `La cita aparece en el folio ${campo.page}` },
    );
    checks.push(
      falla?.citaInventada
        ? { tipo: "valor_de_cita", resultado: "no_aplica", detalle: "No se comprueba: la cita no existe" }
        : { tipo: "valor_de_cita", resultado: "pasa", detalle: "El valor se lee dentro de la cita" },
    );
    checks.push(checkFormato(v, v.tipo === "nit" ? formatNit(normalizar("nit", leido) ?? leido) : leido, falla));

    if (SECCION_BALANCE.has(v.key) || SECCION_PPTO.has(v.key)) {
      const regla = SECCION_BALANCE.has(v.key) ? "Activo = Pasivo + Patrimonio" : "Recaudo − Obligaciones = Superávit";
      const descuadre =
        falla?.coherencia ??
        (slug === "la-esperanza-2025" && SECCION_BALANCE.has(v.key) ? "Activo total no cuadra con Pasivo + Patrimonio" : undefined);
      const resultado: ResultadoCheck = descuadre ? (falla?.leido ? "falla" : "alerta") : "pasa";
      checks.push({ tipo: "coherencia", resultado, detalle: descuadre ?? `${regla} cuadra` });
    }

    if (v.critica) {
      checks.push(
        falla?.doblePasada
          ? { tipo: "doble_pasada", resultado: "alerta", detalle: falla.doblePasada }
          : { tipo: "doble_pasada", resultado: "pasa", detalle: "Las dos pasadas coinciden" },
      );
    } else if (falla?.doblePasada) {
      checks.push({ tipo: "doble_pasada", resultado: "alerta", detalle: falla.doblePasada });
    }

    if (confianza !== null) {
      const ok = confianza >= 0.9;
      checks.push({
        tipo: "confianza_ocr",
        resultado: ok ? "pasa" : "alerta",
        detalle: `Confianza media del OCR ${confianza.toFixed(2).replace(".", ",")} (umbral 0,90)`,
      });
    }

    const semaforo = semaforoDe(checks, true);
    if (semaforo === "verde") verdes += 1;

    return {
      variableKey: v.key,
      estado: "ENCONTRADO",
      valor: normalizar(v.tipo, leido),
      valorDocumento: leido,
      cita,
      folio: campo.page,
      caja: campo.bbox,
      confianzaOcr: confianza,
      metodo: v.metodo,
      checks,
      semaforo,
      // Muestra aleatoria (determinista) de verdes para auditoría: ~1 de cada 12.
      auditoria: semaforo === "verde" && verdes % 12 === 3,
    } satisfies Extraccion;
  });
}

export function paginasDe(slug: string): Pagina[] {
  const doc = DOCS_PDF[slug];
  const localizadas = new Set(Object.values(doc.fields).map((f) => f.page));
  return doc.pages.map((p) => ({
    n: p.n,
    tipo: p.kind === "escaneada" ? "escaneada" : "digital",
    titulo: p.title || "Portada",
    localizada: localizadas.has(p.n),
    confianzaOcr: p.kind === "escaneada" ? confianzaBase(slug, `p${p.n}`) - 0.04 : null,
  }));
}
