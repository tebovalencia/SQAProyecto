# Branding — colección PocketBase

Crea **1 colección** `branding` (base). Debe existir **un solo registro** (la app usa el primero por `created`).

---

## Colección `branding`

### Identidad (Text)

| Campo | Tipo | Notas |
|---|---|---|
| `brandLine1` | Text | ej. AUTOMOTRIZ |
| `brandLine2` | Text | ej. VALENCIA |
| `appName` | Text | nombre comercial / título |
| `tagline` | Text | subtítulo login |
| `defaultUserInitials` | Text | fallback avatar (ej. AV) |

### Región y moneda (Text)

| Campo | Tipo | Notas |
|---|---|---|
| `locale` | Text | BCP 47, ej. `es-GT` (fechas y números) |
| `currency` | Text | ISO 4217, ej. `GTQ` |
| `timeZone` | Text | IANA, ej. `America/Guatemala` (hoy y timestamps) |

### Logos (File)

| Campo | Tipo | Opciones |
|---|---|---|
| `logo` | File | max 1; PNG/JPEG/WebP/SVG; logo UI |
| `logoPdf` | File | max 1; preferible JPEG comprimido para PDF |

### Colores (Text, hex `#RRGGBB`)

| Campo | Uso |
|---|---|
| `colorPrimary` | Primario |
| `colorPrimaryHover` | Primario hover |
| `colorPrimarySoft` | Primario soft |
| `colorPrimaryMuted` | Primario muted |
| `colorSidebar` | Fondo sidebar |
| `colorSidebarHover` | Sidebar hover |
| `colorSidebarBorder` | Sidebar borde |
| `colorSidebarMuted` | Sidebar muted |
| `colorSidebarText` | Sidebar texto |
| `colorSidebarTextHover` | Sidebar texto hover |
| `colorSidebarSection` | Sidebar sección |
| `colorSurface` | Fondo app |
| `colorCard` | Tarjetas |
| `colorBorder` | Bordes |
| `colorMutedBg` | Fondo muted |
| `colorTableHead` | Cabecera tablas |
| `colorSuccess` / `colorSuccessBg` | Éxito |
| `colorWarning` / `colorWarningBg` | Advertencia |
| `colorInfo` / `colorInfoBg` | Info |
| `colorDanger` / `colorDangerBg` | Peligro |

---

## API Rules (recomendado)

- **List / View:** `""` (público) — necesario para login y carga inicial sin sesión.
- **Create / Update / Delete:** `@request.auth.email = "evalencia@dataget.app"`

(Si aún no puedes filtrar por email, deja create/update autenticado y el frontend ya limita la pantalla a ese correo.)

---

## Uso en la app

- Carga al inicio vía `BrandProvider` (defaults en código si no hay registro).
- Edición en `/configuracion` (solo `evalencia@dataget.app`).
- Al guardar se aplica en UI (CSS vars), PDF, moneda y fechas.
