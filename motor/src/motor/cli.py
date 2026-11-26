"""Punto de entrada de la línea de comandos del motor.

Cada subcomando se conecta en su tarea; por ahora no hace nada y devuelve 0.
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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="motor", description="Motor del set de oro.")
    sub = parser.add_subparsers(dest="comando", required=True, metavar="COMANDO")
    for nombre, ayuda in SUBCOMANDOS.items():
        sub.add_parser(nombre, help=ayuda)
    args = parser.parse_args(argv)
    if args.comando == "inventario":
        from motor import inventario

        inventario.generar(config.FUENTE, config.INVENTARIO)
    elif args.comando == "corpus":
        from motor import corpus

        corpus.construir(config.INVENTARIO / "pdfs.csv", config.CORPUS)
    elif args.comando == "matriz":
        from motor import matriz

        matriz.escribir_larga(config.ORO)
    elif args.comando == "identidad":
        from motor import identidad

        identidad.escribir_documentos(config.ORO)
    elif args.comando == "catalogo":
        import openpyxl

        from motor import catalogo

        wb = openpyxl.load_workbook(config.MATRIZ, data_only=True)
        cat = catalogo.generar(wb, config.HOJAS_ALCANCE)
        catalogo.guardar_yaml(cat, config.CATALOGO)
        catalogo.cargar_yaml(config.CATALOGO)
        catalogo.exportar_excel(cat, config.INFORMES / "catalogo-borrador.xlsx")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
