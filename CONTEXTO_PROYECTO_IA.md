# Contexto del proyecto para agentes de IA

> Documento de referencia rápida para modificar la aplicación sin tener que explorar todo el repositorio.
> Última actualización: 25 de septiembre de 2026.

## 1. Propósito y stack

Aplicación SPA para la gestión de un taller automotriz: órdenes de trabajo (OT), vehículos, clientes, técnicos, proveedores, catálogo, inventario, repuestos de clientes, trabajos programados, reportes y PDF.

- React 19 + TypeScript estricto.
- Vite 8.
- Tailwind CSS 4 mediante `@tailwindcss/vite`.
- React Router DOM 7.
- PocketBase 0.27.
- `jspdf` + `jspdf-autotable`.
- Iconos con `lucide-react`.
- Alias de imports: `@/` apunta a `src/`.
- Idioma de interfaz y dominio: español.

El servidor Vite normalmente ya está ejecutándose en `$PORT` (por defecto 8443). No iniciar otro servidor si ya existe.

## 2. Comandos

```bash
npm run dev
npm run build
npm run preview
npm run format
npm test
npx tsc --noEmit
```

Hay pruebas Vitest de reglas puras (`npm test`). No hay script de lint. Antes de entregar cambios, ejecutar `npm test` y `npx tsc --noEmit` y, si el riesgo lo justifica, `npm run build`.

## 3. Archivos y arquitectura

```text
src/
  App.tsx                         Providers y rutas
  main.tsx                        Entrada React
  index.css                       Tailwind, fuentes y estilos globales
  auth/
    AuthContext.tsx               Sesión PocketBase y fallback demo
    devAccess.ts                  Acceso especial de programador
  components/
    layout/AppShell.tsx           Shell privado y header móvil
    layout/Sidebar.tsx            Navegación desktop/drawer móvil
    ui/                           Button, Modal, Field, Page, Badges
  config/
    branding.ts                   Marca, logos y colores
    BrandProvider.tsx             Variables CSS y título
    env.ts                        Variables Vite
  features/                       Pantallas por dominio
  lib/
    pocketbase.ts                 Cliente y health check
    format.ts                     Moneda, fechas y helpers
    otId.ts                       Identificador visible de OT
    cotizacionId.ts               Identificador visible de cotización
    vehiculo.ts                   Etiquetas estándar de vehículo
    pdf/otReport.ts               Generador PDF de OT
    pdf/cotizacionReport.ts       Generador PDF de cotización
  services/
    crud.ts                       CRUD genérico + fallback mock
    index.ts                      Registro de servicios/expands
    repuestosOt.ts                Reglas de stock en OT
    inventarioIngresos.ts         Ingresos y precios de inventario
    mock/data.ts                  Datos demo en memoria
  types/collections.ts            Tipos PocketBase
pb_schema.json                    Esquema exportado de PocketBase (copia canónica)
pb_hooks/integridad.pb.js         Hooks de stock, costo y totales (copiar al servidor PocketBase)
  pb_schema Automotriz valencia GT.json  Exportación de origen
```

No editar `dist/`, `node_modules/` ni archivos generados. No acceder directamente a PocketBase desde las pantallas: usar los servicios de `src/services/index.ts`.

## 4. Providers y rutas

Orden de providers en `src/App.tsx`:

1. `BrandProvider`
2. `AuthProvider`
3. `BrowserRouter`
4. `AppShell` para rutas privadas

Rutas:

