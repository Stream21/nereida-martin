import { useEffect, useRef, useState } from 'react'
import Icon from '../ui/Icon'
import {
  createClient,
  disableClient,
  enableClient,
  fetchClient,
  fetchClients,
  importClientsFile,
  inviteClient,
  updateClient,
} from '../../utils/ownerApi'

const PAGE_SIZE = 10

function formatEuro(value) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function ContactCell({ client }) {
  const email = client.email?.trim()
  const phone = client.phone?.trim()

  if (email && phone) {
    return (
      <div className="leading-snug">
        <div className="text-on-surface">{email}</div>
        <div className="text-xs text-on-surface-variant mt-0.5">{phone}</div>
      </div>
    )
  }
  if (email) return <div className="text-on-surface">{email}</div>
  if (phone) return <div className="text-on-surface">{phone}</div>
  return <span className="text-on-surface-variant">Sin contacto</span>
}

function statusMeta(client) {
  if (client.accountStatus === 'disabled') {
    return { icon: 'block', label: 'Desactivada', className: 'bg-error-container text-error' }
  }
  if (client.accountStatus === 'active') {
    return { icon: 'check_circle', label: 'Activa', className: 'bg-primary/15 text-primary' }
  }
  if (!client.phone && !client.phoneNormalized) {
    return {
      icon: 'phone_disabled',
      label: 'Sin teléfono',
      className: 'bg-surface-container text-on-surface-variant',
    }
  }
  if (client.hasInvite) {
    return {
      icon: 'mail',
      label: 'Invitada',
      className: 'bg-tertiary-container/40 text-on-surface',
    }
  }
  return {
    icon: 'schedule',
    label: 'Pendiente',
    className: 'bg-tertiary-container/40 text-on-surface',
  }
}

