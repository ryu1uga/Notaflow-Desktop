// Paleta y tokens de estilo compartidos
// Concepto: papel cálido + tinta morada. Se aleja del gris slate + azul
// índigo por defecto para tener identidad propia.
//
// IMPORTANTE: este archivo es idéntico en las dos apps
//   Notaflow-App/src/theme.js
//   Notaflow-Desktop/renderer/src/theme.js
// Si cambias algo aquí, copia el archivo al otro repo.

export const colors = {
  brand: '#6d4a9c',       // morado tinta
  brandDark: '#4f3676',
  brandLight: '#ece3f6',  // lila muy claro
  bg: '#f4f0e9',          // papel cálido
  card: '#fffdf9',        // blanco hueso
  border: '#e7ddcf',      // borde cálido
  text: '#332d2a',        // tinta cálida
  textSoft: '#6f6459',    // taupe
  textFaint: '#a99e8e',   // taupe claro
  slate50: '#faf6ef',     // (nombre heredado) neutro cálido muy claro
  slate100: '#efe8dc',    // (nombre heredado) neutro cálido claro
  // estados — verdes/ocres/rojos muteados, no "neón"
  emerald: '#3f8f5b', emeraldBg: '#e3efe4',
  amber: '#bf861f', amberBg: '#f6ecd4',
  red: '#c14d43', redBg: '#f6e2de',
}

// Colores para elegir por curso (cálidos y variados, cohesionados con el tema)
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