| Ruta | Pantalla |
|---|---|
| `/login` | `features/auth/LoginPage.tsx` |
| `/` | `features/dashboard/DashboardPage.tsx` (solo Admin, `canSeeDashboard`) |
| `/ordenes` | `features/ordenes/OrdenesPage.tsx` |
| `/ordenes/:id` | `features/ordenes/OrdenDetallePage.tsx` |
| `/cotizaciones` | `features/cotizaciones/CotizacionesPage.tsx` (solo Admin) |
| `/cotizaciones/:id` | `features/cotizaciones/CotizacionDetallePage.tsx` (solo Admin) |
| `/bodega` | `features/bodega/BodegaPage.tsx` |
| `/vehiculos` | `features/vehiculos/VehiculosPage.tsx` |
| `/vehiculos/:id` | `features/vehiculos/VehiculoDetallePage.tsx` |
| `/clientes` | `features/clientes/ClientesPage.tsx` |
| `/proveedores` | `features/proveedores/ProveedoresPage.tsx` |
| `/tecnicos` | `features/tecnicos/TecnicosPage.tsx` |
| `/tecnicos/:id` | `features/tecnicos/TecnicoDetallePage.tsx` |
| `/catalogo` | `features/catalogo/CatalogoPage.tsx` |
| `/reportes` | `features/reportes/ReportesPage.tsx` |
| `/usuarios` | `features/usuarios/UsuariosPage.tsx` (solo Admin) |
| `/perfil` | `features/auth/PerfilPage.tsx` |
| `/configuracion` | `features/configuracion/ConfiguracionPage.tsx` |

`/configuracion` solo aparece y funciona para `evalencia@dataget.app`; la comprobación está en `src/auth/devAccess.ts`. Es una restricción frontend, no un permiso real del backend.

## 5. Autenticación y roles

`src/auth/AuthContext.tsx` + `src/auth/permissions.ts` + `src/auth/RequireAccess.tsx`:

- Autentica contra la colección auth `users` con `authWithPassword`.
- Restaura sesión con `authRefresh`.
- Expone `updateProfile` (avatar, correo, nombre) y `changePassword` (requiere `oldPassword` + confirmación) contra `users`.
- Campos de usuario: `rol` (select), `tecnicoId` → `tecnicos` (requerido para Registrador/Mecanico), `clienteId` → `clientes` (rol Cliente / portal futuro).
- Roles con acceso a esta app: **Admin**, **Registrador**, **Mecanico**. Otros (`Cliente`, `Contador`, `Secretario`, `Repuestos`, sin rol) ven pantalla **Sin acceso**. El rol **Cliente** está pensado para una app/portal independiente (no implementar aquí).
- Registrador/Mecanico: deben tener `tecnicoId` y el técnico una `sede`; filtran OTs `En Proceso` + `vehiculoId.sede`.
- Admin: control total + dashboard (`/`, `canSeeDashboard`) + CRUD de usuarios (`/usuarios`, `canManageUsers`) + módulo Cotizaciones (`/cotizaciones`, `canSeeCotizaciones`) con PDF. Solo Admin ve y edita el **estado de la OT** y las fechas de envío OC, recepción OC y facturación (`canSeeOtEstado`, `canChangeOtEstado`, `editEstadoOc`, acciones masivas `canBulkOtStatus`). En el detalle de OT, el panel **Resumen** completo (totales + estado/fechas OC) es solo Admin. Registrador y Mecánico no ven estado ni fechas OC; al crear OT el estado queda `En Proceso` por defecto. Registrador y Mecánico no ven el dashboard: al entrar van a `/ordenes` (`appHomePath`). Registrador: operaciones + bodega, sin Gestión ni precios; en trabajos de OT solo descripción (sin catálogo/proveedor/precio) y `tecnicoId` propio automático. Mecanico: OT parcial (km, trabajos manuales, pedidos cliente, comentarios, archivos), sin crear OT ni bodega.
- API rules de `users` en `pb_schema.json`: Admin puede listar/crear/editar/borrar; el propio usuario puede verse y editarse. **Aplicar esas rules en PocketBase** si el CRUD falla por permisos.
- Fallback demo: `admin@taller.local` / `admin123` o `demo` (rol Admin).
- La sesión mock se guarda en `sessionStorage`.
- Las mismas restricciones están copiadas en las API rules de `pb_schema.json` (rol y sede). Hay que importar ese esquema en PocketBase para que la API las aplique. Hasta entonces, la instancia en ejecución puede seguir con las reglas anteriores.

El fallback solo debe usarse cuando no hay URL, se fuerza mock o el backend no responde. No convertir errores reales de escritura en éxito silencioso.

## 6. Branding y entorno

Variables:

```env
VITE_POCKETBASE_URL=
VITE_FORCE_MOCK=false
```

