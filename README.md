# KeyFrame Staff Overlap

An unofficial Chromium extension for comparing public staff credits from [KeyFrame Staff List](https://keyframe-staff-list.com/).

## What it does

- Search staff by name or alias from any KeyFrame page.
- Compare two or more staff members in one centered view.
- Keep each staff member in a parallel column for every episode or unit.
- Put episodes shared by everyone first and group roles within each episode.
- Preserve source notes, attribution, and NC flags.
- Cache public histories locally and refresh them on demand.

## Download

The current packaged build is available on the [GitHub Releases page](https://github.com/Trung0Minh/keyframe-staff-overlap/releases).

For version 0.1.7, download [keyframe-staff-overlap-0.1.7.zip](https://github.com/Trung0Minh/keyframe-staff-overlap/releases/download/initial-0.1.7/keyframe-staff-overlap-0.1.7.zip).

## Install locally

1. Download and extract the ZIP.
2. Open `chrome://extensions` in Chrome or another Chromium browser.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the extracted folder.
5. Open a KeyFrame page and use **Compare Staff**.

The Chrome Web Store release is not published yet. Store publishing is wired to GitHub Actions and is documented in [`docs/CHROME_WEB_STORE_RELEASE.md`](docs/CHROME_WEB_STORE_RELEASE.md).

## Development

Requirements: Node.js 24+ and Python 3 for packaging.

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run package
```

The package command writes the unpacked extension to `dist/` and the ZIP to `artifacts/`.

Run the browser tests with Playwright:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run test:e2e
```

## Releases

Push a tag matching the versions in `manifest.json`, `package.json`, and `package-lock.json`:

```sh
git tag v0.1.8
git push origin v0.1.8
```

GitHub Actions runs the checks, builds the ZIP, creates a GitHub Release, and publishes the update to the Chrome Web Store after its repository secrets are configured.

## Privacy

- The extension requests only the `storage` permission.
- Content scripts run only on `keyframe-staff-list.com`.
- It stores selected staff and cached public histories in extension-local storage.
- It has no backend, analytics, credential collection, or remote executable code.

See [`docs/DATA_SOURCE_NOTES.md`](docs/DATA_SOURCE_NOTES.md) for data-source details.
