// ============================================================
//  Store global + persistencia en archivo JSON (vía IPC a Electron)
// ============================================================
import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import { newId, emptyState } from './id.js'
import { buildNotifications } from './schedule.js'

const StoreCtx = createContext(null)
export const useStore = () => useContext(StoreCtx)

// Fuera de Electron (ej. `vite` a secas en el navegador) cae a localStorage,
// así la UI se puede desarrollar sin levantar el proceso principal.
const bridge = typeof window !== 'undefined' ? window.notaflow : null
const LS_KEY = 'notaflow:v1'

const api = {
  load: async () => {
    if (bridge) return bridge.store.load()
    try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null } catch { return null }
  },
  save: async (data) => {
    if (bridge) return bridge.store.save(data)
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)) } catch { /* ignora */ }
  },
  notify: async (items) => {
    if (bridge) return bridge.notify.schedule(items)
  },
}

const initialState = { ...emptyState(), loaded: false }

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return { ...action.payload, loaded: true }

    case 'ADD_COURSE':
      return {
        ...state,
        courses: [
          ...state.courses,
          {
            id: action.id || newId(),
            name: action.name || 'Nuevo curso',
            color: action.color || '#6d4a9c',
            useOwnScale: false,
            scale: { ...state.settings.defaultScale },
            startDate: null,
            endDate: null,
            roundFinal: null,
            evaluations: [],
          },
        ],
      }

    case 'UPDATE_COURSE':
      return { ...state, courses: state.courses.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)) }

    case 'DELETE_COURSE':
      return { ...state, courses: state.courses.filter((c) => c.id !== action.id) }

    case 'ADD_EVAL':
      return {
        ...state,
        courses: state.courses.map((c) =>
          c.id === action.courseId
            ? {
                ...c,
                evaluations: [
                  ...c.evaluations,
                  { id: newId(), name: `Evaluación ${c.evaluations.length + 1}`, type: 'Examen', week: null, date: null, weight: 0, grade: null },
                ],
              }
            : c,
        ),
      }

    case 'UPDATE_EVAL':
      return {
        ...state,
        courses: state.courses.map((c) =>
          c.id === action.courseId
            ? { ...c, evaluations: c.evaluations.map((e) => (e.id === action.evalId ? { ...e, ...action.patch } : e)) }
            : c,
        ),
      }

    case 'DELETE_EVAL':
      return {
        ...state,
        courses: state.courses.map((c) =>
          c.id === action.courseId
            ? { ...c, evaluations: c.evaluations.filter((e) => e.id !== action.evalId) }
            : c,
        ),
      }

    case 'REORDER_EVALS':
      return {
        ...state,
        courses: state.courses.map((c) =>
          c.id === action.courseId ? { ...c, evaluations: action.evaluations } : c,
        ),
      }

    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } }

    case 'REPLACE_ALL':
      return { ...action.payload, loaded: true }

    default:
      return state
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const saveTimer = useRef(null)

  useEffect(() => {
    (async () => {
      const saved = await api.load()
      if (saved && Array.isArray(saved.courses)) {
        // Fusiona settings por si el archivo viene de una versión anterior.
        const base = emptyState()
        dispatch({ type: 'LOAD', payload: { ...base, ...saved, settings: { ...base.settings, ...saved.settings } } })
      } else {
        dispatch({ type: 'LOAD', payload: emptyState() })
      }
    })()
  }, [])

  useEffect(() => {
    if (!state.loaded) return
    const { loaded, ...persist } = state
    // Guardado con rebote: escribir en disco en cada tecla sería excesivo.
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      api.save(persist)
      api.notify(buildNotifications(persist))
    }, 250)
    return () => clearTimeout(saveTimer.current)
  }, [state])

  return <StoreCtx.Provider value={{ state, dispatch }}>{children}</StoreCtx.Provider>
}

// ---- Export / Import (diálogos nativos del sistema) ----
export async function exportJSON(state) {
  const { loaded, ...data } = state
  if (bridge) return bridge.backup.export(data)
  // Fallback navegador: descarga directa
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'notaflow.json'
  a.click()
  URL.revokeObjectURL(url)
  return 'notaflow.json'
}

export async function importJSON() {
  if (bridge) return bridge.backup.import()
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async () => {
      const f = input.files?.[0]
      if (!f) return resolve(null)
      try {
        const data = JSON.parse(await f.text())
        if (!data.courses) throw new Error('El archivo no tiene datos de NotaFlow.')
        resolve(data)
      } catch (e) { reject(e) }
    }
    input.click()
  })
}

export const revealFile = (p) => bridge?.backup.reveal(p)
export const testNotification = () => bridge?.notify.test()
export const notificationsSupported = () => (bridge ? bridge.notify.supported() : Promise.resolve(false))
