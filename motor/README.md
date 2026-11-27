# motor

Construye el set de oro: corpus de PDFs, matriz normalizada, catálogo borrador y verificación de citas. La documentación completa está en [docs/arquitectura/motor.md](../docs/arquitectura/motor.md) y los diagramas en [docs/arquitectura/uml.md](../docs/arquitectura/uml.md).

## Requisitos

- Python 3.12+ y [uv](https://docs.astral.sh/uv/).
- La carpeta `datos/` en la raíz del repo, con `fuente/` y `matriz/`. Ver el [README raíz](../README.md#estructura).

## Uso

```powershell
uv sync
uv run motor todo
uv run motor verificar
```

`todo` corre los seis pasos (`inventario`, `corpus`, `matriz`, `identidad`, `catalogo`, `verificar`). Tarda bastante, porque el inventario abre las 105.818 páginas. Si solo cambió la verificación, basta con `verificar` (unos 8 minutos).

## Pruebas

```powershell
uv run pytest -m "not datos"
uv run pytest -m datos
```

La primera tanda es sintética y tarda segundos. La segunda usa los datos reales y tarda varios minutos.

## Estructura

```
motor/
├── pyproject.toml / uv.lock
├── catalogo/variables.yaml    catálogo borrador (generado; lo aprueba el equipo)
├── src/motor/
│   ├── config.py              rutas y umbrales (único lugar con rutas)
│   ├── normalizar.py          texto y valores
│   ├── inventario.py          paso 1
│   ├── corpus.py              paso 2 y texto por página
│   ├── matriz.py              paso 3
│   ├── identidad.py           paso 4
│   ├── catalogo.py            paso 5
│   ├── verificacion.py        verificador de citas
│   ├── oro.py / informe.py    paso 6
│   └── cli.py
└── tests/                     pytest; las pruebas marcadas `datos` usan datos reales
```
