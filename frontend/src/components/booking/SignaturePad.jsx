import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

function eventPoint(event) {
  if (event.touches?.[0]) return event.touches[0]
  if (event.changedTouches?.[0]) return event.changedTouches[0]
  return event
}

function canvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1) return null
  const source = eventPoint(event)
  if (source?.clientX == null) return null
  return {
    x: (source.clientX - rect.left) * (canvas.width / rect.width),
    y: (source.clientY - rect.top) * (canvas.height / rect.height),
  }
}

function paintBackground(ctx, width, height) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#FAFAF9'
  ctx.fillRect(0, 0, width, height)
}

function strokeStyle(ctx, dpr) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(3.2, 2.6 * dpr)
  ctx.strokeStyle = '#1C1917'
}

function lockPageScroll() {
  const html = document.documentElement
  const body = document.body
  const y = window.scrollY
  html.dataset.signLockY = String(y)
  html.style.overflow = 'hidden'
  body.style.overflow = 'hidden'
  html.style.overscrollBehavior = 'none'
  body.style.overscrollBehavior = 'none'
  body.style.touchAction = 'none'
}

function unlockPageScroll() {
  const html = document.documentElement
  const body = document.body
  const y = Number(html.dataset.signLockY || window.scrollY)
  html.style.overflow = ''
  body.style.overflow = ''
  html.style.overscrollBehavior = ''
  body.style.overscrollBehavior = ''
  body.style.touchAction = ''
  delete html.dataset.signLockY
  window.scrollTo(0, y)
}

