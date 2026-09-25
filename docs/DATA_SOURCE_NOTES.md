# KeyFrame Data Source Notes

Inspected: 2026-09-19. Version 0.1.1 adds verified site-wide autocomplete.

## Verified observations

The public home page linked to `/person/119806` (Kiyotaka Oshiyama).
The loaded `PersonView-59b6bb93.js` frontend asset contained a GET request to:

```text
/api/person/show.php?id={personId}&type=person
```

Fetching that observed URL for `119806` in the site browser returned JSON with
top-level `staff`, `jobs`, `studios`, and `credits` fields.

### Identity and profile

- `staff.id`: numeric person ID, converted to a string in the domain.
- `staff.en`, `staff.ja`: English and Japanese names.
- `staff.aliases[]`: English alias and `jaAliases[]` entries containing `ja`.
- `jobs[]`: job strings.
- Production identity: `credits[].uuid`, not the title or slug.
- Production link: `/staff/{credits[].slug}`.
- Optional title/metadata: `stafflist_name`, `stafflist_name_ja`,
  `stafflist_studios`, `seasonYear`.

### Credits

```text
credits[]
  names[] (en, ja)
    categories[] (category)
      roles[] (role_en, role_ja)
        credits[] (episode, is_nc, comment, studio, is_primary_alias)
```

The sample included multiple roles, aliases, numbered units, Overview, Movie,
MV and comments. The public rendering code displays `is_nc` as `[NC]` and uses
`is_primary_alias` for alias attribution. Preserve the exact `episode` string;
NC, comment, studio and alias metadata are retained separately per unit.

One payload contained a large history without explicit pagination fields.
Completeness across profiles has **not** been established. Do not claim it has
been verified solely because this response parses successfully.

## Global autocomplete

The live `index-4f882d68.js` asset uses this public endpoint:

```text
/api/search/?q={encodedQuery}&type=staff
```

The response has `staff[]` and `stafflists[]`. Staff records contain
`anilist_id`, `en`, `ja`, `main_en`, `main_ja`, `is_studio`, and `jobs[]`.
The extension filters studios, deduplicates by profile identity, displays the
primary name, and retains matched aliases and jobs for disambiguation.
Numeric `anilist_id` is the person ID, not a credit-row ID.

People with no numeric ID use the site's native `ja:{name}` or `en:{name}`
identity and profile path. This was verified with `en:HIRO` and `ja:ヒロ`;
their history responses contain `staff.id: null`. Name-based responses must
match the requested name before being accepted. Selection and history cache
validation support both kinds of identity.

Queries require two characters and debounce for 250 ms. Superseded searches
are cancelled and stale responses ignored. Broad native queries returned 50
suggestions, with no pagination metadata; the panel shows up to ten unselected
people. Narrow the query to find a particular person. This is autocomplete,
not an exhaustive directory download. No page scanning or catalog crawling is used.

Live Latin, Japanese and empty searches were checked. The separate full search
endpoint `/api/data/search.php` returns credit rows and is not used for autocomplete.

## Extension network path

Search and history requests run in the content script with
`credentials: same-origin`. The installed unpacked extension successfully
searched on `/`, `/person/119806`, and `/staff/sayonara-lara`, then compared
Kiyotaka Oshiyama and Moaang using real history responses.

Only the `storage` permission is requested. Content scripts and module assets
remain restricted to `https://keyframe-staff-list.com/*`. Browser testing also
caught and fixed an incorrect receiver when invoking native fetch.

## Cache and failure behavior

- Extension-local normalized histories, schema version 2, TTL 24 hours.
- Refresh bypasses the selected histories' cache.
- Storage failures fall back to fresh requests; failed refreshes retain the
  previous valid cache record.
- Schema errors fail the whole affected history; no malformed credit is
  silently skipped.
- At most four selected-person history requests per comparison.
- Server cache headers, cookie necessity and rate-limit behavior remain unverified.
  HTTP 429 is handled without automatic retries.

## Validation evidence and remaining checks

- Unit tests cover normalization, intersections, partial overlaps, fidelity,
  schema drift, HTTP failures, cache expiry, cancellation, global search,
  aliases, studios, name-based identities, and native fetch invocation.
- The actual unpacked extension passed the mocked Chromium E2E suite on a
  fixture with no staff links: Japanese/alias queries, both modes, all credits,
  partial overlaps, caching, refresh, errors/retry, cancellation, keyboard focus,
  navigation, saved selection, and a 320px viewport. Screenshots were inspected.
- Live extension search passed on home, person and staff-list pages; a real
  Oshiyama/Moaang comparison completed successfully.
- TypeScript checks, build and archive integrity checks pass.
- Broader profile completeness, Download JSON parity, rate-limit/cache headers,
  and unusual credit schemas remain outside this search fix's verification.

The earlier automatic approval-service failure was resolved by switching approval
mode. It no longer blocks browser testing or public endpoint verification.
