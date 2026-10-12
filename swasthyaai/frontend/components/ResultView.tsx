'use client';

import { fileUrl } from '@/lib/api';
import { SCREENING_LABEL, formatDate, formatPercent, predictionLabel, recommendations, splitList } from '@/lib/format';
import type { RiskLevel, ScreeningType } from '@/types/api';
import { RiskBadge } from './ui';

const BAND: Record<RiskLevel, string> = {
  HIGH: 'bg-risk-highbg',
  MODERATE: 'bg-risk-moderatebg',
  LOW: 'bg-risk-lowbg',
};

export interface ResultData {
  screeningType: ScreeningType;
  date: string;
  prediction: string;
  confidence: number;
  riskLevel: RiskLevel;
  riskReason: string | null;
  modelVersion: string | null;
  riskEngineVersion: string | null;
  gradcamPath: string | null;
  imagePath?: string | null;
  symptoms?: string | null;
}

export function ResultView({ r }: { r: ResultData }) {
  const pct = Math.round((r.confidence <= 1 ? r.confidence : r.confidence / 100) * 100);
  const gradcam = fileUrl(r.gradcamPath);
  const original = fileUrl(r.imagePath);
  const recs = recommendations(r.screeningType, r.riskLevel, r.prediction);
  const symptoms = splitList(r.symptoms);

  return (
    <div className="space-y-5">
      <section className="panel overflow-hidden">
        <div className={`px-5 py-5 ${BAND[r.riskLevel]}`}>
          <div className="text-sm font-medium text-muted">
            {SCREENING_LABEL[r.screeningType]} screening, {formatDate(r.date)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="text-3xl font-semibold leading-tight">{predictionLabel(r.prediction, r.screeningType)}</h2>
            <RiskBadge level={r.riskLevel} />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 w-44 overflow-hidden rounded-full bg-white/80">
              <div className="h-full rounded-full bg-neem-700" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-medium tabular-nums">{formatPercent(r.confidence)} model confidence</span>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5">
          {r.riskReason && (
            <div>
              <h3 className="font-semibold">Why this risk level</h3>
              <p className="mt-1 text-muted">{r.riskReason}</p>
            </div>
          )}

          {symptoms.length > 0 && (
            <div>
              <h3 className="mb-2 font-semibold">Symptoms recorded</h3>
              <div className="flex flex-wrap gap-1.5">
                {symptoms.map((s) => (
                  <span key={s} className="rounded-full bg-neem-50 px-3 py-1 text-sm">{s}</span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="font-semibold">Where the model looked (Grad-CAM)</h3>
            {gradcam ? (
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {original && (
                  <figure>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={original} alt="Screening photo" onError={(e) => ((e.currentTarget.parentElement as HTMLElement).style.display = 'none')} className="aspect-square w-full rounded-lg bg-paper object-contain ring-1 ring-line" />
                    <figcaption className="mt-1 text-sm text-muted">Photo</figcaption>
                  </figure>
                )}
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={gradcam} alt="Grad-CAM heatmap" className="aspect-square w-full rounded-lg bg-paper object-contain ring-1 ring-line" />
                  <figcaption className="mt-1 text-sm text-muted">Warmer colours = areas that most influenced the model</figcaption>
                </figure>
              </div>
            ) : (
              <p className="mt-1 text-muted">No heatmap was generated for this screening.</p>
            )}
            <p className="mt-2 rounded-lg bg-paper px-3 py-2 text-sm text-muted">
              The heatmap shows model attention. It is an interpretability aid, not proof of a cause and not a diagnosis.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">Recommended next steps</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {recs.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-muted">General guidance only, not a prescription.</p>
          </div>

          <p className="border-t border-line pt-4 text-sm text-muted">
            AI-assisted preliminary screening. It does not replace a medical diagnosis; the ANM or doctor decides on treatment.
            {(r.modelVersion || r.riskEngineVersion) && (
              <>
                {' '}
                Model {r.modelVersion || '—'}, risk rules {r.riskEngineVersion || '—'}.
              </>
            )}
          </p>
        </div>
      </section>
    </div>
  );
}
