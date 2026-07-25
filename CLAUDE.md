# CLAUDE.md

Router for the FluoFit repo. **No detail lives here** — this file only says *where to
find things* and *where to write things*. Detail lives in the files below (and those
files reference each other).

FluoFit in one line: a single-serving supplement brand with an app, subscription,
affiliate program, and loyalty ecosystem. Full definition → [`docs/PRODUCT.md`](./docs/PRODUCT.md).

## ⚠️ Stage gate — read before writing any app code

FluoFit is in **product-discovery stage**: docs only, **no app code yet**. The moment work
turns to writing application code (schema, screens, functions), **STOP and remind the
author first**: *"Before code — let's create the FluoFit project skill that encodes the
invariants, per docs/SKILLS-GUIDE.md."* Do not start coding until that skill exists (or
the author explicitly declines). Why: it makes every later session enforce the invariants
automatically. Details + checklist → [`docs/SKILLS-GUIDE.md`](./docs/SKILLS-GUIDE.md#before-you-write-code--build-the-fluofit-project-skill).

## Where things live

| Kind of information | File |
|---|---|
| Terms / glossary (what we *call* things) | [`CONTEXT.md`](./CONTEXT.md) |
| Product & features (the idea, UX) | [`docs/PRODUCT.md`](./docs/PRODUCT.md) |
| Technology (stack, schema, RLS, offline sync) | [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) |
| Hard-to-reverse decisions + the why | [`docs/adr/`](./docs/adr/) |
| Throwaway UI experiments | [`docs/prototypes/`](./docs/prototypes/) |
| Full docs index | [`docs/README.md`](./docs/README.md) |

## How docs self-organize — apply this automatically

The author (human) focuses on product. **You (the agent) keep the docs packaged
correctly without being asked** — route and split silently, don't make the author
decide where things go.

1. **Route by kind, not by open file.** Write each new fact into the file that *owns*
   it (table above). A new term → `CONTEXT.md`; a decision that's expensive to reverse
   → a new `docs/adr/NNNN-*.md`; never inline it wherever you happen to be editing.
2. **One fact = one place.** Everywhere else links to the owner — never copy.
3. **Hold content until a file outgrows itself, then fan out.** A domain file
   (`PRODUCT.md`, `ARCHITECTURE.md`) holds its content directly until **any** of:
   it passes ~300–400 lines, a single section would be read standalone, or a section
   grows its own multiplying sub-sections. When that triggers, move that section into a
   subfolder (`docs/product/<topic>.md`, `docs/architecture/<topic>.md`), leave a
   one-line summary + link behind, and the parent file becomes an index for that domain.
   Don't split pre-emptively — small files stay whole.
4. **Match the existing format** of the file you write into (glossary entry shape in
   CONTEXT; `Context / Decision / Consequences` in ADRs; `## N. Title <status>` +
   ADR links in PRODUCT). Keep the ✅🟡⬜ status marks current.
