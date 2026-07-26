import React, { useCallback, useEffect, useState } from 'react'
import { StoreProvider, useStore } from './lib/store.jsx'
import { newId } from './lib/id.js'
import CoursesScreen from './screens/CoursesScreen.jsx'
import CourseDetailScreen from './screens/CourseDetailScreen.jsx'
import ScheduleScreen from './screens/ScheduleScreen.jsx'
import SettingsScreen from './screens/SettingsScreen.jsx'
import Onboarding from './components/Onboarding.jsx'
import { Icon, Toast } from './components/ui.jsx'
import { colors } from './theme.js'

const TABS = [
  { id: 'cursos', label: 'Cursos', icon: 'book-open' },
  { id: 'cronograma', label: 'Cronograma', icon: 'calendar' },
  { id: 'config', label: 'Ajustes', icon: 'sliders' },
]

// ¿El curso quedó "en blanco" (recién creado y sin tocar)?
const isPristineCourse = (c) =>
  c && (!c.name || c.name === 'Nuevo curso') && (c.evaluations?.length || 0) === 0 &&
  !c.startDate && !c.endDate && !c.useOwnScale

function Shell() {
  const { state, dispatch } = useStore()
  const [tab, setTab] = useState('cursos')
  const [openCourse, setOpenCourse] = useState(null)
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
          <h1>NotaFlow</h1>
          <p>Tus notas, bajo control</p>
        </div>

        <nav className="nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => { closeCourse(); setTab(t.id) }}
            >
              <Icon name={t.icon} size={18} color={tab === t.id ? colors.brand : colors.textFaint} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          Todo se guarda en esta computadora.<br />
          Nada se sube a internet.
        </div>
      </aside>

      <main className="main">
        {tab === 'cursos' && !course && <CoursesScreen onOpen={setOpenCourse} onCreate={createCourse} />}
        {tab === 'cursos' && course && <CourseDetailScreen course={course} onBack={closeCourse} />}
        {tab === 'cronograma' && <ScheduleScreen onOpen={(id) => { setTab('cursos'); setOpenCourse(id) }} />}
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
