# Extension Architecture

## 1. Target

MVP target:

- Chromium browsers
- Manifest V3
- `https://keyframe-staff-list.com/*`

Firefox support can be considered after the Chromium build is stable.

---

## 2. Architecture overview

```text
KeyFrame page
   │
   ├─ Content Script
   │    ├─ Mount detector / SPA route observer
   │    ├─ Shadow DOM host
   │    └─ React UI
   │         ├─ Autocomplete
   │         ├─ Selected chips
   │         ├─ Compare controls
   │         └─ Results
   │
   ├─ Domain layer
   │    ├─ Unit normalizer
   │    ├─ Production identity normalizer
   │    ├─ Intersection engine
   │    └─ Partial-overlap engine
   │
   ├─ Data layer
   │    ├─ KeyframeDataSource interface
   │    ├─ Structured endpoint adapter (preferred)
   │    ├─ Fallback adapter if necessary
   │    └─ cache
   │
   └─ Optional background service worker
        └─ only if required for request permissions / cross-origin endpoint
```

Do not introduce a backend server for MVP.

---

## 3. Manifest permissions

Start with the least permissions possible.

Expected:

```json
{
  "permissions": ["storage"],
  "host_permissions": [
    "https://keyframe-staff-list.com/*"
  ]
}
```

Only add additional host permissions if endpoint discovery proves KeyFrame uses another official API origin required for public page data.

Avoid permissions such as:

- `tabs`
- `history`
- `webRequest`
- `<all_urls>`

unless a concrete requirement appears.

Document every added permission.

---

## 4. Content script

Responsibilities:

- detect KeyFrame page availability
- mount the extension trigger
- open/close panel
- preserve/remount on SPA navigation
- contain the React root
- own comparison UI lifecycle

Do not put matching logic directly into UI components.

### SPA handling

First determine how KeyFrame navigation works.

Possible techniques, in order:

1. stable root survives route changes — mount once
2. observe a stable root with `MutationObserver`
3. detect `popstate`
4. patch/history-listen only if necessary

Avoid a MutationObserver that watches the whole document subtree and performs expensive work on every mutation.

Mount must be idempotent:

```ts
if (document.querySelector("[data-kf-overlap-root]")) return;
```

---

## 5. Shadow DOM

Strongly recommended.

Create an extension host:

```html
<div data-kf-overlap-root></div>
```

Attach a shadow root and render inside it.

Benefits:

- KeyFrame styles do not break extension components
- extension styles do not leak into KeyFrame
- fewer selector collisions
- easier maintenance

Use CSS custom properties for the extension's own theme.

If desired, infer light/dark mode from page/system without depending on fragile internal KeyFrame class names.

---

## 6. React state

Keep state simple.

Suggested high-level state:

```ts
interface CompareState {
  selectedPeople: StaffPerson[];
  mode: "production" | "unit";
  status: "idle" | "loading" | "success" | "error";
  loadedCount: number;
  totalCount: number;
  results: ComparisonResult[];
  partialOverlaps: PartialOverlapResult | null;
  error: CompareError | null;
}
```

Autocomplete has separate request state and AbortController.

Do not store duplicated derived state when it can be computed.

---

## 7. Data source isolation

Required interface:

```ts
export interface KeyframeDataSource {
  searchPeople(query: string, signal?: AbortSignal): Promise<StaffPerson[]>;
  getPersonHistory(
    personId: string,
    opts?: { signal?: AbortSignal; forceRefresh?: boolean }
  ): Promise<PersonHistory>;
}
```

Implementation candidates:

```text
StructuredKeyframeApiDataSource   <- preferred
EmbeddedStateDataSource           <- possible if site embeds route data
DomParsingDataSource              <- fallback only
```

UI imports only the interface/factory.

---

## 8. Preferred network strategy

During discovery, inspect the requests KeyFrame itself makes for:

- person autocomplete/search
- person profile history
- staff list pages
- staff-list JSON Download action

Prefer an endpoint if it is:

- used by the public KeyFrame frontend
- readable without bypassing access controls
- sufficiently structured
- stable enough to normalize
- low-request for this use case

Do not assume endpoint names in advance.

### Request location

If the endpoint is same-origin and works cleanly from the content script, use it there.

If a required official endpoint lives on a different origin and extension host permissions are required, proxy the fetch through the Manifest V3 service worker.

Do not inject arbitrary page scripts merely to evade browser security boundaries.

---

## 9. Why person history is primary

