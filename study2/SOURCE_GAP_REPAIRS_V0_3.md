# Study 2 Source-Gap Repairs v0.3

**Material version audited:** `study2-candidates-v0.3`
**Access date:** 2026-08-02
**Status:** metadata and source-to-outcome mapping checked; independent domain review pending

**Subsequent change:** `strong_03`, `strong_05`, and `strong_07` were repaired in `study2-candidates-v0.5`; `strong_11` was replaced with a youth-specific supervised-progression item in `study2-candidates-v0.6`. See `CANDIDATE_REPAIR_V0_5.md` and `CANDIDATE_REPAIR_V0_6.md`. The current machine-readable registry has no open source-path gaps; the v0.3 findings below remain as an audit trail.

This audit replaces sources whose topic was adjacent to, but did not directly support, the candidate's stated decision outcome. Counting an adjacent source toward the two-source threshold would create false provenance completeness.

## Closed gap: `mixed_04`

The removed source concerned post-activation performance enhancement rather than static-versus-dynamic stretching.

Replacement:

- Li FY, Guo CG, Li HS, Xu HR, Sun P. “A systematic review and net meta-analysis of the effects of different warm-up methods on the acute effects of lower limb explosive strength.” *BMC Sports Science, Medicine and Rehabilitation*. 2023;15:106. DOI: `10.1186/s13102-023-00703-6`; PMID: `37644585`; PMCID: `PMC10463540`.

Direct mapping: the review includes static and dynamic stretching and reports jump and sprint outcomes. Dynamic stretching improved countermovement-jump and sprint outcomes relative to control, while static stretching adversely affected sprint performance. The review also reports substantial moderation and methodological limitations, so it supports the bounded decision but not a universal dose.

## Closed gap: `mixed_12`

The removed source emphasized strength and power recovery, whereas the candidate fixes comfort as the outcome.

Replacement:

- Dupuy O, Douzi W, Theurot D, Bosquet L, Dugué B. “An Evidence-Based Approach for Choosing Post-exercise Recovery Techniques to Reduce Markers of Muscle Damage, Soreness, Fatigue, and Inflammation: A Systematic Review With Meta-Analysis.” *Frontiers in Physiology*. 2018;9:403. DOI: `10.3389/fphys.2018.00403`; PMID: `29755363`; PMCID: `PMC5932411`.

Direct mapping: the synthesis reports effects on delayed-onset muscle soreness and perceived fatigue and includes compression garments among the evaluated recovery methods. It matches the candidate's comfort outcome more directly than a strength/power-only synthesis.

## Gaps still open

- `strong_03`: the wording says sleep is repeatedly restricted, but the two shortlisted syntheses primarily evaluate acute loss. Narrow the scenario or add a repeated-restriction synthesis.
- `strong_05`: the position stand supports creatine efficacy, but the second source emphasizes body composition rather than the prompt's strength outcome. Add a strength-specific synthesis.
- `strong_07`: the sources concentrate on exertional heat illness or heat stroke, while the prompt's “compatible with heat illness” wording is broader. Narrow the condition or add guidance covering the full prompt.
- `strong_11`: general resistance-training position stands support progressive loading but do not cleanly validate a universal technique-before-load binary rule across complex exercises. Narrow the movement context or obtain technique-specific consensus evidence.

The machine-readable registry in `src/study2/evidence-paths.ts` therefore records 27 triaged candidates, 23 ready to advance to dossier drafting, and four with an explicit source gap. Neither closed gap changes a candidate to `source_dossier_complete`. Full source mapping, two independent reviews, and adjudication remain required.
