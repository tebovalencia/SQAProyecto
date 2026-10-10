# Informe PDF de OT — especificación para clonar de forma idéntica

Documento de referencia para la **app de clientes** (u otra IA). El PDF de orden de trabajo **debe verse igual** al de esta app taller. No reinventar el layout: copiar el generador o reimplementarlo milímetro a milímetro.

**Última actualización:** 25 de agosto de 2026.

---

## 1. Cómo copiarlo (recomendado)

La fuente de verdad es este repositorio (app taller). **No hay un endpoint de PDF en PocketBase**: el PDF se genera 100 % en el cliente con `jspdf` + `jspdf-autotable`.

### Opción A — copiar código (preferida)

Copiar estos archivos (o extraerlos a un paquete compartido) y llamarlos igual:

| Archivo | Rol |
|---|---|
| `src/lib/pdf/otReport.ts` | Layout y dibujo (`exportOtPdf`) |
| `src/lib/pdf/logoCache.ts` | Logo embebido (JPEG/PNG, tamaño máx. 18×42 mm) |
| `src/lib/pdf/pdfOutput.ts` | `blob` + `filename` + object URL |
| `src/features/ordenes/downloadOtReport.ts` | Carga PocketBase + `sortDetalleTrabajos` |
| `src/lib/detalleTrabajoOrden.ts` | Orden de líneas de trabajo |
| `src/lib/otId.ts` | `displayOtId` → `idInterno` |
| `src/lib/format.ts` | `formatCurrency`, `formatDate`, `formatNumber` |
| `src/config/branding.ts` + runtime branding | Colores y textos de marca |

Librerías (mismas que el taller):

```json
"jspdf": "^4.2.1",
"jspdf-autotable": "^5.0.8"
```

API pública:

```ts
export async function exportOtPdf(data: OtReportData): Promise<{ blob: Blob; filename: string; url: string }>
```

Nombre de archivo: `OT-{idInterno}.pdf` (si no hay `idInterno`, `displayOtId` usa `—`).

### Opción B — reimplementar (Flutter / otra plataforma)

Seguir **sección 4** al milímetro. Mismos datos (sección 3), mismos textos, mismos vacíos `—`, mismos campos prohibidos.

---

## 2. Qué NO debe aparecer

El PDF **no** incluye:

- técnico (`detalleTrabajos.tecnicoId`)
- proveedor (`detalleTrabajos.proveedorId`)
- precios de compra
- `fechaEnvioOC` / `fechaRecepcionOC`
- fotografías, notas de voz, sede, usuario que creó la OT
- ubicación de bodega / proveedor de entrega de pedidos cliente

Sí incluye precios de **venta** de trabajos y repuestos, y el total.

---

## 3. Datos de entrada (`OtReportData`)

```ts
type OtReportData = {
  orden: OrdenTrabajo
  vehiculo?: Vehiculo | null
  cliente?: Cliente | null
  trabajos: DetalleTrabajo[]   // ordenados
  repuestos: DetalleRepuesto[]
  inventario: InventarioTaller[]
}
```

### Carga PocketBase (igual que el taller)

1. `ordenesTrabajo.getOne(otId, expand: 'vehiculoId.clienteId')`
2. `detalleTrabajos.getFullList({ filter: otId = "{id}", expand: 'trabajoId', sort: 'indice,created' })`
3. `detalleRepuestos.getFullList({ filter: otId = "{id}", expand: 'repuestoTallerId,repuestoClienteId' })`
4. `inventarioTaller.getFullList()` (fallback de nombre si no viene expand)

Si el expand de vehículo/cliente falta, cargar `vehiculos.getOne(vehiculoId, 'clienteId')` y `clientes.getOne(clienteId)`.

### Orden de trabajos

Ordenar con `sortDetalleTrabajos`:

1. `indice` numérico ascendente (1-based)
2. líneas sin `indice` al final
3. empate: `created` lexicográfico

El `#` de la tabla es **1..n del arreglo ya ordenado**, no el `indice` crudo.

### Etiquetas

| Concepto | Regla |
|---|---|
| N° OT | `orden.idInterno.trim()` o `—` |
| Descripción trabajo | `t.descripcion` \|\| `t.expand.trabajoId.descripcion` \|\| `—` |
| Precio trabajo | `formatCurrency(t.precioVenta)` |
| Nombre repuesto | 1) `expand.repuestoTallerId.nombreRepuesto` 2) `expand.repuestoClienteId.descripcion` 3) `descripcion` libre 4) lookup en `inventario` 5) `'Repuesto'` |
| Origen | `repuestoTallerId` → `Stock taller`; `repuestoClienteId` → `Cliente`; `descripcion` → `Compra rápida`; si no → `—` |
| Cantidad | `r.cantidad ?? 1` |
| P. unit. / subtotal | `precioVenta` y `precioVenta * cantidad` con `formatCurrency` |
| Total caja | Suma viva de líneas: trabajos + (precio × cant) de repuestos. No usar `orden.totalVenta` persistido (puede estar desfasado). |

