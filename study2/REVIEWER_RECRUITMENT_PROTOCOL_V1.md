# Study 2 Domain Reviewer Recruitment Protocol v1

**Round:** `study2-domain-review-round-v2`  
**Unit requiring independence:** one reviewer judgment per candidate scenario  
**Required replication:** two distinct qualified people per candidate within the assigned expertise panel

## Recruitment rule

Recruit against the expertise panel before revealing candidate wording. Do not recruit for agreement with the author’s position, and do not describe provisional answer sides or support labels. One person may cover more than one panel only when their documented expertise satisfies every assigned domain; they may never occupy both seats within the same panel.

## Minimum qualification evidence

Every eligible reviewer must have a verifiable professional identity and at least one documented qualification route appropriate to the panel. Record the evidence privately in the completed reviewer roster.

### Exercise physiology panel

The reviewer must have graduate-level training, active doctoral training, a regulated professional credential, or a documented research/practice record covering exercise physiology or strength and conditioning. Their record must also make review of recovery and environmental exercise claims defensible. If that broader coverage is absent, recruit a replacement rather than silently treating partial expertise as complete.

### Sports nutrition panel

The reviewer must have graduate-level training, active doctoral training, a dietetics or nutrition credential, or a documented research/practice record in sports nutrition, exercise nutrition, or closely related performance nutrition.

### Sports medicine panel

The reviewer must have clinical or research competence relevant to exercise-related injury risk and urgent sport-health decisions, demonstrated through a regulated clinical credential, graduate training, active doctoral training, or a documented sports-medicine research record.

## Identity verification

Use at least one stable, independently checkable source such as an institutional profile, professional-register entry, ORCID-linked publication record, or comparable public credential. Store only the verification method and a private stable person ID in the roster; do not commit names, emails, profile URLs, or contact histories.

## Exclusion conditions

A person is ineligible for the affected round when any of the following applies:

- they authored or substantively edited a candidate scenario, evidence dossier, provisional label, or review code;
- they would fill both independent seats within the same panel;
- they cannot attest that they will avoid the paired reviewer’s responses until both submissions are locked;
- a financial, supervisory, personal, or publication conflict cannot be disclosed and managed;
- their compensation depends on agreement, recommendation, candidate retention, or any target distribution;
- their documented expertise does not cover every domain assigned to their packet.

## Compensation and burden disclosure

Disclose the exact item count before consent: 15 items for exercise physiology, 8 for sports nutrition, and 4 for sports medicine. State whether participation is voluntary or uses a fixed honorarium. Never condition payment on completion speed, agreement, or favorable judgments. Set the amount before review begins and record the arrangement privately.

## Dispatch sequence

1. Screen identity, expertise, conflicts, material-contribution history, and compensation terms without showing provisional labels.
2. Assign the person a stable private ID and exactly one seat per eligible panel.
3. Complete and validate `reviewer-roster.completed.json` before accepting review submissions.
4. Send only that assignment’s `.review-form.html` and the generic reviewer protocol.
5. Preserve the returned JSON unchanged in the gitignored private directory.
6. Do not disclose another reviewer’s response or any crosswalk until the paired submissions validate.

## Prohibited claims

Recruitment, roster completion, or credential verification does not establish construct validity or reviewer agreement. Those claims require valid completed submissions, the panel pair audits, adjudication where required, and the final round coverage audit.
