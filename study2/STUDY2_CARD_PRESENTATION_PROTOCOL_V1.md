# Study 2 intervention-card presentation protocol v1

**Renderer:** `Study2InterventionCard`
**Viewports:** 375, 768, and 1280 CSS pixels
**Scope:** deterministic geometry and overflow equivalence; not perceptual equivalence

## Single renderer rule

Study 2 cards use one semantic React component and one shared CSS string. Intervention type, match status, answer accuracy, confidence condition, and internal card/source IDs do not appear in the rendered markup or type-specific selectors. Both card types use the same generic heading, three-row definition-list structure, colors, borders, padding, typography, and responsive breakpoint. Row labels and evidence text are the only intended visible differences.

The legacy Study 1 `EvidenceAugmented` component is not a Study 2 renderer and must not be reused as evidence that this contract passed.

## Browser geometry gate

After the completed private bundle passes structural authoring audit, run:

```text
npm run study2:audit-card-presentation -- --bundle <completed-private-bundle.json>
```

The command renders the actual React card component for all 192 cards, then constrains a real headless Chrome/Chromium layout canvas to 375, 768, and 1280 pixels. The component uses a container query, avoiding Chromium’s platform-dependent minimum headless-window width from invalidating the 375-pixel audit. It records 576 card measurements and makes 288 within-answer card-pair comparisons. Every viewport/card identity must appear exactly once. Horizontal overflow is prohibited. Within each answer variant, card width, total height, each row’s relative top position, and each row height must differ by no more than one CSS pixel. The audit binds the delivery bundle, frozen-material lineage, authoring manifest, and renderer source by SHA-256. Set `CHROME_PATH` only when Chrome is installed outside the supported locations.

No output is written until frozen inputs pass structural validation and browser measurements complete. A mismatch produces a nonzero exit and an explicit private audit rather than silently normalizing or truncating card content.

## Readiness boundary

Geometry equality does not prove equal perceived salience, reading difficulty, comprehension, accessibility, or intervention credibility. It also does not prove the participant runner invokes the component correctly. Before pilot readiness, the frozen Study 2 runner must use this renderer, screenshots from the final runtime state must receive independent blinded presentation review, and participant wording/reading-time pretests must pass.
