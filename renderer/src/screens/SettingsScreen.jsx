import React, { useEffect, useState } from 'react'
import {
  useStore, exportJSON, importJSON, revealFile,
  testNotification, notificationsSupported,
} from '../lib/store.jsx'
import { Card, NumField, Switch, Icon, InfoButton, Confirm } from '../components/ui.jsx'
import { colors } from '../theme.js'

const two = (n) => String(n).padStart(2, '0')

const STEP_INFO = {
  title: 'Paso de la nota',
  text: 'Define a qué valores se ajusta (redondea) la nota final:\n\n• 1 → notas enteras (…, 10, 11, 12)\n• 0.5 → medios puntos (10, 10.5, 11)\n• 0.25 → cuartos (10, 10.25, 10.5)\n• 0.1 → un decimal (10.0, 10.1, 10.2)\n\nElige el que use tu facultad.',
}

export default function SettingsScreen({ notify }) {
  const { state, dispatch } = useStore()
  const s = state.settings
  const [pendingImport, setPendingImport] = useState(null)
  const [canNotify, setCanNotify] = useState(true)

  useEffect(() => { notificationsSupported().then(setCanNotify) }, [])

  const setScale = (patch) =>
    dispatch({ type: 'UPDATE_SETTINGS', patch: { defaultScale: { ...s.defaultScale, ...patch } } })

  const doExport = async () => {
    try {
      const p = await exportJSON(state)
      if (p) notify({ kind: 'ok', text: `Copia guardada en ${p}` , path: p })
    } catch (e) {
      notify({ kind: 'error', text: `No se pudo exportar: ${e.message || e}` })
    }
  }

  const doImport = async () => {
    try {
      const data = await importJSON()
      if (data) setPendingImport(data)
    } catch (e) {
      notify({ kind: 'error', text: `Archivo inválido: ${e.message || e}` })
    }
  }

  const time = `${two(s.notifyHour ?? 9)}:${two(s.notifyMinute ?? 0)}`

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Ajustes</h2>
          <div className="sub">Escala, semestre, avisos y respaldo.</div>
        </div>
      </div>

      {/* Escala global */}
      <Card>
        <h3 className="section-title">Escala global por defecto</h3>
        <p className="p">
          Se usa en los cursos que no tienen escala propia. Tu facultad usa 0–20 y aprueba con 11; otra quizá 0–7 con 4.
        </p>
        <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
          <Field label="Nota mínima" value={s.defaultScale.min} onChange={(v) => setScale({ min: v })} />
          <Field label="Nota máxima" value={s.defaultScale.max} onChange={(v) => setScale({ max: v })} />
          <Field label="Aprobar con" value={s.defaultScale.passing} onChange={(v) => setScale({ passing: v })} />
          <Field label="Paso" value={s.defaultScale.step} onChange={(v) => setScale({ step: v })} info={STEP_INFO} />
          <div className="spacer" />
        </div>

        <div className="toggle-row">
          <div style={{ flex: 1 }}>
            <p className="toggle-title">Redondear la nota final</p>
            <p className="p">
              Ajusta la nota final al paso de tu escala (enteros, medios o decimales).
              Actívalo si tu facultad redondea; apágalo para el promedio exacto.
            </p>
          </div>
          <Switch checked={s.roundFinal !== false} label="Redondear la nota final"
            onChange={(v) => dispatch({ type: 'UPDATE_SETTINGS', patch: { roundFinal: v } })} />
        </div>
      </Card>

      {/* Semestre */}
      <Card>
        <h3 className="section-title">Semestre</h3>
        <p className="p">Cuántas semanas dura, para armar el cronograma.</p>
        <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
          <Field label="Semanas" value={s.semesterWeeks}
            onChange={(v) => dispatch({ type: 'UPDATE_SETTINGS', patch: { semesterWeeks: Math.max(1, Math.trunc(v) || 16) } })} />
          <div className="spacer" />
        </div>
      </Card>

      {/* Notificaciones */}
      <Card>
        <h3 className="section-title">Notificaciones</h3>
        <p className="p">
          Te aviso antes de cada evaluación pendiente. Necesito la fecha de inicio del curso con la semana,
          o el día exacto de la evaluación.
        </p>

        {!canNotify && (
          <p className="p" style={{ color: colors.amber }}>
            Tu sistema no admite notificaciones nativas para esta aplicación.
          </p>
        )}

        <div className="toggle-row">
          <div style={{ flex: 1 }}>
            <p className="toggle-title">Activar avisos</p>
            <p className="p">Un recordatorio antes de cada evaluación, mientras NotaFlow esté abierto.</p>
          </div>
          <Switch checked={s.notificationsOn === true} label="Activar avisos"
            onChange={(v) => dispatch({ type: 'UPDATE_SETTINGS', patch: { notificationsOn: v } })} />
        </div>

        {s.notificationsOn === true && (
          <>
            <div className="row" style={{ gap: 12, marginTop: 14, alignItems: 'flex-end' }}>
              <Field label="Avisar días antes" value={s.notifyDaysBefore ?? 2}
                onChange={(v) => dispatch({ type: 'UPDATE_SETTINGS', patch: { notifyDaysBefore: Math.max(0, Math.trunc(v)) } })} />
              <div className="field" style={{ width: 132 }}>
                <div className="field-label">Hora del aviso</div>
                <input
                  type="time"
                  className="date-input"
                  value={time}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number)
                    if (!Number.isNaN(h)) dispatch({ type: 'UPDATE_SETTINGS', patch: { notifyHour: h, notifyMinute: m || 0 } })
                  }}
                />
              </div>
              <button className="btn ghost" onClick={() => testNotification()}>
                <Icon name="bell" size={15} /> Probar aviso
              </button>
              <div className="spacer" />
            </div>
            <p className="p" style={{ marginTop: 10 }}>
              El aviso llega a más tardar el domingo previo a la semana de la evaluación.
              Los “días antes” solo pueden adelantarlo.
            </p>
          </>
        )}
      </Card>

      {/* Respaldo */}
      <Card>
        <h3 className="section-title">Copia de seguridad</h3>
        <p className="p">
          Tus datos viven solo en esta computadora. Expórtalos a un archivo JSON —el mismo formato de la app móvil,
          así puedes pasar tus cursos de un lado al otro.
        </p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn primary" onClick={doExport}>
            <Icon name="download" size={15} color="#fff" /> Exportar
          </button>
          <button className="btn ghost" onClick={doImport}>
            <Icon name="upload" size={15} /> Importar
          </button>
        </div>
      </Card>

      {/* Ayuda */}
      <Card style={{ marginBottom: 24 }}>
        <h3 className="section-title">Ayuda</h3>
        <p className="p">¿Repasamos cómo funciona?</p>
        <button className="btn ghost" onClick={() => dispatch({ type: 'UPDATE_SETTINGS', patch: { onboarded: false } })}>
          <Icon name="help-circle" size={15} /> Ver el tutorial otra vez
        </button>
      </Card>

      <Confirm
        open={pendingImport != null}
        title="Importar datos"
        message="Esto reemplazará TODOS tus datos actuales por los del archivo. ¿Continuar?"
        confirmText="Reemplazar"
        danger
        onConfirm={() => { dispatch({ type: 'REPLACE_ALL', payload: pendingImport }); notify({ kind: 'ok', text: 'Datos importados.' }) }}
        onClose={() => setPendingImport(null)}
      />
    </div>
  )
}

function Field({ label, value, onChange, info }) {
  return (
    <div className="field" style={{ width: 130 }}>
      <div className="field-label">
        {label}
        {info ? <InfoButton title={info.title} text={info.text} /> : null}
      </div>
      <NumField value={value} onChangeNumber={onChange} />
    </div>
  )
}
