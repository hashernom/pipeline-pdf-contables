// Genera PDFs SINTÉTICOS de estados financieros municipales para desarrollar el
// frontend sin datos reales. Los municipios son ficticios y las cifras inventadas.
// Salida:
//   public/mock/pdfs/<slug>.pdf            documento para el visor PDF.js
//   src/lib/mock/generated/<slug>.json     cita, folio y caja (bbox) de cada variable
// La caja usa puntos PDF con origen arriba-izquierda, igual que la salida
// prevista del OCR (palabra + posición), para que el visor no cambie al conectar
// el backend.

import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PDF_DIR = path.join(ROOT, "public/mock/pdfs");
const JSON_DIR = path.join(ROOT, "src/lib/mock/generated");

const W = 612;
const H = 792;
const INK = rgb(0.1, 0.11, 0.12);
const GREY = rgb(0.42, 0.44, 0.46);

function nitDv(base) {
  const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const digits = String(base).split("").reverse();
  const sum = digits.reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
  const r = sum % 11;
  return r > 1 ? 11 - r : r;
}

const pesos = (n) => {
  const s = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return n < 0 ? `(${s})` : s;
};

const ENTITIES = [
  {
    slug: "valle-alto-2025",
    entidad: "Municipio de Valle Alto",
    departamento: "Boyacá",
    categoria: "Sexta",
    nitBase: 891801457,
    vigencia: 2025,
    corte: "31 de diciembre de 2025",
    firma: "14 de febrero de 2026",
    representante: "Laura Milena Castañeda Ruiz",
    contador: "Jorge Andrés Peña Villamil",
    tp: "184562-T",
    opinion: "Limpia",
    scannedPages: [13],
    balance: {
      efectivo: 6_842_115_402,
      cxcImpuestos: 3_118_904_250,
      activoCorriente: 12_906_441_873,
      ppe: 98_412_773_190,
      activoNoCorriente: 135_625_977_033,
      pasivoCorriente: 9_481_206_314,
      pasivoNoCorriente: 21_723_568_806,
      patrimonio: 117_327_643_786,
    },
    resultados: {
      ingresosFiscales: 14_271_390_118,
      transferencias: 22_905_617_440,
      gastosAdmin: 8_114_502_967,
      gastoSocial: 21_640_118_305,
    },
    presupuesto: {
      ingresosDefinitivo: 41_380_000_000,
      recaudo: 38_917_442_615,
      gastosDefinitivo: 41_380_000_000,
      compromisos: 37_206_118_904,
      obligaciones: 35_884_920_117,
      pagos: 34_102_665_380,
    },
    deuda: 4_250_000_000,
    ley617: "61,4 %",
    chip: "Presentado",
  },
  {
    slug: "san-ramon-2025",
    entidad: "Municipio de San Ramón del Río",
    departamento: "Santander",
    categoria: "Quinta",
    nitBase: 890205318,
    vigencia: 2025,
    corte: "31 de diciembre de 2025",
    firma: "27 de febrero de 2026",
    representante: "Édgar Mauricio Rueda Pinzón",
    contador: "Diana Carolina Ortiz Méndez",
    tp: "203117-T",
    opinion: "Con salvedades",
    scannedPages: [3, 13, 14],
    balance: {
      efectivo: 11_405_337_918,
      cxcImpuestos: 5_902_118_446,
      activoCorriente: 19_822_604_175,
      ppe: 154_208_446_302,
      activoNoCorriente: 201_377_915_640,
      pasivoCorriente: 14_117_336_209,
      pasivoNoCorriente: 38_902_771_455,
      patrimonio: 168_180_412_151,
    },
    resultados: {
      ingresosFiscales: 27_660_118_904,
      transferencias: 31_448_205_763,
      gastosAdmin: 12_905_441_388,
      gastoSocial: 33_017_662_490,
    },
    presupuesto: {
      ingresosDefinitivo: 68_900_000_000,
      recaudo: 64_315_772_408,
      gastosDefinitivo: 68_900_000_000,
      compromisos: 63_008_114_772,
      obligaciones: 60_441_903_115,
      pagos: 58_772_018_660,
    },
    deuda: 9_800_000_000,
    ley617: "68,9 %",
    chip: "Presentado",
  },
  {
    slug: "la-esperanza-2025",
    entidad: "Municipio de La Esperanza del Llano",
    departamento: "Meta",
    categoria: "Sexta",
    nitBase: 892099614,
    vigencia: 2025,
    corte: "31 de diciembre de 2025",
    firma: "3 de marzo de 2026",
    representante: "Wilson Arley Guevara Rojas",
    contador: "Paola Andrea Lozano Cruz",
    tp: "176904-T",
    opinion: "Abstención",
    scannedPages: [6, 7, 8, 13, 14, 15],
    balance: {
      efectivo: 2_918_604_337,
      cxcImpuestos: 1_740_225_918,
      activoCorriente: 5_884_102_655,
      ppe: 46_115_380_204,
      activoNoCorriente: 61_402_918_336,
      pasivoCorriente: 4_906_311_872,
      pasivoNoCorriente: 8_115_442_019,
      patrimonio: 54_265_267_100,
    },
    resultados: {
      ingresosFiscales: 5_118_604_227,
      transferencias: 14_772_903_118,
      gastosAdmin: 4_206_115_903,
      gastoSocial: 12_884_906_441,
    },
    presupuesto: {
      ingresosDefinitivo: 22_150_000_000,
      recaudo: 19_884_331_207,
      gastosDefinitivo: 22_150_000_000,
      compromisos: 20_117_904_336,
      obligaciones: 18_906_225_418,
      pagos: 17_441_008_925,
    },
    deuda: 0,
    ley617: "79,2 %",
    chip: "No presentado",
  },
];

