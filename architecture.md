# Architecture

## High-Level Overview

```mermaid
graph TD
    subgraph "Azure"
        function(Azure Function);
    end

    subgraph org[GitHub]
        app(Git for Windows Helper App);
        yml(git-for-windows-automation)
    end

    app -->|webhook| function
    function -->|workflow_dispatch| yml
```

### GitHub App

TODO

### Azure Function

TODO

### Automation Workflows

TODO

## Example: Windows/ARM64 Runners

```mermaid
sequenceDiagram
    autonumber

    participant yml-build as build-installers.yml
    participant app as GitHub App
    participant func as Azure Function
    participant yml-create as create-azure-self-<br>hosted-runners.yml
    participant yml-delete as delete-self-<br>hosted-runner.yml
    participant runner as GitHub Runner<br>(ARM64)


    yml-build -->> app: event: queued
    activate yml-build
    activate app
    app ->> func: webhook
    deactivate app
    activate func
    note over yml-build: Wait for runner<br>to be ready
    func ->> yml-create: workflow_dispatch
    deactivate func
    activate yml-create
    yml-create ->> runner: deploy
    note over runner: Provision VM<br>Install Runner<br>Register Runner
    runner -->> yml-build: available
    activate runner
    deactivate yml-create
    yml-build ->> runner: run
    note over yml-build,runner: Execute Job
    yml-build -->> app: event: completed
    deactivate yml-build
    activate app
    app ->> func: webhook
    deactivate app
    activate func
    func ->> yml-delete: workflow_dispatch
    deactivate func
    activate yml-delete
    yml-delete ->> runner: delete
    deactivate runner
    note over runner: Deregister Runner<br>Destroy VM
    deactivate yml-delete
```

1. The GitHub App receives an event that a workflow is queued.
2. The GitHub App notifies the Azure Function via a webhook.
3. The Azure Function receives the event and sees this is a workflow that requires an 'Windows/ARM64' runner.
   The function triggers the `create-azure-self-hosted-runners.yml` workflow via `workflow_dispatch`.
4. The workflow authenticates to Azure, provisions a VM via ARM, installing the GitHub runner, and registers it with GitHub.
5. The runner is now marked as available with the labels 'Windows/ARM64'.
6. The job starts to run on the new 'Windows/ARM64' runner.
7. The workflow completes and the GitHub App receives the event.
8. The GitHub App notifies the Azure Function via a webhook.
9. The Azure Function receives the event and triggers the `delete-self-hosted-runner.yml` workflow via `workflow_dispatch`.
10. The workflow starts to run, authenticates to Azure, deregisters the runner from GitHub, and destroys the VM.
