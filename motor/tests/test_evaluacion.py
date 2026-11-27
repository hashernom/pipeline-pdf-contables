import csv
import json

import pytest

from motor import catalogo, config
from motor.catalogo import Bloque, Campo, Catalogo
from motor.cli import main
from motor.corrida import COLUMNAS_EXTRACCION
from motor.evaluacion import Metricas, comparar_estrategias, evaluar
from motor.informe_extraccion import escribir

H = "Tarifas"
B1, B2, B3, B4 = (f"tarifas.b{i}" for i in range(1, 5))
COLS_ORO = ["sha256", "hoja", "bloque_key", "campo_key", "valor", "veredicto", "pag",
            "pagina_encontrada", "cita", "check_cita"]


def oro_csv(path, filas):
    with open(path, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=COLS_ORO, restval="")
        w.writeheader()
        w.writerows(filas)
    return path


def ext_csv(path, filas):
    with open(path, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNAS_EXTRACCION, restval="")
        w.writeheader()
        w.writerows(filas)
    return path


def ref(bloque, campo, valor, pag="5", pe="5", veredicto="confiable", sha="s1", hoja=H):
    return {"sha256": sha, "hoja": hoja, "bloque_key": bloque, "campo_key": campo,
            "valor": valor, "veredicto": veredicto, "pag": pag, "pagina_encontrada": pe,
            "cita": "cita ref", "check_cita": "pasa"}


def fila(bloque, campo, valor, estado="ENCONTRADO", semaforo="verde", pagina="5", pe="5",
         sha="s1", hoja=H, rol="campo", grupo="prueba", cita="cita motor"):
    return {"sha256": sha, "grupo": grupo, "hoja": hoja, "bloque_key": bloque,
            "campo_key": campo, "rol": rol, "estado": estado, "pagina": pagina,
            "pagina_encontrada": pe, "cita": cita, "valor": valor, "semaforo": semaforo,
            "check_cita": "pasa"}


@pytest.fixture
def cat(tmp_path, monkeypatch):
    c = Catalogo(version="t", fuente="t", bloques=[Bloque(
        key=B1, nombre="Uno", hoja=H, columnas={"art": "G", "pag": "H", "cita": "I"},
        presencia_key=B1 + ".pres", criterio_presencia="hay tarifa",
        campos=[Campo(key=B1 + ".tasa", nombre="Tasa", columna="K", tipo="numero",
                      criterio="la tarifa"),
                Campo(key=B1 + ".nota", nombre="Nota", columna="L", tipo="texto_libre",
                      criterio="texto de la nota")]),
        Bloque(key=B2, nombre="Dos", hoja=H, columnas={"art": "G", "pag": "H", "cita": "I"},
               presencia_key=B2 + ".pres", criterio_presencia="hay otra", campos=[])])
    catalogo.guardar_yaml(c, tmp_path / "v.yaml")
    monkeypatch.setattr(config, "CATALOGO", tmp_path / "v.yaml")
    return c


def test_metricas_basicas(tmp_path, cat):
    oro = oro_csv(tmp_path / "oro.csv", [
        ref(B1, B1 + ".pres", "si"), ref(B1, B1 + ".tasa", "4.5"),
        ref(B2, B2 + ".pres", "si"), ref(B3, B3 + ".pres", "si"), ref(B4, B4 + ".pres", "no")])
    ext = ext_csv(tmp_path / "ext.csv", [
        fila(B1, B1 + ".pres", "si", rol="presencia"), fila(B1, B1 + ".tasa", "4.5"),
        fila(B2, B2 + ".pres", "no", semaforo="amarillo", rol="presencia"),
        fila(B3, B3 + ".pres", "si", semaforo="verde", rol="presencia"),
        fila(B4, B4 + ".pres", "", estado="NO_ENCONTRADO", semaforo="rojo", pagina="", pe="",
             rol="presencia")])
    r = evaluar(ext, oro, None)
    m = r["total"]
    # 3 de 4 bloques confiables encontrados; todas las citas encontradas son reales
    assert m.bloques_ref == 4 and m.bloques_encontrados == 3
    assert m.cobertura == pytest.approx(3 / 4)
    assert m.citas_verdes == 2 and m.citas_amarillas == 1 and m.citas_rojas == 0
    assert m.citas_reales == pytest.approx(1.0)
    # valores: pres B1 ok, tasa ok, B2 mal, B3 ok, B4 ok (NO_ENCONTRADO = "no") -> 4/5
    assert m.valores_comparables == 5 and m.acierto == pytest.approx(4 / 5)
    assert r["bloque:" + B1].acierto == pytest.approx(1.0)
    assert r["hoja:" + H].valores_ok == 4
    assert r["campo:" + B1 + ".tasa"].valores_ok == 1


