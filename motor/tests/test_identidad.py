import csv

import pytest

from motor import config
from motor.identidad import (
    acuerdos_citados,
    cargar_divipola,
    emparejar,
    escribir_documentos,
    resolver_dane,
)
from motor.matriz import Identidad


@pytest.fixture(scope="module")
def div():
    if not config.DIVIPOLA.exists():
        pytest.skip("sin DIVIPOLA")
    return cargar_divipola(config.DIVIPOLA)


def ident(dane="05631", dep="Antioquia", mun="Sabaneta", acuerdo="", anio="2022"):
    return Identidad(10, 1, dane, dep, mun, acuerdo, anio)


def fila(dane, numero, anio, nombre="x.pdf", sha="h"):
    return {
        "dane": dane, "numero": numero, "anio": anio, "archivo_estandar": nombre,
        "sha256": sha, "tipo_doc": "Acuerdo", "es_modificacion": "False",
    }


def test_dane_sin_prefijo(div):
    assert resolver_dane(ident("209", "Santander", "Confines"), div) == ("68209", "corregido_sufijo")


def test_dane_de_otro_municipio(div):
    assert resolver_dane(ident("70823", "Sucre", "Santiago de Tolu"), div)[0] == "70820"


def test_bogota(div):
    assert resolver_dane(ident("11001", "Distrito capital", "Bogotá D.C"), div) == ("11001", "ok")


def test_acuerdos_citados():
    assert acuerdos_citados("Acuerdo No 006", "2023") == [(6, 2023)]
    assert acuerdos_citados("022 de 29 Diciembre de 2018", "2018") == [(22, 2018)]


def test_varios():
    a = "Acuerdo N°022 de 2011\nAcuerdo N°014 de 2019"
    r = emparejar(ident(acuerdo=a), "05631", [fila("05631", "022", "2011", "a.pdf")], set())
    assert r["estado"] == "varios_acuerdos"
    assert r["sha256"] == "" and r["candidatos"] == ["a.pdf"]


def test_otro_acuerdo():
    r = emparejar(
        ident(acuerdo="Acuerdo 199 de 2022"), "05631", [fila("05631", "20220199", "2022")], set()
    )
    assert r["estado"] == "otro_acuerdo"


def test_coincide_ceros_y_borrador():
    r = emparejar(
        ident(acuerdo="Acuerdo 6 de 2022"), "05631",
        [fila("05631", "006", "2022", "b.pdf", "s1")], {"b.pdf"},
    )
    assert (r["estado"], r["sha256"], r["posible_borrador"]) == ("coincide", "s1", True)


def test_sin_pdf_y_sin_numero():
    assert emparejar(ident(acuerdo="Acuerdo 6 de 2022"), "05631", [], set())["estado"] == "sin_pdf"
    r = emparejar(ident(acuerdo="s/n", anio=""), "05631", [fila("05631", "SINNUM", "SINANIO")], set())
    assert r["estado"] == "sin_numero_legible"


@pytest.mark.datos
def test_datos_reales(tmp_path):
    ruta = escribir_documentos(tmp_path)
    with open(ruta, encoding="utf-8-sig") as fh:
        filas = list(csv.DictReader(fh))
    cuenta: dict[str, int] = {}
    for f in filas:
        cuenta[f["estado"]] = cuenta.get(f["estado"], 0) + 1
    print(cuenta)
    # coincide y otro_acuerdo pierden las filas reclasificadas a varios_acuerdos
    for k, v in {"sin_pdf": 5, "sin_numero_legible": 5}.items():
        assert abs(cuenta.get(k, 0) - v) <= 2
    assert sum(1 for f in filas if not f["dane_final"]) <= 2
    t = next(f for f in filas if f["fila"] == "18")
    assert t["estado"] == "coincide"
    assert t["candidatos"].split("|")[0] == "23807_Acuerdo_006_2023_Tierralta.pdf"
