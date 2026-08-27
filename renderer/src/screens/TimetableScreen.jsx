import React, { useEffect, useMemo, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import {
  WEEK_ORDER, dayName, MODES, MODE_LABEL, isVirtual, minutesOf,
  allSessions, sessionsByDay, layoutDay, dayBounds, fmtTime, nextClass,
  BLOCK_SUGGESTIONS, MAX_BLOCK_NAME, MAX_ROOM,
} from '../lib/classes.js'
import { Card, Switch, Icon, TimeField, Modal, DateField } from '../components/ui.jsx'
import { colors, palette } from '../theme.js'

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
  const { state, dispatch } = useStore()
  const [onlyActive, setOnlyActive] = useState(true)
  // El reloj se refresca cada minuto: así la línea de "ahora" y la cuenta
  // regresiva de la próxima clase no se quedan congeladas.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const [printing, setPrinting] = useState(false)

  const blocks = state.blocks ?? []
  const sessions = useMemo(
    () => allSessions(state.courses, { onlyActive, date: now, blocks }),
    [state.courses, blocks, onlyActive, now],
  )
  const byDay = useMemo(
    () => sessionsByDay(state.courses, { onlyActive, date: now, blocks }),
    [state.courses, blocks, onlyActive, now],
  )
  const next = useMemo(() => nextClass(state.courses, now, blocks), [state.courses, blocks, now])

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
          <span className="hint" style={{ margin: 0 }}>Solo lo vigente</span>
          <Switch checked={onlyActive} onChange={setOnlyActive}
            label="Ocultar los cursos y bloques cuyas fechas ya pasaron" />
          <button className="btn ghost" onClick={() => setPrinting(true)} disabled={vacío}
            title="Imprime la semana en una hoja A4 apaisada">
            <Icon name="printer" size={15} /> Imprimir
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
              <span>{onlyActive ? 'Solo lo vigente' : 'Todo'} · {now.toLocaleDateString()}</span>
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
                        onClick={() => s.courseId && onOpen(s.courseId)}
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
          El borde punteado marca lo virtual. Haz clic en una clase para abrir su curso;
          los bloques que no son de un curso se editan aquí abajo.
        </p>
      )}

      <BloquesCard blocks={blocks} dispatch={dispatch} />
    </div>
  )
}

// ------------------------------------------------------------
//  Otros bloques: lo del horario que no es un curso
// ------------------------------------------------------------
const fmtFecha = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : null)

