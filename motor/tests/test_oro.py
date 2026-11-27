import csv
import hashlib

import openpyxl
import pymupdf
import pytest

from motor import config, corpus
from motor.informe import escribir
from motor.oro import construir
from fixtures import CITA, INVENTADA, entorno_corpus as entorno, leer

def test_extremo_a_extremo(entorno):
    ruta = construir(entorno / "out", documentos_csv=entorno / "documentos.csv")
    filas = leer(ruta)
    por_fila = {}
    for f in filas:
        por_fila.setdefault(f["fila"], []).append(f)
    buena, mala, sin = por_fila["12"], por_fila["13"], por_fila["14"]
    assert {f["veredicto"] for f in buena} == {"confiable"}
    assert {f["verificacion"] for f in buena} == {"verificado"}
    assert {f["veredicto"] for f in mala} == {"dudosa"}
    assert {f["veredicto"] for f in sin} == {"sin_documento"}
    assert {f["verificacion"] for f in sin} == {""}
    minimo = next(f for f in buena if f["valor"] == "4.5")
    assert minimo["check_valor"] in ("pasa", "alerta") and minimo["fuente_texto"] == "digital"
    assert buena[0]["archivo"] == "05001_Acuerdo_1_2022.pdf" and buena[0]["entre_paginas"] == "False"
    md = escribir(ruta, entorno / "informe.md").read_text(encoding="utf-8")
    assert "UMBRAL_CITA" in md and "sin_texto" in md and "confiable" in md


@pytest.mark.datos
def test_reproducible(tmp_path):
    a = construir(tmp_path / "a", limite_filas=40)
    b = construir(tmp_path / "b", limite_filas=40)
    assert a.read_bytes() == b.read_bytes()


@pytest.mark.datos
def test_sin_texto_coherente():
    ruta = config.ORO / "set_de_oro.csv"
    if not ruta.exists():
        pytest.skip("falta set_de_oro.csv; corre `motor verificar`")
    assert not any(f["veredicto"] == "confiable" and f["fuente_texto"] != "digital"
                   for f in leer(ruta))


from motor.oro import _veredicto, _verificacion
from motor.verificacion import ResultadoCita


def _r(estado, encontrada=2, entre=False):
    return ResultadoCita(estado, 2, encontrada, 95.0, {"resultado": "", "detalle": ""}, entre)


@pytest.mark.parametrize("res, fuente, borrador, esperado", [
    (_r("pasa"), "digital", False, "confiable"),
    (_r("pasa", entre=True), "digital", False, "revisar"),
    (_r("pasa"), "capa_ocr", False, "revisar"),
    (_r("pasa"), "digital", True, "revisar"),
    (_r("pagina_ambigua"), "digital", False, "revisar"),
    (_r("pagina_desplazada"), "digital", False, "revisar"),
    (_r("pagina_invalida", encontrada=None), "digital", False, "dudosa"),
    (_r("no_encontrada", encontrada=None), "digital", False, "dudosa"),
    (_r("sin_texto", encontrada=None), "ninguna", False, "sin_texto"),
    (_r("no_verificable", encontrada=None), "digital", False, "sin_cita"),
])
def test_veredicto(res, fuente, borrador, esperado):
    assert _veredicto(res, fuente, borrador) == esperado


def test_verificacion_no_encontrada():
    assert _verificacion(_r("no_encontrada", encontrada=None)) == "no_verificado"
    assert _verificacion(_r("pasa")) == "verificado"
