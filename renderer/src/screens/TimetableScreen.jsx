import React, { useEffect, useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import {
  WEEK_ORDER, dayName, MODE_LABEL, isVirtual,
  allSessions, sessionsByDay, layoutDay, dayBounds, fmtTime, nextClass, weekRangeOf,
} from '../lib/classes.js'
import { Card, Switch, Icon } from '../components/ui.jsx'
import ScheduleSheet from '../components/ScheduleSheet.jsx'
import { colors } from '../theme.js'

// Alto de un minuto en la rejilla, en píxeles.
const PX_PER_MIN = 1

// Alto disponible para la rejilla al imprimir. Una A4 apaisada a 96 ppp mide
// 1122x794 px; con 10 mm de margen quedan 718 px de alto, de los que se van
// el título, la fila de días y la leyenda. Con esto la semana entra siempre
// en UNA hoja: se comprime el eje de horas y las letras no se tocan.
const PRINT_GRID_H = 545

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

  // La hoja de agregar/editar. null = cerrada; { edit: null } = una nueva.
  const [hoja, setHoja] = useState(null)

  const blocks = state.blocks ?? []
  // scope 'week': se muestra lo vigente en cualquier día de esta semana, no solo
  // lo de hoy, para que una actividad que arranca el jueves ya aparezca.
  const opts = { onlyActive, date: now, blocks, scope: 'week' }
  const sessions = useMemo(
    () => allSessions(state.courses, opts),
    [state.courses, blocks, onlyActive, now],
  )
  const byDay = useMemo(
    () => sessionsByDay(state.courses, opts),
    [state.courses, blocks, onlyActive, now],
  )
  // Rango de la semana en curso, para la cabecera de impresión.
  const semana = useMemo(() => {
    const r = weekRangeOf(now)
    return r ? `${r.from.toLocaleDateString()} – ${r.to.toLocaleDateString()}` : now.toLocaleDateString()
  }, [now])
  const next = useMemo(() => nextClass(state.courses, now, blocks), [state.courses, blocks, now])

  // Un clic en la rejilla abre lo que sea que se toco, en la misma hoja. Antes
  // una clase saltaba al curso y una actividad se editaba en una tabla aparte.
  const abrir = (s) => {
    if (s.blockId) {
      const b = blocks.find((x) => x.id === s.blockId)
      if (b) setHoja({ edit: { kind: 'actividad', block: b } })
      return
    }
    const c = state.courses.find((x) => x.id === s.courseId)
    const sesion = (c?.sessions ?? []).find((x) => x.id === s.id)
    if (sesion) setHoja({ edit: { kind: 'clase', courseId: s.courseId, session: sesion } })
  }

  // Días a mostrar: los que tienen clase. Si no hay ninguno, de lunes a viernes.
  const conClase = WEEK_ORDER.filter((d) => (byDay[d] || []).length > 0)
  const days = conClase.length ? conClase : [1, 2, 3, 4, 5]

  const { from, to } = dayBounds(sessions)
  const ppm = printing ? Math.min(PX_PER_MIN, PRINT_GRID_H / Math.max(1, to - from)) : PX_PER_MIN
  const height = (to - from) * ppm
  const hours = []
  for (let m = from; m <= to; m += 60) hours.push(m)

  // Detalle de la hoja impresa: cada clase con su dato completo. Es la red de
  // seguridad del papel — si un bloque de la rejilla queda demasiado chico para
  // su texto, aquí está todo, y de paso sirve de leyenda de colores.
  const detalle = useMemo(() => (
    WEEK_ORDER.filter((d) => (byDay[d] || []).length > 0)
      .flatMap((d) => byDay[d].map((s) => ({ ...s, dia: d })))
  ), [byDay])

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
          <span className="hint" style={{ margin: 0 }}>Solo lo de esta semana</span>
          <Switch checked={onlyActive} onChange={setOnlyActive}
            label="Ocultar los cursos y bloques cuyas fechas no tocan esta semana" />
          <button className="btn ghost" onClick={() => setPrinting(true)} disabled={vacío}
            title="Imprime la semana en una hoja A4 apaisada">
            <Icon name="printer" size={15} /> Imprimir
          </button>
          <button className="btn primary" onClick={() => setHoja({ edit: null })}
            title="Agrega una clase de un curso o una actividad">
            <Icon name="plus" size={15} /> Agregar al horario
          </button>
        </div>
      </div>

      {next && (
        <Card className="next-class">
          <div className="kicker">
            {next.ongoing
              ? (next.blockId ? 'Ahora mismo' : 'En clase')
              : (next.blockId ? 'Lo siguiente' : 'Próxima clase')}
          </div>
          <div className="row" style={{ gap: 9, marginTop: 6 }}>
            <span className="dot" style={{ background: next.courseColor }} />
            <button className="link-strong" onClick={() => abrir(next)}>{next.courseName}</button>
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
            Todavía no hay nada esta semana. Usa “Agregar al horario”: sirve
            igual para una clase de un curso que para lo que no es un curso.
          </p>
        ) : (
          <div className="tt" style={{ '--tt-cols': days.length }}>
            {/* Solo se ve en el papel: en pantalla el título ya está arriba. */}
            <div className="tt-print-head">
              <h1>Horario de clases</h1>
              <span>{onlyActive ? `Semana del ${semana}` : 'Todo el horario'}</span>
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
                    // En papel el mínimo sube: hay que dejar sitio a las dos
                    // líneas de texto, que ahí no se pueden desplegar al pasar el ratón.
                    const alto = Math.max(printing ? 27 : 22, (s.endMin - s.startMin) * ppm - 3)
                    const ancho = 100 / (s.lanes || 1)
                    return (
                      <button
                        key={s.id}
                        className={`tt-block ${isVirtual(s) ? 'virtual' : ''} ${!printing && alto < 46 ? 'compact' : ''}`}
                        style={{
                          top,
                          height: alto,
                          left: `${(s.lane || 0) * ancho}%`,
                          width: `calc(${ancho}% - 6px)`,   // 3 px a cada lado
                          background: tint(s.courseColor, 0.13),
                          borderColor: s.courseColor,
                        }}
                        onClick={() => abrir(s)}
                        title={`${s.courseName} · ${s.start}–${s.end} · ${MODE_LABEL[s.mode] || ''}${s.room ? ` · ${s.room}` : ''}`}
                      >
                        <span className="tt-block-name" style={{ color: s.courseColor }}>{s.courseName}</span>
                        {printing ? (
                          // En papel no hay tooltip ni desplazamiento: todo el dato del
                          // bloque va en una sola línea, y el nombre puede partirse.
                          <span className="tt-block-meta">
                            {[`${s.start}–${s.end}`, s.label, s.room, isVirtual(s) ? 'Virtual' : null]
                              .filter(Boolean).join(' · ')}
                          </span>
                        ) : (
                          <>
                            <span className="tt-block-time">{s.start}–{s.end}</span>
                            {alto >= 46 && (
                              <span className="tt-block-meta">
                                {[s.label, s.room, isVirtual(s) ? 'Virtual' : null].filter(Boolean).join(' · ')}
                              </span>
                            )}
                          </>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
            <div className="tt-detalle">
              <h2>Detalle de la semana</h2>
              <ul>
                {detalle.map((s) => (
                  <li key={s.id}>
                    <i style={{ background: s.courseColor }} />
                    <b>{dayName(s.dia)}</b> {s.start}–{s.end} · {s.courseName}
                    {[s.label, s.room, isVirtual(s) ? 'Virtual' : null]
                      .filter(Boolean).map((x) => ` · ${x}`).join('')}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Card>

      {!vacío && (
        <p className="hint">
          <Icon name="info" size={13} color={colors.textFaint} />{' '}
          El borde punteado marca lo virtual. Haz clic en cualquier bloque de la
          rejilla para editarlo, sea una clase o una actividad.
        </p>
      )}

      <ActividadesCard blocks={blocks}
        onNueva={() => setHoja({ edit: null, kind: 'actividad' })}
        onEditar={(b) => setHoja({ edit: { kind: 'actividad', block: b } })} />

      {hoja && (
        <ScheduleSheet
          key={hoja.edit?.session?.id ?? hoja.edit?.block?.id ?? 'nueva'}
          edit={hoja.edit}
          defaultKind={hoja.kind ?? null}
          onOpenCourse={onOpen}
          onClose={() => setHoja(null)}
        />
      )}
    </div>
  )
}

// ------------------------------------------------------------
//  Actividades: lo del horario que no es un curso
// ------------------------------------------------------------
//  Antes esto era una tabla de nueve columnas que obligaba a desplazar en
//  horizontal y que editaba con controles distintos a los de una clase. Ahora
//  solo lista lo que hay; agregar y editar pasan por la hoja compartida.
const fmtFecha = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : null)

const vigencia = (b) => {
  const a = fmtFecha(b.startDate)
  const z = fmtFecha(b.endDate)
  if (!a && !z) return null
  if (a && z) return `${a} – ${z}`
  return a ? `Desde ${a}` : `Hasta ${z}`
}

function ActividadesCard({ blocks, onNueva, onEditar }) {
  return (
    <Card style={{ marginTop: 14 }}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <h3 className="section-title">Actividades</h3>
        {blocks.length > 0 && (
          <span className="weights-sum">{blocks.length} en tu semana</span>
        )}
      </div>
      <p className="p">
        Lo que te ocupa la semana sin ser un curso: el trabajo, el deporte, los traslados.
        Sale en la rejilla de arriba junto a las clases, pero no cuenta para ninguna nota.
      </p>

      {blocks.map((b) => (
        <button key={b.id} className="act-row" onClick={() => onEditar(b)}
          title={`Editar ${b.name || 'esta actividad'}`}>
          <span className="act-time">{dayName(b.day)} {b.start}</span>
          <span className={`act-bar ${b.mode === 'virtual' ? 'virtual' : ''}`}
            style={{ background: b.color }} />
          <span className="act-main">
            <span className="act-name">{b.name || b.label || 'Sin nombre'}</span>
            <span className="act-meta">
              {[`${b.start}–${b.end}`, b.name ? b.label : null,
                MODE_LABEL[b.mode] || MODE_LABEL.presencial, b.room, vigencia(b)]
                .filter(Boolean).join('  ·  ')}
            </span>
          </span>
          <Icon name="edit-3" size={15} color={colors.textFaint} className="act-edit" />
        </button>
      ))}

      <button className="btn dashed" onClick={onNueva}>
        + Agregar actividad
      </button>
    </Card>
  )
}
