"""Informe en Markdown del set de oro (determinista, sin marcas de tiempo)."""

import csv
from collections import Counter
from pathlib import Path

from motor import config


def _leer(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


def _tabla(encabezado: list[str], filas: list[list]) -> list[str]:
    out = ["| " + " | ".join(encabezado) + " |", "|" + "---|" * len(encabezado)]
    out += ["| " + " | ".join(str(x) for x in f) + " |" for f in filas]
    return out + [""]


def _conteo(titulo: str, cnt: Counter, total: int) -> list[str]:
    filas = [[k or "(vacío)", n, f"{100 * n / total:.1f} %"] for k, n in sorted(cnt.items())]
    return [f"### {titulo}", ""] + _tabla(["valor", "campos", "%"], filas)


def _tasas(filas: list[dict], clave, solo_digital: bool = False) -> list[list]:
    tot, ok = Counter(), Counter()
    for f in filas:
        if f["verificacion"] == "":
            continue
        if solo_digital and (f["fuente_texto"] != "digital"
                             or f["verificacion"] not in ("verificado", "no_verificado")):
            continue
        tot[clave(f)] += 1
        ok[clave(f)] += f["check_cita"] == "pasa"
    return [[k, tot[k], ok[k], f"{100 * ok[k] / tot[k]:.1f} %"] for k in sorted(tot)]


def escribir(set_csv: Path, destino_md: Path) -> Path:
    set_csv, destino_md = Path(set_csv), Path(destino_md)
    filas = _leer(set_csv)
    total = max(len(filas), 1)
    L = ["# Set de oro: resumen de verificación", "",
         "Generado por `motor verificar`. Cada campo hereda el resultado de la cita de su "
         "bloque, que se verifica una sola vez por documento y bloque.", "",
         "## Alcance y umbrales", "",
         f"- `UMBRAL_CITA` = {config.UMBRAL_CITA:g} (similitud mínima para dar la cita por encontrada).",
         f"- `MIN_CHARS_CITA` = {config.MIN_CHARS_CITA} (por debajo, la cita es `no_verificable`).",
         f"- `MIN_CHARS_CITA_PAR` = {config.MIN_CHARS_CITA_PAR} (largo mínimo para aceptar una cita "
         "repartida entre dos folios consecutivos).",
         "- El OCR queda fuera de alcance: las filas `sin_texto` esperan el piloto de OCR.",
         "- Las citas encontradas repartidas entre dos folios (`entre_paginas`) nunca son "
         "`confiable`; van a `revisar`.",
         "- Solo se listan celdas `campo` y `presencia` con dato; las celdas vacías no generan fila.",
         "", "### Valores de `veredicto`", "",
         "- `confiable`: la cita pasa en un folio con texto digital, sin ser borrador ni repartida entre folios.",
         "- `revisar`: folio ambiguo o desplazado, texto de capa OCR, posible borrador o cita entre folios.",
         "- `dudosa`: la cita no aparece en el documento, o el folio anotado no existe y no se encontró.",
         "- `sin_texto`: el folio es escaneado y no hay texto que verificar.",
         "- `sin_cita`: la cita está vacía o es demasiado corta para verificarse (valor adicional al "
         "plan, para no inflar `dudosa`).",
         "- `sin_documento`: la fila de la matriz no tiene un documento emparejado (`coincide`).",
         "", "### Valores de `verificacion`", "",
         "- `verificado`: la cita quedó en `pasa`, `pagina_ambigua` o `pagina_desplazada`.",
         "- `sin_texto`, `no_verificable`: como arriba.",
         "- `no_verificado`: la cita no se encontró (`no_encontrada` o `pagina_invalida`).",
         "- (vacío): fila sin documento.", ""]
    docs_csv = set_csv.parent / "documentos.csv"
    if docs_csv.exists():
        est = Counter(d["estado"] for d in _leer(docs_csv))
        L += ["## Documentos emparejados (`documentos.csv`)", ""]
        L += _tabla(["estado", "filas"], [[k, n] for k, n in sorted(est.items())])
    L += [f"## Conteos ({len(filas)} campos)", ""]
    L += _conteo("Por veredicto", Counter(f["veredicto"] for f in filas), total)
    L += _conteo("Por verificación", Counter(f["verificacion"] for f in filas), total)
    L += ["## Tasa de `pasa` (citas en el folio anotado)", "",
          "Campos con documento emparejado; el denominador cuenta campos, no bloques.", "",
          "### Por hoja", ""]
    L += _tabla(["hoja", "campos", "pasa", "tasa"], _tasas(filas, lambda f: f["hoja"]))
    L += ["### Por hoja, solo citas verificables en folios digitales", "",
          "Excluye `sin_texto`, `sin_cita` y folios de capa OCR.", ""]
    L += _tabla(["hoja", "campos", "pasa", "tasa"],
                _tasas(filas, lambda f: f["hoja"], solo_digital=True))
    L += ["### Por bloque", ""]
    L += _tabla(["hoja / bloque", "campos", "pasa", "tasa"],
                _tasas(filas, lambda f: f"{f['hoja']} / {f['bloque_key']}"))
    # Una cita por (fila, hoja, bloque): los desfases se cuentan por cita, no por campo.
    citas = {(f["fila"], f["hoja"], f["bloque_key"]): f
             for f in filas if f["desfase"] not in ("", "0")}
    L += ["## Desfases de folio", "", "### Los 10 más comunes", ""]
    comunes = Counter(int(f["desfase"]) for f in citas.values())
    L += _tabla(["desfase", "citas"],
                [[d, n] for d, n in sorted(comunes.items(), key=lambda x: (-x[1], x[0]))[:10]])
    por_doc: Counter = Counter()
    nombre: dict[str, str] = {}
    for f in citas.values():
        por_doc[(f["sha256"], int(f["desfase"]))] += 1
        nombre[f["sha256"]] = f"{f['municipio']} ({f['archivo']})"
    cte = sorted(((s, d, n) for (s, d), n in por_doc.items() if n >= 3),
                 key=lambda x: (-x[2], x[0], x[1]))
    L += ["### Documentos con desfase constante (3 o más citas con el mismo desfase)", ""]
    L += (_tabla(["documento", "desfase", "citas"], [[nombre[s], d, n] for s, d, n in cte])
          if cte else ["Ninguno.", ""])
    dudosas, vistos = [], set()
    for f in filas:
        k = (f["fila"], f["hoja"], f["bloque_key"])
        if f["veredicto"] == "dudosa" and k not in vistos:
            vistos.add(k)
            dudosas.append(f)
    L += ["## Ejemplos de `dudosa`", ""]
    paso = max(1, len(dudosas) // 5)
    for f in dudosas[::paso][:5]:
        cita = " ".join(f["cita"].split())[:200]
        L += [f"- Fila {f['fila']}, {f['hoja']} / {f['bloque_key']}, folio «{f['pag']}»: "
              f"{f['detalle_cita']}. Cita: «{cita}»"]
    if not dudosas:
        L += ["Ninguna."]
    L += [""]
    destino_md.parent.mkdir(parents=True, exist_ok=True)
    destino_md.write_text("\n".join(L), encoding="utf-8", newline="\n")
    return destino_md