def test_citas_reales_dos_de_tres(tmp_path, cat):
    oro = oro_csv(tmp_path / "oro.csv", [ref(B1, B1 + ".pres", "si")])
    ext = ext_csv(tmp_path / "ext.csv", [
        fila(B1, B1 + ".pres", "si", rol="presencia"),
        fila(B2, B2 + ".pres", "si", semaforo="amarillo", rol="presencia"),
        fila(B3, B3 + ".pres", "si", semaforo="rojo", rol="presencia")])
    m = evaluar(ext, oro, None)["total"]
    assert m.citas_reales == pytest.approx(2 / 3)
    assert m.hallazgos_sin_referencia == 2


def test_cero_de_matriz_es_no_aplica(tmp_path, cat):
    oro = oro_csv(tmp_path / "oro.csv", [ref(B1, B1 + ".tasa", "0")])
    ext = ext_csv(tmp_path / "ext.csv", [fila(B1, B1 + ".tasa", "no_aplica")])
    m = evaluar(ext, oro, None)["total"]
    assert m.valores_comparables == 1 and m.valores_ok == 1


def test_numeros_con_tolerancia(tmp_path, cat):
    oro = oro_csv(tmp_path / "oro.csv", [ref(B1, B1 + ".tasa", "4,5")])
    ext = ext_csv(tmp_path / "ext.csv", [fila(B1, B1 + ".tasa", "4.5000000001")])
    assert evaluar(ext, oro, None)["total"].valores_ok == 1


def test_pagina_mas_menos_uno(tmp_path, cat):
    def prueba(pagina_motor, pe_motor):
        oro = oro_csv(tmp_path / "oro.csv", [ref(B1, B1 + ".pres", "si", pe="10")])
        ext = ext_csv(tmp_path / "ext.csv", [
            fila(B1, B1 + ".pres", "si", pagina=pagina_motor, pe=pe_motor, rol="presencia")])
        m = evaluar(ext, oro, None)["total"]
        return m.pagina_correcta, m.pagina_comparable
    assert prueba("11", "11") == (1, 1)
    assert prueba("9", "9") == (1, 1)
    assert prueba("12", "12") == (0, 1)
    assert prueba("12", "") == (0, 1)  # cae a `pagina` cuando falta pagina_encontrada


def test_pagina_de_referencia_ambigua_no_se_compara(tmp_path, cat):
    oro = oro_csv(tmp_path / "oro.csv", [ref(B1, B1 + ".pres", "si", pag="10-11", pe="")])
    ext = ext_csv(tmp_path / "ext.csv", [fila(B1, B1 + ".pres", "si", rol="presencia")])
    assert evaluar(ext, oro, None)["total"].pagina_comparable == 0


def test_hallazgo_sin_referencia_no_es_error(tmp_path, cat):
    oro = oro_csv(tmp_path / "oro.csv", [ref(B1, B1 + ".pres", "si")])
    ext = ext_csv(tmp_path / "ext.csv", [
        fila(B1, B1 + ".pres", "si", rol="presencia"),
        fila(B2, B2 + ".pres", "si", rol="presencia")])
    m = evaluar(ext, oro, None)["total"]
    assert m.hallazgos_sin_referencia == 1
    assert m.valores_comparables == 1 and m.acierto == pytest.approx(1.0)
    assert m.bloques_encontrados == 2 and m.cobertura == pytest.approx(1.0)  # cobertura no cuenta hallazgos


def test_revisar_no_cuenta_en_el_acierto(tmp_path, cat):
    oro = oro_csv(tmp_path / "oro.csv", [ref(B1, B1 + ".tasa", "9", veredicto="revisar")])
    ext = ext_csv(tmp_path / "ext.csv", [fila(B1, B1 + ".tasa", "1")])
    m = evaluar(ext, oro, None)["total"]
    assert m.valores_comparables == 0 and m.acierto is None
    assert m.revisar_comparables == 1 and m.revisar_ok == 0


def test_texto_libre_aparte(tmp_path, cat):
    oro = oro_csv(tmp_path / "oro.csv",
                  [ref(B1, B1 + ".nota", "Se aplica a todos los sujetos pasivos")])
    ext = ext_csv(tmp_path / "ext.csv", [
        fila(B1, B1 + ".nota", "se aplica a todos los sujetos pasivos del impuesto")])
    m = evaluar(ext, oro, None)["total"]
    assert m.texto_libre_ok == 1 and m.texto_libre_comparables == 1
    assert m.valores_comparables == 0


