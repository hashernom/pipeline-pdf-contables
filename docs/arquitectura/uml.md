# Diagramas UML

Todos los diagramas están en [Mermaid](https://mermaid.js.org/). GitHub y VS Code (con la extensión de vista previa de Markdown) los dibujan. Reflejan el código al cierre del hito 1 (motor de extracción). Si cambias un módulo, actualiza aquí su diagrama.

1. [Componentes del sistema](#1-componentes-del-sistema)
2. [Flujo del motor](#2-flujo-del-motor)
3. [Dependencias entre módulos](#3-dependencias-entre-módulos)
4. [Clases](#4-clases)
5. [Archivos generados y sus relaciones](#5-archivos-generados-y-sus-relaciones)
6. [Secuencia de `motor verificar`](#6-secuencia-de-motor-verificar)
7. [Decisión del veredicto](#7-decisión-del-veredicto)
8. [Emparejamiento fila → PDF](#8-emparejamiento-fila--pdf)
9. [Capas del frontend](#9-capas-del-frontend)
10. [Secuencia de `extraer_bloque`](#10-secuencia-de-extraer_bloque)

## 1. Componentes del sistema

Las cajas punteadas todavía no existen. El extractor ya existe desde el hito 1.

```mermaid
flowchart TB
    subgraph fuera[Fuera de git · datos/]
        F[(fuente/<br/>PDFs originales)]
        M[(matriz/<br/>Matriz ICA .xlsx)]
        G[(inventario/ corpus/ oro/<br/>CSV y PDFs generados)]
    end
    subgraph repo[Repositorio]
        R[(referencias/<br/>DIVIPOLA y material del equipo)]
        MOT[motor/<br/>Python CLI]
        CAT[(motor/catalogo/<br/>variables.yaml)]
        INF[(docs/informes/)]
        WEB[web/<br/>Next.js, datos simulados]
    end
    EXT[Extractor · hito 1<br/>extraer y evaluar]
    DS[DeepSeek API]
    OCR[OCR · hito aparte]:::futuro
    API[API y base de datos]:::futuro

    F --> MOT
    M --> MOT
    R --> MOT
    MOT --> G
    MOT --> CAT
    MOT --> INF
    G --> EXT
    CAT --> EXT
    EXT <--> DS
    OCR -.-> G
    EXT -.-> API
    API -.-> WEB
    classDef futuro stroke-dasharray: 5 5
```

## 2. Flujo del motor

Cada paso es un subcomando de `uv run motor`. Los cilindros son archivos.

```mermaid
flowchart LR
    F[(datos/fuente/*.pdf)] --> I[1 · inventario]
    I --> PDFS[(pdfs.csv)]
    I --> PAG[(paginas.csv)]
    PDFS --> C[2 · corpus]
    C --> COR[(corpus.csv<br/>+ PDFs por sha256)]

    MX[(Matriz ICA .xlsx)] --> MZ[3 · matriz]
    MZ --> ML[(matriz_larga.csv)]

    MX --> ID[4 · identidad]
    DV[(DIVIPOLA)] --> ID
    COR --> ID
    BR[(Posibles borradores)] --> ID
    ID --> DOC[(documentos.csv)]
    ID --> CD[(correcciones_dane.csv)]

    MX --> CT[5 · catalogo]
    CT --> Y[(variables.yaml)]
    CT --> XL[(catalogo-borrador.xlsx)]

    MX --> V[6 · verificar]
    DOC --> V
    COR --> V
    PAG --> V
    V --> SO[(set_de_oro.csv)]
    V --> RS[(set-de-oro-resumen.md)]

    SO --> X[7 · extraer]
    COR --> X
    Y --> X
    X --> EXC[(extracciones_grupo_estrategia.csv<br/>resumen_*.json · cache/)]
    EXC --> EV[8 · evaluar]
    SO --> EV
    EV --> IP[(extraccion-piloto.md)]
```

## 3. Dependencias entre módulos

Una flecha `A --> B` significa que A importa B. `config` y `normalizar` son la base. `verificacion` no depende de la matriz, y por eso el extractor del hito 1 lo reutiliza tal cual. `extractor` es el único módulo que junta el modelo (`llm`), la selección de páginas (`localizar`) y la verificación de citas.

```mermaid
flowchart TD
    cli --> inventario
    cli --> corpus
    cli --> matriz
    cli --> identidad
    cli --> catalogo
    cli --> oro
    cli --> informe
    cli --> corrida
    cli --> evaluacion
    cli --> informe_extraccion
    cli --> muestras
    cli --> llm
    corrida --> extractor
    corrida --> muestras
    corrida --> llm
    corrida --> corpus
    extractor --> llm
    extractor --> localizar
    extractor --> verificacion
    extractor --> muestras
    extractor --> catalogo
    extractor --> normalizar
    catalogo --> llm
    catalogo --> localizar
    catalogo --> muestras
    evaluacion --> muestras
    evaluacion --> catalogo
    evaluacion --> normalizar
    informe_extraccion --> evaluacion
    informe_extraccion --> catalogo
    localizar --> normalizar
    oro --> matriz
    oro --> corpus
    oro --> verificacion
    identidad --> matriz
    identidad --> normalizar
    catalogo --> matriz
    matriz --> normalizar
    verificacion --> normalizar
    inventario --> config
    corpus --> config
    matriz --> config
    identidad --> config
    catalogo --> config
    oro --> config
    informe --> config
    verificacion --> config
    llm --> config
    localizar --> config
    muestras --> config
    corrida --> config
    evaluacion --> config
```

## 4. Clases

Son dataclasses (`matriz`, `verificacion`) y modelos Pydantic (`catalogo`). Los atributos que pueden faltar llevan `?`.

```mermaid
classDiagram
    direction LR

    class Columna {
        <<dataclass · matriz>>
        int col
        str letra
        str hoja
        str bloque
        str bloque_key
        str campo
        str campo_key
        Rol rol
    }
    class Identidad {
        <<dataclass · matriz>>
        int fila
        int consecutivo?
        str dane_original
        str departamento
        str municipio
        str acuerdo
        str anio
    }
    class Celda {
        <<dataclass · matriz>>
        int fila
        str hoja
        str bloque_key
        str campo_key
        str rol
        str valor_original?
        str valor?
        str correccion?
    }
    class ResultadoCita {
        <<dataclass · verificacion>>
        Estado estado
        int pagina_anotada?
        int pagina_encontrada?
        float score
        dict check
        bool entre_paginas
    }
    class Catalogo {
        <<Pydantic · catalogo>>
        str version
        str fuente
        List~Bloque~ bloques
    }
    class Bloque {
        <<Pydantic · catalogo>>
        str key
        str nombre
        str hoja
        dict columnas
        List~str~ palabras_clave
        List~Campo~ campos
    }
    class Campo {
        <<Pydantic · catalogo>>
        str key
        str nombre
        str columna
        TipoCampo tipo
        str unidad?
        List~str~ valores_permitidos?
        str criterio
        bool critica?
        Metodo metodo?
        EstadoCampo estado
    }
    class Rol {
        <<enumeration>>
        art
        pag
        cita
        presencia
        campo
    }
    class Estado {
        <<enumeration>>
        pasa
        pagina_ambigua
        pagina_desplazada
        pagina_invalida
        no_encontrada
        sin_texto
        no_verificable
    }

    Catalogo "1" *-- "*" Bloque
    Bloque "1" *-- "*" Campo
    Columna --> Rol
    ResultadoCita --> Estado
    Columna ..> Celda : define la columna de
    Identidad "1" ..> "*" Celda : misma fila
```

## 5. Archivos generados y sus relaciones

`fila` es el número de fila de la matriz Excel, y `sha256` identifica un PDF único.

```mermaid
erDiagram
    PDFS }o--|| CORPUS : "se deduplica en"
    CORPUS ||--o{ PAGINAS : "tiene"
    DOCUMENTOS }o--o| CORPUS : "se empareja con"
    DOCUMENTOS ||--o| CORRECCIONES_DANE : "corrige"
    DOCUMENTOS ||--o{ MATRIZ_LARGA : "fila"
    DOCUMENTOS ||--o{ SET_DE_ORO : "fila"
    MATRIZ_LARGA ||--o| SET_DE_ORO : "se verifica en"

    PDFS {
        string ruta PK
        string sha256 FK
        string categoria
        string dane
        string tipo_doc
        string numero
        string anio
        int paginas
    }
    CORPUS {
        string sha256 PK
        string archivo_corpus
        string archivo_estandar "DANE_Tipo_Numero_Anio.pdf"
        string dane
        string numero
        string anio
        bool es_modificacion
        int digital
        int escaneada
    }
    PAGINAS {
        string sha256 PK, FK
        int pagina PK "base 1"
        string tipo "digital, capa_ocr, escaneada..."
        int chars
    }
    DOCUMENTOS {
        int fila PK
        string municipio
        string dane_final
        string acuerdo
        string anio
        string estado "coincide, otro_acuerdo..."
        string sha256 FK
        bool posible_borrador
    }
    CORRECCIONES_DANE {
        int fila PK, FK
        string dane_original
        string dane_final
        string motivo
    }
    MATRIZ_LARGA {
        int fila PK, FK
        string hoja PK
        string campo_key PK
        string bloque_key
        string rol "art, pag, cita, presencia, campo"
        string valor_original
        string valor
        string correccion
    }
    SET_DE_ORO {
        int fila PK, FK
        string hoja PK
        string campo_key PK
        string sha256 FK
        string pag
        string cita
        string check_cita
        int pagina_encontrada
        string fuente_texto
        bool entre_paginas
        string verificacion
        string veredicto
    }
```

## 6. Secuencia de `motor verificar`

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant CLI as cli
    participant ORO as oro.construir
    participant MZ as matriz
    participant COR as corpus
    participant VER as verificacion
    participant INF as informe.escribir

    U->>CLI: uv run motor verificar
    CLI->>ORO: construir(datos/oro)
    ORO->>ORO: lee documentos.csv y corpus.csv
    ORO->>MZ: celdas(wb, HOJAS_ALCANCE)
    MZ-->>ORO: celdas agrupadas por (fila, hoja, bloque)
    loop por cada bloque de cada fila
        alt la fila está en coincide
            ORO->>COR: paginas_con_texto(sha256)
            Note right of COR: caché de los últimos 4 PDFs
            COR-->>ORO: texto por página
            ORO->>VER: verificar_cita(cita, pag, paginas)
            VER-->>ORO: ResultadoCita
            ORO->>COR: fuente_texto(sha256, página)
            ORO->>ORO: veredicto del bloque
            opt hoja Tarifas y valor numérico
                ORO->>VER: verificar_valor_en_pagina(valor, texto)
            end
        else sin documento
            ORO->>ORO: veredicto = sin_documento
        end
        ORO->>ORO: copia el resultado a cada campo del bloque
    end
    ORO->>ORO: ordena por (fila, hoja, campo_key) y escribe set_de_oro.csv
    ORO-->>CLI: ruta del CSV
    CLI->>INF: escribir(set_de_oro.csv, resumen.md)
    INF-->>U: docs/informes/set-de-oro-resumen.md
```

## 7. Decisión del veredicto

Así decide `oro._veredicto` a partir del `ResultadoCita`, la fuente del texto y si el documento es un posible borrador.

```mermaid
flowchart TD
    A{¿La fila está en<br/>coincide?} -- no --> SD[sin_documento]
    A -- sí --> B{estado de la cita}
    B -- no_verificable --> SC[sin_cita]
    B -- sin_texto --> ST[sin_texto]
    B -- no_encontrada --> DU[dudosa]
    B -- pagina_invalida --> C{¿se encontró<br/>en otra página?}
    C -- no --> DU
    C -- sí --> RV[revisar]
    B -- pagina_ambigua o<br/>pagina_desplazada --> RV
    B -- pasa --> D{¿entre_paginas,<br/>capa OCR o<br/>posible borrador?}
    D -- sí --> RV
    D -- no --> OK[confiable]

    classDef bueno fill:#d4edda,stroke:#2e7d32
    classDef medio fill:#fff3cd,stroke:#b8860b
    classDef malo fill:#f8d7da,stroke:#b71c1c
    class OK bueno
    class RV medio
    class DU malo
```

## 8. Emparejamiento fila → PDF

Así decide `identidad.emparejar`. Nunca se sustituye por el acuerdo base ni por el más reciente.

```mermaid
flowchart TD
    A[Fila de la matriz] --> B[resolver_dane:<br/>código válido, sufijo o nombre]
    B --> C{¿El municipio tiene<br/>PDFs en el corpus?}
    C -- no --> SP[sin_pdf]
    C -- sí --> D[acuerdos_citados:<br/>leer número y año de la celda]
    D --> E{¿La celda nombra 2 o más<br/>acuerdos o decretos?}
    E -- sí --> VA[varios_acuerdos]
    E -- no --> G{¿Se leyó número y año?}
    G -- no --> SN[sin_numero_legible]
    G -- sí --> F{¿Hay un PDF con ese<br/>número y año exactos?}
    F -- no --> OA[otro_acuerdo]
    F -- sí --> CO[coincide<br/>+ marca posible_borrador]
```

## 9. Capas del frontend

El frontend (`web/`) está construido con datos simulados de estados financieros, y se adapta al dominio en el hito 2. Detalle en [frontend.md](frontend.md).

```mermaid
flowchart TD
    subgraph app[app/ · rutas, Server Components]
        E["(estudiante)/revision"]
        K["(coordinacion)/coordinacion"]
    end
    subgraph comp[components/ · Client Components]
        RV[revision/]
        CO[coordinacion/]
        PDF[pdf/ · visor PDF.js]
        UI[ui/ y shell/]
    end
    DATA[lib/data/index.ts<br/>único punto a cambiar por la API]
    MOCK[lib/mock/<br/>semilla fija]
    TYPES[lib/types.ts<br/>contrato de dominio]
    API[API futura]

    E --> DATA
    K --> DATA
    E --> RV
    K --> CO
    RV --> PDF
    RV --> UI
    CO --> UI
    DATA --> MOCK
    DATA -.-> API
    DATA --> TYPES
    RV --> TYPES
```

## 10. Secuencia de `extraer_bloque`

Así procesa `extractor.extraer_bloque` un bloque de un documento. Ningún bloque `ENCONTRADO` sale con una cita que el verificador no halló en el documento.

```mermaid
sequenceDiagram
    autonumber
    participant CO as corrida
    participant EX as extractor.extraer_bloque
    participant LO as localizar
    participant LL as llm.Cliente
    participant VE as verificacion

    CO->>EX: bloque, páginas del PDF, ejemplos, citas de referencia
    EX->>LO: ESTRATEGIAS[estrategia](páginas, citas_ref, palabras_clave)
    LO-->>EX: números de página de contexto
    EX->>EX: armar_mensajes(bloque, contexto, ejemplos)
    loop hasta 2 intentos
        EX->>LL: completar(mensajes)
        Note right of LL: caché en disco; si hay respuesta guardada no cuesta
        LL-->>EX: texto JSON y uso de tokens
        alt JSON inválido o cortado
            EX->>EX: pide de nuevo un JSON válido y más corto
        else NO_ENCONTRADO
            EX-->>CO: rojo, sin valores
        else ENCONTRADO
            EX->>VE: verificar_cita(cita, página, páginas)
            VE-->>EX: ResultadoCita
            opt la cita no aparece
                EX->>EX: pide copiarla literal o responder NO_ENCONTRADO
            end
        end
    end
    alt cita no hallada tras 2 intentos
        EX-->>CO: rojo, NO_ENCONTRADO
    else cita hallada
        EX->>VE: verificar_valor_en_pagina(valor, texto) por cada campo numérico
        VE-->>EX: pasa, alerta o falla
        EX-->>CO: Extraccion con semáforo verde o amarillo
    end
```
