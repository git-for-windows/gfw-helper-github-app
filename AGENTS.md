# AGENTS.md

This file provides guidance for AI agents and developers working with the
`gfw-helper-github-app` repository.

## Repository Purpose

This repository implements the **GitForWindowsHelper GitHub App**, an
[Azure Function](https://learn.microsoft.com/en-us/azure/azure-functions/)
that serves the automation needs of the
[Git for Windows](https://github.com/git-for-windows/git) project. It
receives GitHub webhook events, performs quick tasks itself, and hands off
more complex tasks to GitHub workflows in the
[`git-for-windows-automation`](https://github.com/git-for-windows/git-for-windows-automation)
repository (which has its own `AGENTS.md` describing the other side of
this relationship).

The most visible feature is "slash commands": commands such as `/deploy`
that maintainers issue via comments on GitHub Issues and Pull Requests.

## Architecture Overview

```
GitHub webhook (issue_comment, check_run, push, workflow_run)
        |
        v
GitForWindowsHelper (this Azure Function)
        |  quick tasks done inline (e.g., /hi, queue check-runs)
        |
        v
Dispatches a workflow BY FILENAME in git-for-windows-automation
(or build-extra / git-sdk-*) via workflow_dispatch
        |
        v
That workflow runs and "mirrors" check-runs back to the source PR;
the App reacts to those check-run completions to drive cascades
```

The App is intentionally thin: it validates the webhook, decides what to
do, and either answers directly or triggers a workflow elsewhere. The
heavy lifting (building packages, tagging Git, building installers) lives
in `git-for-windows-automation`.

## Critical Contracts with git-for-windows-automation

This App is the counterpart to `git-for-windows-automation`. Two contracts
must stay in sync across both repositories:

1. **Workflows are dispatched by filename.** Renaming a workflow there
   requires a matching change here. The App dispatches:

   | Filename | Target repo | Triggered by |
   |----------|-------------|--------------|
   | `open-pr.yml` | git-for-windows-automation | `/open pr` |
   | `updpkgsums.yml` | git-for-windows-automation | `/updpkgsums` |
   | `build-and-deploy.yml` | git-for-windows-automation | `/deploy` |
   | `tag-git.yml` | git-for-windows-automation | `/snapshot`, `/git-artifacts` |
   | `git-artifacts.yml` | git-for-windows-automation | cascading after `tag-git` |
   | `release-git.yml` | git-for-windows-automation | `/release` |
   | `upload-snapshot.yml` | git-for-windows-automation | cascading after `git-artifacts` |
   | `add-release-note.yml` | build-extra | `/add release note` |
   | `sync.yml` | git-sdk-32 / git-sdk-64 / git-sdk-arm64 | `/synchronize-sdks` |

2. **Check-run names and summaries are a parsing contract.** The App
   queues check-runs with specific names and later parses the names,
   summaries and `text` of completed check-runs to drive cascades (see
   `cascading-runs.js`). These patterns must remain stable on both sides:

   - Check-run names: `deploy`, `deploy_<arch>` (e.g. `deploy_x86_64`,
     `deploy_ucrt64`, `deploy_aarch64`), `tag-git`,
     `git-artifacts-<arch>` (`x86_64`/`i686`/`aarch64`), `upload-snapshot`.
   - Summary patterns parsed in `cascading-runs.js`:
     `Tag Git <version> @<sha>` and
     `Build Git <version> artifacts from commit <sha> (tag-git run #<id>)`.
   - The `text` field is parsed for
     `For details, see [this run](<.../actions/runs/<id>>)` to recover the
     dispatched workflow run id.

Changing any of these without updating `git-for-windows-automation` will
break the automation.

## Slash Commands

Implemented in `slash-commands.js`; documented for users in `README.md`.

| Command | Where | What it does |
|---------|-------|--------------|
| `/hi` | any repo the App is installed in | Replies "Hi @&lt;login&gt;" |
| `/add release note <type> <message>` (alias `/add relnote`) | git, build-extra, MINGW-packages, MSYS2-packages | Dispatches `add-release-note.yml` in build-extra |
| `/open pr` | git issues | Dispatches `open-pr.yml` to open a component-update PR |
| `/updpkgsums` | build-extra, MINGW-packages, MSYS2-packages PRs | Dispatches `updpkgsums.yml` to refresh PKGBUILD checksums |
| `/deploy [<package>]` | build-extra, MINGW-packages, MSYS2-packages PRs | Dispatches one or more `build-and-deploy.yml` runs to build & deploy Pacman packages |
| `/synchronize-sdks` | any G4W repo | Dispatches `sync.yml` in each `git-sdk-*` repo |
| `/snapshot` | git PRs | Builds a snapshot from the PR merge commit (no upload) |
| `/git-artifacts` | git PRs | Builds all release artifacts |
| `/release` | git PRs | Publishes the artifacts as a GitHub Release |

### How `/deploy` maps packages to architectures

`/deploy` decides which `build-and-deploy.yml` runs to dispatch based on
the package, using `isMSYSPackage` and `buildsAllArchitecturesInOneRun`
from `component-updates.js`:

- **MSYS packages**: separate `x86_64` and/or `i686` runs.
- **`mingw-w64-git-credential-manager`, `mingw-w64-git-lfs`,
  `mingw-w64-wintoast`**: a single combined run (no explicit
  architecture). These are cross-compiled via Visual Studio or downloaded
  as pre-built artifacts for every architecture (including `clangarm64`)
  at once, so they must not be split.
- **`mingw-w64-llvm`**: only the `aarch64` run.
- **All other MINGW packages (and `git-extra`)**: separate `i686`,
  `x86_64`, `ucrt64` and `aarch64` runs, so they build in parallel. The
  set of `MINGW_ARCH`s the dispatched workflow builds for each pseudo
  architecture lives in `build-and-deploy.yml` over in
  `git-for-windows-automation`.

## Event Routing

`index.js` is the Azure Function entry point. After validating the webhook
signature (`validate-github-webhook.js`) it routes by `x-github-event`:

| Event | Condition | Handler |
|-------|-----------|---------|
| `issue_comment` | `action == created` and body starts with `/` | `slash-commands.js` |
| `workflow_run` | completed `release-git.yml` run on `main` | `finalize-g4w-release.js` |
| `check_run` | completed, app is the active bot, repo is `git` | `cascadingRuns` in `cascading-runs.js` |
| `push` | to `git-for-windows/git` | `handlePush` in `cascading-runs.js` |

## Directory Structure

```
GitForWindowsHelper/        # the Azure Function code
├── index.js                # entry point / webhook router
├── function.json           # Azure Functions binding
├── slash-commands.js       # /deploy, /release, /snapshot, ... handlers
├── cascading-runs.js       # tag-git -> git-artifacts -> upload-snapshot cascade
├── component-updates.js    # package classification + release-note helpers
├── finalize-g4w-release.js # post-release follow-up
├── check-runs.js           # queue/update/list check-runs in other repos
├── issues.js               # comment helpers (append, react, ...)
├── trigger-workflow-dispatch.js
├── github-api-request.js / github-api-request-as-app.js
├── get-installation-access-token.js / get-installation-id-for-repo.js
├── get-collaborator-permissions.js / get-user-access-token.js
├── https-request.js / search.js / gently.js / org.js
└── validate-github-webhook.js

__tests__/                  # Jest tests for the App (index + component-updates)
.github/workflows/deploy.yml # deploys the Function to Azure on push to main
embargoed-builds/           # SEPARATE git worktree (see below) -- do not edit here
```

## The `embargoed-builds` Worktree

`embargoed-builds/` is **not** part of the `main` branch. It is a separate
long-lived branch (`embargoed-builds`) that is typically checked out as a
[git worktree](https://git-scm.com/docs/git-worktree) nested in the
working directory. It is a parallel variant of this App used to build
**embargoed security releases**: it deploys to private Azure Blob Storage
(`wingit.blob.core.windows.net`) instead of the public `pacman-repo`, and
relies on self-hosted Windows/ARM64 runners.

Consequences for agents:

- When working on `main`, **do not edit files under `embargoed-builds/`**.
  It belongs to a different branch and is maintained separately; the two
  variants are reconciled deliberately, not by editing both at once.
- Because Jest's default `testMatch` is `**/__tests__/**`, running
  `npm test` from the repo root also collects
  `embargoed-builds/__tests__/` when that worktree is present (you will
  see four suites instead of two). To run only this App's tests, scope it:
  `npx jest __tests__/`.

## Building, Testing and Linting

There is no build step; the Function is deployed as-is. Verified commands:

- `npm run lint` — ESLint over `**/*.js` (config in `eslint.config.js`).
- `npm run lint:fix` — ESLint with `--fix`.
- `npm test` — Jest. To restrict to this App (excluding the
  `embargoed-builds` worktree), use `npx jest __tests__/`.

Always run lint and tests before committing.

## Testing Conventions

The tests in `__tests__/index.test.js` exercise the webhook handler
end-to-end with heavily mocked dependencies. When adding `/deploy`-style
tests, keep these harness facts in mind:

- `afterEach` calls `jest.clearAllMocks()` and empties `dispatchedWorkflows`,
  so `toHaveBeenCalledTimes(...)` counts are per-test.
- The GitHub API is mocked in `mockGitHubApiRequest`. Looking up a PR's
  head SHA goes through `GET .../pulls/<number>`, so **each PR number used
  in a test needs its own `pulls/<number>` entry** returning
  `{ head: { sha: ... } }`, or the mock throws "Unhandled GET ...".
- `dispatchedWorkflows` is built with `unshift`, so it is in **reverse**
  dispatch order. A `/deploy` that dispatches `i686, x86_64, ucrt64,
  aarch64` yields `['aarch64', 'ucrt64', 'x86_64', 'i686']`.
- The user-facing comment text is assembled in `slash-commands.js`: a
  single dispatch reads "The workflow run [was started]"; multiple
  dispatches read "The [<arch>](...), the [<arch>](...) and the
  [<arch>](...) workflow runs were started." `displayArchitecture`
  overrides the shown label (e.g. `arm64` for the `aarch64` run).

## Coding Conventions

- CommonJS modules (`require()` / `module.exports`); `async`/`await`.
- Handlers `require()` their dependencies lazily, inside the function
  body, rather than at the top of the file.
- Modules are written to be usable both from the Azure Function and from
  the command line (see the `test-*.js` and `get-*.js` helper scripts at
  the repo root), with a `context`/`console` argument used for logging.
- Errors are surfaced by throwing; `index.js` turns thrown errors into 500
  responses.
- Follow the surrounding style: small, single-purpose modules; minimal,
  surgical changes; no duplicated API/auth logic (reuse the existing
  `github-api-request*` / token modules).
- Commit subjects follow `<area>: <imperative>`, e.g.
  `slash-commands: ...`, `component-updates: ...`.

## Deployment

`.github/workflows/deploy.yml` deploys the Function to Azure on every push
to `main` that touches `deploy.yml` or `GitForWindowsHelper/**`. It
authenticates with Azure via OIDC (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
`AZURE_SUBSCRIPTION_ID`) in the `deploy-to-azure` environment and publishes
with `Azure/functions-action`, respecting `.funcignore`. The GitHub App
secrets (`GITHUB_APP_*`, `GITHUB_WEBHOOK_SECRET`) are configured on the
Azure Function itself, not in this repository; see `README.md` for the
one-time setup.

## Validating Changes

1. **Lint and test**: `npm run lint` and `npx jest __tests__/`.
2. **Dispatch contracts**: if you change a dispatched workflow filename or
   a queued check-run name/summary, update `git-for-windows-automation`
   (and re-check its `AGENTS.md`) in lockstep.
3. **Leave `embargoed-builds/` alone** unless you are deliberately working
   on that branch.
