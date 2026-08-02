import type { DeliveryInterventionCard } from '@/src/study2/delivery-materials';

export const STUDY2_CARD_PRESENTATION_CSS = `
.s2-intervention-card{box-sizing:border-box;container-type:inline-size;width:100%;max-width:42rem;margin:0;background:#fff;border:1px solid #cbd5e1;border-radius:12px;padding:20px;color:#172033;box-shadow:0 1px 2px rgba(15,23,42,.06);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
.s2-intervention-card *{box-sizing:border-box}
.s2-intervention-card__title{margin:0 0 14px;font-size:1rem;line-height:1.4;font-weight:700;color:#172033}
.s2-intervention-card__rows{display:grid;grid-template-columns:1fr;gap:10px;margin:0}
.s2-intervention-card__row{display:grid;grid-template-columns:minmax(8.75rem,34%) minmax(0,1fr);gap:14px;align-items:start;min-height:3.75rem;padding:11px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px}
.s2-intervention-card__label{margin:0;font-weight:650;color:#334155;overflow-wrap:anywhere}
.s2-intervention-card__text{margin:0;color:#334155;overflow-wrap:anywhere}
@container(max-width:30rem){.s2-intervention-card{padding:16px}.s2-intervention-card__row{grid-template-columns:1fr;gap:4px;min-height:5.75rem}.s2-intervention-card__title{margin-bottom:12px}}
`;

export function Study2InterventionCard({ card }: { card: DeliveryInterventionCard }) {
  return (
    <section className="s2-intervention-card" aria-label="Evidence check">
      <h2 className="s2-intervention-card__title">Evidence check</h2>
      <dl className="s2-intervention-card__rows">
        {card.rows.map((row, index) => (
          <div className="s2-intervention-card__row" key={index}>
            <dt className="s2-intervention-card__label">{row.label}</dt>
            <dd className="s2-intervention-card__text">{row.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