async function build(e) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${e.entidad} · Estados financieros ${e.vigencia} (SINTÉTICO)`);
  doc.setProducer("Mock generator: datos sintéticos de demostración");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const oblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  const fields = {};
  const pages = [];
  const nit = `${e.nitBase.toString().replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3")}-${nitDv(e.nitBase)}`;

  const b = e.balance;
  const activoTotal = b.activoCorriente + b.activoNoCorriente;
  const pasivoTotal = b.pasivoCorriente + b.pasivoNoCorriente;
  const r = e.resultados;
  const resultado = r.ingresosFiscales + r.transferencias - r.gastosAdmin - r.gastoSocial;
  const p = e.presupuesto;
  const superavit = p.recaudo - p.obligaciones;

  let page;
  let pageNo = 0;
  let scanned = false;

  const newPage = (title) => {
    page = doc.addPage([W, H]);
    pageNo += 1;
    scanned = e.scannedPages.includes(pageNo);
    pages.push({ n: pageNo, kind: scanned ? "escaneada" : "digital", title });
    if (scanned) {
      // Un escaneo: fondo grisáceo, motas y una leve rotación del texto.
      page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0.95, 0.94, 0.91) });
      for (let i = 0; i < 140; i++) {
        const sx = (i * 97.31) % W;
        const sy = (i * 211.7) % H;
        page.drawCircle({ x: sx, y: sy, size: 0.4 + ((i * 7) % 5) / 6, color: rgb(0.62, 0.6, 0.57), opacity: 0.35 });
      }
    }
    text(`${e.entidad.toUpperCase()} · NIT ${nit}`, 56, 40, 7.5, regular, GREY);
    text(`Folio ${pageNo}`, W - 100, 40, 7.5, regular, GREY);
    if (title) text(title, 56, 78, 13, bold);
  };

  // y es la distancia desde arriba. Devuelve la caja con origen arriba-izquierda.
  function text(str, x, y, size = 10, font = regular, color = INK) {
    const tilt = scanned ? degrees(-0.35) : undefined;
    const c = scanned ? rgb(0.2, 0.2, 0.22) : color;
    page.drawText(str, { x, y: H - y - size * 0.78, size, font, color: c, rotate: tilt });
    const w = font.widthOfTextAtSize(str, size);
    return { x, y, w, h: size };
  }

  function right(str, xRight, y, size = 10, font = regular) {
    const w = font.widthOfTextAtSize(str, size);
    return text(str, xRight - w, y, size, font);
  }

  const union = (a, c) => {
    const x = Math.min(a.x, c.x);
    const y = Math.min(a.y, c.y);
    return { x, y, w: Math.max(a.x + a.w, c.x + c.w) - x, h: Math.max(a.y + a.h, c.y + c.h) - y };
  };
  const pad = (bx, p = 3) => ({ x: bx.x - p, y: bx.y - p, w: bx.w + p * 2, h: bx.h + p * 2 });

  function record(key, valueText, cita, box) {
    fields[key] = { page: pageNo, valueText, cita, bbox: pad(box), scanned };
  }

  // Fila de estado financiero: etiqueta a la izquierda, cifra alineada a la derecha.
  function row(key, label, value, y, opts = {}) {
    const f = opts.bold ? bold : regular;
    const l = text(label, opts.indent ? 72 : 56, y, 9.5, f);
    const v = right(pesos(value), 556, y, 9.5, f);
    if (opts.rule) {
      page.drawLine({ start: { x: 440, y: H - y + 4 }, end: { x: 556, y: H - y + 4 }, thickness: 0.6, color: INK });
    }
    if (opts.double) {
      page.drawLine({ start: { x: 440, y: H - y - 13 }, end: { x: 556, y: H - y - 13 }, thickness: 0.6, color: INK });
      page.drawLine({ start: { x: 440, y: H - y - 15.5 }, end: { x: 556, y: H - y - 15.5 }, thickness: 0.6, color: INK });
    }
    if (key) record(key, pesos(value), `${label} ${pesos(value)}`, union(l, v));
  }

  function paragraph(lines, y, size = 9.5, lead = 14) {
    lines.forEach((ln, i) => text(ln, 56, y + i * lead, size));
    return y + lines.length * lead;
  }

  // 1. Portada
  newPage("");
  text("ESTADOS FINANCIEROS", 56, 220, 22, bold);
  text(`Vigencia fiscal ${e.vigencia}`, 56, 252, 14, regular);
  const ent = text(e.entidad, 56, 300, 16, bold);
  record("entidad", e.entidad, e.entidad, ent);
  const dep = text(`Departamento de ${e.departamento}`, 56, 324, 11);
  record("departamento", e.departamento, `Departamento de ${e.departamento}`, dep);
  const nitBox = text(`NIT ${nit}`, 56, 344, 11);
  record("nit", nit, `NIT ${nit}`, nitBox);
  const cat = text(`Categoría ${e.categoria} (Ley 617 de 2000)`, 56, 364, 11);
  record("categoria", e.categoria, `Categoría ${e.categoria}`, cat);
  text("Documento sintético generado para pruebas de interfaz. No corresponde a ninguna entidad real.", 56, 700, 8, oblique, GREY);

  // 2. Contenido
  newPage("Contenido");
  [
    "Certificación de los estados financieros",
    "Dictamen sobre los estados financieros",
    "Estado de situación financiera",
    "Estado de resultados",
    "Estado de cambios en el patrimonio",
    "Notas a los estados financieros",
    "Ejecución presupuestal de ingresos y gastos",
    "Deuda pública e indicadores de ley",
  ].forEach((t, i) => text(`${i + 1}.  ${t}`, 56, 120 + i * 20, 10.5));

  // 3. Certificación
  newPage("Certificación de los estados financieros");
  let y = paragraph(
    [
      `Los suscritos representante legal y contador público del ${e.entidad} certificamos`,
      `que los estados financieros con corte a ${e.corte} han sido tomados fielmente`,
      "de los libros de contabilidad y preparados conforme al Marco Normativo para",
      "Entidades de Gobierno expedido por la Contaduría General de la Nación.",
    ],
    120,
  );
  const corteBox = text(`Fecha de corte: ${e.corte}`, 56, y + 16, 10);
  record("fecha_corte", e.corte, `Fecha de corte: ${e.corte}`, corteBox);
  const vigBox = text(`Vigencia: ${e.vigencia}`, 56, y + 34, 10);
  record("vigencia", String(e.vigencia), `Vigencia: ${e.vigencia}`, vigBox);
  const firmaBox = text(`Se firma en la fecha: ${e.firma}`, 56, y + 52, 10);
  record("fecha_firma", e.firma, `Se firma en la fecha: ${e.firma}`, firmaBox);
  const rep = text(e.representante, 56, 470, 10, bold);
  text("Alcalde municipal · Representante legal", 56, 486, 9, regular, GREY);
  record("representante_legal", e.representante, e.representante, rep);
  const cont = text(e.contador, 330, 470, 10, bold);
  const tpBox = text(`Contador público · T.P. ${e.tp}`, 330, 486, 9, regular, GREY);
  record("contador", `${e.contador} · T.P. ${e.tp}`, `${e.contador} Contador público · T.P. ${e.tp}`, union(cont, tpBox));

  // 4. Dictamen
  newPage("Dictamen sobre los estados financieros");
  y = paragraph(
    [
      "Hemos auditado los estados financieros adjuntos, que comprenden el estado de",
      "situación financiera, el estado de resultados y el estado de cambios en el",
      "patrimonio, junto con las notas explicativas correspondientes.",
    ],
    120,
  );
  const op = text(`Opinión: ${e.opinion}.`, 56, y + 18, 10.5, bold);
  record("opinion", e.opinion, `Opinión: ${e.opinion}.`, op);
  paragraph(
    [
      "La opinión se emite con base en la evidencia obtenida y en las normas de",
      "auditoría aplicables al sector público.",
    ],
    y + 44,
  );

  // 5. Políticas (relleno)
  newPage("Bases de preparación y políticas contables");
  paragraph(
    [
      "Los estados financieros se presentan en pesos colombianos, moneda funcional",
      "de la entidad, y se preparan sobre la base de acumulación o devengo.",
      "Los bienes de uso público se miden al costo menos depreciación acumulada.",
    ],
    120,
  );

  // 6. Estado de situación financiera: activos
  newPage("Estado de situación financiera · Activo");
  text(`A ${e.corte} · Cifras en pesos colombianos`, 56, 100, 9, oblique, GREY);
  right("Nota", 410, 128, 8.5, bold);
  right(String(e.vigencia), 556, 128, 8.5, bold);
  text("ACTIVO CORRIENTE", 56, 150, 9.5, bold);
  row("efectivo", "Efectivo y equivalentes al efectivo", b.efectivo, 170, { indent: true });
  row("cxc_impuestos", "Cuentas por cobrar · impuestos", b.cxcImpuestos, 188, { indent: true });
  row(null, "Otros activos corrientes", b.activoCorriente - b.efectivo - b.cxcImpuestos, 206, { indent: true });
  row("activo_corriente", "Total activo corriente", b.activoCorriente, 228, { bold: true, rule: true });
  text("ACTIVO NO CORRIENTE", 56, 262, 9.5, bold);
  row("ppe", "Propiedades, planta y equipo", b.ppe, 282, { indent: true });
  row(null, "Bienes de uso público e históricos", b.activoNoCorriente - b.ppe, 300, { indent: true });
  row("activo_no_corriente", "Total activo no corriente", b.activoNoCorriente, 322, { bold: true, rule: true });
  row("activo_total", "TOTAL ACTIVO", activoTotal, 356, { bold: true, rule: true, double: true });

  // 7. Estado de situación financiera: pasivo y patrimonio
  newPage("Estado de situación financiera · Pasivo y patrimonio");
  text(`A ${e.corte} · Cifras en pesos colombianos`, 56, 100, 9, oblique, GREY);
  text("PASIVO", 56, 150, 9.5, bold);
  row("pasivo_corriente", "Total pasivo corriente", b.pasivoCorriente, 170, { indent: true });
  row("pasivo_no_corriente", "Total pasivo no corriente", b.pasivoNoCorriente, 188, { indent: true });
  row("pasivo_total", "TOTAL PASIVO", pasivoTotal, 210, { bold: true, rule: true });
  text("PATRIMONIO", 56, 246, 9.5, bold);
  row(null, "Capital fiscal", Math.round(b.patrimonio * 0.82), 266, { indent: true });
  row(null, "Resultados de ejercicios anteriores", b.patrimonio - Math.round(b.patrimonio * 0.82) - resultado, 284, { indent: true });
  row(null, "Resultado del ejercicio", resultado, 302, { indent: true });
  row("patrimonio", "TOTAL PATRIMONIO", b.patrimonio, 324, { bold: true, rule: true });
  row(null, "TOTAL PASIVO Y PATRIMONIO", pasivoTotal + b.patrimonio, 358, { bold: true, rule: true, double: true });

  // 8. Estado de resultados
  newPage("Estado de resultados");
  text(`Del 1 de enero al ${e.corte} · Cifras en pesos colombianos`, 56, 100, 9, oblique, GREY);
  row("ingresos_fiscales", "Ingresos fiscales", r.ingresosFiscales, 150);
  row("transferencias", "Transferencias y subvenciones", r.transferencias, 168);
  row("gastos_admin", "Gastos de administración y operación", r.gastosAdmin, 194);
  row("gasto_social", "Gasto público social", r.gastoSocial, 212);
  row("resultado", "RESULTADO DEL EJERCICIO", resultado, 246, { bold: true, rule: true, double: true });

  // 9. Cambios en el patrimonio (relleno)
  newPage("Estado de cambios en el patrimonio");
  row(null, "Saldo inicial del patrimonio", b.patrimonio - resultado, 150);
  row(null, "Resultado del ejercicio", resultado, 168);
  row(null, "Saldo final del patrimonio", b.patrimonio, 196, { bold: true, rule: true, double: true });

  // 10-11. Notas
  newPage("Notas a los estados financieros");
  paragraph(
    [
      "Nota 5. Efectivo y equivalentes: comprende caja, cuentas corrientes y de ahorro",
      "en entidades financieras vigiladas, sin restricciones de uso.",
      "Nota 7. Cuentas por cobrar: incluye impuesto predial unificado e industria y",
      "comercio pendientes de recaudo, netas del deterioro reconocido.",
    ],
    120,
  );
  newPage("Notas a los estados financieros (continuación)");
  paragraph(
    [
      "Nota 10. Propiedades, planta y equipo: terrenos, edificaciones, maquinaria y",
      "equipo de transporte destinados a la prestación de servicios.",
    ],
    120,
  );

  // 12. Ejecución presupuestal de ingresos
  newPage("Ejecución presupuestal de ingresos");
  text(`Vigencia ${e.vigencia} · Cifras en pesos colombianos`, 56, 100, 9, oblique, GREY);
  row("ppto_ingresos", "Presupuesto definitivo de ingresos", p.ingresosDefinitivo, 150);
  row("recaudo", "Recaudo total", p.recaudo, 168);
  row(null, "Por recaudar", p.ingresosDefinitivo - p.recaudo, 186);

  // 13. Ejecución presupuestal de gastos
  newPage("Ejecución presupuestal de gastos");
  text(`Vigencia ${e.vigencia} · Cifras en pesos colombianos`, 56, 100, 9, oblique, GREY);
  row("ppto_gastos", "Presupuesto definitivo de gastos", p.gastosDefinitivo, 150);
  row("compromisos", "Compromisos", p.compromisos, 168);
  row("obligaciones", "Obligaciones", p.obligaciones, 186);
  row("pagos", "Pagos", p.pagos, 204);
  row("superavit", "Superávit (déficit) presupuestal", superavit, 230, { bold: true, rule: true });

  // 14. Deuda pública
  newPage("Deuda pública");
  if (e.deuda > 0) {
    row("deuda", "Saldo de la deuda pública a 31 de diciembre", e.deuda, 150);
  } else {
    paragraph(["La entidad no registra operaciones de crédito público vigentes."], 150);
  }

  // 15. Indicadores
  newPage("Indicadores de ley");
  const l617 = text(`Indicador de gastos de funcionamiento (Ley 617 de 2000): ${e.ley617}`, 56, 150, 10);
  record("ley617", e.ley617, `Indicador de gastos de funcionamiento (Ley 617 de 2000): ${e.ley617}`, l617);
  const chip = text(`Reporte CHIP a la Contaduría General de la Nación: ${e.chip}`, 56, 172, 10);
  record("chip", e.chip, `Reporte CHIP a la Contaduría General de la Nación: ${e.chip}`, chip);

  // 16-18. Anexos
  for (const t of ["Anexo 1 · Relación de bienes inmuebles", "Anexo 2 · Relación de cuentas bancarias", "Anexo 3 · Actas"]) {
    newPage(t);
    paragraph(["Relación detallada disponible en el archivo de la entidad."], 120);
  }

  const bytes = await doc.save();
  await writeFile(path.join(PDF_DIR, `${e.slug}.pdf`), bytes);

  const out = {
    slug: e.slug,
    synthetic: true,
    entidad: e.entidad,
    departamento: e.departamento,
    nit,
    vigencia: e.vigencia,
    pageSize: { w: W, h: H },
    pageCount: pageNo,
    pages,
    fields,
  };
  await writeFile(path.join(JSON_DIR, `${e.slug}.json`), JSON.stringify(out, null, 2) + "\n");
  return out;
}

await mkdir(PDF_DIR, { recursive: true });
await mkdir(JSON_DIR, { recursive: true });
for (const e of ENTITIES) {
  const o = await build(e);
  console.log(`${o.slug}: ${o.pageCount} folios, ${Object.keys(o.fields).length} campos`);
}
