import openpyxl
import pytest
from fixtures import matriz_con_filas

from motor import config
from motor.catalogo import (
    Bloque, Campo, Catalogo, cargar_yaml, exportar_excel, generar, guardar_yaml, inferir_tipo,
)


def test_inferir_tipo():
    assert inferir_tipo(["si", "no", "si", "no_aplica", "x"]) == "si_no"  # 80 %
    assert inferir_tipo(["no_aplica", "no_aplica"]) == "texto_libre"
    assert inferir_tipo(["1", "2.5", "no_aplica", "hola"]) == "texto_libre"
    assert inferir_tipo(["1", "2.5", "no_aplica", "3"]) == "numero"
    assert inferir_tipo([]) == "texto_libre"
    assert inferir_tipo(["a", "b"]) == "texto_libre"


@pytest.fixture
def cat_sintetico(tmp_path):
    wb = openpyxl.load_workbook(matriz_con_filas(tmp_path / "m.xlsx"), data_only=True)
    return generar(wb, ["Tarifas"])


def test_generar_sintetico(cat_sintetico):
    b = cat_sintetico.bloques[0]
    assert b.hoja == "Tarifas" and set(b.columnas) == {"art", "pag", "cita", "presencia"}
    assert cat_sintetico.version == "borrador-1"
    assert all(c.criterio == "pendiente" and c.estado == "borrador" for b in cat_sintetico.bloques for c in b.campos)


def test_ida_y_vuelta(tmp_path):
    cat = Catalogo(version="v", fuente="f", bloques=[Bloque(
        key="h.b", nombre="Bloque ñ", hoja="h", columnas={"art": "G"},
        campos=[Campo(key="h.b.x", nombre="Campo", columna="H", tipo="si_no",
                      valores_permitidos=["si", "no", "no_aplica"])])])
    p = tmp_path / "v.yaml"
    guardar_yaml(cat, p)
    assert cargar_yaml(p) == cat


def test_excel(cat_sintetico, tmp_path):
    p = exportar_excel(cat_sintetico, tmp_path / "c.xlsx")
    ws = openpyxl.load_workbook(p)["catalogo"]
    assert [c.value for c in ws[1]] == [
        "hoja", "bloque", "campo", "key", "tipo", "unidad", "criterio", "critica",
        "revision_equipo", "comentario"]
    assert ws.freeze_panes == "A2"
    if ws.max_row > 1:
        assert ws.cell(2, 8).value == "pendiente"


@pytest.mark.datos
def test_catalogo_real(wb):
    cat = generar(wb, config.HOJAS_ALCANCE)
    assert len(cat.bloques) == 13 + 2 + 2
    assert all(c.criterio == "pendiente" for b in cat.bloques for c in b.campos)
    tar = [c for b in cat.bloques if b.hoja == "Tarifas" for c in b.campos if c.tipo == "numero"]
    assert len(tar) >= 38 and all(c.unidad == "pendiente" for c in tar)
