'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Patient } from '@/types/api';
import { ErrorState } from './ui';

const optionalText = z.string().trim().max(500, 'Keep this under 500 characters.');

/** All fields are strings in the form; toPatientValues converts them for the API. */
export const patientSchema = z.object({
  name: z.string().trim().min(2, 'Enter the full name.').max(100),
  age: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, 'Enter age in whole years.')
    .refine((v) => Number(v) <= 120, 'Age must be 120 or less.'),
  gender: z.string().refine((v) => ['Female', 'Male', 'Other'].includes(v), 'Choose gender.'),
  village: z.string().trim().min(2, 'Enter the village.').max(100),
  guardian_name: optionalText,
  contact: z
    .string()
    .trim()
    .refine((v) => !v || /^[6-9]\d{9}$/.test(v), 'Enter a 10-digit mobile number, or leave it empty.'),
  symptoms: optionalText,
  medical_history: optionalText,
});

export type PatientFormFields = z.infer<typeof patientSchema>;

export interface PatientFormValues {
  name: string;
  age: number;
  gender: string;
  village: string;
  guardian_name: string | null;
  contact: string | null;
  symptoms: string | null;
  medical_history: string | null;
}

function toPatientValues(f: PatientFormFields): PatientFormValues {
  const opt = (v: string) => (v.trim() ? v.trim() : null);
  return {
    name: f.name.trim(),
    age: Number(f.age),
    gender: f.gender,
    village: f.village.trim(),
    guardian_name: opt(f.guardian_name),
    contact: opt(f.contact),
    symptoms: opt(f.symptoms),
    medical_history: opt(f.medical_history),
  };
}

export function PatientForm({
  defaults,
  submitLabel,
  submittingLabel,
  serverError,
  consentRequired,
  onSubmit,
  onCancel,
}: {
  defaults?: Partial<Patient>;
  submitLabel: string;
  submittingLabel: string;
  serverError?: string;
  consentRequired?: boolean;
  onSubmit: (values: PatientFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormFields>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      name: defaults?.name ?? '',
      age: defaults?.age !== undefined ? String(defaults.age) : '',
      gender: defaults?.gender ?? '',
      village: defaults?.village ?? '',
      guardian_name: defaults?.guardian_name ?? '',
      contact: defaults?.contact ?? '',
      symptoms: defaults?.symptoms ?? '',
      medical_history: defaults?.medical_history ?? '',
    },
  });
  const gender = watch('gender');

  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        if (consentRequired) {
          const box = document.getElementById('consent') as HTMLInputElement | null;
          if (!box?.checked) {
            box?.focus();
            document.getElementById('consent-error')?.removeAttribute('hidden');
            return;
          }
        }
        await onSubmit(toPatientValues(v));
      })}
      noValidate
      className="panel space-y-5 p-5 sm:p-6"
    >
      <div>
        <label htmlFor="name" className="label">Full name</label>
        <input id="name" className="input" autoComplete="off" aria-invalid={!!errors.name} {...register('name')} />
        {errors.name && <p className="field-error">{errors.name.message}</p>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="age" className="label">Age (years)</label>
          <input id="age" type="number" inputMode="numeric" min={0} max={120} className="input" aria-invalid={!!errors.age} {...register('age')} />
          {errors.age && <p className="field-error">{errors.age.message}</p>}
        </div>
        <div>
          <span className="label">Gender</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Gender">
            {(['Female', 'Male', 'Other'] as const).map((g) => (
              <button
                type="button"
                key={g}
                role="radio"
                aria-checked={gender === g}
                onClick={() => setValue('gender', g, { shouldValidate: true })}
                className={`rounded-lg py-2.5 font-medium ring-1 ring-inset ${
                  gender === g ? 'bg-neem-700 text-white ring-neem-700' : 'bg-white ring-line hover:ring-neem-500'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          {errors.gender && <p className="field-error">{errors.gender.message}</p>}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="village" className="label">Village</label>
          <input id="village" className="input" aria-invalid={!!errors.village} {...register('village')} />
          {errors.village && <p className="field-error">{errors.village.message}</p>}
        </div>
        <div>
          <label htmlFor="contact" className="label">Mobile number (optional)</label>
          <input id="contact" type="tel" inputMode="numeric" maxLength={10} className="input" aria-invalid={!!errors.contact} {...register('contact')} />
          {errors.contact && <p className="field-error">{errors.contact.message}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="guardian_name" className="label">Father / husband / guardian (optional)</label>
        <input id="guardian_name" className="input" {...register('guardian_name')} />
      </div>

      <div>
        <label htmlFor="symptoms" className="label">Current symptoms (optional)</label>
        <textarea id="symptoms" rows={2} className="input" placeholder="For example: tiredness, yellow eyes" {...register('symptoms')} />
        {errors.symptoms && <p className="field-error">{errors.symptoms.message}</p>}
      </div>

      <div>
        <label htmlFor="medical_history" className="label">Medical history (optional)</label>
        <textarea id="medical_history" rows={2} className="input" placeholder="Pregnancy, past illness, regular medicines" {...register('medical_history')} />
        {errors.medical_history && <p className="field-error">{errors.medical_history.message}</p>}
      </div>

      {consentRequired && (
        <div>
          <label className="flex items-start gap-3">
            <input
              id="consent"
              type="checkbox"
              className="mt-1 h-5 w-5 accent-neem-700"
              onChange={() => document.getElementById('consent-error')?.setAttribute('hidden', '')}
            />
            <span>The person (or guardian) agrees to share health details and photos for screening.</span>
          </label>
          <p id="consent-error" hidden className="field-error">Consent is needed before registering.</p>
        </div>
      )}

      {serverError && <ErrorState message={serverError} />}

      <div className="flex flex-wrap gap-3 pt-1">
        <button type="submit" className="btn btn-primary px-6 py-3" disabled={isSubmitting}>
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
