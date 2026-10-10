# Cotizaciones — colecciones PocketBase

Crea estas **2 colecciones** en el Admin de PocketBase (API rules: autenticados, o restringe a `@request.auth.rol = "Admin"` si ya usas ese campo).

---

## 1. Colección `cotizaciones` (base)

| Campo | Tipo | Opciones |
|---|---|---|
| `idInterno` | Text | required, unique index |
| `fecha` | Date | required |
| `fechaValidez` | Date | opcional |
| `estado` | Select | `borrador`, `enviada`, `aceptada`, `rechazada`, `vencida` |
| `clienteId` | Relation → `clientes` | max 1, opcional |
| `vehiculoId` | Relation → `vehiculos` | max 1, opcional |
| `clienteNombre` | Text | si no hay clienteId |
| `clienteTelefono` | Text | opcional |
| `vehiculoLabel` | Text | ej. placa/marca si no hay vehiculoId |
| `kilometraje` | Number | opcional |
| `descripcion` | Text / Editor | motivo / alcance |
| `notas` | Text / Editor | condiciones, vigencia, forma de pago |
| `totalVenta` | Number | total calculado |
| `creadaPor` | Relation → `users` | max 1, opcional |

**Índice único sugerido:**
```sql
CREATE UNIQUE INDEX idx_cotizaciones_idInterno ON cotizaciones (idInterno)
```

**Formato `idInterno`:** `COT` + `YYYYMM` + correlativo 3 dígitos → ej. `COT202607001`.

---

## 2. Colección `detalleCotizaciones` (base)

Líneas de la cotización (trabajos y repuestos).

| Campo | Tipo | Opciones |
|---|---|---|
| `cotizacionId` | Relation → `cotizaciones` | required, cascade delete |
| `tipo` | Select | `trabajo`, `repuesto` |
| `descripcion` | Text | required en la práctica |
| `cantidad` | Number | default 1, min 1 |
| `precioUnitario` | Number | precio de venta unitario |
| `indice` | Number | orden 1, 2, 3… |
| `trabajoId` | Relation → `catalogoTrabajos` | opcional (solo tipo trabajo) |

**Índice:**
```sql
CREATE INDEX idx_detalle_cotizaciones_cot ON detalleCotizaciones (cotizacionId)
```

---

## 3. API Rules (recomendado)

Para ambas colecciones:

- List / View / Create / Update / Delete: `@request.auth.rol = "Admin"`

(Si aún no puedes filtrar por `rol` en rules, deja `@request.auth.id != ""` y el frontend ya limita el módulo a Admin.)

---

## 4. Relación con la app

| Ruta | Uso |
|---|---|
| `/cotizaciones` | Listado |
| `/cotizaciones/:id` | Detalle, líneas, PDF |

Solo rol **Admin** (`canSeeCotizaciones`).
