# Lumen Mobile App

Lumen is a mobile-first daily planning app with:

- task tracking with priorities
- a built-in focus timer
- local journal notes
- offline-friendly caching via service worker

## Run it

Serve this folder with any static web server and open it in a mobile browser.

Example:

```bash
python -m http.server 4173
```

Then visit `http://localhost:4173`.

## Notes

- Data is stored locally in the browser with `localStorage`.
- The app is designed to be wrapped later into a native shell if you want a true app store build.