No exponer el contenido real de `.env`.

Branding:

- Defaults en `src/config/branding.ts` (`defaultBranding`).
- Runtime desde colección PocketBase `branding` (1 registro), cargado por `BrandProvider` / `useBranding()`.
- Edición en `/configuracion` solo para `evalencia@dataget.app`.
- Guía de campos: `BRANDING_POCKETBASE.md`.
- Fallbacks de assets en `public/`: `logo.png`, `logo-pdf.jpg` si no hay archivos en PB.
- PDF usa `getActiveBranding()` + cache de logo en `src/lib/pdf/logoCache.ts`.

## 7. Colecciones PocketBase

### `clientes`

Campos: `nombre`, `telefono`, `email`, `nit`, `direccion`.

### `vehiculos`

Campos: `codigoInterno`, `placa`, `marca`, `modelo`, `anio`, `color`, `nChasis`, `nMotor`, `sede`, `clienteId`.

- `clienteId` → `clientes`.
- `codigoInterno` es el identificador principal del negocio.
- `anio` es `number` en PocketBase; parsear con `parseAnio()` al guardar.
- `sede` es texto con el nombre de la sede; el catálogo vive en la colección `sedes` (CRUD en `/configuracion`). Fallback local: `DEFAULT_SEDES` en `src/lib/vehiculo.ts`. Selectores vía `SedeSelect` / `useSedes()`.
- **PocketBase:** convertir `vehiculos.sede` y `tecnicos.sede` de select → text (ver `SEDES_POCKETBASE.md`).
- Mostrar siempre código primero y placa después usando `src/lib/vehiculo.ts`.

### `ordenesTrabajo`

Campos principales: `idInterno`, `vehiculoId`, fechas de apertura/cierre, kilometraje, solicitud, comentarios, adjuntos, totales, fechas OC (`fechaEnvioOC`, `fechaRecepcionOC`), `fechaFacturacion`, `estadoFactura`, `creadaPor`.

- `vehiculoId` → `vehiculos`.
- `creadaPor` → `users`.
- `estadoFactura` es un nombre legado: representa el estado completo de la OT.
- **PocketBase:** agregar date `fechaFacturacion` en `ordenesTrabajo` si aún no existe (para ordenar la vista Facturada).

### `cotizaciones`

Campos: `idInterno`, `fecha`, `fechaValidez`, `estado`, `clienteId`, `vehiculoId`, `clienteNombre`, `clienteTelefono`, `vehiculoLabel`, `kilometraje`, `descripcion`, `notas`, `totalVenta`, `creadaPor`.

- `idInterno` único: `COT` + `YYYYMM` + correlativo 3 dígitos (ej. `COT202607001`).
- Cliente/vehículo pueden ser relación o texto libre (`clienteNombre` / `vehiculoLabel`).
- Estados: `borrador`, `enviada`, `aceptada`, `rechazada`, `vencida`.
- Solo Admin (`canSeeCotizaciones`). Guía de alta en PocketBase: `COTIZACIONES_POCKETBASE.md`.

### `branding`

Singleton (un registro). Campos de identidad (`brandLine1`, `brandLine2`, `appName`, `tagline`, `defaultUserInitials`), archivos `logo` / `logoPdf`, y colores `colorPrimary`, `colorSidebar`, etc. (hex). Detalle: `BRANDING_POCKETBASE.md`.

### `detalleCotizaciones`

Campos: `cotizacionId`, `tipo` (`trabajo` | `repuesto`), `descripcion`, `cantidad`, `precioUnitario`, `indice`, `trabajoId` (opcional → `catalogoTrabajos`).

- `cotizacionId` → `cotizaciones` con cascade delete.
- `indice` (1-based) ordena líneas en UI y PDF.

### `detalleTrabajos`

Campos: `otId`, `trabajoId`, `descripcion`, `tecnicoId`, `proveedorId`, `precioCompra`, `precioVenta`, `indice`.

- Relaciones a OT, catálogo, técnico y proveedor.
- Puede ser línea manual o provenir del catálogo.
- `indice` (number, 1-based) controla el orden en la OT y en el PDF; se reordena por drag-and-drop en el detalle.

