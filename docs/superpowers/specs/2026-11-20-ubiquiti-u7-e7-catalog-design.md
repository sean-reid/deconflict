# Catálogo UniFi U7 y E7 en Deconflict (diseño corto)

## Intención

FISAT va a montar un centro nuevo con APs UniFi U7 y no puede usar UniFi
Design Center (exige login en ui.com y la política de empresa no lo permite).
Deconflict es libre (MIT), funciona entero en el navegador y ya trae
catálogo de Ubiquiti, pero solo con U7 Pro, U7 Pro Max y U7 Pro Wall. Se
quiere toda la gama Wi-Fi 7 de Ubiquiti en el selector de modelos.

## Objetivos

- Añadir a `apps/web/src/lib/data/vendors/ubiquiti.ts` los U7 que faltan
  (Lite, Long-Range, Pro XG, Pro XGS, Pro XG Wall, In-Wall, Outdoor, Pro
  Outdoor, Industrial) y la gama E7.
- Revisar contra la ficha técnica los tres U7 que ya están.

## No objetivos

- Modelar ganancia o diagrama de antena: el motor usa potencia conducida
  para todas las marcas. Los modelos de exterior con antena direccional se
  simulan como omnidireccionales.
- Cambios en la física, la UI o el resto de fabricantes.

## Enfoques

1. **Entradas de datos en `ubiquiti.ts` con el formato existente**
   (elegido): cambio mínimo, coherente con el resto del catálogo y fácil de
   llevar al proyecto original si algún día se quiere.
2. Añadir ganancia de antena (EIRP) al modelo de propagación: más realista,
   pero cambia los resultados de todas las marcas y diverge del original.
   Descartado.
3. Fichero de catálogo propio de FISAT aparte: separa los datos sin
   ventaja real, porque los modelos son genéricos de Ubiquiti. Descartado.

## Decisiones

- Fuente: techspecs.ui.com (máx. potencia TX, flujos MIMO y ancho de canal
  por banda), con el mismo estilo de comentario por entrada (FCC ID si se
  conoce y URL de la ficha).
- `typicalIndoorRange`: estimado en línea con los modelos existentes
  (decisión del implementador). El cálculo no lo usa; es informativo.
- Entrega: rama `feat/ubiquiti-u7-e7-catalog` en el fork
  `raulgonzalez-sys/deconflict`. Commits en inglés, como el repo.

## Verificación

`pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` en verde, más una
comprobación de que los ids son únicos y los valores coinciden con las fichas.
