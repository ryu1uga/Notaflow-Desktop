import React, { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import {
  analyzeCourse, effectiveScale, effectiveRound, neededOnNext,
  fmtGrade, STATUS_META, decimalsFromStep,
} from '../lib/calc.js'
import { evalEffectiveDate, weekFromDate, notifyFireAt } from '../lib/schedule.js'
import {
  Card, Badge, Progress, Icon, NumField, Switch, TypeField, TimeField,
  InfoButton, DateField, Confirm,
} from '../components/ui.jsx'
import { colors, palette, statusColor } from '../theme.js'
import { TYPES, OTHER, MAX_TIPO } from '../lib/evalTypes.js'
import {
  WEEK_ORDER, dayName, MODES, MODE_LABEL, BLOCK_LABELS, MAX_LABEL, MAX_ROOM,
  minutesOf, fmtTime, weeklyMinutes,
} from '../lib/classes.js'

const two = (n) => String(n).padStart(2, '0')
const fmtDate = (d) => (d ? d.toLocaleDateString() : null)
const fmtDateTime = (d) => `${d.toLocaleDateString()} a las ${two(d.getHours())}:${two(d.getMinutes())}`
const trimNum = (n) => String(Number(Number(n).toFixed(2)))

// "3 h 20 min" a partir de minutos sueltos.
const fmtDuration = (mins) => {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return [h ? `${h} h` : null, m ? `${m} min` : null].filter(Boolean).join(' ') || '0 min'
}

const STEP_INFO = {
  title: 'Paso de la nota',
  text: 'Define a qué valores se ajusta (redondea) la nota final:\n\n• 1 → notas enteras (…, 10, 11, 12)\n• 0.5 → medios puntos (10, 10.5, 11)\n• 0.25 → cuartos (10, 10.25, 10.5)\n• 0.1 → un decimal (10.0, 10.1, 10.2)\n\nElige el que use tu facultad para calcular la nota final.',
}

export default function CourseDetailScreen({ course, onBack }) {
  const { state, dispatch } = useStore()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)

  const scale = effectiveScale(course, state.settings)
  const round = effectiveRound(course, state.settings)
  const a = analyzeCourse(course.evaluations, scale, { round })
  const meta = STATUS_META[a.status]
  const dec = decimalsFromStep(scale.step || 1)

  const patchCourse = (patch) => dispatch({ type: 'UPDATE_COURSE', id: course.id, patch })
  const patchEval = (evalId, patch) => dispatch({ type: 'UPDATE_EVAL', courseId: course.id, evalId, patch })

  const patchSession = (sessionId, patch) => dispatch({ type: 'UPDATE_SESSION', courseId: course.id, sessionId, patch })

  // Las clases se listan de lunes a domingo. Se ordena de forma tolerante:
  // una hora a medio escribir no puede hacer desaparecer la fila.
  const sessions = [...(course.sessions ?? [])].sort((a, b) => {
    const da = WEEK_ORDER.indexOf(a.day)
    const db = WEEK_ORDER.indexOf(b.day)
    if (da !== db) return da - db
    return (minutesOf(a.start) ?? 0) - (minutesOf(b.start) ?? 0)
  })
  const semanales = weeklyMinutes(course)
  const horasIncompletas = sessions.some((s) => minutesOf(s.start) == null || minutesOf(s.end) == null)
  // ¿Esta clase termina antes de empezar?
  const rangoMalo = (s) => {
    const a = minutesOf(s.start)
    const b = minutesOf(s.end)
    return a != null && b != null && b <= a
  }
  const hayRangoMalo = sessions.some(rangoMalo)

  // Al mover la hora de inicio, la clase conserva su duración.
  const setStart = (s, v) => {
    const antes = minutesOf(s.start)
    const fin = minutesOf(s.end)
    const nuevo = minutesOf(v)
    if (nuevo == null || antes == null || fin == null || fin <= antes) return patchSession(s.id, { start: v })
    patchSession(s.id, { start: v, end: fmtTime(nuevo + (fin - antes)) })
  }

  // La hora de fin se guarda tal cual. Si queda antes del inicio se marca la
  // fila y se avisa debajo de la tabla, en vez de reescribirla por el usuario.
  const setEnd = (s, v) => patchSession(s.id, { end: v })

  // Fija el día exacto de una evaluación y, si hay fecha de inicio, deriva la semana.
  const setEvalDate = (evalId, iso) => {
    const week = course.startDate && iso ? weekFromDate(course.startDate, iso) : null
    patchEval(evalId, week != null ? { date: iso, week } : { date: iso })
  }

  // Próxima pendiente: por fecha efectiva, y si no hay fecha, por semana.
  const pendingSorted = a.pending
    .map((e) => ({ e, d: evalEffectiveDate(course, e) }))
    .sort((x, y) => {
      if (x.d && y.d) return x.d - y.d
      if (x.d) return -1
      if (y.d) return 1
      return (x.e.week ?? 99) - (y.e.week ?? 99)
    })
  const nextEval = pendingSorted[0]?.e
  const nextDate = pendingSorted[0]?.d || null
  const nextReq = nextEval ? neededOnNext(a, nextEval, scale) : null
  const nextFire = state.settings.notificationsOn && nextDate
    ? notifyFireAt(nextDate, Number(state.settings.notifyDaysBefore ?? 2), Number(state.settings.notifyHour ?? 9), Number(state.settings.notifyMinute ?? 0))
    : null

  const pctSum = a.totalWeightPct
  const roundOn = course.useOwnScale && course.roundFinal != null
    ? course.roundFinal !== false
    : state.settings.roundFinal !== false

  // --- Reordenar arrastrando (HTML5 drag & drop) ---
  const onDrop = (targetId) => {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return }
    const list = [...course.evaluations]
    const from = list.findIndex((e) => e.id === dragId)
    const to = list.findIndex((e) => e.id === targetId)
    if (from < 0 || to < 0) return
    const [moved] = list.splice(from, 1)
    list.splice(to, 0, moved)
    dispatch({ type: 'REORDER_EVALS', courseId: course.id, evaluations: list })
    setDragId(null)
    setOverId(null)
  }

  return (
    <div className="page">
      <button className="back-link" onClick={onBack}>
        <Icon name="arrow-left" size={17} color={colors.brand} /> Volver a mis cursos
      </button>

      {/* Encabezado del curso */}
      <Card>
        <div className="row">
          <input
            className="course-title-input"
            value={course.name}
            onChange={(e) => patchCourse({ name: e.target.value })}
            aria-label="Nombre del curso"
          />
          <button className="icon-btn" onClick={() => setConfirmDelete(true)} aria-label="Eliminar curso">
            <Icon name="trash-2" size={17} color={colors.red} />
          </button>
        </div>

        <div className="swatches">
          {palette.map((col) => (
            <button
              key={col}
              className={`swatch ${course.color === col ? 'active' : ''}`}
              style={{ background: col }}
              onClick={() => patchCourse({ color: col })}
              aria-label={`Color ${col}`}
            />
          ))}
        </div>

        <div className="row" style={{ gap: 14, marginTop: 16, alignItems: 'flex-end' }}>
          <DateField label="Inicio del curso" value={course.startDate} onChange={(iso) => patchCourse({ startDate: iso })} />
          <DateField label="Fin del curso" value={course.endDate} min={course.startDate} onChange={(iso) => patchCourse({ endDate: iso })} />
          <div className="spacer" />
        </div>

        <p className="hint">
          {course.startDate
            ? 'Cada evaluación toma su fecha del inicio más su semana. Si fijas el día exacto en la tabla, calculo la semana solo.'
            : 'Pon la fecha de inicio para calcular cuándo cae cada evaluación, o fija el día exacto en cada fila de la tabla.'}
        </p>
      </Card>

      {/* Nota actual + estado + para aprobar */}
      <div className="grid3" style={{ marginTop: 14 }}>
        <Card style={{ margin: 0 }}>
          <div className="kicker">Nota actual</div>
          <div className="big-grade" style={{ color: course.color }}>
            {fmtGrade(a.currentAvg, scale)}<small> / {scale.max}</small>
          </div>
          <Progress value={a.currentAvg || 0} max={scale.max} color={course.color} threshold={scale.passing} />
          <p className="hint">Vas por el {Math.round(a.gradedWeight * 100)}% del curso ya rendido.</p>
        </Card>

        <Card style={{ margin: 0 }}>
          <div className="kicker">Estado</div>
          <div style={{ margin: '10px 0 8px' }}><Badge color={meta.color}>{meta.label}</Badge></div>
          <p className="hint" style={{ marginTop: 0 }}>{meta.hint}</p>
          <div className="mini-row">
            <div className="mini-box"><div className="l">Máx. posible</div><div className="v">{fmtGrade(a.maxPossible, scale)}</div></div>
            <div className="mini-box"><div className="l">Mín. posible</div><div className="v">{fmtGrade(a.minPossible, scale)}</div></div>
          </div>
        </Card>

        <Card style={{ margin: 0 }}>
          <div className="kicker">Para aprobar ({scale.passing})</div>
          {a.pendingWeight <= 0 ? (
            <p className="hint">Ya no queda nada pendiente.</p>
          ) : a.status === 'imposible' ? (
            <p className="hint" style={{ color: colors.red }}>Ya no da para {scale.passing} con lo que queda.</p>
          ) : a.status === 'seguro' ? (
            <p className="hint" style={{ color: colors.emerald }}>Asegurado, aunque saques lo mínimo.</p>
          ) : (
            <>
              <p className="hint">Te falta sacar, en promedio:</p>
              <div className="big-grade" style={{ color: colors.amber, fontSize: 30 }}>
                {fmtGrade(Math.max(scale.min, a.neededAvgOnPending), scale)}<small> / {scale.max}</small>
              </div>
              <p className="hint" style={{ marginTop: 0 }}>en el {Math.round(a.pendingWeight * 100)}% que queda</p>
            </>
          )}
        </Card>
      </div>

      {/* Próxima evaluación */}
      {nextEval && nextReq && a.status !== 'seguro' && a.status !== 'imposible' && (
        <Card className="next" style={{ marginTop: 14 }}>
          <div className="kicker">
            Próxima{nextEval.week ? ` · semana ${nextEval.week}` : ''}{nextDate ? ` · ${fmtDate(nextDate)}` : ''}
          </div>
          <p className="next-name">
            {nextEval.name} <span style={{ color: colors.textFaint, fontWeight: 400 }}>({Math.round(nextReq.weight * 100)}%)</span>
          </p>
          {nextReq.triviallyOk ? (
            <p className="hint" style={{ color: colors.emerald }}>Con cualquier nota sigues, si clavas el resto.</p>
          ) : nextReq.feasible ? (
            <p className="hint">
              Mínimo aquí, sacando el máximo en lo demás:{' '}
              <strong style={{ color: colors.amber }}>{nextReq.clamped.toFixed(dec)}</strong>
            </p>
          ) : (
            <p className="hint" style={{ color: colors.red }}>Ni con {scale.max} aquí basta; te la juegas en varias.</p>
          )}
          {nextFire && (
            <div className="notify-line">
              <Icon name="bell" size={13} color={colors.textFaint} />
              {nextFire.getTime() > Date.now()
                ? `Te aviso el ${fmtDateTime(nextFire)}`
                : `El aviso ya pasó (${fmtDateTime(nextFire)})`}
            </div>
          )}
        </Card>
      )}

      {/* Tabla de evaluaciones */}
      <Card style={{ marginTop: 14 }}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 className="section-title">Evaluaciones</h3>
          <span className={`weights-sum ${(pctSum > 100.5 || pctSum < 99.5) ? 'warn' : ''}`}>
            Pesos: {Math.round(pctSum)}%
          </span>
        </div>

        <div className="eval-table">
          <div className="eval-head">
            <div />
            <div>Nombre</div>
            <div>Tipo</div>
            <div>Fecha</div>
            <div className="c">Sem</div>
            <div className="c">Peso %</div>
            <div className="c">Nota</div>
            <div />
          </div>

          {course.evaluations.length === 0 && (
            <p className="empty" style={{ padding: '18px 0' }}>Sin evaluaciones. Agrega la primera abajo.</p>
          )}

          {course.evaluations.map((e) => {
            const wPct = a.asPercent ? e.weight : (e.weight || 0) * 100
            const gradeBg = e.grade == null ? 'transparent' : e.grade >= scale.passing ? statusColor.emerald.bg : statusColor.red.bg
            const gradeFg = e.grade == null ? colors.textFaint : e.grade >= scale.passing ? statusColor.emerald.fg : statusColor.red.fg
            return (
              <div
                key={e.id}
                className={`eval-row ${dragId === e.id ? 'dragging' : ''} ${overId === e.id ? 'drop-target' : ''}`}
                onDragOver={(ev) => { ev.preventDefault(); setOverId(e.id) }}
                onDragLeave={() => setOverId((id) => (id === e.id ? null : id))}
                onDrop={() => onDrop(e.id)}
              >
                <button
                  className="drag-handle"
                  draggable
                  onDragStart={() => setDragId(e.id)}
                  onDragEnd={() => { setDragId(null); setOverId(null) }}
                  aria-label="Arrastrar para reordenar"
                  title="Arrastra para reordenar"
                >
                  <Icon name="menu" size={16} />
                </button>

                <input
                  className="eval-name"
                  value={e.name}
                  onChange={(ev) => patchEval(e.id, { name: ev.target.value })}
                  aria-label="Nombre de la evaluación"
                />

                <TypeField
                  value={e.type}
                  options={TYPES}
                  maxLength={MAX_TIPO}
                  fallback={OTHER}
                  onChange={(t) => patchEval(e.id, { type: t })}
                />

                <DateField value={e.date} onChange={(iso) => setEvalDate(e.id, iso)} />

                <NumField integer allowEmpty placeholder="—" value={e.week}
                  onChangeNumber={(v) => patchEval(e.id, { week: v })} />

                <NumField value={wPct} format={trimNum}
                  onChangeNumber={(v) => patchEval(e.id, { weight: a.asPercent ? v : v / 100 })} />

                <NumField className="grade-cell" allowEmpty placeholder="pend." value={e.grade}
                  style={{ background: gradeBg, color: gradeFg }}
                  onChangeNumber={(v) => patchEval(e.id, { grade: v })} />

                <button className="icon-btn" aria-label="Eliminar evaluación"
                  onClick={() => dispatch({ type: 'DELETE_EVAL', courseId: course.id, evalId: e.id })}>
                  <Icon name="x" size={15} color={colors.textFaint} />
                </button>
              </div>
            )
          })}
        </div>

        {course.evaluations.length > 1 && (
          <p className="hint">Arrastra el asa (≡) de una fila para cambiar el orden.</p>
        )}

        <button className="btn dashed" onClick={() => dispatch({ type: 'ADD_EVAL', courseId: course.id })}>
          + Agregar evaluación
        </button>
      </Card>

      {/* Clases (horario semanal) */}
      <Card style={{ marginTop: 14 }}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 className="section-title">Clases</h3>
          {sessions.length > 0 && (
            <span className="weights-sum">{fmtDuration(semanales)} a la semana</span>
          )}
        </div>
        <p className="p">
          Los días y horas en que te toca este curso. Aparecen todos juntos en la pestaña Horario.
        </p>

        {sessions.length > 0 && (
          <div className="class-table">
            <div className="class-head">
              <div>Día</div>
              <div>Inicio</div>
              <div>Fin</div>
              <div>Modalidad</div>
              <div>Bloque</div>
              <div>Aula</div>
              <div />
            </div>

            {sessions.map((s) => (
              <div key={s.id} className="class-row">
                <div className="select">
                  <select value={s.day} aria-label="Día de la clase"
                    onChange={(ev) => patchSession(s.id, { day: Number(ev.target.value) })}>
                    {WEEK_ORDER.map((d) => <option key={d} value={d}>{dayName(d, true)}</option>)}
                  </select>
                  <Icon name="chevron-down" size={13} color={colors.textSoft} />
                </div>

                <TimeField value={s.start} label="Hora de inicio"
                  onCommit={(v) => setStart(s, v)} />

                <TimeField value={s.end} label="Hora de fin" invalid={rangoMalo(s)}
                  onCommit={(v) => setEnd(s, v)} />

                <div className="seg">
                  {MODES.map((m) => (
                    <button key={m} className={s.mode === m ? 'on' : ''}
                      onClick={() => patchSession(s.id, { mode: m })}>
                      {MODE_LABEL[m]}
                    </button>
                  ))}
                </div>

                <TypeField
                  value={s.label || ''}
                  options={BLOCK_LABELS}
                  maxLength={MAX_LABEL}
                  fallback=""
                  emptyLabel="Sin bloque"
                  label="Tipo de bloque"
                  title="Tipo de bloque"
                  hint="Escribe cómo se llama este bloque, como aparece en tu horario."
                  placeholder="Asesoría, Práctica dirigida…"
                  onChange={(l) => patchSession(s.id, { label: l })}
                />

                <input className="text" maxLength={MAX_ROOM} aria-label="Aula"
                  placeholder={s.mode === 'virtual' ? 'Sala, plataforma…' : 'B-204'}
                  value={s.room || ''} onChange={(ev) => patchSession(s.id, { room: ev.target.value })} />

                <button className="icon-btn" aria-label="Eliminar clase"
                  onClick={() => dispatch({ type: 'DELETE_SESSION', courseId: course.id, sessionId: s.id })}>
                  <Icon name="x" size={15} color={colors.textFaint} />
                </button>
              </div>
            ))}
          </div>
        )}

        {horasIncompletas && (
          <p className="hint" style={{ color: colors.amber }}>
            Hay una clase sin hora completa: esa no sale en el horario hasta que la llenes.
          </p>
        )}

        {hayRangoMalo && (
          <p className="hint" style={{ color: colors.amber }}>
            Hay una clase que termina antes de empezar: revisa su hora de fin.
          </p>
        )}

        <button className="btn dashed" onClick={() => dispatch({ type: 'ADD_SESSION', courseId: course.id })}>
          + Agregar clase
        </button>
      </Card>

      {/* Escala del curso */}
      <Card style={{ marginTop: 14, marginBottom: 20 }}>
        <div className="row between">
          <h3 className="section-title">Escala del curso</h3>
          <div className="row" style={{ gap: 8 }}>
            <span className="hint" style={{ margin: 0 }}>Escala propia</span>
            <Switch checked={course.useOwnScale} onChange={(v) => patchCourse({ useOwnScale: v })} label="Usar escala propia" />
          </div>
        </div>

        {course.useOwnScale ? (
          <>
            <div className="row" style={{ gap: 12, marginTop: 14, alignItems: 'flex-end' }}>
              <ScaleField label="Mínima" value={course.scale?.min} onChange={(v) => patchCourse({ scale: { ...course.scale, min: v } })} />
              <ScaleField label="Máxima" value={course.scale?.max} onChange={(v) => patchCourse({ scale: { ...course.scale, max: v } })} />
              <ScaleField label="Aprobar con" value={course.scale?.passing} onChange={(v) => patchCourse({ scale: { ...course.scale, passing: v } })} />
              <ScaleField label="Paso" value={course.scale?.step} info={STEP_INFO} onChange={(v) => patchCourse({ scale: { ...course.scale, step: v } })} />
              <div className="spacer" />
            </div>
            <div className="toggle-row">
              <div style={{ flex: 1 }}>
                <p className="toggle-title">Redondear la nota final</p>
                <p className="p">Redondea 10.65 a 11. Solo para este curso, y manda sobre el ajuste global.</p>
              </div>
              <Switch checked={roundOn} onChange={(v) => patchCourse({ roundFinal: v })} label="Redondear nota final del curso" />
            </div>
          </>
        ) : (
          <p className="hint">
            Usa la escala global ({scale.min}–{scale.max}, aprueba con {scale.passing}).
            Actívala para darle a este curso su propia escala y su propio redondeo.
          </p>
        )}
      </Card>

      <Confirm
        open={confirmDelete}
        title="Eliminar curso"
        message={`¿Eliminar "${course.name}"? Se borran también sus evaluaciones y notas.`}
        confirmText="Eliminar"
        danger
        onConfirm={() => { onBack(); dispatch({ type: 'DELETE_COURSE', id: course.id }) }}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  )
}

function ScaleField({ label, value, onChange, info }) {
  return (
    <div className="field" style={{ width: 108 }}>
      <div className="field-label">
        {label}
        {info ? <InfoButton title={info.title} text={info.text} /> : null}
      </div>
      <NumField value={value} onChangeNumber={onChange} />
    </div>
  )
}
