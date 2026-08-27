import React, { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { analyzeCourse, effectiveScale, effectiveRound, fmtGrade, STATUS_META } from '../lib/calc.js'
import { Card, Badge, Progress, Icon, Confirm } from '../components/ui.jsx'
import { colors } from '../theme.js'

export default function CoursesScreen({ onOpen, onCreate }) {
  const { state, dispatch } = useStore()
  const [toDelete, setToDelete] = useState(null)

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
