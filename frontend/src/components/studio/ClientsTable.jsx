import { useEffect, useRef, useState } from 'react'
import Icon from '../ui/Icon'
import {
  createClient,
  disableClient,
  enableClient,
  fetchClients,
  importClientsFile,
  inviteClient,
} from '../../utils/ownerApi'

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

function statusLabel(client) {
  if (client.accountStatus === 'disabled') return 'Desactivada'
  if (client.accountStatus === 'active') return 'Activa'
  if (!client.phone && !client.phoneNormalized) return 'Sin teléfono'
  if (client.hasInvite) return 'Invitada'
  return 'Pendiente'
}

function statusClass(client) {
  if (client.accountStatus === 'disabled') return 'bg-error-container text-error'
  if (client.accountStatus === 'active') return 'bg-primary/15 text-primary'
  if (!client.phone && !client.phoneNormalized) return 'bg-surface-container text-on-surface-variant'
  return 'bg-tertiary-container/40 text-on-surface'
}

export default function ClientsTable() {
  const [search, setSearch] = useState('')
  const [data, setData] = useState({ clients: [], total: 0, page: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', phone: '', email: '' })
  const [addError, setAddError] = useState('')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef(null)

  const reload = () => {
    setLoading(true)
    fetchClients({ search, page: 1, limit: 100 })
      .then((res) => setData(res))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchClients({ search, page: 1, limit: 100 })
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
  }, [search])

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
      reload()
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
      reload()
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
          <button
            type="submit"
            className="rounded-xl bg-primary text-on-primary px-4 py-2 text-sm"
          >
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
                    <span className={`inline-block text-xs rounded-full px-2.5 py-1 ${statusClass(client)}`}>
                      {statusLabel(client)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{client.bookingCount}</td>
                  <td className="px-4 py-3 text-primary">{formatEuro(client.totalSpent)}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{formatDate(client.lastBookingAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5 min-w-[8.5rem]">
                      {client.accountStatus !== 'active' && client.accountStatus !== 'disabled' && (
                        <button
                          type="button"
                          disabled={busyId === client.id}
                          onClick={() => handleCopyInvite(client)}
                          className="text-left text-xs font-medium text-primary hover:underline disabled:opacity-50"
                        >
                          Copiar enlace
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === client.id}
                        onClick={() => handleToggleAccess(client)}
                        className="text-left text-xs text-on-surface-variant hover:text-on-surface disabled:opacity-50"
                      >
                        {client.accountStatus === 'disabled' ? 'Reactivar' : 'Desactivar'}
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
      <p className="text-xs text-on-surface-variant">{data.total} clientes en total</p>
    </div>
  )
}
