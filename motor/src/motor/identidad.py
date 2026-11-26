"""Identidad de cada fila de la matriz: DANE corregido y PDF emparejado."""

import csv
import re
import unicodedata
from pathlib import Path

import openpyxl

from motor import config
from motor.matriz import Identidad, identidades
from motor.normalizar import nombre_lugar

Divipola = dict[str, tuple[str, str]]

_CITA = re.compile(
    r"(\d{1,4})\s*(?:de|del|-|/)\s*(?:\d{1,2}\s*(?:de)?\s*[a-z]+\s*(?:de)?\s*)?((?:19|20)\d\d)"
)
_NUMERO = re.compile(r"\b(?:no\.?|n|acuerdo|decreto)\s*(\d{1,4})")


def _nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def cargar_divipola(path: Path) -> Divipola:
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True)["Data"]
    out: Divipola = {}
    for fila in ws.iter_rows(min_row=2, values_only=True):
        cod, dep, mun = fila[2], fila[1], fila[3]
        if cod is None or dep is None or mun is None:
            continue
        out[str(cod).strip().zfill(5)] = (nombre_lugar(str(dep)), nombre_lugar(str(mun)))
    return out


def _contiene(a: str, b: str) -> bool:
    return bool(a) and bool(b) and (a in b or b in a)


def resolver_dane(ident: Identidad, divipola: Divipola) -> tuple[str | None, str]:
    """(código, motivo) con motivo ok, corregido_nombre, corregido_sufijo o sin_resolver."""
    dep = nombre_lugar(ident.departamento)
    mun = nombre_lugar(ident.municipio)
    mun_ns = mun.replace(" ", "")
    cod = ident.dane_original.strip().zfill(5)
    if cod in divipola and _contiene(divipola[cod][1], mun):
        return cod, "ok"
    sufijo = cod[-3:]
    por_sufijo = [
        c for c, (d, _) in divipola.items() if c[-3:] == sufijo and _contiene(d, dep)
    ]
    por_nombre = [
        c
        for c, (d, m) in divipola.items()
        if (m == mun or m.replace(" ", "") == mun_ns) and _contiene(d, dep)
    ]
    # Un código sin prefijo de departamento (menos de 5 dígitos) se explica por el sufijo.
    if len(ident.dane_original.strip()) < 5 and len(por_sufijo) == 1:
        return por_sufijo[0], "corregido_sufijo"
    if len(por_nombre) == 1:
        return por_nombre[0], "corregido_nombre"
    if len(por_sufijo) == 1:
        return por_sufijo[0], "corregido_sufijo"
    return None, "sin_resolver"


def _normalizar(texto: str) -> str:
    t = unicodedata.normalize("NFKD", texto)
    t = t.encode("ascii", "ignore").decode().lower()
    t = re.sub(r"\s+", " ", t)
    return t.replace("departamento de", "").strip()


def acuerdos_citados(texto: str, anio_respaldo: str) -> list[tuple[int, int]]:
    """Pares (número, año) citados en el texto, sin repetir y en orden de aparición."""
    t = _normalizar(texto)
    out: list[tuple[int, int]] = []
    for m in _CITA.finditer(t):
        par = (int(m.group(1)), int(m.group(2)))
        if par not in out:
            out.append(par)
    anio = str(anio_respaldo).strip()
    if anio.isdigit():
        for m in _NUMERO.finditer(t):
            par = (int(m.group(1)), int(anio))
            if par not in out:
                out.append(par)
    return out


def _entero(s: str) -> int | None:
    s = (s or "").strip()
    return int(s) if s.isdigit() else None


def emparejar(
    ident: Identidad, dane: str | None, corpus_filas: list[dict], borradores: set[str]
) -> dict:
    res = {
        "estado": "sin_pdf",
        "sha256": "",
        "candidatos": [],
        "tipo_doc": "",
        "es_modificacion": "",
        "posible_borrador": False,
    }
    propios = [f for f in corpus_filas if dane and f["dane"] == dane]
    if not propios:
        return res
    citados = acuerdos_citados(ident.acuerdo, ident.anio)
    pares = set(citados)
    coinciden = sorted(
        (f for f in propios if (_entero(f["numero"]), _entero(f["anio"])) in pares),
        key=lambda f: f["archivo_estandar"],
    )
    if len(re.findall(r"acuerdo|decreto", _normalizar(ident.acuerdo))) >= 2:
        res["estado"] = "varios_acuerdos"
        res["candidatos"] = [f["archivo_estandar"] for f in coinciden]
        return res
    if not citados:
        res["estado"] = "sin_numero_legible"
        return res
    if not coinciden:
        res["estado"] = "otro_acuerdo"
        res["candidatos"] = sorted(f["archivo_estandar"] for f in propios)
        return res
    elegido = coinciden[0]
    res.update(
        estado="coincide",
        sha256=elegido["sha256"],
        candidatos=[f["archivo_estandar"] for f in coinciden],
        tipo_doc=elegido["tipo_doc"],
        es_modificacion=elegido["es_modificacion"],
        posible_borrador=_nfc(elegido["archivo_estandar"]) in borradores,
    )
    return res


def _cargar_borradores(path: Path) -> set[str]:
    if not path.exists():
        return set()
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True)["Candidatos"]
    filas = list(ws.iter_rows(min_row=3, values_only=True))
    enc = [str(c or "").strip() for c in filas[0]]
    i = enc.index("Nombre actual en la carpeta")
    return {_nfc(str(f[i]).strip()) for f in filas[1:] if f[i]}


COLUMNAS = [
    "fila", "consecutivo", "municipio", "departamento", "dane_original",
    "dane_final", "acuerdo", "anio", "estado", "sha256", "candidatos",
    "tipo_doc", "es_modificacion", "posible_borrador",
]


def escribir_documentos(destino: Path) -> Path:
    """Escribe documentos.csv y correcciones_dane.csv en `destino`."""
    wb = openpyxl.load_workbook(config.MATRIZ, data_only=True)
    divipola = cargar_divipola(config.DIVIPOLA)
    with open(config.CORPUS / "corpus.csv", encoding="utf-8-sig", newline="") as f:
        corpus = list(csv.DictReader(f))
    borradores = _cargar_borradores(config.POSIBLES_BORRADORES)
    destino.mkdir(parents=True, exist_ok=True)
    docs, corr = [], []
    for ident in identidades(wb):
        dane, motivo = resolver_dane(ident, divipola)
        if motivo != "ok":
            corr.append(
                [ident.fila, ident.municipio, ident.dane_original, dane or "", motivo]
            )
        emp = emparejar(ident, dane, corpus, borradores)
        docs.append(
            [
                ident.fila,
                ident.consecutivo if ident.consecutivo is not None else "",
                ident.municipio,
                ident.departamento,
                ident.dane_original,
                dane or "",
                ident.acuerdo,
                ident.anio,
                emp["estado"],
                emp["sha256"],
                "|".join(emp["candidatos"]),
                emp["tipo_doc"],
                emp["es_modificacion"],
                emp["posible_borrador"],
            ]
        )
    ruta = destino / "documentos.csv"
    with open(ruta, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(COLUMNAS)
        w.writerows(docs)
    with open(destino / "correcciones_dane.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["fila", "municipio", "dane_original", "dane_final", "motivo"])
        w.writerows(corr)
    return ruta
