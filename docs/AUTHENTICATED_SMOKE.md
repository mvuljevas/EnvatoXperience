# Protected authenticated smoke

Public CI keeps using local fixtures and no credentials. The live authenticated smoke is a separate manual workflow, **Private authenticated smoke**, restricted to `main` in this repository and the `envato-auth-smoke` GitHub Environment.

## One-time setup

The environment must have a required reviewer (`mvuljevas`), administrator bypass disabled, and a deployment branch policy permitting only the `main` branch (not tags). Self-review is allowed because this is a solo-maintained project; dispatching still requires a separate explicit approval in GitHub. Review the exact main commit and workflow before approving. A workflow condition alone is not a substitute for environment restrictions.

Use a dedicated Envato test account with minimal access. In repository Settings → Environments → **envato-auth-smoke** → Environment secrets, add:

- `ENVATO_TEST_USERNAME`
- `ENVATO_TEST_PASSWORD`

Enter the values directly in GitHub. Do not put them in repository-level secrets, workflow inputs, source files, issue comments, chat, or command arguments. Do not copy a personal browser profile or session to CI. Credentials are supplied only to the private smoke step, after dependency installation.

## Run

In Actions → **Private authenticated smoke** → Run workflow, select **main**. Review the run and approve the protected environment. The runner fails if secrets are missing, login is blocked, or the downloads layout cannot be verified; it never converts a missing login into success. CAPTCHA and MFA are not bypassed. The manual workflow is optional and is not a required status check for normal development.

## Data handling

- Actions are pinned to reviewed commit hashes. Checkout does not persist credentials; npm lifecycle scripts are disabled during installation. No authenticated browser data is cached or uploaded.
- No HTML reporter, screenshots, videos, traces, page dumps or browser logs are produced. Child stdout/stderr are discarded, and the public result is generic. Failures deliberately do not expose detailed diagnostics.
- Credentials are passed in the child environment, not argv. Debug options and GitHub tokens are not forwarded. The runner does not load `.env.local`.
- The extension needs a temporary persistent Chromium profile. It exists only during the job under the runner temporary directory with private permissions. The parent removes it in `finally`, and an `always()` workflow step removes the entire private directory. GitHub-hosted ephemeral runners are required; do not move this job to a shared/self-hosted runner without a separate review. A hard runner termination may skip cleanup; no profile is retained as an artifact.
- Username/password are filled only on reviewed HTTPS origins (`themeforest.net`, `account.envato.com`). Third-party POST requests are blocked. Other login origins fail until reviewed and explicitly added.
- The ordinary live smoke no longer reads local credentials or runs authenticated downloads. The private workflow never invokes that suite.

Secrets masking is an additional safeguard, not a guarantee against malicious workflow changes. Keep write access limited, review changes before approving runs, and rotate the test password if exposure is suspected.

## Local publication check

`.env.local`, profiles and test outputs are ignored. The audit checked reachable `origin` history for sensitive file paths and compared historical blobs against local secret values without printing those values. No matching values or committed profiles were found in those remote refs. This is a targeted check, not a guarantee that every possible secret has been detected. An old local stash contains a browser profile; it must not be applied and committed wholesale or pushed as a ref.

Sources: [GitHub environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments), [deployment branch policies](https://docs.github.com/en/rest/deployments/branch-policies).
