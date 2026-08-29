# Blinko Habits

A calm daily habit tracker for Blinko. Create flexible routines, check in on scheduled days, and review current and best streaks.

Each habit is stored as an installation-owned App entity. The App has no network, notification, timer, or background-job permission and never polls the database.

## Development

```bash
bun install
bun test
bun run typecheck
bun run validate
bun run build
```

## License

MIT
