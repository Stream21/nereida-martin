import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Icon from '../ui/Icon'
import {
  fetchClients,
  createOwnerGroupBooking,
  fetchOwnerGroupAvailability,
  fetchOwnerGroupPreview,
} from '../../utils/ownerApi'
import { clientAccountStatusMeta, formatEuro } from '../../utils/studioFormat'
import {
  GROUP_BOOKING_MAX,
  GROUP_BOOKING_MIN,
  GROUP_DEFAULT_PERSON_MINUTES,
} from '../../utils/browDesign'

function formatDurationLabel(minutes) {
  if (!minutes) return ''
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const r = minutes % 60
    return r > 0 ? `${h} h ${r} min` : `${h} h`
  }
  return `${minutes} min`
}

function AccountStatusBadge({ client }) {
  if (!client || client.accountStatus === 'active') return null
  const status = clientAccountStatusMeta(client)
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1 text-[10px] rounded-full pl-1.5 pr-2 py-0.5 ${status.className}`}
    >
      <Icon name={status.icon} className="text-sm" />
      {status.label}
    </span>
  )
}

function ClientSlotPicker({ index, selection, excludeIds, onPick, onClear }) {
  const [search, setSearch] = useState('')
  const [focused, setFocused] = useState(false)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const requestIdRef = useRef(0)

  const excludeKey = excludeIds.map(String).join(',')

  useEffect(() => {
    if (selection?.clientId) return undefined

    const query = search.trim()
    if (!focused || query.length < 2) {
      setResults([])
      setLoading(false)
      return undefined
    }

    const requestId = ++requestIdRef.current

    const timer = window.setTimeout(() => {
      setLoading(true)
      fetchClients({ search: query, page: 1, limit: 12 })
        .then((res) => {
          if (requestId !== requestIdRef.current) return
          const taken = new Set(excludeKey ? excludeKey.split(',').filter(Boolean) : [])
          setResults(
            (res.clients || []).filter(
              (c) => c.accountStatus !== 'disabled' && !taken.has(String(c.id))
            )
          )
          setLoading(false)
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return
          setResults([])
          setLoading(false)
        })
    }, 300)

    return () => {
      clearTimeout(timer)
    }
  }, [search, focused, selection?.clientId, excludeKey])

  const showDropdown = focused && !selection?.clientId && search.trim().length >= 2

  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-background px-3 py-3">
      <p className="text-[11px] font-medium text-on-surface-variant mb-1.5">
        Clienta {index + 1}
      </p>
      {selection?.clientId ? (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-on-surface">{selection.clientName}</p>
              <AccountStatusBadge client={selection} />
            </div>
            {selection.clientPhone ? (
              <p className="text-xs text-on-surface-variant mt-0.5">{selection.clientPhone}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setResults([])
              setFocused(false)
              onClear()
            }}
            className="cursor-pointer text-xs text-primary font-medium min-h-9 px-2 shrink-0"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              window.setTimeout(() => setFocused(false), 160)
            }}
            placeholder="Nombre o teléfono (mín. 2 caracteres)…"
            autoComplete="off"
            className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2.5 text-sm min-h-11"
          />
          {loading && (
            <p className="text-[11px] text-on-surface-variant mt-1.5 px-0.5">Buscando…</p>
          )}
          {showDropdown && !loading && results.length === 0 && (
            <p className="text-[11px] text-on-surface-variant mt-1.5 px-0.5">
              {excludeKey
                ? 'No hay más clientas con ese criterio (puede que ya esté en el grupo).'
                : 'No hay clientas con ese criterio.'}
            </p>
          )}
          {showDropdown && results.length > 0 && (
            <div className="absolute left-0 right-0 z-10 mt-1 max-h-36 overflow-y-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0_8px_24px_rgba(67,61,60,0.12)]">
              {results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSearch('')
                    setResults([])
                    setFocused(false)
                    onPick(c)
                  }}
                  className="cursor-pointer w-full text-left px-3 py-2.5 text-sm hover:bg-surface-container-low min-h-11 border-b border-outline-variant/15 last:border-b-0"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-on-surface">{c.name}</span>
                      {c.phone ? (
                        <span className="text-on-surface-variant"> · {c.phone}</span>
                      ) : null}
                    </span>
                    <AccountStatusBadge client={c} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CreateGroupBookingModal({
  initialDate,
  initialTime,
  gapStart,
  gapEnd,
  initialComplimentary = false,
  onClose,
  onCreated,
}) {
  const [participantCount, setParticipantCount] = useState(GROUP_BOOKING_MIN)
  const [selections, setSelections] = useState(() =>
    Array.from({ length: GROUP_BOOKING_MIN }, () => null)
  )
  const [durationMinutes, setDurationMinutes] = useState(GROUP_DEFAULT_PERSON_MINUTES)
  const [date, setDate] = useState(initialDate ? format(initialDate, 'yyyy-MM-dd') : '')
  const [time, setTime] = useState('')
  const gapTimeHintRef = useRef(initialTime || null)
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [pricePreview, setPricePreview] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const gapMinutes = gapStart != null && gapEnd != null ? gapEnd - gapStart : null
  const hasGap = gapMinutes != null && gapMinutes > 0

  const selectedClientIds = useMemo(
    () => selections.map((s) => s?.clientId).filter((id) => id != null),
    [selections]
  )
  const allClientsSelected =
    selectedClientIds.length === participantCount &&
    new Set(selectedClientIds).size === participantCount
  const totalMinutes = durationMinutes * participantCount
  const scheduleReady = allClientsSelected && durationMinutes > 0
  const canSubmit = scheduleReady && date && time && !submitting
  const hasPresetSlot = Boolean(initialDate && initialTime)

  useEffect(() => {
    setSelections((prev) =>
      Array.from({ length: participantCount }, (_, i) => prev[i] || null)
    )
    setTime('')
    gapTimeHintRef.current = initialTime || null
    setPricePreview(null)
  }, [participantCount, initialTime])

  useEffect(() => {
    if (!allClientsSelected) {
      setPricePreview(null)
      return undefined
    }
    let cancelled = false
    setLoadingPreview(true)
    fetchOwnerGroupPreview(selectedClientIds)
      .then((res) => {
        if (!cancelled) setPricePreview(res)
      })
      .catch(() => {
        if (!cancelled) setPricePreview(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false)
      })
    return () => {
      cancelled = true
    }
  }, [allClientsSelected, selectedClientIds])

  useEffect(() => {
    if (!scheduleReady || !date) {
      setSlots([])
      return undefined
    }
    let cancelled = false
    setLoadingSlots(true)
    fetchOwnerGroupAvailability({
      date,
      clientIds: selectedClientIds,
      durationMinutes,
    })
      .then((res) => {
        if (cancelled) return
        const available = (res.slots || []).filter((s) => s.available)
        setSlots(available)
        const hint = gapTimeHintRef.current
        if (hint && available.some((s) => s.time === hint)) {
          setTime(hint)
          gapTimeHintRef.current = null
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false)
      })
    return () => {
      cancelled = true
    }
  }, [scheduleReady, date, selectedClientIds, durationMinutes])

  useEffect(() => {
    setTime('')
    gapTimeHintRef.current = initialTime || null
  }, [date, durationMinutes, participantCount, selectedClientIds.join(','), initialTime])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) {
      setError('Completa todas las clientas, fecha y hora')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createOwnerGroupBooking({
        clientIds: selectedClientIds,
        date,
        time,
        durationMinutes,
      })
      onCreated?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedSlot = slots.find((s) => s.time === time)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-on-surface/35 backdrop-blur-[2px] p-0 sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-surface-container-lowest shadow-[0_20px_50px_rgba(67,61,60,0.14)] p-5 sm:p-6 space-y-4 safe-pb"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-headline text-xl text-on-surface">Perfilado en grupo</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              De {GROUP_BOOKING_MIN} a {GROUP_BOOKING_MAX} clientas
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer p-2.5 min-h-11 min-w-11 rounded-full hover:bg-surface-container"
            aria-label="Cerrar"
          >
            <Icon name="close" />
          </button>
        </div>

        {hasPresetSlot && (
          <div className="rounded-2xl bg-primary/8 border border-primary/15 px-4 py-3">
            <p className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
              Hueco seleccionado
            </p>
            <p className="text-sm font-medium text-on-surface mt-0.5 tabular-nums">
              {format(initialDate, "EEEE d 'de' MMMM", { locale: es })}
              {initialTime ? ` · ${initialTime}` : ''}
            </p>
            {initialComplimentary && (
              <p className="text-xs text-on-surface-variant mt-1">Fuera de horario público</p>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low px-4 py-3">
          <p className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
            Cuántas clientas
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={participantCount <= GROUP_BOOKING_MIN}
              onClick={() => setParticipantCount((n) => Math.max(GROUP_BOOKING_MIN, n - 1))}
              className="cursor-pointer min-h-11 min-w-11 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-lg disabled:opacity-40"
              aria-label="Menos clientas"
            >
              −
            </button>
            <p className="text-sm font-medium text-on-surface tabular-nums">
              {participantCount} clientas
            </p>
            <button
              type="button"
              disabled={participantCount >= GROUP_BOOKING_MAX}
              onClick={() => setParticipantCount((n) => Math.min(GROUP_BOOKING_MAX, n + 1))}
              className="cursor-pointer min-h-11 min-w-11 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-lg disabled:opacity-40"
              aria-label="Más clientas"
            >
              +
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
            Clientas del grupo
          </p>
          {selections.map((selection, index) => (
            <ClientSlotPicker
              key={index}
              index={index}
              selection={selection}
              excludeIds={selectedClientIds.filter(
                (id) => id !== selection?.clientId
              )}
              onPick={(client) => {
                setSelections((prev) => {
                  const next = [...prev]
                  next[index] = {
                    clientId: client.id,
                    clientName: client.name,
                    clientPhone: client.phone || '',
                    accountStatus: client.accountStatus,
                    hasInvite: Boolean(client.hasInvite),
                  }
                  return next
                })
              }}
              onClear={() => {
                setSelections((prev) => {
                  const next = [...prev]
                  next[index] = null
                  return next
                })
              }}
            />
          ))}
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low px-4 py-3">
          <p className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
            Tiempo por clienta
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setDurationMinutes((d) => Math.max(15, d - 15))}
              className="cursor-pointer min-h-11 min-w-11 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-lg"
              aria-label="Reducir 15 minutos"
            >
              −
            </button>
            <div className="text-center">
              <p className="text-sm font-medium text-on-surface tabular-nums">
                {formatDurationLabel(durationMinutes)}
              </p>
              <p className="text-[11px] text-on-surface-variant">
                Total · {formatDurationLabel(totalMinutes)}
                {hasGap ? ` · hueco ${formatDurationLabel(gapMinutes)}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = durationMinutes + 15
                if (hasGap && next > gapMinutes) return
                setDurationMinutes(next)
              }}
              disabled={hasGap && durationMinutes + 15 > gapMinutes}
              className="cursor-pointer min-h-11 min-w-11 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-lg disabled:opacity-40"
              aria-label="Aumentar 15 minutos"
            >
              +
            </button>
          </div>
        </div>

        {scheduleReady && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block min-w-0">
              <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
                Fecha
              </span>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-outline-variant/40 bg-background px-3 py-3 text-sm min-h-11"
              />
            </label>
            <label className="block min-w-0">
              <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
                Hora de inicio
              </span>
              {loadingSlots ? (
                <p className="mt-1.5 text-sm text-on-surface-variant min-h-11 flex items-center">
                  Cargando…
                </p>
              ) : slots.length === 0 ? (
                <p className="mt-1.5 text-sm text-on-surface-variant min-h-11 flex items-center">
                  Sin huecos para {participantCount} clientas
                </p>
              ) : (
                <select
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-outline-variant/40 bg-background px-3 py-3 text-sm min-h-11"
                >
                  <option value="">Selecciona hora…</option>
                  {slots.map((s) => (
                    <option key={s.time} value={s.time}>
                      {s.time} – {s.endTime} ({formatDurationLabel(s.totalMinutes)})
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>
        )}

        {allClientsSelected && (
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 space-y-2">
            <p className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
              Resumen y precio
            </p>
            {loadingPreview ? (
              <p className="text-sm text-on-surface-variant">Calculando precios…</p>
            ) : pricePreview?.participants?.length ? (
              <>
                {pricePreview.participants.map((row) => (
                  <div
                    key={row.clientId}
                    className="flex items-start justify-between gap-3 text-sm border-b border-outline-variant/20 last:border-b-0 pb-2 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-on-surface">
                        {row.position}. {row.clientName}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {row.treatmentName}
                        {row.treatmentTag ? ` · ${row.treatmentTag}` : ''}
                      </p>
                    </div>
                    <p className="text-sm text-on-surface shrink-0 tabular-nums">
                      {formatEuro(row.price)}
                    </p>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-outline-variant/25">
                  <p className="text-sm font-medium text-on-surface">Total estimado</p>
                  <p className="text-base font-semibold text-primary tabular-nums">
                    {formatEuro(pricePreview.totalPrice)}
                  </p>
                </div>
              </>
            ) : null}
          </div>
        )}

        {time && selectedSlot && (
          <div className="rounded-2xl bg-primary/5 border border-primary/15 px-4 py-3 space-y-2">
            <p className="text-xs font-label font-bold tracking-widest uppercase text-primary">
              Horario de cada clienta
            </p>
            {(selectedSlot.memberTimes || []).map((m) => (
              <p key={m.position} className="text-sm text-on-surface">
                <span className="text-on-surface-variant">{m.position}.</span>{' '}
                {selections[m.position - 1]?.clientName || `Clienta ${m.position}`}
                <span className="text-on-surface-variant tabular-nums">
                  {' '}
                  · {m.time} – {m.endTime}
                </span>
              </p>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="cursor-pointer w-full rounded-2xl bg-primary text-on-primary py-3.5 min-h-12 text-sm font-medium disabled:opacity-60"
        >
          {submitting
            ? 'Creando…'
            : pricePreview?.totalPrice != null
              ? `Confirmar · ${formatEuro(pricePreview.totalPrice)}`
              : `Confirmar grupo (${participantCount})`}
        </button>
      </form>
    </div>
  )
}
