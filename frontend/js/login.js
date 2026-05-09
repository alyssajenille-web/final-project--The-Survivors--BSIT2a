const API_URL = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', function() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('currentUser');
  if (token && user) {
    const userData = JSON.parse(user);
    if (userData.role === 'student') {
      window.location.href = 'student-dashboard.html';
    } else if (userData.role === 'teacher') {
      window.location.href = 'teacher-dashboard.html';
    } else if (userData.role === 'admin') {
      window.location.href = 'admin-dashboard.html';
    }
    return;
  }

  const form = document.getElementById('loginForm');

  if (!form) {
    console.error('Login form not found!');
    return;
  }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const email = document.getElementById('loginId').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
      alert('Please enter both ID/Email and Password!');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Logging in...';
    submitBtn.disabled = true;

    try {
      console.log('Attempting login...', { email });

      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      console.log('Login response:', data);

      if (!response.ok) {
        if (data.errors && Array.isArray(data.errors)) {
          const errorMessages = data.errors.map(err => `${err.field}: ${err.message}`).join('\n');
          alert(`Validation Errors:\n${errorMessages}`);
        } else {
          alert(`Error: ${data.message || 'Login failed'}`);
        }
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));

      alert('✅ Login successful!');

      if (data.user.role === 'student') {
        window.location.href = 'student-dashboard.html';
      } else if (data.user.role === 'teacher') {
        window.location.href = 'teacher-dashboard.html';
      } else if (data.user.role === 'admin') {
        window.location.href = 'admin-dashboard.html';
      } else {
        window.location.href = 'index.html';
      }

    } catch (error) {
      console.error('Login error:', error);
      alert('❌ Cannot connect to server. Make sure backend is running.');
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
});