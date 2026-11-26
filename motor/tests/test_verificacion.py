import pytest

from motor.verificacion import verificar_cita, verificar_valor_en_pagina

P = {
    1: "portada",
    2: "ARTÍCULO 39. Son sujetos pasivos del impuesto de industria y comercio las personas naturales",
    3: None,
}
CITA2 = "Son sujetos pasivos del impuesto de industria y comercio las personas naturales"
INVENTADA_LARGA = "El municipio exonera de por vida a todas las plataformas digitales del pago"


def test_exacta():
    assert verificar_cita(CITA2, "2", P).estado == "pasa"


def test_desplazada():
    r = verificar_cita(CITA2, "1", P)
    assert (r.estado, r.pagina_encontrada) == ("pagina_desplazada", 2)


def test_escaneada():
    r = verificar_cita("Texto que estaría en la página escaneada número tres del acuerdo", "3", P)
    assert r.estado == "sin_texto"


def test_inventada():
    r = verificar_cita(INVENTADA_LARGA, "2", P)
    assert r.check["resultado"] == "falla"
    assert r.estado == "no_encontrada"


def test_corta():
    assert verificar_cita("No se evidencia", "2", P).estado == "no_verificable"


def test_pagina_invalida():
    estados = {verificar_cita(INVENTADA_LARGA, x, P).estado for x in ["0", "", "99"]}
    assert estados == {"pagina_invalida"}


def test_pagina_invalida_pero_aparece():
    assert verificar_cita(CITA2, "99", P).estado == "pagina_desplazada"


def test_pagina_ambigua():
    assert verificar_cita(CITA2, "1-2", P).estado == "pagina_ambigua"


def test_salto_guion():
    cita = "Son sujetos pa-\nsivos del impuesto de industria y comercio las personas naturales"
    assert verificar_cita(cita, "2", P).estado == "pasa"


def test_valor():
    assert verificar_valor_en_pagina("4.5", "tarifa del 4,5 por mil")["resultado"] == "pasa"
    assert verificar_valor_en_pagina("4.5", "tarifa del 7 por mil")["resultado"] == "alerta"
    assert verificar_valor_en_pagina("4.5", None)["resultado"] == "no_aplica"


def _verificaciones_elementos(wb):
    """Una verificación por (fila, bloque) de Elementos en PDFs digitales con estado coincide."""
    import csv
    from collections import defaultdict

    from motor import config as cfg
    from motor.corpus import paginas_con_texto
    from motor.matriz import celdas

    def leer(ruta):
        with open(ruta, encoding="utf-8-sig", newline="") as f:
            return list(csv.DictReader(f))

    corpus = {r["sha256"]: r for r in leer(cfg.CORPUS / "corpus.csv")}
    docs = {}
    for r in leer(cfg.ORO / "documentos.csv"):
        c = corpus.get(r["sha256"])
        if r["estado"] == "coincide" and c and int(c["paginas"]) and \
                int(c["digital"]) / int(c["paginas"]) >= 0.9:
            docs[int(r["fila"])] = r["sha256"]
    por_bloque = defaultdict(dict)
    for c in celdas(wb, ["Elementos del tributo"]):
        if c.fila in docs and c.rol in ("cita", "pag"):
            por_bloque[(c.fila, c.bloque_key)][c.rol] = c.valor
    cache, salida = {}, []
    for (fila, bloque), v in por_bloque.items():
        if not v.get("cita"):
            continue
        sha = docs[fila]
        if sha not in cache:
            cache[sha] = paginas_con_texto(sha)
        salida.append((fila, bloque, v["cita"], v.get("pag"),
                       verificar_cita(v["cita"], v.get("pag"), cache[sha])))
    return salida


@pytest.mark.datos
def test_tasa_elementos_digitales(wb):
    """Población de referencia: Pág. con un solo entero dentro del documento."""
    import json
    import re
    from collections import Counter

    from motor import config as cfg

    res = _verificaciones_elementos(wb)
    todos = Counter(x[4].estado for x in res)
    unica = [x for x in res
             if re.fullmatch(r"\d+(\.0)?", (x[3] or "").strip()) and x[4].estado != "pagina_invalida"]
    cuenta = Counter(x[4].estado for x in unica)
    denom = cuenta["pasa"] + cuenta["pagina_desplazada"] + cuenta["no_encontrada"]
    tasa = cuenta["pasa"] / denom
    fallos = [x for x in unica if x[4].estado in ("no_encontrada", "pagina_desplazada")]
    noenc = [x for x in unica if x[4].estado == "no_encontrada"]
    resumen = {
        "tasa": tasa, "umbral": cfg_umbral(), "conteo_poblacion_completa": dict(todos),
        "conteo_pag_entera": dict(cuenta),
        "fallos_score_80_90": sum(1 for x in fallos if 80 <= x[4].score < 90),
        "fallos_score_85_90": sum(1 for x in fallos if 85 <= x[4].score < 90),
        "no_encontrada_score_80_90": sum(1 for x in noenc if 80 <= x[4].score < 90),
        "no_encontrada_score_85_90": sum(1 for x in noenc if 85 <= x[4].score < 90),
        "ejemplos_no_encontrada": [
            {"fila": f, "bloque": b, "score": round(r.score, 1), "cita": c[:120].replace("\n", " ")}
            for f, b, c, _, r in noenc[:3]],
    }
    salida = cfg.RAIZ / ".superpowers/sdd/2026-11-26-base-set-de-oro/task-7-calibracion.json"
    salida.write_text(json.dumps(resumen, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(resumen, ensure_ascii=False, indent=1))
    assert 0.80 <= tasa <= 0.95


def cfg_umbral():
    from motor.config import UMBRAL_CITA
    return UMBRAL_CITA
