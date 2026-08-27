import React, { useEffect, useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import {
  WEEK_ORDER, dayName, MODE_LABEL, isVirtual,
  allSessions, sessionsByDay, layoutDay, dayBounds, fmtTime, nextClass,
} from '../lib/classes.js'
import { Card, Switch, Icon } from '../components/ui.jsx'
import { colors } from '../theme.js'

// Alto de un minuto en la rejilla, en píxeles.
const PX_PER_MIN = 1

// Alto disponible para la rejilla al imprimir. Una A4 apaisada a 96 ppp mide
// 1122x794 px; con 10 mm de margen quedan 718 px de alto, de los que se van
// el título, la fila de días y la leyenda. Con esto la semana entra siempre
// en UNA hoja: se comprime el eje de horas y las letras no se tocan.
const PRINT_GRID_H = 580

// Color del curso con transparencia, para el relleno del bloque.
const tint = (hex, alpha) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return `rgba(109, 74, 156, ${alpha})`
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

// "en 25 min" · "hoy a las 14:00" · "mañana a las 08:00" · "jueves a las 10:00"
function whenText(next, now) {
  if (next.ongoing) return 'ahora mismo'
  if (next.minutesAway < 60) return `en ${Math.max(1, next.minutesAway)} min`
  const hoy = new Date(now); hoy.setHours(0, 0, 0, 0)
  const dia = new Date(next.date); dia.setHours(0, 0, 0, 0)
  const dias = Math.round((dia - hoy) / 86400000)
  const hora = `a las ${next.start}`
  if (dias === 0) return `hoy ${hora}`
  if (dias === 1) return `mañana ${hora}`
  return `${dayName(next.day, true).toLowerCase()} ${hora}`
}

export default function TimetableScreen({ onOpen }) {
  const { state } = useStore()
  const [onlyActive, setOnlyActive] = useState(true)
  // El reloj se refresca cada minuto: así la línea de "ahora" y la cuenta
  // regresiva de la próxima clase no se quedan congeladas.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const [printing, setPrinting] = useState(false)

  const sessions = useMemo(
    () => allSessions(state.courses, { onlyActive, date: now }),
    [state.courses, onlyActive, now],
  )
  const byDay = useMemo(
    () => sessionsByDay(state.courses, { onlyActive, date: now }),
    [state.courses, onlyActive, now],
  )
  const next = useMemo(() => nextClass(state.courses, now), [state.courses, now])

  // Días a mostrar: los que tienen clase. Si no hay ninguno, de lunes a viernes.
  const conClase = WEEK_ORDER.filter((d) => (byDay[d] || []).length > 0)
  const days = conClase.length ? conClase : [1, 2, 3, 4, 5]

  const { from, to } = dayBounds(sessions)
  const ppm = printing ? Math.min(PX_PER_MIN, PRINT_GRID_H / Math.max(1, to - from)) : PX_PER_MIN
  const height = (to - from) * ppm
  const hours = []
  for (let m = from; m <= to; m += 60) hours.push(m)

  // Los cursos que aparecen esta semana, para la leyenda de la hoja impresa.
  const leyenda = useMemo(() => {
    const m = new Map()
    for (const s of sessions) if (!m.has(s.courseId)) m.set(s.courseId, s)
    return [...m.values()]
  }, [sessions])

  // El diálogo de impresión se abre cuando React ya pintó la rejilla comprimida.
  useEffect(() => {
    if (!printing) return
    const fin = () => setPrinting(false)
    window.addEventListener('afterprint', fin)
    const t = setTimeout(() => window.print(), 80)
    return () => { clearTimeout(t); window.removeEventListener('afterprint', fin) }
  }, [printing])

  const hoy = now.getDay()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const enRango = nowMin >= from && nowMin <= to && days.includes(hoy)

  const vacío = sessions.length === 0

  return (
    <div className="page wide">
      <div className="page-head">
        <div>
          <h2>Horario</h2>
          <div className="sub">Tus clases de la semana, con aula y modalidad.</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="hint" style={{ margin: 0 }}>Solo cursos vigentes</span>
          <Switch checked={onlyActive} onChange={setOnlyActive} label="Mostrar solo los cursos vigentes" />
          <button className="btn ghost" onClick={() => setPrinting(true)} disabled={vacío}
            title="Imprime la semana en una hoja A4 apaisada">
            <Icon name="printer" size={15} /> Imprimir
          </button>
        </div>
      </div>

      {next && (
        <Card className="next-class">
          <div className="kicker">{next.ongoing ? 'En clase' : 'Próxima clase'}</div>
          <div className="row" style={{ gap: 9, marginTop: 6 }}>
            <span className="dot" style={{ background: next.courseColor }} />
            <button className="link-strong" onClick={() => onOpen(next.courseId)}>{next.courseName}</button>
            <span className="tt-tag">{MODE_LABEL[next.mode] || MODE_LABEL.presencial}</span>
          </div>
          <p className="hint" style={{ marginTop: 6 }}>
            {[
              next.label,
              `${dayName(next.day, true)} ${next.start}–${next.end}`,
              next.room,
            ].filter(Boolean).join('  ·  ')}
            {' — '}<strong style={{ color: colors.amber }}>{whenText(next, now)}</strong>
          </p>
        </Card>
      )}

      <Card style={{ marginTop: next ? 14 : 0 }}>
        {vacío ? (
          <p className="empty">
            Todavía no hay clases. Abre un curso y agrégalas en la tarjeta “Clases”.
          </p>
        ) : (
          <div className="tt" style={{ '--tt-cols': days.length }}>
            {/* Solo se ve en el papel: en pantalla el título ya está arriba. */}
            <div className="tt-print-head">
              <h1>Horario de clases</h1>
              <span>{onlyActive ? 'Cursos vigentes' : 'Todos los cursos'} · {now.toLocaleDateString()}</span>
            </div>

            <div className="tt-head">
              <div className="tt-gutter" />
              {days.map((d) => (
                <div key={d} className={`tt-dayhead ${d === hoy ? 'today' : ''}`}>
                  {dayName(d, true)}
                </div>
              ))}
            </div>

            {/* El +20 compensa el relleno de .tt-body (box-sizing: border-box):
                10 arriba y 10 abajo, o la primera y la última hora se cortan. */}
            <div className="tt-body" style={{ height: height + 20 }}>
              <div className="tt-gutter">
                {hours.map((m) => (
                  <span key={m} className="tt-hour" style={{ top: (m - from) * ppm }}>{fmtTime(m)}</span>
                ))}
              </div>

              {days.map((d) => (
                <div key={d} className={`tt-col ${d === hoy ? 'today' : ''}`}>
                  {hours.map((m) => (
                    <div key={m} className="tt-line" style={{ top: (m - from) * ppm }} />
                  ))}

                  {d === hoy && enRango && (
                    <div className="tt-now" style={{ top: (nowMin - from) * ppm }} />
                  )}

                  {layoutDay(byDay[d] || []).map((s) => {
                    const top = (s.startMin - from) * ppm
                    const alto = Math.max(22, (s.endMin - s.startMin) * ppm - 3)
                    const ancho = 100 / (s.lanes || 1)
                    return (
                      <button
                        key={s.id}
                        className={`tt-block ${isVirtual(s) ? 'virtual' : ''} ${alto < 46 ? 'compact' : ''}`}
                        style={{
                          top,
                          height: alto,
                          left: `${(s.lane || 0) * ancho}%`,
                          width: `calc(${ancho}% - 6px)`,   // 3 px a cada lado
                          background: tint(s.courseColor, 0.13),
                          borderColor: s.courseColor,
                        }}
                        onClick={() => onOpen(s.courseId)}
                        title={`${s.courseName} · ${s.start}–${s.end} · ${MODE_LABEL[s.mode] || ''}${s.room ? ` · ${s.room}` : ''}`}
                      >
                        <span className="tt-block-name" style={{ color: s.courseColor }}>{s.courseName}</span>
                        <span className="tt-block-time">{s.start}–{s.end}</span>
                        {alto >= 46 && (
                          <span className="tt-block-meta">
                            {[s.label, s.room, isVirtual(s) ? 'Virtual' : null].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
            <div className="tt-legend">
              {leyenda.map((s) => (
                <span key={s.courseId}>
                  <i style={{ background: s.courseColor }} /> {s.courseName}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {!vacío && (
        <p className="hint">
          <Icon name="info" size={13} color={colors.textFaint} />{' '}
          Los bloques con borde punteado son clases virtuales. Haz clic en uno para abrir su curso.
        </p>
      )}
    </div>
  )
}
