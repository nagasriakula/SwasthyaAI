# Swasthya AI – Rural Health Screening Platform

An AI-assisted screening platform for India's rural frontline health workers.
**ASHA workers** register patients at the doorstep, capture eye and skin photos,
and get an instant AI screening for **jaundice**, **skin disease** and **anaemia**,
with a Grad-CAM explanation of what the model looked at. High-risk cases go
automatically to the supervising **ANM** for review.

> AI-assisted preliminary screening only. It does not replace a medical diagnosis.

## Features

- **Three roles:** Admin (creates accounts), ANM (supervisor), ASHA (field worker)
- **ANM → ASHA hierarchy:** each ASHA works under one ANM; an ANM sees only
  the patients, screenings and follow-ups of her own ASHA workers
- **Guided photo capture** with an image-quality check (blur, darkness) that asks
  for a retake when the photo is not usable
- **AI screening** with EfficientNet-B5 models, confidence score and
  **Grad-CAM heatmap** for explainability
- **Risk engine:** High / Moderate / Low risk with a plain-language reason
- **ANM priority queue:** unreviewed high-risk cases first; review decisions
  (refer to PHC, recheck, routine) go back to the ASHA
- **Follow-up reminders:** due, overdue and upcoming visits
- **QR health card** for every patient, printable, linked to the screening history
- Audit log of important actions; passwords stored as bcrypt hashes; JWT login

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React, TypeScript, Tailwind CSS, TanStack Query, React Hook Form + Zod |
| Backend | FastAPI, SQLAlchemy 2, Alembic, PostgreSQL |
| AI / ML | PyTorch, EfficientNet-B5, Grad-CAM |
| Auth | JWT (HS256), bcrypt, role-based access control |

## Team

| Member | Work |
|--------|------|
| [@anisha1777](https://github.com/anisha1777) | Backend APIs, database design, ML model training and integration |
| [@nagasriakula](https://github.com/nagasriakula) | Complete frontend, admin account management, ANM → ASHA hierarchy (backend + frontend), API integration |

## Project structure

```
swasthyaai/
  backend/     FastAPI app, database migrations, ML models (ml/)
  frontend/    Next.js app (see frontend/README.md for pages and routes)
```

## Run locally (Windows)

**Requirements:** Python 3.11+, Node.js 18.17+, PostgreSQL.

### Backend
```powershell
cd swasthyaai\backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe -m pip install torch torchvision pillow numpy "qrcode[pil]" email-validator
```
Create `backend\.env` (never commit this file):
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/swasthyaai
JWT_SECRET_KEY=any-long-random-text
```
Create the tables and start the server:
```powershell
.\venv\Scripts\python.exe -m alembic upgrade head
.\venv\Scripts\python.exe create_demo_users.py
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
API documentation: http://127.0.0.1:8000/docs

### Frontend
```powershell
cd swasthyaai\frontend
npm install
npm run dev
```
Open http://localhost:3000

## AI model files

The trained model files (`.pth`) are stored with Git LFS in
`swasthyaai/backend/ml/jaundice/`, `ml/skin/` and `ml/anemia/`.
Install [Git LFS](https://git-lfs.com) before cloning so they download correctly.

## Status

| Screening | Status |
|-----------|--------|
| Jaundice | Working (prediction, risk, Grad-CAM) |
| Skin disease (6 classes) | Working (prediction, risk, Grad-CAM) |
| Anaemia | Model trained; backend integration in progress |

## Future scope

- Anaemia model integration and clinical risk rules
- Offline mode for low-connectivity villages (save screenings, upload later)
- Telugu and Hindi interface
- Automatic follow-up scheduling based on risk level
- Change-password flow for health workers
