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


def test_corrida_escribe_resumen_de_costo(entorno):
    correr("ajuste", "localizada", None, cliente(entorno), entorno / "a")
    resumen = json.loads((entorno / "a" / "resumen_ajuste_localizada.json").read_text(encoding="utf-8"))
    assert set(resumen) == {"documentos", "documentos_fallidos", "costo_usd_real", "segundos_total"}
    assert resumen["documentos"] >= 1 and resumen["costo_usd_real"] > 0
    assert resumen["segundos_total"] >= 0


class Error402(Exception):
    pass


def _cliente_que_falla(tmp_path):
    def t(req):
        raise Error402("Insufficient Balance")
    return llm.Cliente(tmp_path / "cache", transporte=t)


def test_un_documento_fallido_no_detiene_la_corrida(entorno, monkeypatch, capsys):
    from motor import corpus, corrida
    sha = next(iter(leer(entorno / "corpus" / "corpus.csv")))["sha256"]
    malo = "f" * 64
    monkeypatch.setattr(corrida, "documentos_objetivo", lambda g, p: [sha, malo])
    real = corrida.extraer_bloque

    def extraer(b, paginas, cl, ej, citas, est, s):
        if s == malo:
            raise Error402("Insufficient Balance")
        return real(b, paginas, cl, ej, citas, est, s)
    monkeypatch.setattr(corrida, "extraer_bloque", extraer)
    paginas = corpus.paginas_con_texto(sha)
    monkeypatch.setattr(corrida.corpus, "paginas_con_texto", lambda s: paginas)
    ruta = correr("ajuste", "localizada", None, cliente(entorno), entorno / "a")
    assert {f["sha256"] for f in leer(ruta)} == {sha}
    resumen = json.loads((entorno / "a" / "resumen_ajuste_localizada.json").read_text(encoding="utf-8"))
    assert resumen["documentos"] == 1
    assert resumen["documentos_fallidos"] == [{"sha256": malo, "error": "Error402: Insufficient Balance"}]
    assert "1 documento" in capsys.readouterr().out


def test_todos_fallan_sale_con_codigo_3_sin_csv(entorno, monkeypatch, capsys):
    falso = _cliente_que_falla(entorno)
    monkeypatch.setattr(llm, "Cliente", lambda cache_dir: falso)
    assert main(["extraer", "--grupo", "ajuste", "--estrategia", "localizada", "--si"]) == 3
    assert not list((entorno / "extraccion").glob("extracciones_*"))
    salida = capsys.readouterr()
    assert "Insufficient Balance" in salida.out + salida.err


def test_describir_error_quita_el_id_de_pedido_y_acorta():
    from motor.corrida import _describir_error
    e = Error402("Error code: 402 - Insufficient Balance (request_id: abc-123)")
    assert _describir_error(e) == "Error402: Error code: 402 - Insufficient Balance"
    assert len(_describir_error(Error402("x" * 1000))) <= 220
