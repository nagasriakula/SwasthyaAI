# SwasthyaAI – Frontend

Next.js 14 (App Router) + React + TypeScript + Tailwind CSS, with TanStack Query,
React Hook Form and Zod, as specified in the PRD.

## Run

Requires Node.js 18.17 or newer, and the FastAPI backend running on port 8000.

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

If the backend runs somewhere other than `http://localhost:8000`, copy `.env.example`
to `.env.local` and change `BACKEND_URL`.

### How the frontend reaches the backend

The browser only talks to the Next.js server. `next.config.mjs` forwards every
`/api/...` and `/uploads/...` request to FastAPI, so CORS is not needed during
development. (For a deployment where frontend and backend are on different domains,
the backend still needs CORS for the frontend's URL.)

## Demo accounts

Created by `backend/create_demo_users.py`:

| Role | Email | Password |
|------|-------|----------|
| ASHA | asha@swasthyaai.com | Asha@12345 |
| ANM | anm@swasthyaai.com | Anm@12345 |
| Admin (supervisor) | admin@swasthyaai.com | Admin@12345 |

If `create_anm.py` was run first, the ANM password is `anm12345` instead.

## What is built

Every page in the PRD site map (§9.2) for the ASHA and ANM roles:

| Route | Who | What it does | Backend endpoints |
|-------|-----|--------------|-------------------|
| `/login` | both | Choose role, email + password, role check | `POST /api/auth/login`, `GET /api/auth/me` |
| `/dashboard/asha` | ASHA | Quick actions, counts, recent patients/screenings, next visit, follow-ups, risk and condition summary | `GET /api/dashboard/asha` |
| `/dashboard/anm` | ANM | Priority queue (unreviewed first, then High → Moderate → Low), follow-up status, by-village table | `GET /api/dashboard/anm`, `GET /api/followups` |
| `/patients` | both | Search; ASHA sees her own patients, ANM sees her ASHA workers' patients and can filter by ASHA | `GET /api/patients/`, `GET /api/auth/my-ashas` |
| `/patients/new` | ASHA | Registration with validation and consent; patient code generated; goes straight to screening | `POST /api/patients/` |
| `/patients/[id]` | both | Details, printable QR health card, screening history, progress comparison, follow-ups | `GET /api/patients/{id}`, health card (below) |
| `/patients/[id]/edit` | both | Edit details | `PUT /api/patients/{id}` |
| `/screening/capture` | ASHA | Choose patient → Anaemia / Jaundice / Skin → guided live-camera or upload → symptoms → analyse. A failed quality check shows the reason and asks for a recapture | `POST /api/screenings`, `POST /api/screenings/{id}/analyze` |
| `/screening/results/[id]` | both | Prediction, confidence, risk + reason, Grad-CAM with disclaimer, recommendations, model version; ASHA schedules a follow-up; ANM records a review decision | `GET /api/screenings/{id}`, `GET .../result`, follow-ups |
| `/reminders` | both | Follow-ups by status (Open, Overdue, Due, Upcoming, Completed, Cancelled); mark done, reschedule, cancel | `GET/PUT /api/followups` |
| `/qr-scan` | both | Camera QR scanner, or paste a card link | – |
| `/health-card/[token]` | both | Record opened from a scanned card (inside the signed-in area) | `GET /api/health-card/{token}` |
| `/admin/users` | Admin | Create ASHA/ANM accounts, choose each ASHA's supervising ANM, move an ASHA to another ANM, activate/deactivate | `GET/POST /api/auth/users`, `PUT /api/auth/users/{id}/status`, `PUT /api/auth/users/{id}/anm` |
| `/profile` | all | Account details, sign out | – |

## How some features work with the current backend

These use existing endpoints because the matching endpoint does not exist yet.
When Member 1 adds the endpoint, only `lib/api.ts` and the named file change.

- **Screening history** (`hooks/usePatientRecord.ts`): there is no
  “screenings of a patient” endpoint, so the profile calls
  `POST /api/healthcard/{id}` (returns the existing card) and then
  `GET /api/health-card/{token}`, which returns the screenings and follow-ups.
- **ANM review** (`components/ReviewPanel.tsx`): there is no review endpoint, so
  the decision (refer / recheck / routine) is saved on the screening’s follow-up,
  with notes starting `ANM REVIEW:`. The ASHA sees it highlighted in her follow-ups.
- **Recommendations** (`lib/format.ts → recommendations`): general rule-based
  guidance by condition and risk, because the backend has no recommendation endpoint.
- **Skin class names** (`lib/format.ts → SKIN_CLASS_NAMES`): the model returns
  codes (AD, CD, EC, SC, SD, TC). Fill in the confirmed names there; until then
  the code is shown.
- **Follow-up assignment**: the ASHA dashboard counts only follow-ups assigned to
  that ASHA, so every follow-up (including ANM review decisions) is assigned to the
  ASHA who registered the patient (`patient.registered_by`).
- **ANM → ASHA hierarchy**: each ASHA has a supervising ANM (`users.anm_id`).
  The backend rule in `app/core/access.py` decides who sees which patient: Admin
  all, ANM the patients of her ASHA workers, ASHA only her own. Screenings,
  follow-ups, dashboards and health cards follow the patient. Moving an ASHA to
  another ANM moves her patients with her.
- **Accounts**: there is no public sign-up. The Admin creates each ASHA/ANM account
  with a temporary password. There is no change-password or forgot-password endpoint yet.
- **QR content**: the card shows a QR made in the browser containing
  `<this site>/health-card/<token>`. The scanner also accepts the backend’s own
  QR image link and a bare token.

## Backend items still needed (for Member 1)

1. Serve images: `app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")`
   in `main.py`, otherwise Grad-CAM images do not load.
2. Anaemia: `/analyze` returns 501 “Anemia model integration is pending”; the
   app shows that message. The anaemia risk rule is also not configured.
3. Nice to have: `GET /api/patients/{id}/screenings`, a review endpoint, and
   `patient_name` in dashboard items.

## Structure

```
app/
  layout.tsx              root layout, font, providers
  providers.tsx           React Query + auth
  login/page.tsx          role choice + email/password sign-in
  (app)/layout.tsx        requires sign-in, renders the app shell
  (app)/dashboard/asha    ASHA dashboard
  (app)/dashboard/anm     ANM dashboard
  (app)/...               patients, screening, qr-scan, reminders, profile
components/               AppShell, RoleGuard, dashboard parts, UI pieces, icons
lib/api.ts                the only place that calls the backend
lib/auth.tsx              session, login, logout, 401 handling
lib/format.ts             labels, dates, percentages
hooks/usePatients.ts      patient list + lookup by id
hooks/usePatientRecord.ts profile + QR token + history
types/api.ts              TypeScript types matching the FastAPI responses
```

## Notes for the backend team

- The dashboards return only `patient_id`, so the frontend also loads `GET /api/patients/`
  to show names. Adding `patient_name`, `patient_code` and `village` to dashboard items
  would remove that extra request.
- The ANM priority queue is built from `recent_screenings` (latest 10). A dedicated
  queue endpoint ordered by risk would cover all pending cases.
