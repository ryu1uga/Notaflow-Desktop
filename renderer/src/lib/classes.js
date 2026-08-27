// ---------------------------------------------------------------
//  Horario de clases de NotaFlow.
//
//  IMPORTANTE: este archivo está duplicado a propósito en la otra app:
//    Notaflow-App/src/lib/classes.js
//    Notaflow-Desktop/renderer/src/lib/classes.js
//  Las dos apps intercambian el mismo JSON de respaldo, así que si
//  cambias algo aquí, copia el archivo al otro repo.
//
//  Un bloque de clase vive en course.sessions y se ve así:
//    { id, day, start: 'HH:MM', end: 'HH:MM', mode, label, room }
//  · day sigue a Date.getDay(): 0 = domingo … 6 = sábado
//  · mode es 'presencial' o 'virtual'
//  · label es el tipo de sesión (Teoría, Laboratorio…), texto libre
//  · room es el aula; puede quedar vacío
//
//  Los cursos guardados antes de esta versión no tienen `sessions`.
//  Por eso todo lo de aquí lee siempre con `course.sessions ?? []`:
//  ningún respaldo viejo necesita migración.
// ---------------------------------------------------------------

// El índice coincide con Date.getDay().
export const DAYS = [
  { id: 0, short: 'Dom', long: 'Domingo' },
  { id: 1, short: 'Lun', long: 'Lunes' },
  { id: 2, short: 'Mar', long: 'Martes' },
  { id: 3, short: 'Mié', long: 'Miércoles' },
  { id: 4, short: 'Jue', long: 'Jueves' },
  { id: 5, short: 'Vie', long: 'Viernes' },
  { id: 6, short: 'Sáb', long: 'Sábado' },
]

// Orden de lectura: la semana arranca el lunes y cierra el domingo.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

export const dayName = (id, long = false) => {
  const d = DAYS.find((x) => x.id === id)
  return d ? (long ? d.long : d.short) : ''
}

export const MODES = ['presencial', 'virtual']
export const MODE_LABEL = { presencial: 'Presencial', virtual: 'Virtual' }
export const isVirtual = (s) => s?.mode === 'virtual'

// Etiquetas sugeridas del bloque. El campo es texto libre: estas solo
// se ofrecen para elegir de un toque.
export const BLOCK_LABELS = ['Teoría', 'Laboratorio', 'Práctica', 'Taller', 'Seminario']
export const MAX_LABEL = 20
export const MAX_ROOM = 24

export const DEFAULT_SESSION = {
  day: 1, start: '08:00', end: '09:50', mode: 'presencial', label: '', room: '',
}

// ------------------------------------------------------------
//  Horas
// ------------------------------------------------------------

// '08:30' -> 510 minutos desde medianoche. null si no se puede leer.
export function minutesOf(hhmm) {
  if (typeof hhmm !== 'string') return null
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

const two = (n) => String(n).padStart(2, '0')

// 510 -> '08:30'. Envuelve pasadas las 24 h por si acaso.
export function fmtTime(mins) {
  if (mins == null || Number.isNaN(mins)) return ''
  const m = ((Math.round(mins) % 1440) + 1440) % 1440
  return `${two(Math.floor(m / 60))}:${two(m % 60)}`
}

export const fmtRange = (start, end) => `${start} – ${end}`

// Duración en minutos. 0 si las horas no son válidas o el fin no es posterior.
export function durationOf(session) {
  const a = minutesOf(session?.start)
  const b = minutesOf(session?.end)
  if (a == null || b == null) return 0
  return Math.max(0, b - a)
}

// ------------------------------------------------------------
//  Sesiones de un curso
// ------------------------------------------------------------

// Solo las sesiones con día y horas válidas, ordenadas de lunes a
// domingo y, dentro del día, por hora de inicio.
export function sortedSessions(course) {
  const list = (course?.sessions ?? []).filter(
    (s) => s && DAYS.some((d) => d.id === s.day) && minutesOf(s.start) != null && minutesOf(s.end) != null,
  )
  return list.slice().sort((a, b) => {
    const da = WEEK_ORDER.indexOf(a.day)
    const db = WEEK_ORDER.indexOf(b.day)
    if (da !== db) return da - db
    return minutesOf(a.start) - minutesOf(b.start)
  })
}

// Cuántas horas de clase tiene el curso a la semana.
export function weeklyMinutes(course) {
  return sortedSessions(course).reduce((acc, s) => acc + durationOf(s), 0)
}

// ¿El curso sigue vigente en esa fecha? Un curso sin fechas siempre lo está.
export function isCourseActive(course, date = new Date()) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return true
  d.setHours(0, 0, 0, 0)
  if (course?.startDate) {
    const s = new Date(course.startDate)
    if (!Number.isNaN(s.getTime())) { s.setHours(0, 0, 0, 0); if (d < s) return false }
  }
  if (course?.endDate) {
    const e = new Date(course.endDate)
    if (!Number.isNaN(e.getTime())) { e.setHours(23, 59, 59, 999); if (d > e) return false }
  }
  return true
}

