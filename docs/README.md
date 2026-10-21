# Documentation

Start with the project [README](../README.md). These files go deeper:

| Document | What it covers |
| --- | --- |
| [Architecture](architecture.md) | Components, data flow, REST/WebSocket protocol, storage, and boundaries. |
| [Security](security.md) | Threat model, token scope, upload controls, deployment checklist, and known gaps. |
| [Development](development.md) | Local setup, checks, web export, Android/iOS builds, and server notes. |
| [Troubleshooting](troubleshooting.md) | Symptoms, causes, and fixes for the bridge and app. |
| [OpenCode API notes](opencode-api-notes.md) | Endpoints and events verified against OpenCode 2.0.24. |
| [Design](design.md) | Monochrome design system, typography, layout, and accessibility. |
| [Screenshots](images/README.md) | Capture requirements and the privacy checklist for README images. |

## Conventions

- Commands are written for a POSIX shell unless a Windows alternative is shown.
- `bridge/` and `app/` are independent npm projects with their own lockfiles.
- The repository root has convenience scripts only; it is not an npm workspace.
- "Bridge" means the local Fastify service, not the OpenCode service itself.

## Source of truth

The code and lockfiles are authoritative. This documentation describes the
current beta and may lag behind a local change. If a command or endpoint does
not match, open an issue with the OpenCode version and the bridge version from
`GET /config`.