def test_solo_grupo_y_claves_excluidas(tmp_path, cat):
    oro = oro_csv(tmp_path / "oro.csv", [
        ref(B1, B1 + ".pres", "si"), ref(B1, B1 + ".pres", "no"),  # conflicto: se excluye
        ref(B2, B2 + ".pres", "si", sha="s2")])
    ext = ext_csv(tmp_path / "ext.csv", [
        fila(B1, B1 + ".pres", "si", rol="presencia", grupo="ajuste"),
        fila(B2, B2 + ".pres", "si", rol="presencia", sha="s2", grupo="prueba")])
    r = evaluar(ext, oro, "prueba")
    assert r["total"].claves_excluidas == 1
    assert r["total"].bloques_ref == 1 and r["total"].valores_ok == 1


def metricas(cr, ac):
    v = 100
    return {"total": Metricas(bloques_encontrados=v, citas_verdes=int(cr * v),
                              valores_comparables=v, valores_ok=int(ac * v))}


def test_comparar_estrategias_desempata_localizada():
    assert comparar_estrategias(metricas(.9, .5), metricas(.9, .5)) == "localizada"
    assert comparar_estrategias(metricas(.9, .5), metricas(.95, .1)) == "completa"
    assert comparar_estrategias(metricas(.95, .5), metricas(.9, .9)) == "localizada"
    assert comparar_estrategias(metricas(.9, .5), metricas(.9, .6)) == "completa"


def test_informe_determinista(tmp_path, cat):
    oro = oro_csv(tmp_path / "oro.csv", [ref(B1, B1 + ".pres", "si"), ref(B1, B1 + ".tasa", "4")])
    ext = ext_csv(tmp_path / "ext.csv", [
        fila(B1, B1 + ".pres", "no", rol="presencia"), fila(B1, B1 + ".tasa", "4")])
    r = {"prueba_localizada": evaluar(ext, oro, None)}
    costo = {"prueba_localizada": {"documentos": 2, "costo_usd_real": 0.2, "segundos_total": 10.0}}
    crit = [("tarifas.b1.tasa", "la tarifa")]
    a = escribir(r, costo, crit, tmp_path / "a.md").read_bytes()
    b = escribir(r, costo, crit, tmp_path / "b.md").read_bytes()
    assert a == b
    t = a.decode("utf-8")
    assert "Criterios definidos por el equipo de desarrollo" in t and "la tarifa" in t
    assert "0.10 USD" in t
    assert "cita motor" in t  # ejemplo de desacuerdo con su cita
    sin = escribir(r, {}, crit, tmp_path / "c.md").read_text(encoding="utf-8")
    assert "sin datos de costo" in sin


def test_cli_evaluar(tmp_path, cat, monkeypatch):
    oro_dir = tmp_path / "oro"
    oro_dir.mkdir()
    oro_csv(oro_dir / "set_de_oro.csv", [ref(B1, B1 + ".pres", "si")])
    exdir = tmp_path / "extraccion"
    exdir.mkdir()
    ext_csv(exdir / "extracciones_prueba_localizada.csv",
            [fila(B1, B1 + ".pres", "si", rol="presencia")])
    (exdir / "resumen_prueba_localizada.json").write_text(
        json.dumps({"documentos": 1, "costo_usd_real": 0.05, "segundos_total": 3.0}),
        encoding="utf-8")
    monkeypatch.setattr(config, "ORO", oro_dir)
    monkeypatch.setattr(config, "EXTRACCION", exdir)
    monkeypatch.setattr(config, "INFORMES", tmp_path / "informes")
    assert main(["evaluar"]) == 0
    t = (tmp_path / "informes" / "extraccion-piloto.md").read_text(encoding="utf-8")
    assert "prueba_localizada" in t and "0.05 USD" in t


def test_presencia_no_encontrada_cuenta_como_no(tmp_path, cat):
    oro = oro_csv(tmp_path / "oro.csv", [
        ref(B1, B1 + ".pres", "no"), ref(B2, B2 + ".pres", "si")])
    ext = ext_csv(tmp_path / "ext.csv", [
        fila(B1, B1 + ".pres", "", estado="NO_ENCONTRADO", semaforo="rojo", rol="presencia"),
        fila(B2, B2 + ".pres", "", estado="NO_ENCONTRADO", semaforo="rojo", rol="presencia")])
    m = evaluar(ext, oro, None)["total"]
    assert m.valores_comparables == 2 and m.valores_ok == 1
    assert m.desacuerdos[0][3:5] == ("si", "no")


