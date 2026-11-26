import openpyxl
import pytest

from motor import config
from motor.matriz import Columna, estructura
from fixtures import matriz_sintetica


def _por_letra(cols):
    return {c.letra: c for c in cols}


def test_tarifas_sintetica(tmp_path):
    wb = openpyxl.load_workbook(matriz_sintetica(tmp_path / "m.xlsx"))
    fila, cols = estructura(wb["Tarifas"])
    assert fila == 11
    c = _por_letra(cols)
    assert c["G"].rol == "art" and c["H"].rol == "pag"
    assert c["I"].rol == "cita" and c["J"].rol == "presencia"
    assert c["G"].bloque == "Tarifas Actividades Económicas"
    assert c["G"].bloque_key == "tarifas.tarifas_actividades_economicas"
    assert c["K"].campo == "Agricultura · Mínimo"
    assert c["L"].campo == "Agricultura · Máximo"
    assert c["K"].rol == "campo" and c["K"].bloque == c["G"].bloque
    assert c["K"].campo_key == "tarifas.tarifas_actividades_economicas.agricultura_minimo"
    assert "M" not in c  # espaciadora
    assert c["N"].bloque == "Tarifas de ICA e-Commerce"
    assert isinstance(c["K"], Columna) and c["K"].col == 11 and c["K"].hoja == "Tarifas"


def test_claves_repetidas(tmp_path):
    wb = openpyxl.load_workbook(matriz_sintetica(tmp_path / "m.xlsx"))
    c = _por_letra(estructura(wb["Tarifas"])[1])
    assert c["O"].campo_key.endswith(".cual")
    assert c["P"].campo_key.endswith(".cual_2")


def test_encabezado_fila_10(tmp_path):
    wb = openpyxl.load_workbook(matriz_sintetica(tmp_path / "m.xlsx"))
    fila, cols = estructura(wb["Territorialidad"])
    assert fila == 10
    assert cols[0].letra == "G" and cols[0].rol == "art"


def test_sin_encabezado(tmp_path):
    wb = openpyxl.Workbook()
    with pytest.raises(ValueError):
        estructura(wb.active)


@pytest.mark.datos
def test_bloques_reales(wb):
    arts = lambda h: [c.letra for c in estructura(wb[h])[1] if c.rol == "art"]
    assert arts("Elementos del tributo") == ["G","L","AL","AY","BD","BP","BZ","CK","CT","DQ","ED","EI","EN"]
    assert arts("Actividades No Sujetas") == ["G","AE"]
    assert arts("Tarifas") == ["G","AW"]
    todas = [c.campo_key for h in config.HOJAS_ALCANCE for c in estructura(wb[h])[1]]
    assert len(set(todas)) == len(todas)
