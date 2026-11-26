"""Corpus plano: copia los PDF de las categorías útiles a una sola carpeta.

Solo lee la fuente; el destino es `datos/corpus/` (o el que se indique).
"""

from __future__ import annotations

import csv
import shutil
from functools import lru_cache
from pathlib import Path
from typing import Literal

import pymupdf

from motor import config

CATEGORIAS = ("udes", "udes_sobrante", "corpus_general", "anadido")
COLUMNAS = [
    "sha256", "archivo_corpus", "archivo_estandar", "categoria", "dane", "tipo_doc", "numero",
    "anio", "es_modificacion", "paginas", "digital", "capa_ocr", "texto_corrupto", "escaneada",
    "vacia", "ruta_fuente",
]


def _leer(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


def construir(inventario_csv: Path, destino: Path) -> Path:
    """Copia los PDF de CATEGORIAS a destino/<sha256[:12]>_<archivo> y escribe corpus.csv."""
    inventario_csv, destino = Path(inventario_csv), Path(destino)
    fuente = _raiz_fuente(inventario_csv)
    destino.mkdir(parents=True, exist_ok=True)
    filas, vistos = [], set()
    for r in _leer(inventario_csv):
        if r["categoria"] not in CATEGORIAS or r["sha256"] in vistos:
            continue
        vistos.add(r["sha256"])
        nombre = f"{r['sha256'][:12]}_{r['archivo']}"
        shutil.copyfile(fuente / r["ruta"], destino / nombre)
        estandar = r["nombre_estandar"] == "True"
        filas.append({
            "sha256": r["sha256"],
            "archivo_corpus": nombre,
            "archivo_estandar": r["archivo"] if estandar else "",
            "categoria": r["categoria"],
            "dane": r["dane"], "tipo_doc": r["tipo_doc"], "numero": r["numero"], "anio": r["anio"],
            "es_modificacion": estandar and r["archivo"].endswith("_Modificacion.pdf"),
            "paginas": r["paginas"], "digital": r["digital"], "capa_ocr": r["capa_ocr"],
            "texto_corrupto": r["texto_corrupto"], "escaneada": r["escaneada"], "vacia": r["vacia"],
            "ruta_fuente": r["ruta"],
        })
    salida = destino / "corpus.csv"
    with open(salida, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNAS)
        w.writeheader()
        w.writerows(filas)
    print(f"corpus: {len(filas)} PDFs -> {destino}")
    return salida


def _raiz_fuente(inventario_csv: Path) -> Path:
    """La fuente de la que salió el inventario (se guarda junto a pdfs.csv)."""
    marca = inventario_csv.parent / "fuente.txt"
    if marca.exists():
        return Path(marca.read_text(encoding="utf-8").strip())
    return config.FUENTE


@lru_cache(maxsize=None)
def _corpus_csv(path: Path) -> dict[str, dict]:
    return {r["sha256"]: r for r in _leer(path)}


@lru_cache(maxsize=None)
def _paginas_csv(path: Path) -> dict[str, dict[int, str]]:
    por_pdf: dict[str, dict[int, str]] = {}
    for r in _leer(path):
        por_pdf.setdefault(r["sha256"], {})[int(r["pagina"])] = r["tipo"]
    return por_pdf


def limpiar_cache() -> None:
    _corpus_csv.cache_clear()
    _paginas_csv.cache_clear()


def _tipos(sha256: str) -> dict[int, str]:
    return _paginas_csv(config.INVENTARIO / "paginas.csv").get(sha256, {})


def fuente_texto(sha256: str, pagina: int) -> Literal["digital", "capa_ocr", "ninguna"]:
    tipo = _tipos(sha256).get(pagina)
    return tipo if tipo in ("digital", "capa_ocr") else "ninguna"


def paginas_con_texto(sha256: str) -> dict[int, str | None]:
    """Texto crudo por página (1-based); None si la página no es digital ni capa_ocr."""
    fila = _corpus_csv(config.CORPUS / "corpus.csv")[sha256]
    tipos = _tipos(sha256)
    salida: dict[int, str | None] = {}
    with pymupdf.open(config.CORPUS / fila["archivo_corpus"]) as doc:
        for n in sorted(tipos):
            salida[n] = doc[n - 1].get_text() if tipos[n] in ("digital", "capa_ocr") else None
    return salida
