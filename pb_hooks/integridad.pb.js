/**
 * Hooks de integridad para PocketBase 0.27.
 * Copiar esta carpeta `pb_hooks` junto al ejecutable de PocketBase
 * (al lado de `pb_data`) y reiniciar el servidor.
 *
 * El stock se actualiza con SQL `stockActual = stockActual + delta` dentro
 * de la misma transacción que la línea o el ingreso, y rechaza stock negativo.
 * Los totales de la OT se recalculan en el servidor.
 * Mantener la lógica de deltas alineada con `src/lib/stockDelta.ts`.
 */

function money(value) {
  if (value == null || value === '') return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function lineQty(cantidad) {
  if (cantidad == null || cantidad === '') return 1
  const n = Number(cantidad)
  if (!Number.isFinite(n) || n <= 0) return 1
  return n
}

function stockDeltaMap(before, after) {
  const map = {}
  const add = (id, delta) => {
    if (!id || delta === 0) return
    map[id] = (map[id] || 0) + delta
  }
  if (before) add(before.get('repuestoTallerId'), lineQty(before.get('cantidad')))
  if (after) add(after.get('repuestoTallerId'), -lineQty(after.get('cantidad')))
  return map
}

function readStock(app, id) {
  const rows = arrayOf(new DynamicModel({ stock: 0, nombre: '' }))
  app
    .db()
    .newQuery(
      'SELECT IFNULL(`stockActual`, 0) as stock, IFNULL(`nombreRepuesto`, "") as nombre FROM `inventarioTaller` WHERE `id` = {:id}',
    )
    .bind({ id: id })
    .all(rows)
  if (!rows.length) {
    throw new BadRequestError('Repuesto de taller no encontrado.')
  }
  return { stock: money(rows[0].stock), nombre: rows[0].nombre || 'repuesto' }
}

function applyOneDelta(app, id, delta) {
  const before = readStock(app, id)
  if (before.stock + delta < 0) {
    throw new BadRequestError(
      'Stock insuficiente de "' + before.nombre + '". Disponible: ' + before.stock + '.',
    )
  }
  app
    .db()
    .newQuery(
      'UPDATE `inventarioTaller` SET `stockActual` = IFNULL(`stockActual`, 0) + {:delta} WHERE `id` = {:id} AND IFNULL(`stockActual`, 0) + {:delta} >= 0',
    )
    .bind({ delta: delta, id: id })
    .execute()
  const after = readStock(app, id)
  if (after.stock !== before.stock + delta) {
    throw new BadRequestError(
      'Stock insuficiente de "' + before.nombre + '". Disponible: ' + before.stock + '.',
    )
  }
}

function applyStockDeltasChecked(app, before, after) {
  const deltas = stockDeltaMap(before, after)
  const ids = Object.keys(deltas)
  for (let i = 0; i < ids.length; i++) {
    applyOneDelta(app, ids[i], deltas[ids[i]])
  }
}

function snapshotCosto(app, record, original) {
  const tallerId = record.get('repuestoTallerId')
  if (!tallerId) {
    record.set('precioCompra', 0)
    return
  }
  const prevId = original ? original.get('repuestoTallerId') : ''
  const missing = record.get('precioCompra') == null || record.get('precioCompra') === ''
  if (!original || prevId !== tallerId || missing) {
    const inv = app.findRecordById('inventarioTaller', tallerId)
    record.set('precioCompra', money(inv.get('precioCompra')))
  }
}

function recalcOtTotals(app, otId) {
  if (!otId) return
  const trabajos = app.findRecordsByFilter('detalleTrabajos', 'otId = {:id}', '', 1000, 0, { id: otId })
  const repuestos = app.findRecordsByFilter('detalleRepuestos', 'otId = {:id}', '', 1000, 0, { id: otId })
  let trabajosVenta = 0
  for (let i = 0; i < trabajos.length; i++) {
    trabajosVenta += money(trabajos[i].get('precioVenta'))
  }
  let ventaRep = 0
  let compraRep = 0
  for (let i = 0; i < repuestos.length; i++) {
    const row = repuestos[i]
    const qty = lineQty(row.get('cantidad'))
    ventaRep += money(row.get('precioVenta')) * qty
    if (row.get('repuestoTallerId')) {
      compraRep += money(row.get('precioCompra')) * qty
    }
  }
  const ot = app.findRecordById('ordenesTrabajo', otId)
  ot.set('totalVenta', trabajosVenta + ventaRep)
  ot.set('totalVentaRepuestos', ventaRep)
  ot.set('totalCompraRepuestos', compraRep)
  app.save(ot)
}

onRecordCreate(
  (e) => {
    snapshotCosto(e.app, e.record, null)
    applyStockDeltasChecked(e.app, null, e.record)
    const otId = e.record.get('otId')
    e.next()
    recalcOtTotals(e.app, otId)
  },
  'detalleRepuestos',
)

onRecordUpdate(
  (e) => {
    const original = e.record.original()
    snapshotCosto(e.app, e.record, original)
    applyStockDeltasChecked(e.app, original, e.record)
    const otId = e.record.get('otId')
    e.next()
    recalcOtTotals(e.app, otId)
  },
  'detalleRepuestos',
)

onRecordDelete(
  (e) => {
    const otId = e.record.get('otId')
    applyStockDeltasChecked(e.app, e.record, null)
    e.next()
    recalcOtTotals(e.app, otId)
  },
  'detalleRepuestos',
)

onRecordCreate(
  (e) => {
    const otId = e.record.get('otId')
    e.next()
    recalcOtTotals(e.app, otId)
  },
  'detalleTrabajos',
)

onRecordUpdate(
  (e) => {
    const otId = e.record.get('otId')
    e.next()
    recalcOtTotals(e.app, otId)
  },
  'detalleTrabajos',
)

onRecordDelete(
  (e) => {
    const otId = e.record.get('otId')
    e.next()
    recalcOtTotals(e.app, otId)
  },
  'detalleTrabajos',
)

onRecordCreate(
  (e) => {
    const qty = Number(e.record.get('cantidadIngreso') || 0)
    const compra = money(e.record.get('precioCompra'))
    const venta = money(e.record.get('precioVenta'))
    if (!e.record.get('inventarioId')) {
      throw new BadRequestError('Selecciona un repuesto del inventario.')
    }
    if (!qty || qty <= 0) {
      throw new BadRequestError('La cantidad de ingreso debe ser mayor a 0.')
    }
    if (compra < 0 || venta < 0) {
      throw new BadRequestError('Los precios no pueden ser negativos.')
    }
    const id = e.record.get('inventarioId')
    const before = readStock(e.app, id)
    e.app
      .db()
      .newQuery(
        'UPDATE `inventarioTaller` SET `stockActual` = IFNULL(`stockActual`, 0) + {:delta}, `precioCompra` = {:compra}, `precioVenta` = {:venta} WHERE `id` = {:id}',
      )
      .bind({ delta: qty, compra: compra, venta: venta, id: id })
      .execute()
    const after = readStock(e.app, id)
    if (after.stock !== before.stock + qty) {
      throw new BadRequestError('No se pudo actualizar el stock del repuesto.')
    }
    e.next()
  },
  'movimientosInventarioTaller',
)
