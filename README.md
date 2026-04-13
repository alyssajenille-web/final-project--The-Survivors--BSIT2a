# final-project-The Survivors-BSIT2a
# Smart Attendance System with Auto-Time Classification

A web-based attendance management system that automates student check-in and classifies attendance status (Early, On-Time, Late) based on time.

## Phase 3 Implementation Summary

In **Phase 3**, we focused on building the **frontend** using HTML, Bootstrap 5, and JavaScript.

### What Was Implemented

- Complete folder structure (`frontend/` with HTML pages, `css/`, `js/`, and `img/` folders)
- Responsive pages using Bootstrap 5
- Role-based login system (Student vs Teacher)
- **Student Dashboard**: Quick Check-In with Auto-Time Classification + personal attendance history
- **Teacher Dashboard**: Overview cards, Live Attendance Records table, and quick check-in tool
- Profile page showing user details and logout
- Data sharing between pages using `localStorage` (student check-ins appear on teacher dashboard)

### Alignment with Use Case Diagram

- **Check in Attendance + Auto-time Classification** → Fully implemented on Student Dashboard
- **View Attendance record / Monitor Attendance** → Implemented on Teacher Dashboard (live records + summary cards)
- **Role-based actions** → Handled by Login page with correct redirection
- **Basic user management** → Supported via Register and Profile pages

### Alignment with ERD

- Simulated the **ATTENDANCE** entity (student_id, date, time_in, status)
- Implemented the 1-to-Many relationship between STUDENT and ATTENDANCE
- Teacher Dashboard displays attendance records linked to students

### Pages and Their Main Use Cases

- **index.html** – Home Page  
  Landing page that introduces the system and provides navigation to Login/Register.

- **register.html** – Registration Page  
  Allows new users to create an account with role selection (Student/Teacher).

- **login.html** – Login Page  
  Handles user authentication and redirects to the correct dashboard based on role.

- **student-dashboard.html** – Student Dashboard  
  Enables students to check in attendance with auto-time classification and view their history.

- **dashboard.html** – Teacher Dashboard  
  Allows teachers to monitor live attendance records, view summary statistics, and perform quick check-ins.

- **profile.html** – Profile Page  
  Displays logged-in user details and provides logout functionality.

## How to Run

1. Open `index.html` in your browser
2. Register a new account or use demo accounts:
   - Student: `2023001`
   - Teacher: `TEACHER01`
3. Login to access the respective dashboard

## Technologies Used

- HTML5
- Bootstrap 5
- JavaScript (with localStorage for data persistence)
- Auto-Time Classification logic

## Future Phases

- Backend integration (Node.js / PHP + Database)
- Full ERD implementation
- Admin features and report generation

---

**Submitted by:** [THE SURVIVORS]  
**Course:** [BSIT-2A]  
**Date:** April 12 ,2026
