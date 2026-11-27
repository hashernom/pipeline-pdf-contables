import json

import pytest

from fixtures import CITA, entorno_corpus, leer
from motor import catalogo, config, llm, muestras
from motor.catalogo import Bloque, Campo, Catalogo
from motor.cli import main
from motor.corrida import (COLUMNAS_EXTRACCION, correr, documentos_objetivo,
                           estimar_costo)
from motor.oro import construir

BK = "tarifas.tarifas_actividades_economicas"
PK = BK + ".presencia_tarifa"
CK = BK + ".agricultura_minimo"
CAT = Catalogo(version="t", fuente="t", bloques=[Bloque(
    key=BK, nombre="Tarifas", hoja="Tarifas", columnas={"art": "G", "pag": "H", "cita": "I"},
    palabras_clave=["sujetos pasivos"], presencia_key=PK, criterio_presencia="si hay tarifa",
    campos=[Campo(key=CK, nombre="Agricultura mínimo", columna="K", tipo="numero",
                  unidad="por_mil", criterio="tarifa mínima")])])


@pytest.fixture
def entorno(entorno_corpus, monkeypatch):
    t = entorno_corpus
    construir(t / "oro", documentos_csv=t / "documentos.csv")
    catalogo.guardar_yaml(CAT, t / "variables.yaml")
    monkeypatch.setattr(config, "ORO", t / "oro")
    monkeypatch.setattr(config, "EXTRACCION", t / "extraccion")
    monkeypatch.setattr(config, "CATALOGO", t / "variables.yaml")
    return t


def cliente(tmp_path, pedidos=None):
    texto = json.dumps({"estado": "ENCONTRADO", "articulo": "39", "pagina": 2, "cita": CITA,
                        "campos": {PK: "si", CK: "4.5"}, "unidades": {CK: "por_mil"}})

    def t(req):
        if pedidos is not None:
            pedidos.append(req)
        return {"texto": texto, "finish_reason": "stop",
                "uso": {"entrada": 100, "cache": 20, "salida": 30}}
    return llm.Cliente(tmp_path / "cache", transporte=t)


def test_corrida_escribe_csv_ordenado_y_reproducible(entorno):
    a = correr("ajuste", "localizada", None, cliente(entorno), entorno / "a")
    b = correr("ajuste", "localizada", None, cliente(entorno), entorno / "b")
    assert a.name == "extracciones_ajuste_localizada.csv"
    assert a.read_bytes() == b.read_bytes()
    filas = leer(a)
    assert list(filas[0]) == COLUMNAS_EXTRACCION
    assert sorted(f["rol"] for f in filas) == ["campo", "presencia"]
    campo, pres = sorted(filas, key=lambda f: f["rol"])
    assert pres["estado"] == "ENCONTRADO" and pres["check_cita"] == "pasa" and pres["valor"] == "si" and pres["archivo"].endswith(".pdf")
    assert pres["grupo"] == "ajuste" and pres["pagina"] == "2" and pres["pagina_encontrada"] == "2"
    assert pres["paginas_contexto"] == "1;2" and campo["valor"] == "4.5"
    assert (pres["tokens_entrada"], pres["tokens_cache"], pres["tokens_salida"]) == ("100", "20", "30")
    assert (campo["tokens_entrada"], campo["tokens_salida"]) == ("", "")


def test_costo_real_no_cuenta_respuestas_de_cache(entorno, capsys):
    correr("ajuste", "localizada", None, cliente(entorno), entorno / "a")
    assert "costo real: 0.0000" not in capsys.readouterr().out
    correr("ajuste", "localizada", None, cliente(entorno), entorno / "b")
    assert "costo real: 0.0000" in capsys.readouterr().out


def test_ajuste_no_se_usa_a_si_mismo(entorno):
    sha = next(iter(leer(entorno / "corpus" / "corpus.csv")))["sha256"]
    refs, _ = muestras.referencias(entorno / "oro" / "set_de_oro.csv")
    part = {sha: "ajuste"}
    assert muestras.ejemplos(refs, part, BK)  # sin excluir, sí saldría como ejemplo
    pedidos = []
    correr("ajuste", "localizada", None, cliente(entorno, pedidos), entorno / "a")
    assert pedidos and all("EJEMPLOS" not in m["content"] for p in pedidos for m in p["messages"])


def test_documentos_objetivo(entorno):
    part = {"b": "ajuste", "a": "prueba", "c": "ajuste"}
    assert documentos_objetivo("ajuste", part) == ["b", "c"]
    assert documentos_objetivo("prueba", part) == ["a"]
    sha = next(iter(leer(entorno / "corpus" / "corpus.csv")))["sha256"]
    assert documentos_objetivo("todos", part) == sorted({"a", "b", "c", sha})


def test_estimar_costo_completa_cuenta_cache_desde_el_segundo_bloque(entorno):
    sha = next(iter(leer(entorno / "corpus" / "corpus.csv")))["sha256"]
    uno = estimar_costo([sha], CAT, "completa")
    dos = Catalogo(version="t", fuente="t", bloques=CAT.bloques * 2)
    assert uno > 0 and uno < estimar_costo([sha], dos, "completa") < 2 * uno
    assert estimar_costo([sha], CAT, "localizada") > 0


def test_tope_de_costo_detiene(monkeypatch, entorno, capsys):
    monkeypatch.setattr(config, "TOPE_USD_CORRIDA", 0.0)
    assert main(["extraer", "--grupo", "ajuste", "--estrategia", "completa", "--si"]) == 2
    assert "tope" in capsys.readouterr().err.lower()
    assert (entorno / "extraccion" / "particion.csv").exists()
    assert not list((entorno / "extraccion").glob("extracciones_*"))


def test_cli_corre_con_confirmacion(monkeypatch, entorno):
    falso = cliente(entorno)
    monkeypatch.setattr(llm, "Cliente", lambda cache_dir: falso)
    monkeypatch.setattr("builtins.input", lambda *_: "n")
    assert main(["extraer", "--grupo", "ajuste", "--estrategia", "localizada"]) == 1
    monkeypatch.setattr("builtins.input", lambda *_: "s")
    assert main(["extraer", "--grupo", "ajuste", "--estrategia", "localizada", "--limite", "1"]) == 0
    assert (entorno / "extraccion" / "extracciones_ajuste_localizada.csv").exists()