export default function SignaturePad({ value, onChange, signerName, onSignerNameChange }) {
  const canvasRef = useRef(null)
  const surfaceRef = useRef(null)
  const drawingRef = useRef(false)
  const hasStrokesRef = useRef(Boolean(value))
  const lastPointRef = useRef(null)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const [isEmpty, setIsEmpty] = useState(!value)

  valueRef.current = value
  onChangeRef.current = onChange

  const exportSignature = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !hasStrokesRef.current) {
      setIsEmpty(true)
      onChangeRef.current(null)
      return
    }
    setIsEmpty(false)
    onChangeRef.current(canvas.toDataURL('image/png'))
  }, [])

  const setupCanvas = useCallback((preserve) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const cssW = Math.max(1, Math.round(rect.width))
    const cssH = Math.max(1, Math.round(rect.height))
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const bufW = Math.max(1, Math.round(cssW * dpr))
    const bufH = Math.max(1, Math.round(cssH * dpr))

    const snapshot =
      preserve && (hasStrokesRef.current || valueRef.current)
        ? canvas.width > 1
          ? canvas.toDataURL('image/png')
          : valueRef.current
        : valueRef.current

    if (canvas.width === bufW && canvas.height === bufH && !snapshot) {
      strokeStyle(canvas.getContext('2d'), dpr)
      return
    }

    canvas.width = bufW
    canvas.height = bufH
    const ctx = canvas.getContext('2d')
    paintBackground(ctx, bufW, bufH)
    strokeStyle(ctx, dpr)

    if (snapshot) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, bufW, bufH)
        hasStrokesRef.current = true
        setIsEmpty(false)
        strokeStyle(ctx, dpr)
      }
      img.src = snapshot
    }
  }, [])

  useLayoutEffect(() => {
    setupCanvas(false)
  }, [setupCanvas])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === 'undefined') return undefined

    let frame = 0
    const observer = new ResizeObserver(() => {
      if (drawingRef.current) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setupCanvas(true))
    })
    observer.observe(canvas.parentElement || canvas)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [setupCanvas])

  useEffect(() => {
    const surface = surfaceRef.current
    const canvas = canvasRef.current
    if (!surface || !canvas) return undefined

    const mark = (from, to) => {
      const ctx = canvas.getContext('2d')
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
      lastPointRef.current = to
      hasStrokesRef.current = true
      setIsEmpty(false)
    }

    const startAt = (event) => {
      const point = canvasPoint(event, canvas)
      if (!point) return
      drawingRef.current = true
      lastPointRef.current = point
      lockPageScroll()
      mark(point, { x: point.x + 0.4, y: point.y + 0.4 })
    }

    const moveAt = (event) => {
      if (!drawingRef.current) return
      const point = canvasPoint(event, canvas)
      const last = lastPointRef.current
      if (!point || !last) return
      mark(last, point)
    }

    const endAt = () => {
      if (!drawingRef.current) return
      drawingRef.current = false
      lastPointRef.current = null
      unlockPageScroll()
      exportSignature()
    }

    const onTouchStart = (event) => {
      event.preventDefault()
      startAt(event)
    }
    const onTouchMove = (event) => {
      if (!drawingRef.current) return
      event.preventDefault()
      moveAt(event)
    }
    const onTouchEnd = (event) => {
      event.preventDefault()
      endAt()
    }

    const onPointerDown = (event) => {
      if (event.pointerType === 'touch') return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      event.preventDefault()
      try {
        surface.setPointerCapture(event.pointerId)
      } catch {
        /* ignore */
      }
      startAt(event)
    }
    const onPointerMove = (event) => {
      if (event.pointerType === 'touch') return
      if (!drawingRef.current) return
      event.preventDefault()
      const samples =
        typeof event.getCoalescedEvents === 'function' && event.getCoalescedEvents().length
          ? event.getCoalescedEvents()
          : [event]
      samples.forEach((sample) => moveAt(sample))
    }
    const onPointerUp = (event) => {
      if (event.pointerType === 'touch') return
      event.preventDefault()
      endAt()
    }

    const stopPageScroll = (event) => {
      if (drawingRef.current) event.preventDefault()
    }

    const blockContext = (event) => event.preventDefault()

    const opts = { passive: false }
    surface.addEventListener('touchstart', onTouchStart, opts)
    surface.addEventListener('touchmove', onTouchMove, opts)
    surface.addEventListener('touchend', onTouchEnd, opts)
    surface.addEventListener('touchcancel', onTouchEnd, opts)
    surface.addEventListener('pointerdown', onPointerDown, opts)
    surface.addEventListener('pointermove', onPointerMove, opts)
    surface.addEventListener('pointerup', onPointerUp, opts)
    surface.addEventListener('pointercancel', onPointerUp, opts)
    surface.addEventListener('contextmenu', blockContext)
    document.addEventListener('touchmove', stopPageScroll, { passive: false, capture: true })

    return () => {
      surface.removeEventListener('touchstart', onTouchStart)
      surface.removeEventListener('touchmove', onTouchMove)
      surface.removeEventListener('touchend', onTouchEnd)
      surface.removeEventListener('touchcancel', onTouchEnd)
      surface.removeEventListener('pointerdown', onPointerDown)
      surface.removeEventListener('pointermove', onPointerMove)
      surface.removeEventListener('pointerup', onPointerUp)
      surface.removeEventListener('pointercancel', onPointerUp)
      surface.removeEventListener('contextmenu', blockContext)
      document.removeEventListener('touchmove', stopPageScroll, { capture: true })
      unlockPageScroll()
    }
  }, [exportSignature])

  const clear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    paintBackground(ctx, canvas.width, canvas.height)
    strokeStyle(ctx, dpr)
    hasStrokesRef.current = false
    drawingRef.current = false
    lastPointRef.current = null
    setIsEmpty(true)
    onChangeRef.current(null)
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-sm font-medium text-on-surface mb-2 block">
          Nombre y apellidos (firma) <span className="text-primary">*</span>
        </span>
        <input
          type="text"
          autoComplete="name"
          enterKeyHint="done"
          value={signerName}
          onChange={(e) => onSignerNameChange(e.target.value)}
          placeholder="Como aparece en tu DNI"
          className="w-full px-4 py-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/15 text-on-surface text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-on-surface">
            Firma digital <span className="text-primary">*</span>
          </span>
          <button
            type="button"
            onClick={clear}
            className="min-h-11 px-2 text-xs text-on-surface-variant hover:text-primary transition-colors"
          >
            Borrar firma
          </button>
        </div>
        <div
          ref={surfaceRef}
          className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest overflow-hidden"
          style={{
            touchAction: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
            WebkitTouchCallout: 'none',
            msTouchAction: 'none',
          }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-52 block select-none pointer-events-none"
            style={{ touchAction: 'none' }}
            aria-label="Área para firmar con el dedo"
          />
        </div>
        <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
          Declaro que la información facilitada es veraz y autorizo el tratamiento conforme al cuestionario de aptitud.
        </p>
        {isEmpty && (
          <p className="text-xs text-primary mt-1">Dibuja tu firma con el dedo o el ratón.</p>
        )}
      </div>
    </div>
  )
}
