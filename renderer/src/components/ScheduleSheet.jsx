// Hoja única para agregar o editar cualquier cosa del horario.
//
// Antes había dos caminos distintos para dos cosas que en la rejilla se ven
// igual: una clase se agregaba dentro del curso y una actividad en la pantalla
// Horario, cada una con su tabla y sus controles. Aquí las dos comparten el
// mismo formulario; lo único que cambia son los campos propios de cada una.
//
// La hoja trabaja sobre un borrador local y guarda con el botón. Las tablas
// de antes guardaban tecla por tecla, pero dentro de un diálogo eso confunde:
// si cierras esperas no haber cambiado nada.
import React, { useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store.jsx'
import {
  WEEK_ORDER, dayName, MODES, MODE_LABEL, SESSION_TYPES, ACTIVITY_TYPES,
  MAX_LABEL, MAX_ROOM, MAX_BLOCK_NAME, DEFAULT_BLOCK, DEFAULT_SESSION, minutesOf, fmtTime,
  fmtDuration, suggestSlot, findConflicts, expandDays, draftError, nextBlockColor,
} from '../lib/classes.js'
import { Modal, TimeField, DateField, Icon } from './ui.jsx'
import { colors, palette } from '../theme.js'

export default function ScheduleSheet({
  onClose,
  edit = null,             // { kind:'clase', courseId, session } | { kind:'actividad', block }
  lockCourseId = null,     // abierta desde un curso: no se puede cambiar de curso
  defaultKind = null,      // 'clase' | 'actividad' con que abrir una nueva
  onOpenCourse = null,
}) {
  const { state, dispatch } = useStore()
  const courses = state.courses ?? []
  const blocks = state.blocks ?? []

  const armar = () => {
    if (edit?.kind === 'clase') {
      const s = edit.session
      return {
        kind: 'clase', courseId: edit.courseId, days: [s.day],
        start: s.start || '', end: s.end || '', mode: s.mode || 'presencial',
        label: s.label || '', room: s.room || '',
        name: '', color: DEFAULT_BLOCK.color, startDate: null, endDate: null,
      }
    }
    if (edit?.kind === 'actividad') {
      const b = edit.block
      return {
        kind: 'actividad', courseId: null, days: [b.day],
        start: b.start || '', end: b.end || '', mode: b.mode || 'presencial',
        label: b.label || '', room: b.room || '',
        name: b.name || '', color: b.color || DEFAULT_BLOCK.color,
        startDate: b.startDate ?? null, endDate: b.endDate ?? null,
      }
    }
    // Sin ningún día marcado: que el primer clic sea tuyo y no una corrección.
    // Las horas arrancan en las de por defecto y se vuelven a proponer, ya
    // buscando un hueco libre, en cuanto eliges el día.
    return {
      kind: defaultKind || (lockCourseId || courses.length ? 'clase' : 'actividad'),
      courseId: lockCourseId ?? courses[0]?.id ?? null,
      days: [],
      start: DEFAULT_SESSION.start, end: DEFAULT_SESSION.end,
      mode: 'presencial', label: '', room: '',
      name: '', color: nextBlockColor(blocks, palette),
      startDate: null, endDate: null,
    }
  }

  // El borrador se arma una sola vez, al montar. Quien abre la hoja la monta
  // y quien la cierra la desmonta, asi que no hace falta reiniciarla a mano.
  const [draft, setDraft] = useState(armar)
  const [tocóHoras, setTocóHoras] = useState(!!edit)
  const [confirmando, setConfirmando] = useState(null)   // 'borrar' | 'descartar'
  const inicial = useRef(null)
  if (inicial.current === null) inicial.current = JSON.stringify(draft)

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  // Cambiar de dia vuelve a proponer un hueco libre, pero solo mientras el
  // usuario no haya tocado las horas: si ya las escribió, mandan las suyas.
  const marcarDía = (d) => {
    setDraft((prev) => {
      const yaEstá = prev.days.includes(d)
      const days = edit
        ? [d]
        : WEEK_ORDER.filter((x) => (x === d ? !yaEstá : prev.days.includes(x)))
      const next = { ...prev, days }
      if (!tocóHoras && days.length === 1) Object.assign(next, suggestSlot(days[0], { courses, blocks }))
      return next
    })
  }

  // Mover el inicio conserva la duración, como en las tablas de antes.
  const setStart = (v) => {
    setTocóHoras(true)
    setDraft((d) => {
      const antes = minutesOf(d.start)
      const fin = minutesOf(d.end)
      const nuevo = minutesOf(v)
      if (nuevo == null || antes == null || fin == null || fin <= antes) return { ...d, start: v }
      return { ...d, start: v, end: fmtTime(nuevo + (fin - antes)) }
    })
  }
  const setEnd = (v) => { setTocóHoras(true); set({ end: v }) }

  const skipId = edit?.session?.id ?? edit?.block?.id ?? null
  const cruces = useMemo(
    () => (draft ? findConflicts(draft, { courses, blocks, skipId }) : []),
    [draft, courses, blocks, skipId],
  )

  const esClase = draft.kind === 'clase'
  const editando = !!edit
  const curso = courses.find((c) => c.id === draft.courseId)
  const error = draftError(draft)
  const dur = (minutesOf(draft.end) ?? 0) - (minutesOf(draft.start) ?? 0)
  const sucio = JSON.stringify(draft) !== inicial.current

  const cerrar = () => { setConfirmando(null); onClose() }
  const intentarCerrar = () => (sucio ? setConfirmando('descartar') : cerrar())

  const guardar = () => {
    if (error) return
    const horas = { start: draft.start, end: draft.end, mode: draft.mode }

    if (editando && esClase) {
      const patch = { day: draft.days[0], ...horas, label: draft.label, room: draft.room }
      if (draft.courseId !== edit.courseId) {
        // Cambio de curso: la sesión se muda entera, no se puede parchear.
        dispatch({ type: 'DELETE_SESSION', courseId: edit.courseId, sessionId: edit.session.id })
        dispatch({ type: 'ADD_SESSION', courseId: draft.courseId, session: patch })
      } else {
        dispatch({ type: 'UPDATE_SESSION', courseId: edit.courseId, sessionId: edit.session.id, patch })
      }
    } else if (editando) {
      dispatch({
        type: 'UPDATE_BLOCK',
        id: edit.block.id,
        patch: {
          day: draft.days[0], ...horas, name: draft.name, label: draft.label,
          color: draft.color, room: draft.room,
          startDate: draft.startDate, endDate: draft.endDate,
        },
      })
    } else if (esClase) {
      for (const session of expandDays({ ...horas, label: draft.label, room: draft.room }, draft.days)) {
        dispatch({ type: 'ADD_SESSION', courseId: draft.courseId, session })
      }
    } else {
      for (const block of expandDays({
        ...horas, name: draft.name, label: draft.label,
        color: draft.color, room: draft.room,
        startDate: draft.startDate, endDate: draft.endDate,
      }, draft.days)) {
        dispatch({ type: 'ADD_BLOCK', block })
      }
    }
    cerrar()
  }

  const eliminar = () => {
    if (esClase) dispatch({ type: 'DELETE_SESSION', courseId: edit.courseId, sessionId: edit.session.id })
    else dispatch({ type: 'DELETE_BLOCK', id: edit.block.id })
    cerrar()
  }

  const título = editando
    ? (esClase ? 'Editar clase' : 'Editar actividad')
    : 'Agregar al horario'

  return (
    <Modal open onClose={intentarCerrar} title={título} width={560}>
      {!editando && !lockCourseId && (
        <div className="seg hs-kind">
          <button className={esClase ? 'on' : ''} disabled={!courses.length}
            title={courses.length ? '' : 'Primero crea un curso'}
            onClick={() => set({ kind: 'clase', label: '', courseId: draft.courseId ?? courses[0]?.id ?? null })}>
            Clase de un curso
          </button>
          <button className={!esClase ? 'on' : ''} onClick={() => set({ kind: 'actividad', label: '' })}>
            Otra actividad
          </button>
        </div>
      )}

      {esClase ? (
        <div className="field hs-section">
          <div className="field-label">Curso</div>
          {lockCourseId ? (
            <div className="row" style={{ gap: 8 }}>
              <span className="dot" style={{ background: curso?.color }} />
              <strong>{curso?.name || 'Sin curso'}</strong>
            </div>
          ) : (
            <div className="select">
              <select value={draft.courseId ?? ''} aria-label="Curso de la clase"
                onChange={(e) => set({ courseId: e.target.value })}>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Icon name="chevron-down" size={13} color={colors.textSoft} />
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="field hs-section">
            <div className="field-label">Nombre</div>
            <input className="text" maxLength={MAX_BLOCK_NAME} aria-label="Nombre de la actividad"
              placeholder="Cómo la llamas" value={draft.name}
              onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="field hs-section">
            <div className="field-label">Color</div>
            <div className="swatches" style={{ marginTop: 0 }}>
              {palette.map((col) => (
                <button key={col} className={`swatch ${draft.color === col ? 'active' : ''}`}
                  style={{ background: col }} aria-label={`Color ${col}`}
                  onClick={() => set({ color: col })} />
              ))}
            </div>
          </div>
        </>
      )}

      <div className="field hs-section">
        <div className="field-label">
          {editando ? 'Día' : 'Días'}
          {!editando && <span className="hs-note"> elige uno o varios; se crean todos de una vez</span>}
        </div>
        <div className="hs-days">
          {WEEK_ORDER.map((d) => (
            <button key={d} className={`hs-day ${draft.days.includes(d) ? 'on' : ''}`}
              aria-pressed={draft.days.includes(d)} onClick={() => marcarDía(d)}>
              {dayName(d)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid2 hs-section">
        <div className="field">
          <div className="field-label">Inicio</div>
          <TimeField value={draft.start} label="Hora de inicio" onCommit={setStart} />
        </div>
        <div className="field">
          <div className="field-label">Fin</div>
          <TimeField value={draft.end} label="Hora de fin" invalid={dur <= 0} onCommit={setEnd} />
        </div>
      </div>
      {dur > 0 && (
        <p className="hs-note block">
          {fmtDuration(dur)}
          {draft.days.length > 1 ? ` · ${draft.days.length} días · ${fmtDuration(dur * draft.days.length)} en total` : ''}
        </p>
      )}

      <div className="field hs-section">
        <div className="field-label">Modalidad</div>
        <div className="seg">
          {MODES.map((m) => (
            <button key={m} className={draft.mode === m ? 'on' : ''} onClick={() => set({ mode: m })}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      <CampoTipo
        titulo={esClase ? 'Tipo de sesión' : 'Tipo de actividad'}
        opciones={esClase ? SESSION_TYPES : ACTIVITY_TYPES}
        value={draft.label}
        onChange={(label) => set({ label })}
      />

      <div className="field hs-section">
        <div className="field-label">{esClase ? 'Aula' : 'Lugar'} <span className="hs-note">opcional</span></div>
        <input className="text" maxLength={MAX_ROOM} aria-label={esClase ? 'Aula' : 'Lugar'}
          placeholder={draft.mode === 'virtual' ? 'Sala o plataforma' : 'Dónde es'}
          value={draft.room} onChange={(e) => set({ room: e.target.value })} />
      </div>

      {esClase ? (
        <p className="hs-note block">
          Las fechas salen del curso: si {curso?.name || 'el curso'} tiene inicio y fin, la clase los sigue.
        </p>
      ) : (
        <div className="hs-section">
          <div className="field-label">Vigencia <span className="hs-note">opcional</span></div>
          <p className="hs-note block">
            Sin fechas sale siempre. Con fechas entra y sale del horario sola, como un curso.
          </p>
          <div className="grid2" style={{ marginTop: 8 }}>
            <DateField label="Desde" value={draft.startDate} onChange={(iso) => set({ startDate: iso })} />
            <DateField label="Hasta" value={draft.endDate} min={draft.startDate}
              onChange={(iso) => set({ endDate: iso })} />
          </div>
        </div>
      )}

      {cruces.length > 0 && (
        <div className="hs-warn">
          <Icon name="info" size={15} color={colors.amber} />
          <div>
            <strong>Se cruza con {cruces.length === 1 ? 'algo' : `${cruces.length} cosas`} de tu semana.</strong>
            <ul>
              {cruces.slice(0, 4).map((s) => (
                <li key={s.id}>{dayName(s.day, true)} {s.start}–{s.end} · {s.courseName}</li>
              ))}
              {cruces.length > 4 && <li>y {cruces.length - 4} más</li>}
            </ul>
            <span className="hs-note">Puedes guardarlo igual: en la rejilla salen lado a lado.</span>
          </div>
        </div>
      )}

      {/* Recién abierta no hay nada que corregir: el mismo texto sirve de guía
          en gris, y solo se pone en ámbar cuando ya tocaste algo. */}
      {error && <p className={`hs-error ${sucio ? '' : 'suave'}`}>{error}</p>}

      {confirmando === 'descartar' ? (
        <div className="sheet-actions">
          <span className="hs-note" style={{ marginRight: 'auto' }}>Se pierde lo que escribiste.</span>
          <button className="btn ghost" onClick={() => setConfirmando(null)}>Seguir editando</button>
          <button className="btn danger" onClick={cerrar}>Descartar</button>
        </div>
      ) : confirmando === 'borrar' ? (
        <div className="sheet-actions">
          <span className="hs-note" style={{ marginRight: 'auto' }}>
            ¿Quitar {esClase ? 'esta clase' : 'esta actividad'} del horario?
          </span>
          <button className="btn ghost" onClick={() => setConfirmando(null)}>No</button>
          <button className="btn danger" onClick={eliminar}>Sí, eliminar</button>
        </div>
      ) : (
        <div className="sheet-actions">
          {editando && (
            <button className="btn ghost hs-del" style={{ marginRight: 'auto' }}
              onClick={() => setConfirmando('borrar')}>
              <Icon name="trash-2" size={14} color={colors.red} /> Eliminar
            </button>
          )}
          {editando && esClase && onOpenCourse && (
            <button className="btn ghost" onClick={() => { cerrar(); onOpenCourse(draft.courseId) }}>
              Abrir curso
            </button>
          )}
          <button className="btn ghost" onClick={intentarCerrar}>Cancelar</button>
          <button className="btn primary" onClick={guardar} disabled={!!error}>
            {editando ? 'Guardar' : (draft.days.length > 1 ? `Agregar ${draft.days.length}` : 'Agregar')}
          </button>
        </div>
      )}
    </Modal>
  )
}

// ------------------------------------------------------------
//  Campo de tipo: pastillas + “Otro…”
// ------------------------------------------------------------
//  El tipo es texto libre, así que las pastillas solo ahorran teclear. Un tipo
//  escrito a mano se suma a la lista como una pastilla más, encendida: si no,
//  al abrir una actividad de tipo “Práctica” (que vive en la lista de clases,
//  no en la de actividades) parecía que no tenía tipo. “Otro…” solo lleva el
//  cursor al campo de texto.
function CampoTipo({ titulo, opciones, value, onChange }) {
  const input = useRef(null)
  const propio = !!value && !opciones.includes(value)
  const lista = propio ? [...opciones, value] : opciones

  return (
    <div className="field hs-section">
      <div className="field-label">{titulo} <span className="hs-note">opcional</span></div>
      <div className="hs-pills">
        {lista.map((t) => (
          <button key={t} className={`hs-pill ${value === t ? 'on' : ''}`}
            onClick={() => onChange(value === t ? '' : t)}>{t}</button>
        ))}
        <button className="hs-pill otro" onClick={() => input.current?.focus()}>Otro…</button>
      </div>
      <input ref={input} className="text" style={{ marginTop: 8 }} maxLength={MAX_LABEL}
        aria-label={titulo} placeholder="Escribe otro tipo"
        value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
