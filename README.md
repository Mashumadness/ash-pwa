# Pokémon — Serie Ash PWA

Una aplicación web progresiva (PWA) para ver y hacer seguimiento de los episodios de la serie animada de Ash Ketchum en español latino, directamente desde el navegador o instalada como app en cualquier dispositivo.

---

## ✨ Características

- 📺 **Reproductor de video** integrado con controles nativos del navegador
- ✅ **Seguimiento de episodios** — marcá capítulos como vistos/no vistos, persistido en `localStorage`
- 🔴 **Detección automática** de episodio completado al llegar al 100% de reproducción
- ⏭️ **Autoplay** — reproduce automáticamente el siguiente episodio con cuenta regresiva cancelable
- 🔍 **Búsqueda y filtros** — filtrá por nombre, o por estado (todos / pendientes / vistos)
- 📊 **Progreso por temporada** — barra de progreso y contador `X/Y episodios` en la pantalla de inicio
- 🎨 **Pokeball** como indicador visual de episodio visto (badge en miniatura + botón de toggle)
- 📱 **Instalable como PWA** en Android, iOS y escritorio
- 🌐 **Funciona offline** gracias al Service Worker con caché de assets

---

## 🗂️ Temporadas disponibles

| # | Título | Episodios |
|---|--------|-----------|
| 1 | ¡Atrápalos ya! | 82 |
| 2 | Las aventuras en las Islas Naranja | 35 |
| 3 | El desafío Johto | 41 |
| 4 | Liga Johto | 52 |
| 5 | Campeones de Johto | 65 |
| 6 | Pokémon Avanzado | 40 |
| 7 | Pokémon Avanzado — Desafío | — |

---

## 🛠️ Tecnología

El proyecto es intencionalmente **vanilla** — sin frameworks, sin bundlers, sin dependencias.

| Capa | Tecnología |
|------|------------|
| Estructura | HTML5 semántico |
| Estilos | CSS3 (custom properties, grid, flexbox, animaciones) |
| Lógica | JavaScript ES2020+ (módulos, async/await, Set, localStorage) |
| Offline | Service Worker + Cache API |
| Instalación | Web App Manifest |

---

## 📁 Estructura del proyecto

```
ash-pwa/
├── index.html          # Estructura de la app (season picker + player)
├── app.js              # Lógica completa de la aplicación
├── style.css           # Estilos y temas visuales
├── sw.js               # Service Worker (caché offline)
├── manifest.json       # Web App Manifest (PWA)
├── seasons.json        # Índice de temporadas disponibles
├── season1.json        # Datos de episodios — T1
├── season2.json        # Datos de episodios — T2
├── ...                 # season3 → season7
└── icons/              # Íconos PWA (192px y 512px, maskable)
```

---

## 📦 Estructura de datos

### `seasons.json`
Índice de temporadas. Cada entrada referencia su archivo de datos:

```json
{
  "number": 1,
  "title": "¡Atrápalos ya!",
  "subtitle": "La serie de Ash — Temporada 1",
  "logo": "https://...season1_logo8.webp",
  "logo_png": "https://...season1_logo8.png",
  "data": "./season1.json",
  "episode_count": 82
}
```

### `seasonN.json`
Array de episodios de la temporada:

```json
{
  "number": 1,
  "title": "Pokémon, ¡Yo te elijo!",
  "description": "Descripción del episodio...",
  "image": "https://pkproject.net/pokemon_anime/main/150/EP0001.webp",
  "video_url": "https://pkproject.net/descargas/epis/serie-ash/t01/t01_e01.es-la.mp4",
  "url": "https://pkproject.net/episodios/latino/serie-ash/temporada-1/episodio-1"
}
```

---

## ➕ Cómo agregar una temporada manualmente

1. **Crear `seasonN.json`** con el array de episodios siguiendo la estructura de arriba.

2. **Agregar la entrada en `seasons.json`**:
   ```json
   {
     "number": 8,
     "title": "Nombre de la temporada",
     "subtitle": "La serie de Ash — Temporada 8",
     "logo": "https://pkproject.net/anime/logo/1/season8_logo8.webp",
     "logo_png": "https://pkproject.net/anime/logo/1/season8_logo8.png",
     "data": "./season8.json",
     "episode_count": 52
   }
   ```

3. **Actualizar `sw.js`**:
   - Incrementar `CACHE_NAME` (ej: `v4` → `v5`)
   - Agregar `"./seasonN.json"` al array `ASSETS`

---

## 🚀 Deploy

La app está hosteada en **GitHub Pages** y se actualiza automáticamente con cada push a `main`.

🌐 [mashumadness.github.io/ash-pwa](https://mashumadness.github.io/ash-pwa)

---

## 📲 Instalar como app

1. Abrí el link en Chrome (Android) o Safari (iOS)
2. Tocá **"Agregar a pantalla de inicio"** o **"Instalar app"**
3. La app funciona sin conexión una vez instalada

---

## 📜 Licencia

Proyecto personal de seguimiento. Los videos e imágenes pertenecen a sus respectivos propietarios.
