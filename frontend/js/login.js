// frontend/js/login.js

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '/api'
  : 'https://final-project-the-survivors-bsit2a-6cdr.onrender.com/api';

document.addEventListener('DOMContentLoaded', function () {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('currentUser');

  if (token && user) {
    try {
      const userData = JSON.parse(user);
      if (userData.role === 'student') {
        window.location.href = 'student-dashboard.html';
      } else if (userData.role === 'teacher') {
        window.location.href = 'teacher-dashboard.html';
      } else if (userData.role === 'admin') {
        window.location.href = 'admin-dashboard.html';
      }
      return;
    } catch (err) {
      console.error('Error parsing user data, clearing storage');
      localStorage.removeItem('token');
      localStorage.removeItem('currentUser');
    }
  }

  const form = document.getElementById('loginForm');

  if (!form) {
    console.error('Login form not found!');
    return;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
      alert('Please enter both Email and Password!');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Logging in...';
    submitBtn.disabled = true;

    try {
      console.log('Attempting login...', { email, targetUrl: `${API_URL}/auth/login` });

      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      let data;
      try {
        data = await response.json();
        console.log('Login response:', data);
      } catch (parseError) {
        console.error('Failed to parse response as JSON.', parseError);
        alert('Server error: Did not receive valid JSON. Check your Render logs.');
        return;
      }

      if (!response.ok) {
        if (data.errors && Array.isArray(data.errors)) {
          const errorMessages = data.errors.map(err => `${err.field}: ${err.message}`).join('\n');
          alert(`Validation Errors:\n${errorMessages}`);
        } else {
          // This will show you exactly what the backend is complaining about
          alert(`Error (${response.status}): ${data.message || 'Login failed'}`);
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
      alert('❌ Cannot connect to server. Check your internet connection or backend status.');
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
});