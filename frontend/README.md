# Cinevia frontend

React 18 + Vite frontend for the Cinevia Express/MySQL/Redis backend. The existing visual design and page structure have been retained; the service layer now uses the backend APIs instead of mock movie/show/seat data.

## Requirements
- Node.js 18 or newer
- The Cinevia backend running at `http://localhost:3000`

## Run locally (Windows PowerShell)
```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```
Open `http://localhost:5173`.

## Environment
`VITE_API_BASE_URL` is the backend API base URL, including `/api`. For local development:
```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_SEAT_HOLD_SECONDS=300
```

## Integrated backend endpoints
- `GET /api/cities`
- `GET /api/movies`, `GET /api/movies/:id`
- `GET /api/movies/:id/shows?date=YYYY-MM-DD&city=<id>`
- `GET /api/shows/:id/seats`
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `POST /api/holds`, `GET /api/holds/:holdId`, `DELETE /api/holds/:holdId`
- `POST /api/checkout` (demo confirmation; no payment gateway)
- `GET /api/bookings/mine`, `GET /api/bookings/:id`, `POST /api/bookings/:id/cancel`

## Notes
- The JWT is stored in browser local storage under `auth_token`; passwords are never stored.
- Seat selection uses live seat data. Temporary holds expire according to the backend configuration.
- Checkout confirms a demo booking immediately. No payment is collected.
- Password reset is intentionally unavailable because email delivery is outside the project scope.
- The frontend does not contain database credentials. Configure Aiven and Redis only in the backend's `server/.env`.