### `detalleRepuestos`

Campos: `otId`, `cantidad`, `repuestoTallerId`, `repuestoClienteId`, `descripcion`, `precioVenta`.

- Una línea usa repuesto del taller, del cliente, o **compra rápida** (`descripcion` + precio manual, sin relaciones).
- `precioCompra` guarda el costo del inventario al asignar la línea. El total de compra no sigue el precio actual del catálogo. Líneas antiguas sin ese campo siguen usando el costo del inventario como respaldo.
- Las mutaciones de taller/cliente tienen efectos sobre stock/estado y no deben tratarse como CRUD simple.
- Con PocketBase activo, el stock y los totales de la OT los aplica `pb_hooks/integridad.pb.js` en la misma transacción. El cliente no vuelve a calcular el stock final. En modo mock el ajuste sigue en `src/services/repuestosOt.ts`.

### `catalogoTrabajos`

Campos: `codigoTrabajo`, `descripcion`, `precio`.

### `tecnicos`

Campos: `idInterno`, `nombre`, fechas, seguro social, sueldo, vacaciones, `estado` (bool: activo/inactivo), `sede` (mismas opciones que `vehiculos.sede`), `fotografia` (imagen), `documentoIdentidad` (PDF), `documentoSeguroSocial` (PDF).

- `estado = true` → activo y asignable en detalle de OT.
- `estado = false` → inactivo; no aparece en el selector de trabajos (salvo si ya estaba asignado a la línea).
- `sede` restringe las OTs visibles para usuarios Registrador/Mecanico vinculados vía `users.tecnicoId` (mismo catálogo `sedes`).
- Alta de archivos en PocketBase: `TECNICOS_ARCHIVOS_POCKETBASE.md`.
- Detalle (`/tecnicos/:id`): pestañas **Ficha** (datos + foto + PDFs) y **Operaciones** (listado paginado 20, columna fecha = `fechaApertura` de la OT o `created` de la línea). **Total venta asignada** suma `precioVenta` de líneas cuyo mes (zona branding) coincide con el selector; por defecto el mes actual. Gráfico lineal de 6 meses (`LineSparkline`) en la tarjeta, escala 0–máximo del técnico; clic en un punto cambia el mes.

### `sedes`

Campos: `nombre`, `activo`, `orden`. Catálogo SaaS de sucursales. Edición en `/configuracion` (`evalencia@dataget.app`). Docs: `SEDES_POCKETBASE.md`.

### `users` (auth)

Campos relevantes: `email`, `name`, `avatar`, `rol` (`Admin` | `Registrador` | `Mecanico` | `Cliente` | `Contador` | `Secretario` | `Repuestos`), `tecnicoId` → `tecnicos`, `clienteId` → `clientes`.

CRUD Admin en `/usuarios`: alta/edición/baja, cambio de rol y de relaciones `tecnicoId` / `clienteId`, opcional reset de contraseña.

### `proveedores`

Campos: `nombre`, `direccion`, `contacto`, `telefono`, `nit`.

### `inventarioTaller`

Campos: `nombreRepuesto`, `numeroParte`, `ubicacionBodega`, `precioCompra`, `precioVenta`, `stockActual`.

### `movimientosInventarioTaller`

Campos: `inventarioId`, `cantidadIngreso`, `comentarios`, `userId`, `precioCompra`, `precioVenta`.

- `inventarioId` → `inventarioTaller`.
- `userId` → `users`.

### `repuestosCliente`

Campos: `vehiculoId`, `descripcion`, `estado`, fechas, proveedor, ubicación, `kilometraje`, `otSolicitudId` y `otInstalacionId`.

- `kilometraje` → número (km al solicitar/registrar el repuesto). En pedidos desde OT se toma de `orden.kilometraje` al crear.
- `otSolicitudId` → OT desde la que se pidió el repuesto al cliente (pedido).
- `otInstalacionId` → OT donde se instaló.

Estados: `solicitado`, `recibido`, `instalado`.