// ------------------------------------------------------------
//  La semana completa
// ------------------------------------------------------------

// Todas las sesiones de todos los cursos, con los datos del curso pegados.
export function allSessions(courses = [], { onlyActive = false, date = new Date() } = {}) {
  const out = []
  for (const c of courses) {
    if (onlyActive && !isCourseActive(c, date)) continue
    for (const s of sortedSessions(c)) {
      out.push({
        ...s,
        courseId: c.id,
        courseName: c.name,
        courseColor: c.color,
        startMin: minutesOf(s.start),
        endMin: minutesOf(s.end),
      })
    }
  }
  return out
}

// Las sesiones agrupadas por día: { 1: [...], 2: [...] }
export function sessionsByDay(courses = [], opts) {
  const byDay = {}
  for (const s of allSessions(courses, opts)) {
    (byDay[s.day] = byDay[s.day] || []).push(s)
  }
  for (const k of Object.keys(byDay)) byDay[k].sort((a, b) => a.startMin - b.startMin)
  return byDay
}

// Franja horaria que hay que dibujar, redondeada a horas en punto.
// Sin clases devuelve una franja razonable (07:00–22:00).
export function dayBounds(sessions = []) {
  const valid = sessions.filter((s) => s.startMin != null && s.endMin != null)
  if (!valid.length) return { from: 7 * 60, to: 22 * 60 }
  const min = Math.min(...valid.map((s) => s.startMin))
  const max = Math.max(...valid.map((s) => s.endMin))
  return {
    from: Math.floor(min / 60) * 60,
    to: Math.min(24 * 60, Math.ceil(max / 60) * 60),
  }
}

// Reparte en columnas las sesiones de UN día que se pisan entre sí, para
// poder dibujarlas lado a lado. Devuelve cada sesión con `lane` (su
// columna) y `lanes` (cuántas columnas tiene su grupo).
export function layoutDay(sessions = []) {
  const list = sessions
    .filter((s) => s.startMin != null && s.endMin != null)
    .slice()
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

  const out = []
  let cluster = []
  let clusterEnd = -1

  const flush = () => {
    if (!cluster.length) return
    const lanes = []                       // lanes[i] = fin de la última sesión de esa columna
    for (const s of cluster) {
      let lane = lanes.findIndex((end) => end <= s.startMin)
      if (lane === -1) { lane = lanes.length; lanes.push(0) }
      lanes[lane] = s.endMin
      s.lane = lane
    }
    for (const s of cluster) s.lanes = lanes.length
    out.push(...cluster)
    cluster = []
    clusterEnd = -1
  }

  for (const s of list) {
    const item = { ...s }
    if (cluster.length && item.startMin >= clusterEnd) flush()
    cluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.endMin)
  }
  flush()
  return out
}

// ¿Esta sesión se pisa con alguna otra del mismo día?
export const hasOverlap = (laidOut) => (laidOut?.lanes ?? 1) > 1

// ------------------------------------------------------------
//  Próxima clase
// ------------------------------------------------------------

// La clase que toca a partir de `now`, mirando los próximos 7 días.
// Si hay una en curso, esa gana y viene con `ongoing: true`.
// Devuelve null si no hay ninguna.
export function nextClass(courses = [], now = new Date()) {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const today = now.getDay()

  for (let offset = 0; offset < 8; offset++) {
    const day = (today + offset) % 7
    const date = new Date(now)
    date.setDate(date.getDate() + offset)
    date.setHours(0, 0, 0, 0)

    const list = allSessions(courses, { onlyActive: true, date })
      .filter((s) => s.day === day)
      .sort((a, b) => a.startMin - b.startMin)

    for (const s of list) {
      if (offset === 0 && s.endMin <= nowMin) continue
      const ongoing = offset === 0 && s.startMin <= nowMin && s.endMin > nowMin
      const when = new Date(date)
      when.setHours(Math.floor(s.startMin / 60), s.startMin % 60, 0, 0)
      return { ...s, date: when, ongoing, minutesAway: Math.round((when.getTime() - now.getTime()) / 60000) }
    }
  }
  return null
}
