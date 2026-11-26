import csv
import hashlib
from pathlib import Path

import pymupdf
import pytest

from motor import config, corpus, inventario

TEXTO = (
    "ACUERDO MUNICIPAL DEL CONCEJO. El impuesto de industria y comercio en el "
    "municipio tiene una tarifa por cada actividad segun el articulo primero."
)


def hacer_pdf(path: Path, texto: str = TEXTO) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), texto)
    doc.save(path)
    doc.close()


def leer_csv(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@pytest.fixture
def fuente(tmp_path):
    raiz = tmp_path / "fuente"
    hacer_pdf(raiz / "Acuerdos Municipales/municipios udes/05001_Acuerdo_12_2020_Medellin.pdf", TEXTO + " uno")
    hacer_pdf(raiz / "Acuerdos Municipales/duplicados/hash identicos/05001_Acuerdo_12_2020_Medellin.pdf", TEXTO + " dos")
    hacer_pdf(raiz / "acuerdos añadidos/05002_Acuerdo_3_2021_Abejorral_Modificacion.pdf", TEXTO + " tres")
    return raiz


def test_corpus_excluye_duplicados(tmp_path, fuente):
    inv, _ = inventario.generar(fuente, tmp_path / "inv")
    csv_ = corpus.construir(inv, tmp_path / "corpus")
    filas = leer_csv(csv_)
    assert len(filas) == 2 and {f["categoria"] for f in filas} == {"udes", "anadido"}
    for f in filas:
        assert sha((tmp_path / "corpus" / f["archivo_corpus"])) == f["sha256"]
        assert f["archivo_corpus"].startswith(f["sha256"][:12] + "_")
    por_cat = {f["categoria"]: f for f in filas}
    assert por_cat["anadido"]["es_modificacion"] == "True"
    assert por_cat["udes"]["es_modificacion"] == "False"
    assert list(filas[0]) == [
        "sha256", "archivo_corpus", "archivo_estandar", "categoria", "dane", "tipo_doc", "numero",
        "anio", "es_modificacion", "paginas", "digital", "capa_ocr", "texto_corrupto", "escaneada",
        "vacia", "ruta_fuente",
    ]


def test_fuente_intacta(tmp_path, fuente):
    def huellas():
        return {p.as_posix(): sha(p) for p in sorted(fuente.rglob("*")) if p.is_file()}

    antes = huellas()
    inv, _ = inventario.generar(fuente, tmp_path / "inv")
    corpus.construir(inv, tmp_path / "corpus")
    assert huellas() == antes


def test_inventario_columnas(tmp_path, fuente):
    inv, pag = inventario.generar(fuente, tmp_path / "inv")
    filas = leer_csv(inv)
    assert len(filas) == 3
    assert {"ruta", "categoria", "archivo", "bytes", "sha256", "paginas", "digital", "error"} <= set(filas[0])
    assert list(leer_csv(pag)[0]) == [
        "sha256", "pagina", "tipo", "chars", "cobertura_imagen", "ratio_letras", "palabras_comunes"
    ]


def test_paginas_con_texto_y_fuente(tmp_path, fuente, monkeypatch):
    inv, pag = inventario.generar(fuente, tmp_path / "inv")
    corpus.construir(inv, tmp_path / "corpus")
    monkeypatch.setattr(config, "INVENTARIO", tmp_path / "inv")
    monkeypatch.setattr(config, "CORPUS", tmp_path / "corpus")
    corpus.limpiar_cache()
    h = leer_csv(tmp_path / "corpus" / "corpus.csv")[0]["sha256"]
    textos = corpus.paginas_con_texto(h)
    assert set(textos) == {1} and "impuesto" in textos[1]
    assert corpus.fuente_texto(h, 1) == "digital"
    assert corpus.fuente_texto(h, 99) == "ninguna"


@pytest.mark.datos
def test_datos_reales():
    inv, _ = inventario.generar(config.FUENTE, config.INVENTARIO)
    csv_ = corpus.construir(inv, config.CORPUS)
    filas = leer_csv(csv_)
    assert len(filas) == 638
    assert len({f["sha256"] for f in filas}) == 638
