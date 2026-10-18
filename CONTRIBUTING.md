# Contributing

Thank you for helping improve Envato XPerience. You can report a bug, suggest an idea, improve documentation or contribute code.

For reports, explain the expected behavior, what happened, the extension version and the public page involved. Remove account details from screenshots and never share passwords, cookies, purchase codes or license certificates. For a suspected security issue, use GitHub's private vulnerability reporting if available; otherwise contact the maintainer privately before disclosing sensitive details.

## Code contributions

- Start from `develop` and open pull requests against `develop`. `main` is reserved for reviewed release integrations.
- Use focused branches such as `feature/short-description`, and keep each change reviewable.
- Preserve the native JavaScript architecture, safe DOM rendering, visual isolation and existing user controls. Do not add runtime dependencies without a concrete need.
- Run the relevant tests described in [Development](docs/DEVELOPMENT.md). Never include `.env` files, browser profiles or account artifacts.
- Describe the user-visible problem, resulting behavior and validation in the PR. Labels are added automatically; the maintainer can refine them. PRs are assigned to `mvuljevas` by default.
- Follow [SemVer](docs/WORKFLOW.md) for packaged behavior changes. Documentation and repository automation alone do not require a new extension version.

Merged feature branches are removed after their commits are confirmed in `develop` and `main`. The long-lived branches are `develop` and `main`.
