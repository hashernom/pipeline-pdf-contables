"""Catálogo borrador de variables: bloques y campos de la matriz con su tipo inferido."""

from collections import defaultdict
from collections.abc import Sequence
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel

from motor import config
from motor.matriz import celdas, estructura

SI_NO = {"si", "no", "no_aplica"}
UMBRAL_TIPO = 0.8
HOJA_TARIFAS = "Tarifas"
ROLES_BLOQUE = ("art", "pag", "cita", "presencia")


class Campo(BaseModel):
    key: str
    nombre: str
    columna: str
    tipo: Literal["si_no", "numero", "texto_libre"]
    unidad: str | None = None
    valores_permitidos: list[str] | None = None
    criterio: str = "pendiente"
    critica: bool | None = None
    metodo: Literal["regla", "llm"] | None = None
    estado: Literal["borrador", "aprobada"] = "borrador"


class Bloque(BaseModel):
    key: str
    nombre: str
    hoja: str
    columnas: dict[Literal["art", "pag", "cita", "presencia"], str]
    palabras_clave: list[str] = []
    campos: list[Campo]


class Catalogo(BaseModel):
    version: str
    fuente: str
    bloques: list[Bloque]


def _es_numero(v: str) -> bool:
    try:
        float(v)
    except ValueError:
        return False
    return True


def inferir_tipo(valores: Sequence[str]) -> Literal["si_no", "numero", "texto_libre"]:
    """Tipo según los valores canónicos no vacíos de un campo."""
    if not valores:
        return "texto_libre"
    n_sino = sum(v in SI_NO for v in valores)
    if n_sino / len(valores) >= UMBRAL_TIPO and any(v in ("si", "no") for v in valores):
        return "si_no"
    resto = [v for v in valores if v != "no_aplica"]
    if resto:
        n_num = sum(_es_numero(v) for v in resto)
        if n_num and n_num / len(resto) >= UMBRAL_TIPO:
            return "numero"
    return "texto_libre"


def generar(wb, hojas: Sequence[str]) -> Catalogo:
    valores: dict[str, list[str]] = defaultdict(list)
    for c in celdas(wb, hojas):
        if c.rol == "campo" and c.valor:
            valores[c.campo_key].append(c.valor)

    bloques: dict[str, Bloque] = {}
    for hoja in hojas:
        _, cols = estructura(wb[hoja])
        for col in cols:
            if col.bloque_key not in bloques:
                bloques[col.bloque_key] = Bloque(
                    key=col.bloque_key, nombre=col.bloque, hoja=hoja, columnas={}, campos=[]
                )
            b = bloques[col.bloque_key]
            if col.rol in ROLES_BLOQUE:
                b.columnas[col.rol] = col.letra
                continue
            tipo = inferir_tipo(valores.get(col.campo_key, []))
            b.campos.append(
                Campo(
                    key=col.campo_key,
                    nombre=col.campo,
                    columna=col.letra,
                    tipo=tipo,
                    unidad="pendiente" if tipo == "numero" and hoja == HOJA_TARIFAS else None,
                    valores_permitidos=sorted(SI_NO, key=["si", "no", "no_aplica"].index)
                    if tipo == "si_no"
                    else None,
                )
            )
    return Catalogo(
        version="borrador-1", fuente=config.MATRIZ.name, bloques=list(bloques.values())
    )


def guardar_yaml(cat: Catalogo, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    texto = yaml.safe_dump(
        cat.model_dump(mode="json"), allow_unicode=True, sort_keys=False, width=1000
    )
    path.write_text(texto, encoding="utf-8", newline="\n")
    return path


def cargar_yaml(path: Path) -> Catalogo:
    return Catalogo.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))


COLUMNAS_EXCEL = [
    "hoja", "bloque", "campo", "key", "tipo", "unidad", "criterio", "critica",
    "revision_equipo", "comentario",
]


def exportar_excel(cat: Catalogo, path: Path) -> Path:
    import openpyxl

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "catalogo"
    ws.append(COLUMNAS_EXCEL)
    for b in cat.bloques:
        for c in b.campos:
            ws.append([
                b.hoja, b.nombre, c.nombre, c.key, c.tipo, c.unidad, c.criterio,
                "pendiente" if c.critica is None else c.critica, None, None,
            ])
    ws.freeze_panes = "A2"
    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)
    return path
