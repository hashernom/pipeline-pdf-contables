"""Catálogo borrador de variables: bloques y campos de la matriz con su tipo inferido."""

import json
from collections import defaultdict
from collections.abc import Sequence
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel

from motor import config, llm, localizar, muestras
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
    presencia_key: str | None = None
    criterio_presencia: str = "pendiente"
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
                if col.rol == "presencia":
                    b.presencia_key = col.campo_key
                continue
            tipo = inferir_tipo(valores.get(col.campo_key, []))
            b.campos.append(
                Campo(
                    key=col.campo_key,
                    nombre=col.campo,
                    columna=col.letra,
                    tipo=tipo,
                    unidad="por_mil" if tipo == "numero" and hoja == HOJA_TARIFAS else None,
                    valores_permitidos=sorted(SI_NO, key=["si", "no", "no_aplica"].index)
                    if tipo == "si_no"
                    else None,
                )
            )
    return Catalogo(
        version="borrador-1", fuente=config.MATRIZ.name, bloques=list(bloques.values())
    )


def _vacio(v) -> bool:
    return v is None or v == [] or v == "pendiente"


def fusionar(nuevo: Catalogo, previo: Catalogo) -> Catalogo:
    """Conserva del previo lo editado a mano (por `key`); lo demás sale del nuevo."""
    pb = {b.key: b for b in previo.bloques}
    pc = {c.key: c for b in previo.bloques for c in b.campos}
    res = nuevo.model_copy(deep=True)
    for b in res.bloques:
        p = pb.get(b.key)
        if p:
            if not _vacio(p.palabras_clave):
                b.palabras_clave = list(p.palabras_clave)
            if not _vacio(p.criterio_presencia):
                b.criterio_presencia = p.criterio_presencia
        for c in b.campos:
            q = pc.get(c.key)
            if not q:
                continue
            for attr in ("criterio", "unidad", "critica", "metodo"):
                if not _vacio(getattr(q, attr)):
                    setattr(c, attr, getattr(q, attr))
    return res


N_EJEMPLOS_CRITERIO = 5


def _prompt_criterio(bloque: Bloque, nombre: str, tipo: str, permitidos, key: str,
                     ejs: list[muestras.Ejemplo]) -> list[dict]:
    lineas = []
    for e in ejs:
        if key in e.valores:
            lineas.append(f"- cita: {e.cita!r} -> valor: {e.valores[key]!r}")
    ejemplos = "\n".join(lineas) or "(sin ejemplos)"
    usuario = (
        f"Bloque: {bloque.nombre}\nCampo: {nombre}\nTipo: {tipo}\n"
        f"Valores permitidos: {permitidos if permitidos else 'libre'}\n"
        f"Ejemplos del set de oro:\n{ejemplos}\n\n"
        'Redacta en español de Colombia, en 1 o 2 frases, el criterio para decidir el valor de '
        'este campo a partir del texto de un acuerdo municipal. Responde en JSON: '
        '{"criterio": "<texto>"}'
    )
    return [
        {"role": "system", "content": "Eres analista de normativa tributaria municipal (ICA). "
                                      "Responde solo con un objeto JSON."},
        {"role": "user", "content": usuario},
    ]


def _criterio(cliente: llm.Cliente, mensajes: list[dict]) -> str | None:
    try:
        d = json.loads(cliente.completar(mensajes, max_tokens=500).texto)
        c = d["criterio"]
    except (ValueError, KeyError, TypeError):
        return None
    return c.strip() if isinstance(c, str) and c.strip() else None


def enriquecer(cat: Catalogo, refs, part, cliente: llm.Cliente) -> Catalogo:
    """Palabras clave por bloque y criterio de cada campo `pendiente` (una llamada por campo)."""
    res = cat.model_copy(deep=True)
    citas = {b.key: muestras.citas_referencia(refs, part, b.key) for b in res.bloques}
    for b in res.bloques:
        if not b.palabras_clave:
            otros = [c for k, v in citas.items() if k != b.key for c in v]
            b.palabras_clave = localizar.palabras_clave(b.nombre, citas[b.key], otros)
        ejs = muestras.ejemplos(refs, part, b.key, n=N_EJEMPLOS_CRITERIO)
        if b.presencia_key and b.criterio_presencia == "pendiente":
            c = _criterio(cliente, _prompt_criterio(
                b, f"Presencia de {b.nombre}", "si_no", ["si", "no", "no_aplica"],
                b.presencia_key, ejs))
            if c:
                b.criterio_presencia = c
        for campo in b.campos:
            if campo.criterio != "pendiente":
                continue
            c = _criterio(cliente, _prompt_criterio(
                b, campo.nombre, campo.tipo, campo.valores_permitidos, campo.key, ejs))
            if c:
                campo.criterio = c
    return res


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
