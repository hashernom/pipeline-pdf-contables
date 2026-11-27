"""Corrida de extracción: procesa documentos, estima y suma costos y escribe el CSV."""
from __future__ import annotations

import csv
import json
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from motor import config, corpus, llm, muestras
from motor.catalogo import Catalogo, cargar_yaml
from motor.extractor import Extraccion, armar_mensajes, extraer_bloque
from motor.localizar import ESTRATEGIAS

COLUMNAS_EXTRACCION = [
    "sha256", "archivo", "grupo", "hoja", "bloque_key", "campo_key", "rol", "estado",
    "articulo", "pagina", "cita", "valor", "unidad", "check_cita", "detalle_cita",
    "pagina_encontrada", "check_valor", "semaforo", "estrategia", "intentos",
    "paginas_contexto", "tokens_entrada", "tokens_cache", "tokens_salida",
]
SALIDA_ESTIMADA_TOKENS = 1500


def _leer(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


def documentos_objetivo(grupo: str, part: dict[str, str]) -> list[str]:
    if grupo != "todos":
        return sorted(s for s, g in part.items() if g == grupo)
    shas = set(part)
    shas |= {r["sha256"] for r in _leer(config.CORPUS / "corpus.csv")
             if int(r.get("digital") or 0) > 0}
    return sorted(shas)


def _particion() -> dict[str, str]:
    ruta = config.EXTRACCION / "particion.csv"
    if ruta.exists():
        return muestras.leer_particion(ruta)
    part = muestras.particion(config.ORO / "set_de_oro.csv")
    muestras.escribir_particion(part, ruta)
    return part


def _ejemplos_y_citas(refs, part, bloque_key: str, sha: str):
    excluir = sha if part.get(sha) == "ajuste" else None
    return (muestras.ejemplos(refs, part, bloque_key, excluir=excluir),
            muestras.citas_referencia(refs, part, bloque_key, excluir=excluir))


def estimar_costo(shas: list[str], cat: Catalogo, estrategia: str) -> float:
    """USD estimados con el mismo contexto y mensajes que se mandarían al modelo."""
    p = config.PRECIO_USD_MTOK
    part = _particion()
    refs, _ = muestras.referencias(config.ORO / "set_de_oro.csv")
    total = 0.0
    for sha in shas:
        paginas = corpus.paginas_con_texto(sha)
        for i, b in enumerate(cat.bloques):
            ejemplos, citas = _ejemplos_y_citas(refs, part, b.key, sha)
            nums = ESTRATEGIAS[estrategia](paginas, citas, b.palabras_clave, b.key)
            ctx = {n: paginas[n] for n in nums if paginas.get(n)}
            msgs = armar_mensajes(b, ctx, ejemplos, estrategia)
            tokens = [llm.estimar_tokens(m["content"]) for m in msgs]
            if estrategia == "completa":
                doc, resto = tokens[1], tokens[0] + tokens[2]
                total += (doc * (p["cache"] if i else p["entrada"]) + resto * p["entrada"]) / 1e6
            else:
                total += sum(tokens) * p["entrada"] / 1e6
            total += SALIDA_ESTIMADA_TOKENS * p["salida"] / 1e6
    return total


def _filas(e: Extraccion, archivo: str, grupo: str) -> list[dict]:
    filas = []
    for i, c in enumerate(e.campos):
        filas.append({
            "sha256": e.sha256, "archivo": archivo, "grupo": grupo, "hoja": e.hoja,
            "bloque_key": e.bloque_key, "campo_key": c.campo_key, "rol": c.rol,
            "estado": e.estado, "articulo": e.articulo or "",
            "pagina": "" if e.pagina is None else e.pagina, "cita": e.cita or "",
            "valor": "" if c.valor is None else c.valor, "unidad": c.unidad or "",
            "check_cita": e.check_cita, "detalle_cita": e.detalle_cita,
            "pagina_encontrada": "" if e.pagina_encontrada is None else e.pagina_encontrada,
            "check_valor": c.check_valor, "semaforo": e.semaforo, "estrategia": e.estrategia,
            "intentos": e.intentos, "paginas_contexto": ";".join(map(str, e.paginas_contexto)),
            # los tokens van solo en la primera fila del bloque para no contarlos dos veces
            "tokens_entrada": e.uso.entrada if i == 0 else "",
            "tokens_cache": e.uso.cache if i == 0 else "",
            "tokens_salida": e.uso.salida if i == 0 else "",
        })
    return filas


class CorridaFallida(RuntimeError):
    """Todos los documentos de la corrida fallaron."""


def _describir_error(exc: Exception) -> str:
    """Tipo y mensaje corto de la excepción (sin headers ni el pedido)."""
    msg = " ".join(str(getattr(exc, "message", None) or exc).split())
    return f"{type(exc).__name__}: {msg[:200]}"


def correr(grupo: str, estrategia: str, limite: int | None, cliente: llm.Cliente,
           destino: Path) -> Path:
    cat = cargar_yaml(config.CATALOGO)
    part = _particion()
    refs, _ = muestras.referencias(config.ORO / "set_de_oro.csv")
    shas = documentos_objetivo(grupo, part)
    if limite is not None:
        shas = shas[:limite]
    archivos = {r["sha256"]: r["archivo_estandar"] for r in _leer(config.CORPUS / "corpus.csv")}

    def procesar(sha: str):
        t0 = time.monotonic()
        paginas = corpus.paginas_con_texto(sha)
        gr = part.get(sha, "corpus")
        filas, costo = [], 0.0
        for b in cat.bloques:
            ejemplos, citas = _ejemplos_y_citas(refs, part, b.key, sha)
            e = extraer_bloque(b, paginas, cliente, ejemplos, citas, estrategia, sha)
            costo += (e.uso_real or llm.Uso(0, 0, 0, 0.0)).costo_usd()
            filas += _filas(e, archivos.get(sha, ""), gr)
        return sha, filas, costo, time.monotonic() - t0

    def seguro(sha: str):
        try:
            return procesar(sha)
        except Exception as exc:  # un documento fallido no detiene la corrida
            return sha, exc

    filas, costo, segundos = [], 0.0, 0.0
    fallidos: list[dict] = []
    terminados = 0
    with ThreadPoolExecutor(config.CONCURRENCIA) as pool:
        for res in pool.map(seguro, shas):
            if len(res) == 2:
                sha, exc = res
                fallidos.append({"sha256": sha, "error": _describir_error(exc)})
                print(f"{sha[:12]}: FALLÓ ({fallidos[-1]['error']})")
                continue
            sha, fs, c, seg = res
            filas += fs
            costo += c
            segundos += seg
            terminados += 1
            print(f"{sha[:12]}: {seg:.1f} s")
    fallidos.sort(key=lambda f: f["sha256"])
    if fallidos:
        causas = sorted({f["error"] for f in fallidos})
        print(f"{len(fallidos)} documento(s) fallaron y se omitieron. Causa: {'; '.join(causas)}")
    if shas and not terminados:
        raise CorridaFallida(f"Fallaron los {len(shas)} documentos. Causa: "
                             f"{'; '.join(sorted({f['error'] for f in fallidos}))}")
    filas.sort(key=lambda f: (f["sha256"], f["hoja"], f["bloque_key"], f["campo_key"]))
    destino = Path(destino)
    destino.mkdir(parents=True, exist_ok=True)
    ruta = destino / f"extracciones_{grupo}_{estrategia}.csv"
    with open(ruta, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNAS_EXTRACCION)
        w.writeheader()
        w.writerows(filas)
    resumen = {"documentos": terminados, "documentos_fallidos": fallidos,
               "costo_usd_real": round(costo, 6), "segundos_total": round(segundos, 1)}
    (destino / f"resumen_{grupo}_{estrategia}.json").write_text(
        json.dumps(resumen, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"costo real: {costo:.4f} USD ({terminados} documentos) -> {ruta}")
    return ruta
