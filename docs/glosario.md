# Glosario

| Término | Significado |
|---|---|
| **ICA** | Impuesto de industria y comercio. Es municipal: cada concejo fija sus elementos, exenciones y tarifas por acuerdo |
| **Acuerdo municipal** | Norma del concejo municipal. Se identifica por número y año (p. ej. Acuerdo 012 de 2022). Puede ser el estatuto base o una modificación |
| **Estatuto tributario** | Acuerdo que reúne todos los tributos del municipio. Suele ser el documento base |
| **DANE / DIVIPOLA** | Código de 5 dígitos de cada municipio (2 de departamento y 3 de municipio). La lista oficial es DIVIPOLA (`referencias/DIVIPOLA-…xlsx`) |
| **Matriz ICA** | Excel del equipo de investigación (UTS, DIE-PI-001-126): una fila por municipio y acuerdo, unas 850 columnas en 13 temas. Ver [matriz-ica-diagnostico.md](datos/matriz-ica-diagnostico.md) |
| **Hoja** | Tema de la matriz: Elementos del tributo, Actividades no sujetas, Tarifas... El alcance actual son esas tres, más la identificación de `Principios` |
| **Bloque** | Grupo de columnas de una hoja que responden a un mismo artículo: `Art.`, `Pág.`, `Definición` (la cita) y sus casillas. Es la unidad de verificación |
| **Campo** | Una columna de dato dentro de un bloque: una casilla Sí/No, un número o un texto |
| **Rol** | Función de una columna: `art`, `pag`, `cita`, `presencia` o `campo` |
| **Cita** | Texto literal del acuerdo que respalda el dato (columna `Definición`) |
| **Folio / `Pág.`** | Página del PDF donde está la cita. En este proyecto es el **índice de página del PDF** (base 1), no el número impreso |
| **Desfase** | Diferencia entre la página anotada y la página donde de verdad está la cita. Un desfase constante en un documento suele venir de la portada o de los índices |
| **Corpus** | Conjunto de PDFs únicos (por sha256) con nombre estándar `DANE_Tipo_Número_Año.pdf` |
| **sha256** | Huella del contenido del PDF. Dos archivos con el mismo sha256 son el mismo documento |
| **Página digital / capa OCR / escaneada** | Digital: texto nativo del PDF. Capa OCR: imagen con un texto que alguien ya reconoció antes (menos confiable). Escaneada: solo imagen, sin texto |
| **Emparejamiento** | Asignar a cada fila de la matriz el PDF del acuerdo que cita (mismo número y año) |
| **Posible borrador** | PDF que el equipo marcó como proyecto de acuerdo, no como acuerdo aprobado |
| **Catálogo** | Lista de bloques y campos, con tipo, valores permitidos y criterio (`motor/catalogo/variables.yaml`). Lo aprueba el equipo de contaduría |
| **Set de oro** | Los datos de la matriz cuya cita se comprobó en el PDF. Es la referencia para medir el motor de extracción |
| **Veredicto** | Clasificación de cada dato del set de oro: `confiable`, `revisar`, `dudosa`, `sin_texto`, `sin_cita` o `sin_documento`. Ver [motor.md](arquitectura/motor.md#veredicto-de-cada-dato-oropy) |
| **`UMBRAL_CITA`** | Similitud mínima (90 sobre 100) para dar una cita por encontrada |
| **Semáforo** | Verde, amarillo o rojo en la interfaz de revisión. Equivale más o menos a `confiable`, `revisar` y `dudosa` |
| **UTS** | Unidades Tecnológicas de Santander. Su programa de Contaduría Pública es dueño del proyecto de investigación |