To compare N selected people, person history gives approximately N history fetches.

A production-centric approach would require discovering potentially thousands of productions.

Therefore primary flow should be:

```text
autocomplete → person IDs
person IDs → N histories
N histories → local intersection
```

The staff-list JSON Download feature may still help:

- understand KeyFrame's canonical schema
- validate role/unit semantics
- enrich a production on demand if required

It should not become an excuse to crawl every staff list.

---

## 10. Cache

Use `chrome.storage.local`.

Recommended keys:

```text
cacheVersion
personHistory:{personId}
```

Record:

```ts
interface CachedPersonHistory {
  schemaVersion: number;
  fetchedAt: number;
  value: PersonHistory;
}
```

Suggested default TTL:

```text
24 hours
```

Reason:
- KeyFrame is actively updated
- person histories are large enough to benefit from caching
- a day is short enough not to feel permanently stale

Implement TTL as a constant.

Add manual force refresh.

### Search cache

Autocomplete can use a tiny in-memory LRU during the current page session.

No need to persist every search query.

---

## 11. Request scheduling

Use limited concurrency for history requests.

Recommended:

```text
MAX_CONCURRENT_HISTORY_FETCHES = 4
```

Use a queue/pool.

Every compare run gets an operation token or AbortController.

When the user:
- changes selection
- changes mode and re-runs
- starts refresh
- closes the drawer

either abort obsolete requests or ensure their results cannot commit to current UI state.

---

## 12. Security

Rules:

- no `eval`
- no remotely loaded executable code
- never use raw remote HTML via `dangerouslySetInnerHTML`
- render names/roles with text nodes/React escaping
- validate production/person links before rendering
- only allow KeyFrame origin for KeyFrame navigation links
- do not store cookies, credentials, or account secrets
- do not log full response bodies by default in production builds

If source HTML must be parsed, use `DOMParser` and explicit selectors; still render extracted values as text.

---

## 13. Failure isolation

Adapter should convert source failures into typed errors:

```ts
type DataSourceErrorCode =
  | "NETWORK"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "SCHEMA_CHANGED"
  | "PARSE_FAILED"
  | "ABORTED";
```

The UI should not inspect arbitrary fetch exceptions.

---

## 14. Suggested repository layout

```text
/
├─ manifest.json
├─ package.json
├─ vite.config.ts
├─ src/
│  ├─ background/
│  │  └─ service-worker.ts
│  ├─ content/
│  │  ├─ index.tsx
│  │  ├─ mount.ts
│  │  └─ navigation-observer.ts
│  ├─ ui/
│  │  ├─ ComparePanel.tsx
│  │  ├─ StaffAutocomplete.tsx
│  │  ├─ SelectedStaff.tsx
│  │  ├─ ModeSelector.tsx
│  │  ├─ ResultsList.tsx
│  │  ├─ ProductionResultCard.tsx
│  │  ├─ PersonCredits.tsx
│  │  ├─ PartialOverlaps.tsx
│  │  └─ styles.css
│  ├─ domain/
│  │  ├─ types.ts
│  │  ├─ normalize-unit.ts
│  │  ├─ normalize-production.ts
│  │  ├─ match-productions.ts
│  │  ├─ match-units.ts
│  │  ├─ partial-overlap.ts
│  │  └─ sorting.ts
│  ├─ data/
│  │  ├─ KeyframeDataSource.ts
│  │  ├─ StructuredKeyframeDataSource.ts
│  │  ├─ cache.ts
│  │  ├─ request-pool.ts
│  │  └─ source-normalizers/
│  └─ shared/
│     ├─ errors.ts
│     └─ constants.ts
├─ tests/
│  ├─ fixtures/
│  ├─ unit/
│  └─ e2e/
└─ docs/
   └─ DATA_SOURCE_NOTES.md
```

Do not create a background folder/service worker if discovery proves it is unnecessary; keep the architecture minimal.

---

## 15. Data-source notes are a required artifact

Before the adapter is considered complete, create:

```text
docs/DATA_SOURCE_NOTES.md
```

Include:

- date inspected
- search request source
- person-history request source
- production identity field
- person identity field
- unit/role schema
- whether auth/cookies are required
- observed cache headers
- observed rate-limit behavior if any
- fallback plan
- known assumptions

Do not commit real account credentials or cookies.

---

## 16. Telemetry

MVP should have **no remote analytics**.

If debugging is needed, use local console logging behind a development flag.

This extension does not need to collect user behavior.
