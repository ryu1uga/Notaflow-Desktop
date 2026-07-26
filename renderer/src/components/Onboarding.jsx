import React, { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { colors } from '../theme.js'

const SLIDES = [
  {
    icon: 'book-open',
    title: 'Tus cursos, sin la hoja de Excel',
    body: 'Cursos, evaluaciones y notas en un solo lugar. Nada de esto sale de tu computadora.',
  },
  {
    icon: 'plus-circle',
    title: 'Arma cada curso',
    body: 'Agrega tus evaluaciones —examen, práctica, proyecto— con su peso y la semana en que caen.',
  },
  {
    icon: 'edit-3',
    title: 'Anota conforme salen',
    body: 'Metes cada nota cuando te la devuelven y el promedio ponderado se calcula solo.',
  },
  {
    icon: 'target',
    title: '¿Me alcanza para aprobar?',
    body: 'Te digo cuánto necesitas en lo que falta y qué sacar en la próxima para no quedarte.',
  },
  {
    icon: 'sliders',
    title: 'Tu escala, tus reglas',
    body: '0–20, 0–7, lo que use tu facultad. Defines la nota de aprobación y si se redondea.',
  },
  {
    icon: 'calendar',
    title: 'Todo a la vista',
    body: 'El cronograma junta tus evaluaciones por semana y en calendario. Y respaldas tus datos cuando quieras.',
  },
]

export default function Onboarding({ onDone }) {
  const [i, setI] = useState(0)
  const last = i === SLIDES.length - 1
  const s = SLIDES[i]

  // Navegación con teclado: flechas y Enter.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') last ? onDone() : setI((n) => n + 1)
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1))
      if (e.key === 'Escape') onDone()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [last, onDone])

  return (
    <div className="onb">
      {!last && <button className="onb-skip" onClick={onDone}>Saltar</button>}

      <div className="onb-icon"><Icon name={s.icon} size={48} color={colors.brand} /></div>
      <h2>{s.title}</h2>
      <p>{s.body}</p>

      <div className="onb-dots">
        {SLIDES.map((_, n) => <i key={n} className={n === i ? 'on' : ''} />)}
      </div>

      <div className="onb-actions">
        {i > 0 && <button className="btn ghost" onClick={() => setI(i - 1)}>Atrás</button>}
        <button className="btn primary" onClick={() => (last ? onDone() : setI(i + 1))}>
          {last ? 'Empezar' : 'Siguiente'}
        </button>
      </div>
    </div>
  )
}