### Formato (branding de instancia)

`formatCurrency` / `formatDate` / `formatNumber` usan locale, moneda e IANA del branding (`locale`, `currency`, `timeZone`). Defaults taller: `es-GT`, `GTQ`, `America/Guatemala`.

- `formatCurrency(null | NaN | 0)` → `—` (cero no se imprime como Q0.00)
- Fecha `YYYY-MM-DD` (con o sin hora): calendario **sin** convertir UTC; display `day: 2-digit, month: short, year: numeric`
- Fecha timestamp: `toLocaleDateString` con `timeZone` del branding
- Kilometraje: `formatNumber(km) + ' km'` o `—`
- Fecha de impresión: `formatDate(new Date().toISOString())` (timestamp, zona del branding)

Cargar branding igual que el taller: colección `branding` (1 registro), fallback `defaultBranding`. Colores del PDF:

| Token PDF | Campo branding |
|---|---|
| `primary` | `colorPrimary` |
| `headerBg` / `ink` | `colorSidebar` |
| `muted` | `colorSidebarMuted` |
| `line` | `colorBorder` |
| `softBg` | `colorTableHead` |
| texto subtítulo header | `colorSidebarText` |

Hex 3 o 6 dígitos → RGB.

### Logo

- Preferir `logoPdf` (archivo JPEG recomendado); si no, `logo` UI.
- Dibujar máx. **18 mm alto × 42 mm ancho**, manteniendo proporción.
- JPEG si mime/extensión jpg/jpeg; si no PNG.
- Si falla fetch/decode: continuar **sin** logo.

---

## 4. Layout (jsPDF)

### Documento

```ts
new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: 'letter',   // US Letter, no A4
  compress: true,
})
```

- `margin = 14`
- `pageW` / `pageH` = tamaño interno
- `contentW = pageW - 28`
- Fuente: **Helvetica** (built-in jsPDF). No usar otras fuentes.
- Salto de página: si `y + needed > pageH - 28` → `addPage()`, `y = margin + 4` (18 mm)

### 4.1 Banda de encabezado (todas las páginas: solo página 1)

- Rectángulo lleno `headerBg` de `(0,0)` a `(pageW, 28)`
- Franja `primary` de 1.2 mm de alto en `y = 28`
- Logo: `x = 14`, `y = (28 - drawH) / 2`
- Texto a la izquierda del logo: `textLeft = 14` o `14 + drawW + 4`

| Texto | Fuente | Tamaño | Color | Posición |
|---|---|---|---|---|
| `{brandLine1} {brandLine2}` | helvetica bold | 12 | blanco | `(textLeft, 12)` |
| `Informe de orden de trabajo` | helvetica normal | 8 | `sidebarText` | `(textLeft, 18)` |
| `OT N° {idInterno}` | helvetica bold | 11 | blanco | `(pageW - 14, 11)` align right |
| `{estadoFactura}` o `Sin estado` | helvetica normal | 8 | `primary` | `(pageW - 14, 17)` align right |
| `Impreso: {formatDate(ahora)}` | helvetica normal | 8 | `sidebarMuted` | `(pageW - 14, 22)` align right |

`y` inicial del cuerpo = **36**.

### 4.2 Título de sección (`sectionTitle`)

1. Label **MAYÚSCULAS**, helvetica bold 8, color `primary`, `x = 14`
2. `y += 2`
3. Línea `border` grosor 0.3 de `x=14` a `pageW-14`
4. `y += 5`

### 4.3 Par clave-valor (`kv`)

- Label: helvetica normal 7, `muted`, en `(x, y)`
- Valor: helvetica bold 9, `ink`, wrap `splitTextToSize` (`maxW` default 85 mm), en `(x, y+4)`
- Altura retornada: `4 + nLineas * 4`
- Vacío: `—`

### 4.4 Datos generales (2 columnas)

`sectionTitle('Datos generales')`

- Col1 `x = 14`
- Col2 `x = 14 + contentW/2 + 4`

Filas (altura = max de las dos celdas, luego `+2`; última `+ max(h,8) + 4`):

| Izquierda | Derecha |
|---|---|
| CLIENTE → `cliente.nombre` | VEHÍCULO → `marca modelo` (join espacio) |
| NIT / ID → `cliente.nit` | CÓDIGO INTERNO → `vehiculo.codigoInterno` |
| TELÉFONO → `cliente.telefono` | PLACA → `vehiculo.placa` |
| EMAIL → `cliente.email` | AÑO / COLOR → `anio · color` |
| DIRECCIÓN → `cliente.direccion` (`maxW` 90) | CHASIS → `vehiculo.nChasis` |

### 4.5 Meta (apertura / cierre / km)

