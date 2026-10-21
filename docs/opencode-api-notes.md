# OpenCode API notes

These notes describe the subset of the OpenCode API used by the bridge. They
were verified against **OpenCode 2.0.24** in October 2026. The upstream API is
not frozen; treat this as a compatibility record, not a specification.

The bridge talks to a loopback OpenCode service with HTTP Basic auth:

```text
Authorization: Basic base64("opencode:" + password)
```

The service URL and password come from
`~/.local/state/opencode/service.json`, or from `OPENCODE_URL` and
`OPENCODE_PASSWORD`. The bridge rejects non-loopback URLs.

## Discovery

Default state file:

```text
~/.local/state/opencode/service.json
```

Expected fields:

```json
{
  "url": "http://127.0.0.1:49374",
  "password": "..."
}
```

`XDG_STATE_HOME` is honored. The bridge also checks the default path if
`XDG_STATE_HOME` is set but the file is not there.

## HTTP endpoints used by the bridge

Most list/detail responses are wrapped in `{ "data": ... }`. The bridge accepts
both wrapped and unwrapped shapes where the upstream has changed over time.

| Method | Path | Used for |
| --- | --- | --- |
| `GET` | `/api/info` | OpenCode version and PID at bridge startup. |
| `GET` | `/api/event` | SSE event stream. |
| `GET` | `/api/session?limit=50&order=desc&parentID=null` | Session list. |
| `GET` | `/api/session/:id` | One session. |
| `POST` | `/api/session` | Create a session with `{ location: { directory }, title? }`. |
| `PATCH` | `/api/session/:id` | Rename with `{ title }`. |
| `DELETE` | `/api/session/:id` | Delete. |
| `GET` | `/api/session/:id/message?limit=&order=&cursor=` | Paged messages. |
| `POST` | `/api/session/:id/prompt` | Send a prompt. |
| `POST` | `/api/session/:id/interrupt` | Interrupt the current turn. |
| `GET` | `/api/permission/request` | All pending permission requests. |
| `GET` | `/api/session/:id/permission` | Permission requests for a session. |
| `POST` | `/api/session/:id/permission/:requestId/reply` | Reply with `{ decision: "once" \| "always" \| "reject" }`. |
| `GET` | `/api/session/:id/form` | Pending forms (questions are forms with `metadata.kind = "question"`). |
| `POST` | `/api/session/:id/form/:formId/reply` | Answer a form with `{ answer }`. |
| `DELETE` | `/api/session/:id/form/:formId` | Cancel a form, optional `message` query. |
| `GET` | `/api/session/:id/diff` | Diff, optional `from` and `to`. |
| `GET` | `/api/session/active` | Active sessions for status reconciliation. |

### Session shape

The fields the bridge depends on:

```ts
interface RawSession {
  id: string;
  parentID?: string;
  projectID: string;
  title?: string;
  time: { created: number; updated: number; archived?: number };
  location?: { directory?: string };
  metadata?: Record<string, unknown>;
}
```

`location.directory` is the workdir used for uploads and the app's session
label. A missing title is displayed as "Untitled session".

### Message shape

The bridge maps two message kinds:

- `type: "user"` with `text`, `time.created`, optional `metadata.source`, and
  optional `files` attachments.
- `type: "assistant"` with `content` parts of `text`, `reasoning`, or `tool`,
  plus `time.completed`.

Assistant tools have a state machine: `streaming`, `running`, `completed`, or
`error`. The bridge turns those into `Activity` summaries and does not render
tool output as chat text.

### Prompt body

```json
{
  "text": "...",
  "files": [{ "uri": "file:///...", "name": "..." }],
  "metadata": { "source": "app" },
  "delivery": "queue",
  "resume": false
}
```

`delivery` is `queue` or `steer`. `resume` is optional. The bridge adds a read
instruction for text and code attachments so the agent opens them with its read
tool instead of treating them as binary.

### Message paging

The upstream returns a cursor even on the last page. The bridge clears
`cursor.next` when the returned page is shorter than the requested limit. If a
cursor is supplied, do not also send `order`; the upstream rejects the
combination.

## SSE events used by the bridge

The upstream stream is `GET /api/event`. Each event has an `id`, `type`, and
optional `data`, `location`, and `durable` fields. The bridge handles:

| Event | Effect |
| --- | --- |
| `session.created` | Broadcasts a session-changed notice. |
| `session.deleted` | Broadcasts a session-changed notice. |
| `session.execution.started` | Status becomes running; clears the diff. |
| `session.execution.succeeded` | Status idle; emits diff; optional push. |
| `session.execution.failed` | Status error; emits a failed message; optional push. |
| `session.execution.interrupted` | Status idle. |
| `session.idle` | Status idle. |
| `session.inbox.enqueued` | Session update. |
| `session.step.started` | Step start. |
| `session.step.ended` | Step end; may complete a message. |
| `session.text.delta` | Streams assistant text. |
| `session.reasoning.delta` | Streams reasoning text. |
| `session.text.ended` | Marks the text channel done. |
| `session.tool.input.started` | Tool input streaming. |
| `session.tool.called` | Tool running. |
| `session.tool.success` | Tool completed. |
| `session.tool.failed` | Tool failed. |
| `session.renamed` | Session title update. |
| `session.metadata.updated` | Session metadata update. |
| `permission.asked` | Emits an approval request. |
| `permission.replied` | Resolves an approval request. |
| `form.created` | Emits a question request when `metadata.kind = "question"`. |
| `form.replied` | Resolves a question as answered. |
| `form.cancelled` | Resolves a question as rejected. |

The bridge also uses the durable event ID for replay. A client that reconnects
with `lastEventId` receives buffered events for the subscribed session. The
buffer is bounded; it is not a full event store.

## Compatibility risks

- Event names and payload fields are the least stable part of the API. A
  renamed event can silently stop a UI update.
- Response envelopes have changed between wrapped and unwrapped shapes. The
  bridge uses `unwrap` helpers, but new fields may still need mapping.
- The form-based question flow is specific to the verified version. A future
  OpenCode release may move questions to a different endpoint.
- The `files` attachment shape uses `file://` URIs. The bridge converts those
  to local paths and back, and only exposes files inside `ALLOWED_WORKDIRS`.
- OpenCode's own permissions still apply. The bridge does not grant tools; it
  only forwards the user's decision.

## Testing a new OpenCode version

1. Start the new OpenCode version.
2. Run the bridge with `LOG_LEVEL=debug`.
3. Open a session, send a prompt, and watch for `session.execution.started`,
   `session.text.delta`, `session.tool.*`, and `session.execution.succeeded`.
4. Ask the agent to request a permission and a question.
5. Run `cd bridge && npm test`.
6. Update this document and the adapter tests if a shape changed.

Do not upgrade a production bridge without a rollback plan.
