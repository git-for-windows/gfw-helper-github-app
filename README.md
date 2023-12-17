# GitForWindowsHelper GitHub App

<p align="center">
<img alt="Git for Windows Helper GitHub App logo" src="git-for-windows-helper.svg" />
</p>


The purpose of this GitHub App is to serve the needs of the Git for Windows project, implementing all kinds of useful automation.

The App is implemented as an Azure Function that performs quick tasks itself and hands off more complex tasks to GitHub workflows in the [`git-for-windows-automation` repository](https://github.com/git-for-windows/git-for-windows-automation).

## Slash commands

The GitForWindowsHelper GitHub App supports so-called "slash commands", i.e. commands that start with a forward slash and that are issued via comments in GitHub Issues or Pull Requests.

### `/hi`

**Where can it be called?** In issues/PRs of any repository in which the GitForWindowsHelper GitHub App is installed.

**What does it do?** The app responds in a separate comment, saying "Hi @&lt;login&gt;" where `<login>` is your GitHub login name.

### `/add release note <type> <message>`

**Where can it be called?** In issues and Pull Requests of Git for Windows' [`git`](https://github.com/git-for-windows/git), [`build-extra`](https://github.com/git-for-windows/build-extra), [`MINGW-packages`](https://github.com/git-for-windows/MINGW-packages) and [`MSYS2-packages`](https://github.com/git-for-windows/MSYS2-packages) repositories.

**What does it do?** It starts a run of [the GitHub workflow](https://github.com/git-for-windows/build-extra/actions/workflows/add-release-note.yml) that adds a bullet point to [Git for Windows' Release Notes](https://github.com/git-for-windows/build-extra/blob/HEAD/ReleaseNotes.md). The `<type>` can be `bug` (for bug fixes), `feature` (for new features) and `blurb` (to add important context about the upcoming release, such as deprecation notices). The `<message>` should be Markdown-formatted and the "Preview" functionality of the comment should be used to ensure that it renders well.

For convenience, the command can be abbreviated as `/add relnote <type> <message>`.

### `/open pr`

**Where can it be called?** In `git-for-windows/git`'s [issue tracker](https://github.com/git-for-windows/git/issues).

**What does it do?** Meant to handle tickets labeled as `component-update` (typically created by [the `Monitor component updates` GitHub workflow](https://github.com/git-for-windows/git/actions/workflows/monitor-components.yml)) that notify the Git for Windows project when new versions are available of software that is shipped with Git for Windows, this command starts a [GitHub workflow run to open the corresponding Pull Request](https://github.com/git-for-windows/git-for-windows-automation/actions/workflows/open-pr.yml).

### `/updpkgsums`

**Where can it be called?** In Pull Requests of Git for Windows' [`build-extra`](https://github.com/git-for-windows/build-extra), [`MINGW-packages`](https://github.com/git-for-windows/MINGW-packages) and [`MSYS2-packages`](https://github.com/git-for-windows/MSYS2-packages) repositories.

**What does it do?** Meant to update the checksums in `PKGBUILD` files that need to be modified to pass the integrity checks of `makepkg`.

### `/deploy [<package>]`

**Where can it be called?** In Pull Requests of Git for Windows' [`build-extra`](https://github.com/git-for-windows/build-extra), [`MINGW-packages`](https://github.com/git-for-windows/MINGW-packages) and [`MSYS2-packages`](https://github.com/git-for-windows/MSYS2-packages) repositories.

**What does it do?** This triggers one ore more [GitHub workflow runs](https://github.com/git-for-windows/git-for-windows-automation/actions/workflows/build-and-deploy.yml) to build and deploy Git for Windows' [Pacman packages](https://github.com/git-for-windows/git/wiki/Package-management).

### `/git-artifacts`

**Where can it be called?** In `git-for-windows/git`'s [Pull Requests](https://github.com/git-for-windows/git/pulls)

**What does it do?** This command starts [the `Git artifacts` Azure Pipeline](https://dev.azure.com/git-for-windows/git/_build?definitionId=34&_a=summary) that builds all of the artifacts of a full Git for Windows release: installer, Portable Git, MinGit, etc

### `/release`

**Where can it be called?** In `git-for-windows/git`'s [Pull Requests](https://github.com/git-for-windows/git/pulls)

**What does it do?** Call this command after a `/git-artifacts` command successfully produced the artifacts _and_ after the installer artifact has been validated manually, using [the "pre-flight checklist"](https://github.com/git-for-windows/build-extra/blob/HEAD/installer/checklist.txt). This will start [the Azure Release Pipeline](https://dev.azure.com/git-for-windows/git/_release?_a=releases&view=mine&definitionId=1) to publish the artifacts in a new GitHub Release.

## Spinning up Windows/ARM64 runners

As GitHub Actions do not offer hosted Windows/ARM64 runners, Git for Windows needs to use self-hosted Windows/ARM64 runners to build the `clang-aarch64` versions of its MINGW packages.

To this end, the GitForWindowsHelper App notices when a job was queued [in the `git-for-windows-automation` repository](https://github.com/git-for-windows/git-for-windows-automation/actions/) that requires a Windows/ARM64 runner, and starts [the GitHub workflow to spin up an Azure VM with such a runner](https://github.com/git-for-windows/git-for-windows-automation/actions/workflows/create-azure-self-hosted-runners.yml). This VM is created from scratch and its runner is marked as ephemeral (meaning: it will run exactly one job for security reasons). Once the job is finished, the GitForWindowsHelper App starts [the GitHub workflow](https://github.com/git-for-windows/git-for-windows-automation/actions/workflows/delete-self-hosted-runner.yml) to decommission the VM.

The GitForWindowsHelper App will also notice when jobs are queued for PRs originating in forks, and immediately cancel them. This helps with keeping the cost of self-hosting these Windows/ARM64 at reasonable levels.

## Tips & Tricks for developing this GitHub App

### Debug/test-run as much Javascript via the command-line as possible

The easiest, and quickest, way to test most of the Javascript code is to run it on the command-line, via `node`.

To facilitate that, as much functionality is implemented in modules as possible.

### Run the Azure Function locally

It is tempting to try to develop the Azure Function part of this GitHub App directly in the Azure Portal, but it is cumbersome and slow, and also impossibly unwieldy once the Azure Function has been deployed via GitHub (because that disables editing the Javascript code in the Portal).

Instead of pushing the code to Azure all the time, waiting until it is deployed, reading the logs, then editing the code, committing and starting another cycle, it is much, much less painful to develop the Azure Function locally.

To this end, [install the Azure Functions Core Tools (for performance, use Linux)](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=v4%2Clinux%2Ccsharp%2Cportal%2Cbash#install-the-azure-functions-core-tools), e.g. via WSL.

Then, configure [the `GITHUB_*` variables](#some-environment-variables) locally, via [a `local.settings.json` file](https://learn.microsoft.com/en-us/azure/azure-functions/functions-develop-local#local-settings-file). The contents would look like this:

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AZURE_PIPELINE_TRIGGER_TOKEN": "<personal-access-token>",
    "AzureWebJobsStorage": "<storage-key>",
    "GITHUB_APP_ID": "<app-id>",
    "GITHUB_APP_CLIENT_ID": "<client-id>",
    "GITHUB_APP_CLIENT_SECRET": "<client-secret>",
    "GITHUB_APP_PRIVATE_KEY": "<private-key>",
    "GITHUB_WEBHOOK_SECRET": "<webhook-secret>"
  },
  "Host": {
    "LocalHttpPort": 7071,
    "CORS": "*",
    "CORSCredentials": false
  }
}
```

Finally, [run the Function locally](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=v4%2Clinux%2Cnode%2Cportal%2Cbash#start) by calling `func start` on the command-line.

## How this GitHub App was set up

This process looks a bit complex, but the main reason for that is that three things have to be set up essentially simultaneously: an Azure Function, a GitHub repository and a GitHub App.

### The Azure Function

First of all, a new [Azure Function](https://portal.azure.com/#blade/HubsExtension/BrowseResourceBlade/resourceType/Microsoft.Web%2Fsites/kind/functionapp) was created. A Linux one was preferred, for cost and performance reasons. Deployment with GitHub was _not_ yet configured.

#### Getting the "publish profile"

After the deployment succeeded, in the "Overview" tab, there is a "Get publish profile" link on the right panel at the center top. Clicking it will automatically download a `.json` file whose contents will be needed later.

#### Some environment variables

A few environment variables will have to be configured for use with the Azure Function. This can be done on the "Configuration" tab, which is in the "Settings" group.

Concretely, the environment variables `AZURE_PIPELINE_TRIGGER_TOKEN`, `GITHUB_WEBHOOK_SECRET`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_ID` need to be set. For the first, a generated random string was used. The private key, client secret and ID of the GitHub App are not known at this time, though, therefore they will have to be set in the Azure Function Configuration later.

### The repository

On https://github.com/, the `+` link on the top was pressed, and an empty, private repository was registered. Nothing was pushed to it yet.

After that, the contents of the publish profile that [was downloaded earlier](#getting-the-publish-profile) was registered as Actions secret, under the name `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`.

This repository was initialized locally only after that, actually, by starting to write this `README.md` and then developing this working toy GitHub App, and the `origin` remote was set to the newly registered repository on GitHub.

As a last step, the repository was pushed, triggering the deployment to the Azure Function.

### The GitHub App

Finally, [a new GitHub App was registered](https://github.com/settings/apps/new).

The repository URL on GitHub was used as homepage URL.

As Webhook URL, the URL of the Azure Function was used, which can be copied in the "Functions" tab of the Azure Function. It looks similar to this: https://my-github-app.azurewebsites.net/api/MyGitHubApp

The value stored in the Azure Function as `GITHUB_WEBHOOK_SECRET` was used as Webhook secret.

A whole slew of repository permissions was selected (in the least, Contents, Issues, Pull Requests and Workflows as read/write), and also a slew of read-only account permissions.

The GitHub App was subscribed to quite a few events, it would probably have made more sense to start with none at all.

The GitHub App was then restricted to be used "Only on this account", and once everything worked, it was made public (in the "Advanced" tab of the App's settings).

Even at this stage, a private key could not be generated yet, therefore the App had to be registered without it.

After the successful creation, the private key was generated (almost all the way to the bottom, in the section "Private key", there was a button labeled "Generate a private key") and then the middle part (i.e. the lines without the `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----` boilerplate), _without newlines_, was stored as `GITHUB_APP_PRIVATE_KEY` in the Azure Function Configuration (something like `cat ~/Downloads/my-github-app.pem | sed -e 1d -e \$d | tr -d '\n'` prints the desired value).

Likewise, there was now a button labeled "Generate a new client secret" in the "Client secrets" section, and it was used to generate that secret. Subsequently, this secret was stored in the Azure Function Configuration as `GITHUB_APP_CLIENT_SECRET`.

At long last, the "App ID" and the "Client ID" which are reported at the top of the GitHub App page (and which is apparently not _really_ considered to be secret) were stored in the Azure Function Configuration as `GITHUB_APP_ID` and `GITHUB_APP_CLIENT_ID`, respectively.