En `/bodega` → tab Repuestos clientes: búsqueda, orden por vehículo/estado/solicitud, paginación server-side (máx. 50; por defecto `solicitado` primero), recepción masiva (misma fecha + mismo proveedor → `estado = recibido`). Columna y campo de formulario `kilometraje`.

En `/vehiculos/:id` → tab Repuestos: alta/edición/baja de `repuestosCliente` del vehículo (mismo modelo de campos que bodega; `vehiculoId` fijo).

En detalle de OT → Pedidos al cliente: al crear se persiste `orden.kilometraje`; en edición se muestra el km guardado (solo lectura).

### `trabajosProgramados`

Campos: `vehiculoId`, `trabajoId`, `descripcion`, `fechaSugerida`, `estado`, `ordenTrabajoProgramado`, `ordenTrabajoAtendido`.

- `ordenTrabajoProgramado` → OT donde se programó o asignó el trabajo.
- `ordenTrabajoAtendido` → OT donde se marcó como `realizado`.
- En detalle de OT se listan todos los programados del vehículo; al agregar se setea `ordenTrabajoProgramado`; al pulsar **Realizado** se setea `estado = realizado` y `ordenTrabajoAtendido`.

Estados: `pendiente`, `realizado`.

## 8. Reglas de negocio críticas

### Identificador de OT

- Formato visible: `YYYYMM` + correlativo mensual de 3 dígitos, por ejemplo `202607001`.
- Se genera en `src/lib/otId.ts` (también editable manualmente en el formulario).
- Mostrar con `displayOtId()`, nunca con el ID interno de PocketBase.
- En PocketBase `idInterno` tiene índice único (`idx_rt5e6btjar`).
- El frontend valida unicidad con `assertIdInternoDisponible()` antes de create/update.
- Si el N° fue generado y el índice único rechaza el alta, `createOrdenRetryingId()` pide otro correlativo y reintenta. Un N° escrito a mano no se sustituye.

### Estados de OT

```text
En Proceso
Terminada
Esperando OC
OC Recibida
Facturada
```

Una OT activa es aquella que no está `Terminada` ni `Facturada`.

Al cambiar estado a `Terminada`, se asigna `fechaCierre` = hoy (`patchFechaCierrePorEstado` en `src/lib/otFechaCierre.ts`). Al volver a `En Proceso`, se limpia `fechaCierre`.

### Totales de OT

- Trabajos: suma de `precioVenta` (vacío / no numérico = 0). Helper: `src/lib/otTotales.ts`.
- Repuestos: `precioVenta × cantidad`.
- Costo de repuestos de taller: `precioCompra` de la línea × cantidad.
- `totalVenta` = trabajos + repuestos.
- Persistir además `totalVentaRepuestos` y `totalCompraRepuestos`.
- Con backend, el hook recalcula esos tres campos al crear, editar o borrar líneas de trabajo o de repuesto. En mock los recalcula el cliente.
- El recálculo aplica en cualquier estado de la OT (también cerrada / facturada).
- El PDF de OT suma las líneas actuales; no usa un `totalVenta` desactualizado.

### Stock de repuestos del taller

La regla vive en `src/lib/stockDelta.ts` y, en el servidor, en `pb_hooks/integridad.pb.js`:

- Asignar a OT descuenta stock.
- Aumentar cantidad descuenta la diferencia.
- Reducir cantidad restaura la diferencia.
- Cambiar origen o eliminar restaura el stock anterior.
- Nunca permitir stock negativo. El update es `stockActual = stockActual + delta` con la condición `>= 0`.
- Seleccionar inventario copia su precio de venta y el `precioCompra` del momento a la línea.

Hay que copiar `pb_hooks/` junto al ejecutable de PocketBase y reiniciar. Sin ese hook, el cliente no ajusta el stock cuando el backend responde. El modo mock sí lo ajusta en `src/services/repuestosOt.ts`.

No modificar esta lógica sin conservar todas las compensaciones.

### Repuestos del cliente

