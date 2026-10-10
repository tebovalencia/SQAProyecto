import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, FileDown, GripVertical, PackagePlus, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  ordenesService,
  detalleTrabajosService,
  detalleRepuestosService,
  catalogoService,
  tecnicosService,
  proveedoresService,
  inventarioService,
  repuestosClienteService,
  trabajosProgramadosService,
  vehiculosService,
} from '@/services'
import {
  adjustInventarioStock,
  calcRepuestosTotales,
  clienteOptionsForRow,
  markRepuestoClienteInstalado,
  unmarkRepuestoClienteInstalado,
} from '@/services/repuestosOt'
import { isUsingBackend } from '@/services/crud'
import type {
  CatalogoTrabajo,
  DetalleRepuesto,
  DetalleTrabajo,
  EstadoFactura,
  EstadoRepuestoCliente,
  InventarioTaller,
  OrdenTrabajo,
  Proveedor,
  RepuestoCliente,
  Tecnico,
  TrabajoProgramado,
  Vehiculo,
} from '@/types/collections'
import { extractDateOnly, formatCurrency, formatDate, formatDateInput, numberInputValue, parseNumberInput, todayISO } from '@/lib/format'
import {
  sortDetalleTrabajos,
  withSequentialIndices,
} from '@/lib/detalleTrabajoOrden'
import { patchFechaCierrePorEstado, patchFechaFacturacionPorEstado } from '@/lib/otFechaCierre'
import { errorMessage } from '@/lib/pbError'
import { calcOtTotalVenta, lineRepuestoVenta, sumRepuestosVenta, sumTrabajosVenta, toMoney } from '@/lib/otTotales'
import { assertIdInternoDisponible, displayOtId, isUniqueIdInternoError } from '@/lib/otId'
import { displayVehiculoCodigo } from '@/lib/vehiculo'
import { useAuth } from '@/auth/AuthContext'
import { canAccessOrden, relationId } from '@/auth/permissions'
import { ProgramadoEstadoBadge, RepuestoEstadoBadge, StatusBadge } from '@/components/ui/Badges'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Modal } from '@/components/ui/Modal'
import { PdfPreviewModal } from '@/components/ui/PdfPreviewModal'
import { Card, EmptyState, LoadingState, SectionTitle } from '@/components/ui/Page'
import { usePdfPreview } from '@/lib/pdf/usePdfPreview'
import {
  OtFormModal,
  buildOtSaveBody,
  emptyOtForm,
  otToForm,
  type OtFormValues,
} from './OtFormModal'
import { downloadOtReport } from './downloadOtReport'
import { asFileNames, OtMediaPanel } from './OtMediaPanel'

const ESTADOS: EstadoFactura[] = ['En Proceso', 'Terminada', 'Esperando OC', 'OC Recibida', 'Facturada']

function catalogoLabel(c: CatalogoTrabajo): string {
  const code = c.codigoTrabajo?.trim()
  const desc = c.descripcion?.trim()
  if (code && desc) return `${code} — ${desc}`
  return code || desc || '—'
}

function matchesCatalogo(c: CatalogoTrabajo, q: string): boolean {
  const haystack = [c.codigoTrabajo, c.descripcion, c.precio != null ? String(c.precio) : '']
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}
type Tab = 'trabajos' | 'repuestos' | 'programados' | 'notas' | 'archivos'

type ProgramadoForm = {
  trabajoId: string
  descripcion: string
  fechaSugerida: string
}

const emptyProgramadoForm = (): ProgramadoForm => ({
  trabajoId: '',
  descripcion: '',
  fechaSugerida: todayISO(),
})
type OrigenRepuesto = '' | 'taller' | 'cliente' | 'manual'

function origenOf(row: DetalleRepuesto): OrigenRepuesto {
  if (row.repuestoTallerId) return 'taller'
  if (row.repuestoClienteId) return 'cliente'
  if (row.descripcion?.trim()) return 'manual'
  return ''
}

