# Neon workflow

- For a feature, create a matching Git branch and Neon branch with `neon checkout <branch-name> --create --no-env-pull`.
- Use the existing Neon project and database connection. Do not provision another project or replace `DATABASE_URL` unless asked.
- Prefer project-scoped API keys for automation.
- Run `neon diff` before merging schema changes and use `neon inspect db` for read-only database diagnostics.
