# Implementation Plan

## Phase 0 — Reverse-engineer the public KeyFrame data flow

This phase is mandatory.

Do not write production parsing code before this is complete.

### Tasks

1. Open KeyFrame in a normal browser with DevTools Network.
2. Use any existing staff/person search UI or person-linking UI on KeyFrame.
3. Search several names:
   - Latin-script name
   - Japanese name
   - person with aliases
4. Identify the request that returns candidate people.
5. Record:
   - request URL
   - method
   - query/body
   - response shape
   - canonical person ID
   - aliases/native names
   - pagination behavior
6. Open several person profiles.
7. Identify how profile history arrives:
   - API request
   - route loader
   - embedded hydration state
   - server-rendered payload
   - other
8. Verify the source exposes a stable production identity or production URL.
9. Trigger a Staff List `Download` and inspect the exported JSON/schema.
10. Determine whether Download JSON is useful only for validation/enrichment or needed as a fallback.
11. Check whether GET requests require authentication.
12. Check CORS/request behavior from a minimal extension content script.
13. Document findings in `docs/DATA_SOURCE_NOTES.md`.

### Test profiles

Use at least:
- a person with multiple aliases
- a person with several roles in one production
- a person with OP/ED credits
- a person with numbered episode credits
- a person with `[NC]`-like annotations if available

### Exit criteria

Do not proceed until you can answer:

- What stable field is the person ID?
- How does autocomplete resolve a person?
- What stable field/URL identifies a production?
- How are category, role, and unit represented?
- How can a complete person history be fetched with minimal requests?
- Is a service worker required for network access?

If no structured public frontend source is usable, implement a documented fallback rather than guessing an endpoint.

---

## Phase 1 — Extension scaffold

### Tasks

- create Manifest V3 project
- configure TypeScript
- configure React
- configure Vite
- add content script for `https://keyframe-staff-list.com/*`
- add `storage` permission
- add only required host permission(s)
- create Shadow DOM root
- render placeholder `Compare Staff` button and empty panel
- verify panel works on:
  - home page
  - person page
  - staff page
- verify it survives SPA navigation

### Exit criteria

- unpacked extension loads without warnings
- no console errors on KeyFrame
- open/close behavior works
- page styling is not broken
- extension styling is not affected by common KeyFrame CSS

---

## Phase 2 — Domain model and pure matching engine

Do this before connecting real network data.

### Tasks

Implement:

- domain types
- unit normalizer
- production URL/ID normalizer
- history indexer
- set intersection helper
- Same Production engine
- Same Episode / Unit engine
- pairwise overlaps
- leave-one-out overlaps
- sorting

Create realistic fixtures modeled after KeyFrame structures.

### Mandatory fixture cases

#### Case A — Same production, different episodes

```text
A: Show X — KA #01
B: Show X — AD #02
```

Expected:
- Same Production: X
- Same Unit: none

#### Case B — Same exact episode

```text
A: Show X — KA #03
B: Show X — AD #03
```

Expected:
- both modes: X
- shared unit: episode:3

#### Case C — Overview does not imply episode

```text
A: Show X — Director Overview
B: Show X — KA #03
```

Expected:
- production match
- no unit match

#### Case D — all-person intersection

```text
A: X, Y
B: X, Z
C: X, Q
```

Expected:
- X only

#### Case E — no 3-way but pair overlap

```text
A: X
B: X, Y
C: Y
```

Expected:
- 3-way: none
- A+B: X
- B+C: Y

#### Case F — same title, different production IDs

Expected:
- never merge

### Exit criteria

Domain tests pass without any KeyFrame network code.

---

## Phase 3 — KeyFrame data adapter

### Tasks

Implement `KeyframeDataSource`.

#### Search

`searchPeople(query)` must:

- call verified source
- convert source records to `StaffPerson`
- preserve canonical person ID
- preserve names useful for disambiguation
- return no duplicate IDs
- support `AbortSignal`

#### History

`getPersonHistory(personId)` must:

- fetch verified public person-history source
- normalize into `PersonHistory`
- preserve all credits
- preserve raw unit text
- normalize unit comparison keys
- normalize production identity
- handle missing optional metadata
- throw typed schema errors on unexpected required structure

