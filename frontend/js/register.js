const API_URL = '/api';

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

  const form = document.getElementById('registerForm');

  if (!form) {
    console.error('Register form not found!');
    return;
  }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const username = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const role = document.getElementById('regRole').value;
    const studentId = document.getElementById('regStudentId').value.trim();

    if (!username || !email || !password || !studentId) {
      alert('Please fill in all required fields!');
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords don't match!");
      return;
    }

    if (password.length < 6) {
      alert('Password must be at least 6 characters long!');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      alert('Password must contain at least one uppercase letter!');
      return;
    }

    if (!/[0-9]/.test(password)) {
      alert('Password must contain at least one number!');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Registering...';
    submitBtn.disabled = true;

    try {
      console.log('Submitting registration...', { username, email, role, studentId });

      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        // FIX: Always send studentId (was sending undefined for teachers, causing validation errors)
        body: JSON.stringify({ username, email, password, role, studentId })
      });

      const data = await response.json();
      console.log('Server response:', data);

      if (!response.ok) {
        if (data.errors && Array.isArray(data.errors)) {
          const errorMessages = data.errors.map(err => `${err.field}: ${err.message}`).join('\n');
          alert(`Validation Errors:\n${errorMessages}`);
        } else {
          alert(data.message || 'Registration failed');
        }
        return;
      }

      alert('✅ Registration successful! Please login.');
      window.location.href = 'login.html';

    } catch (error) {
      console.error('Error:', error);
      alert('❌ Cannot connect to server. Make sure backend is running on port 3000.');
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
});
