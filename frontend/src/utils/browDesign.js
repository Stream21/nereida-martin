export const BROW_DESIGN_PRIMERA = 'brow-design-primera'
export const BROW_DESIGN_SEGUIMIENTO = 'brow-design-seguimiento'
export const BROW_DESIGN_DEFINE = 'brow-define'
export const PERFILADO_CONJUNTO_ID = 'perfilado-conjunto'

/** Solo perfilado puro (primera / mantenimiento), no Brow Define ni laminados. */
export const PERFILADO_TREATMENT_IDS = [BROW_DESIGN_PRIMERA, BROW_DESIGN_SEGUIMIENTO]

export function isPerfiladoTreatment(treatmentId) {
  return PERFILADO_TREATMENT_IDS.includes(treatmentId)
}

export function isJointTreatment(treatmentId) {
  return treatmentId === PERFILADO_CONJUNTO_ID
}

/** Lunes (YYYY-MM-DD) de la semana ISO-like (lun–dom) en zona local del navegador. */
export function mondayOfLocalDate(date) {
  const d = startOfLocalDay(date)
  const dow = d.getDay()
  const offset = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + offset)
  return formatLocalYmd(d)
}

function startOfLocalDay(date) {
  const d = date instanceof Date ? new Date(date) : new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatLocalYmd(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isDateInBlockedPerfiladoWeek(date, blockedWeekMondays = []) {
  if (!blockedWeekMondays?.length) return false
  return blockedWeekMondays.includes(mondayOfLocalDate(date))
}

export const BROW_DESIGN_DECLARED = 'brow-design'
export const MICRO_SOFT_PIXEL = 'micropigmentacion-soft-pixel'

export const BROW_DESIGN_TRIO = [
  BROW_DESIGN_PRIMERA,
  BROW_DESIGN_SEGUIMIENTO,
  BROW_DESIGN_DEFINE,
]

/** Orden fijo en Cejas: perfilados juntos, conjunto justo debajo, luego el resto. */
const TREATMENT_DISPLAY_ORDER = [
  BROW_DESIGN_PRIMERA,
  BROW_DESIGN_SEGUIMIENTO,
  PERFILADO_CONJUNTO_ID,
  BROW_DESIGN_DEFINE,
  'brow-lami',
  'brow-lami-define',
  'brow-henna',
  'brow-restored',
  'micropigmentacion-soft-pixel',
  'lash-lift-korean',
  'skin-reset',
  'skin-boost',
  'labio-superior',
  'depilacion-facial',
  'smile-gem',
]

function mergeDoneIds(treatmentIds = [], declaredPriorTreatments = []) {
  const ids = new Set(treatmentIds)
  if (declaredPriorTreatments.includes(BROW_DESIGN_DECLARED)) {
    ids.add(BROW_DESIGN_PRIMERA)
  }
  declaredPriorTreatments.forEach((id) => ids.add(id))
  return ids
}

export function hasAnyBrowDesignHistory(treatmentIds = [], declaredPriorTreatments = []) {
  const done = mergeDoneIds(treatmentIds, declaredPriorTreatments)
  return BROW_DESIGN_TRIO.some((id) => done.has(id))
}

export function shouldShowBrowDesignPrimera(treatmentIds = [], declaredPriorTreatments = []) {
  return !hasAnyBrowDesignHistory(treatmentIds, declaredPriorTreatments)
}

export function shouldShowBrowDesignFollowUps(treatmentIds = [], declaredPriorTreatments = []) {
  return hasAnyBrowDesignHistory(treatmentIds, declaredPriorTreatments)
}

export function hasBrowDesignHistoryInDb(treatmentIds = []) {
  return BROW_DESIGN_TRIO.some((id) => treatmentIds.includes(id))
}

/** Tras identificación con intent=mantenimiento: mantenimiento si hay Perfilado en BD, si no primera vez. */
export function resolveMaintenanceBooking(treatmentIds = []) {
  if (hasBrowDesignHistoryInDb(treatmentIds)) {
    return {
      mode: 'maintenance',
      treatmentId: BROW_DESIGN_SEGUIMIENTO,
      skipQuestionnaire: true,
      notice: null,
    }
  }
  return {
    mode: 'primera',
    treatmentId: BROW_DESIGN_PRIMERA,
    skipQuestionnaire: false,
    notice:
      'No encontramos Perfilado previo en tu historial con nosotros. Para mantenimiento necesitas haberlo realizado antes; hemos preparado tu cita de primera vez.',
  }
}

export function sortTreatmentsForDisplay(items, catalogTreatments = []) {
  const catalogOrder = new Map(catalogTreatments.map((t, index) => [t.id, index]))
  return [...items].sort((a, b) => {
    const ia = TREATMENT_DISPLAY_ORDER.indexOf(a.id)
    const ib = TREATMENT_DISPLAY_ORDER.indexOf(b.id)
    const pa = ia === -1 ? 1000 : ia
    const pb = ib === -1 ? 1000 : ib
    if (pa !== pb) return pa - pb
    return (catalogOrder.get(a.id) ?? 999) - (catalogOrder.get(b.id) ?? 999)
  })
}

export function filterTreatmentsForClient(treatments, { treatmentIds = [], declaredPriorTreatments = [] } = {}) {
  const showPrimera = shouldShowBrowDesignPrimera(treatmentIds, declaredPriorTreatments)
  const showFollowUps = shouldShowBrowDesignFollowUps(treatmentIds, declaredPriorTreatments)

  return treatments.filter((t) => {
    if (!BROW_DESIGN_TRIO.includes(t.id)) return true
    if (showPrimera && t.id === BROW_DESIGN_PRIMERA) return true
    if (showFollowUps && t.id !== BROW_DESIGN_PRIMERA) return true
    return false
  })
}

export function buildPriorTreatmentOptions(treatments) {
  const options = []
  const seen = new Set()

  for (const t of treatments) {
    if (t.id === BROW_DESIGN_PRIMERA || t.id === BROW_DESIGN_SEGUIMIENTO) {
      if (!seen.has(BROW_DESIGN_DECLARED)) {
        seen.add(BROW_DESIGN_DECLARED)
        options.push({
          id: BROW_DESIGN_DECLARED,
          label: 'Perfilado',
          tag: 'Primera vez o mantenimiento',
          category: 'cejas',
        })
      }
      continue
    }
    // Micro no se reserva online; se inyecta al final para historial declarado
    if (t.id === MICRO_SOFT_PIXEL) continue
    seen.add(t.id)
    options.push({
      id: t.id,
      label: t.name,
      tag: t.tag,
      category: t.category,
    })
  }

  // Siempre disponible en «tratamientos realizados» aunque esté inactive en catálogo
  const fromCatalog = treatments.find((t) => t.id === MICRO_SOFT_PIXEL)
  options.push({
    id: MICRO_SOFT_PIXEL,
    label: fromCatalog?.name || 'Soft Pixel Brow',
    tag: fromCatalog?.tag || 'Micropigmentación efecto polvo',
    category: fromCatalog?.category || 'cejas',
  })

  return options
}

export function shouldAskPriorHistory(lookupData) {
  if (!lookupData) return true
  if (lookupData.isKnownClient || lookupData.visitCount > 0) return false
  if (lookupData.treatmentIds?.length > 0) return false
  // Ya respondió antes (queda en clients.declared_profile)
  if (lookupData.client?.declaredProfile) return false
  return true
}

/** Solo citas confirmadas en nuestra base de datos (no declaraciones del cliente). */
export function treatmentDoneInDb(lookupData, treatmentId) {
  return lookupData?.treatmentIds?.includes(treatmentId) ?? false
}

/** Tratamientos que requieren cuestionario de aptitud (tinte, laminado, henna, micropigmentación, faciales, etc.). */
export const TREATMENTS_WITH_APTITUDE_QUESTIONNAIRE = new Set([
  'brow-define',
  'brow-lami',
  'brow-lami-define',
  'brow-henna',
  'brow-restored',
  'micropigmentacion-soft-pixel',
  'lash-lift-korean',
  'skin-reset',
  'skin-boost',
])

export function requiresAptitudeQuestionnaire(treatmentId) {
  return TREATMENTS_WITH_APTITUDE_QUESTIONNAIRE.has(treatmentId)
}
