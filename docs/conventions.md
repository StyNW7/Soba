# Conventions

Read before your first commit.

## Branches

Branch off `main`. Name branches `type/short-description`:

```
feat/conversation-history
fix/audio-dropout-on-reconnect
docs/hardware-decision
chore/backend-lint-config
```

Keep a branch scoped to one module where you can — it makes review faster and conflicts
rarer.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): short imperative summary

Optional body explaining why, not what. The diff already says what.
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
Scopes: `frontend`, `backend`, `iot`, `docs`, or omit for repo-wide changes.

```
feat(backend): add utterance transcription endpoint
fix(iot): stop dropping first audio frame after wake
docs: record hardware decision
```

Write the summary as an instruction ("add", not "added" or "adds"), keep it under about 70
characters, and do not end it with a period.

## Pull requests

- One reviewer minimum before merge.
- Describe what changed and why. Link the issue if there is one.
- If the change touches user wellbeing, voice data, or crisis handling, say so explicitly in
  the description and expect a closer read. See
  [`safety-and-privacy.md`](safety-and-privacy.md).
- Keep `main` in a state where it could be demoed.

## Code style

Formatting is not a matter of taste here — let the tools decide so review can be about
substance.

| Module | Format | Lint |
| ------ | ------ | ---- |
| `backend/` | `gofmt` (or `gofumpt`) | `golangci-lint` |
| `frontend/` | Prettier | ESLint |
| `iot/` | `clang-format` | toolchain default |

Run formatters before committing. Do not mix a formatting sweep into a feature commit —
it hides the actual change.

## Environment variables

- Every new variable gets added to `.env.example` with a comment, and a name only.
- **Never commit a real value.** Not in `.env`, not in a test fixture, not in a code
  comment, not "temporarily".
- If a secret does get committed, treat it as compromised: rotate it, then clean history.
  Removing the line in a follow-up commit does not undo anything.

## CI

Every push and pull request runs [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

**Runs now, on every change:**

- No `.env` is tracked in git.
- Every relative link in the docs points at a file that exists, and every `#anchor`
  points at a heading that exists.
- The secret-valued keys in `.env.example` are still empty.

Run the same checks yourself before pushing:

```bash
python3 scripts/check_docs.py
```

**Switches on by itself later.** The backend and frontend jobs are skipped while their
module is empty, and start running in the same PR that adds `backend/go.mod` or
`frontend/package.json`. Nobody has to remember to enable them.

- **Backend:** `gofmt`, `go vet`, `go build`, `go test -race`.
- **Frontend:** install, then `lint`, `typecheck`, `test` and `build` — each one only if
  that script exists in `package.json`, so the app can land before its tooling does.
  Works with either an npm or a pnpm lockfile.

If you add a job, keep this rule: **CI must be green on a repo where your module does not
exist yet.** A red check that everyone learns to ignore is worse than no check.

Requiring CI to pass before merge is a branch protection setting, and only a repo admin
can turn it on.

## Documentation

When you make a decision that closes one of the open questions in
[`architecture.md`](architecture.md), write it down there in the same PR. A decision that
lives only in a chat thread will be re-litigated in three weeks.