- Cantidad fija: 1.
- Precio: 0.
- Desde el detalle de OT se pueden crear pedidos (`estado = solicitado`, `otSolicitudId` = OT actual, vehículo de la OT, `fechaSolicitud` = hoy).
- En la pestaña Repuestos también se muestra el **historial pendiente del vehículo** (solo lectura para Admin, Registrador y Mecánico): `repuestosCliente` del mismo `vehiculoId` con `estado` `solicitado` o `recibido` y `fechaSolicitud` de **ayer o antes** (los de hoy solo en «Pedidos al cliente» de su OT).
- Al asignarlos a una OT pasan a `instalado` y guardan `otInstalacionId`.
- Al liberarlos vuelven a `recibido` si hay fecha de recepción; si no, a `solicitado`.
- No pueden reutilizarse mientras están instalados.
- Deben corresponder al vehículo de la OT.

### Compra rápida (repuesto manual en OT)

- Origen `Compra rápida` en detalle de OT: texto libre en `detalleRepuestos.descripcion`.
- Sin `repuestoTallerId` ni `repuestoClienteId`; no mueve inventario ni estados de cliente.
- Cantidad y `precioVenta` editables (precio según permisos Admin).
- PDF etiqueta el origen como «Compra rápida».

### Ingresos de inventario

`src/services/inventarioIngresos.ts`:

- Crea un movimiento de inventario.
- Aumenta `stockActual` y actualiza precios de compra y venta.
- Con backend, ese ajuste lo hace el hook en la misma transacción que el movimiento.
- Precio de venta sugerido: precio de compra + 38%, redondeado.
- Cantidad debe ser positiva y precios no negativos.

### Catálogo

Seleccionar un trabajo copia descripción y precio sugerido, pero ambos pueden editarse luego.

## 9. Convenciones de interfaz

- Mantener la UI y textos en español.
- Reutilizar `src/components/ui/*`.
- Usar utilidades Tailwind en JSX; no crear PostCSS.
- Usar variables `--brand-*`, no duplicar colores de marca.
- Mantener el diseño responsive mobile-first.
- Tablas deben conservar `overflow-x-auto`.
- Formularios: 1 columna en móvil y 2 desde `sm` cuando corresponda.
- Detalles: contenido apilado en móvil y panel lateral desde `lg`.
- Modal: bottom sheet en móvil, centrado desde `sm`.
- `codigoInterno` del vehículo tiene mayor protagonismo que la placa.
- Mostrar vehículos con `displayVehiculo()` o `displayVehiculoFull()`.
- Moneda y fechas usan `src/lib/format.ts` (locale `es-GT`, moneda Quetzales `GTQ`).
- `formatCurrency(0)` devuelve `—`.

## 10. Pantallas implementadas

