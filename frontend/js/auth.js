// Auth utilities for all pages

const AUTH = {
  // Check if user is logged in
  isLoggedIn() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('currentUser');
    return !!(token && user);
  },

  // Get current user
  getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('currentUser'));
    } catch {
      return null;
    }
  },

  // Get token
  getToken() {
    return localStorage.getItem('token');
  },

  // Logout
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
  },

  // Redirect if not logged in
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

  // Redirect if already logged in (for login/register pages)
  redirectIfLoggedIn() {
    if (this.isLoggedIn()) {
      const user = this.getCurrentUser();
      if (user.role === 'student') {
        window.location.href = 'student-dashboard.html';
      } else if (user.role === 'teacher') {
        window.location.href = 'teacher-dashboard.html';
      } else if (user.role === 'admin') {
        window.location.href = 'admin-dashboard.html';
      }
    }
  },

  // Setup logout buttons
  setupLogoutButtons() {
    document.querySelectorAll('.logout-btn, #logoutBtn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.logout();
      });
    });
  },

  // Setup user info display
  setupUserInfo() {
    const user = this.getCurrentUser();
    if (user) {
      document.querySelectorAll('.user-name').forEach(el => {
        el.textContent = user.username || 'User';
      });
      document.querySelectorAll('.user-role').forEach(el => {
        el.textContent = user.role || 'Student';
      });
    }
  }
};

// Auto-redirect on login/register pages
document.addEventListener('DOMContentLoaded', () => {
  const currentPage = window.location.pathname.split('/').pop();
  if (['login.html', 'register.html', 'index.html', ''].includes(currentPage)) {
    AUTH.redirectIfLoggedIn();
  }
});