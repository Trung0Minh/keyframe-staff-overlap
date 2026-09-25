# KeyFrame Staff Overlap — Coding Agent Handoff

## Mission

Build a browser extension that runs directly on **KeyFrame Staff List** and lets a user:

1. Search for and select **2 or more staff members** using autocomplete backed by KeyFrame's own staff data.
2. Find productions on which **all selected staff members** worked.
3. Switch between:
   - **Same Production** — every selected person has at least one credit on the same production.
   - **Same Episode / Unit** — every selected person has at least one credit on the same exact episode/unit within that production.
4. For every match, show **all known credits** of every selected person on that production:
   - category
   - role
   - Japanese/English role names where available
   - episode/unit labels
   - flags/notes such as NC if exposed by the source
5. If there is no all-person intersection, show a helpful **partial-overlap summary**, e.g. which pairs still worked together and on how many productions.
6. Link results back to the original KeyFrame production/person pages.

The extension should feel like a native utility added to KeyFrame Staff List, not a separate website.

---

## Product decisions already made

These are not open questions unless implementation proves one impossible:

- Staff input uses **autocomplete**, not arbitrary free text.
- A selected staff member is represented internally by **KeyFrame person ID**, not by display name.
- Input supports **2+ people**.
- The main result is an **intersection across every selected person**.
- Both **Same Production** and **Same Episode / Unit** are supported.
- The result preserves **all role and unit information** for every selected person.
- If the full intersection is empty, still say so clearly; partial overlaps are secondary information, not replacements for the main result.
- The UI is injected directly into `keyframe-staff-list.com`.
- MVP does not need graphs or advanced statistics.
- Prefer KeyFrame's own structured data/network endpoints. HTML/DOM parsing is a fallback.
- Do not build or crawl a mirror of the entire KeyFrame database.

---

## Verified observations about KeyFrame relevant to this project

As observed on the live site during planning:

- Person pages use URLs shaped like `/person/{personId}`.
- Person pages already expose work history in a useful hierarchy:
  **year → production → category → role → episode/unit**.
- Examples of unit labels include `Overview`, `#01`, `OP`, `ED`, `Movie`, `MV`, `PV`, `CM`, `Special`, etc.
- A person can have multiple roles and multiple unit labels inside the same production.
- Staff lists have a **Download** function that exports JSON.
- KeyFrame is JavaScript-driven, so do not assume a plain unauthenticated HTML fetch contains all useful page data.

These observations strongly favor a **person-centric data strategy** for the comparison feature: resolve each selected person, fetch their work history, then intersect their production IDs.

---

## Read these files in order

1. `01_PRODUCT_AND_UX_SPEC.md`
2. `02_DATA_AND_MATCHING_SPEC.md`
3. `03_EXTENSION_ARCHITECTURE.md`
4. `04_IMPLEMENTATION_PLAN.md`
5. `05_TEST_AND_ACCEPTANCE.md`
6. `06_KEYFRAME_REVERSE_ENGINEERING_CHECKLIST.md`

The reverse-engineering checklist is mandatory before hard-coding any KeyFrame endpoint.

---

## Non-goals for MVP

Do not spend MVP time on:

- collaboration graphs
- social/network analysis
- ranking staff by number of collaborations
- recommendations
- exporting giant datasets
- background crawling of all staff lists
- automatic scraping of every KeyFrame person
- user accounts or cloud sync
- editing KeyFrame data
- writing to KeyFrame
- any feature that requires bypassing access controls or private endpoints

---

## Recommended implementation stack

Use this unless there is a strong repo-specific reason not to:

- Manifest V3 browser extension
- Chromium first
- TypeScript
- React for the injected comparison UI
- Vite for build tooling
- plain CSS / CSS Modules inside a Shadow DOM
- Vitest for domain/data unit tests
- Playwright for end-to-end extension tests

Keep framework code thin. The important parts are the data adapter and matching engine.

---

## Core engineering rule

All KeyFrame-specific network/schema details must live behind a small adapter interface.

The domain/matching code must not know URL paths, JSON response shapes, DOM selectors, or request headers used by KeyFrame.

That separation is what will keep the extension repairable if KeyFrame changes its frontend.
