# Lumen Flow

This app is ready for GitHub Pages because it uses relative file paths.

## Upload to GitHub

1. Create a new GitHub repository.
2. Upload the contents of this folder to the root of that repository.
3. Make sure `index.html` stays in the repo root.

## Enable GitHub Pages

1. Open the repository on GitHub.
2. Go to `Settings`.
3. Open `Pages`.
4. Under `Build and deployment`, choose `Deploy from a branch`.
5. Select the `main` branch.
6. Select the `/ (root)` folder.
7. Save.

GitHub will publish the app at a URL like:

`https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/`

## Important notes

- If you upload only the zip file, GitHub Pages will not run the app.
- Upload the extracted files, not just `lumen-mobile-app.zip`.
- GPS features require browser location permission.
- The route view is a lightweight local SVG tracker, not full Strava map matching.

## Files to upload

- `index.html`
- `app.js`
- `styles.css`
- `manifest.json`
- `service-worker.js`
- `.nojekyll`