from fixtures import entorno_corpus, leer  # noqa: F401
from motor import config
from motor.cli import main
from motor.eval_localizar import evaluar_localizacion, pagina_oro, resumen_por_bloque
from motor.muestras import Referencia
from test_corrida import BK, entorno  # noqa: F401


def _ref(pag="", enc=None, check="pasa"):
    return Referencia("s", "h", "b", "c", "v", "confiable", pag, enc, "cita", check)


def test_pagina_oro_prefiere_la_encontrada_y_acepta_pag_entera():
    assert pagina_oro(_ref("9", 12)) == 12
    assert pagina_oro(_ref("7")) == 7
    assert pagina_oro(_ref("7-8")) is None
    assert pagina_oro(_ref("")) is None
    assert pagina_oro(_ref("7", check="falla")) is None


def test_evaluacion_escribe_csv_y_mide_acierto(entorno):  # noqa: F811
    filas = evaluar_localizacion(entorno / "extraccion")
    assert filas and all(f["acierta"] in ("exacto", "cerca", "no") for f in filas)
    f = next(f for f in filas if f["bloque_key"] == BK)
    assert f["pagina_oro"] == 2 and f["acierta"] == "exacto"
    ruta = entorno / "extraccion" / "localizacion_ajuste.csv"
    assert list(leer(ruta)[0]) == ["sha256", "hoja", "bloque_key", "pagina_oro",
                                   "paginas_contexto", "acierta"]
    tabla = resumen_por_bloque(filas)
    assert tabla[BK] == (1, 1, 1)  # documentos, aciertos exactos, aciertos ±1


def test_cli_localizar_eval(entorno, capsys):  # noqa: F811
    assert main(["localizar-eval"]) == 0
    assert BK in capsys.readouterr().out
    assert (entorno / "extraccion" / "localizacion_ajuste.csv").exists()
