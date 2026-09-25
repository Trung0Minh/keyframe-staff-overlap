# Test Plan & Acceptance Criteria

## 1. Testing strategy

Use three levels:

1. pure unit tests
2. adapter tests with saved fixtures
3. browser extension E2E tests

Do not make the normal CI suite depend on the live KeyFrame site.

Live behavior can change independently and would make CI flaky.

---

## 2. Unit tests — unit normalization

Test at minimum:

```text
#01          -> episode:1
#1           -> episode:1
#001         -> episode:1
#1125 [NC]   -> episode:1125 + NC flag
OP           -> op
op           -> op
OP1          -> op:1
OP01         -> op:1
ED           -> ed
ED2          -> ed:2
Movie        -> movie
MV           -> mv
PV           -> pv
CM           -> cm
Special      -> special
Overview     -> overview
```

Unknown values:
- stable normalized `other:*`
- no data loss in `raw`

Whitespace variations must not change obvious identity.

---

## 3. Unit tests — production identity

Test:

- fragment stripped
- query stripped
- trailing slash normalized
- same production URLs resolve to same key
- different `/staff/{id}` values remain different
- two productions with identical titles remain distinct

---

## 4. Unit tests — matching

### Two people

- same production / different unit
- same production / same unit
- no shared production
- multiple shared productions
- multiple shared units

### Three people

- one full intersection
- no full intersection but pair overlaps
- pair intersection must not leak into 3-way result
- unit match requires the unit to be common to all 3

### Four+ people

- full intersection
- no full intersection
- leave-one-out groups
- pair sorting

---

## 5. Unit tests — role fidelity

A single person can have:

```text
Main Staff
  Animation Director — ED
  Storyboard / Unit Director — ED

Key Animation
  Key Animation — #01, #03
```

Normalization/render model must keep all 3 role records.

Test separate roles with similar names are not merged.

Test Japanese and English role labels survive.

---

## 6. Unit tests — Overview semantics

Required cases:

### Overview + numbered episode

```text
A: Director — Overview
B: KA — #03
```

Same Production:
- match

Same Unit:
- no match

### Overview + Overview

Same Production:
- match

Same Unit:
- no match in MVP

This behavior must be explicit and stable.

---

## 7. Adapter fixture tests

Capture sanitized representative responses from the discovered KeyFrame data source.

Fixtures should cover:

- aliases
- Japanese names
- multiple jobs
- multiple years
- multiple productions
- same production with multiple roles
- OP / ED
- numbered episodes
- one-unit work such as Movie/MV
- NC annotation if exposed
- missing optional fields
- unknown unit label

No credentials/cookies in fixtures.

---

## 8. Adapter schema drift tests

Feed malformed fixtures:

- missing person ID
- missing production identity
- missing credits array
- unexpected null
- changed nested object type

Expected:
- deterministic typed error
- no undefined-property crash
- no false empty-result state

---

## 9. Cache tests

Test:

- fresh cache hit avoids network
- expired cache fetches network
- force refresh fetches network
- schema-version mismatch invalidates cache
- failed refresh does not corrupt prior valid cache
- one person's cache is independent of another's

---

## 10. Concurrency/stale-result tests

Scenario:

1. start comparison A+B+C
2. before completion, change to A+B
3. second comparison completes first
4. old request completes later

Expected:
- UI still shows A+B
- A+B+C result cannot overwrite it

Also test close drawer during loading.

---

## 11. Autocomplete tests

Required:

- debounce
- stale query results ignored
- duplicate staff ID cannot be selected twice
- arrow navigation
- Enter select
- Escape close
- empty query state
- Japanese query
- alias query
- network error and Retry

---

## 12. E2E extension tests

Use Playwright with a Chromium persistent context and loaded unpacked extension.

Test on mocked/local fixture pages where possible.

### Core E2E

1. extension trigger appears
2. panel opens
3. select two mocked people
4. compare same production
5. expected production appears
6. switch same unit
7. only strict unit results appear
8. all roles remain visible
9. links have expected KeyFrame URLs

### Empty intersection E2E

1. select 3 people
2. no 3-way result
3. clear main empty message
4. pair overlap section appears
5. pair results are visually secondary

### Navigation E2E

1. load one KeyFrame route
2. extension mounts once
3. simulate SPA route navigation
4. no duplicate trigger/root
5. panel still opens

---

## 13. Manual live-site smoke checklist

Run before release, not necessarily on every CI build.

- search a real person by romanized name
- search a real person by native/Japanese name
- select an alias result
- compare two known collaborators
- manually inspect their KeyFrame person pages
- verify at least 3 displayed credits
- compare 3 people
- test Same Unit
- test a pair with no common work
- refresh data
- navigate home → person → staff page
- confirm no duplicate injected UI
- inspect console for uncaught errors

---

# MVP acceptance criteria

The MVP is accepted only if all of these are true.

## Identity

- [ ] Staff selection resolves to canonical KeyFrame person IDs.
- [ ] Duplicate IDs cannot be selected.
- [ ] Productions are matched by stable KeyFrame identity/URL, not title.

## Search

- [ ] User can type a name and receive autocomplete results from KeyFrame data.
- [ ] Latin and Japanese names work when KeyFrame's source supports them.
- [ ] Alias-backed results resolve to the canonical person record.

## Same Production

- [ ] With 2+ selected staff, results contain only productions present in every selected history.
- [ ] Different episodes still count in this mode.
- [ ] Each result includes all known credits for each selected person.

## Same Episode / Unit

- [ ] Results require at least one exact normalized specific unit common to every selected person.
- [ ] `Overview` is not expanded to every episode.
- [ ] Shared units are shown/highlighted.
- [ ] Non-shared credits on a matched production are still visible.

## Empty results

- [ ] Zero full matches are explicitly reported as zero full matches.
- [ ] Partial overlaps are visually secondary.
- [ ] For 3 people, pair overlaps are available.
- [ ] For 4+ people, UI avoids uncontrolled subset explosion.

## Reliability

- [ ] A failed person-history fetch prevents a misleading “no matches” answer.
- [ ] Cache has expiry and manual refresh.
- [ ] Obsolete comparison requests cannot overwrite current state.
- [ ] KeyFrame schema parsing errors are handled explicitly.

## Integration

- [ ] UI runs directly on KeyFrame Staff List.
- [ ] UI survives tested route changes.
- [ ] Extension does not break KeyFrame styling or interaction.
- [ ] Extension uses minimal browser permissions.

## Safety / maintenance

- [ ] No whole-site crawler.
- [ ] No credential collection.
- [ ] No private/access-controlled endpoint bypass.
- [ ] KeyFrame data-source details are isolated behind an adapter.
- [ ] `docs/DATA_SOURCE_NOTES.md` exists.