### Schema validation

Do not blindly dereference nested properties.

Use explicit validation/type guards.

A malformed one-production record should either:
- be safely skipped with a diagnostic if identity is impossible
- or fail the history if skipping could create a false comparison

Bias toward correctness.

### Exit criteria

Using real KeyFrame data, log a normalized history for several test people and manually compare a sample against their visible profile pages.

---

## Phase 4 — Cache and request pool

### Tasks

- storage cache with schema version
- 24h TTL constant
- force-refresh path
- limited history concurrency, default 4
- AbortController per comparison run
- stale-run protection

Suggested compare orchestration:

```ts
const runId = ++currentRunId;
setLoading();

const histories = await loadWithPool(selectedPeople, 4, signal, progress => {
  if (runId === currentRunId) updateProgress(progress);
});

if (runId !== currentRunId) return;

const results = compare(histories, mode);
commit(results);
```

### Exit criteria

- repeat comparison reuses cached histories
- refresh bypasses cache
- closing/re-running cannot commit stale results

---

## Phase 5 — Staff autocomplete UI

### Tasks

- debounced text input
- async results
- keyboard navigation
- loading/error/empty state
- selected chips
- duplicate prevention
- min 2 people validation

Visual data should help distinguish duplicate/similar names.

### Exit criteria

Can reliably select:
- Latin name
- Japanese name
- person found through alias

and the chip always maps to the correct person ID.

---

## Phase 6 — Main comparison UI

### Tasks

- mode selector
- Compare button
- loading progress
- result count
- result cards
- production links
- person links
- grouped category/role display
- unit display
- same-unit highlight
- refresh action

### Rendering rule

Even in Same Unit mode, render every known role/unit of each selected person on the matched production.

The shared unit highlight is additive; it must not filter away unrelated credits.

### Exit criteria

Manual tests against visible KeyFrame profile histories agree with the extension.

---

## Phase 7 — Empty state and partial overlaps

### Tasks

When all-person result is empty:

- clear main empty message
- N=3: pair matrix/list
- N>=4:
  - leave-one-out non-empty groups
  - top non-empty pairs
  - expandable remainder

Each pair/group item should optionally expand to show production names.

Do not overwhelm the initial view.

### Exit criteria

The user can tell the difference between:

```text
No result for everyone
```

and:

```text
Some subset has worked together
```

without mistaking the subset for the requested full match.

---

## Phase 8 — Robustness and polish

### Tasks

- handle network failures
- typed schema change error
- focus handling
- Escape close
- responsive drawer
- no CSS leaks
- route-change tests
- optional dark theme adaptation
- production build removes noisy debug logs

Also verify no accidental broad crawling occurs.

---

## Phase 9 — Automated tests

Complete the test suite in `05_TEST_AND_ACCEPTANCE.md`.

CI should not depend on live KeyFrame for every test.

Use fixtures/mock adapter.

Allow one optional live smoke test that is manually invoked.

---

## Phase 10 — Release preparation

### Tasks

- extension icon/name
- short description
- permission review
- README install instructions
- build command
- unpacked-install instructions
- known limitations
- data-source maintenance notes
- package build artifact

Suggested working name:

```text
KeyFrame Staff Overlap
```

Alternative:

```text
KeyFrame Staff Compare
```

Do not imply official affiliation unless permission exists.

Use wording such as:

> An unofficial browser extension for comparing public staff credits on KeyFrame Staff List.

---

# Implementation constraints for the coding agent

## Do

- use person IDs
- use production IDs/canonical production URLs
- keep raw credit labels for display
- isolate site-specific parsing
- cache responsibly
- throttle network calls
- make schema failure visible
- test aliases and duplicate titles
- preserve all credits

## Do not

- intersect display names
- intersect production titles
- assume Overview means every episode
- crawl the complete KeyFrame database
- hard-code an endpoint before inspecting it
- bypass authentication or access restrictions
- add broad extension permissions “just in case”
- use unsafe HTML rendering
- silently return partial data as if it were complete
