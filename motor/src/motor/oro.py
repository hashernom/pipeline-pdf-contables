"""Set de oro: cada campo de la matriz con la verificación de su cita contra el PDF."""

import csv
import re
from collections import OrderedDict, defaultdict
from pathlib import Path

import openpyxl

from motor import config, corpus, matriz
from motor.verificacion import ResultadoCita, verificar_cita, verificar_valor_en_pagina

COLUMNAS = [
    "fila", "dane", "municipio", "sha256", "archivo", "hoja", "bloque_key", "campo_key",
    "valor_original", "valor", "correccion", "art", "pag", "cita", "check_cita",
    "detalle_cita", "pagina_encontrada", "desfase", "check_valor", "fuente_texto",
    "posible_borrador", "entre_paginas", "verificacion", "veredicto",
]
_NUMERICO = re.compile(r"^\d+(?:[.,]\d+)?$")


def _leer(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


def _verificacion(r: ResultadoCita) -> str:
    if r.estado in ("pasa", "pagina_ambigua", "pagina_desplazada"):
        return "verificado"
    if r.estado == "pagina_invalida" and r.pagina_encontrada is not None:
        return "verificado"
    if r.estado in ("sin_texto", "no_verificable"):
        return r.estado
    return "no_verificado"  # no_encontrada, pagina_invalida sin encontrarse


def _veredicto(r: ResultadoCita, fuente: str, borrador: bool) -> str:
    if r.estado == "no_verificable":
        return "sin_cita"
    if r.estado == "sin_texto":
        return "sin_texto"
    if r.estado == "no_encontrada" or (
        r.estado == "pagina_invalida" and r.pagina_encontrada is None
    ):
        return "dudosa"
    if r.estado != "pasa" or r.entre_paginas or fuente != "digital" or borrador:
        return "revisar"
    return "confiable"


class _Paginas:
    """Páginas con texto por sha256; conserva solo los últimos documentos usados."""

    def __init__(self, max_docs: int = 4) -> None:
        self._c: OrderedDict[str, dict] = OrderedDict()
        self._max = max_docs

    def __call__(self, sha: str) -> dict[int, str | None]:
        if sha in self._c:
            self._c.move_to_end(sha)
        else:
            self._c[sha] = corpus.paginas_con_texto(sha)
            while len(self._c) > self._max:
                self._c.popitem(last=False)
        return self._c[sha]


def construir(destino: Path, limite_filas: int | None = None,
              documentos_csv: Path | None = None) -> Path:
    """Escribe `set_de_oro.csv` en `destino`: una fila por celda `campo`/`presencia` con dato.

    `limite_filas` restringe a las primeras N filas de la matriz (subconjunto determinista).
    """
    destino = Path(destino)
    docs = {int(d["fila"]): d for d in _leer(documentos_csv or config.ORO / "documentos.csv")}
    archivos = {r["sha256"]: r["archivo_estandar"] or r["archivo_corpus"]
                for r in _leer(config.CORPUS / "corpus.csv")}
    wb = openpyxl.load_workbook(config.MATRIZ, data_only=True)
    grupos: dict[tuple[int, str, str], list[matriz.Celda]] = defaultdict(list)
    for c in matriz.celdas(wb, config.HOJAS_ALCANCE):
        grupos[(c.fila, c.hoja, c.bloque_key)].append(c)
    permitidas = sorted({k[0] for k in grupos})
    if limite_filas is not None:
        permitidas = permitidas[:limite_filas]
    permitidas = set(permitidas)

    paginas_de = _Paginas()
    salida: list[dict] = []
    for (fila, hoja, bloque), cels in sorted(grupos.items()):
        if fila not in permitidas:
            continue
        datos = [c for c in cels if c.rol in ("campo", "presencia")
                 and (c.valor is not None or c.valor_original is not None)]
        if not datos:
            continue
        doc = docs.get(fila)
        por_rol = {c.rol: c for c in cels if c.rol in ("art", "pag", "cita")}
        art = (por_rol["art"].valor or "") if "art" in por_rol else ""
        pag = (por_rol["pag"].valor or "") if "pag" in por_rol else ""
        cita = (por_rol["cita"].valor or "") if "cita" in por_rol else ""
        base = {"fila": fila, "hoja": hoja, "bloque_key": bloque, "art": art, "pag": pag,
                "cita": cita, "dane": doc["dane_final"] if doc else "",
                "municipio": doc["municipio"] if doc else ""}
        res, pg, paginas = None, None, {}
        if doc and doc["estado"] == "coincide":
            sha = doc["sha256"]
            paginas = paginas_de(sha)
            res = verificar_cita(cita, pag, paginas)
            pg = res.pagina_encontrada if res.pagina_encontrada is not None else res.pagina_anotada
            fuente = corpus.fuente_texto(sha, pg) if pg is not None else "ninguna"
            borrador = doc["posible_borrador"] == "True"
            desfase = (res.pagina_encontrada - res.pagina_anotada
                       if res.pagina_encontrada is not None and res.pagina_anotada is not None
                       else "")
            base.update(
                sha256=sha, archivo=archivos.get(sha, ""), check_cita=res.check["resultado"],
                detalle_cita=res.check["detalle"],
                pagina_encontrada="" if res.pagina_encontrada is None else res.pagina_encontrada,
                desfase=desfase, fuente_texto=fuente, posible_borrador=str(borrador),
                entre_paginas=str(res.entre_paginas), verificacion=_verificacion(res),
                veredicto=_veredicto(res, fuente, borrador))
        else:
            base.update(veredicto="sin_documento")
        for c in datos:
            check_valor = ""
            if (res is not None and hoja == "Tarifas" and c.valor and _NUMERICO.match(c.valor)
                    and pg in paginas):
                check_valor = verificar_valor_en_pagina(c.valor, paginas[pg])["resultado"]
            salida.append({**base, "campo_key": c.campo_key,
                           "valor_original": c.valor_original or "", "valor": c.valor or "",
                           "correccion": c.correccion or "", "check_valor": check_valor})
    salida.sort(key=lambda r: (r["fila"], r["hoja"], r["campo_key"]))
    destino.mkdir(parents=True, exist_ok=True)
    ruta = destino / "set_de_oro.csv"
    with open(ruta, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNAS, restval="")
        w.writeheader()
        w.writerows(salida)
    return ruta
