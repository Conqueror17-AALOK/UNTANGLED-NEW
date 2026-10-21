# Branch Protection Rules

As defined in the UNTANGLE Engineering Plan (Section 4 & 11):

## `main`
- Production-ready branch. Deploys to live demo.
- Direct pushes: **Blocked**.
- Force pushes: **Blocked**.
- Require pull request before merging with **3 approvals** (Aalok, Indra, Yash).
- Require status checks to pass (lint, typecheck, tests, docker build).

## `develop`
- Integration branch. Everything merges here first.
- Direct pushes: **Blocked**.
- Force pushes: **Blocked**.
- Require pull request before merging with **1 approval** from touched directory owner (or all 3 for `contracts/`).
- Feature branches squashed on merge: `feature/<area>-<short-name>`.
