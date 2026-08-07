import { useEffect, useRef, useCallback } from 'react'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Browser autofill updates the DOM without firing React onChange.
 * Poll + animationstart hook syncs values into React state.
 */
export function useAutofillSync({ fields, onSync, onEmailReady }) {
  const lastLookupEmail = useRef('')
  const fieldsRef = useRef(fields)
  fieldsRef.current = fields

  const readDom = useCallback(() => {
    const refs = fieldsRef.current
    return {
      email: refs.email?.current?.value?.trim() || '',
      name: refs.name?.current?.value?.trim() || '',
      phone: refs.phone?.current?.value?.trim() || '',
    }
  }, [])

  const sync = useCallback(() => {
    const dom = readDom()
    const hasAny = dom.email || dom.name || dom.phone
    if (!hasAny) return

    onSync(dom)

    if (dom.email && EMAIL_RE.test(dom.email) && dom.email !== lastLookupEmail.current) {
      lastLookupEmail.current = dom.email
      onEmailReady?.(dom.email)
    }
  }, [readDom, onSync, onEmailReady])

  useEffect(() => {
    const timers = [50, 150, 350, 700, 1200].map((ms) => setTimeout(sync, ms))

    const inputs = Object.values(fields).map((ref) => ref?.current).filter(Boolean)
    const onAnimation = (e) => {
      if (e.animationName === 'nere-autofill-start') sync()
    }
    const onInput = () => sync()

    inputs.forEach((el) => {
      el.addEventListener('animationstart', onAnimation)
      el.addEventListener('input', onInput)
    })

    return () => {
      timers.forEach(clearTimeout)
      inputs.forEach((el) => {
        el.removeEventListener('animationstart', onAnimation)
        el.removeEventListener('input', onInput)
      })
    }
  }, [fields, sync])
}
