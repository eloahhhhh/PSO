# PSO Website mit Manim

Diese kleine Website rendert eine PSO-Animation (Particle Swarm Optimization) auf einer 2D-Heatmap mit der **Manim**-Library.

Unterstuetzte Testfunktionen:
- Ackley
- Rosenbrock

Einstellbare Hyperparameter:
- Traegheitsgewicht `w`
- Kognitiver Faktor `c1`
- Sozialer Faktor `c2`
- Anzahl Partikel
- Anzahl Iterationen
- Zufalls-Seed

## Setup

1. Python 3.10+ installieren.
2. Abhaengigkeiten installieren:

```bash
pip install -r requirements.txt
```

3. Falls noch nicht vorhanden: FFmpeg fuer Manim installieren und in `PATH` legen.

## Start

```bash
python -m uvicorn app:app --reload
```

Dann im Browser `http://127.0.0.1:8000` oeffnen.

## Hinweis

Das Rendering erfolgt serverseitig ueber Manim. Bei vielen Partikeln/Iterationen kann das je nach CPU einige Sekunden dauern.

## Deployment fuer externe Nutzung (Render.com)

Wenn dein Freund die Seite ueber eine URL nutzen soll, ist Render mit Docker am einfachsten.

### 1) Projekt nach GitHub pushen

1. Neues GitHub-Repository erstellen (z. B. `pso-website`).
2. Dieses Projekt vollstaendig committen und pushen.
3. Sicherstellen, dass `Dockerfile`, `.dockerignore` und `render.yaml` im Repo sind.

### 2) Render-Service anlegen

1. Auf [render.com](https://render.com) anmelden (am besten per GitHub).
2. **New +** -> **Web Service**.
3. Das GitHub-Repo auswaehlen.

### 3) Mit Docker deployen

Diese Konfiguration ist bereits im Projekt enthalten:

- `Dockerfile` installiert alle benoetigten Systempakete inkl. `ffmpeg`.
- Startkommando im Container:
  - `uvicorn app:app --host 0.0.0.0 --port ${PORT:-10000}`
- `render.yaml` setzt den Service-Typ auf Docker.

Auf Render nur noch Deployment bestaetigen (Create Web Service).

### 4) URL testen und teilen

1. Warten bis Build und Deploy erfolgreich sind (Status "Live").
2. Render zeigt dann eine URL wie `https://pso-website-xxxx.onrender.com`.
3. URL im Browser oeffnen, Test-Render starten und an deinen Freund schicken.

### 5) Typische Probleme

- **500 beim Rendern**: Haeufig fehlende Systempakete/`ffmpeg` (im Dockerfile bereits geloest).
- **Erster Aufruf ist langsam**: Free-Plan schlaeft ein, ist normal.
- **Langsame Renderzeiten**: Manim rendert serverseitig und braucht CPU-Zeit.
