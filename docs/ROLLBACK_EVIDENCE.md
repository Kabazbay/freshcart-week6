# Rollback Test Evidence

## Setup
- **Image (good)**: `kabazbay/freshcart-checkout-api:52222e9`
- **Environment**: staging on `freshcart-dev-backend` (GCP VM, us-central1-a)
- **Trigger date**: Sept 7, 2026
- **Test method**: Manual `rollback.yml` workflow dispatch

---

## Test 1: Broken Deploy (Non-existent Tag)

**Input**: `image_tag=52552m9`, `environment=staging`

**Expected**: Docker pull fails; deployment fails; health check fails

**Actual**:

Run docker pull kabazbay/freshcart-checkout-api:52552m9
Error response from daemon: manifest for kabazbay/freshcart-checkout-api:52552m9 not found: manifest unknown: manifest unknown
Error: Process completed with exit code 1.


**Outcome**: ✅ Failure detected, pipeline halted

---

## Test 2: Recovery (Rollback to Known-Good)

**Input**: `image_tag=52222e9`, `environment=staging`

**Expected**: Docker pull succeeds; container starts; health check returns 200 OK

**Actual**:

52222e9: Pulling from kabazbay/freshcart-checkout-api
Digest: sha256:df4c72db2a545e98b32129bcd389321278f3a956b6b5abac9476e7d6c63e02c2
Status: Image is up to date for kabazbay/freshcart-checkout-api:52222e9
docker.io/kabazbay/freshcart-checkout-api:52222e9
fbd4eca3a112496ff46dc8fdd4b56f1046d86cc61b84f9fe5e6e0698b4c1c3e4

Health check (20s after deploy):

{"status":"ok"}


**Outcome**: ✅ Rollback succeeded, health check passed

**Duration**: 55 seconds (end-to-end)

---

## Observations

1. **WIF auth**: Both runs authenticated seamlessly via GitHub token → GCP via WIF. No credential errors.
2. **IAP tunnel**: SSH into VM via IAP tunnel stable across both runs.
3. **Docker state**: Old container was stopped and removed before new pull. No stale container conflicts.
4. **Health check timing**: 20-second delay before health check is sufficient for container to be fully ready.

---

## Appendix: Full Rollback Output Logs

### Test 1 Full Output
![Failed Rollback](docs/images/unsuccessful-rollback.png)

### Test 2 Full Output
![Successful Rollback](docs/images/successful-rollback.png)