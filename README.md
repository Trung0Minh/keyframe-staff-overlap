# KeyFrame Staff Overlap

An unofficial browser extension for comparing public staff credits on KeyFrame
Staff List. Chromium / Manifest V3, version 0.1.7 preview.

## Preview scope

The extension supports 2+ selected people, one unified comparison view, all credited
roles and units, NC flags, notes, partial overlaps, progress, cancellation,
24-hour caching, and refresh. It saves your selection locally as you browse.

Comparison opens in a wide, centered window. Each production displays the
selected staff's credits in parallel columns, in selection order. On smaller
screens or with larger groups, scroll the columns sideways; keyboard users
can focus the credit area and use the arrow keys.

**Search works across KeyFrame from any page.** Enter at least two characters
of a Latin or Japanese name or alias. Suggestions use KeyFrame's native public
autocomplete and retain canonical profile identity, including name-based profiles.
Broad queries show up to ten suggestions; type more of the name to narrow them.

## Install the built extension

1. Open Chrome's Extensions page (`chrome://extensions`).
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this project's `dist` directory.
4. Reload an open KeyFrame page. Select **Compare Staff** at the lower left.

The ZIP in `artifacts/keyframe-staff-overlap-0.1.7.zip` contains the same build.
Extract it first and load the extracted folder through **Load unpacked**.
After rebuilding, use **Reload** on the extension card and reload the site tab.

## Use

Select two or more people and choose **Compare**. Results show productions
credited to everyone, with one row per episode/unit and one column per person.
Each cell contains that person's roles for that episode, without repeating the
episode label for each role. Repeated entries of the same role are grouped while
retaining their source notes and attribution under **Credit details**.

Rows shared by everyone appear first with a subtle purple highlight. Rows shared by a subset come next, then individual units.
Overview and unspecified-unit credits appear last; Overview never implies an
episode match. OP and OP1 remain distinct. Empty cells say **No credit listed**.
There is no mode switch and no credit filter. If there is no production common
to everyone, partial groups are shown separately.

**Refresh** reloads the selected histories. Failed histories prevent results;
they never appear as an empty collaboration list. Close, cancel, selection
changes discard obsolete requests. Escape first dismisses
open suggestions, then closes the panel and returns focus to its trigger.

## Development

Requires Node.js 24+ and npm. Python 3 is needed only for ZIP packaging.

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run package
```

TypeScript is the only build dependency. The UI uses native DOM elements and a
Shadow DOM; the centered window uses the browser's modal dialog for focus handling.
Native browser features keep the build small without additional UI packages. No service worker or backend is included.

### Automated releases

The repository includes GitHub Actions for pull request/main quality checks and
tagged releases. To publish a version, update the version in `manifest.json`,
`package.json`, and `package-lock.json`, then push a matching tag:

```sh
git tag v0.1.8
git push origin v0.1.8
```

The release workflow tests, packages, creates a GitHub Release, and uploads the
same ZIP to the Chrome Web Store. Add these repository secrets before using it:
`CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, and
`CHROME_REFRESH_TOKEN`. The Chrome Web Store must already contain the extension.
Users receive published updates through Chrome's normal extension update cycle;
commits alone do not publish or update an installed extension.

### Browser tests

`tests/e2e.mjs` loads the actual unpacked extension with an isolated profile
and a temporary manifest that matches a localhost fixture. All KeyFrame API
responses are mocked and unexpected external requests are blocked. The
production manifest remains limited to KeyFrame.

With Playwright and its Chromium installed:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run build
npm run test:e2e
```

Alternatively set `PLAYWRIGHT_MODULE` to the absolute path of an existing
Playwright package's `index.js`. Screenshots go to `test-results/`.

The script covers selection, Japanese/alias queries, episode rows, shared-first ordering, role grouping,
partial overlaps, caching, refresh, failure recovery, cancellation,
Escape/focus, page navigation, saved selections, and a narrow viewport.
The suite passed on a page with no staff links. Live extension search was also
verified on home, person and staff-list pages, followed by a real two-person
comparison. Desktop and mobile screenshots were inspected.

Browser verification passes for the centered window and parallel columns,
including three/five-person layouts, keyboard horizontal scrolling, and backdrop
dismissal. Version 0.1.7 checks unique episode rows, grouped roles, shared-first ordering,
empty cells, and retained NC flags and notes.

## Privacy and permissions

- Only the `storage` permission is requested. Content scripts match KeyFrame only.
- Histories are requested only for selected people, with at most four in flight.
- No catalog crawling, analytics, credential collection, or remote executable code.
- Selected names/IDs and cached public histories are kept in extension-local
  storage. Removing the extension removes that storage.
- Ordinary same-origin page requests may send site cookies through the browser;
  the extension does not read or store those cookies.
- Data-source details and outstanding verification are in `docs/DATA_SOURCE_NOTES.md`.

## Remaining work for the full MVP

- Verify several real profiles, history completeness, aliases, and pagination.
- Inspect a Download JSON sample and validate role/unit semantics against it.
- Record server cache/rate-limit headers and verify broader live-site acceptance cases.