Caja `roundedRect` `softBg`, `r=1.5`, alto **14 mm**, ancho `contentW`.

Tres columnas iguales. En cada una, `x = margin + metaW*i + 3`:

- Label helvetica 6 normal muted, `y = cajaY + 5`
- Valor helvetica 8 bold ink, `y = cajaY + 10`

Luego `y += 20`.

### 4.6 Solicitud

Solo si `descripcionSolicitud` trim no vacío.

`sectionTitle('Solicitud / diagnóstico')`  
Texto helvetica 9 normal ink, wrap `contentW`, line height **4.2 mm**, luego `y += n*4.2 + 4`.

### 4.7 Tabla trabajos

`ensureSpace(40)` + `sectionTitle('Trabajos realizados')`

autoTable:

- head: `#`, `Descripción`, `Precio`
- body: `[i+1, descripcion, formatCurrency(precioVenta)]`
- vacío: `['—', 'Sin trabajos registrados', '—']`
- `startY: y`, margin L/R 14
- styles: helvetica 8, cellPadding 2.2, textColor ink, lineColor border, lineWidth 0.2
- headStyles: fill `sidebar`, text blanco, bold, fontSize **7**
- alternateRowStyles: fill `tableHead`
- col 0: width 10, center; col 2: width 32, right

`y = lastAutoTable.finalY + 8`

### 4.8 Tabla repuestos

`ensureSpace(40)` + `sectionTitle('Repuestos utilizados')`

head: `#`, `Cant.`, `Descripción`, `Origen`, `P. unit.`, `Subtotal`

vacío: `['—', '—', 'Sin repuestos registrados', '—', '—', '—']`

columnStyles: 0→10 center, 1→14 center, 4→24 right, 5→26 right

Mismos styles que trabajos. `y = finalY + 8`

### 4.9 Caja de totales (derecha)

`ensureSpace(36)`

- Ancho 72 mm, `x = pageW - 14 - 72`
- `roundedRect` alto 28, r 1.5, fill `tableHead`
- Línea `primary` grosor **0.6** en `y+18` a lo ancho de la caja
- Filas: Trabajos (`y+6`), Repuestos (`y+12`) — helvetica 8, label muted, valor ink, valor align right `x+69`
- TOTAL (`y+24`) helvetica **10 bold**, ambos ink

`y += 34`

### 4.10 Comentarios

Solo si `comentarios` trim. Igual que solicitud, título `Comentarios / observaciones`, extra `+8` al final.

### 4.11 Firmas (siempre)

`ensureSpace(32)` luego `y = max(y, pageH - 42)` (pegar al pie).

Dos líneas `muted` grosor 0.3:

- izquierda: `x=14` a `14 + sigW`
- derecha: `14 + sigW + 10` a `pageW-14`
- `sigW = (contentW - 10) / 2`

Caption helvetica 7 muted, `y+5`:

- `Firma y nombre del cliente`
- `Firma {branding.appName}`

### 4.12 Pie en **todas** las páginas

Tras el contenido, loop `getNumberOfPages()`:

- línea `border` 0.3 en `y = pageH - 12`
- helvetica 7 muted: `appName` izquierda `(14, pageH-7)`
- `Página {p} de {pages}` derecha

El encabezado oscuro **no** se repite en páginas 2+.

---

## 5. Checklist de paridad visual

- [ ] Letter, no A4
- [ ] Helvetica only
- [ ] Header 28 mm + franja 1.2 mm primary
- [ ] `formatCurrency(0) === '—'`
- [ ] Trabajos ordenados por `indice`
- [ ] Origen de repuesto: Stock taller / Cliente / Compra rápida
- [ ] Sin técnico, proveedor ni fechas OC
- [ ] Filename `OT-{idInterno}.pdf`
- [ ] Colores desde colección `branding` (mismos hex que el taller)
- [ ] Logo PDF 18×42 mm max
- [ ] Firmas pegadas cerca del pie (`pageH - 42`)
- [ ] Footer en cada página

Comparar un PDF del taller y uno de la app clientes de la **misma OT**: mismas tablas, mismos `—`, mismo total.

---

## 6. Relación con la app clientes

La app clientes autenticará usuarios `rol = Cliente` contra la misma PocketBase. El PDF debe usar **los mismos registros** (`ordenesTrabajo`, `detalleTrabajos`, `detalleRepuestos`) y el **mismo branding**.

Si el portal no debe mostrar precios, **no** cambies este informe: es el documento de cierre del taller. Un PDF “sin precios” sería otro documento.

---

## 7. Código canónico (resumen de llamadas)

```ts
const data = await loadOtReportData(otId)   // ver downloadOtReport.ts
const { blob, filename, url } = await exportOtPdf(data)
// preview: iframe src=url
// descarga: <a download={filename}>
```

Implementación de dibujo: `src/lib/pdf/otReport.ts` función `exportOtPdf`.
