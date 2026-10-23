# Pipeline de extracción verificable de PDF contables

Sistema para extraer 30–40 variables de ~1.200 estados financieros municipales (PDF de ~200 páginas, parte escaneados) sin inventar datos: **ningún valor llega al estudiante sin la cita literal y el folio de donde salió**; si no se encuentra, se marca `NO_ENCONTRADO`.

Responsables: Santiago Afanador Aguello y Mariana Acero. Ficha técnica completa: [`ficha.txt`](ficha.txt) / [`ficha-tecnica-v4.pdf`](ficha-tecnica-v4.pdf).

## Estado

| Parte | Estado |
|---|---|
| Frontend (`web/`) | **Construido con datos simulados.** Todas las pantallas de estudiante y coordinación. |
| API y cola (NestJS + BullMQ) | Pendiente |
| OCR (PaddleOCR en Modal) | Pendiente |
| Extracción (reglas + DeepSeek) y verificación | Pendiente |
| Base de datos (Supabase) | Pendiente |

Todo dato visible en la interfaz es de demostración: municipios ficticios, cifras inventadas, marcado como DEMO.

## Empezar

```bash
cd web
npm install
npm run dev
```

Abra http://localhost:3000 y elija rol en la entrada. Para ver la revisión completa use los documentos `doc-0001`, `doc-0002` y `doc-0003`, que traen PDF sintético con fallas inyectadas a propósito.

## Estructura

```
.
├── ficha.txt / ficha-tecnica-v4.pdf   Ficha técnica (v4)
├── PRODUCT.md                         Usuarios, propósito, principios
├── DESIGN.md                          Sistema visual (tokens, componentes, reglas)
├── docs/
│   ├── arquitectura-frontend.md       Cómo está organizado el front y por qué
│   └── integracion-backend.md         Contrato de datos y endpoints sugeridos
└── web/                               App Next.js (ver web/README.md)
```

## Documentación

- [web/README.md](web/README.md): scripts, pantallas, atajos de teclado.
- [docs/arquitectura-frontend.md](docs/arquitectura-frontend.md): capas, flujo de revisión, decisiones.
- [docs/integracion-backend.md](docs/integracion-backend.md): qué debe devolver cada etapa del pipeline para conectar la interfaz.
- [PRODUCT.md](PRODUCT.md) y [DESIGN.md](DESIGN.md): contexto de producto y sistema de diseño.

## Alcance acordado

- Solo escritorio/portátil (sin layout móvil).
- Interfaz en español de Colombia; cifras en pesos con formato colombiano.
- "Folio" es un nombre de trabajo.
