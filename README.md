# 🎬 Cinevia

### A Redis-Powered Movie Ticket Booking Platform

[🌐 **Visit Live Website**](https://cinevia-kohl.vercel.app/)

Cinevia is a full-stack movie ticket booking platform designed to deliver a seamless movie discovery and booking experience while preventing double bookings through Redis-powered temporary seat reservations.

Users can explore movies, browse cinemas across multiple cities, view showtimes, select seats, and manage their bookings through an interactive interface.

Built with React, Node.js, Express, MySQL, and Redis, Cinevia combines JWT authentication, temporary seat locking, and transactional database operations to ensure reliable booking workflows.

---

## ✨ Features

### 🎥 Movie Discovery
- Browse currently showing and upcoming movies.
- Explore movie details, genres, ratings, cast, and synopsis.
- Search movies by title.
- Movie posters hosted on Cloudinary.
- Browse cinemas across multiple cities.
- View available showtimes.

### 🎟️ Ticket Booking
- Interactive cinema seat selection.
- Standard and Premium seat categories.
- Different pricing based on seat type.
- Temporary seat reservations.
- Booking confirmation and booking history.
- Booking cancellation.

### ⚡ Redis-Powered Seat Reservation
- Temporary seat holds using Redis.
- Five-minute reservation window using TTL.
- Prevents multiple users from holding the same seat simultaneously.
- All-or-nothing seat reservation.
- Automatic expiration of abandoned seat holds.
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
| Caching & Seat Locking | Redis (Upstash) |
| Authentication | JWT, bcrypt |
| Movie Poster Hosting | Cloudinary |
| Frontend Deployment | Vercel |
| Backend Deployment | Render |
| Containerization | Docker, Docker Compose |

---

## 🏗️ System Architecture

```text
                       USERS
                         |
                         v
                   REACT + VITE
                         |
                         v
                    EXPRESS API
                         |
              +----------+----------+
              |                     |
              v                     v
            REDIS                 MYSQL
              |                     |
       Temporary Seat          Persistent Data
           Locks                Users, Movies,
       Hold Expiration          Showtimes, Bookings

                         |
                         v
                     CLOUDINARY
                         |
                    Movie Posters
```

### How Seat Locking Works

Cinevia uses Redis to manage temporary seat reservations and reduce booking conflicts.

1. A user selects one or more available seats.
2. The backend validates seat availability.
3. Redis creates temporary seat holds with a five-minute TTL.
4. Other users cannot reserve the same seats while the holds are active.
5. When the user confirms the booking, the backend validates the hold and persists the booking in MySQL.
6. If the reservation expires, the seats become available again.

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
- Git
- Docker Desktop (optional, for local Redis)
- A MySQL database (Aiven MySQL or another compatible MySQL instance)
- A Redis instance (local Redis or Upstash)

### 1. Clone the repository

```bash
git clone https://github.com/nishh-tha/Cinevia.git
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
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173

DB_HOST=your-mysql-host
DB_PORT=your-mysql-port
DB_USER=your-mysql-user
DB_PASSWORD=your-mysql-password
DB_NAME=your-database-name

DB_SSL=true
DB_SSL_CA_PATH=certs/ca.pem

REDIS_URL=your-redis-connection-url

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

If using the provided Docker Compose configuration, run this from the project root:

```bash
docker compose up -d redis
```

Alternatively, use an existing Redis instance such as Upstash.

Make sure `REDIS_URL` matches your Redis configuration.

### 4. Run database migrations

From the `server` directory:

```bash
npm run migrate
```

### 5. Seed sample data

```bash
npm run seed
```

This populates the database with sample movies, cities, cinemas, screens, seats, and showtimes.

### 6. Start the backend

```bash
npm start
```

The backend runs at:

```text
http://localhost:3000
```

### 7. Configure and start the frontend

Open a second terminal:

```bash
cd frontend
npm install
```

Create a `.env` file inside the `frontend` directory:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

Start the development server:

```bash
npm run dev
```

Open the local Vite URL displayed in your terminal, usually:

```text
http://localhost:5173
```

---

## 🚀 Deployment

Cinevia uses the following deployment setup:

| Component | Platform |
|---|---|
| Frontend | Vercel |
| Backend API | Render |
| MySQL Database | Aiven |
| Redis | Upstash |
| Movie Posters | Cloudinary |

### Frontend Configuration

Set the following environment variable in Vercel:

```env
VITE_API_BASE_URL=https://cinevia-backend.onrender.com/api
```

### Backend Configuration

Configure the required environment variables in Render:

- MySQL connection credentials
- Redis connection URL
- JWT secret
- CORS allowed origins
- Database SSL configuration

The deployed frontend origin must be included in `CORS_ORIGINS`.

---

## 🔌 API Overview

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | API health check |
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

Authentication endpoints are also available for user registration and login.

---

## 🧪 Testing

Run the backend automated test suite:

```bash
cd server
npm test
```

The test suite covers areas including:

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

No actual payment is collected or processed. Payment gateway integration is outside the current project scope.

---

## 🔮 Future Enhancements

- Real-time seat availability updates.
- Live seat-hold countdown.
- QR-based digital tickets.
- Enhanced user booking dashboard.
- Concurrency and load testing.
- Improved booking notifications.
- Payment gateway integration.

---


*Built with React, Node.js, Express, MySQL, and Redis.*
