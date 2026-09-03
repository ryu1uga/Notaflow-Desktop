// ---------------------------------------------------------------
//  Horario de clases de NotaFlow.
//
//  IMPORTANTE: este archivo está duplicado a propósito en la otra app:
//    Notaflow-App/src/lib/classes.js
//    Notaflow-Desktop/renderer/src/lib/classes.js
//  Las dos apps intercambian el mismo JSON de respaldo, así que si
//  cambias algo aquí, copia el archivo al otro repo.
//
//  Además de las clases, el horario puede tener bloques libres (trabajo,
//  prácticas…) que viven en state.blocks; están documentados más abajo.
//
//  Un bloque de clase vive en course.sessions y se ve así:
//    { id, day, start: 'HH:MM', end: 'HH:MM', mode, label, room }
//  · day sigue a Date.getDay(): 0 = domingo … 6 = sábado
//  · mode es 'presencial' o 'virtual'
//  · label es el tipo de sesión (Teoría, Laboratorio…), texto libre
//  · room es el aula; puede quedar vacío
//
//  Nombre y tipo son cosas distintas y viven en campos distintos. En una
//  clase el nombre lo pone el curso y el tipo va en label. En una actividad
//  el nombre lo pones tú y el tipo también va en label,
//  con la misma llave, para que la rejilla no tenga que distinguirlos.
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

// Tipo de una sesión de curso. Solo lo académico: una clase no es un
// traslado ni una cita médica. El campo es texto libre; estos se ofrecen
// para elegir de un toque.
//
// OJO con el nombre: antes esto se llamaba BLOCK_LABELS y en la interfaz salía
// como “Bloque”, igual que las actividades de state.blocks. Eran dos cosas
// distintas con el mismo nombre en la misma pantalla. Aquí “tipo” es qué clase
// de sesión es (Teoría, Laboratorio) y “actividad” es lo del horario que no
// pertenece a ningún curso.
export const SESSION_TYPES = ['Teoría', 'Laboratorio', 'Práctica', 'Taller', 'Seminario']
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

// ¿Sigue vigente en esa fecha? Sin fechas, siempre lo está. Vale igual para
// un curso y para un bloque libre: los dos usan startDate/endDate.
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

// Lunes 00:00 y domingo 23:59 de la semana que contiene `date`. La semana
// arranca el lunes, igual que WEEK_ORDER.
export function weekRangeOf(date = new Date()) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return null
  d.setHours(0, 0, 0, 0)
  const shift = (d.getDay() + 6) % 7 // 0 = lunes … 6 = domingo
  const from = new Date(d)
  from.setDate(d.getDate() - shift)
  const to = new Date(from)
  to.setDate(from.getDate() + 6)
  to.setHours(23, 59, 59, 999)
  return { from, to }
}

// ¿El curso o el bloque toca el rango en algún punto? Sin fechas, siempre sí.
// Basta con que se solapen: algo que empieza el miércoles ya cuenta el lunes.
export function isActiveInRange(item, from, to) {
  if (!from || !to) return true
  if (item?.startDate) {
    const s = new Date(item.startDate)
    if (!Number.isNaN(s.getTime())) { s.setHours(0, 0, 0, 0); if (s > to) return false }
  }
  if (item?.endDate) {
    const e = new Date(item.endDate)
    if (!Number.isNaN(e.getTime())) { e.setHours(23, 59, 59, 999); if (e < from) return false }
  }
  return true
}

// ¿Vigente en algún día de la semana que contiene `date`?
export function isActiveInWeek(item, date = new Date()) {
  const r = weekRangeOf(date)
  return r ? isActiveInRange(item, r.from, r.to) : true
}


// ------------------------------------------------------------
//  Bloques libres: lo del horario que no es un curso
// ------------------------------------------------------------
//  Viven en state.blocks (no dentro de un curso) y se ven así:
//    { id, name, label, color, day, start, end, mode, room, startDate, endDate }
//  · día, horas y modalidad funcionan igual que en una sesión de curso
//  · name y color son propios, porque no cuelgan de ningún curso
//  · label es el tipo (Trabajo, Deporte…), la misma llave que en una clase
//  · startDate/endDate son opcionales: sin ellas el bloque es permanente,
//    con ellas se comporta como un curso con fechas (una práctica de tres
//    meses desaparece sola al terminar)
//  Los respaldos viejos no traen la lista; por eso todo lee `blocks ?? []`.
//  Tampoco traen `label`: esos bloques salen sin tipo, que es correcto.

