// Componentes base de la interfaz de escritorio.
import React, { useEffect, useState, useRef } from 'react'
import Icon from './Icon.jsx'
import { colors, statusColor } from '../theme.js'

export { default as Icon } from './Icon.jsx'

export function Card({ children, style, className = '', ...rest }) {
  return <div className={`card ${className}`} style={style} {...rest}>{children}</div>
}

export function Badge({ color = 'slate', children }) {
  const c = statusColor[color] || statusColor.slate
  return <span className="badge" style={{ background: c.bg, color: c.fg }}>{children}</span>
}

// Barra de progreso con marca de la nota de aprobación.
export function Progress({ value, max, color = colors.brand, threshold }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const tpct = threshold != null && max > 0 ? Math.max(0, Math.min(100, (threshold / max) * 100)) : null
  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      {tpct != null && <div className="progress-mark" style={{ left: `${tpct}%` }} />}
    </div>
  )
}

// ------------------------------------------------------------
//  Campo numérico: mantiene el texto crudo mientras editas
//  (permite estados intermedios como "10." o "10,5") y solo
//  convierte a número al salir del campo o pulsar Enter.
// ------------------------------------------------------------
export function NumField({
  value,
  onChangeNumber,
  className = '',
  style,
  placeholder,
  allowEmpty = false,
  integer = false,
  format,
  inputRef,
  onNext,
}) {
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState('')

  const asText = (v) => (v == null || v === '' ? '' : String(v))
  const displayed = focused
    ? text
    : format
      ? (value == null || value === '' ? '' : format(value))
      : asText(value)

  const commit = () => {
    setFocused(false)
    const raw = text.replace(',', '.').trim()
    if (raw === '' || raw === '-' || raw === '.') { onChangeNumber(allowEmpty ? null : 0); return }
    let n = Number(raw)
    if (Number.isNaN(n)) { onChangeNumber(allowEmpty ? null : 0); return }
    if (integer) n = Math.trunc(n)
    onChangeNumber(n)
  }

  return (
    <input
      ref={inputRef}
      className={`num ${className}`}
      style={style}
      placeholder={placeholder}
      inputMode={integer ? 'numeric' : 'decimal'}
      value={displayed}
      onFocus={(e) => { setFocused(true); setText(asText(value)); e.target.select() }}
      onChange={(e) => setText(e.target.value.replace(integer ? /[^0-9-]/g : /[^0-9.,-]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { commit(); e.target.blur(); onNext?.() }
        if (e.key === 'Escape') { setFocused(false); e.target.blur() }
      }}
    />
  )
}

// Interruptor tipo switch.
export function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      className={`switch ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="knob" />
    </button>
  )
}

// Ventana modal genérica (cierra con Escape o clic fuera).
export function Modal({ open, onClose, title, children, width = 420 }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div className="sheet" style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()}>
        {title ? <div className="sheet-title">{title}</div> : null}
        {children}
      </div>
    </div>
  )
}

// Confirmación con dos botones.
export function Confirm({ open, title, message, confirmText = 'Aceptar', danger, onConfirm, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="sheet-text">{message}</p>
      <div className="sheet-actions">
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={() => { onConfirm(); onClose() }}>
          {confirmText}
        </button>
      </div>
    </Modal>
  )
}

// Desplegable simple (tipo de evaluación).
// Si el valor no está en la lista (por ejemplo, datos importados del móvil
// con un tipo distinto), se agrega para no perderlo.
export function Select({ value, options, onChange, className = '' }) {
  const opts = value != null && !options.includes(value) ? [value, ...options] : options
  return (
    <div className={`select ${className}`}>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <Icon name="chevron-down" size={13} color={colors.textSoft} />
    </div>
  )
}

// Desplegable con opciones fijas más "Otro…", que abre un diálogo para
// escribir un valor libre. Lo usan el tipo de evaluación y el tipo de bloque
// de clase; los textos del diálogo llegan por props.
// Si el valor guardado no está en la lista (tipo personalizado o venido de
// un respaldo del móvil), se antepone como opción para no perderlo.
const OTRO_OPT = '__otro__'

export function TypeField({
  value, options, maxLength = 24, fallback = 'Otro', onChange,
  label = 'Tipo de evaluación',
  title = 'Tipo de evaluación',
  hint = 'Escribe el nombre del tipo, como aparece en tu sílabo.',
  placeholder = 'Rúbrica, Quiz, Control de lectura…',
  emptyLabel,   // si viene, se ofrece una opción sin valor (p. ej. "Sin bloque")
}) {
  const [asking, setAsking] = useState(false)
  const [draft, setDraft] = useState('')
  const isCustom = value != null && value !== '' && !options.includes(value)
  const opts = isCustom ? [value, ...options] : options

  const ask = () => { setDraft(isCustom ? value : ''); setAsking(true) }
  const save = () => { onChange(draft.trim() || fallback); setAsking(false) }

  return (
    <div className="select">
      <select
        value={value ?? ''}
        aria-label={label}
        onChange={(e) => { if (e.target.value === OTRO_OPT) ask(); else onChange(e.target.value) }}
      >
        {emptyLabel ? <option value="">{emptyLabel}</option> : null}
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value={OTRO_OPT}>Otro…</option>
      </select>
      <Icon name="chevron-down" size={13} color={colors.textSoft} />

      <Modal open={asking} onClose={() => setAsking(false)} title={title} width={380}>
        <p className="sheet-text">{hint}</p>
        <input
          className="text"
          style={{ marginTop: 12 }}
          autoFocus
          value={draft}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save() }}
        />
        <div className="sheet-actions">
          <button className="btn ghost" onClick={() => setAsking(false)}>Cancelar</button>
          <button className="btn primary" onClick={save}>Guardar</button>
        </div>
      </Modal>
    </div>
  )
}

// Botón de información (ⓘ) con explicación breve.
export function InfoButton({ title, text, size = 14 }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="icon-btn tiny" onClick={() => setOpen(true)} aria-label={`Ayuda: ${title}`}>
        <Icon name="info" size={size} color={colors.textFaint} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <p className="sheet-text pre">{text}</p>
        <div className="sheet-actions">
          <button className="btn primary" onClick={() => setOpen(false)}>Entendido</button>
        </div>
      </Modal>
    </>
  )
}

// Campo de fecha nativo (input date), con botón para limpiar.
// Trabaja con ISO completo hacia afuera y yyyy-mm-dd hacia el input.
const toInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const fromInput = (v) => {
  if (!v) return null
  const [y, m, d] = v.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString() // mediodía: evita saltos por zona horaria
}

export function DateField({ label, value, onChange, min }) {
  return (
    <div className="field">
      {label ? <div className="field-label">{label}</div> : null}
      <div className="date-row">
        <input
          type="date"
          className="date-input"
          value={toInput(value)}
          min={min ? toInput(min) : undefined}
          onChange={(e) => onChange(fromInput(e.target.value))}
        />
        {value ? (
          <button className="icon-btn" onClick={() => onChange(null)} aria-label={`Quitar ${label || 'fecha'}`}>
            <Icon name="x" size={14} color={colors.textFaint} />
          </button>
        ) : null}
      </div>
    </div>
  )
}

// Aviso flotante breve (reemplaza a los Alert del móvil).
export function Toast({ toast, onClose }) {
  const timer = useRef(null)
  useEffect(() => {
    if (!toast) return
    clearTimeout(timer.current)
    timer.current = setTimeout(onClose, 4000)
    return () => clearTimeout(timer.current)
  }, [toast, onClose])

  if (!toast) return null
  return (
    <div className={`toast ${toast.kind || ''}`} role="status">
      <span>{toast.text}</span>
      <button className="icon-btn" onClick={onClose} aria-label="Cerrar aviso">
        <Icon name="x" size={14} color={colors.textSoft} />
      </button>
    </div>
  )
}
