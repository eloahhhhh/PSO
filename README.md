# PSO Visualizer (Netlify-only)

Diese Version laeuft komplett ohne Backend auf Netlify:

- PSO-Simulation und Rendering laufen direkt im Browser (Canvas).
- Die Animation wird live im Browser abgespielt.
- Keine Server-API, kein Python, kein FFmpeg auf dem Host notwendig.

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

## Lokal testen

Du kannst die Seite einfach als statische Datei oeffnen oder mit einem Mini-Server starten.

Beispiel mit Python:

```bash
python -m http.server 8000
```

Dann `http://127.0.0.1:8000` oeffnen.

## Netlify Deployment (Schritt fuer Schritt)

### 1) Code nach GitHub pushen

1. In deinem Projektordner:
   - `git add .`
   - `git commit -m "Switch to netlify-only frontend rendering"`
   - `git push`
2. Stelle sicher, dass diese Dateien im Repo sind:
   - `index.html`
   - `static/styles.css`
   - `static/app.js`
   - `netlify.toml`

### 2) Site in Netlify anlegen

1. In Netlify einloggen.
2. **Add new site** -> **Import an existing project**.
3. GitHub verbinden und dein Repo auswaehlen.
4. Build-Einstellungen:
   - **Build command**: leer lassen
   - **Publish directory**: wird durch `netlify.toml` auf `.` gesetzt
5. **Deploy site** klicken.

### 3) Nach dem Deploy pruefen

1. Netlify-URL oeffnen.
2. Parameter einstellen und **Animation rendern** klicken.
3. Warten bis das Rendering fertig ist.
4. Die Animation direkt im Browser verfolgen.

## Hinweise

- Das Rendering passiert lokal im Browser. Schwache Geraete brauchen laenger.
- Sehr hohe Iterationszahlen koennen den Browser kurzzeitig stark auslasten.
- Es gibt keinen Video-Export mehr. Fokus ist eine flüssige, hochwertige Live-Visualisierung.