- Dashboard: KPIs (producción del mes = suma de `totalVenta` de OTs con `fechaCierre` en el mes actual; OTs activas = `En Proceso`; órdenes terminadas; esperando OC; repuestos cliente pendientes) y lista de trabajos programados solo `pendiente`.
- Órdenes: listado paginado (50). Orden por defecto según filtro: `En Proceso`/`Terminada`/`Todos` → `-fechaApertura`; `Esperando OC` → `-fechaEnvioOC`; `OC Recibida` → `-fechaRecepcionOC`; `Facturada` → `-fechaFacturacion`. La columna de fecha del listado cambia con el filtro. Filtro por estado (default `En Proceso`; `Todos` al final), búsqueda por N° OT / código vehículo / cliente / descripción; alta, edición, eliminación y PDF (preview modal + descarga). El alta (**Nueva orden de trabajo**) no pide fecha de cierre, estado, fechas OC/facturación ni comentarios (estado inicial `En Proceso`). Selección masiva: checkboxes (Admin) para **Exportar PDF** en ZIP (`OTs_YYYY-MM-DD.zip`, un PDF por OT); por filtro de estado también: `Terminada` → **Enviar para OC** (`Esperando OC` + `fechaEnvioOC` = hoy); `Esperando OC` → **Marcar OC recibida** (`OC Recibida` + `fechaRecepcionOC` = hoy); `OC Recibida` → **Marcar facturada** (`Facturada` + `fechaFacturacion` = hoy). Selector de vehículo con búsqueda; carga de fotografías (`fotografias`) y notas de voz (`notasVoz`), incluyendo grabación desde el micrófono del navegador.
- Cotizaciones (solo Admin): listado, alta, detalle con líneas trabajo/repuesto, total recalculado y export PDF (`COT-{idInterno}.pdf`).
- Detalle OT: trabajos, repuestos (pedidos al cliente vía `otSolicitudId`), trabajos programados del vehículo (`ordenTrabajoProgramado` / `ordenTrabajoAtendido`), notas, archivos multimedia (pestaña **Archivos**: ver/agregar/eliminar `fotografias` y `notasVoz`, con grabación de micrófono; visor interno `MediaLightbox` para ampliar fotos/video sin abrir pestaña nueva), estado, OC, stock y totales.
- Bodega: inventario, ingresos e inventario/repuestos de clientes.
- Vehículos: CRUD y ficha con OTs, detalle de trabajos (carga diferida al abrir la pestaña, con búsqueda), repuestos y trabajos programados.
- Técnicos: CRUD (incluye activo/inactivo) y ficha con pestañas ficha/operaciones, venta del mes, paginación y archivos (foto + PDFs).
- Clientes, proveedores y catálogo: CRUD.
- Reportes: métricas operativas, OTs de mayor valor, búsqueda de trabajos por descripción (`detalleTrabajos` + OT + vehículo + cliente; columnas: trabajo, código, cliente, km, N° OT, fechas, estado; filtros: rango `fechaApertura`, cliente; export Excel; Admin todas las sedes, resto por sede) y exportación Excel de OTs enviadas a OC (filtro por rango de `fechaEnvioOC`; columnas: N° OT, código vehículo, fecha apertura, detalle de trabajos concatenado, total venta, fecha envío OC). Helpers: `src/lib/reportes/trabajosPorDescripcion.ts`, `src/lib/excel/trabajosPorDescripcionReport.ts`.
- Perfil (`/perfil`): edición de avatar, nombre, correo y contraseña del usuario autenticado.
- Configuración: branding, región/moneda, CRUD de sedes, conexión y sesión (solo `evalencia@dataget.app`).

No hay pantallas detalle de clientes o proveedores.

## 11. PDF de OT y cotización

### OT

Archivos:

- `src/features/ordenes/downloadOtReport.ts`
- `src/lib/pdf/otReport.ts`

Incluye cliente, vehículo, fechas, kilometraje, solicitud, trabajos, repuestos, totales, comentarios, firmas y paginación.

No debe exponer:

- técnico;
- proveedor;
- fechas internas de envío/recepción de OC.

El archivo se descarga como `OT-{idInterno}.pdf`.

Especificación para clonar el PDF **idéntico** en la app de clientes: `PDF_OT_REPORTE.md`.

### Cotización

Archivo: `src/lib/pdf/cotizacionReport.ts` (`exportCotizacionPdf`).

Incluye cliente, vehículo, fechas, validez, descripción, líneas (trabajos/repuestos), total y notas. Descarga: `COT-{idInterno}.pdf`.

## 12. Servicios y mock

`src/services/crud.ts` ofrece:

- `list`
- `getFullList`
- `getOne`
- `create`
- `update`
- `remove`

Consideraciones:

- Cachea la salud del backend durante 30 segundos.
- Un 401, 403 o 404 de lectura se propaga. Otras fallas de lectura pueden pasar a mock.
- El filtro mock solo soporta una expresión simple `campo = "valor"` o `campo ~ "texto"`.
- `getFullList` usa `batch` 200 (no 500–1000 del SDK) y admite `fields` para recortar payload.
- No usar `getFullList` de `ordenesTrabajo` sin filtro para unir datos: expandir relaciones (`otId.vehiculoId`) o paginar.
- Conteos KPI: `list({ page: 1, perPage: 1, fields: 'id' })` y `totalItems` (no bajar toda la colección).
- `getFullList` mock está limitado a 500 registros.
- Las mutaciones mock no persisten.
- Evitar mezclar visualmente datos reales y demo.

## 13. Riesgos conocidos

