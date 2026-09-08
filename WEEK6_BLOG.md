# I Automated FreshCart's Deploy Process (Then Broke It On Purpose to Test the Rollback)

**Published**: (https://medium.com/@kabazbay98/i-automated-freshcarts-deploy-process-then-broke-it-on-purpose-to-test-the-rollback-6fab2a5629b2)

---

## Section 1: Before — Manual Shipping

### Context
Weeks 1–5 got us a fully-functional e-commerce backend running in production on GCP with Terraform IaC. But deploying changes was still manual theatre.

### The Problem
To ship a code change:
1. Commit to local main
2. `docker build` and `docker push` by hand
3. SSH into the VM
4. `docker stop checkout-api && docker rm checkout-api`
5. `docker run -d --name checkout-api ... -e DATABASE_URL='...' ...` (pray the env vars are right)
6. Curl `/healthz` and hope it's 200

**Risks**:
- Typos in env vars → silent failures, wrong connection strings
- Forgetting to pull the new image → shipping old code without realizing
- Manual SSH prone to missed steps or wrong flags
- No safety net — broken deploy with no rollback plan

**Time cost**: 15–20 minutes per ship, mostly manual waiting and nerve-wracking SSH commands.

---

## Section 2: The Pipeline — Five Jobs, Two Gates

![Pipeline diagram showing: PR → CI → [main merge] → Build → Scan → Push → [auto] → Staging → [approval] → Production → [manual] → Rollback](docs/images/freshcart_pipeline_diagram.png)

### Job 1: CI (Pull Request)
**Trigger**: Every PR to main  
**What it does**:
- npm ci (cached dependencies)
- npm run build
- npm run typecheck

**Why**: Catches dependency issues and syntax errors before they reach main. Developers get immediate feedback without needing a cloud VM.

**Gate**: Blocks merge if any step fails.

---

### Job 2: Build → Scan → Push (Main Merge)
**Trigger**: Push to main  
**What it does**:

1. **Docker build**: Image tagged with 7-char commit SHA (e.g., `52222e9`)
2. **Trivy scan**: Static analysis for CRITICAL + HIGH CVEs
3. **Push**: Image → Docker Hub via Workload Identity Federation (WIF)

**Why Trivy?** Catches known vulns in app code + dependencies before they reach production. We found and fixed 23 vulns across our package.json; reduced to 3 MODERATE in npm tooling (build-time only, not runtime).

**Why WIF?** No long-lived secrets. GitHub exchanges its own token (scoped to this repo only) for a short-lived GCP credential. Token expires in minutes. Better than storing a Docker Hub key in GitHub secrets.

**Gate**: Fails on CRITICAL or HIGH vulns. (MODERATE warnings in npm tooling are logged, accepted for dev.)

---

### Job 3: Deploy to Staging (Automatic)
**Trigger**: Successful build-scan-push  
**What it does**:
- Authenticates to GCP via WIF
- SSH into the VM via IAP tunnel
- `docker pull kabazbay/freshcart-checkout-api:52222e9` (the tag we just pushed)
- Stops and removes old container
- `docker run -d ... -e DATABASE_URL='...'`
- Waits 20 seconds
- Curl `/healthz` — must return 200 OK

**Why automatic?** Staging is *us* testing our own code. No approval needed; we own this environment. If something's wrong, we find out in 30 seconds, not in production at 3 AM.

**Gate**: Fails if health check times out or returns non-200.

**Evidence**: [Screenshots of successful staging deploys: build job, Docker pull logs, health check 200]

---

### Job 4: Deploy to Production (Approval Gate)
**Trigger**: Manual approval in GitHub environment  
**What it does**: Identical to staging, but targets production.

**Why approval?** Production is the customer-facing environment. A human should consciously decide "yes, the staging test passed, deploy to prod." This is not about not trusting automation; it's about sharing responsibility. Approval gate is a *forcing function* for the conversation: "what are we shipping, why, and is the staging test proof it works?"

**Gate**: GitHub `environment: production` requires designated reviewers. Cannot proceed without explicit approval. Blocks for 24 hours if no one approves.

**Evidence**: [Screenshots of approval decision in GitHub, successful production deploy, production health check 200]

---

### Job 5: Rollback (Manual Dispatch)
**Trigger**: Manual dispatch (any time)  
**Inputs**:
- `image_tag`: Which Docker image tag to deploy (e.g., `52222e9`, `abc1234`)
- `environment`: `staging` or `production`

**What it does**: Same as deploy jobs, but pulls the specified tag (no new build, no scan, no approval).

**Why manual, not automatic?** Automatic rollback can thrash — deploy v2 broken, rollback to v1, v1 works, but then someone pushes v3, auto-rollback kicks in again... chaos. Manual rollback forces a pause: "Is this the right move?" Speeds decision-making.

**Evidence** [Screenshots from rollback test]:
1. **Broken deploy**: Attempted tag `52552m9` (typo, doesn't exist) → `manifest unknown` error → deploy failed ✅
2. **Recovery**: Rollback to `52222e9` → image pulled → container started → health check `{"status":"ok"}` ✅

Duration: 55 seconds.

---

## Section 3: What Went Wrong (And What We Fixed)

### Scan Vulnerabilities
**Found**: 23 vulns, 1 CRITICAL, 22 HIGH.  
**Problem**: brace-expansion, tar, minimatch, pacote, sigstore all had known CVEs.  
**Action**: `npm update && npm audit fix --force`.  
**Result**: Reduced to 3 MODERATE in npm's bundled tooling (not app code). App dependencies clean.

### Missing APIs
**Found**: GCP API `iamcredentials.googleapis.com` not enabled.  
**Problem**: WIF couldn't exchange GitHub token for GCP credentials.  
**Action**: `gcloud services enable iamcredentials.googleapis.com`.  
**Result**: WIF auth works.

### Service Account Permissions
**Found**: `github-actions` SA couldn't impersonate compute SA to update SSH metadata.  
**Problem**: VM SSH key metadata updates failed, IAP tunnel couldn't establish.  
**Action**: Grant `iam.serviceAccountUser` role to `github-actions` SA on compute SA.  
**Result**: SSH metadata updates succeeds, IAP tunnel works.

### VM Shutdown
**Found**: VM was TERMINATED (stopped).  
**Problem**: Workflow tried to SSH into a dead instance.  
**Action**: `gcloud compute instances start freshcart-dev-backend`.  
**Result**: VM boots, workflow connects.

---

## Section 4: DORA Metrics — What Changed

| Metric | Before | After | Impact |
|--------|--------|-------|--------|
| **Lead time** | 15–20 min manual (build, push, SSH, health check) | ~4 min (auto staging) | 4–5× faster |
| **Change failure rate** | No gate; manual steps error-prone | Trivy + staging approval gate | ↓ Fewer broken deploys |
| **MTTR** | Manual SSH rollback (10+ min, error-prone) | Rollback dispatch <2 min | 5× faster recovery |
| **Deployment frequency** | ~1–2 per day (toil barrier) | Unlimited (toil gone) | Unblocked shipping |

**Most improved**: MTTR. Before, rolling back meant SSHing in, fumbling with docker commands, debugging why the container won't start. Now: click a button, workflow runs, health check confirms. Confidence skyrocketed.

---

## Section 5: Lessons

1. **Automate the toil, not the logic.** The logic (which environment to deploy to, which image is good) stays human. The toil (docker pull, health checks, SSH key management) goes to machines.

2. **Test rollback before you need it.** We broke a tag on purpose and rolled back successfully. That 20-minute rehearsal is worth its weight in 3 AM peace of mind.

3. **Short-lived credentials scale.** WIF means we never store a Docker Hub key in GitHub. No key rotation, no "oh no where did we put it" moments. Token is generated per-run, scoped to the repo, expires in minutes.

4. **Approval gates are conversation starters.** The "click to deploy to prod" moment is when a team says "is this the right call?" and finds issues before they hit customers.

---

## Appendix: Links

- **Pipeline diagram**: [Pipeline Diagram](docs/images/freshcart_pipeline_diagram.png)
- **Rollback evidence**: [docs/ROLLBACK_EVIDENCE.md](docs/ROLLBACK_EVIDENCE.md)
- **Workflow files**: [.github/workflows/](.github/workflows/)
- **FreshCart repo**: [github.com/Kabazbay/freshcart-week6](https://github.com/Kabazbay/freshcart-week6)
- **Learn Cloud with Amina**: [Course site TBD]

---

**Author**: Akintomiwa (@kabazbay98)  
**Date**: September 2026