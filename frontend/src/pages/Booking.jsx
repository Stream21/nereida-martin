import { useState, useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from '../components/ui/Icon'
import StepClientInfo from '../components/booking/StepClientInfo'
import StepPriorTreatments from '../components/booking/StepPriorTreatments'
import StepQuestionnaire from '../components/booking/StepQuestionnaire'
import StepTreatmentConfirm from '../components/booking/StepTreatmentConfirm'
import StepTreatments from '../components/booking/StepTreatments'
import { shouldAskPriorHistory, resolveMaintenanceBooking, hasBrowDesignHistoryInDb, BROW_DESIGN_SEGUIMIENTO, requiresAptitudeQuestionnaire } from '../utils/browDesign'
import { requiresPhotoAssessment } from '../utils/photoAssessment'
import StepHennaAssessment from '../components/booking/StepHennaAssessment'
import StepAvailability from '../components/booking/StepAvailability'
import StepSummary from '../components/booking/StepSummary'
import BookingSuccess from '../components/booking/BookingSuccess'
import { saveClientProfile } from '../utils/clientSession'
import { isValidPhone } from '../utils/validation'
import { getClientToken, updateClientProfile } from '../utils/clientAuth'
import { useClientAuth } from '../hooks/useClientAuth'

const API_URL = import.meta.env.VITE_API_URL || ''

function authHeaders(extra = {}) {
  const token = getClientToken()
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const CATEGORIES = [
  { id: 'cejas', label: 'Cejas', icon: 'visibility' },
  { id: 'pestanas', label: 'Pestañas', icon: 'remove_red_eye' },
  { id: 'rostro', label: 'Rostro', icon: 'spa' },
  { id: 'depilacion', label: 'Depilación', icon: 'content_cut' },
  { id: 'smile', label: 'Tendencias', icon: 'diamond' },
]

const STEP_META = {
  identify: 'Identificación',
  prior_history: 'Historial',
  treatment: 'Tratamiento',
  treatment_confirm: 'Confirmación',
  treatment_q: 'Aptitud',
  henna: 'Valoración',
  calendar: 'Fecha',
  summary: 'Resumen',
}

const stepVariants = {
  enter: (dir) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
}

function resolveDeclaredProfile(lookupData, studioHabitual) {
  if (lookupData?.isKnownClient || lookupData?.visitCount > 0) return 'returning_known'
  if (studioHabitual === true) return 'returning_declared'
  if (studioHabitual === false) return 'first_time'
  if (lookupData?.client?.declaredProfile) return lookupData.client.declaredProfile
  if (lookupData?.client) return 'returning_declared'
  return 'first_time'
}

function buildFlow({
  needsTreatmentConfirm,
  needsTreatmentQuestionnaire,
  needsPhotoAssessment,
  skipTreatment,
  skipQuestionnaires,
  skipPhotoAssessment,
  skipIdentify,
  skipPriorHistory,
}) {
  const flow = []
  if (!skipIdentify) flow.push('identify')
  if (!skipPriorHistory) flow.push('prior_history')
  if (!skipTreatment) flow.push('treatment')
  if (!skipQuestionnaires && needsTreatmentConfirm) flow.push('treatment_confirm')
  if (!skipQuestionnaires && needsTreatmentQuestionnaire) flow.push('treatment_q')
  if (!skipPhotoAssessment && needsPhotoAssessment) flow.push('henna')
  flow.push('calendar', 'summary')
  return flow
}

function stepIndexAfter(flow, fromStep, offset = 1) {
  const idx = flow.indexOf(fromStep)
  return idx >= 0 ? idx + offset : 0
}

export default function Booking() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const preselectedTreatmentId = searchParams.get('treatment')
  const bookingIntent = searchParams.get('intent')
  const { user: authUser, loading: authLoading } = useClientAuth()

  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [skipIdentify, setSkipIdentify] = useState(false)
  const [skipPriorHistoryFlag, setSkipPriorHistoryFlag] = useState(false)
  const [identityBootstrapped, setIdentityBootstrapped] = useState(false)
  const [skipTreatment, setSkipTreatment] = useState(false)
  const [skipQuestionnaires, setSkipQuestionnaires] = useState(false)
  const [skipHenna, setSkipHenna] = useState(false)

  const [clientInfo, setClientInfo] = useState({ name: '', email: '', phone: '' })
  const [consents, setConsents] = useState([])
  const [lookupData, setLookupData] = useState(null)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [consentError, setConsentError] = useState(null)
  const [studioHabitual, setStudioHabitual] = useState(null)
  const [declaredPriorTreatments, setDeclaredPriorTreatments] = useState([])
  const [priorHistoryError, setPriorHistoryError] = useState(null)

  const [treatmentAnswers, setTreatmentAnswers] = useState({})
  const [intakeSignature, setIntakeSignature] = useState(null)
  const [signerName, setSignerName] = useState('')
  const [needsTreatmentConfirm, setNeedsTreatmentConfirm] = useState(false)
  const [needsTreatmentQuestionnaire, setNeedsTreatmentQuestionnaire] = useState(false)

  const [selectedTreatment, setSelectedTreatment] = useState(null)
  const [hennaAssessmentId, setHennaAssessmentId] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedTime, setSelectedTime] = useState(null)

  const [treatments, setTreatments] = useState([])
  const [loadingTreatments, setLoadingTreatments] = useState(true)
  const [treatmentsError, setTreatmentsError] = useState(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookingResult, setBookingResult] = useState(null)
  const [bookingError, setBookingError] = useState(null)
  const [infoNotice, setInfoNotice] = useState(null)

  const treatmentIdsForPhoto = lookupData?.treatmentIds || []
  const needsPhotoAssessment = requiresPhotoAssessment(selectedTreatment?.id, {
    treatmentIds: treatmentIdsForPhoto,
  })
  const showConsents = !lookupData?.hasAllBaseConsents
  const needsPriorHistory =
    !skipPriorHistoryFlag &&
    shouldAskPriorHistory(lookupData) &&
    !authUser?.declaredProfile &&
    bookingIntent !== 'mantenimiento'

  const effectiveClientProfile = useMemo(
    () => ({
      ...lookupData,
      declaredPriorTreatments,
    }),
    [lookupData, declaredPriorTreatments]
  )

  const flow = useMemo(
    () => buildFlow({
      needsTreatmentConfirm,
      needsTreatmentQuestionnaire,
      needsPhotoAssessment,
      skipTreatment,
      skipQuestionnaires,
      skipPhotoAssessment: skipHenna,
      skipIdentify,
      skipPriorHistory: !needsPriorHistory,
    }),
    [needsTreatmentConfirm, needsTreatmentQuestionnaire, needsPhotoAssessment, skipTreatment, skipQuestionnaires, skipHenna, skipIdentify, needsPriorHistory]
  )

  const currentStep = flow[stepIndex] || 'identify'

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [stepIndex, bookingResult])

  useEffect(() => {
    if (clientInfo.name?.trim() && !signerName) {
      setSignerName(clientInfo.name.trim())
    }
  }, [clientInfo.name, signerName])

  const loadTreatments = useCallback(() => {
    setLoadingTreatments(true)
    setTreatmentsError(null)
    fetch(`${API_URL}/api/treatments`)
      .then(async (res) => {
        if (!res.ok) throw new Error('fetch failed')
        const data = await res.json()
        if (!Array.isArray(data)) throw new Error('invalid data')
        setTreatments(data)
      })
      .catch(() => {
        setTreatments([])
        setTreatmentsError('No se pudieron cargar los tratamientos. Comprueba que el servidor esté en marcha.')
      })
      .finally(() => setLoadingTreatments(false))
  }, [])

  useEffect(() => {
    loadTreatments()
  }, [loadTreatments])

  const handleStudioHabitualChange = useCallback((value) => {
    setStudioHabitual(value)
    setPriorHistoryError(null)
    if (value === false) {
      setDeclaredPriorTreatments([])
    }
  }, [])

  const applyLookupData = useCallback((data) => {
    setLookupData(data)
    if (data?.hasAllBaseConsents && data.acceptedConsents?.length) {
      setConsents(data.acceptedConsents)
    }
    if (data?.isKnownClient || data?.visitCount > 0 || data?.treatmentIds?.length > 0) {
      setStudioHabitual(null)
      setDeclaredPriorTreatments([])
      setPriorHistoryError(null)
    } else if (data?.client?.declaredProfile === 'returning_declared') {
      setStudioHabitual(true)
    } else if (data?.client?.declaredProfile === 'first_time') {
      setStudioHabitual(false)
    }
  }, [])

  const handleLookup = useCallback(async (email) => {
    setIsLookingUp(true)
    try {
      const res = await fetch(
        `${API_URL}/api/clients/lookup?email=${encodeURIComponent(email)}`,
        { headers: authHeaders() }
      )
      if (!res.ok) return
      const data = await res.json()
      applyLookupData(data)
    } catch {
      // non-blocking
    } finally {
      setIsLookingUp(false)
    }
  }, [applyLookupData])

  useEffect(() => {
    if (authLoading) return

    if (!authUser) {
      setIdentityBootstrapped(true)
      return
    }

    let cancelled = false

    setClientInfo({
      name: authUser.name || '',
      email: authUser.email || '',
      phone: authUser.phone || '',
    })
    if (authUser.declaredProfile === 'returning_declared') {
      setStudioHabitual(true)
    } else if (authUser.declaredProfile === 'first_time') {
      setStudioHabitual(false)
    }

    const bootstrapIdentity = async () => {
      setIsLookingUp(true)
      try {
        let data = null
        if (authUser.email) {
          const res = await fetch(
            `${API_URL}/api/clients/lookup?email=${encodeURIComponent(authUser.email)}`,
            { headers: authHeaders() }
          )
          if (res.ok) data = await res.json()
        }
        if (cancelled) return

        if (data) applyLookupData(data)

        const profileComplete =
          Boolean(authUser.name?.trim()) &&
          Boolean(authUser.email?.trim()) &&
          Boolean(authUser.phone?.trim())

        if (profileComplete && data?.hasAllBaseConsents) {
          const accepted = data.acceptedConsents?.length
            ? data.acceptedConsents
            : ['privacy', 'booking_terms']
          setConsents(accepted)
          setSkipIdentify(true)
          saveClientProfile({
            name: authUser.name.trim(),
            email: authUser.email.trim().toLowerCase(),
            phone: authUser.phone.trim(),
            consents: accepted,
          })
        }
      } catch {
        // Keep identify step if lookup fails
      } finally {
        if (!cancelled) {
          setIsLookingUp(false)
          setIdentityBootstrapped(true)
        }
      }
    }

    bootstrapIdentity()
    return () => {
      cancelled = true
    }
  }, [authUser, authLoading, applyLookupData])

  const advanceFromIdentify = useCallback(async () => {
    if (!clientInfo.name?.trim() || clientInfo.name.trim().length < 2) {
      setBookingError('Introduce tu nombre completo')
      return false
    }
    if (!clientInfo.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientInfo.email)) {
      setBookingError('Introduce un email válido')
      return false
    }
    if (!isValidPhone(clientInfo.phone)) {
      setBookingError('Introduce un teléfono válido (mínimo 9 dígitos)')
      return false
    }

    let data = lookupData
    if (!data) {
      try {
        const res = await fetch(
          `${API_URL}/api/clients/lookup?email=${encodeURIComponent(clientInfo.email.trim())}`,
          { headers: authHeaders() }
        )
        if (res.ok) {
          data = await res.json()
          applyLookupData(data)
        }
      } catch {
        // continue
      }
    }

    const needsConsentUI = !data?.hasAllBaseConsents
    if (needsConsentUI) {
      const required = ['privacy', 'booking_terms']
      for (const c of required) {
        if (!consents.includes(c)) {
          setConsentError('Debes aceptar todos los consentimientos obligatorios')
          return false
        }
      }
    }
    setConsentError(null)

    saveClientProfile({
      name: clientInfo.name.trim(),
      email: clientInfo.email.trim().toLowerCase(),
      phone: clientInfo.phone?.trim() || '',
      consents: data?.hasAllBaseConsents ? data.acceptedConsents : consents,
    })

    return true
  }, [clientInfo, consents, lookupData, applyLookupData])

  const resolveTreatmentFlow = useCallback((treatment, lookup) => {
    const doneInDb = lookup?.treatmentIds?.includes(treatment.id) ?? false

    if (doneInDb) {
      return { needsTreatmentConfirm: false, needsTreatmentQuestionnaire: false }
    }

    const hasDbBrowHistory = hasBrowDesignHistoryInDb(lookup?.treatmentIds || [])
    if (treatment.id === BROW_DESIGN_SEGUIMIENTO && hasDbBrowHistory) {
      return { needsTreatmentConfirm: false, needsTreatmentQuestionnaire: false }
    }

    if (!requiresAptitudeQuestionnaire(treatment.id)) {
      return { needsTreatmentConfirm: false, needsTreatmentQuestionnaire: false }
    }

    return { needsTreatmentConfirm: false, needsTreatmentQuestionnaire: true }
  }, [])

  const applyMaintenanceIntent = useCallback((lookup) => {
    if (bookingIntent !== 'mantenimiento' || treatments.length === 0) return false

    const route = resolveMaintenanceBooking(lookup?.treatmentIds || [])
    const treatment = treatments.find((t) => t.id === route.treatmentId)
    if (!treatment) return false

    const { needsTreatmentConfirm: needConfirm, needsTreatmentQuestionnaire: needQ } = route.skipQuestionnaire
      ? { needsTreatmentConfirm: false, needsTreatmentQuestionnaire: false }
      : resolveTreatmentFlow(treatment, lookup)

    setSelectedTreatment(treatment)
    setSelectedDate(null)
    setSelectedTime(null)
    setTreatmentAnswers({})
    setIntakeSignature(null)
    setSignerName(clientInfo.name?.trim() || '')
    setHennaAssessmentId(null)
    setSkipTreatment(true)
    setSkipQuestionnaires(route.skipQuestionnaire)
    setSkipHenna(true)
    setNeedsTreatmentConfirm(needConfirm)
    setNeedsTreatmentQuestionnaire(needQ)
    setInfoNotice(route.notice)
    setSearchParams({}, { replace: true })

    setSkipIdentify(true)
    setSkipPriorHistoryFlag(true)

    const nextFlow = buildFlow({
      needsTreatmentConfirm: needConfirm,
      needsTreatmentQuestionnaire: needQ,
      needsPhotoAssessment: false,
      skipTreatment: true,
      skipQuestionnaires: route.skipQuestionnaire,
      skipPhotoAssessment: true,
      skipIdentify: true,
      skipPriorHistory: true,
    })

    const targetStep = needQ ? 'treatment_q' : 'calendar'
    setDirection(1)
    setStepIndex(nextFlow.indexOf(targetStep))
    return true
  }, [
    bookingIntent,
    treatments,
    resolveTreatmentFlow,
    clientInfo.name,
    setSearchParams,
  ])

  // Logged-in + mantenimiento: apply without waiting for Identificación
  useEffect(() => {
    if (!identityBootstrapped || !skipIdentify) return
    if (bookingIntent !== 'mantenimiento') return
    if (loadingTreatments || treatments.length === 0) return
    if (selectedTreatment) return
    applyMaintenanceIntent(lookupData)
  }, [
    identityBootstrapped,
    skipIdentify,
    bookingIntent,
    loadingTreatments,
    treatments.length,
    selectedTreatment,
    lookupData,
    applyMaintenanceIntent,
  ])

  const goNext = useCallback(async () => {
    setBookingError(null)

    if (currentStep === 'identify') {
      const ok = await advanceFromIdentify()
      if (!ok) return

      if (bookingIntent === 'mantenimiento') {
        if (loadingTreatments) {
          setBookingError('Espera un momento mientras cargamos los tratamientos.')
          return
        }
        let data = lookupData
        if (!data && clientInfo.email?.trim()) {
          try {
            const res = await fetch(
              `${API_URL}/api/clients/lookup?email=${encodeURIComponent(clientInfo.email.trim())}`,
              { headers: authHeaders() }
            )
            if (res.ok) {
              data = await res.json()
              applyLookupData(data)
            }
          } catch {
            // continue
          }
        }
        if (applyMaintenanceIntent(data)) return
        setBookingError('No se pudo iniciar la reserva. Inténtalo de nuevo.')
        return
      }
    }

    if (currentStep === 'prior_history') {
      if (studioHabitual === null) {
        setPriorHistoryError('Indica si has visitado el estudio antes')
        return
      }
      setPriorHistoryError(null)
      if (studioHabitual === false) {
        setDeclaredPriorTreatments([])
      }

      const declaredProfile = studioHabitual ? 'returning_declared' : 'first_time'
      // Persistir ya (no esperar a confirmar la cita). No actualizar lookup/auth aquí:
      // si el flujo pierde el paso prior_history a mitad, el stepIndex se desincroniza.
      updateClientProfile({ declaredProfile }).catch(() => {
        // La reserva también persistirá el perfil; no bloquear el flujo
      })
    }

    if (currentStep === 'calendar' && (!selectedDate || !selectedTime)) return

    setDirection(1)
    setStepIndex((i) => Math.min(i + 1, flow.length - 1))
  }, [currentStep, advanceFromIdentify, studioHabitual, selectedDate, selectedTime, flow.length, bookingIntent, lookupData, clientInfo.email, applyLookupData, applyMaintenanceIntent, loadingTreatments])

  const goPrev = useCallback(() => {
    if (stepIndex <= 0) return
    setBookingError(null)
    setDirection(-1)
    setStepIndex((i) => i - 1)
  }, [stepIndex])

  const handleSelectTreatment = useCallback((treatment) => {
    setSelectedTreatment(treatment)
    setSelectedDate(null)
    setSelectedTime(null)
    setTreatmentAnswers({})
    setIntakeSignature(null)
    setSignerName(clientInfo.name?.trim() || '')
    setHennaAssessmentId(null)

    const { needsTreatmentConfirm: needConfirm, needsTreatmentQuestionnaire: needQ } =
      resolveTreatmentFlow(treatment, lookupData)

    setNeedsTreatmentConfirm(needConfirm)
    setNeedsTreatmentQuestionnaire(needQ)

    const nextFlow = buildFlow({
      needsTreatmentConfirm: needConfirm,
      needsTreatmentQuestionnaire: needQ,
      needsPhotoAssessment: requiresPhotoAssessment(treatment.id, {
        treatmentIds: lookupData?.treatmentIds || [],
      }),
      skipTreatment: false,
      skipQuestionnaires: false,
      skipPhotoAssessment: false,
      skipIdentify: skipIdentify,
      skipPriorHistory: !needsPriorHistory,
    })

    setDirection(1)
    setStepIndex(stepIndexAfter(nextFlow, 'treatment'))
  }, [lookupData, needsPriorHistory, resolveTreatmentFlow, skipIdentify, clientInfo.name])

  const handleQuestionnaireComplete = useCallback(({ signature }) => {
    setIntakeSignature(signature)
    setDirection(1)
    setStepIndex((i) => Math.min(i + 1, flow.length - 1))
  }, [flow.length])

  const handleTreatmentConfirm = useCallback((isFirstTime) => {
    setNeedsTreatmentQuestionnaire(isFirstTime)
    setNeedsTreatmentConfirm(false)

    if (isFirstTime) {
      setTreatmentAnswers({ first_time: 'yes' })
      setSignerName(clientInfo.name?.trim() || '')
      setIntakeSignature(null)
    }

    const nextFlow = buildFlow({
      needsTreatmentConfirm: false,
      needsTreatmentQuestionnaire: isFirstTime,
      needsPhotoAssessment: requiresPhotoAssessment(selectedTreatment?.id, {
        treatmentIds: lookupData?.treatmentIds || [],
      }),
      skipTreatment: skipTreatment,
      skipQuestionnaires: false,
      skipPhotoAssessment: false,
      skipIdentify: skipIdentify,
      skipPriorHistory: !needsPriorHistory,
    })

    if (isFirstTime) {
      setDirection(1)
      setStepIndex(nextFlow.indexOf('treatment_q'))
    } else {
      const target = nextFlow.includes('henna') ? 'henna' : 'calendar'
      setDirection(1)
      setStepIndex(nextFlow.indexOf(target))
    }
  }, [selectedTreatment, skipTreatment, skipIdentify, needsPriorHistory, clientInfo.name, lookupData?.treatmentIds])

  useEffect(() => {
    if (!preselectedTreatmentId || loadingTreatments || treatments.length === 0) return
    const treatment = treatments.find((t) => t.id === preselectedTreatmentId)
    if (!treatment) return

    setSelectedTreatment(treatment)
    setSkipTreatment(true)

    const { needsTreatmentConfirm: needConfirm, needsTreatmentQuestionnaire: needQ } =
      resolveTreatmentFlow(treatment, lookupData)
    setNeedsTreatmentConfirm(needConfirm)
    setNeedsTreatmentQuestionnaire(needQ)

    setSearchParams({}, { replace: true })
  }, [preselectedTreatmentId, loadingTreatments, treatments, lookupData, setSearchParams, resolveTreatmentFlow])

  const allConsents = useMemo(() => {
    const fromDb = lookupData?.acceptedConsents || []
    return [...new Set([...fromDb, ...consents])]
  }, [lookupData, consents])

  const handleConfirm = useCallback(async () => {
    if (isSubmitting || !selectedTreatment || !selectedDate || !selectedTime) return
    setIsSubmitting(true)
    setBookingError(null)

    const [hours, minutes] = selectedTime.split(':').map(Number)
    const startTime = new Date(selectedDate)
    startTime.setHours(hours, minutes, 0, 0)

    const body = {
      treatmentId: selectedTreatment.id,
      startTime: startTime.toISOString(),
      clientName: clientInfo.name.trim(),
      clientEmail: clientInfo.email.trim().toLowerCase(),
      clientPhone: clientInfo.phone.trim(),
      declaredProfile: resolveDeclaredProfile(lookupData, studioHabitual),
      consents: allConsents,
    }

    if (needsTreatmentQuestionnaire && Object.keys(treatmentAnswers).length > 0) {
      body.intakeAnswers = treatmentAnswers
      body.intakeType = 'treatment'
      body.intakeSignature = intakeSignature
      if (!allConsents.includes('health_data')) {
        body.consents = [...new Set([...allConsents, 'health_data'])]
      }
    }

    if (needsPhotoAssessment && hennaAssessmentId) {
      body.hennaAssessmentId = hennaAssessmentId
      if (!allConsents.includes('photo_consent')) {
        setBookingError('Debes aceptar el consentimiento de imagen para la valoración por foto')
        setIsSubmitting(false)
        return
      }
    }

    if (needsPhotoAssessment && !hennaAssessmentId) {
      setBookingError('Falta la valoración por foto. Vuelve al paso anterior.')
      setIsSubmitting(false)
      return
    }

    try {
      const res = await fetch(`${API_URL}/api/bookings`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 409) {
          if (data.code === 'PERFILADO_WEEKLY_LIMIT') {
            setBookingError(
              data.message ||
                'Solo puedes reservar un perfilado por semana. Elige una fecha de la semana siguiente.'
            )
          } else {
            setBookingError(data.message || 'Este horario ya no está disponible.')
          }
          const calIdx = flow.indexOf('calendar')
          setDirection(-1)
          setStepIndex(calIdx >= 0 ? calIdx : 0)
          setSelectedTime(null)
        } else if (res.status === 401 || res.status === 403) {
          setBookingError(data.error || 'Tu sesión ha caducado. Vuelve a iniciar sesión.')
        } else {
          setBookingError(data.details?.join(', ') || data.error || 'Error al crear la reserva.')
        }
        return
      }

      setBookingResult(data)
    } catch {
      setBookingError('Error de conexión. Si ya confirmaste, revisa tu email o el calendario del estudio antes de reintentar.')
    } finally {
      setIsSubmitting(false)
    }
  }, [
    isSubmitting, selectedTreatment, selectedDate, selectedTime, clientInfo, allConsents,
    lookupData, studioHabitual, needsTreatmentQuestionnaire, treatmentAnswers, intakeSignature,
    needsPhotoAssessment, hennaAssessmentId, flow,
  ])

  const handleReserveAnotherDay = useCallback(() => {
    setBookingResult(null)
    setSelectedDate(null)
    setSelectedTime(null)
    setSkipIdentify(true)
    setSkipPriorHistoryFlag(true)
    setSkipQuestionnaires(true)
    setSkipHenna(true)
    setSkipTreatment(true)
    setNeedsTreatmentConfirm(false)
    setNeedsTreatmentQuestionnaire(false)
    const nextFlow = buildFlow({
      needsTreatmentConfirm: false,
      needsTreatmentQuestionnaire: false,
      needsPhotoAssessment,
      skipTreatment: true,
      skipQuestionnaires: true,
      skipPhotoAssessment: true,
      skipIdentify: true,
      skipPriorHistory: true,
    })
    setStepIndex(nextFlow.indexOf('calendar'))
    setDirection(1)
  }, [needsPhotoAssessment])

  const handleReserveAnotherTreatment = useCallback(() => {
    setBookingResult(null)
    setSelectedTreatment(null)
    setSelectedDate(null)
    setSelectedTime(null)
    setSkipIdentify(true)
    setSkipPriorHistoryFlag(true)
    setSkipQuestionnaires(false)
    setSkipHenna(true)
    setSkipTreatment(false)
    setNeedsTreatmentConfirm(false)
    setNeedsTreatmentQuestionnaire(false)
    if (clientInfo.email) {
      handleLookup(clientInfo.email.trim())
    }
    const nextFlow = buildFlow({
      needsTreatmentConfirm: false,
      needsTreatmentQuestionnaire: false,
      needsPhotoAssessment: false,
      skipTreatment: false,
      skipQuestionnaires: false,
      skipPhotoAssessment: true,
      skipIdentify: true,
      skipPriorHistory: true,
    })
    setStepIndex(nextFlow.indexOf('treatment'))
    setDirection(1)
  }, [clientInfo.email, handleLookup])

  const handleClose = useCallback(() => navigate('/'), [navigate])

  const showContinueButton = ['identify', 'prior_history', 'calendar'].includes(currentStep)
  const canAdvanceCalendar = currentStep === 'calendar' && selectedDate && selectedTime

  if (bookingResult) {
    return (
      <div className="min-h-screen bg-background">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl"
        >
          <div className="flex justify-end items-center px-6 h-16 max-w-2xl mx-auto w-full">
            <motion.button whileTap={{ scale: 0.95 }} onClick={handleClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors">
              <Icon name="close" className="text-on-surface" />
            </motion.button>
          </div>
        </motion.header>
        <main className="pt-24 pb-12 px-5 max-w-2xl mx-auto min-h-screen">
          <BookingSuccess
            bookingData={bookingResult}
            onClose={handleClose}
            onReserveAnotherDay={handleReserveAnotherDay}
            onReserveAnotherTreatment={handleReserveAnotherTreatment}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl"
      >
        <div className="flex justify-between items-center px-6 h-16 max-w-2xl mx-auto w-full">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={stepIndex > 0 ? goPrev : handleClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors"
          >
            <Icon name="arrow_back" className="text-on-surface" />
          </motion.button>

          <div className="flex items-center gap-1.5">
            {flow.map((key, i) => (
              <div
                key={key}
                title={STEP_META[key]}
                className={`h-2 rounded-full transition-all duration-500 ${
                  i === stepIndex ? 'w-6 bg-primary' : i < stepIndex ? 'w-2 bg-primary/60' : 'w-2 bg-outline-variant/30'
                }`}
              />
            ))}
          </div>

          <motion.button whileTap={{ scale: 0.95 }} onClick={handleClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors">
            <Icon name="close" className="text-on-surface" />
          </motion.button>
        </div>
      </motion.header>

      <main className="pt-24 pb-12 px-5 max-w-2xl mx-auto min-h-screen">
        {!identityBootstrapped ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-on-surface-variant">
            <div className="w-8 h-8 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
            <p className="font-label text-sm tracking-wide">Preparando tu reserva…</p>
          </div>
        ) : (
          <>
        {infoNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-start gap-3"
          >
            <Icon name="info" className="text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-on-surface">{infoNotice}</p>
          </motion.div>
        )}

        {bookingError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3"
          >
            <Icon name="error" className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{bookingError}</p>
          </motion.div>
        )}

        <AnimatePresence mode="wait" custom={direction}>
          {currentStep === 'identify' && (
            <motion.div key="identify" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}>
              <StepClientInfo
                clientInfo={clientInfo}
                onChange={setClientInfo}
                consents={consents}
                onConsentsChange={setConsents}
                onLookup={handleLookup}
                lookupData={lookupData}
                isLookingUp={isLookingUp}
                showConsents={showConsents}
                consentError={consentError}
                identityLocked={Boolean(authUser)}
              />
            </motion.div>
          )}

          {currentStep === 'prior_history' && (
            <motion.div key="prior_history" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.4 }}>
              {loadingTreatments ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
                </div>
              ) : (
                <StepPriorTreatments
                  treatments={treatments}
                  studioHabitual={studioHabitual}
                  onStudioHabitualChange={handleStudioHabitualChange}
                  selectedIds={declaredPriorTreatments}
                  onSelectedIdsChange={setDeclaredPriorTreatments}
                  error={priorHistoryError}
                />
              )}
            </motion.div>
          )}

          {currentStep === 'treatment' && (
            <motion.div key="treatment" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.4 }}>
              {loadingTreatments ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
                </div>
              ) : treatmentsError ? (
                <div className="text-center py-16">
                  <p className="text-sm text-on-surface-variant mb-6">{treatmentsError}</p>
                  <button type="button" onClick={loadTreatments} className="px-6 py-3 rounded-2xl bg-primary text-white text-sm font-bold">Reintentar</button>
                </div>
              ) : (
                <StepTreatments
                  treatments={treatments}
                  categories={CATEGORIES}
                  onSelect={handleSelectTreatment}
                  clientProfile={effectiveClientProfile}
                />
              )}
            </motion.div>
          )}

          {currentStep === 'treatment_confirm' && selectedTreatment && (
            <motion.div key="treatment_confirm" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.4 }}>
              <StepTreatmentConfirm
                treatment={selectedTreatment}
                onConfirm={handleTreatmentConfirm}
              />
            </motion.div>
          )}

          {currentStep === 'treatment_q' && selectedTreatment && (
            <motion.div key="treatment_q" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.4 }}>
              <StepQuestionnaire
                intakeType="treatment"
                category={selectedTreatment.category}
                treatmentId={selectedTreatment.id}
                answers={treatmentAnswers}
                onChange={setTreatmentAnswers}
                signature={intakeSignature?.dataUrl || null}
                onSignatureChange={(dataUrl) => {
                  setIntakeSignature(dataUrl ? { dataUrl, signerName: signerName.trim() } : null)
                }}
                signerName={signerName}
                onSignerNameChange={setSignerName}
                onComplete={handleQuestionnaireComplete}
              />
            </motion.div>
          )}

          {currentStep === 'henna' && (
            <motion.div key="henna" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.4 }}>
              <StepHennaAssessment
                clientInfo={clientInfo}
                treatmentName={selectedTreatment?.name}
                onAssessmentReady={setHennaAssessmentId}
                onComplete={goNext}
              />
            </motion.div>
          )}

          {currentStep === 'calendar' && (
            <motion.div key="calendar" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.4 }}>
              <StepAvailability
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                onSelectDate={setSelectedDate}
                onSelectTime={setSelectedTime}
                treatmentId={selectedTreatment?.id}
                perfiladoBlockedWeeks={lookupData?.perfiladoBlockedWeeks || []}
              />
            </motion.div>
          )}

          {currentStep === 'summary' && (
            <motion.div key="summary" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.4 }}>
              <StepSummary
                treatment={selectedTreatment}
                date={selectedDate}
                time={selectedTime}
                clientInfo={clientInfo}
                pendingReview={needsPhotoAssessment}
                consents={allConsents}
                onConsentsChange={setConsents}
                onConfirm={handleConfirm}
                isSubmitting={isSubmitting}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {showContinueButton && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
            <motion.button
              whileTap={(currentStep === 'identify' || canAdvanceCalendar) ? { scale: 0.97 } : {}}
              onClick={goNext}
              disabled={currentStep === 'calendar' && !canAdvanceCalendar}
              className={`w-full flex items-center justify-center gap-2 coral-gradient text-white rounded-2xl py-4 font-label text-sm tracking-widest uppercase font-bold editorial-shadow transition-opacity ${
                currentStep === 'calendar' && !canAdvanceCalendar ? 'opacity-35 cursor-not-allowed' : 'opacity-100'
              }`}
            >
              <span>Continuar</span>
              <Icon name="arrow_forward" className="text-lg" />
            </motion.button>
          </motion.div>
        )}
          </>
        )}
      </main>
    </div>
  )
}
