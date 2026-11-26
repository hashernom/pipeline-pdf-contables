"""Lectura de la matriz: estructura de hojas, bloques y campos."""

from dataclasses import dataclass
from typing import Literal

from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

from motor.normalizar import es_vacio, slug

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
