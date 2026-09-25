# Product & UX Specification

## 1. Product goal

The extension answers a simple question:

> “Where have these staff members worked together, and what exactly did each of them do there?”

The user should be able to answer that question in a few seconds without manually opening multiple KeyFrame person pages and cross-checking them.

The product must prioritize **correct identity matching** and **credit fidelity** over flashy presentation.

---

## 2. Entry point on KeyFrame

Add a persistent entry point visible on KeyFrame pages.

Preferred order:

1. Add a small **Compare Staff** action to an existing stable navigation/sidebar region if there is a safe mount point.
2. If modifying that region is too brittle, use a compact floating button anchored to the viewport.
3. Clicking the action opens a right-side drawer/panel.

Do not permanently occupy a large amount of screen space.

The extension must survive KeyFrame client-side navigation. If KeyFrame behaves as an SPA, remount or preserve the extension UI after route changes.

---

## 3. Main interaction flow

### Initial state

Panel shows:

- title: `Compare Staff`
- autocomplete input
- selected-staff chip area
- mode selector:
  - `Same Production` — default
  - `Same Episode / Unit`
- `Compare` button disabled until at least 2 unique people are selected

Optional microcopy:

> Select two or more staff members to find where they worked together.

### Selecting staff

The user types a name.

Autocomplete should search KeyFrame staff and display approximately 8–10 results.

Each suggestion should use available disambiguating information:

- primary/display name
- native name
- aliases if useful
- avatar if readily available
- jobs/roles if readily available

Example:

```text
Moaang
もああん · Animation Director, Storyboarder, Key Animator
```

The selected value must become a structured object containing at minimum:

```ts
{
  personId: string;
  displayName: string;
  profileUrl: string;
}
```

Never retain only the search string.

### Autocomplete behavior

Required:

- debounce requests, recommended 200–300 ms
- cancel/ignore stale requests
- support keyboard navigation
- Enter selects highlighted result
- Escape closes menu
- do not allow the same `personId` twice
- allow Japanese and Latin-script names
- aliases should resolve to the canonical person record if KeyFrame exposes that mapping
- search may begin at 1 character because Japanese names can be short
- show a loading state
- show a small recoverable error state if search fails

Do not silently convert arbitrary unmatched text into a staff member.

### Selected staff chips

Each selected person appears as a removable chip.

Example:

```text
[Moaang ×] [Kay Yu ×] [Yuuichi Oka ×]
```

A chip may show avatar if that can be done without clutter.

Selection order has no semantic meaning.

---

## 4. Comparison modes

### 4.1 Same Production

A production matches only if **every selected person** has at least one credit attached to the same canonical KeyFrame production ID.

Do not match by title text.

A match does not require the staff to share an episode.

Example:

- A: Key Animation #03
- B: Animation Director #08
- C: Storyboard #11

All three count as a Same Production match.

### 4.2 Same Episode / Unit

A production matches only if **every selected person** has at least one credit on at least one identical normalized unit in that production.

Examples of specific units:

- `#01`
- `#12`
- `OP`
- `OP1`
- `ED`
- `ED2`
- `Movie`
- `MV`
- `PV`
- `CM`
- `Special`

`Overview` is production-wide metadata and must **not** be interpreted as if it occurred on every episode.

For MVP, `Overview` does not qualify as a specific same-episode/unit match.

If every person has `Overview`, that remains a Same Production match but not a Same Episode / Unit match.

Do not infer that:

- `OP` equals `OP1`
- `ED` equals `ED1`
- `#1` and `#01` are different after numeric normalization
- an `Overview` credit covers all numbered episodes

See the data spec for canonicalization rules.

---

## 5. Results layout

At the top:

```text
3 staff selected
7 common productions
Mode: Same Production
```

Default sort:

1. newest release/year first when known
2. then production title

Allow a minimal sort selector later if easy, but it is not required for MVP.

Each production should be a card or section.

### Production header

Show as available:

- production title
- aliases only when useful
- release year/season
- format
- studio
- link to KeyFrame production page

Do not block rendering if metadata beyond ID/title is unavailable.

### Staff credit rows

For each selected staff member, show all of that person's known credits for the production.

Example:

