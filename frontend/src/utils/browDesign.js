export const BROW_DESIGN_PRIMERA = 'brow-design-primera'
export const BROW_DESIGN_SEGUIMIENTO = 'brow-design-seguimiento'
export const BROW_DESIGN_DEFINE = 'brow-define'
export const BROW_DESIGN_DECLARED = 'brow-design'

export const BROW_DESIGN_TRIO = [
  BROW_DESIGN_PRIMERA,
  BROW_DESIGN_SEGUIMIENTO,
  BROW_DESIGN_DEFINE,
]

const BROW_DISPLAY_PRIORITY = {
  [BROW_DESIGN_PRIMERA]: 0,
  [BROW_DESIGN_SEGUIMIENTO]: 1,
  [BROW_DESIGN_DEFINE]: 2,
}

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
    const pa = BROW_DISPLAY_PRIORITY[a.id]
    const pb = BROW_DISPLAY_PRIORITY[b.id]
    if (pa != null && pb != null) return pa - pb
    if (pa != null) return -1
    if (pb != null) return 1
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
    options.push({
      id: t.id,
      label: t.name,
      tag: t.tag,
      category: t.category,
    })
  }

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
