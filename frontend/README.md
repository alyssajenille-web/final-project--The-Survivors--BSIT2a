# Smart Attendance System Frontend

## Overview
This frontend is a static web interface for the Smart Attendance System.
It is served by the backend and uses Bootstrap, custom CSS, and JavaScript to manage authentication, attendance workflows, and user dashboards.

---

## Pages Included
* `index.html` — landing page with navigation to login and registration.
* `login.html` — login form for students, teachers, and admins.
* `register.html` — account registration page.
* `profile.html` — user profile overview.
* `student-dashboard.html` — student dashboard and attendance history.
* `teacher-dashboard.html` — teacher dashboard and session/attendance management.
* `admin-dashboard.html` — admin overview and controls.
* `admin-users.html` — admin user management.
* `class-setting.html` — class management settings.
* `session-management.html` — attendance session management.
* `student-summary-preview.html` — summary preview for student attendance data.

---

## Client Files
* `css/style.css` — shared styles and layout overrides.
* `js/api.js` — wrapper for API calls to `/api`.
* `js/auth.js` — login state management, redirects, and logout support.
* `js/login.js` — login page behavior.
* `js/register.js` — registration page behavior.
* `js/student-dashboard.js` — student dashboard features.

---

## How to Use
1. Start the backend server from the `backend/` folder:
```bash
cd backend
npm install
npm start
```
2. Open a browser and visit:
```text
http://localhost:3000
```
3. Use the login or registration pages to access the appropriate dashboard.

---

## Notes
* The frontend uses the backend API at `/api`.
* Static assets and pages are served from the `frontend/` folder by the backend.
* The app expects JWT tokens to be stored in `localStorage` for authenticated routes.
