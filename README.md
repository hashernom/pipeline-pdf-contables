# Pipeline de extracción verificable de acuerdos tributarios municipales

Este sistema extrae datos de los acuerdos municipales del **impuesto de industria y comercio (ICA)** de Colombia. Cada dato sale con la **cita literal y la página del PDF** de donde viene, y el código verifica que esa cita exista. Si un dato no se encuentra, se marca así y nunca se inventa.

El proyecto nace del macroproyecto de investigación de Contaduría Pública de las UTS, *"Alcance del concepto de presencia económica significativa en el impuesto de industria y comercio"* (DIE-PI-001-126). Hoy los estudiantes llenan a mano una matriz de unas 850 columnas por municipio. La meta es que solo **revisen** lo que extrae el sistema.

Responsables: Santiago Afanador Aguello y Mariana Acero.

> La ficha técnica v4 ([docs/ficha/](docs/ficha/)) se escribió pensando en estados financieros. El material real resultó ser de acuerdos tributarios del ICA, así que el dominio cambió. Los principios siguen iguales: cita, folio, verificación por código y revisión humana.

## Estado

| Hito | Qué es | Estado |
|---|---|---|
| 0. Base y set de oro | Corpus de 638 PDFs, matriz normalizada, catálogo borrador y verificación de citas (`motor/`) | **Hecho** |
| 1. Motor de extracción | Extraer los campos del catálogo con su cita en los PDFs digitales y medirlo contra el set de oro | **Siguiente** |
| 2. Frontend del dominio | Adaptar `web/` (hoy simula estados financieros) para revisar acuerdos tributarios | Pendiente |
| OCR (hito aparte) | Sacar texto de los PDFs escaneados y volver a verificar | Pendiente |
| Backend y despliegue | API, cola, base de datos | Pendiente |

**Resultado del hito 0:** de unos 77.000 datos de la matriz, 10.305 quedaron `confiable` (la cita está en la página anotada). Detalle en [docs/informes/set-de-oro-resumen.md](docs/informes/set-de-oro-resumen.md).

## Estructura

```
.
├── README.md            este archivo
├── PRODUCT.md           usuarios, propósito y principios del producto
├── DESIGN.md            sistema visual del frontend
├── motor/               Python: corpus, matriz, catálogo y set de oro (ver motor/README.md)
├── web/                 Next.js: interfaz de revisión, hoy con datos simulados (ver web/README.md)
├── referencias/         material del equipo que sí va en git: DIVIPOLA, cruces, hallazgos
├── docs/                documentación (índice en docs/README.md)
│   ├── arquitectura/    visión general, motor, UML, frontend, integración
│   ├── datos/           diagnóstico de la base de PDFs y de la matriz
│   ├── informes/        salidas generadas por el motor (catálogo en Excel, resumen del set de oro)
│   ├── ficha/           ficha técnica v4
│   └── superpowers/     diseños y planes de cada hito
└── datos/               NO va en git: PDFs, matriz Excel y CSV generados
```

`datos/` pesa unos 25 GB (incluido el zip original del equipo) y no está en el repo. Para trabajar con el motor hay que tenerlo en la raíz con esta forma:

```
datos/
├── fuente/              PDFs originales extraídos del zip del equipo
├── matriz/              Matriz ICA Distribución Curación_verificacion.xlsx
├── inventario/          generado: pdfs.csv, paginas.csv
├── corpus/              generado: un PDF por sha256 + corpus.csv
└── oro/                 generado: matriz_larga.csv, documentos.csv, set_de_oro.csv
```

## Empezar

**Motor** (Python 3.12+ y [uv](https://docs.astral.sh/uv/)):

```powershell
cd motor
uv sync
uv run pytest -m "not datos"
uv run motor verificar
```

**Frontend** (Node.js, Next.js 16):

```powershell
cd web
npm install
npm run dev
```

## Documentación

Empieza por [docs/README.md](docs/README.md). Lo principal:

- [Visión general](docs/arquitectura/vision-general.md): qué piezas hay y cómo encajan.
- [Motor](docs/arquitectura/motor.md): los seis pasos, los archivos que produce y las reglas de veredicto.
- [Diagramas UML](docs/arquitectura/uml.md), en Mermaid.
- [Glosario](docs/glosario.md): ICA, DANE, folio, bloque, set de oro...
