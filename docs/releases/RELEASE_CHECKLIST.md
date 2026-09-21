# Release checklist

Do not execute release actions until repository owner approves them.

## Preparation

- [ ] Working tree clean; expected branch checked.
- [ ] Version is `0.1.0` in `package.json` and lockfile.
- [ ] `CHANGELOG.md` and proposed release notes are current.
- [ ] README, source/security documentation, limitations, and uncertainty ledger are current.
- [x] MIT License added; owner license decision recorded.
- [x] Official Mellat PGW v1.39 PDF excluded; do not add, package, or attach it.

## Quality gate

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run test:e2e` (install Chromium first when needed)
- [ ] `npm run build`
- [ ] `npm audit --omit=dev`
- [ ] `npm outdated` reviewed; no last-minute upgrade without separate decision.
- [ ] `git diff --check`
- [ ] Isolated clean clone/archive passes `npm ci`, lint, typecheck, unit tests, and build.

## Human review

- [ ] README and Quick Start.
- [ ] Dashboard and fake payment page.
- [ ] Release notes and known limitations.
- [ ] Licensing status and official-source handling.
- [ ] No real credentials, secrets, local environment files, test artifacts, or build output in changes.

## Release execution

After preparation changes are committed and human approval is recorded:

```bash
git tag -a v0.1.0 -m "Behpardakht Simulator v0.1.0"
git push origin main
git push origin v0.1.0
```

- [ ] Create GitHub release only if owner chooses it; use `docs/releases/v0.1.0.md`.
- [ ] Do not publish npm, deploy, upload artifacts, or change repository settings unless separately approved.

## Post-release

- [ ] Verify repository commit/tag and any chosen release notes.
- [ ] Start a new `Unreleased` section for future work.
