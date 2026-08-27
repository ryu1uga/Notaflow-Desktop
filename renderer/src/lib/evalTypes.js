// ---------------------------------------------------------------
//  Tipos de evaluación de NotaFlow.
//
//  IMPORTANTE: esta lista está duplicada a propósito en la app de
//  escritorio, en Notaflow-Desktop/renderer/src/lib/evalTypes.js
//  Las dos apps intercambian el mismo JSON de respaldo, así que si
//  cambias algo aquí, copia el archivo al otro repo.
// ---------------------------------------------------------------

// Tipos fijos que se ofrecen para elegir.
export const TYPES = ['Examen', 'Práctica', 'Proyecto', 'Portafolio', 'Investigación']

// Respaldo cuando se elige "Otro" y no se escribe nada.
export const OTHER = 'Otro'

// Límite de caracteres de un tipo escrito a mano.
export const MAX_TIPO = 24

// Cualquier valor fuera de TYPES cuenta como tipo personalizado: así los
// tipos antiguos o venidos de un respaldo nunca se pierden.
export const isCustomType = (t) => !TYPES.includes(t)
