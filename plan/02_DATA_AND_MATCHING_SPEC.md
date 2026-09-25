# Data Model & Matching Specification

## 1. Guiding principle

The extension should be **person-centric**.

For each selected KeyFrame person:

1. resolve canonical person identity
2. load that person's complete work history
3. normalize it into an extension-owned domain model
4. intersect normalized records

Do not enumerate every KeyFrame production and scan all credits.

---

## 2. Domain model

Recommended TypeScript shape:

```ts
export type PersonId = string;
export type ProductionId = string;

export interface StaffPerson {
  personId: PersonId;
  displayName: string;
  nativeNames: string[];
  aliases: string[];
  jobs: string[];
  avatarUrl?: string;
  profileUrl: string;
}

export interface ProductionMeta {
  productionId: ProductionId;
  canonicalUrl: string;
  title: string;
  aliases: string[];
  year?: number;
  releaseLabel?: string;   // e.g. WINTER 2026
  format?: string;         // TV, MOVIE, ONA, MUSIC...
  studios: string[];
}

export interface CreditUnit {
  raw: string;             // exact source display, e.g. "#1125 [NC]"
  key: string;             // normalized comparison key, e.g. "episode:1125"
  kind:
    | "episode"
    | "op"
    | "ed"
    | "movie"
    | "mv"
    | "pv"
    | "cm"
    | "special"
    | "overview"
    | "other";
  number?: number;
  suffix?: string;
  flags: string[];         // e.g. ["NC"]
}

export interface CreditEntry {
  category?: string;       // Main Staff, Key Animation, Photography...
  roleJa?: string;
  roleEn?: string;
  rawRole?: string;
  units: CreditUnit[];
  note?: string;
}

export interface PersonProductionCredits {
  personId: PersonId;
  production: ProductionMeta;
  credits: CreditEntry[];
}

export interface PersonHistory {
  person: StaffPerson;
  productions: PersonProductionCredits[];
  fetchedAt: number;
  sourceVersion?: string;
}
```

Keep source-specific raw fields only in the adapter layer unless they are needed for diagnostics.

---

## 3. Identity rules

### Person identity

Primary key:

```text
KeyFrame person ID
```

Never compare people by:

- display name
- romanized name
- native name
- alias text

A person can have several names.

Autocomplete may search across aliases, but selection resolves to one canonical person ID.

### Production identity

Primary key, in order of preference:

1. stable production ID directly exposed by KeyFrame structured data
2. canonical production URL identifier from `/staff/{identifier}`
3. another stable KeyFrame internal identifier verified during endpoint discovery

Never use title as the primary production key.

Titles may be aliases, localized differently, reused, or changed.

If only a URL is available, normalize:

```text
https://keyframe-staff-list.com/staff/foo#03
→ production identity: /staff/foo
```

Strip:
- fragment
- query parameters
- trailing slash differences

Do not discard the original canonical URL used for navigation.

---

## 4. Credit unit normalization

The raw label must always be preserved for display.

The normalized key exists only for comparison.

### Recommended normalizer

Examples:

| Raw | Normalized key |
|---|---|
| `#01` | `episode:1` |
| `#1` | `episode:1` |
| `#001` | `episode:1` |
| `#1125 [NC]` | `episode:1125` |
| `OP` | `op` |
| `OP1` | `op:1` |
| `OP01` | `op:1` |
| `ED` | `ed` |
| `ED2` | `ed:2` |
| `Movie` | `movie` |
| `MV` | `mv` |
| `PV` | `pv` |
| `CM` | `cm` |
| `Special` | `special` |
| `Overview` | `overview` |

Normalize case and harmless surrounding whitespace.

Extract known annotation flags separately when safe.

For an unknown label:

```text
raw: "Pilot A"
key: "other:pilot a"
kind: "other"
```

Use conservative normalization. Do not merge two labels unless equivalence is obvious.

---

## 5. Flags such as NC

If a unit is:

```text
#1125 [NC]
```

store:

```ts
{
  raw: "#1125 [NC]",
  key: "episode:1125",
  kind: "episode",
  number: 1125,
  flags: ["NC"]
}
```

For same-unit matching, the episode identity is `episode:1125`.

The NC flag remains visible in the person's original credit.

Do not erase source meaning.

---

## 6. Combined / repeated credits

A person may appear:

- under multiple categories
- in multiple roles
- multiple times under one role
- on several units for one role

The normalized history must not throw away duplicates before role aggregation is complete.

Recommended final aggregation key:

```text
productionId + category + roleJa + roleEn
```

Merge only exact-equivalent role entries, unioning units while preserving source display order if possible.

Do not merge:
- Animation Director
- Chief Animation Director
- Assistant Animation Director

even if they seem semantically related.

---

## 7. Same Production algorithm

Input:

```ts
PersonHistory[]
```

Precondition:
- at least 2 histories
- all histories loaded successfully

For each history:

```ts
Set<ProductionId>
```

Then:

```ts
commonProductionIds = intersection(allSets)
```

For each common production ID, construct a result containing:

