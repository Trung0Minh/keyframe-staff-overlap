# KeyFrame Data-Source Reverse-Engineering Checklist

This document exists to prevent the coding agent from inventing an API contract.

Complete it against the live site before implementing the production adapter.

---

## 1. Person search / autocomplete

### Goal

Find the same public source KeyFrame uses to look up/link staff members.

### Procedure

With DevTools Network open:

1. find any KeyFrame interface that searches people/staff
2. type a distinctive Latin-script name
3. type a Japanese name
4. type a known alias
5. filter Fetch/XHR
6. inspect requests and responses

Record:

```text
Request URL:
Method:
Query/body parameter:
Response content type:
Pagination:
Minimum query length:
Maximum result count:
Requires cookies?:
Requires login?:
Person ID field:
Primary name field:
Native name field:
Aliases field:
Jobs field:
Avatar field:
```

### Required validation

Pick one result and open its person page.

Confirm the returned ID maps to:

```text
/person/{same-id}
```

or document the transformation if different.

---

## 2. Person history source

### Goal

Fetch one selected person's complete public work history without crawling production pages.

### Procedure

Open a person page with Network recording enabled.

Inspect:

- route document
- Fetch/XHR
- JS route-loader calls
- hydration payloads
- any structured JSON

Record:

```text
Request URL / data location:
Method:
Requires cookies?:
Person ID:
History is complete or paginated?:
Year field:
Production ID:
Production URL:
Production title:
Studio:
Category:
Role JA:
Role EN:
Unit labels:
Flags / NC:
Notes:
```

### Critical question

Can one request/data payload return enough information to reconstruct what the visible person page shows?

If yes, this should probably be the primary adapter source.

---

## 3. Production identity

For several person-history records, inspect the production link.

Required identity should be one of:

```text
explicit production ID
```

or:

```text
canonical /staff/{identifier} URL
```

Test two works with similar/same titles if possible.

Do not accept normalized title text as the final identity strategy.

---

## 4. Staff List Download JSON

### Goal

Understand KeyFrame's canonical credit representation and assess whether it is useful as an enrichment/fallback source.

Procedure:

1. open a staff list
2. click Download
3. inspect:
   - request, if any
   - downloaded JSON
4. save a development-only sample
5. compare JSON structure with the rendered staff list

Record:

```text
How is JSON obtained?:
Production identifier:
Menus/units representation:
Categories:
Roles:
Staff/person links:
Person IDs present?:
Aliases present?:
NC flag representation:
Comments:
Studios:
Version/schema marker:
```

### Decision

Answer:

> Does Download JSON solve person-history lookup?

Usually it will not by itself, because comparison begins with a person and would still require knowing every production they worked on.

Use it where it provides value, not as a reason to crawl the catalog.

---

## 5. Network behavior

Inspect:

```text
ETag:
Last-Modified:
Cache-Control:
Rate-limit headers:
429 behavior:
Retry-After:
Compression:
```

If KeyFrame exposes cache validators, consider conditional requests later.

MVP can still use local TTL caching.

---

## 6. Extension fetch experiment

Create the smallest possible temporary content script.

Try the chosen search/history fetch from the extension.

Record:

```text
Works in content script?:
credentials mode needed?:
CORS issue?:
service worker needed?:
extra host permission needed?:
```

Prefer the smallest working architecture.

---

## 7. Public-access boundary

The extension only needs data already used for public KeyFrame pages.

Do not:

- reverse private admin endpoints
- bypass authentication
- scrape logged-in-only editing data
- reproduce privileged contributor tools
- defeat rate limiting

If a public frontend endpoint changes or disappears, the extension should fail clearly until its adapter is updated.

---

## 8. Fallback hierarchy

Choose the first viable strategy.

### A. Public structured frontend endpoint

Best option.

```text
search endpoint + person-history endpoint
```

### B. Public route/embedded structured payload

Good option if the route embeds all required data.

### C. Public rendered DOM parsing

Fallback.

Only use selectors tied to semantic structure where possible.

### D. Production-by-production crawling

Reject for MVP.

It is inefficient and unnecessary for a selected-person comparison tool.

---

## 9. DOM fallback requirements

If DOM parsing becomes necessary:

- keep selectors in one module
- write fixture tests from saved sanitized HTML
- prefer anchors/hrefs for IDs
- do not match production identity from headings alone
- preserve raw role/unit text
- detect missing required sections
- return `SCHEMA_CHANGED` when expected structure disappears

Do not make ten unrelated React components each query KeyFrame DOM.

---

## 10. Decision record template

Create `docs/DATA_SOURCE_NOTES.md` with something like:

```md
# KeyFrame Data Source Notes

Inspected: YYYY-MM-DD

## Search
- source:
- request:
- person id:
- aliases:
- auth:

## Person history
- source:
- request:
- production identity:
- categories:
- roles:
- units:
- completeness:

## Download JSON
- source:
- useful for:

## Extension network path
- content script / service worker:
- permissions:

## Cache observations
- headers:
- chosen local TTL:

## Known assumptions
- ...

## Known schema risks
- ...
```

The adapter should be reviewed against this document.
