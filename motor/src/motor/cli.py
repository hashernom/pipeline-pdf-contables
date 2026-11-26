"""Punto de entrada de la línea de comandos del motor.

Cada subcomando se conecta en su tarea; por ahora no hace nada y devuelve 0.
"""

import argparse

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
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