function BloquesCard({ blocks, dispatch }) {
  const [colorDe, setColorDe] = useState(null)     // id del bloque con el selector de color abierto
  const [fechasDe, setFechasDe] = useState(null)   // id del bloque con las fechas abiertas

  const patch = (id, p) => dispatch({ type: 'UPDATE_BLOCK', id, patch: p })
  const editandoColor = blocks.find((b) => b.id === colorDe)
  const editandoFechas = blocks.find((b) => b.id === fechasDe)

  const vigencia = (b) => {
    const a = fmtFecha(b.startDate)
    const z = fmtFecha(b.endDate)
    if (!a && !z) return 'Siempre'
    if (a && z) return `${a} – ${z}`
    return a ? `Desde ${a}` : `Hasta ${z}`
  }

  return (
    <Card style={{ marginTop: 14 }}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <h3 className="section-title">Otros bloques</h3>
        {blocks.length > 0 && (
          <span className="weights-sum">{blocks.length} en tu semana</span>
        )}
      </div>
      <p className="p">
        Lo que te ocupa la semana sin ser un curso: el trabajo, las prácticas, el gimnasio.
        Sale en la rejilla de arriba junto a las clases, pero no cuenta para ninguna nota.
      </p>

      <datalist id="nombres-de-bloque">
        {BLOCK_SUGGESTIONS.map((n) => <option key={n} value={n} />)}
      </datalist>

      {blocks.length > 0 && (
        <div className="class-table">
          <div className="block-head">
            <div />
            <div>Nombre</div>
            <div>Día</div>
            <div>Inicio</div>
            <div>Fin</div>
            <div>Modalidad</div>
            <div>Lugar</div>
            <div>Vigencia</div>
            <div />
          </div>

          {blocks.map((b) => (
            <div key={b.id} className="block-row">
              <button className="swatch sm" style={{ background: b.color }} onClick={() => setColorDe(b.id)}
                aria-label={`Color de ${b.name || 'este bloque'}`} />

              <input className="text" list="nombres-de-bloque" maxLength={MAX_BLOCK_NAME}
                aria-label="Nombre del bloque" placeholder="Trabajo, Prácticas…"
                value={b.name || ''} onChange={(e) => patch(b.id, { name: e.target.value })} />

              <div className="select">
                <select value={b.day} aria-label="Día del bloque"
                  onChange={(e) => patch(b.id, { day: Number(e.target.value) })}>
                  {WEEK_ORDER.map((d) => <option key={d} value={d}>{dayName(d, true)}</option>)}
                </select>
                <Icon name="chevron-down" size={13} color={colors.textSoft} />
              </div>

              <TimeField value={b.start} label="Hora de inicio" onCommit={(v) => patch(b.id, { start: v })} />
              <TimeField value={b.end} label="Hora de fin" onCommit={(v) => patch(b.id, { end: v })}
                invalid={minutesOf(b.start) != null && minutesOf(b.end) != null
                  && minutesOf(b.end) <= minutesOf(b.start)} />

              <div className="select">
                <select value={b.mode || 'presencial'} aria-label="Modalidad del bloque"
                  onChange={(e) => patch(b.id, { mode: e.target.value })}>
                  {MODES.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
                </select>
                <Icon name="chevron-down" size={13} color={colors.textSoft} />
              </div>

              <input className="text" maxLength={MAX_ROOM} aria-label="Lugar"
                placeholder={b.mode === 'virtual' ? 'Sala, plataforma…' : 'Oficina, sede…'}
                value={b.room || ''} onChange={(e) => patch(b.id, { room: e.target.value })} />

              <button className="btn ghost vigencia" onClick={() => setFechasDe(b.id)}
                title="Desde cuándo y hasta cuándo va este bloque">
                {vigencia(b)}
              </button>

              <button className="icon-btn" aria-label="Eliminar bloque"
                onClick={() => dispatch({ type: 'DELETE_BLOCK', id: b.id })}>
                <Icon name="x" size={15} color={colors.textFaint} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button className="btn dashed" onClick={() => dispatch({ type: 'ADD_BLOCK' })}>
        + Agregar bloque
      </button>

      <Modal open={editandoColor != null} onClose={() => setColorDe(null)} title="Color del bloque" width={320}>
        <div className="swatches">
          {palette.map((col) => (
            <button key={col} className={`swatch ${editandoColor?.color === col ? 'active' : ''}`}
              style={{ background: col }} aria-label={`Color ${col}`}
              onClick={() => { patch(colorDe, { color: col }); setColorDe(null) }} />
          ))}
        </div>
      </Modal>

      <Modal open={editandoFechas != null} onClose={() => setFechasDe(null)} title="Vigencia del bloque" width={380}>
        <p className="sheet-text">
          Déjalas vacías y el bloque sale siempre. Con fechas se comporta como un curso:
          entra y sale del horario solo, y el interruptor “Solo lo vigente” lo filtra igual.
        </p>
        {editandoFechas && (
          <div className="grid2" style={{ marginTop: 12 }}>
            <DateField label="Desde" value={editandoFechas.startDate}
              onChange={(iso) => patch(fechasDe, { startDate: iso })} />
            <DateField label="Hasta" value={editandoFechas.endDate} min={editandoFechas.startDate}
              onChange={(iso) => patch(fechasDe, { endDate: iso })} />
          </div>
        )}
        <div className="sheet-actions">
          <button className="btn primary" onClick={() => setFechasDe(null)}>Listo</button>
        </div>
      </Modal>
    </Card>
  )
}

