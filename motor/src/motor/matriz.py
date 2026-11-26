"""Lectura de la matriz: estructura de hojas, bloques y campos."""

import csv
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

from motor import config
from motor.normalizar import es_vacio, slug, valor_canonico

Rol = Literal["art", "pag", "cita", "presencia", "campo"]

PRIMERA_COL_DATOS = 7  # G


@dataclass
class Columna:
    col: int
    letra: str
    hoja: str
    bloque: str
    bloque_key: str
    campo: str
    campo_key: str
    rol: Rol


def _fila_encabezado(ws: Worksheet) -> int:
    for r in range(1, 21):
        v = ws.cell(r, 2).value
        if isinstance(v, str) and v.strip().lower().startswith("código dane"):
            return r
    raise ValueError(f"no se encontró la fila de encabezado en {ws.title!r}")


def _resolver(ws: Worksheet, fila: int, col: int, rangos: list) -> object:
    """Valor de la celda, resuelto a través de celdas combinadas."""
    for rg in rangos:
        if rg.min_row <= fila <= rg.max_row and rg.min_col <= col <= rg.max_col:
            return ws.cell(rg.min_row, rg.min_col).value
    return ws.cell(fila, col).value


def _combinada(rangos: list, fila: int, col: int) -> bool:
    return any(
        rg.min_row <= fila <= rg.max_row and rg.min_col <= col <= rg.max_col
        for rg in rangos
    )


def _texto(v: object) -> str:
    return str(v).strip() if not es_vacio(v) else ""


def _rol(texto: str) -> Rol:
    s = slug(texto)
    if s == "art":
        return "art"
    if s == "pag":
        return "pag"
    if s == "definicion":
        return "cita"
    if s.startswith("presencia"):
        return "presencia"
    return "campo"


def _unica(clave: str, usadas: set[str]) -> str:
    final, n = clave, 1
    while final in usadas:
        n += 1
        final = f"{clave}_{n}"
    usadas.add(final)
    return final


def estructura(ws: Worksheet) -> tuple[int, list[Columna]]:
    """Fila de encabezado y columnas de datos (desde la G) agrupadas en bloques."""
    fila = _fila_encabezado(ws)
    rangos = list(ws.merged_cells.ranges)
    hoja_key = slug(ws.title)
    cols: list[Columna] = []
    bloque = bloque_key = None
    claves_bloque: set[str] = set()
    claves_campo: set[str] = set()

    for c in range(PRIMERA_COL_DATOS, ws.max_column + 1):
        enc = _texto(_resolver(ws, fila, c, rangos))
        if enc and _rol(enc) == "art":
            bloque = _texto(_resolver(ws, fila - 1, c, rangos))
            bloque_key = _unica(f"{hoja_key}.{slug(bloque)}", claves_bloque)
        elif not enc and not _combinada(rangos, fila, c):
            bloque = bloque_key = None
            continue
        if bloque is None:
            continue
        campo = enc
        crudo = _texto(ws.cell(fila - 1, c).value)
        if crudo and _rol(enc) != "art":
            campo = f"{enc} · {crudo}"
        cols.append(
            Columna(
                col=c,
                letra=get_column_letter(c),
                hoja=ws.title,
                bloque=bloque,
                bloque_key=bloque_key,
                campo=campo,
                campo_key=_unica(f"{bloque_key}.{slug(campo)}", claves_campo),
                rol=_rol(enc),
            )
        )
    return fila, cols


@dataclass
class Identidad:
    fila: int
    consecutivo: int | None  # None si Principios trae un valor no numérico (p. ej. fila 84)
    dane_original: str
    departamento: str
    municipio: str
    acuerdo: str
    anio: str


@dataclass
class Celda:
    fila: int
    hoja: str
    bloque_key: str
    campo_key: str
    rol: str
    valor_original: str | None
    valor: str | None
    correccion: str | None


def _entero_positivo(v: object) -> int | None:
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return int(v) if float(v).is_integer() and v > 0 else None
    if isinstance(v, str) and v.strip().isdigit():
        n = int(v.strip())
        return n if n > 0 else None
    return None


