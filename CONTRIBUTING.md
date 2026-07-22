# Contributing to Juxta

Thanks for your interest in contributing! Juxta accepts contributions from anyone via pull
requests — only the maintainer merges to `main`.

## Workflow

1. **Fork** this repository to your own GitHub account.
2. **Clone** your fork and create a branch for your change:
   ```
   git checkout -b my-feature
   ```
3. Make your change. Please:
   - Run `npm run typecheck` and `npm test` before opening a PR.
   - Keep the change focused — one feature/fix per PR.
   - Follow the existing commit style (`feat:`, `fix:`, `docs:`, `build:`, ...).
4. Push your branch to your fork and **open a pull request** against `Rajeev0814/juxta`'s `main`
   branch.
5. The maintainer will review, may request changes, and will merge once approved. `main` is
   protected — nobody merges without review, including the maintainer.

## Reporting bugs / requesting features

Open a GitHub Issue with steps to reproduce (for bugs) or a clear description of the use case
(for feature requests). Check `FEATURES.md` first — it tracks planned work and may already cover
your idea.

## Development setup

See the [README](README.md#commands) for `npm run dev`, `npm test`, and `npm run typecheck`.