function ClientFichaModal({ clientId, onClose, onSaved }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' })
  const [history, setHistory] = useState([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchClient(clientId)
      .then((res) => {
        if (cancelled) return
        const c = res.client
        setForm({
          name: c.name || '',
          email: c.email || '',
          phone: c.phone || '',
          notes: c.notes || '',
        })
        setHistory(c.history || [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clientId])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await updateClient(clientId, form)
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-surface-container-lowest shadow-xl">
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-outline-variant/20 bg-surface-container-lowest">
          <h3 className="font-headline text-lg text-on-surface">Ficha del cliente</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-surface-container">
            <Icon name="close" />
          </button>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-on-surface-variant">Cargando…</p>
        ) : (
          <form onSubmit={handleSave} className="p-5 space-y-4">
            <label className="block">
              <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
                Nombre
              </span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-outline-variant px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
                Email
              </span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-outline-variant px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
                Teléfono
              </span>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-outline-variant px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
                Notas internas
              </span>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Alergias, preferencias, observaciones…"
                className="mt-1 w-full rounded-xl border border-outline-variant px-3 py-2.5 text-sm outline-none focus:border-primary resize-none"
              />
            </label>

            {error && <p className="text-sm text-error">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-2xl bg-primary text-on-primary py-3 text-sm font-medium disabled:opacity-60"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>

            <div className="pt-2 border-t border-outline-variant/20">
              <p className="text-[10px] font-label font-bold tracking-widest uppercase text-primary mb-3">
                Historial de citas
              </p>
              {history.length === 0 ? (
                <p className="text-sm text-on-surface-variant">Sin citas registradas.</p>
              ) : (
                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {history.map((b) => (
                    <li
                      key={b.id}
                      className="rounded-xl bg-surface-container-low px-3 py-2 text-sm"
                    >
                      <div className="font-medium text-on-surface">
                        {b.treatmentName || 'Cita'}
                      </div>
                      <div className="text-xs text-on-surface-variant">
                        {formatDateTime(b.startTime)} · {b.status}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ClientsTable() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ clients: [], total: 0, page: 1, limit: PAGE_SIZE })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', phone: '', email: '' })
  const [addError, setAddError] = useState('')
  const [importing, setImporting] = useState(false)
  const [fichaId, setFichaId] = useState(null)
  const fileRef = useRef(null)

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE))

  const reload = (nextPage = page) => {
    setLoading(true)
    fetchClients({ search, page: nextPage, limit: PAGE_SIZE })
      .then((res) => setData(res))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setPage(1)
  }, [search])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchClients({ search, page, limit: PAGE_SIZE })
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [search, page])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const handleCopyInvite = async (client) => {
    setBusyId(client.id)
    setError('')
    try {
      const result = await inviteClient(client.id)
      let url = result.inviteUrl || ''
      if (url && !/^https?:\/\//i.test(url)) {
        url = `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`
      }
      await navigator.clipboard.writeText(url)
      showToast('Enlace copiado; envíalo por WhatsApp')
      reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const handleToggleAccess = async (client) => {
    setBusyId(client.id)
    setError('')
    try {
      if (client.accountStatus === 'disabled') {
        await enableClient(client.id)
        showToast('Acceso reactivado')
      } else {
        await disableClient(client.id)
        showToast('Acceso desactivado')
      }
      reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setAddError('')
    try {
      await createClient(addForm)
      setShowAdd(false)
      setAddForm({ name: '', phone: '', email: '' })
      showToast('Contacto añadido')
      reload(1)
      setPage(1)
    } catch (err) {
      setAddError(err.message)
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true)
    setError('')
    try {
      const summary = await importClientsFile(file)
      showToast(
        `Importación: ${summary.created} nuevas, ${summary.updated} actualizadas, ${summary.skipped} omitidas`
      )
      reload(1)
      setPage(1)
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email o teléfono…"
          className="w-full sm:max-w-sm rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-on-surface outline-none focus:border-primary"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-primary text-on-primary px-4 py-2.5 text-sm font-medium"
          >
            <Icon name="person_add" className="text-base" />
            Añadir
          </button>
          <button
            type="button"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface disabled:opacity-60"
          >
            <Icon name="upload_file" className="text-base" />
            {importing ? 'Importando…' : 'Importar Excel'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>

      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 space-y-3"
        >
          <p className="text-sm font-medium text-on-surface">Nuevo contacto</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              required
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nombre"
              className="rounded-xl border border-outline-variant px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={addForm.phone}
              onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Teléfono"
              className="rounded-xl border border-outline-variant px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              type="email"
              value={addForm.email}
              onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="Email (opcional)"
              className="rounded-xl border border-outline-variant px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          {addError && <p className="text-sm text-error">{addError}</p>}
          <button type="submit" className="rounded-xl bg-primary text-on-primary px-4 py-2 text-sm">
            Guardar
          </button>
        </form>
      )}

      {toast && (
        <p className="text-sm text-primary bg-primary/10 rounded-xl px-3 py-2">{toast}</p>
      )}
      {error && <p className="text-sm text-error">{error}</p>}
      {loading && <p className="text-sm text-on-surface-variant">Cargando clientes…</p>}

      <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(28,25,23,0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-container-low text-on-surface-variant text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Citas</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Última cita</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.clients.map((client) => (
                <tr key={client.id} className="border-t border-outline-variant/40">
                  <td className="px-4 py-3 text-on-surface">{client.name}</td>
                  <td className="px-4 py-3">
                    <ContactCell client={client} />
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const s = statusMeta(client)
                      return (
                        <span
                          title={s.label}
                          className={`inline-flex items-center gap-1 text-xs rounded-full pl-1.5 pr-2.5 py-1 ${s.className}`}
                        >
                          <Icon name={s.icon} className="text-sm" />
                          <span className="hidden sm:inline">{s.label}</span>
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3">{client.bookingCount}</td>
                  <td className="px-4 py-3 text-primary">{formatEuro(client.totalSpent)}</td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {formatDate(client.lastBookingAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setFichaId(client.id)}
                        title="Editar ficha"
                        aria-label="Editar ficha"
                        className="cursor-pointer p-2 rounded-xl text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Icon name="edit" className="text-lg" />
                      </button>
                      {client.accountStatus !== 'active' && client.accountStatus !== 'disabled' && (
                        <button
                          type="button"
                          disabled={busyId === client.id}
                          onClick={() => handleCopyInvite(client)}
                          title="Copiar enlace de invitación"
                          aria-label="Copiar enlace de invitación"
                          className="cursor-pointer p-2 rounded-xl text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                        >
                          <Icon name="link" className="text-lg" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === client.id}
                        onClick={() => handleToggleAccess(client)}
                        title={
                          client.accountStatus === 'disabled'
                            ? 'Reactivar acceso'
                            : 'Desactivar acceso'
                        }
                        aria-label={
                          client.accountStatus === 'disabled'
                            ? 'Reactivar acceso'
                            : 'Desactivar acceso'
                        }
                        className="cursor-pointer p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
                      >
                        <Icon
                          name={client.accountStatus === 'disabled' ? 'person_add' : 'person_off'}
                          className="text-lg"
                        />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && data.clients.length === 0 && (
          <p className="px-4 py-6 text-sm text-on-surface-variant">No hay clientes que coincidan.</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-on-surface-variant">{data.total} clientes en total</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            title="Página anterior"
            aria-label="Página anterior"
            className="cursor-pointer rounded-xl border border-outline-variant p-2 disabled:opacity-40 hover:bg-surface-container transition-colors"
          >
            <Icon name="chevron_left" className="text-lg" />
          </button>
          <span className="text-xs text-on-surface-variant tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            title="Página siguiente"
            aria-label="Página siguiente"
            className="cursor-pointer rounded-xl border border-outline-variant p-2 disabled:opacity-40 hover:bg-surface-container transition-colors"
          >
            <Icon name="chevron_right" className="text-lg" />
          </button>
        </div>
      </div>

      {fichaId && (
        <ClientFichaModal
          clientId={fichaId}
          onClose={() => setFichaId(null)}
          onSaved={() => {
            showToast('Ficha actualizada')
            reload()
          }}
        />
      )}
    </div>
  )
}
