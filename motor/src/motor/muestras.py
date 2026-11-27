"""Partición ajuste/prueba del set de oro y referencias para evaluar el motor."""

import csv
import random
from dataclasses import dataclass
from pathlib import Path

from motor import config

Clave = tuple[str, str, str]  # (sha256, hoja, campo_key)


@dataclass(frozen=True)
class Referencia:
    sha256: str
    hoja: str
    bloque_key: str
    campo_key: str
    valor: str
    veredicto: str
    pag: str
    pagina_encontrada: int | None
    cita: str
    check_cita: str


@dataclass(frozen=True)
class Ejemplo:
    sha256: str
    cita: str
    valores: dict[str, str]


def _leer(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


def particion(set_csv: Path, n_ajuste: int = config.N_AJUSTE,
              semilla: int = config.SEMILLA) -> dict[str, str]:
    """sha256 -> "ajuste" | "prueba", sobre documentos con al menos un campo confiable."""
    poblacion = sorted({r["sha256"] for r in _leer(set_csv) if r["veredicto"] == "confiable"})
    ajuste = set(random.Random(semilla).sample(poblacion, min(n_ajuste, len(poblacion))))
    return {sha: "ajuste" if sha in ajuste else "prueba" for sha in poblacion}


def escribir_particion(part: dict[str, str], destino: Path) -> Path:
    destino = Path(destino)
    destino.parent.mkdir(parents=True, exist_ok=True)
    with open(destino, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(["sha256", "grupo"])
        w.writerows(sorted(part.items()))
    return destino


def leer_particion(path: Path) -> dict[str, str]:
    return {r["sha256"]: r["grupo"] for r in _leer(path)}


def _referencia(r: dict) -> Referencia:
    pe = (r["pagina_encontrada"] or "").strip()
    return Referencia(
        sha256=r["sha256"], hoja=r["hoja"], bloque_key=r["bloque_key"],
        campo_key=r["campo_key"], valor=r["valor"], veredicto=r["veredicto"],
        pag=r["pag"], pagina_encontrada=int(float(pe)) if pe else None,
        cita=r["cita"], check_cita=r["check_cita"],
    )


def referencias(set_csv: Path) -> tuple[dict[Clave, Referencia], int]:
    """Referencias `confiable`/`revisar` por clave; descarta claves con valores en conflicto."""
    grupos: dict[Clave, list[dict]] = {}
    for r in _leer(set_csv):
        if r["veredicto"] in ("confiable", "revisar"):
            grupos.setdefault((r["sha256"], r["hoja"], r["campo_key"]), []).append(r)
    refs: dict[Clave, Referencia] = {}
    excluidas = 0
    for clave in sorted(grupos):
        filas = grupos[clave]
        if len({f["valor"] for f in filas}) > 1:
            excluidas += 1
            continue
        ref = _referencia(filas[0])
        if ref.veredicto == "confiable" and any(f["veredicto"] != "confiable" for f in filas):
            ref = Referencia(**{**ref.__dict__, "veredicto": "revisar"})
        refs[clave] = ref
    return refs, excluidas


def _de_ajuste(refs: dict[Clave, Referencia], part: dict[str, str], bloque_key: str,
               excluir: str | None, solo_confiable: bool) -> dict[str, list[Referencia]]:
    por_doc: dict[str, list[Referencia]] = {}
    for clave in sorted(refs):
        r = refs[clave]
        if (r.bloque_key != bloque_key or part.get(r.sha256) != "ajuste"
                or r.sha256 == excluir or (solo_confiable and r.veredicto != "confiable")):
            continue
        por_doc.setdefault(r.sha256, []).append(r)
    return por_doc


def ejemplos(refs: dict[Clave, Referencia], part: dict[str, str], bloque_key: str,
             excluir: str | None = None, n: int = config.N_EJEMPLOS) -> list[Ejemplo]:
    """Un ejemplo por documento de ajuste (veredicto confiable) para el bloque dado."""
    por_doc = _de_ajuste(refs, part, bloque_key, excluir, True)
    salida = []
    for sha in sorted(por_doc)[:n]:
        rs = por_doc[sha]
        salida.append(Ejemplo(
            sha256=sha,
            cita=next((r.cita for r in rs if r.cita), ""),
            valores={r.campo_key: r.valor for r in rs},
        ))
    return salida


def citas_referencia(refs: dict[Clave, Referencia], part: dict[str, str], bloque_key: str,
                     excluir: str | None = None) -> list[str]:
    """Citas únicas del bloque en documentos de ajuste."""
    por_doc = _de_ajuste(refs, part, bloque_key, excluir, False)
    vistas: dict[str, None] = {}
    for sha in sorted(por_doc):
        for r in por_doc[sha]:
            if r.cita:
                vistas.setdefault(r.cita)
    return list(vistas)
