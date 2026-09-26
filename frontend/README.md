# Echoes of Haven — Frontend (React + Vite)

Modern React.js frontend for **Echoes of Haven** with HTML5 Canvas 2D Animated Living Village Engine, dynamic AI dialogue, and real-time state synchronization.

## 🚀 Quick Start

### Option 1: Live via FastAPI Backend (Production Build)
Simply start the backend from the project root:
```bash
python main.py
```
Open **`http://127.0.0.1:8000`** in your browser. FastAPI automatically serves the built React application!

---

### Option 2: Live React Development Server (HMR)
To develop with React Hot-Module-Replacement:

1. In one terminal, run the FastAPI backend:
   ```bash
   python main.py
   ```
2. In a second terminal, start the Vite development server:
   ```bash
   cd frontend
   npm run dev
   ```
3. Open **`http://localhost:5173`** in your browser. All API requests (`/talk`, `/state`, `/health`) are automatically proxied to port 8000.

---

## 🛠️ Tech Stack & Structure

- **Framework:** React 19 + Vite 6
- **Styling:** Custom Vanilla CSS Design System with dark medieval theme (`src/index.css`)
- **Graphics & Animation:** HTML5 Canvas 2D procedural human sprite rendering and dynamic lighting engine (`src/components/GameWorld.jsx`)
- **Audio:** Web Audio API sound synthesizer (footsteps, anvil clangs, magic chimes)
- **API Integration:** REST API client connecting to FastAPI backend (`POST /talk`, `GET /state/{player_id}`, `GET /health`)

### Component Map
- `src/components/Header.jsx`: Title crest, NPC selectors, player badge
- `src/components/DemoSpine.jsx`: 1-Click Judge walkthrough bar (Steps 1–5)
- `src/components/GameWorld.jsx`: Animated 2D RPG village with human characters, schedules, hotspots, day/dusk/night lighting, and radar minimap
- `src/components/ChatArea.jsx`: NPC banner, dialogue message bubbles, typing indicators, auto-resizing input
- `src/components/Sidebar.jsx`: Trust status bars, inventory pouch, and village chronicle feed
- `src/components/HotspotModal.jsx`: Village landmark inspect modal
- `src/components/Toast.jsx`: Sliding animated action and alert toasts
