# Catálogo UniFi U7 y E7: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir al selector de modelos de Deconflict toda la gama Wi-Fi 7 de Ubiquiti (U7 y E7) que falta.

**Architecture:** Solo datos: nuevas entradas `ApModel` en `apps/web/src/lib/data/vendors/ubiquiti.ts`, con el formato existente, y un test de vitest que fija los valores y la integridad del catálogo.

**Tech Stack:** TypeScript, Vitest (ya configurado en `apps/web`, `include: src/**/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-11-20-ubiquiti-u7-e7-catalog-design.md`

## Global Constraints

- `ChannelWidth` solo admite `20 | 40 | 80 | 160 | 320`: los 240 MHz de la ficha en 5 GHz se registran como `160` (igual que los U7 existentes).
- 2.4 GHz siempre `maxChannelWidth: 40`; 6 GHz `320`.
- `maxTxPower` = "Max. TX Power" conducida de techspecs.ui.com. En 6 GHz con dos valores (E7: "24 dBm / 30 dBm"), el bajo (LPI, interior).
- Modelos con dos radios de 6 GHz (E7 Audience): una sola entrada `6ghz` con los flujos de una radio (4).
- Sin FCC ID inventado: comentario con la URL de la ficha y, en modelos con antena direccional, la nota "directional antenna, modelled as omni".
- `wifiStandard: 'WiFi 7'`, `vendor: 'Ubiquiti'`. Commits en inglés.

## Review Focus

1. Ids duplicados en `AP_MODELS`: rompen `findModel` (devuelve el primero). Test de unicidad global.
2. Bandas repetidas dentro de un modelo: `getBandSpec` cogería la primera. Test.
3. Anchos imposibles (2.4 > 40, 5 > 160): el tipo lo permite. Test por banda.
4. Modelos sin 2.4 GHz (E7 Audience): `getBandSpec(model, '2.4ghz')` debe caer a la última banda sin romper. Test.
5. Que los tres U7 existentes sigan coincidiendo con la ficha (verificados: coinciden; no se tocan).

---

### Task 1: Catálogo U7/E7 con test

**Files:**

- Create: `apps/web/src/lib/data/ap-models.test.ts`
- Modify: `apps/web/src/lib/data/vendors/ubiquiti.ts` (sección `// ─── WiFi 7`, tras `ubiquiti-u7-pro-wall`)

**Interfaces:**

- Consumes: `AP_MODELS`, `findModel(id)`, `getBandSpec(model, band)` de `apps/web/src/lib/data/ap-models.ts`.
- Produces: nada que use otra tarea.

**Valores (banda: anchoMáx / potencia dBm / flujos / alcance m):**

| id                          | modelo             | 2.4 GHz    | 5 GHz       | 6 GHz       | ficha              |
| --------------------------- | ------------------ | ---------- | ----------- | ----------- | ------------------ |
| ubiquiti-u7-lite            | U7 Lite            | 40/23/2/30 | 160/24/2/22 |             | u7-lite            |
| ubiquiti-u7-lr              | U7 Long-Range      | 40/26/2/45 | 160/27/3/35 |             | u7-lr              |
| ubiquiti-u7-pro-xg          | U7 Pro XG          | 40/23/2/35 | 160/26/2/28 | 320/24/2/18 | u7-pro-xg          |
| ubiquiti-u7-pro-xgs         | U7 Pro XGS         | 40/23/2/40 | 160/29/4/32 | 320/24/2/20 | u7-pro-xgs         |
| ubiquiti-u7-pro-xg-wall     | U7 Pro XG Wall     | 40/23/2/28 | 160/26/2/22 | 320/24/2/15 | u7-pro-xg-wall     |
| ubiquiti-u7-in-wall         | U7 In-Wall         | 40/23/2/25 | 160/24/2/20 |             | u7-iw              |
| ubiquiti-u7-mesh            | U7 Mesh            | 40/23/2/30 | 160/24/2/25 |             | u7-mesh            |
| ubiquiti-u7-outdoor         | U7 Outdoor         | 40/23/2/40 | 160/26/2/32 |             | u7-outdoor         |
| ubiquiti-u7-pro-outdoor     | U7 Pro Outdoor     | 40/23/2/40 | 160/26/2/32 | 320/26/2/22 | u7-pro-outdoor-us  |
| ubiquiti-u7-industrial      | U7 Industrial      | 40/23/2/40 | 160/24/2/30 |             | u7-industrial      |
| ubiquiti-e7                 | E7                 | 40/23/2/40 | 160/30/4/35 | 320/24/4/22 | e7                 |
| ubiquiti-e7-campus          | E7 Campus          | 40/23/2/45 | 160/30/4/38 | 320/30/4/25 | e7-campus-us       |
| ubiquiti-e7-audience        | E7 Audience        |            | 160/30/4/38 | 320/30/4/25 | e7-audience-us     |
| ubiquiti-e7-audience-indoor | E7 Audience Indoor |            | 160/30/4/38 | 320/30/4/25 | e7-audience-indoor |

Alcance (`typicalIndoorRange`): estimación propia en línea con los modelos existentes; el cálculo no lo usa.
Direccionales (nota en comentario): U7 Outdoor, U7 Pro Outdoor, U7 Industrial, E7 Campus, E7 Audience, E7 Audience Indoor.

- [ ] **Step 1: Escribir el test que falla**

`ap-models.test.ts` con:

- `it('has unique model ids')`: `new Set(AP_MODELS.map(m => m.id)).size === AP_MODELS.length`.
- `it('has no repeated band within a model')` y `it('keeps channel widths within band limits')` (2.4 ≤ 40, 5 ≤ 160, 6 ≤ 320), sobre todo `AP_MODELS`.
- `it.each(TABLA)('%s matches the Ubiquiti datasheet')`: `findModel(id)` definido, `vendor === 'Ubiquiti'`, `wifiStandard === 'WiFi 7'`, y `bands` igual (`toEqual`) a la fila de la tabla en orden 2.4, 5, 6.
- `it('falls back to the last band for models without 2.4 GHz')`: `getBandSpec(findModel('ubiquiti-e7-audience')!, '2.4ghz')?.band === '6ghz'`.

- [ ] **Step 2: Ver que falla**

Run: `pnpm --filter @deconflict/web test`
Expected: FAIL en los 14 casos de la tabla (`findModel` devuelve `undefined`); el resto pasa.

- [ ] **Step 3: Añadir las 14 entradas a `UBIQUITI_MODELS`**

Mismo formato y estilo de comentario que las entradas U7 existentes, en el orden de la tabla. Separar E7 con su propio rótulo `// ─── WiFi 7 Enterprise (E7)`. Actualizar el comentario de cabecera para indicar que los modelos nuevos no llevan FCC ID.

- [ ] **Step 4: Ver que pasa**

Run: `pnpm --filter @deconflict/web test`
Expected: PASS, todos.

- [ ] **Step 5: Checks del proyecto**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm format:check`
Expected: todo en verde.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/data docs/superpowers
git commit -m "feat(models): add full Ubiquiti U7 and E7 WiFi 7 lineup"
```