- canonical production metadata
- every selected person
- every credit entry for that person on this production

Pseudocode:

```ts
function findSameProductions(histories: PersonHistory[]) {
  const indexes = histories.map(indexHistoryByProductionId);

  const commonIds = intersectSets(
    indexes.map(index => new Set(index.keys()))
  );

  return [...commonIds].map(productionId => ({
    production: chooseBestProductionMeta(indexes, productionId),
    people: histories.map(history => ({
      person: history.person,
      credits: indexesFor(history).get(productionId)!.credits
    }))
  }));
}
```

---

## 8. Same Episode / Unit algorithm

First find common productions.

For each common production:

1. collect each person's set of **specific unit keys**
2. exclude `overview`
3. intersect the unit sets across every selected person
4. retain the production only if at least one common unit remains

Specific unit set:

```ts
function specificUnitKeys(credits: CreditEntry[]): Set<string> {
  return new Set(
    credits
      .flatMap(c => c.units)
      .filter(u => u.kind !== "overview")
      .map(u => u.key)
  );
}
```

Result:

```ts
{
  production,
  sharedUnitKeys,
  people: [
    {
      person,
      credits: ALL credits on production
    }
  ]
}
```

Important: **all credits remain attached to the result**. `sharedUnitKeys` only explains why it matched.

---

## 9. Why Overview is excluded from specific-unit matching

`Overview` means a production-wide credit record. It does not prove that the source specifically attached the person to every individual numbered episode.

Therefore:

```text
A: Director — Overview
B: Key Animation — #03
```

is:

- Same Production: YES
- Same Episode / Unit: NO, based on strict source semantics

This is intentionally conservative.

A later feature could add an explicitly named “production-wide roles count as every unit” mode, but MVP must not silently make that assumption.

---

## 10. Partial overlaps

### Pairwise overlap

For every pair `(A, B)`:

- Same Production mode:
  - intersect production IDs
  - count matching productions
- Same Episode / Unit mode:
  - perform the strict same-unit algorithm for the two histories
  - count matching productions
  - optionally count total shared units as secondary metadata

Recommended model:

```ts
interface PairOverlap {
  a: StaffPerson;
  b: StaffPerson;
  productionCount: number;
  sharedUnitCount?: number;
  productionIds: ProductionId[];
}
```

### Leave-one-out overlap

For N >= 4:

For each person `p`:
- compute the current mode's full intersection using every history except `p`

This produces at most N near-match groups and is much more useful than enumerating all `2^N` subsets.

Do not generate arbitrary power-set subsets.

---

## 11. Result sorting

Default:

1. year descending when both years known
2. known years before unknown years
3. title locale-insensitive ascending as tie-breaker

Do not sort by number of roles because that can imply significance.

---

## 12. Search model

The adapter should return canonical people.

Recommended interface:

```ts
export interface KeyframeDataSource {
  searchPeople(
    query: string,
    signal?: AbortSignal
  ): Promise<StaffPerson[]>;

  getPersonHistory(
    personId: PersonId,
    options?: {
      signal?: AbortSignal;
      bypassCache?: boolean;
    }
  ): Promise<PersonHistory>;
}
```

Network details must not leak outside the adapter.

---

## 13. Enrichment

If person-history data lacks some production metadata, enrichment may be optional.

Required for matching:
- production ID
- canonical production URL
- display title
- credit roles
- units

Optional:
- year
- format
- studio
- aliases

Do not issue a separate production request for every result just to decorate the UI unless necessary.

Prefer metadata already carried by person-history responses.

---

## 14. Data confidence

If the source adapter had to use a weak fallback identity because no stable production ID/URL was available, mark it internally:

```ts
identityConfidence: "strong" | "weak"
```

Do not silently merge weak records based only on normalized title.

If weak identity cannot be resolved, prefer omitting a questionable match over creating a false one.

---

## 15. Complexity

Let:

- `N` = selected people
- `Pi` = number of productions in person i's history

Same Production is approximately:

```text
O(sum(Pi))
```

after indexing.

Same Unit adds credit/unit indexing inside common productions.

This is small enough to run entirely client-side.

The network layer, not the matching algorithm, is the likely bottleneck.

---

## 16. Suggested pure functions

Keep these independent of React and network code:

```ts
normalizeUnit(raw: string): CreditUnit
normalizeProductionUrl(url: string): string
indexHistoryByProductionId(history: PersonHistory): Map<ProductionId, PersonProductionCredits>
intersectSets<T>(sets: Set<T>[]): Set<T>
findSameProductions(histories: PersonHistory[]): ComparisonResult[]
findSameUnits(histories: PersonHistory[]): ComparisonResult[]
computePairOverlaps(histories: PersonHistory[], mode: ComparisonMode): PairOverlap[]
computeLeaveOneOutOverlaps(histories: PersonHistory[], mode: ComparisonMode): GroupOverlap[]
sortComparisonResults(results: ComparisonResult[]): ComparisonResult[]
```

These functions should have extensive fixture-driven tests.
