## Pull Request Checklist

### Commit & Scope
- [ ] Title follows `<type>(<scope>): <summary>` (max 72 chars)
  - Scopes: `web`, `api`, `perception`, `infra`, `contracts`
  - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`
- [ ] Touches only directories the author owns, or has owner approval
- [ ] Rebased on latest `develop` (no merge commits from `develop`)
- [ ] Under ~400 changed lines (atomic logical change)

### Code Quality & Testing
- [ ] Lint, type check, and tests pass locally and in CI
- [ ] New or changed behavior has tests; bug fixes include regression tests
- [ ] No `any`, no ignored type errors, no commented-out code, no `TODO`
- [ ] No duplicated logic; shared logic extracted
- [ ] Errors handled with contract error envelope; no silent catches

### Contract & Environment
- [ ] API change? `contracts/openapi.yaml`, JSON schemas, and samples updated in sync
- [ ] New environment variable added to `.env.example` with a comment
- [ ] No secrets, keys, or personal data committed

### Summary of Changes
<!-- Describe what was done and why -->

### How to Test
<!-- Provide exact steps or commands to verify locally -->