def test_cobertura_ignora_hallazgos_sin_referencia(tmp_path, cat):
    oro = oro_csv(tmp_path / "oro.csv", [ref(B1, B1 + ".pres", "si"), ref(B2, B2 + ".pres", "si")])
    ext = ext_csv(tmp_path / "ext.csv", [
        fila(B1, B1 + ".pres", "si", rol="presencia"),
        fila(B2, B2 + ".pres", "si", rol="presencia"),
        fila(B3, B3 + ".pres", "si", rol="presencia")])  # hallazgo sin referencia
    m = evaluar(ext, oro, None)["total"]
    assert m.bloques_encontrados == 3 and m.hallazgos_sin_referencia == 1
    assert m.cobertura == pytest.approx(1.0)  # 2 de 2, no 3 de 2
    assert m.citas_reales == pytest.approx(1.0)


def _preparar_cli(tmp_path, monkeypatch, filas, grupo_csv="todos", particion=None):
    oro_dir = tmp_path / "oro"
    oro_dir.mkdir()
    oro_csv(oro_dir / "set_de_oro.csv", [
        ref(B1, B1 + ".pres", "si", sha="a1"), ref(B1, B1 + ".pres", "si", sha="p1"),
        ref(B2, B2 + ".pres", "si", sha="p1")])
    exdir = tmp_path / "extraccion"
    exdir.mkdir()
    ext_csv(exdir / f"extracciones_{grupo_csv}_localizada.csv", filas)
    if particion:
        with open(exdir / "particion.csv", "w", newline="", encoding="utf-8-sig") as fh:
            w = csv.writer(fh)
            w.writerow(["sha256", "grupo"])
            w.writerows(particion)
    monkeypatch.setattr(config, "ORO", oro_dir)
    monkeypatch.setattr(config, "EXTRACCION", exdir)
    monkeypatch.setattr(config, "INFORMES", tmp_path / "informes")
    assert main(["evaluar"]) == 0
    return (tmp_path / "informes" / "extraccion-piloto.md").read_text(encoding="utf-8")


def test_informe_separa_prueba_de_ajuste(tmp_path, cat, monkeypatch):
    filas = [fila(B1, B1 + ".pres", "si", sha="a1", grupo="ajuste", rol="presencia"),
             fila(B1, B1 + ".pres", "no", sha="p1", grupo="prueba", rol="presencia"),
             fila(B2, B2 + ".pres", "no", sha="p1", grupo="prueba", rol="presencia")]
    t = _preparar_cli(tmp_path, monkeypatch, filas)
    assert t.index("## Corrida prueba_localizada") < t.index("## Corrida ajuste_localizada")
    assert "referencia de ajuste, no es la medición final" in t
    prueba = t.split("## Corrida prueba_localizada")[1].split("## Corrida ajuste")[0]
    assert "0.0 % (0/2)" in prueba  # solo los documentos de prueba, ambos errados


def test_evaluar_solo_grupo_prueba_no_mezcla_ajuste(tmp_path, cat):
    oro = oro_csv(tmp_path / "oro.csv", [ref(B1, B1 + ".pres", "si", sha="a1"),
                                         ref(B1, B1 + ".pres", "si", sha="p1")])
    ext = ext_csv(tmp_path / "ext.csv", [
        fila(B1, B1 + ".pres", "si", sha="a1", grupo="ajuste", rol="presencia"),
        fila(B1, B1 + ".pres", "no", sha="p1", grupo="prueba", rol="presencia")])
    m = evaluar(ext, oro, "prueba")["total"]
    assert m.valores_comparables == 1 and m.valores_ok == 0


def test_informe_lista_bloques_sin_ejemplos(tmp_path, cat, monkeypatch):
    filas = [fila(B1, B1 + ".pres", "si", sha="p1", grupo="prueba", rol="presencia")]
    # B1 tiene ejemplo en el documento de ajuste a1; B2 no tiene ninguno
    t = _preparar_cli(tmp_path, monkeypatch, filas, grupo_csv="prueba",
                      particion=[("a1", "ajuste"), ("p1", "prueba")])
    limitaciones = t.split("## Limitaciones")[1].split("## Criterios")[0]
    assert f"`{B2}`" in limitaciones and f"`{B1}`" not in limitaciones
