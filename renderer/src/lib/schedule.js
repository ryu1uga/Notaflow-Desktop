// ============================================================
//  Fechas de evaluaciones y armado de los avisos de escritorio.
//  Misma regla que en móvil:
//   · fecha de una evaluación = día exacto si se fijó, si no
//     startDate del curso + (semana-1)*7 días
//   · el aviso cae como máximo el DOMINGO de la semana anterior;
//     los "días antes" solo pueden adelantarlo.
// ============================================================

const DAY_MS = 24 * 60 * 60 * 1000
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// Fecha (Date) de una evaluación a partir del inicio del curso y su semana.
export function evalDate(startDate, week) {
  if (!startDate || week == null) return null
  const base = new Date(startDate)
  if (Number.isNaN(base.getTime())) return null
  const d = new Date(base.getTime() + (Number(week) - 1) * 7 * DAY_MS)
  d.setHours(0, 0, 0, 0)
  return d
}

// Fecha efectiva: el DÍA EXACTO si se fijó (ev.date), si no la derivada.
export function evalEffectiveDate(course, ev) {
  if (ev?.date) {
    const d = new Date(ev.date)
    if (!Number.isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); return d }
  }
  return evalDate(course?.startDate, ev?.week)
}

// Número de semana (1..N) de una fecha respecto al inicio del curso.
export function weekFromDate(startDate, dateISO) {
  if (!startDate || !dateISO) return null
  const s = new Date(startDate); if (Number.isNaN(s.getTime())) return null
  const d = new Date(dateISO); if (Number.isNaN(d.getTime())) return null
  s.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0)
  const diffDays = Math.round((d.getTime() - s.getTime()) / DAY_MS) // round: absorbe DST
  return Math.floor(diffDays / 7) + 1
}

// Domingo que cierra la semana ANTERIOR a la semana de la evaluación.
export function prevWeekSunday(evDay) {
  const d = new Date(evDay)
  d.setHours(0, 0, 0, 0)
  const offset = ((d.getDay() + 6) % 7) + 1
  d.setDate(d.getDate() - offset)
  return d
}

// Fecha+hora exacta en que debe sonar el aviso de una evaluación (o null).
export function notifyFireAt(evDay, daysBefore, hour, minute) {
  if (!evDay) return null
  const byDaysBefore = new Date(evDay)
  byDaysBefore.setDate(byDaysBefore.getDate() - Math.max(0, daysBefore))
  const cap = prevWeekSunday(evDay)
  const day = byDaysBefore.getTime() < cap.getTime() ? byDaysBefore : cap
  const fire = new Date(day)
  fire.setHours(hour, minute, 0, 0)
  return fire
}

export const humanDate = (d) => `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`

// Construye la lista de avisos que el proceso principal debe vigilar.
// Cada clave incluye el instante para que un cambio de fecha reprograme el aviso.
export function buildNotifications(state) {
  if (!state?.settings?.notificationsOn) return []
  const s = state.settings
  const daysBefore = Number(s.notifyDaysBefore ?? 2)
  const hour = Number(s.notifyHour ?? 9)
  const minute = Number(s.notifyMinute ?? 0)
  const out = []

  for (const c of state.courses || []) {
    for (const e of c.evaluations || []) {
      if (e.grade != null && e.grade !== '') continue // ya tiene nota
      const evDay = evalEffectiveDate(c, e)
      if (!evDay) continue
      const fireAt = notifyFireAt(evDay, daysBefore, hour, minute)
      if (!fireAt) continue
      out.push({
        key: `${c.id}:${e.id}:${fireAt.getTime()}`,
        title: c.name || 'Curso',
        body: `${e.type} · ${e.name} — es el ${humanDate(evDay)}`,
        fireAt: fireAt.getTime(),
      })
    }
  }
  return out
}
