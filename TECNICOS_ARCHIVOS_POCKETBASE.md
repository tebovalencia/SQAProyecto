# Técnicos — archivos PocketBase

Colección `tecnicos`. La app sube foto y PDFs desde el listado y desde la ficha.

---

## Campos file

| Campo | Tipo | maxSelect | MIME | Tamaño sugerido | Notas |
|---|---|---|---|---|---|
| `fotografia` | File | **1** | `image/jpeg`, `image/png`, `image/webp`, `image/gif` | 5 MB | Ya existe. Ajustar maxSelect a 1, MIME de imagen y thumbs `100x100`, `300x300`. |
| `documentoIdentidad` | File | **1** | `application/pdf` | 10 MB | Ya existe, pero estaba como imágenes múltiples. Cambiar a **un PDF**. |
| `documentoSeguroSocial` | File | **1** | `application/pdf` | 10 MB | **Crear.** Carné / constancia de seguro social. |

Ninguno es requerido. `protected` = false (igual que el resto de archivos de la app).

### Cómo crear / ajustar en PocketBase Admin

1. Colección **tecnicos**.
2. **fotografia:** File, 1 archivo, solo imágenes, thumbs `100x100` y `300x300`.
3. **documentoIdentidad:** File, 1 archivo, MIME `application/pdf` (quitar jpeg/png/…).
4. **documentoSeguroSocial:** File nuevo, 1 archivo, MIME `application/pdf`.

Si `documentoIdentidad` ya tiene imágenes subidas, se pueden seguir abriendo; los nuevos subidos serán PDF.
