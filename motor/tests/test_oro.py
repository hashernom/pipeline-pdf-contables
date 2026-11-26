import csv
import hashlib

import openpyxl
import pymupdf
import pytest

from motor import config, corpus
from motor.informe import escribir
from motor.oro import construir
from fixtures import matriz_con_filas

CITA = "Son sujetos pasivos del impuesto de industria y comercio las personas naturales y juridicas"
INVENTADA = "El municipio exonera de por vida a todas las plataformas digitales del pago anual"


def leer(path):
    with open(path, newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


@pytest.fixture
def entorno(tmp_path, monkeypatch):
    pdf = tmp_path / "corpus" / "doc.pdf"
    pdf.parent.mkdir()
    doc = pymupdf.open()
    doc.new_page().insert_text((72, 72), "Portada del acuerdo")
    doc.new_page().insert_text((72, 72), "ARTICULO 39. " + CITA, fontsize=7)
    doc.save(pdf)
    doc.close()
    sha = hashlib.sha256(pdf.read_bytes()).hexdigest()
    with open(tmp_path / "corpus" / "corpus.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["sha256", "archivo_corpus", "archivo_estandar"])
        w.writerow([sha, "doc.pdf", "05001_Acuerdo_1_2022.pdf"])
    (tmp_path / "inv").mkdir()
    with open(tmp_path / "inv" / "paginas.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["sha256", "pagina", "tipo"])
        w.writerows([[sha, 1, "digital"], [sha, 2, "digital"]])
    m = matriz_con_filas(tmp_path / "m.xlsx", limpieza=False)
    wb = openpyxl.load_workbook(m)
    ws = wb["Tarifas"]
    ws["G12"], ws["H12"], ws["I12"], ws["J12"], ws["K12"] = "39", "2", CITA, "Si", "4.5"
    ws["G13"], ws["H13"], ws["I13"], ws["J13"] = "40", "2", INVENTADA, "Si"
    ws["J14"] = "No"
    wb.save(m)
    with open(tmp_path / "documentos.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["fila", "consecutivo", "municipio", "departamento", "dane_original",
                    "dane_final", "acuerdo", "anio", "estado", "sha256", "candidatos",
                    "tipo_doc", "es_modificacion", "posible_borrador"])
        for fila, est in ((12, "coincide"), (13, "coincide"), (14, "sin_documento")):
            w.writerow([fila, fila - 11, "M", "D", "1", "05001", "A", "2022", est,
                        sha if est == "coincide" else "", "", "Acuerdo", "False", "False"])
    monkeypatch.setattr(config, "MATRIZ", m)
    monkeypatch.setattr(config, "CORPUS", tmp_path / "corpus")
    monkeypatch.setattr(config, "INVENTARIO", tmp_path / "inv")
    monkeypatch.setattr(config, "HOJAS_ALCANCE", ("Tarifas",))
    corpus.limpiar_cache()
    yield tmp_path
    corpus.limpiar_cache()


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
