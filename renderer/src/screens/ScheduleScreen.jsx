import React, { useState } from 'react'
import { useStore } from '../lib/store.jsx'
import { evalEffectiveDate } from '../lib/schedule.js'
import { Card, Badge } from '../components/ui.jsx'
import Calendar from '../components/Calendar.jsx'

export default function ScheduleScreen({ onOpen }) {
  const { state } = useStore()
  const [view, setView] = useState('semana') // 'semana' | 'calendario'
  const weeks = state.settings.semesterWeeks || 16

  // Ítems con fecha efectiva, para el calendario
  const calItems = []
  state.courses.forEach((c) => {
    c.evaluations.forEach((e) => {
      const d = evalEffectiveDate(c, e)
      if (d) calItems.push({ date: d, courseName: c.name, courseColor: c.color, courseId: c.id, type: e.type, name: e.name, grade: e.grade })
    })
  })

  // Agrupado por semana
  const byWeek = {}
  const sinAsignar = []
  state.courses.forEach((c) => {
    c.evaluations.forEach((e) => {
      const item = { ...e, courseName: c.name, courseColor: c.color, courseId: c.id }
      if (e.week == null) sinAsignar.push(item)
      else (byWeek[e.week] = byWeek[e.week] || []).push(item)
    })
  })
  const weekList = Array.from({ length: weeks }, (_, i) => i + 1).filter((w) => byWeek[w]?.length)
  // Semanas fuera del rango configurado, para no esconder nada
  const extra = Object.keys(byWeek).map(Number).filter((w) => w > weeks || w < 1).sort((x, y) => x - y)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Cronograma</h2>
          <div className="sub">Todas tus evaluaciones, de todos los cursos.</div>
        </div>
        <div className="seg">
          <button className={view === 'semana' ? 'on' : ''} onClick={() => setView('semana')}>Por semana</button>
          <button className={view === 'calendario' ? 'on' : ''} onClick={() => setView('calendario')}>Calendario</button>
        </div>
      </div>

      {view === 'calendario' && (
        <Card>
          {calItems.length === 0
            ? <p className="empty">Aún no hay evaluaciones con fecha. Asigna semana (con fecha de inicio del curso) o fija el día exacto.</p>
            : <Calendar items={calItems} onOpen={onOpen} />}
        </Card>
      )}

      {view === 'semana' && (
        <>
          {weekList.length === 0 && extra.length === 0 && sinAsignar.length === 0 && (
            <Card><p className="empty">Nada con semana asignada todavía. Ponle semana a tus evaluaciones y aparecen aquí.</p></Card>
          )}

          {[...weekList, ...extra].map((w) => (
            <Card key={w}>
              <div className="week-head">
                <span className="week-num">{w}</span>
                <strong>Semana {w}</strong>
              </div>
              {byWeek[w].map((e) => (
                <button key={e.id} className="sched-item" onClick={() => onOpen(e.courseId)}>
                  <span className="dot" style={{ background: e.courseColor }} />
                  <span className="sched-course">{e.courseName}</span>
                  <span className="sched-eval"> · {e.type}: {e.name}</span>
                  <span className="spacer" />
                  {e.grade == null ? <Badge color="amber">pend.</Badge> : <Badge color="slate">{String(e.grade)}</Badge>}
                </button>
              ))}
            </Card>
          ))}

          {sinAsignar.length > 0 && (
            <Card>
              <h3 className="section-title" style={{ marginBottom: 4 }}>Sin semana asignada ({sinAsignar.length})</h3>
              {sinAsignar.map((e) => (
                <button key={e.id} className="sched-item" onClick={() => onOpen(e.courseId)}>
                  <span className="dot" style={{ background: e.courseColor }} />
                  <span className="sched-course">{e.courseName}</span>
                  <span className="sched-eval"> · {e.type}: {e.name}</span>
                  <span className="spacer" />
                  {e.grade == null ? <Badge color="amber">pend.</Badge> : <Badge color="slate">{String(e.grade)}</Badge>}
                </button>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
