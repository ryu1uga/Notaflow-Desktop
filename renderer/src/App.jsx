import React, { useCallback, useEffect, useState } from 'react'
import { StoreProvider, useStore } from './lib/store.jsx'
import { newId } from './lib/id.js'
import CoursesScreen from './screens/CoursesScreen.jsx'
import CourseDetailScreen from './screens/CourseDetailScreen.jsx'
import ScheduleScreen from './screens/ScheduleScreen.jsx'
import TimetableScreen from './screens/TimetableScreen.jsx'
import SettingsScreen from './screens/SettingsScreen.jsx'
import Onboarding from './components/Onboarding.jsx'
import { Icon, Toast } from './components/ui.jsx'

const TABS = [
  { id: 'cursos', label: 'Cursos', icon: 'book-open' },
  { id: 'cronograma', label: 'Cronograma', icon: 'calendar' },
  { id: 'horario', label: 'Horario', icon: 'clock' },
  { id: 'config', label: 'Ajustes', icon: 'sliders' },
]

// ¿El curso quedó "en blanco" (recién creado y sin tocar)?
const isPristineCourse = (c) =>
  c && (!c.name || c.name === 'Nuevo curso') && (c.evaluations?.length || 0) === 0 &&
  !c.startDate && !c.endDate && !c.useOwnScale

function Shell() {
  const { state, dispatch } = useStore()
  // ?tab= y ?course= permiten abrir una vista directa (útil en desarrollo).
  const params = new URLSearchParams(window.location.search)
  const [tab, setTab] = useState(params.get('tab') || 'cursos')
  const theme = state.settings.theme === 'dark' ? 'dark' : 'light'
  const [openCourse, setOpenCourse] = useState(params.get('course'))
  const [newCourseId, setNewCourseId] = useState(null)
  const [toast, setToast] = useState(null)

  const createCourse = () => {
    const id = newId()
    dispatch({ type: 'ADD_COURSE', id })
    setNewCourseId(id)
    setOpenCourse(id)
  }

  // Cierra el detalle; si el curso era nuevo y quedó vacío, lo descarta.
  const closeCourse = useCallback(() => {
    if (openCourse && openCourse === newCourseId) {
      const c = state.courses.find((x) => x.id === openCourse)
      if (isPristineCourse(c)) dispatch({ type: 'DELETE_COURSE', id: openCourse })
    }
    setNewCourseId(null)
    setOpenCourse(null)
  }, [openCourse, newCourseId, state.courses, dispatch])

  // Aplica el tema (claro/oscuro) a todo el documento.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const toggleTheme = () =>
    dispatch({ type: 'UPDATE_SETTINGS', patch: { theme: theme === 'dark' ? 'light' : 'dark' } })

  // Escape cierra el detalle del curso, igual que el botón atrás del móvil.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && openCourse && !document.querySelector('.backdrop')) closeCourse()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openCourse, closeCourse])

  if (!state.loaded) {
    return <div className="loading"><div className="spinner" /></div>
  }

  if (!state.settings.onboarded) {
    return <Onboarding onDone={() => dispatch({ type: 'UPDATE_SETTINGS', patch: { onboarded: true } })} />
  }

  const course = state.courses.find((c) => c.id === openCourse)

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">N</div>
          <div>
            <h1>NotaFlow</h1>
            <p>Tus notas, bajo control</p>
          </div>
        </div>

        <nav className="nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => { closeCourse(); setTab(t.id) }}
            >
              <Icon name={t.icon} size={18} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <button className="theme-btn" onClick={toggleTheme} style={{ marginTop: 'auto' }}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
          <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>

        <div className="sidebar-foot" style={{ marginTop: 0 }}>
          Todo se guarda en esta computadora.<br />
          Nada se sube a internet.
        </div>
      </aside>

      <main className="main">
        {tab === 'cursos' && !course && <CoursesScreen onOpen={setOpenCourse} onCreate={createCourse} />}
        {tab === 'cursos' && course && <CourseDetailScreen course={course} onBack={closeCourse} />}
        {tab === 'cronograma' && <ScheduleScreen onOpen={(id) => { setTab('cursos'); setOpenCourse(id) }} />}
        {tab === 'horario' && <TimetableScreen onOpen={(id) => { setTab('cursos'); setOpenCourse(id) }} />}
        {tab === 'config' && <SettingsScreen notify={setToast} />}
      </main>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
