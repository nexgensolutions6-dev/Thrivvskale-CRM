# CRM

Lead management app: one place for leads from every source, with table and Kanban views.

- **Frontend:** React, TypeScript, Vite (`frontend/`)
- **Backend:** Python, FastAPI, SQLAlchemy (`backend/`)
- **Database:** PostgreSQL on any cloud provider

## Setup

You need Python 3.12+, Node 22+ and a PostgreSQL database.

### 1. Database

Create a PostgreSQL database with a cloud provider such as Neon, Supabase, Railway, AWS RDS or Azure,
and copy its connection string.

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Edit `backend/.env`:

- `DATABASE_URL`: your connection string
- `SECRET_KEY`: a long random value
- `SEED_OWNER_NAME`, `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD`: your login

Create the tables and the owner account, then start the API:

```bash
python -m scripts.seed
uvicorn app.main:app --reload --port 8000
```

Add `--demo` to the seed command for sample reps and 60 sample leads. Only use it on a test database:
the sample reps all share a known password.

Without a `DATABASE_URL` the app falls back to a local SQLite file, which is handy for a quick look.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and sign in with the owner account. The dev server forwards `/api` to the
backend on port 8000.

To set the logo letter on the sign-in page, copy `frontend/.env.example` to `frontend/.env` and set
`VITE_BRAND_NAME`.

## Importing from Excel

**Import** accepts `.xlsx` and `.csv` files up to 10 MB. The first row must hold column names.

| Field | Accepted column names (not case sensitive) |
| --- | --- |
| Name (required) | Name, Full Name, Lead Name, Contact Name, Customer Name, Client Name |
| Phone | Phone, Phone Number, Mobile, Mobile Number, Mobile No, Contact Number, WhatsApp |
| Email | Email, Email ID, Email Address, E-mail, Mail |
| Company | Company, Company Name, Organisation, Organization, Firm, Business |
| Source | Source, Lead Source |
| Qualified | Qualified, Qualification, Lead Quality |
| Temperature | Temperature, Temp, Lead Temperature |
| Stage | Stage, Status, Lead Stage |
| Assigned | Assigned, Assigned To, Rep, Sales Rep, Owner |
| Next follow-up | Next Follow-up, Next Followup, Follow Up, Followup, Follow Up Date |

- Each lead needs a phone number or an email.
- Rows matching an existing lead by phone (last 10 digits) or email are skipped.
- Rows with invalid values are skipped and reported by row number. The other rows still import.
- Dates without a time zone are read in `APP_TIMEZONE`, with the day first (`29/10/2026 10:30`).
- To support more spellings, add them to `HEADER_ALIASES` in `backend/app/services/excel.py`.

**Export** downloads the leads matching the current filters. The file can be imported back.

## Team accounts

There is no team management screen yet. The owner can add reps through the API at
`POST /api/users`, which is available from the interactive docs at http://localhost:8000/docs.

| | Owner | Sales rep |
| --- | --- | --- |
| View, add and edit all leads | Yes | Yes |
| Import and export | Yes | Yes |
| Delete leads | Yes | No |
| Bell shows follow-ups for | All leads | Own leads |

## Tests

```bash
cd backend
pytest
```

Tests use a temporary SQLite database by default. To run them on PostgreSQL, set `TEST_DATABASE_URL`
to an empty test database. **The tests drop every table in that database.**

## Before going live

- Set a strong `SECRET_KEY` and owner password.
- Set `CORS_ORIGINS` to your frontend's URL, and `VITE_API_URL` if the API is on another domain.
- Tables are created automatically on startup, but later changes to existing tables are not applied.
  Add a migration tool such as Alembic before changing the schema of a live database.
