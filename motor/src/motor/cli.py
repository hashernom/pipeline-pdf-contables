"""Punto de entrada de la línea de comandos del motor.

Cada subcomando ejecuta un paso del pipeline; `todo` los encadena.
"""

import argparse

from motor import config

SUBCOMANDOS = {
    "inventario": "Construye el inventario de fuentes.",
    "corpus": "Extrae el corpus de texto de los PDF.",
    "matriz": "Procesa la matriz de investigación.",
    "identidad": "Resuelve la identidad de municipios y departamentos.",
    "catalogo": "Valida el catálogo de variables.",
    "extraer": "Extrae los bloques de la matriz con el modelo.",
    "evaluar": "Evalúa las extracciones contra el set de oro y escribe el informe.",
    "verificar": "Verifica citas y valores contra la fuente.",
    "todo": "Ejecuta el pipeline completo.",
}


def _inventario() -> None:
    from motor import inventario

    inventario.generar(config.FUENTE, config.INVENTARIO)


def _corpus() -> None:
    from motor import corpus

    corpus.construir(config.INVENTARIO / "pdfs.csv", config.CORPUS)


def _matriz() -> None:
    from motor import matriz

    matriz.escribir_larga(config.ORO)


def _identidad() -> None:
    from motor import identidad

    identidad.escribir_documentos(config.ORO)


def _catalogo(enriquecer: bool = False) -> None:
    import openpyxl

    from motor import catalogo, llm, muestras

    wb = openpyxl.load_workbook(config.MATRIZ, data_only=True)
    cat = catalogo.generar(wb, config.HOJAS_ALCANCE)
    if config.CATALOGO.exists():
        cat = catalogo.fusionar(cat, catalogo.cargar_yaml(config.CATALOGO))
    if enriquecer:
        csv_oro = config.ORO / "set_de_oro.csv"
        ruta_part = config.EXTRACCION / "particion.csv"
        if ruta_part.exists():
            part = muestras.leer_particion(ruta_part)
        else:
            part = muestras.particion(csv_oro)
            muestras.escribir_particion(part, ruta_part)
        refs, _ = muestras.referencias(csv_oro)
        cat = catalogo.enriquecer(cat, refs, part, llm.Cliente(config.EXTRACCION / "cache"))
    catalogo.guardar_yaml(cat, config.CATALOGO)
    catalogo.cargar_yaml(config.CATALOGO)
    catalogo.exportar_excel(cat, config.INFORMES / "catalogo-borrador.xlsx")


def _extraer(grupo: str, estrategia: str, limite: int | None, si: bool) -> int:
    import sys

    from motor import catalogo, corrida, llm, muestras

    ruta_part = config.EXTRACCION / "particion.csv"
    if not ruta_part.exists():
        muestras.escribir_particion(muestras.particion(config.ORO / "set_de_oro.csv"), ruta_part)
    part = muestras.leer_particion(ruta_part)
    shas = corrida.documentos_objetivo(grupo, part)
    if limite is not None:
        shas = shas[:limite]
    estimado = corrida.estimar_costo(shas, catalogo.cargar_yaml(config.CATALOGO), estrategia)
    print(f"Documentos: {len(shas)}. Costo estimado: {estimado:.2f} USD.")
    if estimado > config.TOPE_USD_CORRIDA:
        print(f"El costo estimado ({estimado:.2f} USD) supera el tope de "
              f"{config.TOPE_USD_CORRIDA:.2f} USD por corrida. No se ejecutó nada.",
              file=sys.stderr)
        return 2
    if not si and input("¿Continuar? [s/N] ").strip().lower() not in ("s", "si", "sí"):
        print("Corrida cancelada.")
        return 1
    corrida.correr(grupo, estrategia, limite, llm.Cliente(config.EXTRACCION / "cache"),
                   config.EXTRACCION)
    return 0


def _evaluar() -> None:
    import json

    from motor import catalogo, evaluacion, informe_extraccion, muestras

    cat = catalogo.cargar_yaml(config.CATALOGO)
    csv_oro = config.ORO / "set_de_oro.csv"
    resultados, costo = {}, {}
    for ruta in sorted(config.EXTRACCION.glob("extracciones_*.csv")):
        nombre = ruta.stem.removeprefix("extracciones_")
        resultados[nombre] = evaluacion.evaluar(ruta, csv_oro, None, cat)
        resumen = config.EXTRACCION / f"resumen_{nombre}.json"
        if resumen.exists():
            costo[nombre] = json.loads(resumen.read_text(encoding="utf-8"))
    ruta_part = config.EXTRACCION / "particion.csv"
    sin_ejemplos: list[str] = []
    if ruta_part.exists():
        part = muestras.leer_particion(ruta_part)
        refs, _ = muestras.referencias(csv_oro)
        sin_ejemplos = [b.key for b in cat.bloques if not muestras.ejemplos(refs, part, b.key)]
    destino = informe_extraccion.escribir(
        resultados, costo, informe_extraccion.criterios_catalogo(cat),
        config.INFORMES / "extraccion-piloto.md", sin_ejemplos)
    print(f"Informe: {destino}")


def _verificar() -> None:
    from motor import informe, oro

    ruta = oro.construir(config.ORO)
    informe.escribir(ruta, config.INFORMES / "set-de-oro-resumen.md")


PASOS = {
    "inventario": _inventario,
    "corpus": _corpus,
    "matriz": _matriz,
    "identidad": _identidad,
    "catalogo": _catalogo,
    "verificar": _verificar,
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="motor", description="Motor del set de oro.")
    sub = parser.add_subparsers(dest="comando", required=True, metavar="COMANDO")
    for nombre, ayuda in SUBCOMANDOS.items():
        p = sub.add_parser(nombre, help=ayuda)
        if nombre == "catalogo":
            p.add_argument("--enriquecer", action="store_true",
                           help="Además genera palabras clave y criterios con el modelo.")
        if nombre == "extraer":
            p.add_argument("--grupo", choices=["ajuste", "prueba", "todos"], required=True)
            p.add_argument("--estrategia", choices=["localizada", "completa"], required=True)
            p.add_argument("--limite", type=int, default=None, help="Máximo de documentos.")
            p.add_argument("--si", action="store_true", help="No pedir confirmación.")
    args = parser.parse_args(argv)
    if args.comando == "todo":
        for paso in PASOS.values():
            paso()
    elif args.comando == "extraer":
        return _extraer(args.grupo, args.estrategia, args.limite, args.si)
    elif args.comando == "evaluar":
        _evaluar()
    elif args.comando == "catalogo":
        _catalogo(enriquecer=args.enriquecer)
    else:
        PASOS[args.comando]()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
