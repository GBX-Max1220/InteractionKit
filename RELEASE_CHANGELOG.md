# InteractionKit v1.0 Release Changelog

Preparation date: 2026-07-31 (Asia/Shanghai)

Status: release candidate; not tagged

## Release-preparation changes

- Set repository package version metadata to `1.0.0`.
- Added the frozen artifact claim to package metadata.
- Declared the Next.js-compatible Node.js requirement (`>=20.9.0`).
- Aligned application title and description metadata with the frozen artifact claim.
- Added lockfile-reproducible installation and verification commands to the README.
- Documented the intended v1.0 artifact scope and the boundary between the Pattern System and the pre-existing legacy study flow.
- Removed the release-facing link to the unimplemented Trace Validator plan.
- Added the MIT License and aligned the README license statement.
- Created `RELEASE_AUDIT.md`, `RELEASE_PLAN.md`, and this changelog.

## Pre-existing work included in the release candidate

The following implementation work existed before this release-preparation pass and was not changed by it:

- three Pattern JSON specifications;
- typed Pattern, composition, renderer, and measurement metadata contracts;
- Sequence and Choice compatibility checks;
- derived schema generation with column-origin metadata;
- AJV-backed Pattern output validation;
- self-describing JSONL serialization;
- three existing Pattern renderers and the `/patterns` demo;
- seven Pattern System tests;
- aligned README and architecture documentation.

## Explicit non-changes

- No Pattern primitive was added.
- No Trace Validator was implemented.
- No architecture, composition behavior, schema, renderer, or logging semantics changed.
- No legacy study component or experiment methodology changed.
- No Study 2, ethics, power-analysis, or review material changed.
- No dependency version changed.
- No final paper citation was invented.
- No Git commit or tag was created.