def _crudo(v: object) -> str | None:
    """Texto original de la celda, sin espacios en los bordes; None si está vacía."""
    if es_vacio(v):
        return None
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def identidades(wb) -> list[Identidad]:
    """Filas reales de `Principios`: las que tienen un DANE entero mayor que 0."""
    ws = wb[config.HOJA_IDENTIDAD]
    out: list[Identidad] = []
    for r in range(_fila_encabezado(ws) + 1, ws.max_row + 1):
        dane = _entero_positivo(ws.cell(r, 2).value)
        cons = _entero_positivo(ws.cell(r, 1).value)
        if dane is None:
            continue
        out.append(
            Identidad(
                fila=r,
                consecutivo=cons,
                dane_original=str(dane),
                departamento=_texto(ws.cell(r, 3).value),
                municipio=_texto(ws.cell(r, 4).value),
                acuerdo=_texto(ws.cell(r, 5).value),
                anio=_crudo(ws.cell(r, 6).value) or "",
            )
        )
    return out


def _copia_limpieza(wb, hoja: str) -> str | None:
    """Nombre de la hoja `_Limpieza` de `hoja`, buscada por prefijo de nombre."""
    pref = hoja[:12].lower()
    for n in wb.sheetnames:
        if n != hoja and n.lower().startswith(pref) and "impi" in n.lower():
            return n
    return None


def correcciones_limpieza(wb, hojas: Sequence[str]) -> dict[tuple[str, int, int], str]:
    """(hoja, fila, col) -> valor limpio, para las celdas que difieren de la copia `_Limpieza`."""
    out: dict[tuple[str, int, int], str] = {}
    for hoja in hojas:
        nombre = _copia_limpieza(wb, hoja)
        if nombre is None:
            continue
        ws, cp = wb[hoja], wb[nombre]
        for r in range(1, max(ws.max_row, cp.max_row) + 1):
            for c in range(PRIMERA_COL_DATOS, max(ws.max_column, cp.max_column) + 1):
                a, b = ws.cell(r, c).value, cp.cell(r, c).value
                if valor_canonico(a) != valor_canonico(b):
                    out[(hoja, r, c)] = _crudo(b) or ""
    return out


def celdas(wb, hojas: Sequence[str]) -> list[Celda]:
    """Celdas de datos de las filas reales, con las correcciones de limpieza aplicadas."""
    cons = {i.fila: i.consecutivo for i in identidades(wb)}
    fixes = correcciones_limpieza(wb, hojas)
    out: list[Celda] = []
    for hoja in hojas:
        ws = wb[hoja]
        _, cols = estructura(ws)
        for fila, esperado in cons.items():
            if esperado is not None and _entero_positivo(ws.cell(fila, 1).value) != esperado:
                raise ValueError(
                    f"consecutivo distinto en {hoja!r} fila {fila}: "
                    f"{ws.cell(fila, 1).value!r} != {esperado}"
                )
            for col in cols:
                original = _crudo(ws.cell(fila, col.col).value)
                limpio = fixes.get((hoja, fila, col.col))
                if limpio is None:
                    valor, corr = valor_canonico(original), None
                else:
                    valor, corr = valor_canonico(limpio), "limpieza_equipo"
                out.append(
                    Celda(fila, hoja, col.bloque_key, col.campo_key, col.rol,
                          original, valor, corr)
                )
    return out


CAMPOS_LARGA = [
    "fila", "dane_original", "municipio", "acuerdo", "anio", "hoja",
    "bloque_key", "campo_key", "rol", "valor_original", "valor", "correccion",
]


def escribir_larga(destino: Path) -> Path:
    """Escribe `matriz_larga.csv` en `destino`, sin celdas vacías."""
    import openpyxl

    wb = openpyxl.load_workbook(config.MATRIZ, data_only=True)
    ident = {i.fila: i for i in identidades(wb)}
    destino.mkdir(parents=True, exist_ok=True)
    ruta = destino / "matriz_larga.csv"
    with ruta.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CAMPOS_LARGA)
        w.writeheader()
        for c in celdas(wb, config.HOJAS_ALCANCE):
            if c.valor is None and c.valor_original is None:
                continue
            i = ident[c.fila]
            w.writerow({
                "fila": c.fila, "dane_original": i.dane_original,
                "municipio": i.municipio, "acuerdo": i.acuerdo, "anio": i.anio,
                "hoja": c.hoja, "bloque_key": c.bloque_key, "campo_key": c.campo_key,
                "rol": c.rol, "valor_original": c.valor_original or "",
                "valor": c.valor or "", "correccion": c.correccion or "",
            })
    return ruta
