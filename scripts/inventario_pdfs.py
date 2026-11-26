"""Inventario de los PDFs fuente: solo lectura, no modifica ningún archivo.

Recorre datos/fuente/**.pdf y escribe en datos/inventario/:
  - pdfs.csv     una fila por PDF (carpeta, nombre, hash, páginas, mezcla de tipos de página)
  - paginas.csv  una fila por página (tipo, caracteres, cobertura de imagen)

Tipo de página (heurística de la FAQ de PyMuPDF 1.28 + cobertura de imagen):
  - digital     tiene texto extraíble y legible, y no es una imagen a página completa
  - texto_corrupto  tiene texto pero ilegible (codificación rota): tratar como escaneada
  - capa_ocr    tiene texto, pero encima de una imagen que cubre la página: es un escaneo
                al que alguien ya le pasó OCR; la calidad de ese texto es desconocida
  - escaneada   sin texto (o casi): necesita OCR
  - vacia       sin texto ni imágenes

Uso:  python scripts/inventario_pdfs.py [--fuente datos/fuente] [--salida datos/inventario]
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import re
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import pymupdf

MIN_CHARS = 50          # menos que esto en una página = sin texto útil
MIN_RATIO_NORMAL = 0.90  # menos que esto = capa de texto corrupta
CARACTERES_NORMALES = frozenset(
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    "áéíóúüñÁÉÍÓÚÜÑ.,;:()[]{}%$#°º/\\-–—_'\"“”‘’¿?¡!*+=<>&@|§·•"
)
PALABRAS_COMUNES = re.compile(
    r"\b(DE|EL|LA|LOS|LAS|DEL|EN|QUE|MUNICIPIO|MUNICIPAL|ACUERDO|CONCEJO|LEY|ARTICULO|ARTÍCULO|IMPUESTO|TARIFA)\b",
    re.IGNORECASE,
)
COBERTURA_IMAGEN = 0.85  # fracción del área de la página cubierta por una sola imagen

# Nombre estandarizado del proyecto anterior: DANE_Tipo_Numero_Anio_Municipio[_Sufijo].pdf
PATRON_NOMBRE = re.compile(
    r"^(?P<dane>\d{5})_(?P<tipo>[A-Za-z]+)_(?P<numero>[^_]+)_(?P<anio>\d{4}|SINANIO)_(?P<resto>.+)\.pdf$",
    re.IGNORECASE,
)


def categoria(rel: Path) -> str:
    """Clasifica la ubicación del PDF dentro del zip original."""
    s = rel.as_posix().lower()
    if "/respaldo" in s:
        return "respaldo"
    if "/duplicados/" in s:
        return "duplicado"
    if "acuerdos sobrantes" in s:
        return "udes_sobrante"
    if "/municipios udes/" in s:
        return "udes"
    if "acuerdos añadidos" in s:
        return "anadido"
    if "/acuerdos municipales/" in s:
        return "corpus_general"
    return "otro"


def calidad_texto(t: str) -> tuple[float, int]:
    """Proporción de caracteres "normales" en español y número de palabras comunes.

    Basado en detectar_texto_basura.py del proyecto anterior (31 capas corruptas), con dos
    ajustes: cifras y puntuación cuentan como normales (las páginas de tarifas son casi
    todo números y %), y str.isalpha() no sirve porque acepta letras CJK como «呸».
    """
    if not t:
        return 0.0, 0
    ratio = sum(1 for c in t if c in CARACTERES_NORMALES or c.isspace()) / len(t)
    return ratio, len(PALABRAS_COMUNES.findall(t))


def tipo_pagina(page: pymupdf.Page) -> tuple[str, int, float, float, int]:
    texto = page.get_text().strip()
    chars = len(texto)
    ratio, comunes = calidad_texto(texto)
    area = abs(page.rect) or 1.0
    cobertura = 0.0
    for info in page.get_image_info():
        r = pymupdf.Rect(info["bbox"]) & page.rect
        cobertura = max(cobertura, abs(r) / area)
    if chars >= MIN_CHARS:
        if ratio < MIN_RATIO_NORMAL or (chars >= 200 and comunes < 2):
            return "texto_corrupto", chars, cobertura, ratio, comunes
        return ("capa_ocr" if cobertura >= COBERTURA_IMAGEN else "digital"), chars, cobertura, ratio, comunes
    if cobertura > 0:
        return "escaneada", chars, cobertura, ratio, comunes
    return "vacia", chars, cobertura, ratio, comunes


def analizar(path_str: str, raiz_str: str) -> tuple[dict, list[dict]]:
    path, raiz = Path(path_str), Path(raiz_str)
    rel = path.relative_to(raiz)
    data = path.read_bytes()
    fila = {
        "ruta": rel.as_posix(),
        "categoria": categoria(rel),
        "archivo": path.name,
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "dane": "", "tipo_doc": "", "numero": "", "anio": "", "municipio": "",
        "nombre_estandar": False,
        "paginas": 0, "digital": 0, "capa_ocr": 0, "texto_corrupto": 0, "escaneada": 0, "vacia": 0,
        "titulo_meta": "", "error": "",
    }
    m = PATRON_NOMBRE.match(path.name)
    if m:
        fila.update(dane=m["dane"], tipo_doc=m["tipo"], numero=m["numero"], anio=m["anio"],
                    municipio=m["resto"], nombre_estandar=True)
    paginas: list[dict] = []
    try:
        with pymupdf.open(stream=data, filetype="pdf") as doc:
            fila["paginas"] = doc.page_count
            fila["titulo_meta"] = (doc.metadata or {}).get("title", "") or ""
            for page in doc:
                t, chars, cob, ratio, comunes = tipo_pagina(page)
                fila[t] += 1
                paginas.append({"sha256": fila["sha256"], "pagina": page.number + 1, "tipo": t,
                                "chars": chars, "cobertura_imagen": round(cob, 3),
                                "ratio_letras": round(ratio, 3), "palabras_comunes": comunes})
    except Exception as e:  # PDF dañado o cifrado: se registra, no se detiene el inventario
        fila["error"] = f"{type(e).__name__}: {e}"
    return fila, paginas


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fuente", default="datos/fuente")
    ap.add_argument("--salida", default="datos/inventario")
    args = ap.parse_args()
    raiz, salida = Path(args.fuente), Path(args.salida)
    salida.mkdir(parents=True, exist_ok=True)
    pdfs = sorted(p for p in raiz.rglob("*") if p.suffix.lower() == ".pdf")
    print(f"{len(pdfs)} PDFs en {raiz}", flush=True)

    filas: list[dict] = []
    paginas: list[dict] = []
    with ProcessPoolExecutor() as ex:
        futs = [ex.submit(analizar, str(p), str(raiz)) for p in pdfs]
        for i, f in enumerate(as_completed(futs), 1):
            fila, pags = f.result()
            filas.append(fila)
            paginas.extend(pags)
            if i % 50 == 0:
                print(f"  {i}/{len(pdfs)}", flush=True)

    filas.sort(key=lambda r: r["ruta"])
    with open(salida / "pdfs.csv", "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=list(filas[0]))
        w.writeheader()
        w.writerows(filas)
    with open(salida / "paginas.csv", "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=["sha256", "pagina", "tipo", "chars", "cobertura_imagen",
                                           "ratio_letras", "palabras_comunes"])
        w.writeheader()
        w.writerows(sorted(paginas, key=lambda r: (r["sha256"], r["pagina"])))
    print(f"listo: {len(filas)} PDFs, {len(paginas)} páginas -> {salida}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
