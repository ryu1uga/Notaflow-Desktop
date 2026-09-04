// Datos de ejemplo para desarrollo (?seed en la URL con `vite` a secas).
// Escribe directo en localStorage, que es donde cae el store fuera de Electron.
import { emptyState } from './id.js'

const iso = (y, m, d) => new Date(y, m - 1, d, 12).toISOString()
const now = new Date()
const Y = now.getFullYear()

const ev = (id, name, type, week, weight, grade = null, date = null) =>
  ({ id, name, type, week, weight, grade, date })

export function seedDemo() {
  const s = emptyState()
  s.settings.onboarded = true
  if (location.search.includes('dark')) s.settings.theme = 'dark'
  s.courses = [
    {
      id: 'demo-calc', name: 'Cálculo II', color: '#6d4a9c',
      useOwnScale: false, scale: { ...s.settings.defaultScale },
      startDate: iso(Y, 3, 17), endDate: iso(Y, 7, 11), roundFinal: null,
      evaluations: [
        ev('e1', 'Práctica 1', 'Práctica', 3, 15, 14),
        ev('e2', 'Práctica 2', 'Práctica', 6, 15, 12),
        ev('e3', 'Parcial', 'Examen', 8, 30, 13),
        ev('e4', 'Práctica 3', 'Práctica', 12, 15),
        ev('e5', 'Final', 'Examen', 16, 25),
      ],
      sessions: [
        { id: 's1', day: 1, start: '08:00', end: '10:00', mode: 'presencial', room: 'A-301', label: 'Teoría' },
        { id: 's2', day: 3, start: '08:00', end: '10:00', mode: 'presencial', room: 'A-301', label: 'Práctica' },
      ],
    },
    {
      id: 'demo-fisica', name: 'Física General', color: '#3b7ea1',
      useOwnScale: false, scale: { ...s.settings.defaultScale },
      startDate: iso(Y, 3, 17), endDate: null, roundFinal: null,
      evaluations: [
        ev('f1', 'Laboratorio 1', 'Laboratorio', 4, 20, 16),
        ev('f2', 'Parcial', 'Examen', 8, 30, 9),
        ev('f3', 'Laboratorio 2', 'Laboratorio', 12, 20),
        ev('f4', 'Final', 'Examen', 16, 30),
      ],
      sessions: [
        { id: 's3', day: 2, start: '10:00', end: '12:00', mode: 'presencial', room: 'Lab F-2', label: 'Lab' },
        { id: 's4', day: 4, start: '10:00', end: '12:00', mode: 'virtual', room: '', label: 'Teoría' },
      ],
    },
    {
      id: 'demo-algo', name: 'Algoritmos y Estructuras', color: '#4f9d69',
      useOwnScale: false, scale: { ...s.settings.defaultScale },
      startDate: iso(Y, 3, 17), endDate: null, roundFinal: null,
      evaluations: [
        ev('a1', 'Tarea 1', 'Tarea', 2, 10, 18),
        ev('a2', 'Tarea 2', 'Tarea', 5, 10, 17),
        ev('a3', 'Proyecto', 'Proyecto', 10, 35, 16),
        ev('a4', 'Final', 'Examen', 16, 45),
      ],
      sessions: [
        { id: 's5', day: 5, start: '14:00', end: '17:00', mode: 'presencial', room: 'C-105', label: '' },
      ],
    },
    {
      id: 'demo-ingles', name: 'Inglés Técnico', color: '#c1517a',
      useOwnScale: false, scale: { ...s.settings.defaultScale },
      startDate: iso(Y, 3, 17), endDate: null, roundFinal: null,
      evaluations: [
        ev('i1', 'Oral 1', 'Exposición', 5, 25, 6),
        ev('i2', 'Escrito', 'Examen', 9, 35, 8),
        ev('i3', 'Oral 2', 'Exposición', 14, 40),
      ],
      sessions: [
        { id: 's6', day: 6, start: '09:00', end: '11:00', mode: 'virtual', room: '', label: '' },
      ],
    },
  ]
  s.blocks = [
    { id: 'b1', name: 'Gimnasio', type: 'Deporte', day: 1, start: '18:00', end: '19:30', mode: 'presencial', room: '', color: '#8a6d3b' },
  ]
  localStorage.setItem('notaflow:v1', JSON.stringify(s))
}
