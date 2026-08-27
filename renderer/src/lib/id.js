// Generador de IDs únicos y estado inicial vacío (sin datos de ejemplo)
//  IMPORTANTE: este archivo es idéntico en las dos apps
//    Notaflow-App/src/lib/id.js
//    Notaflow-Desktop/renderer/src/lib/id.js
//  Si cambias algo aquí, copia el archivo al otro repo.

let _n = 0
export const newId = () => `${Date.now().toString(36)}-${(_n++).toString(36)}`

export function emptyState() {
  return {
    courses: [],
    settings: {
      defaultScale: { min: 0, max: 20, passing: 11, step: 1 },
      semesterWeeks: 16,
      roundFinal: true,
      notifyDaysBefore: 2,     // avisar X días antes de una evaluación
      notifyHour: 9,           // hora del aviso (0-23)
      notifyMinute: 0,         // minuto del aviso
      notificationsOn: false,  // se activa cuando el usuario da permiso
      onboarded: false,
    },
  }
}
