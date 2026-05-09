const AUTH = {
  isLoggedIn() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('currentUser');
    return !!(token && user);
  },

  getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('currentUser'));
    } catch {
      return null;
    }
  },

  getToken() {
    return localStorage.getItem('token');
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
  },

  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

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

  setupLogoutButtons() {
    document.querySelectorAll('.logout-btn, #logoutBtn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.logout();
      });
    });
  },
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

document.addEventListener('DOMContentLoaded', () => {
  const currentPage = window.location.pathname.split('/').pop();
  if (['login.html', 'register.html', 'index.html', ''].includes(currentPage)) {
    AUTH.redirectIfLoggedIn();
  }
});