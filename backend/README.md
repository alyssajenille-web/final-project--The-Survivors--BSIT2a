# Smart Attendance System Backend

## Overview
This backend powers the Smart Attendance System with Node.js, Express, MongoDB, and JWT authentication.
It provides secure API endpoints for user management, attendance tracking, class schedules, and roster operations.

---

## Getting Started
1. Install dependencies:
```bash
cd backend
npm install
```

2. Create a `.env` file in `backend/` with:
```env
MONGODB_URI=your_mongo_connection_string
JWT_SECRET=your_jwt_secret
PORT=3000
```

3. Start the server:
```bash
npm start
```

4. Open the frontend via:
```text
http://localhost:3000
```

---

## Environment Variables
* `MONGODB_URI` — MongoDB connection string
* `JWT_SECRET` — secret key for signing JSON web tokens
* `PORT` — optional server port (default: `3000`)
* `SCHOOL_TIMEZONE` — optional timezone for attendance time logic (default: `Asia/Manila`)

---

## Features
* Role-based access control for `student`, `teacher`, and `admin`
* JWT authentication with protected routes
* Student session-based and legacy check-in flows
* Auto-time attendance classification with daily absence handling
* Class, schedule, and roster management
* Attendance statistics and student summaries
* Admin user management and deletion cleanup

---

## API Endpoints

### Authentication
* `POST /api/auth/register` — register a new account
* `POST /api/auth/login` — login and receive a JWT
* `GET /api/auth/users` — list all users (`teacher`, `admin` only)
* `DELETE /api/auth/users/:id` — delete a user (`admin` only)
* `GET /api/auth/secure-data` — example protected admin data

### Attendance
* `POST /api/attendance/checkin` — student legacy check-in
* `POST /api/attendance/checkin-session` — student check-in by session/class
* `GET /api/attendance/my-attendance` — student attendance history
* `GET /api/attendance` — teacher/admin list attendance
* `GET /api/attendance/stats` — teacher/admin daily stats
* `GET /api/attendance/student-summary` — teacher/admin summary by student
* `GET /api/attendance/:id` — retrieve a record
* `PUT /api/attendance/:id` — update attendance (`admin` only)
* `DELETE /api/attendance/:id` — delete attendance record (`admin` only)

### Classes and Sessions
* `GET /api/classes` — list classes
* `POST /api/classes` — create class (`admin` only)
* `GET /api/classes/:id` — get class details (`teacher`, `admin` only)
* `PUT /api/classes/:id` — update class (`admin` only)
* `DELETE /api/classes/:id` — delete class (`admin` only)
* `GET /api/schedule` — retrieve class schedule
* `POST /api/schedule` — save class schedule (`teacher`, `admin` only)
* `GET /api/sessions` — list attendance sessions
* `GET /api/sessions/:id` — get session details

### Roster
* `GET /api/roster` — list classes and rosters (`teacher`, `admin` only)
* `GET /api/roster/class/:className` — get roster for a class
* `POST /api/roster/enroll` — enroll student (`admin` only)
* `DELETE /api/roster/:rosterEntryId` — unenroll student (`admin` only)

---

## Models
* `User` — users with `username`, `email`, `password`, `role`, and `studentId`
* `Attendance` — attendance records with session, status, arrival type, subject, and notes
* `Class` — class definitions with name, section, schedule, teacher, and status
* `ClassSchedule` — saved schedule records used for classification
* `ClassRoster` — student enrollments in classes
* `AttendanceSession` — class sessions for session-based attendance

---

## Security & Middleware
* `helmet` for secure HTTP headers
* `express-mongo-sanitize` to prevent NoSQL injection
* rate limiting for login/register routes
* centralized error handling and request logging

---

## Notes
* The server serves static frontend files from `../frontend`
* API and frontend are integrated so routing continues to the SPA-like pages
