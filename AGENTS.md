# Commit conventions

Use Conventional Commits for every change. Release automation derives semantic
versions and changelog entries from these prefixes:

- `fix: ...` — patch release (bug fix)
- `feat: ...` — minor release (backward-compatible feature)
- `feat!: ...`, `fix!: ...`, or another type followed by `!` — major release
  (breaking change)
- `docs: ...`, `chore: ...`, `ci: ...`, `refactor: ...`, and `test: ...` — no
  release by default unless the commit includes a `BREAKING CHANGE:` footer

Keep each commit focused, imperative, and scoped when useful, for example:
`feat(ios): expose challenge options`.