export default function OrdenDetallePage() {
  const { id } = useParams<{ id: string }>()
  const { permissions } = useAuth()
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<Tab>('trabajos')
  const [orden, setOrden] = useState<OrdenTrabajo | null>(null)
  const [trabajos, setTrabajos] = useState<DetalleTrabajo[]>([])
  const [repuestos, setRepuestos] = useState<DetalleRepuesto[]>([])
  const [catalogo, setCatalogo] = useState<CatalogoTrabajo[]>([])
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [inventario, setInventario] = useState<InventarioTaller[]>([])
  const [repuestosCliente, setRepuestosCliente] = useState<RepuestoCliente[]>([])
  const [programados, setProgramados] = useState<TrabajoProgramado[]>([])
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [notas, setNotas] = useState({ comentarios: '', descripcionSolicitud: '' })
  const [sidebar, setSidebar] = useState({
    estadoFactura: 'En Proceso' as EstadoFactura,
    fechaEnvioOC: '',
    fechaRecepcionOC: '',
    fechaFacturacion: '',
  })
  const [repuestoError, setRepuestoError] = useState('')
  const [repuestoBusy, setRepuestoBusy] = useState(false)
  const [cantidadDraft, setCantidadDraft] = useState<Record<string, string>>({})
  /** Origen elegido en UI antes de asignar un repuesto concreto (no existe en PB). */
  const [origenDraft, setOrigenDraft] = useState<Record<string, OrigenRepuesto>>({})
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<OtFormValues>(emptyOtForm())
  const [editSaving, setEditSaving] = useState(false)
  const [idInternoError, setIdInternoError] = useState('')
  const pdfPreview = usePdfPreview()
  const [solicitudOpen, setSolicitudOpen] = useState(false)
  const [solicitudSaving, setSolicitudSaving] = useState(false)
  const [solicitudError, setSolicitudError] = useState('')
  const [editingPedido, setEditingPedido] = useState<RepuestoCliente | null>(null)
  const [solicitudForm, setSolicitudForm] = useState({
    descripcion: '',
    proveedorEntrega: '',
    fechaSolicitud: todayISO(),
    estado: 'solicitado' as EstadoRepuestoCliente,
  })
  const [programadoOpen, setProgramadoOpen] = useState(false)
  const [programadoSaving, setProgramadoSaving] = useState(false)
  const [programadoError, setProgramadoError] = useState('')
  const [editingProgramado, setEditingProgramado] = useState<TrabajoProgramado | null>(null)
  const [programadoForm, setProgramadoForm] = useState<ProgramadoForm>(emptyProgramadoForm)

  function resolveOrigen(row: DetalleRepuesto): OrigenRepuesto {
    return origenDraft[row.id] ?? origenOf(row)
  }

  const pedidosCliente = useMemo(() => {
    if (!id) return []
    return repuestosCliente.filter((r) => r.otSolicitudId === id)
  }, [repuestosCliente, id])

  /** Pendientes del vehículo (solicitado/recibido) con fecha de ayer o anterior (no los de hoy). */
  const historialSolicitadosVehiculo = useMemo(() => {
    const vehiculoId = orden?.vehiculoId
    if (!vehiculoId) return []
    const hoy = todayISO()
    return repuestosCliente
      .filter((r) => {
        if (r.vehiculoId !== vehiculoId) return false
        if (r.estado !== 'solicitado' && r.estado !== 'recibido') return false
        const fecha = extractDateOnly(r.fechaSolicitud) || extractDateOnly(r.created)
        if (!fecha) return false
        return fecha < hoy
      })
      .sort((a, b) =>
        (b.fechaSolicitud ?? b.created ?? '').localeCompare(a.fechaSolicitud ?? a.created ?? ''),
      )
  }, [repuestosCliente, orden?.vehiculoId])

  const canSeeRepuestosTab =
    permissions.ot.editPedidosCliente ||
    permissions.ot.editRepuestosTaller ||
    permissions.ot.viewHistorialPedidosCliente

  const mediaCount = useMemo(() => {
    if (!orden) return 0
    return asFileNames(orden.fotografias).length + asFileNames(orden.notasVoz).length
  }, [orden])

  /** Mecánico: solo sus líneas; Admin/Registrador: todas. */
  const trabajosVisibles = useMemo(() => {
    if (!permissions.ot.viewOnlyOwnTrabajos || !permissions.tecnicoId) return trabajos
    return trabajos.filter((t) => relationId(t.tecnicoId) === permissions.tecnicoId)
  }, [trabajos, permissions.ot.viewOnlyOwnTrabajos, permissions.tecnicoId])

  const canReorderTrabajos =
    permissions.ot.editTrabajos && !permissions.ot.viewOnlyOwnTrabajos

  const dragTrabajoIdRef = useRef<string | null>(null)
  const trabajosRef = useRef<DetalleTrabajo[]>(trabajos)
  const repuestosRef = useRef<DetalleRepuesto[]>(repuestos)
  const inventarioRef = useRef<InventarioTaller[]>(inventario)
  const trabajosOrderRef = useRef<DetalleTrabajo[]>(trabajos)
  const syncOtTotalesQueue = useRef(Promise.resolve())
  const [dragOverTrabajoId, setDragOverTrabajoId] = useState<string | null>(null)
  const [reordenSaving, setReordenSaving] = useState(false)

  useEffect(() => {
    trabajosRef.current = trabajos
    trabajosOrderRef.current = trabajos
  }, [trabajos])

  useEffect(() => {
    repuestosRef.current = repuestos
  }, [repuestos])

  useEffect(() => {
    inventarioRef.current = inventario
  }, [inventario])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const otRes = await ordenesService.getOne(id, 'vehiculoId')
      if (!canAccessOrden(permissions, otRes.item)) {
        setOrden(null)
        setAccessDenied(true)
        return
      }
      setAccessDenied(false)
      const vehiculoId = otRes.item.vehiculoId
      const [trabRes, repRes, catRes, tecRes, provRes, invRes, rcRes, tpRes, vehRes] =
        await Promise.all([
          detalleTrabajosService.getFullList({
            filter: `otId = "${id}"`,
            sort: 'indice,created',
          }),
          detalleRepuestosService.getFullList({
            filter: `otId = "${id}"`,
            expand: 'repuestoTallerId,repuestoClienteId',
          }),
          catalogoService.getFullList({
            sort: 'codigoTrabajo',
            fields: 'id,codigoTrabajo,descripcion,precio',
          }),
          tecnicosService.getFullList({
            sort: 'nombre',
            fields: 'id,nombre,estado,sede',
          }),
          proveedoresService.getFullList({
            sort: 'nombre',
            fields: 'id,nombre',
          }),
          inventarioService.getFullList({
            sort: 'nombreRepuesto',
            fields: 'id,nombreRepuesto,stockActual,precioVenta,precioCompra',
          }),
          repuestosClienteService.getFullList({
            filter: vehiculoId ? `vehiculoId = "${vehiculoId}"` : undefined,
            expand: 'vehiculoId,otSolicitudId',
            sort: '-fechaSolicitud,-created',
          }),
          vehiculoId
            ? trabajosProgramadosService.getFullList({
                filter: `vehiculoId = "${vehiculoId}"`,
                expand: 'trabajoId,ordenTrabajoProgramado,ordenTrabajoAtendido',
                sort: 'fechaSugerida',
              })
            : Promise.resolve({ items: [] as TrabajoProgramado[] }),
          vehiculosService.getFullList({
            sort: 'codigoInterno',
            fields: 'id,codigoInterno,placa,marca,modelo,anio,sede,clienteId',
          }),
        ])
      setOrden(otRes.item)
      setTrabajos(sortDetalleTrabajos(trabRes.items))
      setRepuestos(repRes.items)
      setCatalogo(catRes.items)
      setTecnicos(tecRes.items)
      setProveedores(provRes.items)
      setInventario(invRes.items)
      setRepuestosCliente(rcRes.items)
      setProgramados(tpRes.items)
      setVehiculos(vehRes.items)
      setNotas({
        comentarios: otRes.item.comentarios ?? '',
        descripcionSolicitud: otRes.item.descripcionSolicitud ?? '',
      })
      setSidebar({
        estadoFactura: otRes.item.estadoFactura ?? 'En Proceso',
        fechaEnvioOC: formatDateInput(otRes.item.fechaEnvioOC),
        fechaRecepcionOC: formatDateInput(otRes.item.fechaRecepcionOC),
        fechaFacturacion: formatDateInput(otRes.item.fechaFacturacion),
      })
    } finally {
      setLoading(false)
    }
  }, [id, permissions])

  useEffect(() => { load() }, [load])

  const totalVenta = useMemo(() => calcOtTotalVenta(trabajos, repuestos), [trabajos, repuestos])
  const subtotalTrabajos = useMemo(() => sumTrabajosVenta(trabajos), [trabajos])
  const subtotalRepuestos = useMemo(() => sumRepuestosVenta(repuestos), [repuestos])

  function patchInventarioLocal(updated: InventarioTaller) {
    setInventario((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
  }

  function patchClienteLocal(updated: RepuestoCliente) {
    setRepuestosCliente((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
  }

  /** PocketBase update no trae expand; conserva vehículo/creadaPor ya cargados. */
  function applyOrdenUpdate(item: OrdenTrabajo) {
    setOrden((prev) => ({
      ...item,
      expand: {
        ...item.expand,
        vehiculoId: item.expand?.vehiculoId ?? prev?.expand?.vehiculoId,
        creadaPor: item.expand?.creadaPor ?? prev?.expand?.creadaPor,
      },
    }))
  }

  async function refreshInventarioStock(ids: Array<string | undefined>) {
    const unique = [...new Set(ids.filter((value): value is string => Boolean(value)))]
    await Promise.all(
      unique.map(async (invId) => {
        const { item } = await inventarioService.getOne(invId)
        patchInventarioLocal(item)
      }),
    )
  }

  async function persistOtTotales() {
    if (!id) return
    try {
      if (await isUsingBackend()) {
        const { item } = await ordenesService.getOne(id)
        applyOrdenUpdate(item)
        return
      }
      const currentTrabajos = trabajosRef.current
      const currentRepuestos = repuestosRef.current
      const { totalVentaRepuestos, totalCompraRepuestos } = calcRepuestosTotales(
        currentRepuestos,
        inventarioRef.current,
      )
      const total = calcOtTotalVenta(currentTrabajos, currentRepuestos)
      const { item } = await ordenesService.update(id, {
        totalVenta: total,
        totalVentaRepuestos,
        totalCompraRepuestos,
      })
      applyOrdenUpdate(item)
    } catch (err) {
      alert(errorMessage(err, 'No se pudo actualizar el total de la OT.'))
    }
  }

  /** Recalcula y persiste totales en cualquier estado de la OT (incluida cerrada/facturada). */
  function syncOtTotales(_nextRepuestos?: DetalleRepuesto[], _nextTrabajos?: DetalleTrabajo[]) {
    const run = () => persistOtTotales()
    const queued = syncOtTotalesQueue.current.then(run, run)
    syncOtTotalesQueue.current = queued.then(
      () => undefined,
      () => undefined,
    )
    return queued
  }

  async function recalcAndUpdateOt(extra?: Partial<OrdenTrabajo>) {
    if (!id) return
    if (await isUsingBackend()) {
      const patch = extra ?? {}
      if (Object.keys(patch).length === 0) {
        const { item } = await ordenesService.getOne(id)
        applyOrdenUpdate(item)
        return
      }
      const { item } = await ordenesService.update(id, patch)
      applyOrdenUpdate(item)
      return
    }
    const { totalVentaRepuestos, totalCompraRepuestos } = calcRepuestosTotales(
      repuestosRef.current,
      inventarioRef.current,
    )
    const total = calcOtTotalVenta(trabajosRef.current, repuestosRef.current)
    const { item } = await ordenesService.update(id, {
      totalVenta: total,
      totalVentaRepuestos,
      totalCompraRepuestos,
      ...extra,
    })
    applyOrdenUpdate(item)
  }

  async function saveNotas() {
    if (!id) return
    setSaving(true)
    try {
      const patch: Partial<OrdenTrabajo> = {}
      if (permissions.ot.editComentarios) {
        patch.comentarios = notas.comentarios || undefined
      }
      if (permissions.ot.editDescripcionSolicitud) {
        patch.descripcionSolicitud = notas.descripcionSolicitud || undefined
      }
      await recalcAndUpdateOt(patch)
    } finally {
      setSaving(false)
    }
  }

  async function saveSidebar() {
    if (!id || !orden || !permissions.ot.editEstadoOc) return
    setSaving(true)
    try {
      await recalcAndUpdateOt({
        estadoFactura: sidebar.estadoFactura,
        ...patchFechaCierrePorEstado(orden.estadoFactura, sidebar.estadoFactura),
        fechaEnvioOC: sidebar.fechaEnvioOC || undefined,
        fechaRecepcionOC: sidebar.fechaRecepcionOC || undefined,
        fechaFacturacion:
          sidebar.fechaFacturacion
          || patchFechaFacturacionPorEstado(
            orden.estadoFactura,
            sidebar.estadoFactura,
            sidebar.fechaFacturacion,
          ).fechaFacturacion
          || undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  function openEditDatos() {
    if (!orden) return
    setEditForm(otToForm(orden))
    setIdInternoError('')
    setEditOpen(true)
  }

  async function saveEditDatos() {
    if (!id) return
    setEditSaving(true)
    setIdInternoError('')
    try {
      if (permissions.ot.editKilometrajeOnly && !permissions.ot.editDatosCompletos) {
        const km = editForm.kilometraje.trim()
        await ordenesService.update(id, {
          kilometraje: km ? Number(km) : undefined,
        })
        setEditOpen(false)
        await load()
        return
      }
      if (!editForm.vehiculoId) return
      const idInterno = editForm.idInterno.trim()
      if (idInterno) {
        await assertIdInternoDisponible(idInterno, id)
      }
      const body = buildOtSaveBody(editForm, {
        mode: 'update',
        previousEstado: orden?.estadoFactura,
        includeEstadoOc: permissions.canSeeOtEstado,
      })
      await ordenesService.update(id, body)
      setEditOpen(false)
      await load()
    } catch (err) {
      const msg = isUniqueIdInternoError(err)
        ? `Ya existe una OT con ese N°. Elige otro número.`
        : errorMessage(err, 'No se pudo guardar la OT')
      setIdInternoError(msg)
    } finally {
      setEditSaving(false)
    }
  }

  async function handleExportPdf() {
    if (!id) return
    const otLabel = orden ? displayOtId(orden) : id
    await pdfPreview.openPreview(`Vista previa OT ${otLabel}`, () =>
      downloadOtReport(id, orden ?? undefined),
    )
  }

  async function addTrabajo() {
    if (!id) return
    const ownTecnicoId = permissions.tecnicoId
    if (permissions.ot.autoAssignOwnTecnico && !ownTecnicoId) {
      alert('No se pudo asignar tu técnico. Verifica que el usuario tenga tecnicoId en PocketBase.')
      return
    }
    const payload: Record<string, string | number> = {
      otId: id,
      descripcion: '',
      precioVenta: 0,
      indice: 1,
    }
    if (permissions.ot.autoAssignOwnTecnico && ownTecnicoId) {
      payload.tecnicoId = ownTecnicoId
    }
    let { item } = await detalleTrabajosService.create(payload as Partial<DetalleTrabajo>)
    // Si el create no devolvió/persistió tecnicoId, forzar con update.
    if (
      permissions.ot.autoAssignOwnTecnico &&
      ownTecnicoId &&
      relationId(item.tecnicoId) !== ownTecnicoId
    ) {
      const patched = await detalleTrabajosService.update(item.id, { tecnicoId: ownTecnicoId })
      item = patched.item
    }
    // Nuevo detalle arriba; reindexa 1..n para que el orden sobreviva al reload (sort por indice).
    const next = [item, ...trabajosRef.current.filter((t) => t.id !== item.id)]
    await persistTrabajosOrder(next)
    await syncOtTotales(repuestosRef.current, trabajosRef.current)
  }

  async function persistTrabajosOrder(ordered: DetalleTrabajo[]) {
    const sequenced = withSequentialIndices(ordered)
    trabajosRef.current = sequenced
    setTrabajos(sequenced)
    setReordenSaving(true)
    try {
      await Promise.all(
        sequenced.map((t) => detalleTrabajosService.update(t.id, { indice: t.indice })),
      )
    } catch (err) {
      alert(errorMessage(err, 'No se pudo guardar el orden de trabajos.'))
      await load()
    } finally {
      setReordenSaving(false)
    }
  }

  function onTrabajoDragStart(rowId: string) {
    dragTrabajoIdRef.current = rowId
  }

  function onTrabajoDragOver(e: DragEvent, overId: string) {
    if (!canReorderTrabajos || reordenSaving) return
    e.preventDefault()
    setDragOverTrabajoId(overId)
    const fromId = dragTrabajoIdRef.current
    if (!fromId || fromId === overId) return
    setTrabajos((prev) => {
      const from = prev.findIndex((t) => t.id === fromId)
      const to = prev.findIndex((t) => t.id === overId)
      if (from < 0 || to < 0 || from === to) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  async function onTrabajoDragEnd() {
    const fromId = dragTrabajoIdRef.current
    dragTrabajoIdRef.current = null
    setDragOverTrabajoId(null)
    if (!fromId || !canReorderTrabajos) return
    await persistTrabajosOrder(trabajosOrderRef.current)
  }

  async function updateTrabajo(row: DetalleTrabajo, patch: Partial<DetalleTrabajo>) {
    const safePatch = { ...patch }
    if (!permissions.ot.editTrabajoTecnico) {
      delete safePatch.tecnicoId
    }
    if (!permissions.ot.editTrabajoProveedor) {
      delete safePatch.proveedorId
    }
    if ('precioVenta' in safePatch) {
      safePatch.precioVenta = toMoney(safePatch.precioVenta)
    }
    const { item } = await detalleTrabajosService.update(row.id, safePatch)
    const next = trabajosRef.current.map((t) =>
      t.id === row.id
        ? {
            ...t,
            ...item,
            expand: { ...t.expand, ...item.expand },
            precioVenta: toMoney(item.precioVenta ?? safePatch.precioVenta ?? t.precioVenta),
          }
        : t,
    )
    trabajosRef.current = next
    setTrabajos(next)
    if (!id) return
    await syncOtTotales(repuestosRef.current, next)
  }

  async function deleteTrabajo(row: DetalleTrabajo) {
    if (!confirm('¿Eliminar línea de trabajo?')) return
    await detalleTrabajosService.remove(row.id)
    const next = trabajosRef.current.filter((t) => t.id !== row.id)
    trabajosRef.current = next
    setTrabajos(next)
    await syncOtTotales(repuestosRef.current, next)
  }

  function openSolicitudCliente() {
    setSolicitudError('')
    setEditingPedido(null)
    setSolicitudForm({
      descripcion: '',
      proveedorEntrega: '',
      fechaSolicitud: todayISO(),
      estado: 'solicitado',
    })
    setSolicitudOpen(true)
  }

  function openEditPedidoCliente(item: RepuestoCliente) {
    if (item.estado === 'instalado') {
      alert('No se puede editar: el repuesto ya está instalado en una OT.')
      return
    }
    setSolicitudError('')
    setEditingPedido(item)
    setSolicitudForm({
      descripcion: item.descripcion ?? '',
      proveedorEntrega: item.proveedorEntrega ?? '',
      fechaSolicitud: formatDateInput(item.fechaSolicitud) || todayISO(),
      estado: (item.estado as EstadoRepuestoCliente) || 'solicitado',
    })
    setSolicitudOpen(true)
  }

  function closeSolicitudModal() {
    setSolicitudOpen(false)
    setEditingPedido(null)
    setSolicitudError('')
  }

  async function saveSolicitudCliente() {
    if (!id || !orden) return
    const descripcion = solicitudForm.descripcion.trim()
    if (!descripcion) {
      setSolicitudError('Indica la descripción del repuesto solicitado.')
      return
    }
    if (!orden.vehiculoId && !editingPedido) {
      setSolicitudError('La OT no tiene vehículo asignado; no se puede crear el pedido.')
      return
    }
    setSolicitudSaving(true)
    setSolicitudError('')
    try {
      if (editingPedido) {
        const patch: Partial<RepuestoCliente> = {
          descripcion,
          fechaSolicitud: solicitudForm.fechaSolicitud || undefined,
          proveedorEntrega: solicitudForm.proveedorEntrega.trim() || undefined,
          estado: solicitudForm.estado,
        }
        if (
          solicitudForm.estado === 'recibido' &&
          !editingPedido.fechaRecepcion
        ) {
          patch.fechaRecepcion = todayISO()
        }
        const { item } = await repuestosClienteService.update(editingPedido.id, patch)
        patchClienteLocal(item)
      } else {
        const { item } = await repuestosClienteService.create({
          vehiculoId: orden.vehiculoId,
          descripcion,
          estado: 'solicitado',
          fechaSolicitud: solicitudForm.fechaSolicitud || todayISO(),
          proveedorEntrega: solicitudForm.proveedorEntrega.trim() || undefined,
          kilometraje: orden.kilometraje,
          otSolicitudId: id,
        })
        setRepuestosCliente((prev) => [item, ...prev])
      }
      closeSolicitudModal()
    } catch (err) {
      setSolicitudError(
        err instanceof Error
          ? err.message
          : editingPedido
            ? 'No se pudo actualizar el pedido.'
            : 'No se pudo crear el pedido.',
      )
    } finally {
      setSolicitudSaving(false)
    }
  }

  async function deletePedidoCliente(item: RepuestoCliente) {
    if (item.estado === 'instalado') {
      alert('No se puede eliminar: el repuesto ya está instalado en una OT.')
      return
    }
    if (repuestos.some((r) => r.repuestoClienteId === item.id)) {
      alert('No se puede eliminar: este repuesto está asignado en el detalle de la OT.')
      return
    }
    if (!confirm(`¿Eliminar pedido "${item.descripcion || 'repuesto'}"?`)) return
    try {
      await repuestosClienteService.remove(item.id)
      setRepuestosCliente((prev) => prev.filter((r) => r.id !== item.id))
    } catch (err) {
      alert(errorMessage(err, 'No se pudo eliminar el pedido.'))
    }
  }

  function enrichProgramado(item: TrabajoProgramado): TrabajoProgramado {
    return {
      ...item,
      expand: {
        ...item.expand,
        trabajoId: catalogo.find((c) => c.id === item.trabajoId) ?? item.expand?.trabajoId,
        ordenTrabajoProgramado:
          item.ordenTrabajoProgramado === id
            ? (orden ?? item.expand?.ordenTrabajoProgramado)
            : item.expand?.ordenTrabajoProgramado,
        ordenTrabajoAtendido:
          item.ordenTrabajoAtendido === id
            ? (orden ?? item.expand?.ordenTrabajoAtendido)
            : item.expand?.ordenTrabajoAtendido,
      },
    }
  }

  function openCreateProgramado() {
    setEditingProgramado(null)
    setProgramadoError('')
    setProgramadoForm(emptyProgramadoForm())
    setProgramadoOpen(true)
  }

  function openEditProgramado(tp: TrabajoProgramado) {
    setEditingProgramado(tp)
    setProgramadoError('')
    setProgramadoForm({
      trabajoId: tp.trabajoId || '',
      descripcion: tp.descripcion || '',
      fechaSugerida: formatDateInput(tp.fechaSugerida) || todayISO(),
    })
    setProgramadoOpen(true)
  }

  async function saveProgramado() {
    if (!id || !orden) return
    if (!orden.vehiculoId) {
      setProgramadoError('La OT no tiene vehículo asignado; no se puede programar el trabajo.')
      return
    }
    const descripcion =
      programadoForm.descripcion.trim() ||
      catalogo.find((c) => c.id === programadoForm.trabajoId)?.descripcion?.trim() ||
      ''
    if (!descripcion && !programadoForm.trabajoId) {
      setProgramadoError('Indica un trabajo del catálogo o una descripción.')
      return
    }
    setProgramadoSaving(true)
    setProgramadoError('')
    try {
      const payload = {
        vehiculoId: orden.vehiculoId,
        trabajoId: programadoForm.trabajoId || undefined,
        descripcion: descripcion || undefined,
        fechaSugerida: programadoForm.fechaSugerida || todayISO(),
        estado: editingProgramado?.estado || 'pendiente',
        // Al crear/editar desde esta OT se registra como OT de programación
        ordenTrabajoProgramado: editingProgramado?.ordenTrabajoProgramado || id,
        ordenTrabajoAtendido: editingProgramado?.ordenTrabajoAtendido || undefined,
      }
      if (editingProgramado) {
        const { item } = await trabajosProgramadosService.update(editingProgramado.id, payload)
        const next = enrichProgramado(item)
        setProgramados((prev) => prev.map((p) => (p.id === next.id ? next : p)))
      } else {
        const { item } = await trabajosProgramadosService.create(payload)
        const next = enrichProgramado(item)
        setProgramados((prev) =>
          [...prev, next].sort((a, b) =>
            String(a.fechaSugerida ?? '').localeCompare(String(b.fechaSugerida ?? '')),
          ),
        )
      }
      setProgramadoOpen(false)
      setEditingProgramado(null)
    } catch (err) {
      setProgramadoError(errorMessage(err, 'No se pudo guardar el trabajo programado.'))
    } finally {
      setProgramadoSaving(false)
    }
  }

  async function asignarProgramadoAEstaOt(tp: TrabajoProgramado) {
    if (!id) return
    setProgramadoSaving(true)
    try {
      const { item } = await trabajosProgramadosService.update(tp.id, {
        ordenTrabajoProgramado: id,
      })
      const next = enrichProgramado({ ...item, ordenTrabajoProgramado: id })
      setProgramados((prev) => prev.map((p) => (p.id === next.id ? next : p)))
    } catch (err) {
      alert(errorMessage(err, 'No se pudo asignar a esta OT.'))
    } finally {
      setProgramadoSaving(false)
    }
  }

  async function markProgramadoRealizado(tp: TrabajoProgramado) {
    if (!id || !orden) return
    if (tp.estado === 'realizado') return
    if (
      !confirm(
        `¿Marcar como realizado en esta OT (${displayOtId(orden)})?\n` +
          `Se guardará esta OT como orden de atención.`,
      )
    ) {
      return
    }
    setProgramadoSaving(true)
    try {
      const { item } = await trabajosProgramadosService.update(tp.id, {
        estado: 'realizado',
        ordenTrabajoAtendido: id,
        ordenTrabajoProgramado: tp.ordenTrabajoProgramado || id,
      })
      const next = enrichProgramado({
        ...item,
        estado: 'realizado',
        ordenTrabajoAtendido: id,
        ordenTrabajoProgramado: item.ordenTrabajoProgramado || id,
      })
      setProgramados((prev) => prev.map((p) => (p.id === next.id ? next : p)))
    } catch (err) {
      alert(errorMessage(err, 'No se pudo marcar como realizado.'))
    } finally {
      setProgramadoSaving(false)
    }
  }

  async function deleteProgramado(tp: TrabajoProgramado) {
    if (!confirm(`¿Eliminar trabajo programado "${tp.descripcion || 'sin descripción'}"?`)) return
    try {
      await trabajosProgramadosService.remove(tp.id)
      setProgramados((prev) => prev.filter((p) => p.id !== tp.id))
    } catch (err) {
      alert(errorMessage(err, 'No se pudo eliminar.'))
    }
  }

  async function addRepuesto() {
    if (!id) return
    const { item } = await detalleRepuestosService.create({ otId: id, cantidad: 1, precioVenta: 0 })
    const next = [...repuestosRef.current, item]
    repuestosRef.current = next
    setRepuestos(next)
    await syncOtTotales()
  }

  /** Libera efectos colaterales de una línea (stock / estado cliente). */
  async function releaseRepuestoSideEffects(row: DetalleRepuesto) {
    if (row.repuestoTallerId && !(await isUsingBackend())) {
      const qty = row.cantidad ?? 1
      const updated = await adjustInventarioStock(row.repuestoTallerId, qty)
      patchInventarioLocal(updated)
    }
    if (row.repuestoClienteId) {
      const updated = await unmarkRepuestoClienteInstalado(row.repuestoClienteId)
      patchClienteLocal(updated)
    }
  }

  async function applyTallerSelection(row: DetalleRepuesto, newTallerId: string, cantidad: number) {
    if (row.repuestoClienteId) {
      const reverted = await unmarkRepuestoClienteInstalado(row.repuestoClienteId)
      patchClienteLocal(reverted)
    }

    const server = await isUsingBackend()
    if (!server) {
      if (row.repuestoTallerId && row.repuestoTallerId !== newTallerId) {
        const restored = await adjustInventarioStock(row.repuestoTallerId, row.cantidad ?? 1)
        patchInventarioLocal(restored)
      }
      if (newTallerId) {
        const discounted = await adjustInventarioStock(newTallerId, -cantidad)
        patchInventarioLocal(discounted)
      }
    }

    if (newTallerId) {
      const inv = inventarioRef.current.find((item) => item.id === newTallerId)
      const { item } = await detalleRepuestosService.update(row.id, {
        repuestoTallerId: newTallerId,
        repuestoClienteId: '',
        descripcion: '',
        cantidad,
        precioVenta: inv?.precioVenta ?? row.precioVenta ?? 0,
        precioCompra: inv?.precioCompra ?? 0,
      })
      if (server) {
        await refreshInventarioStock([row.repuestoTallerId, newTallerId])
      }
      return item
    }

    const { item } = await detalleRepuestosService.update(row.id, {
      repuestoTallerId: '',
      precioCompra: 0,
      cantidad,
    })
    if (server && row.repuestoTallerId) {
      await refreshInventarioStock([row.repuestoTallerId])
    }
    return item
  }

  async function applyClienteSelection(row: DetalleRepuesto, newClienteId: string) {
    const server = await isUsingBackend()
    if (row.repuestoTallerId && !server) {
      const restored = await adjustInventarioStock(row.repuestoTallerId, row.cantidad ?? 1)
      patchInventarioLocal(restored)
    }
    if (row.repuestoClienteId && row.repuestoClienteId !== newClienteId) {
      const reverted = await unmarkRepuestoClienteInstalado(row.repuestoClienteId)
      patchClienteLocal(reverted)
    }

    if (newClienteId && id) {
      const marked = await markRepuestoClienteInstalado(newClienteId, id)
      patchClienteLocal(marked)
      const { item } = await detalleRepuestosService.update(row.id, {
        repuestoClienteId: newClienteId,
        repuestoTallerId: '',
        descripcion: '',
        cantidad: 1,
        precioVenta: 0,
        precioCompra: 0,
      })
      if (server && row.repuestoTallerId) await refreshInventarioStock([row.repuestoTallerId])
      return item
    }

    const { item } = await detalleRepuestosService.update(row.id, {
      repuestoClienteId: '',
    })
    return item
  }

  async function changeCantidadTaller(row: DetalleRepuesto, newQty: number) {
    const qty = Math.max(1, Math.floor(newQty) || 1)
    const oldQty = row.cantidad ?? 1
    if (!row.repuestoTallerId || qty === oldQty) {
      const { item } = await detalleRepuestosService.update(row.id, { cantidad: qty })
      return item
    }
    if (await isUsingBackend()) {
      const { item } = await detalleRepuestosService.update(row.id, { cantidad: qty })
      await refreshInventarioStock([row.repuestoTallerId])
      return item
    }
    const deltaStock = oldQty - qty // si qty sube, stock baja
    const updatedInv = await adjustInventarioStock(row.repuestoTallerId, deltaStock)
    patchInventarioLocal(updatedInv)
    const { item } = await detalleRepuestosService.update(row.id, { cantidad: qty })
    return item
  }

  async function onOrigenChange(row: DetalleRepuesto, origen: OrigenRepuesto) {
    setRepuestoError('')
    // Persistir elección en UI de inmediato (sin esto el select de repuesto no aparece)
    setOrigenDraft((d) => ({ ...d, [row.id]: origen }))

    const hadAssignment = Boolean(
      row.repuestoTallerId || row.repuestoClienteId || row.descripcion?.trim(),
    )
    if (!hadAssignment && origen === 'manual') {
      // Solo UI: línea vacía pasa a modo compra rápida
      return
    }
    if (!hadAssignment) return

    setRepuestoBusy(true)
    try {
      await releaseRepuestoSideEffects(row)
      const { item } = await detalleRepuestosService.update(row.id, {
        repuestoTallerId: '',
        repuestoClienteId: '',
        descripcion: origen === 'manual' ? row.descripcion ?? '' : '',
        cantidad: 1,
        precioVenta: origen === 'cliente' ? 0 : row.precioVenta ?? 0,
        precioCompra: 0,
      })
      const next = repuestosRef.current.map((r) => (r.id === row.id ? item : r))
      repuestosRef.current = next
      setRepuestos(next)
      await syncOtTotales()
    } catch (err) {
      setRepuestoError(errorMessage(err, 'No se pudo cambiar el origen'))
      setOrigenDraft((d) => {
        const copy = { ...d }
        delete copy[row.id]
        return copy
      })
      await load()
    } finally {
      setRepuestoBusy(false)
    }
  }

  async function onTallerSelect(row: DetalleRepuesto, tallerId: string) {
    setRepuestoError('')
    setRepuestoBusy(true)
    try {
      const item = await applyTallerSelection(row, tallerId, row.cantidad ?? 1)
      const next = repuestosRef.current.map((r) => (r.id === row.id ? item : r))
      repuestosRef.current = next
      setRepuestos(next)
      await syncOtTotales()
    } catch (err) {
      setRepuestoError(errorMessage(err, 'No se pudo asignar el repuesto de taller'))
      await load()
    } finally {
      setRepuestoBusy(false)
    }
  }

  async function onClienteSelect(row: DetalleRepuesto, clienteId: string) {
    setRepuestoError('')
    setRepuestoBusy(true)
    try {
      const item = await applyClienteSelection(row, clienteId)
      const next = repuestosRef.current.map((r) => (r.id === row.id ? item : r))
      repuestosRef.current = next
      setRepuestos(next)
      await syncOtTotales()
    } catch (err) {
      setRepuestoError(errorMessage(err, 'No se pudo asignar el repuesto del cliente'))
      await load()
    } finally {
      setRepuestoBusy(false)
    }
  }

  async function onCantidadBlur(row: DetalleRepuesto, raw: string) {
    setRepuestoError('')
    setRepuestoBusy(true)
    try {
      // `row.cantidad` sigue siendo la cantidad comprometida (el draft no la muta)
      const item = await changeCantidadTaller(row, Number(raw))
      const next = repuestosRef.current.map((r) => (r.id === row.id ? item : r))
      repuestosRef.current = next
      setRepuestos(next)
      setCantidadDraft((d) => {
        const copy = { ...d }
        delete copy[row.id]
        return copy
      })
      await syncOtTotales()
    } catch (err) {
      setRepuestoError(errorMessage(err, 'No se pudo actualizar la cantidad'))
      setCantidadDraft((d) => {
        const copy = { ...d }
        delete copy[row.id]
        return copy
      })
      await load()
    } finally {
      setRepuestoBusy(false)
    }
  }

  async function updateRepuestoDescripcion(row: DetalleRepuesto, descripcion: string) {
    const { item } = await detalleRepuestosService.update(row.id, {
      descripcion: descripcion.trim(),
      repuestoTallerId: '',
      repuestoClienteId: '',
    })
    const next = repuestosRef.current.map((r) => (r.id === row.id ? item : r))
    repuestosRef.current = next
    setRepuestos(next)
    await syncOtTotales()
  }

  async function updateRepuestoPrecio(row: DetalleRepuesto, precioVenta: number) {
    const { item } = await detalleRepuestosService.update(row.id, { precioVenta: toMoney(precioVenta) })
    const next = repuestosRef.current.map((r) =>
      r.id === row.id
        ? { ...r, ...item, precioVenta: toMoney(item.precioVenta ?? precioVenta) }
        : r,
    )
    repuestosRef.current = next
    setRepuestos(next)
    await syncOtTotales()
  }

  async function deleteRepuesto(row: DetalleRepuesto) {
    const isManual = !row.repuestoTallerId && !row.repuestoClienteId
    const msg = isManual
      ? '¿Eliminar línea de repuesto (compra rápida)?'
      : '¿Eliminar línea de repuesto? Se revertirá el stock o el estado del repuesto de cliente.'
    if (!confirm(msg)) return
    setRepuestoError('')
    setRepuestoBusy(true)
    try {
      await releaseRepuestoSideEffects(row)
      await detalleRepuestosService.remove(row.id)
      const next = repuestosRef.current.filter((r) => r.id !== row.id)
      repuestosRef.current = next
      setRepuestos(next)
      setOrigenDraft((d) => {
        const copy = { ...d }
        delete copy[row.id]
        return copy
      })
      setCantidadDraft((d) => {
        const copy = { ...d }
        delete copy[row.id]
        return copy
      })
      await syncOtTotales()
    } catch (err) {
      setRepuestoError(errorMessage(err, 'No se pudo eliminar el repuesto'))
      await load()
    } finally {
      setRepuestoBusy(false)
    }
  }

  function onCatalogoSelect(row: DetalleTrabajo, trabajoId: string) {
    const cat = catalogo.find((c) => c.id === trabajoId)
    const patch: Partial<DetalleTrabajo> = {
      trabajoId: trabajoId || undefined,
      descripcion: cat?.descripcion ?? row.descripcion,
    }
    if (permissions.canEditOtPrices) {
      patch.precioVenta = toMoney(cat?.precio ?? row.precioVenta)
    }
    updateTrabajo(row, patch)
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 sm:px-8 sm:py-4" style={{ background: '#fff', borderBottom: '1px solid var(--brand-border)' }}>
          <LoadingState />
        </div>
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="p-8">
        <EmptyState
          title="Sin acceso a esta OT"
          description="Solo puedes ver órdenes en proceso de vehículos de tu sede."
        />
        <Link to="/ordenes" className="text-sm font-semibold mt-4 inline-block" style={{ color: 'var(--brand-primary)' }}>
          Volver a órdenes
        </Link>
      </div>
    )
  }

  if (!orden) {
    return (
      <div className="p-8">
        <EmptyState title="OT no encontrada" />
        <Link to="/ordenes" className="text-sm font-semibold mt-4 inline-block" style={{ color: 'var(--brand-primary)' }}>
          Volver a órdenes
        </Link>
      </div>
    )
  }

  const v =
    orden.expand?.vehiculoId ??
    (orden.vehiculoId ? vehiculos.find((veh) => veh.id === orden.vehiculoId) : undefined)

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 py-3 sm:px-8 sm:py-4 shrink-0" style={{ background: '#fff', borderBottom: '1px solid var(--brand-border)' }}>
        <Link to="/ordenes" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 mb-3">
          <ArrowLeft size={14} /> Volver a órdenes
        </Link>
        <div className="flex items-start justify-between gap-3 flex-col sm:flex-row">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>
                OT {displayOtId(orden)}
              </h1>
              {permissions.canSeeOtEstado && <StatusBadge status={orden.estadoFactura} />}
            </div>
            {v && (
              <p className="text-sm text-slate-600 mt-1">
                {permissions.canSeeGestion ? (
                  <Link
                    to={`/vehiculos/${v.id}`}
                    className="font-semibold hover:underline"
                    style={{ color: 'var(--brand-primary)' }}
                  >
                    {displayVehiculoCodigo(v)}
                  </Link>
                ) : (
                  <span className="font-semibold" style={{ color: 'var(--brand-primary)' }}>
                    {displayVehiculoCodigo(v)}
                  </span>
                )}
                {v.placa ? ` · ${v.placa}` : ''}
                {[v.marca, v.modelo].filter(Boolean).length
                  ? ` — ${[v.marca, v.modelo].filter(Boolean).join(' ')}`
                  : ''}
                {v.anio ? ` (${v.anio})` : ''}
              </p>
            )}
            <p className="text-xs text-slate-400 mt-0.5">
              Apertura: {formatDate(orden.fechaApertura)}
              {orden.fechaCierre ? ` · Cierre: ${formatDate(orden.fechaCierre)}` : ''}
              {' · '}Km: {orden.kilometraje ?? '—'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap w-full sm:w-auto">
            {permissions.canExportOtPdf && (
              <Button
                variant="secondary"
                size="sm"
                icon={<FileDown size={14} />}
                onClick={() => void handleExportPdf()}
                disabled={pdfPreview.busy}
                className="flex-1 sm:flex-initial"
              >
                {pdfPreview.busy ? 'Generando...' : 'Exportar PDF'}
              </Button>
            )}
            {(permissions.ot.editDatosCompletos || permissions.ot.editKilometrajeOnly) && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Pencil size={14} />}
                onClick={openEditDatos}
                className="flex-1 sm:flex-initial"
              >
                {permissions.ot.editKilometrajeOnly && !permissions.ot.editDatosCompletos
                  ? 'Editar km'
                  : 'Editar datos'}
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4 sm:px-8 sm:py-6">
        <div className="flex flex-col-reverse lg:flex-row gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex gap-2 mb-4 flex-wrap">
              {(
                [
                  ['trabajos', 'Trabajos', true],
                  ['repuestos', `Repuestos${historialSolicitadosVehiculo.length ? ` (${historialSolicitadosVehiculo.length})` : ''}`, canSeeRepuestosTab],
                  ['programados', `Programados${programados.length ? ` (${programados.length})` : ''}`, permissions.ot.editProgramados],
                  ['notas', 'Notas', permissions.ot.viewDescripcionSolicitud || permissions.ot.editComentarios],
                  ['archivos', `Archivos${mediaCount ? ` (${mediaCount})` : ''}`, permissions.ot.editArchivos],
                ] as const
              )
                .filter(([, , visible]) => visible)
                .map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{
                    background: tab === key ? 'var(--brand-primary-soft)' : 'var(--brand-muted-bg)',
                    color: tab === key ? 'var(--brand-primary)' : '#6B7280',
                    border: `1px solid ${tab === key ? 'var(--brand-primary-muted)' : 'var(--brand-border)'}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'trabajos' && (
              <Card>
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--brand-border)' }}>
                  <div>
                    <SectionTitle>Detalle trabajos</SectionTitle>
                    {canReorderTrabajos && trabajosVisibles.length > 1 && (
                      <p className="text-xs text-slate-400 mt-1">
                        Arrastra el icono ≡ para cambiar el orden (también en el PDF).
                      </p>
                    )}
                  </div>
                  {permissions.ot.editTrabajos && (
                    <Button
                      size="sm"
                      icon={<Plus size={14} />}
                      onClick={addTrabajo}
                      disabled={reordenSaving}
                    >
                      Agregar
                    </Button>
                  )}
                </div>
                {trabajosVisibles.length === 0 ? (
                  <EmptyState
                    title="Sin trabajos"
                    description={
                      permissions.ot.viewOnlyOwnTrabajos
                        ? 'Aún no has registrado trabajos en esta OT.'
                        : 'Agrega líneas de trabajo a esta OT.'
                    }
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: 'var(--brand-table-head)' }}>
                          {(() => {
                            const cols: string[] = []
                            if (canReorderTrabajos) cols.push('#')
                            if (permissions.ot.useCatalogoTrabajos) cols.push('Catálogo')
                            cols.push('Descripción')
                            if (permissions.ot.editTrabajoTecnico) cols.push('Técnico')
                            if (permissions.ot.editTrabajoProveedor) cols.push('Proveedor')
                            if (permissions.canSeeOtPrices) cols.push('Precio venta')
                            cols.push('')
                            return cols
                          })().map((h) => (
                            <th key={h || 'a'} className="text-left text-xs font-semibold uppercase tracking-wider px-3 py-2 text-slate-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {trabajosVisibles.map((row, rowIndex) => (
                          <tr
                            key={row.id}
                            className="border-t"
                            style={{
                              borderColor: 'var(--brand-border)',
                              background:
                                dragOverTrabajoId === row.id
                                  ? 'var(--brand-primary-soft)'
                                  : undefined,
                              opacity: reordenSaving ? 0.7 : 1,
                            }}
                            onDragOver={(e) => onTrabajoDragOver(e, row.id)}
                            onDrop={(e) => e.preventDefault()}
                          >
                            {canReorderTrabajos && (
                              <td className="px-2 py-2 w-12 align-top">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    draggable={!reordenSaving}
                                    onDragStart={(e) => {
                                      e.dataTransfer.effectAllowed = 'move'
                                      e.dataTransfer.setData('text/plain', row.id)
                                      onTrabajoDragStart(row.id)
                                    }}
                                    onDragEnd={() => void onTrabajoDragEnd()}
                                    className="p-1 rounded cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
                                    title="Arrastrar para reordenar"
                                    aria-label="Arrastrar para reordenar"
                                    disabled={reordenSaving}
                                  >
                                    <GripVertical size={16} />
                                  </button>
                                  <span className="text-xs font-semibold text-slate-400 w-4 text-center">
                                    {row.indice ?? rowIndex + 1}
                                  </span>
                                </div>
                              </td>
                            )}
                            {permissions.ot.useCatalogoTrabajos && (
                            <td className="px-3 py-2 min-w-[172px] max-w-[230px] w-[18%]">
                              <SearchableSelect
                                className="text-xs"
                                items={catalogo}
                                value={row.trabajoId ?? ''}
                                onChange={(trabajoId) => onCatalogoSelect(row, trabajoId)}
                                getOptionValue={(c) => c.id}
                                getOptionLabel={catalogoLabel}
                                filterItem={matchesCatalogo}
                                placeholder="Buscar por descripción o código..."
                                emptyLabel="— Manual —"
                              />
                            </td>
                            )}
                            <td className="px-3 py-2 min-w-[280px] w-[40%]">
                              <Textarea
                                className="text-xs min-h-[2.5rem] resize-y"
                                rows={2}
                                value={row.descripcion ?? ''}
                                onChange={(e) => setTrabajos(trabajos.map((t) => t.id === row.id ? { ...t, descripcion: e.target.value } : t))}
                                onBlur={(e) => updateTrabajo(row, { descripcion: e.target.value })}
                                disabled={!permissions.ot.editTrabajos || reordenSaving}
                              />
                            </td>
                            {permissions.ot.editTrabajoTecnico && (
                            <td className="px-3 py-2 min-w-[160px] w-[16%] max-w-[200px]">
                              <Select
                                className="text-xs"
                                value={row.tecnicoId ?? ''}
                                onChange={(e) => updateTrabajo(row, { tecnicoId: e.target.value || undefined })}
                                disabled={!permissions.ot.editTrabajos || reordenSaving}
                              >
                                <option value="">—</option>
                                {tecnicos
                                  .filter((t) => t.estado === true || t.id === row.tecnicoId)
                                  .map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.nombre}
                                      {t.estado !== true ? ' (inactivo)' : ''}
                                    </option>
                                  ))}
                              </Select>
                              {row.tecnicoId && permissions.canSeeGestion && (
                                <Link
                                  to={`/tecnicos/${row.tecnicoId}`}
                                  className="text-[10px] font-semibold hover:underline mt-0.5 inline-block"
                                  style={{ color: 'var(--brand-primary)' }}
                                >
                                  Ver ficha
                                </Link>
                              )}
                            </td>
                            )}
                            {permissions.ot.editTrabajoProveedor && (
                            <td className="px-3 py-2 min-w-[160px] w-[14%]">
                              <Select
                                className="text-xs"
                                value={row.proveedorId ?? ''}
                                onChange={(e) => updateTrabajo(row, { proveedorId: e.target.value || undefined })}
                                disabled={!permissions.ot.editTrabajos || reordenSaving}
                              >
                                <option value="">—</option>
                                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                              </Select>
                            </td>
                            )}
                            {permissions.canSeeOtPrices && (
                            <td className="px-3 py-2 min-w-[120px] w-[12%]">
                              <Input
                                className="text-xs w-full min-w-[7rem]"
                                type="number"
                                value={numberInputValue(row.precioVenta)}
                                onChange={(e) => {
                                  const precioVenta = parseNumberInput(e.target.value)
                                  setTrabajos((prev) =>
                                    prev.map((t) => (t.id === row.id ? { ...t, precioVenta } : t)),
                                  )
                                }}
                                onBlur={(e) =>
                                  updateTrabajo(row, { precioVenta: parseNumberInput(e.target.value) })
                                }
                                disabled={!permissions.canEditOtPrices || reordenSaving}
                              />
                            </td>
                            )}
                            <td className="px-3 py-2">
                              {permissions.ot.editTrabajos && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteTrabajo(row)}
                                  disabled={reordenSaving}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {tab === 'repuestos' && (
              <div className="space-y-6">
              {permissions.ot.viewHistorialPedidosCliente && orden.vehiculoId && (
                <Card>
                  <div
                    className="px-4 py-3"
                    style={{ borderBottom: '1px solid var(--brand-border)' }}
                  >
                    <SectionTitle>Historial pendiente del vehículo</SectionTitle>
                    <p className="text-xs text-slate-400 mt-1">
                      Repuestos en estado «solicitado» o «recibido» de esta unidad con fecha de ayer o
                      anterior. Los pedidos de hoy solo aparecen en «Pedidos al cliente» de su OT.
                    </p>
                  </div>
                  {historialSolicitadosVehiculo.length === 0 ? (
                    <EmptyState
                      title="Sin historial pendiente"
                      description="No hay pedidos «solicitado» o «recibido» de ayer o antes para este vehículo."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: 'var(--brand-table-head)' }}>
                            {['Descripción', 'Km', 'Estado', 'Solicitud', 'OT origen', 'Proveedor'].map(
                              (h) => (
                                <th
                                  key={h}
                                  className="text-left text-xs font-semibold uppercase tracking-wider px-3 py-2 text-slate-500"
                                >
                                  {h}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {historialSolicitadosVehiculo.map((r) => {
                            const otOrigen = r.expand?.otSolicitudId
                            const esEstaOt = r.otSolicitudId === id
                            return (
                              <tr
                                key={r.id}
                                className="border-t"
                                style={{
                                  borderColor: 'var(--brand-border)',
                                  background: esEstaOt ? 'var(--brand-primary-soft)' : undefined,
                                }}
                              >
                                <td className="px-3 py-2 text-slate-800">
                                  {r.descripcion || '—'}
                                </td>
                                <td className="px-3 py-2 text-slate-600 tabular-nums">
                                  {r.kilometraje != null ? r.kilometraje : '—'}
                                </td>
                                <td className="px-3 py-2">
                                  <RepuestoEstadoBadge estado={r.estado} />
                                </td>
                                <td className="px-3 py-2 text-slate-600">
                                  {formatDate(r.fechaSolicitud)}
                                </td>
                                <td className="px-3 py-2">
                                  {esEstaOt ? (
                                    <span className="text-xs font-semibold" style={{ color: 'var(--brand-primary)' }}>
                                      Esta OT
                                    </span>
                                  ) : otOrigen ? (
                                    <Link
                                      to={`/ordenes/${otOrigen.id}`}
                                      className="font-mono text-xs font-semibold hover:underline"
                                      style={{ color: 'var(--brand-primary)' }}
                                    >
                                      {displayOtId(otOrigen)}
                                    </Link>
                                  ) : r.otSolicitudId ? (
                                    <Link
                                      to={`/ordenes/${r.otSolicitudId}`}
                                      className="font-mono text-xs font-semibold hover:underline"
                                      style={{ color: 'var(--brand-primary)' }}
                                    >
                                      Ver OT
                                    </Link>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-slate-600">
                                  {r.proveedorEntrega || '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              )}

              {(permissions.ot.editPedidosCliente || permissions.ot.viewHistorialPedidosCliente) && (
              <Card>
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--brand-border)' }}>
                  <div>
                    <SectionTitle>Pedidos al cliente</SectionTitle>
                    <p className="text-xs text-slate-400 mt-1">
                      Solicitudes de repuestos al cliente vinculadas a esta OT
                    </p>
                  </div>
                  {permissions.ot.editPedidosCliente && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<PackagePlus size={14} />}
                    onClick={openSolicitudCliente}
                    disabled={!orden.vehiculoId}
                    title={!orden.vehiculoId ? 'Asigna un vehículo a la OT primero' : undefined}
                  >
                    Solicitar repuesto
                  </Button>
                  )}
                </div>
                {pedidosCliente.length === 0 ? (
                  <EmptyState
                    title="Sin pedidos al cliente"
                    description="Crea una solicitud en estado «solicitado» para pedir un repuesto al cliente."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: 'var(--brand-table-head)' }}>
                          {(
                            permissions.ot.editPedidosCliente
                              ? ['Descripción', 'Km', 'Estado', 'Solicitud', 'Proveedor', '']
                              : ['Descripción', 'Km', 'Estado', 'Solicitud', 'Proveedor']
                          ).map((h) => (
                            <th
                              key={h || 'a'}
                              className="text-left text-xs font-semibold uppercase tracking-wider px-3 py-2 text-slate-500"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pedidosCliente.map((r) => (
                          <tr key={r.id} className="border-t" style={{ borderColor: 'var(--brand-border)' }}>
                            <td className="px-3 py-2 text-slate-800">{r.descripcion || '—'}</td>
                            <td className="px-3 py-2 text-slate-600 tabular-nums">
                              {r.kilometraje != null ? r.kilometraje : '—'}
                            </td>
                            <td className="px-3 py-2">
                              <RepuestoEstadoBadge estado={r.estado} />
                            </td>
                            <td className="px-3 py-2 text-slate-600">{formatDate(r.fechaSolicitud)}</td>
                            <td className="px-3 py-2 text-slate-600">{r.proveedorEntrega || '—'}</td>
                            {permissions.ot.editPedidosCliente && (
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={r.estado === 'instalado'}
                                  onClick={() => openEditPedidoCliente(r)}
                                  aria-label="Editar pedido"
                                  title={
                                    r.estado === 'instalado'
                                      ? 'No se puede editar: ya instalado'
                                      : 'Editar pedido'
                                  }
                                >
                                  <Pencil size={14} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={r.estado === 'instalado'}
                                  onClick={() => void deletePedidoCliente(r)}
                                  aria-label="Eliminar pedido"
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
              )}

              {permissions.ot.editRepuestosTaller && (
              <Card>
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--brand-border)' }}>
                  <SectionTitle>Detalle repuestos</SectionTitle>
                  <Button size="sm" icon={<Plus size={14} />} onClick={addRepuesto} disabled={repuestoBusy}>
                    Agregar
                  </Button>
                </div>
                {repuestoError && (
                  <div
                    className="mx-4 mt-3 rounded-lg px-3 py-2 text-sm"
                    style={{ background: 'var(--brand-danger-bg)', color: 'var(--brand-danger)' }}
                    role="alert"
                  >
                    {repuestoError}
                  </div>
                )}
                {repuestos.length === 0 ? (
                  <EmptyState
                    title="Sin repuestos"
                    description="Stock del taller, provisto por cliente, o compra rápida con precio manual."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: 'var(--brand-table-head)' }}>
                          {(
                            permissions.canSeeOtPrices
                              ? ['Origen', 'Repuesto', 'Cant.', 'Precio venta', 'Subtotal', '']
                              : ['Origen', 'Repuesto', 'Cant.', '']
                          ).map((h) => (
                            <th
                              key={h || 'a'}
                              className="text-left text-xs font-semibold uppercase tracking-wider px-3 py-2 text-slate-500"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {repuestos.map((row) => {
                          const origen = resolveOrigen(row)
                          const clienteOpts = clienteOptionsForRow(row, repuestos, repuestosCliente, orden)
                          const isCliente = origen === 'cliente'
                          const isManual = origen === 'manual'
                          const canEditCantidad =
                            !repuestoBusy &&
                            ((origen === 'taller' && Boolean(row.repuestoTallerId)) || isManual)
                          const canEditPrecio =
                            !repuestoBusy &&
                            !isCliente &&
                            permissions.canEditOtPrices &&
                            (origen === 'taller' || isManual)
                          return (
                            <tr key={row.id} className="border-t" style={{ borderColor: 'var(--brand-border)' }}>
                              <td className="px-3 py-2">
                                <Select
                                  className="text-xs"
                                  value={origen}
                                  disabled={repuestoBusy}
                                  onChange={(e) => void onOrigenChange(row, e.target.value as OrigenRepuesto)}
                                >
                                  <option value="">— Elegir —</option>
                                  <option value="taller">Stock taller</option>
                                  <option value="cliente">Provisto por cliente</option>
                                  <option value="manual">Compra rápida</option>
                                </Select>
                              </td>
                              <td className="px-3 py-2 min-w-[220px]">
                                {origen === 'taller' && (
                                  <Select
                                    className="text-xs"
                                    value={row.repuestoTallerId ?? ''}
                                    disabled={repuestoBusy}
                                    onChange={(e) => void onTallerSelect(row, e.target.value)}
                                  >
                                    <option value="">— Seleccionar —</option>
                                    {inventario.map((i) => {
                                      const stock = i.stockActual ?? 0
                                      const selected = i.id === row.repuestoTallerId
                                      return (
                                        <option key={i.id} value={i.id} disabled={stock <= 0 && !selected}>
                                          {i.nombreRepuesto ?? 'Sin nombre'} (stock: {stock})
                                        </option>
                                      )
                                    })}
                                  </Select>
                                )}
                                {origen === 'cliente' && (
                                  <Select
                                    className="text-xs"
                                    value={row.repuestoClienteId ?? ''}
                                    disabled={repuestoBusy}
                                    onChange={(e) => void onClienteSelect(row, e.target.value)}
                                  >
                                    <option value="">— Seleccionar —</option>
                                    {clienteOpts.map((r) => (
                                      <option key={r.id} value={r.id}>
                                        {r.descripcion || 'Sin descripción'}
                                        {r.estado === 'instalado' ? ' (instalado)' : ` · ${r.estado ?? ''}`}
                                      </option>
                                    ))}
                                  </Select>
                                )}
                                {origen === 'manual' && (
                                  <Input
                                    className="text-xs"
                                    value={row.descripcion ?? ''}
                                    disabled={repuestoBusy}
                                    placeholder="Descripción del repuesto comprado"
                                    onChange={(e) =>
                                      setRepuestos(
                                        repuestos.map((r) =>
                                          r.id === row.id ? { ...r, descripcion: e.target.value } : r,
                                        ),
                                      )
                                    }
                                    onBlur={(e) => void updateRepuestoDescripcion(row, e.target.value)}
                                  />
                                )}
                                {!origen && (
                                  <span className="text-xs text-slate-400">Elige origen primero</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <Input
                                  className="text-xs w-16"
                                  type="number"
                                  min={1}
                                  disabled={!canEditCantidad}
                                  value={cantidadDraft[row.id] ?? String(row.cantidad ?? 1)}
                                  onChange={(e) =>
                                    setCantidadDraft((d) => ({ ...d, [row.id]: e.target.value }))
                                  }
                                  onBlur={(e) => void onCantidadBlur(row, e.target.value)}
                                  title={
                                    isCliente
                                      ? 'Cantidad fija en 1 para repuestos del cliente'
                                      : isManual
                                        ? 'Cantidad de la compra rápida'
                                        : undefined
                                  }
                                />
                              </td>
                              {permissions.canSeeOtPrices && (
                              <>
                              <td className="px-3 py-2">
                                <Input
                                  className="text-xs w-24"
                                  type="number"
                                  disabled={!canEditPrecio}
                                  value={numberInputValue(row.precioVenta)}
                                  onChange={(e) => {
                                    const precioVenta = parseNumberInput(e.target.value)
                                    setRepuestos((prev) =>
                                      prev.map((r) => (r.id === row.id ? { ...r, precioVenta } : r)),
                                    )
                                  }}
                                  onBlur={(e) =>
                                    void updateRepuestoPrecio(row, parseNumberInput(e.target.value))
                                  }
                                  title={
                                    isCliente
                                      ? 'Repuesto del cliente: sin cargo'
                                      : isManual
                                        ? 'Precio de venta de la compra rápida'
                                        : undefined
                                  }
                                />
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {formatCurrency(lineRepuestoVenta(row))}
                              </td>
                              </>
                              )}
                              <td className="px-3 py-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={repuestoBusy}
                                  onClick={() => void deleteRepuesto(row)}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
              )}
              </div>
            )}

            {tab === 'programados' && permissions.ot.editProgramados && (
              <Card>
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: '1px solid var(--brand-border)' }}
                >
                  <div>
                    <SectionTitle>Trabajos programados</SectionTitle>
                    <p className="text-xs text-slate-400 mt-1">
                      Todos los programados del vehículo. Al agregar se guarda esta OT como programación;
                      al marcar realizado se guarda como atención.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    icon={<Plus size={14} />}
                    onClick={openCreateProgramado}
                    disabled={!orden.vehiculoId || programadoSaving}
                    title={!orden.vehiculoId ? 'Asigna un vehículo a la OT primero' : undefined}
                  >
                    Agregar
                  </Button>
                </div>
                {programados.length === 0 ? (
                  <EmptyState
                    title="Sin trabajos programados"
                    description="No hay trabajos programados para este vehículo. Agrega uno desde esta OT."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: 'var(--brand-table-head)' }}>
                          {[
                            'Catálogo',
                            'Descripción',
                            'Fecha',
                            'Estado',
                            'OT programada',
                            'OT atendida',
                            '',
                          ].map((h) => (
                            <th
                              key={h || 'a'}
                              className="text-left text-xs font-semibold uppercase tracking-wider px-3 py-2 text-slate-500"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {programados.map((tp) => {
                          const pendiente = tp.estado !== 'realizado'
                          const sinAsignar = !tp.ordenTrabajoProgramado
                          const otProg = tp.expand?.ordenTrabajoProgramado
                          const otAten = tp.expand?.ordenTrabajoAtendido
                          return (
                            <tr key={tp.id} className="border-t" style={{ borderColor: 'var(--brand-border)' }}>
                              <td className="px-3 py-2 text-slate-600">
                                {tp.expand?.trabajoId?.codigoTrabajo || '—'}
                              </td>
                              <td className="px-3 py-2 font-medium text-slate-800">
                                {tp.descripcion || tp.expand?.trabajoId?.descripcion || '—'}
                              </td>
                              <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                                {formatDate(tp.fechaSugerida)}
                              </td>
                              <td className="px-3 py-2">
                                <ProgramadoEstadoBadge estado={tp.estado} />
                              </td>
                              <td className="px-3 py-2 font-mono text-xs text-slate-600">
                                {displayOtId(
                                  otProg ??
                                    (tp.ordenTrabajoProgramado === id ? orden : undefined),
                                )}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs text-slate-600">
                                {displayOtId(
                                  otAten ??
                                    (tp.ordenTrabajoAtendido === id ? orden : undefined),
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex justify-end gap-1 flex-wrap">
                                  {pendiente && sinAsignar && (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      disabled={programadoSaving}
                                      onClick={() => void asignarProgramadoAEstaOt(tp)}
                                    >
                                      Asignar
                                    </Button>
                                  )}
                                  {pendiente && (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      icon={<Check size={14} />}
                                      disabled={programadoSaving}
                                      onClick={() => void markProgramadoRealizado(tp)}
                                      title="Marcar realizado en esta OT"
                                    >
                                      Realizado
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditProgramado(tp)}
                                    aria-label="Editar"
                                  >
                                    <Pencil size={14} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => void deleteProgramado(tp)}
                                    aria-label="Eliminar"
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {tab === 'notas' && (
              <Card className="p-5 space-y-4">
                {permissions.ot.viewDescripcionSolicitud && (
                  <Field label="Descripción solicitud">
                    <Textarea
                      value={notas.descripcionSolicitud}
                      onChange={(e) => setNotas({ ...notas, descripcionSolicitud: e.target.value })}
                      disabled={!permissions.ot.editDescripcionSolicitud}
                      readOnly={!permissions.ot.editDescripcionSolicitud}
                    />
                  </Field>
                )}
                {permissions.ot.editComentarios && (
                  <Field label="Comentarios">
                    <Textarea
                      value={notas.comentarios}
                      onChange={(e) => setNotas({ ...notas, comentarios: e.target.value })}
                    />
                  </Field>
                )}
                {(permissions.ot.editComentarios || permissions.ot.editDescripcionSolicitud) && (
                  <Button onClick={saveNotas} disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar notas'}
                  </Button>
                )}
              </Card>
            )}

            {tab === 'archivos' && permissions.ot.editArchivos && (
              <OtMediaPanel orden={orden} onOrdenUpdated={applyOrdenUpdate} />
            )}
          </div>

          <aside className="w-full lg:w-72 shrink-0">
            <Card className="p-5 space-y-4 lg:sticky lg:top-0">
              <SectionTitle>Resumen</SectionTitle>
              {permissions.ot.viewTotales ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Trabajos</span>
                    <span className="font-semibold">{formatCurrency(subtotalTrabajos)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Repuestos</span>
                    <span className="font-semibold">{formatCurrency(subtotalRepuestos)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t" style={{ borderColor: 'var(--brand-border)' }}>
                    <span className="font-bold text-slate-800">Total venta</span>
                    <span className="font-bold" style={{ color: 'var(--brand-primary)' }}>{formatCurrency(totalVenta)}</span>
                  </div>
                </div>
              ) : permissions.sede ? (
                <p className="text-xs text-slate-400">Sede {permissions.sede}</p>
              ) : null}

              {permissions.ot.editEstadoOc && permissions.canSeeOtEstado ? (
                <>
                  <Field label="Estado de la OT">
                    <Select
                      value={sidebar.estadoFactura}
                      onChange={(e) => {
                        const next = e.target.value as EstadoFactura
                        const facturacionPatch = patchFechaFacturacionPorEstado(
                          sidebar.estadoFactura,
                          next,
                          sidebar.fechaFacturacion,
                        )
                        setSidebar({
                          ...sidebar,
                          estadoFactura: next,
                          fechaFacturacion: facturacionPatch.fechaFacturacion ?? sidebar.fechaFacturacion,
                        })
                      }}
                    >
                      {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                    </Select>
                  </Field>
                  <Field label="Fecha envío OC">
                    <Input type="date" value={sidebar.fechaEnvioOC} onChange={(e) => setSidebar({ ...sidebar, fechaEnvioOC: e.target.value })} />
                  </Field>
                  <Field label="Fecha recepción OC">
                    <Input type="date" value={sidebar.fechaRecepcionOC} onChange={(e) => setSidebar({ ...sidebar, fechaRecepcionOC: e.target.value })} />
                  </Field>
                  <Field label="Fecha facturación">
                    <Input type="date" value={sidebar.fechaFacturacion} onChange={(e) => setSidebar({ ...sidebar, fechaFacturacion: e.target.value })} />
                  </Field>
                  <Button className="w-full" onClick={saveSidebar} disabled={saving}>{saving ? 'Guardando...' : 'Guardar estado'}</Button>
                </>
              ) : null}
            </Card>
          </aside>
        </div>
      </div>

      <OtFormModal
        open={editOpen}
        title={
          permissions.ot.editKilometrajeOnly && !permissions.ot.editDatosCompletos
            ? `Kilometraje · OT ${displayOtId(orden)}`
            : `Editar OT ${displayOtId(orden)}`
        }
        form={editForm}
        onChange={setEditForm}
        vehiculos={
          permissions.otFilterBySede && permissions.sede
            ? vehiculos.filter((veh) => veh.sede === permissions.sede)
            : vehiculos
        }
        saving={editSaving}
        onClose={() => {
          setEditOpen(false)
          setIdInternoError('')
        }}
        onSubmit={() => void saveEditDatos()}
        submitLabel="Guardar cambios"
        recordId={orden.id}
        idInternoError={idInternoError}
        onClearIdInternoError={() => setIdInternoError('')}
        variant={
          permissions.ot.editKilometrajeOnly && !permissions.ot.editDatosCompletos
            ? 'kilometraje'
            : 'full'
        }
        showEstadoOc={permissions.canSeeOtEstado}
      />

      <Modal
        open={solicitudOpen}
        title={editingPedido ? 'Editar pedido al cliente' : 'Solicitar repuesto al cliente'}
        onClose={closeSolicitudModal}
        footer={
          <>
            <Button variant="secondary" onClick={closeSolicitudModal}>
              Cancelar
            </Button>
            <Button
              onClick={() => void saveSolicitudCliente()}
              disabled={solicitudSaving || !solicitudForm.descripcion.trim()}
            >
              {solicitudSaving
                ? 'Guardando...'
                : editingPedido
                  ? 'Guardar cambios'
                  : 'Crear pedido'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {!editingPedido && (
            <p className="text-sm text-slate-500">
              Se creará un registro en bodega (repuestos cliente) en estado{' '}
              <strong>solicitado</strong>, vinculado a esta OT y al vehículo de la orden.
            </p>
          )}
          <Field label="Descripción *">
            <Textarea
              value={solicitudForm.descripcion}
              onChange={(e) => setSolicitudForm({ ...solicitudForm, descripcion: e.target.value })}
              placeholder="Ej. Sensor ABS trasero izquierdo original"
              rows={3}
            />
          </Field>
          <Field label="Kilometraje">
            <Input
              type="number"
              value={
                editingPedido
                  ? editingPedido.kilometraje ?? ''
                  : orden?.kilometraje ?? ''
              }
              readOnly
              disabled
              className="bg-slate-50"
            />
            <p className="mt-1 text-xs text-slate-400">
              {editingPedido
                ? 'Km guardado en el pedido (solo lectura).'
                : 'Se toma del kilometraje de esta OT al crear el pedido.'}
            </p>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Fecha solicitud">
              <Input
                type="date"
                value={solicitudForm.fechaSolicitud}
                onChange={(e) => setSolicitudForm({ ...solicitudForm, fechaSolicitud: e.target.value })}
              />
            </Field>
            <Field label="Proveedor / entrega">
              <Input
                value={solicitudForm.proveedorEntrega}
                onChange={(e) =>
                  setSolicitudForm({ ...solicitudForm, proveedorEntrega: e.target.value })
                }
                placeholder="Opcional"
              />
            </Field>
            {editingPedido && (
              <Field label="Estado" className="sm:col-span-2">
                <Select
                  value={solicitudForm.estado}
                  onChange={(e) =>
                    setSolicitudForm({
                      ...solicitudForm,
                      estado: e.target.value as EstadoRepuestoCliente,
                    })
                  }
                >
                  <option value="solicitado">solicitado</option>
                  <option value="recibido">recibido</option>
                </Select>
              </Field>
            )}
          </div>
          {solicitudError && (
            <p
              className="text-sm rounded-lg px-3 py-2"
              style={{ background: 'var(--brand-danger-bg)', color: 'var(--brand-danger)' }}
              role="alert"
            >
              {solicitudError}
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={programadoOpen}
        title={editingProgramado ? 'Editar trabajo programado' : 'Programar trabajo'}
        onClose={() => {
          setProgramadoOpen(false)
          setEditingProgramado(null)
          setProgramadoError('')
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setProgramadoOpen(false)
                setEditingProgramado(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void saveProgramado()}
              disabled={
                programadoSaving ||
                (!programadoForm.trabajoId && !programadoForm.descripcion.trim())
              }
            >
              {programadoSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Quedará vinculado a esta OT (<strong>{displayOtId(orden)}</strong>) y al vehículo de la orden.
          </p>
          <Field label="Trabajo del catálogo">
            <SearchableSelect
              items={catalogo}
              value={programadoForm.trabajoId}
              onChange={(trabajoId) => {
                const cat = catalogo.find((c) => c.id === trabajoId)
                setProgramadoForm((f) => ({
                  ...f,
                  trabajoId,
                  descripcion: f.descripcion.trim() ? f.descripcion : cat?.descripcion || '',
                }))
              }}
              getOptionValue={(c) => c.id}
              getOptionLabel={catalogoLabel}
              filterItem={matchesCatalogo}
              placeholder="Buscar por código o descripción..."
              emptyLabel="— Opcional —"
            />
          </Field>
          <Field label="Descripción">
            <Textarea
              value={programadoForm.descripcion}
              onChange={(e) => setProgramadoForm({ ...programadoForm, descripcion: e.target.value })}
              placeholder="Detalle del trabajo a programar"
              rows={3}
            />
          </Field>
          <Field label="Fecha sugerida">
            <Input
              type="date"
              value={programadoForm.fechaSugerida}
              onChange={(e) =>
                setProgramadoForm({ ...programadoForm, fechaSugerida: e.target.value })
              }
            />
          </Field>
          <p className="text-xs text-slate-400">
            Estado inicial: pendiente. Usa el botón <strong>Realizado</strong> en la tabla para
            atenderlo y registrar esta OT.
          </p>
          {programadoError && (
            <p
              className="text-sm rounded-lg px-3 py-2"
              style={{ background: 'var(--brand-danger-bg)', color: 'var(--brand-danger)' }}
              role="alert"
            >
              {programadoError}
            </p>
          )}
        </div>
      </Modal>

      <PdfPreviewModal
        open={pdfPreview.open}
        title={pdfPreview.title}
        url={pdfPreview.url}
        blob={pdfPreview.blob}
        filename={pdfPreview.filename}
        loading={pdfPreview.loading}
        error={pdfPreview.error}
        onClose={pdfPreview.close}
      />
    </div>
  )
}
