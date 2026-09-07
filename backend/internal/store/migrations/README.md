# Store migrations

The SQL files are embedded by the Go migration runner. `001_initial.sql` is
the authoritative database DDL from `docs/implementation/database/001_initial.sql`.
It retains the source file's outer `BEGIN` and `COMMIT`; the runner removes
only those two script-level statements and applies the effective body inside
one transaction together with its `schema_migrations` record.

`002_mobile_auth_time.sql` is an additive service migration. The mobile OIDC
callback creates a one-time code before the native app exchanges it for an
opaque session. The code must carry the issuer's original `auth_time` across
that handoff so the service can enforce recent reauthentication for export and
account deletion. Callback time cannot replace that value.
