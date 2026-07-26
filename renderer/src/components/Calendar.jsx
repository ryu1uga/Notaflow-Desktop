import React, { useState } from 'react'
import Icon from './Icon.jsx'
import { Badge } from './ui.jsx'
import { colors } from '../theme.js'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const keyOf = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

// items: [{ date: Date, courseName, courseColor, courseId, type, name, grade }]
export default function Calendar({ items = [], onOpen }) {
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(null)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()

  const byDay = {}
  items.forEach((it) => {
    if (!it.date) return
    ;(byDay[keyOf(it.date)] = byDay[keyOf(it.date)] || []).push(it)
  })

  // Grilla del mes (la semana empieza en lunes)
  const leading = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < leading; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)

  const goMonth = (delta) => { setSelected(null); setCursor(new Date(year, month + delta, 1)) }
  const selItems = selected ? (byDay[keyOf(selected)] || []) : []

  return (
    <div>
      <div className="cal-head">
        <button className="icon-btn" onClick={() => goMonth(-1)} aria-label="Mes anterior">
          <Icon name="chevron-left" size={19} />
        </button>
        <div className="cal-month">{MESES[month]} {year}</div>
        <div className="row" style={{ gap: 4 }}>
          <button className="btn ghost" style={{ padding: '5px 11px', fontSize: 12 }}
            onClick={() => { setSelected(null); setCursor(new Date(today.getFullYear(), today.getMonth(), 1)) }}>
            Hoy
          </button>
          <button className="icon-btn" onClick={() => goMonth(1)} aria-label="Mes siguiente">
            <Icon name="chevron-right" size={19} />
          </button>
        </div>
      </div>

      <div className="cal-weekdays">{DIAS.map((d) => <div key={d}>{d}</div>)}</div>

      <div className="cal-grid">
        {cells.map((d, i) => {
          if (!d) return <button key={i} className="cal-cell" disabled />
          const evs = byDay[keyOf(d)] || []
          const isToday = sameDay(d, today)
          const isSel = sameDay(d, selected)
          return (
            <button key={i} className="cal-cell" onClick={() => setSelected(isSel ? null : d)}
              title={evs.map((e) => `${e.courseName}: ${e.name}`).join('\n') || undefined}>
              <span className={`cal-day ${isToday ? 'today' : ''} ${isSel ? 'sel' : ''}`}>{d.getDate()}</span>
              <span className="cal-dots">
                {evs.slice(0, 4).map((e, j) => (
                  <i key={j} className="cal-dot" style={{ background: e.courseColor }} />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="cal-panel">
          <h4>{selected.getDate()} de {MESES[selected.getMonth()]}</h4>
          {selItems.length === 0 ? (
            <p className="hint" style={{ marginTop: 0 }}>Sin evaluaciones este día.</p>
          ) : selItems.map((e, i) => (
            <button key={i} className="sched-item" onClick={() => onOpen?.(e.courseId)}>
              <span className="dot" style={{ background: e.courseColor }} />
              <span className="sched-course">{e.courseName}</span>
              <span className="sched-eval"> · {e.type}: {e.name}</span>
              <span className="spacer" />
              {e.grade == null ? <Badge color="amber">pend.</Badge> : <Badge color="slate">{String(e.grade)}</Badge>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
