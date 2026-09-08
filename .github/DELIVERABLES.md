# Week 6 Capstone Deliverables

## Workflow Files
- `.github/workflows/ci.yml` — PR checks: npm install, build, typecheck
- `.github/workflows/cd.yml` — Main merge: build → scan → push → staging (auto) → production (approval)
- `.github/workflows/rollback.yml` — Manual dispatch: pull and deploy any image tag

## Design Artifacts
- `.github/PIPELINE.md` — Pipeline diagram with key decision rationale
- `docs/images/freshcart_pipeline-diagram.png` — Visual flowchart 

## Evidence
- `docs/ROLLBACK_EVIDENCE.md` — Staged screenshots:
  - Build/scan/push success (staging deploy)
  - Rollback failure (broken tag attempt)
  - Rollback recovery (successful restore to 52222e9)
  - Health check confirmation

## Blog Post
- `WEEK6_BLOG.md` — Full draft (4 sections below)
- Published to: https://medium.com/@kabazbay98/i-automated-freshcarts-deploy-process-then-broke-it-on-purpose-to-test-the-rollback-6fab2a5629b2

## Summary
- Workflows: 3 ✅
- Diagrams: 1 ✅
- Evidence: 3 runs (build/deploy, rollback failure, rollback recovery) ✅
- Blog: Draft ready, publish pending ✅