# Sedes — colección PocketBase

Catálogo dinámico de sedes/sucursales usado en `vehiculos.sede` y `tecnicos.sede`.

---

## Colección `sedes` (base)

| Campo | Tipo | Notas |
|---|---|---|
| `nombre` | Text | requerido; único lógico (la app valida duplicados) |
| `activo` | Bool | default `true`; si `false` no aparece en selectores nuevos |
| `orden` | Number | orden de listado (menor primero) |

### API Rules (recomendado)

- **List / View:** `""` (público o autenticado) — necesario para selects en toda la app.
- **Create / Update / Delete:** `@request.auth.email = "evalencia@dataget.app"`

---

## Cambio obligatorio en `vehiculos` y `tecnicos`

Hoy `sede` es un **select** con valores fijos. Para aceptar sedes nuevas desde la colección:

1. En PocketBase, cambia el campo `sede` de **select → text** en:
   - colección `vehiculos`
   - colección `tecnicos`
2. Los valores existentes se conservan como texto.
3. Si dejas el select, PocketBase rechazará nombres que no estén en la lista del select.

---

## Uso en la app

- Carga al inicio vía `SedesProvider` / `useSedes()`.
- Selectores: componente `SedeSelect` (vehículos, técnicos).
- CRUD en `/configuracion` (solo `evalencia@dataget.app`).
- Renombrar una sede actualiza vehículos y técnicos con el nombre anterior.
- Eliminar falla si hay vehículos/técnicos usando esa sede (desactivar en su lugar).
- Fallback local si la colección no existe: Central, Huehuetenango, Quetzaltenango, Teculutan, Peten.
