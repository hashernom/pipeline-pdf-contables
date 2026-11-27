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
    assert len(tar) >= 38 and all(c.unidad == "por_mil" for c in tar)


# --- Tarea 4: presencia, fusión y enriquecimiento ---
import json

from motor import llm, muestras
from motor.catalogo import enriquecer, fusionar


def _campo(cat, sufijo):
    return next(c for b in cat.bloques for c in b.campos if c.key.endswith(sufijo))


def test_presencia_key_se_llena(cat_sintetico):
    assert cat_sintetico.bloques[0].presencia_key.endswith("presencia_tarifa")


def test_fusionar_conserva_lo_editado(cat_sintetico):
    previo = cat_sintetico.model_copy(deep=True)
    b = previo.bloques[0]
    b.palabras_clave = ["pasivo"]
    b.criterio_presencia = "si hay tarifa"
    c0 = b.campos[0]
    c0.criterio = "si nombra a las personas"
    c0.critica = True
    c0.metodo = "llm"
    c0.unidad = "por_cien"
    f = fusionar(cat_sintetico, previo)
    fb = f.bloques[0]
    assert fb.palabras_clave == ["pasivo"] and fb.criterio_presencia == "si hay tarifa"
    fc = fb.campos[0]
    assert (fc.criterio, fc.critica, fc.metodo, fc.unidad) == (
        "si nombra a las personas", True, "llm", "por_cien")
    assert fb.presencia_key == cat_sintetico.bloques[0].presencia_key


def test_fusionar_claves_nuevas_y_perdidas(cat_sintetico):
    previo = cat_sintetico.model_copy(deep=True)
    previo.bloques[0].campos.append(Campo(key="x.y.viejo", nombre="v", columna="Z", tipo="texto_libre"))
    previo.bloques[0].campos.pop(0)
    f = fusionar(cat_sintetico, previo)
    assert [c.key for c in f.bloques[0].campos] == [c.key for c in cat_sintetico.bloques[0].campos]


def test_fusionar_unidad_pendiente_no_bloquea(cat_sintetico):
    nuevo = cat_sintetico.model_copy(deep=True)
    nuevo.bloques[0].campos[0].unidad = "por_mil"
    previo = cat_sintetico.model_copy(deep=True)
    previo.bloques[0].campos[0].unidad = "pendiente"
    assert fusionar(nuevo, previo).bloques[0].campos[0].unidad == "por_mil"


def _refs_part(tmp_path, bloque):
    import csv
    cols = ["sha256", "hoja", "bloque_key", "campo_key", "valor", "veredicto", "pag",
            "pagina_encontrada", "cita", "check_cita"]
    filas = []
    for i in range(1, 4):
        sha = f"s{i}"
        for ck, v in ((bloque.presencia_key, "si"), (bloque.campos[0].key, "no")):
            filas.append({"sha256": sha, "hoja": bloque.hoja, "bloque_key": bloque.key,
                          "campo_key": ck, "valor": v, "veredicto": "confiable", "pag": "1",
                          "pagina_encontrada": "1", "cita": f"cita pasivo tarifa {i}", "check_cita": "ok"})
    p = tmp_path / "set.csv"
    with open(p, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        w.writerows(filas)
    refs, _ = muestras.referencias(p)
    return refs, {f"s{i}": "ajuste" for i in range(1, 4)}


def test_enriquecer_no_llama_si_no_hay_pendientes(tmp_path, cat_sintetico):
    cat = cat_sintetico.model_copy(deep=True)
    for b in cat.bloques:
        b.criterio_presencia = "ya"
        b.palabras_clave = ["x"]
        for c in b.campos:
            c.criterio = "ya"

    def falla(req):
        raise AssertionError("no debía llamar")

    cl = llm.Cliente(tmp_path / "c", transporte=falla)
    assert enriquecer(cat, {}, {}, cl) == cat


def test_enriquecer_escribe_criterio(tmp_path, cat_sintetico):
    b = cat_sintetico.bloques[0]
    refs, part = _refs_part(tmp_path, b)
    pedidos = []

    def transporte(req):
        pedidos.append(req)
        return {"texto": json.dumps({"criterio": "Vale si ..."}), "finish_reason": "stop",
                "uso": {"entrada": 1, "cache": 0, "salida": 1}}

    cl = llm.Cliente(tmp_path / "c", transporte=transporte)
    cat2 = enriquecer(cat_sintetico, refs, part, cl)
    assert cat2.bloques[0].criterio_presencia == "Vale si ..."
    assert all(c.criterio == "Vale si ..." for c in cat2.bloques[0].campos)
    assert cat_sintetico.bloques[0].criterio_presencia == "pendiente"  # no muta la entrada
    assert "JSON" in json.dumps(pedidos[0]["messages"])
    assert "cita pasivo tarifa" in json.dumps(pedidos[0]["messages"], ensure_ascii=False)
    assert cat2.bloques[0].palabras_clave  # nombre del bloque al menos
