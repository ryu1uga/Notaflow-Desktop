import React, { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { analyzeCourse, effectiveScale, effectiveRound, fmtGrade, STATUS_META } from '../lib/calc.js'
import { Card, Badge, Progress, Icon, Confirm } from '../components/ui.jsx'
import { colors } from '../theme.js'

export default function CoursesScreen({ onOpen, onCreate }) {
  const { state, dispatch } = useStore()
  const [toDelete, setToDelete] = useState(null)

  // Resumen del semestre: cómo va cada curso, en tres números honestos.
  const resumen = state.courses.reduce(
    (acc, c) => {
      const scale = effectiveScale(c, state.settings)
      const a = analyzeCourse(c.evaluations, scale, { round: effectiveRound(c, state.settings) })
      if (a.status === 'seguro' || a.status === 'aprobado') acc.bien += 1
      else if (a.status === 'imposible' || a.status === 'desaprobado') acc.riesgo += 1
      acc.pendientes += a.pending.length
      return acc
    },
    { bien: 0, riesgo: 0, pendientes: 0 },
  )

  return (
    <div className="page wide">
      <div className="page-head">
        <div>
          <h2>Mis cursos ({state.courses.length})</h2>
          <div className="sub">Tu promedio ponderado, curso por curso.</div>
        </div>
        <button className="btn primary" onClick={onCreate}>
          <Icon name="plus" size={15} color="#fff" /> Nuevo curso
        </button>
      </div>

      {state.courses.length > 0 && (
        <div className="stats-strip">
          <div className="stat">
            <span className="stat-num" style={{ color: resumen.bien > 0 ? colors.emerald : colors.textFaint }}>{resumen.bien}</span>
            <span className="stat-label">{resumen.bien === 1 ? 'curso va bien' : 'cursos van bien'}</span>
          </div>
          <div className="stat">
            <span className="stat-num" style={{ color: resumen.riesgo > 0 ? colors.red : colors.textFaint }}>{resumen.riesgo}</span>
            <span className="stat-label">en riesgo</span>
          </div>
          <div className="stat">
            <span className="stat-num" style={{ color: colors.brand }}>{resumen.pendientes}</span>
            <span className="stat-label">{resumen.pendientes === 1 ? 'evaluación pendiente' : 'evaluaciones pendientes'}</span>
          </div>
        </div>
      )}

      {state.courses.length === 0 ? (
        <Card>
          <p className="empty">Todavía no hay cursos. Crea el primero con “Nuevo curso”.</p>
        </Card>
      ) : (
        <div className="course-grid">
          {state.courses.map((c) => {
            const scale = effectiveScale(c, state.settings)
            const a = analyzeCourse(c.evaluations, scale, { round: effectiveRound(c, state.settings) })
            const meta = STATUS_META[a.status]
            const shown = a.projectedIfStopNow != null ? a.projectedIfStopNow : a.currentAvg
            return (
              <Card
                key={c.id}
                className="course-card"
                style={{ '--c': c.color }}
                onClick={() => onOpen(c.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') onOpen(c.id) }}
              >
                <div className="course-head">
                  <div className="row" style={{ gap: 8, minWidth: 0 }}>
                    <span className="dot" style={{ background: c.color }} />
                    <span className="course-name">{c.name}</span>
                  </div>
                  <div className="row" style={{ gap: 2 }}>
                    <Badge color={meta.color}>{meta.label}</Badge>
                    <button
                      className="icon-btn"
                      aria-label={`Eliminar ${c.name}`}
                      onClick={(e) => { e.stopPropagation(); setToDelete(c) }}
                    >
                      <Icon name="trash-2" size={15} color={colors.textFaint} />
                    </button>
                  </div>
                </div>

                <div className="grade-row">
                  <span className="grade-label">Nota actual{a.pendingWeight > 0 ? ' (proy.)' : ''}</span>
                  <span className="grade-val" style={{ color: c.color }}>
                    {fmtGrade(shown, scale)}<span className="grade-max"> / {scale.max}</span>
                  </span>
                </div>

                <Progress value={shown || 0} max={scale.max} color={c.color} threshold={scale.passing} />

                <div className="meta-row">
                  <span>{a.graded.length}/{c.evaluations.length} evaluadas</span>
                  <span>Aprobación: {scale.passing}</span>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Confirm
        open={toDelete != null}
        title="Eliminar curso"
        message={`¿Eliminar "${toDelete?.name}"? Se borran también sus evaluaciones y notas.`}
        confirmText="Eliminar"
        danger
        onConfirm={() => dispatch({ type: 'DELETE_COURSE', id: toDelete.id })}
        onClose={() => setToDelete(null)}
      />
    </div>
  )
}
