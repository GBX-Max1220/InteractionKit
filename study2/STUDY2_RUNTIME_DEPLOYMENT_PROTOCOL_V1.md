# Study 2 Runtime Deployment Protocol v1

The participant runtime may be seeded only after the private deployment gate is explicitly marked `approved_for_pilot`. This gate does not manufacture approval: it binds the exact allocation, frozen materials, delivery bundle, taxonomy finalization, card-safety finalization, and browser presentation audit to one authorization record. It also records the real ethics approval reference, preregistration reference, authorizer, recruitment source, authorization time, and credential-free HTTPS participant URL.

The seeder independently canonicalizes and hashes all six bound artifacts, requires the frozen 240-participant allocation, audits the allocation, resolves every one of the 3,840 participant-trial combinations, and rejects material-version drift. Missing, placeholder, modified, or differently serialized semantic content cannot silently pass an existing gate because hashes are computed over canonical JSON values.

Run only against the migrated production PostgreSQL database:

```text
npm run study2:seed-runtime -- \
  --allocation <private-allocation.json> \
  --bundle <completed-private-delivery-bundle.json> \
  --frozen <private-frozen-materials.json> \
  --taxonomy-finalization <private-taxonomy-finalization.json> \
  --card-safety-finalization <private-card-safety-finalization.json> \
  --presentation-audit <private-presentation-audit.json> \
  --gate <private-runtime-deployment-gate.json> \
  --output <private.study2-access-manifest.json>
```

Required environment variables are `STUDY2_DATABASE_URL`, a 32-byte base64 `STUDY2_RUNTIME_ENCRYPTION_KEY`, and either `STUDY2_DATABASE_CA_BASE64` or the explicit local-only override `STUDY2_DATABASE_SSL=disable`. Production TLS never falls back to an unverified connection.

All 240 encrypted rows are inserted with one PostgreSQL statement, so a duplicate or database failure rolls back the entire batch. Runtime state is compressed before AES-256-GCM encryption and bound to the access-token hash as authenticated additional data. Raw access tokens never enter the database.

The private access manifest is written with owner-only permissions where supported and is never printed to stdout. Its filename must end in `.study2-access-manifest.json`, which is gitignored. Recruitment tooling must distribute exactly one fragment-based URL per participant; the browser removes the fragment before rendering study content.

Current repository state deliberately contains no approved deployment gate and no private access manifest. Therefore seeding cannot succeed from committed public artifacts. Real human reviews, ethics approval, preregistration, completed material authoring, and the final browser audit remain external prerequisites.
