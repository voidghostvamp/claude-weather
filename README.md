# SkyNote

A weather site in plain HTML, CSS and JavaScript. Data comes from [Open-Meteo](https://open-meteo.com/) (forecast, geocoding and air-quality APIs).

## Files
```
index.html   page structure
style.css    design tokens, layout, weather scenes
script.js    API calls, rendering, scene, cat mascot, settings
assets/      reserved for local images
```

## API setup
None. Open-Meteo needs no key for non-commercial use, so there is nothing secret in the frontend. If you switch to a provider that needs a key, a key in public JavaScript is visible to everyone; use a serverless proxy to keep it private.

## Deploy on GitHub Pages
1. Create a repository and upload the files (or `git init`, `git add .`, `git commit`, `git push`).
2. Repository **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then Save.
4. Open `https://<username>.github.io/<repo>/` after a minute.

## Test locally
Run `python3 -m http.server` in this folder and open `http://localhost:8000`. Geolocation needs `localhost` or HTTPS.

## Not included
Weather alerts (Open-Meteo has no alerts feed), a light theme, and a hand-drawn asset set. Moon phase is calculated locally from the date.
