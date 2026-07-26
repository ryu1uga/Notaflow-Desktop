# NotaFlow Desktop · Control de Notas (Electron + React)

Versión de escritorio de [NotaFlow](../Notaflow-App). Mismas cuentas, misma lógica,
pero con la pantalla grande aprovechada: barra lateral, tabla de evaluaciones editable
y calendario más cómodo.

Tus datos se guardan en un archivo JSON dentro de tu perfil de usuario. Nada sale a internet.

## Requisitos

- [Node.js](https://nodejs.org) 18+ (recomendado 20+).

## Cómo correrla en desarrollo

```bash
npm install
npm run dev
```

Eso levanta Vite y abre la ventana de Electron con recarga en caliente:
cada cambio que guardes se refleja al instante.

Para probar el build de producción sin generar instalador:

```bash
npm start
```

### Si sale "Electron failed to install correctly"

Pasa en Windows cuando el antivirus interrumpe la descarga del binario de Electron
durante `npm install` y deja `node_modules/electron/dist` a medias.

El proyecto trae un reparador que no necesita descargar nada: busca el zip de Electron
en las cachés que ya tienes en tu equipo (la de npm y la de electron-builder) y lo extrae
donde corresponde.

```bash
npm run fix:electron
```

Corre solo después de cada `npm install`, y también antes de `npm run dev`.
Si te dice que no encontró el zip, bájalo de
[releases de Electron](https://github.com/electron/electron/releases/tag/v31.7.7)
(`electron-v31.7.7-win32-x64.zip`), déjalo en `%LOCALAPPDATA%\electron\Cache\`
y vuelve a correr el comando.

> La versión de Electron está fijada en 31.7.7 (y electron-builder en 24.13.3) a propósito:
> es la que ya está descargada y probada en esta máquina, así no hay que volver a bajar
> 100 MB ni pelear con el antivirus.

## Generar el instalable

El instalador se genera **para el sistema donde lo corres** — electron-builder no puede
firmar ni empaquetar para macOS desde Windows, ni al revés.

```bash
npm run dist
```

| Dónde lo corres | Qué obtienes en `release/` |
| --- | --- |
| Windows | `NotaFlow Setup 1.0.0.exe` (instalador NSIS, elige carpeta, crea accesos directos) |
| macOS   | `NotaFlow-1.0.0.dmg` (Intel y Apple Silicon) |
| Linux   | `.AppImage` y `.deb` |

También puedes forzar un destino con `npm run dist:win`, `npm run dist:mac` o `npm run dist:linux`,
siempre que estés en ese sistema operativo.

> En macOS el `.dmg` sale sin firmar. La primera vez ábrelo con clic derecho → *Abrir*,
> o permítelo en *Ajustes del Sistema → Privacidad y seguridad*.

Para empaquetar sin crear instalador (útil para probar): `npm run pack`.

## Qué hace

**Cursos.** Cada curso tiene evaluaciones con nombre, tipo (Examen, Proyecto, Práctica…),
fecha, semana, peso (%) y nota. Ingresas las notas conforme te las devuelven.

**Control de notas ponderadas** (peso × nota):

- **Nota actual**: promedio sobre lo ya evaluado.
- **Estado**: Aprobado asegurado · Aún es posible · Ya no es posible.
- **Máx./Mín. posible** según lo que saques en lo pendiente.
- **Para aprobar**: cuánto necesitas en promedio en lo que falta.
- **Próxima evaluación**: nota mínima que necesitas en la siguiente para seguir en carrera.

**Cronograma.** Todas las evaluaciones de todos los cursos, por semana del semestre
o en vista de calendario mensual.

**Escala configurable** (global y por curso). Por defecto 0–20 aprobando con 11; los cursos
en otra escala (ej. 0–7 aprobando con 4) activan "escala propia".

**Redondeo de nota final** (global, y también por curso). Si tu universidad redondea la nota
final (10.65 → 11), déjalo activado; desactívalo para el promedio exacto. Un curso con escala
propia puede tener su propio switch de redondeo, que anula el global.

**Fechas.** Cada curso puede tener fecha de inicio y fin. La fecha de cada evaluación se calcula
desde el inicio + su número de semana, o la fijas directamente y se deduce la semana.

**Notificaciones del sistema.** Actívalas en Ajustes y la app avisa X días antes (por defecto 2)
de cada evaluación pendiente con fecha. El aviso llega a más tardar el domingo previo a la semana
de la evaluación; los "días antes" solo pueden adelantarlo. Se disparan mientras NotaFlow esté
abierto (incluso minimizado).

**Reordenar evaluaciones.** Arrastra el asa (≡) de una fila.

**Respaldo compatible con la app móvil.** Exporta/importa todos tus datos como JSON desde Ajustes.
Es el mismo formato que usa NotaFlow en el celular, así que puedes mover tus cursos entre ambas.

## Primer uso

La app arranca vacía, con un tutorial de bienvenida de unas pocas pantallas.
Puedes volver a verlo desde **Ajustes → Ayuda → Ver el tutorial otra vez**.

## Dónde viven tus datos

| Sistema | Ruta |
| --- | --- |
| Windows | `%APPDATA%\NotaFlow\notaflow-data.json` |
| macOS   | `~/Library/Application Support/NotaFlow/notaflow-data.json` |
| Linux   | `~/.config/NotaFlow/notaflow-data.json` |

El guardado es atómico (escribe un temporal y lo renombra), así que un corte de luz
no te deja el archivo a medias.

## Estructura

```
electron/
  main.js            Proceso principal: ventana, persistencia, diálogos, notificaciones
  preload.cjs        Puente seguro (contextBridge) entre el sistema y la interfaz
scripts/
  fix-electron.mjs   Repara el binario de Electron desde las cachés locales
renderer/
  index.html
  src/
    main.jsx         Punto de entrada de React
    App.jsx          Barra lateral + navegación
    theme.js         Colores y paleta (compartidos con la app móvil)
    styles.css       Todos los estilos
    lib/
      calc.js        Lógica de notas (pura) — idéntica a la del móvil
      schedule.js    Fechas de evaluaciones y armado de avisos
      store.jsx      Estado global + persistencia + export/import
      id.js          Generador de IDs y estado inicial vacío
    components/
      Icon.jsx       Íconos Feather en línea
      ui.jsx         Card, Badge, Progress, NumField, Switch, Modal, DateField…
      Calendar.jsx   Calendario mensual
      Onboarding.jsx Tutorial de bienvenida
    screens/
      CoursesScreen.jsx
      CourseDetailScreen.jsx
      ScheduleScreen.jsx
      SettingsScreen.jsx
build/
  icon.png / icon.ico / icon.icns    Íconos del ejecutable e instalador
```

## Seguridad

La ventana corre con `contextIsolation`, sin `nodeIntegration` y con `sandbox` activo.
La interfaz solo puede hablar con el sistema a través de las funciones expuestas en
`preload.cjs`. El HTML de producción declara una Content-Security-Policy estricta.
