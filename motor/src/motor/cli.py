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
    args = parser.parse_args(argv)
    if args.comando == "todo":
        for paso in PASOS.values():
            paso()
    elif args.comando == "catalogo":
        _catalogo(enriquecer=args.enriquecer)
    else:
        PASOS[args.comando]()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