```text
Sayonara Lara — 2026
Kinema Citrus

Moaang
  Main Staff
    Animation Director — ED
    Storyboard / Unit Director — ED
  Key Animation
    Key Animation — #01, #03

Person B
  Main Staff
    Episode Director — #03
  Key Animation
    Key Animation — #07
```

The extension must preserve:

- multiple categories
- multiple roles in one category
- multiple unit labels for a role
- Japanese role text where the source exposes it
- English role text where the source exposes it
- flags such as non-credit markers if available

Do not collapse multiple roles into a vague label such as `Animator`.

### Same Episode / Unit highlighting

When in Same Episode / Unit mode:

- show the common matched unit(s) near the production header, e.g.:
  `Shared unit: #03`
- still display **all credits** for every selected person
- visually highlight the specific units responsible for the match

Example:

```text
Shared units: #03, OP
```

This lets the user distinguish:
- the actual overlap
- other work each person did on the same production

---

## 6. Empty full-intersection state

If all selected staff have no match in the current mode:

```text
No common productions found for all 3 selected staff.
```

Do not change the main interpretation to “some of them matched.”

Below it, show a secondary section:

```text
Partial overlaps
```

### For 3 selected people

Show every non-empty pairwise overlap:

```text
Moaang + Kay Yu — 4 shared productions
Kay Yu + Yuuichi Oka — 1 shared production
Moaang + Yuuichi Oka — none
```

Zero-count rows can be shown when there are only 3 people because the matrix is still easy to understand.

### For 4+ selected people

Avoid combinatorial spam.

Use this priority:

1. Compute **leave-one-out near matches**:
   - for N people, test each subset of size N-1
   - show non-empty subsets first
2. Compute pairwise overlaps for all pairs
3. Sort pairwise items by overlap count descending
4. Show the first 10 non-empty pairwise items
5. Add `Show all pair overlaps` if more remain

If there are no non-empty pairwise overlaps, say so.

The partial-overlap calculation must respect the current mode:
- Same Production partial overlap uses shared productions
- Same Episode / Unit partial overlap uses shared specific units

---

## 7. Loading behavior

Comparison may require multiple person-history requests.

Show progress rather than an indefinite spinner.

Example:

```text
Loading staff histories…
2 of 4 loaded
```

Do not issue all requests at unlimited concurrency.

Recommended network concurrency: 3–4.

The UI should remain cancelable by:
- changing selected staff
- closing the panel
- starting a new comparison

A stale previous comparison must never overwrite a newer one.

---

## 8. Error behavior

Differentiate:

### Search error

> Could not search KeyFrame staff. Retry.

### One staff history failed

If 1 of N histories fails, do not return a potentially false intersection.

Show:

> Could not load data for Kay Yu. The comparison was not completed.

Provide:
- Retry
- refresh individual staff data if possible

### Schema/data-source mismatch

If parsing fails because KeyFrame changed its data shape:

> KeyFrame's data format may have changed. This version of the extension could not read the staff history.

Log technical details only to the developer console, not the user UI.

### No history

A real empty work history is not an error.

---

## 9. Refresh and cache UX

Use cache transparently.

Add a small `Refresh` action after results are loaded.

Refresh means:

- bypass person-history cache for the selected staff
- fetch fresh records
- recompute results
- update cache

Do not require users to understand TTLs.

---

## 10. Links

Every person and production link should open the canonical KeyFrame page.

Links should stay on `https://keyframe-staff-list.com/`.

Do not fabricate external links from names.

---

## 11. Accessibility

Minimum requirements:

- all controls keyboard accessible
- autocomplete follows combobox/listbox semantics where practical
- visible focus states
- buttons have accessible names
- drawer can be closed with Escape
- focus returns to the Compare Staff trigger after closing
- color must not be the only indicator for shared units
- loading status uses an appropriate live region
- avoid tiny click targets

---

## 12. Responsive behavior

The extension is desktop-first but should not break on narrower viewports.

Suggested drawer:

- desktop width: ~420–520 px
- max width: 100vw
- scroll internal results, not the entire page unexpectedly

On narrow screens, the drawer can become a full-width overlay.

---

## 13. Nice-to-have after MVP

Only after acceptance criteria are met:

- persistent recent comparisons
- copy/share comparison URL encoded with person IDs
- filter results by role/category
- sort by number of shared units
- “only show matching units” view toggle
- export results to Markdown/JSON
- collaboration graph
- mutual collaborators