export const DEFAULT_BLOCK = {
  name: '', label: '', color: '#3b7ea1', day: 1, start: '08:00', end: '10:00',
  mode: 'presencial', room: '', startDate: null, endDate: null,
}
export const MAX_BLOCK_NAME = 28

// Tipo de una actividad. A diferencia del tipo de una clase, aquí sí entra lo
// que no es ni académico ni laboral: el cuerpo (Deporte, Salud), la rutina que
// de verdad ocupa el día (Traslado) y lo personal (Ocio). Es texto libre, así
// que la lista solo ahorra teclear; para cualquier otra cosa se escribe.
//
// Antes esto se llamaba BLOCK_SUGGESTIONS y llenaba el NOMBRE del bloque, que
// era el error: 'Trabajo' no es el nombre de nada, es de qué tipo es. El
// nombre ahora lo pones tú y esto es el tipo.
export const ACTIVITY_TYPES = [
  'Trabajo', 'Prácticas', 'Estudio', 'Asesoría',
  'Deporte', 'Salud', 'Traslado', 'Ocio',
]

// Los bloques con día y horas válidas, ordenados como las sesiones.
export function sortedBlocks(blocks = []) {
  const list = (blocks ?? []).filter(
    (b) => b && DAYS.some((d) => d.id === b.day) && minutesOf(b.start) != null && minutesOf(b.end) != null,
  )
  return list.slice().sort((a, b) => {
    const da = WEEK_ORDER.indexOf(a.day)
    const db = WEEK_ORDER.indexOf(b.day)
    if (da !== db) return da - db
    return minutesOf(a.start) - minutesOf(b.start)
  })
}

// ------------------------------------------------------------
//  La semana completa
// ------------------------------------------------------------

