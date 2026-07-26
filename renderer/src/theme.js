// Paleta y tokens compartidos con la app móvil.
// Concepto: papel cálido + tinta morada.
export const colors = {
  brand: '#6d4a9c',
  brandDark: '#4f3676',
  brandLight: '#ece3f6',
  bg: '#f4f0e9',
  card: '#fffdf9',
  border: '#e7ddcf',
  text: '#332d2a',
  textSoft: '#6f6459',
  textFaint: '#a99e8e',
  slate50: '#faf6ef',
  slate100: '#efe8dc',
  emerald: '#3f8f5b', emeraldBg: '#e3efe4',
  amber: '#bf861f', amberBg: '#f6ecd4',
  red: '#c14d43', redBg: '#f6e2de',
}

// Colores para elegir por curso
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
