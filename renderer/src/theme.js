// Paleta y tokens de estilo compartidos.
//
// Desktop: los valores son referencias a variables CSS definidas en
// styles.css, así el modo claro y el oscuro cambian toda la interfaz
// (incluidos los estilos en línea y los íconos) sin tocar el JSX.
//
// OJO: la app móvil (Notaflow-App/src/theme.js) mantiene su propia copia
// con valores hex; allá no hay variables CSS.

export const colors = {
  brand: 'var(--brand)',
  brandDark: 'var(--brand-dark)',
  brandLight: 'var(--brand-light)',
  bg: 'var(--bg)',
  card: 'var(--card)',
  border: 'var(--border)',
  text: 'var(--text)',
  textSoft: 'var(--text-soft)',
  textFaint: 'var(--text-faint)',
  slate50: 'var(--surface-1)',   // (nombre heredado) superficie sutil
  slate100: 'var(--surface-2)',  // (nombre heredado) superficie marcada
  // estados
  emerald: 'var(--emerald)', emeraldBg: 'var(--emerald-bg)',
  amber: 'var(--amber)', amberBg: 'var(--amber-bg)',
  red: 'var(--red)', redBg: 'var(--red-bg)',
}

// Colores para elegir por curso. Se guardan como hex en los datos del
// usuario (no cambiar los valores existentes: los cursos ya creados
// los tienen persistidos). Elegidos para funcionar en claro y oscuro.
export const palette = [
  '#6d4a9c', '#3b7ea1', '#4f9d69', '#bf861f', '#c86b4a',
  '#c1517a', '#5a6fc0', '#8a6d3b', '#4aa1a1', '#9c5bbf',
]

export const statusColor = {
  emerald: { fg: colors.emerald, bg: colors.emeraldBg },
  amber: { fg: colors.amber, bg: colors.amberBg },
  red: { fg: colors.red, bg: colors.redBg },
  slate: { fg: colors.textSoft, bg: colors.slate100 },
}
