import csv

import openpyxl
import pytest
from fixtures import matriz_con_filas

from motor import config
from motor.matriz import celdas, correcciones_limpieza, escribir_larga, identidades


@pytest.fixture
def sint(tmp_path):
    return openpyxl.load_workbook(matriz_con_filas(tmp_path / "m.xlsx"), data_only=True)


def test_identidades_sinteticas(sint):
    ids = identidades(sint)
    assert [i.fila for i in ids] == [12, 13, 14]
    assert ids[0].dane_original == "23807" and ids[0].municipio == "Tierralta"
    assert ids[0].anio == "2023"


def test_correcciones_y_celdas_sinteticas(sint):
    assert correcciones_limpieza(sint, ["Tarifas"])[("Tarifas", 12, 7)] == "Si"
    c = [x for x in celdas(sint, ["Tarifas"]) if x.fila == 12]
    primera = c[0]
    assert (primera.valor_original, primera.valor, primera.correccion) == (
        "No", "si", "limpieza_equipo")
    assert len(celdas(sint, ["Tarifas"])) == 3 * len(c)


def test_sin_copia_limpieza(tmp_path):
    wb = openpyxl.load_workbook(
        matriz_con_filas(tmp_path / "n.xlsx", limpieza=False), data_only=True)
    assert correcciones_limpieza(wb, ["Tarifas"]) == {}
    assert all(x.correccion is None for x in celdas(wb, ["Tarifas"]))


def test_consecutivo_distinto(tmp_path):
    p = matriz_con_filas(tmp_path / "c.xlsx", limpieza=False)
    wb = openpyxl.load_workbook(p)
    wb["Tarifas"]["A13"] = 99
    wb.save(p)
    wb = openpyxl.load_workbook(p, data_only=True)
    with pytest.raises(ValueError, match="Tarifas"):
        celdas(wb, ["Tarifas"])


def test_escribir_larga_sintetica(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "MATRIZ", matriz_con_filas(tmp_path / "m.xlsx"))
    monkeypatch.setattr(config, "HOJAS_ALCANCE", ("Tarifas",))
    ruta = escribir_larga(tmp_path / "oro")
    filas = list(csv.DictReader(ruta.open(encoding="utf-8-sig")))
    assert filas and all(f["valor"] or f["valor_original"] for f in filas)
    assert {f["correccion"] for f in filas} == {"limpieza_equipo"}


@pytest.mark.datos
def test_identidades_reales(wb):
    assert len(identidades(wb)) == 508


@pytest.mark.datos
def test_tierralta_limpieza(wb):
    c = {(x.fila, x.campo_key): x for x in celdas(wb, config.HOJAS_ALCANCE)}
    u = next(v for (f, k), v in c.items() if f == 18 and k.endswith(".consorcios"))
    assert (u.valor_original, u.valor, u.correccion) == ("No", "si", "limpieza_equipo")


def conteo_directo_openpyxl(wb, hoja, col, validos):
    ws = wb[hoja]
    filas = {i.fila for i in identidades(wb)}
    return sum(
        1 for r in filas
        if isinstance(ws[f"{col}{r}"].value, str) and ws[f"{col}{r}"].value.strip() in validos
    )


@pytest.mark.datos
def test_conteo_si_igual_al_excel(wb):
    n = sum(
        1 for x in celdas(wb, ["Elementos del tributo"])
        if x.campo_key.endswith(".persona_natural") and x.valor == "si" and x.correccion is None
    )
    assert n == conteo_directo_openpyxl(
        wb, "Elementos del tributo", "P", {"si", "SI", "Si", "sí"})