1. Las API rules por rol y sede están en `pb_schema.json`, pero solo aplican después de importarlas en la instancia de PocketBase. `_superusers` sigue con reglas `null` (solo superusuario). `branding` mantiene lectura pública para la pantalla de login; la escritura sigue limitada a `evalencia@dataget.app`. `sedes` exige sesión para leer.
2. Stock, costo y totales de OT dependen del hook `pb_hooks/integridad.pb.js`. Hay que copiarlo al servidor y reiniciar. Si el hook no está instalado y el backend responde, el cliente no compensa el stock.
3. El correlativo generado reintenta ante el índice único. Dos altas simultáneas con un N° escrito a mano siguen pudiendo chocar; el segundo recibe el error y no se reescribe el número.
4. Líneas de repuesto creadas antes de `precioCompra` no tienen costo histórico; el total de compra usa el precio actual del inventario solo en ese caso.
5. Hay divergencias entre esquema y tipos: `tecnicos.ultimaVacaciones` (text en PB, UI de fecha) y archivos múltiples (`string` vs `string[]`).
6. Borrar cliente, vehículo, técnico, proveedor o trabajo de catálogo consulta dependencias y se bloquea si existen. `detalleTrabajos.otId`, `detalleRepuestos.otId` y `detalleCotizaciones.cotizacionId` ya tienen `cascadeDelete`. No hay cascade en `vehiculos.clienteId` ni en `ordenesTrabajo.vehiculoId`.
7. Los selectores de vehículos, inventario y catálogo siguen cargando el catálogo en el cliente. Las órdenes del dashboard, reportes, ficha de vehículo y exportación OC se piden filtradas o por páginas. El listado de órdenes en modo mock aún junta la colección en memoria para la búsqueda.
8. Hay Vitest para totales, correlativo, permisos, stock y fechas (`npm test`). `errorMessage()` traduce errores de PocketBase en las pantallas que mutan datos. Un 401, 403 o 404 de lectura no cae al mock.
9. Fechas de calendario (`fechaApertura`, etc.) se manejan como `YYYY-MM-DD` local vía `extractDateOnly` / `parseLocalDate` / `todayISO` en `format.ts` (sin `toISOString()`), para evitar el desfase UTC−1 día en Guatemala.
10. Adjuntos multimedia de OT (`fotografias`, `notasVoz`) se gestionan en el formulario de OT y en la pestaña **Archivos** del detalle. Aún no hay transcripción de audio a texto.
11. El logo del PDF usa `import.meta.env.BASE_URL` para funcionar bajo una subruta.
12. React `StrictMode` puede ejecutar efectos dos veces en desarrollo. No es un defecto de producción.
13. Los roles también están en las API rules del esquema. Contador, Cliente y el resto siguen sin acceso a la app. Hay que comprobar en PocketBase, con un usuario Mecánico, que la API no lista órdenes de otra sede ni cambia el estado.

## 14. Reglas para cualquier modificación

1. Leer este documento antes de explorar el proyecto.
2. Verificar solo los archivos directamente relacionados con la tarea.
3. No renombrar campos PocketBase sin migración de esquema.
4. No renombrar `estadoFactura`; es legado compatible con backend.
5. No romper compensaciones de stock ni estados de repuestos.
6. No escribir directamente en PocketBase desde una pantalla.
7. No editar `.env`, `dist/` o `node_modules/`.
8. No crear commits salvo petición explícita.
9. Actualizar este documento si cambia arquitectura, rutas, colecciones o reglas de negocio.
10. Verificar TypeScript y el flujo afectado antes de finalizar.

## 15. Checklist de entrega

- [ ] Mantiene textos en español y branding por variables.
- [ ] Funciona en móvil y escritorio.
- [ ] Usa servicios y componentes compartidos.
- [ ] Preserva `idInterno` de OT y código interno de vehículo.
- [ ] Si toca repuestos, stock y estados quedan consistentes.
- [ ] Si toca líneas de OT, recalcula totales.
- [ ] Si cambia PocketBase, actualiza tipos y `pb_schema.json`.
- [ ] Ejecuta `npm test` y `npx tsc --noEmit`.
- [ ] Ejecuta `npm run build` en cambios de riesgo medio/alto.
- [ ] Actualiza este documento cuando corresponda.
