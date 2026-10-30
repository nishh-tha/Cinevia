# 🎬 Cinevia

### A Redis-Powered Movie Ticket Booking Platform

Cinevia is a full-stack movie ticket booking application designed to provide a seamless booking experience while preventing double bookings through Redis-powered temporary seat reservations.

Users can explore movies, browse cinemas and showtimes, select seats, and confirm bookings through an interactive interface. The backend combines JWT authentication, Redis-based seat locking, and MySQL persistence to ensure reliable booking operations.

---

## ✨ Features

### 🎟️ Movie Discovery & Booking
- Browse currently available movies.
- Explore cinemas across multiple cities.
- View movie showtimes.
- Interactive cinema seat selection.
- Different pricing for Standard and Premium seats.
- Booking confirmation and booking history.
- Booking cancellation.

### ⚡ Redis-Powered Seat Reservation
- Temporary seat holds using Redis.
- Five-minute seat reservation window.
- Automatic expiration of seat holds using TTL.
- Prevents multiple users from holding the same seat simultaneously.
- All-or-nothing seat selection and reservation.
- Database-level safeguards against duplicate bookings.

### 🔐 Authentication & Security
- User registration and login.
- JWT-based authentication.
- Password hashing using bcrypt.
- Protected booking operations.
- Server-side validation and error handling.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript |
| Routing | React Router |
| Backend | Node.js, Express.js |
| Database | MySQL (Aiven) |
| Caching & Seat Locking | Redis |
| Authentication | JWT, bcrypt |
| Infrastructure | Docker, Docker Compose |

---

## 🏗️ Architecture

```text
                 USERS
                   |
                   v
           REACT + VITE
                   |
                   v
             EXPRESS API
                   |
          +--------+--------+
          |                 |
          v                 v
       REDIS             MYSQL
          |                 |
    Temporary Seat      Persistent Data
       Locks            Users, Movies,
    Hold Expiration     Showtimes, Bookings
```

### How Seat Locking Works

Cinevia uses Redis to manage temporary seat reservations.

1. A user selects one or more available seats.
2. The backend checks their availability.
3. Redis creates temporary holds with a five-minute TTL.
4. Other users cannot hold the same seats while the reservation is active.
5. When the user confirms the booking, the backend validates the hold and persists the booking in MySQL.
6. If the hold expires, the seats become available again.

MySQL transactions and database constraints provide additional protection against duplicate bookings.

---

## 📁 Project Structure

```text
Cinevia/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   ├── index.html
│   └── package.json
│
├── server/
│   ├── config/
│   ├── db/
│   ├── middleware/
│   ├── migrations/
│   ├── routes/
│   ├── scripts/
│   ├── services/
│   ├── test/
│   ├── index.js
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

---

## ⚙️ Getting Started

### Prerequisites

Make sure you have installed:

- Node.js and npm
- Docker Desktop
- Git
- A MySQL database (Aiven MySQL or another compatible MySQL instance)
- A Redis instance

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/Cinevia.git
cd Cinevia
```

### 2. Configure the backend

```bash
cd server
npm install
```

Create a `.env` file using `.env.example`:

```env
PORT=3000
CORS_ORIGINS=http://localhost:5173

DB_HOST=your-mysql-host
DB_PORT=your-mysql-port
DB_USER=your-mysql-user
DB_PASSWORD=your-mysql-password
DB_NAME=your-database-name

DB_SSL=true
DB_SSL_CA_PATH=certs/ca.pem

REDIS_URL=redis://localhost:9000

JWT_SECRET=your-long-random-secret
JWT_EXPIRES_IN=2h

SEAT_HOLD_SECONDS=300
MAX_SEATS_PER_BOOKING=8
CONVENIENCE_FEE_PAISE=3000
APP_TIMEZONE=Asia/Kolkata
```

Place your MySQL CA certificate at:

```text
server/certs/ca.pem
```

Keep credentials and certificates private. Never commit `.env` or private certificate files.

### 3. Start Redis

From the project root:

```bash
docker compose up -d redis
```

### 4. Run database migrations

From the `server` directory:

```bash
npm run migrate
```

### 5. Seed sample data

```bash
npm run seed
```

### 6. Start the backend

```bash
npm start
```

The backend will run at:

```text
http://localhost:3000
```

### 7. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local Vite URL displayed in your terminal, usually:

```text
http://localhost:5173
```

---

## 🔌 API Overview

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/cities` | Retrieve available cities |
| GET | `/api/movies` | Retrieve movie listings |
| GET | `/api/movies/:id` | Retrieve movie details |
| GET | `/api/movies/:id/shows` | Retrieve movie showtimes |
| GET | `/api/shows/:id/seats` | Retrieve seat availability |
| POST | `/api/holds` | Temporarily reserve seats |
| GET | `/api/holds/:holdId` | Retrieve a seat hold |
| DELETE | `/api/holds/:holdId` | Release a seat hold |
| POST | `/api/checkout` | Confirm a demo booking |
| GET | `/api/bookings/mine` | Retrieve the user's bookings |
| POST | `/api/bookings/:id/cancel` | Cancel a booking |

Authentication endpoints are also available for registration and login.

---

## 🧪 Testing

Run the backend automated test suite:

```bash
cd server
npm test
```

The test suite covers:

- Seat reservation and release.
- Concurrent seat-hold conflicts.
- Hold expiration.
- Seat availability validation.
- Booking price calculations.
- Date and time handling.
- Registration and login validation.
- JWT authentication.

---

## 💳 Payment Scope

Cinevia currently supports demo booking confirmation without an integrated payment gateway.

No actual payment is collected or processed. Payment gateway integration is intentionally outside the current project scope.

---

## 🔮 Future Enhancements

- Real-time seat availability updates.
- Live seat-hold countdown.
- QR-based digital tickets.
- Enhanced user booking dashboard.
- Concurrency and load testing.
- Improved booking notifications.

---


*Built with React, Node.js, MySQL and Redis.*