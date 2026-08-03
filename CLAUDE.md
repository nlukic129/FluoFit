# CLAUDE.md

Router for the FluoFit repo. **No detail lives here** — this file only says *where to
find things* and *where to write things*. Detail lives in the files below (and those
files reference each other).

FluoFit in one line: a single-serving supplement brand with an app, subscription,
affiliate program, and loyalty ecosystem. Full definition → [`docs/PRODUCT.md`](./docs/PRODUCT.md).

## ⚠️ Stage gate — the `fluofit-build` skill now exists

The project skill has been created at `.claude/skills/fluofit-build/SKILL.md` — the gate is
**satisfied**. Any session writing or reviewing **app code** (schema, migrations, RLS, screens,
Edge Functions) must **load `fluofit-build` first** so the five invariants are enforced
automatically. It points to the owning docs; it never restates their detail. Build shape (stack,
monorepo, ports, sequencing) → [ADR-0014](./docs/adr/0014-stack-monorepo-and-ports.md). Skill
rationale → [`docs/SKILLS-GUIDE.md`](./docs/SKILLS-GUIDE.md#before-you-write-code--build-the-fluofit-project-skill).

## Where things live

| Kind of information | File |
|---|---|
| Terms / glossary (what we *call* things) | [`CONTEXT.md`](./CONTEXT.md) |
| Product & features (the idea, UX) | [`docs/PRODUCT.md`](./docs/PRODUCT.md) |
| Technology (stack, engines, ports, offline sync) | [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) |
| Concrete DB schema + RLS policies | [`docs/architecture/data-model.md`](./docs/architecture/data-model.md) |
| Hard-to-reverse decisions + the why | [`docs/adr/`](./docs/adr/) |
| Build progress (living per-phase tracker) | [`docs/ROADMAP.md`](./docs/ROADMAP.md) |
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
