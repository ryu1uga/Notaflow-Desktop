import React, { useEffect, useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import {
  WEEK_ORDER, dayName, MODE_LABEL, isVirtual,
  allSessions, sessionsByDay, layoutDay, dayBounds, fmtTime, nextClass,
} from '../lib/classes.js'
import { Card, Switch, Icon } from '../components/ui.jsx'
import { colors } from '../theme.js'

// Alto de una hora en la rejilla.
const PX_PER_MIN = 1

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
  const height = (to - from) * PX_PER_MIN
  const hours = []
  for (let m = from; m <= to; m += 60) hours.push(m)

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
            <div className="tt-head">
              <div className="tt-gutter" />
              {days.map((d) => (
                <div key={d} className={`tt-dayhead ${d === hoy ? 'today' : ''}`}>
                  {dayName(d, true)}
                </div>
              ))}
            </div>

            {/* El +10 compensa el padding-top de .tt-body (box-sizing: border-box):
                si no, la última hora cae fuera de las columnas. */}
            <div className="tt-body" style={{ height: height + 10 }}>
              <div className="tt-gutter">
                {hours.map((m) => (
                  <span key={m} className="tt-hour" style={{ top: (m - from) * PX_PER_MIN }}>{fmtTime(m)}</span>
                ))}
              </div>

              {days.map((d) => (
                <div key={d} className={`tt-col ${d === hoy ? 'today' : ''}`}>
                  {hours.map((m) => (
                    <div key={m} className="tt-line" style={{ top: (m - from) * PX_PER_MIN }} />
                  ))}

                  {d === hoy && enRango && (
                    <div className="tt-now" style={{ top: (nowMin - from) * PX_PER_MIN }} />
                  )}

                  {layoutDay(byDay[d] || []).map((s) => {
                    const top = (s.startMin - from) * PX_PER_MIN
                    const alto = Math.max(22, (s.endMin - s.startMin) * PX_PER_MIN - 3)
                    const ancho = 100 / (s.lanes || 1)
                    return (
                      <button
                        key={s.id}
                        className={`tt-block ${isVirtual(s) ? 'virtual' : ''} ${alto < 46 ? 'compact' : ''}`}
                        style={{
                          top,
                          height: alto,
                          left: `${(s.lane || 0) * ancho}%`,
                          width: `calc(${ancho}% - 3px)`,
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
