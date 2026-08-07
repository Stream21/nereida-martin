import { useEffect, useRef, useState } from 'react'

function getPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const source = event.touches?.[0] || event.changedTouches?.[0] || event
  return {
    x: (source.clientX - rect.left) * scaleX,
    y: (source.clientY - rect.top) * scaleY,
  }
}

export default function SignaturePad({ value, onChange, signerName, onSignerNameChange }) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const hasStrokesRef = useRef(false)
  const [isEmpty, setIsEmpty] = useState(!value)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.2
    ctx.strokeStyle = '#1C1917'

    ctx.fillStyle = '#FAFAF9'
    ctx.fillRect(0, 0, rect.width, rect.height)

    if (value) {
      hasStrokesRef.current = true
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height)
        setIsEmpty(false)
      }
      img.src = value
    }

    return undefined
  }, [])

  const exportSignature = () => {
    const canvas = canvasRef.current
    if (!canvas || !hasStrokesRef.current) {
      setIsEmpty(true)
      onChange(null)
      return
    }
    setIsEmpty(false)
    onChange(canvas.toDataURL('image/png'))
  }

  const startDraw = (event) => {
    event.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const point = getPoint(event, canvas)
    drawingRef.current = true
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
  }

  const draw = (event) => {
    if (!drawingRef.current) return
    event.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const point = getPoint(event, canvas)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    hasStrokesRef.current = true
    setIsEmpty(false)
  }

  const endDraw = (event) => {
    if (!drawingRef.current) return
    event.preventDefault()
    drawingRef.current = false
    exportSignature()
  }

  const clear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    ctx.fillStyle = '#FAFAF9'
    ctx.fillRect(0, 0, rect.width, rect.height)
    hasStrokesRef.current = false
    setIsEmpty(true)
    onChange(null)
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-sm font-medium text-on-surface mb-2 block">
          Nombre y apellidos (firma) <span className="text-primary">*</span>
        </span>
        <input
          type="text"
          value={signerName}
          onChange={(e) => onSignerNameChange(e.target.value)}
          placeholder="Como aparece en tu DNI"
          className="w-full px-4 py-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/15 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
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
            className="text-xs text-on-surface-variant hover:text-primary transition-colors"
          >
            Borrar firma
          </button>
        </div>
        <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest overflow-hidden">
          <canvas
            ref={canvasRef}
            className="w-full h-36 touch-none cursor-crosshair block"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
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