// Todas las sesiones de todos los cursos, con los datos del curso pegados.
// `scope` decide contra qué se mide la vigencia:
//   'day'  → solo lo vigente en esa fecha exacta (lo que necesita nextClass).
//   'week' → lo vigente en cualquier día de esa semana, para que la rejilla
//            semanal muestre lo que empieza más adelante dentro de la misma
//            semana en vez de aparecer recién el día que arranca.
export function allSessions(courses = [], { onlyActive = false, date = new Date(), blocks = [], scope = 'day' } = {}) {
  const vigente = scope === 'week'
    ? (item) => isActiveInWeek(item, date)
    : (item) => isCourseActive(item, date)
  const out = []
  for (const c of courses) {
    if (onlyActive && !vigente(c)) continue
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
  // Los bloques libres se mezclan aquí con las mismas llaves que una clase, así
  // la rejilla, la lista y la próxima cita no tienen que saber de dónde sale
  // cada uno. Lo que los distingue es courseId: null y blockId con su id.
  for (const b of sortedBlocks(blocks)) {
    if (onlyActive && !vigente(b)) continue
    out.push({
      ...b,
      blockId: b.id,
      courseId: null,
      courseName: b.name || b.label || 'Sin nombre',
      courseColor: b.color || DEFAULT_BLOCK.color,
      startMin: minutesOf(b.start),
      endMin: minutesOf(b.end),
    })
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
export function nextClass(courses = [], now = new Date(), blocks = []) {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const today = now.getDay()

  for (let offset = 0; offset < 8; offset++) {
    const day = (today + offset) % 7
    const date = new Date(now)
    date.setDate(date.getDate() + offset)
    date.setHours(0, 0, 0, 0)

    const list = allSessions(courses, { onlyActive: true, date, blocks })
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

// ------------------------------------------------------------
//  Alta de horario
// ------------------------------------------------------------
//  Lo que necesita la hoja de "Agregar al horario", que es la misma para una
//  clase de curso y para una actividad. Vive aquí y no en la pantalla porque
//  las dos apps la usan igual.
//
//  El borrador que maneja la hoja lleva dos llaves de trabajo que NUNCA se
//  guardan: `kind` ('clase' | 'actividad') y `days` (los días marcados, para
//  crear varias entradas de una sola vez). expandDays las quita.

// Cuánto dura por defecto lo que se agrega, en minutos.
export const DEFAULT_DURATION = 110

// "3 h 20 min" a partir de minutos sueltos.
export function fmtDuration(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return [h ? `${h} h` : null, m ? `${m} min` : null].filter(Boolean).join(' ') || '0 min'
}

// Color para la próxima actividad: el primero de la paleta que nadie use
// todavía. Sin esto, toda actividad nueva nacía del mismo azul.
export function nextBlockColor(blocks = [], palette = []) {
  if (!palette.length) return DEFAULT_BLOCK.color
  const usados = new Set((blocks ?? []).map((b) => b.color))
  return palette.find((c) => !usados.has(c)) || palette[(blocks?.length ?? 0) % palette.length]
}

// Lo que ya ocupa un día, clases y actividades juntas, ordenado por hora.
// No filtra por vigencia a propósito: para avisar de un cruce da igual que el
// curso ya haya acabado. `skipId` deja fuera lo que se está editando.
export function busyOn(day, { courses = [], blocks = [], skipId = null } = {}) {
  return allSessions(courses, { onlyActive: false, blocks })
    .filter((s) => s.day === day && s.id !== skipId)
    .sort((a, b) => a.startMin - b.startMin)
}

// Con qué se cruza este borrador. Dos franjas se pisan cuando cada una
// empieza antes de que la otra termine. Devuelve la lista de lo pisado, para
// poder decirlo con nombre, día y hora.
export function findConflicts(draft, { courses = [], blocks = [], skipId = null } = {}) {
  const a = minutesOf(draft?.start)
  const b = minutesOf(draft?.end)
  if (a == null || b == null || b <= a) return []
  const dias = draft.days?.length ? draft.days : (draft.day != null ? [draft.day] : [])
  const out = []
  for (const d of dias) {
    for (const s of busyOn(d, { courses, blocks, skipId })) {
      if (s.startMin < b && a < s.endMin) out.push(s)
    }
  }
  return out
}

// Un hueco razonable para lo próximo de ese día: pegado a lo último que hay
// (redondeado a los 5 min), o las 08:00 si el día está libre. Si eso se
// saliera de la noche, vuelve a las 08:00 y que hable el aviso de cruce.
export function suggestSlot(day, { courses = [], blocks = [], minutes = DEFAULT_DURATION } = {}) {
  const ocupado = busyOn(day, { courses, blocks })
  const fin = ocupado.length ? Math.max(...ocupado.map((s) => s.endMin)) : null
  let inicio = fin == null ? 8 * 60 : Math.ceil((fin + 10) / 5) * 5
  if (inicio + minutes > 22 * 60) inicio = 8 * 60
  return { start: fmtTime(inicio), end: fmtTime(inicio + minutes) }
}

// Un borrador con varios días marcados se vuelve una entrada por día, ya sin
// las llaves de trabajo de la hoja.
export function expandDays(draft = {}, days = []) {
  const limpio = { ...draft }
  delete limpio.days
  delete limpio.kind
  const dias = days.length ? days : (draft.day != null ? [draft.day] : [])
  return dias.map((day) => ({ ...limpio, day }))
}

// ¿Se puede guardar? Devuelve el motivo por el que no, o null si está bien.
export function draftError(draft = {}) {
  if (!(draft.days?.length) && draft.day == null) return 'Elige al menos un día.'
  const a = minutesOf(draft.start)
  const b = minutesOf(draft.end)
  if (a == null || b == null) return 'Faltan las horas de inicio y fin.'
  if (b <= a) return 'La hora de fin tiene que ser posterior a la de inicio.'
  if (draft.kind === 'clase' && !draft.courseId) return 'Elige el curso al que pertenece la clase.'
  return null
}
