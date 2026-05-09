document.addEventListener('DOMContentLoaded', function() {
  // Auth check
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('currentUser');

  if (!token || !user) {
    window.location.href = 'login.html';
    return;
  }

  const userData = JSON.parse(user);
  if (userData.role !== 'student') {
    alert('Access denied. Students only.');
    window.location.href = 'index.html';
    return;
  }

  // Display user info
  document.getElementById('studentName').textContent = userData.username || 'Student';
  document.getElementById('studentId').textContent = userData.studentId || 'N/A';

  // Setup logout
  document.getElementById('logoutBtn')?.addEventListener('click', function() {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
  });

  // Check-in handler
  const checkinForm = document.getElementById('checkinForm');
  if (checkinForm) {
    checkinForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      const subject = document.getElementById('subject')?.value || 'General';
      const notes = document.getElementById('notes')?.value || '';

      const submitBtn = checkinForm.querySelector('button[type="submit"]');
      submitBtn.textContent = 'Checking in...';
      submitBtn.disabled = true;

      try {
        const response = await fetch('http://localhost:3000/api/attendance/checkin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            studentId: userData.studentId,
            subject,
            notes
          })
        });

        const data = await response.json();

        if (!response.ok) {
          alert(data.message || 'Check-in failed');
          return;
        }

        alert(`✅ Check-in successful! Status: ${data.data.status}`);
        loadAttendanceHistory();  // Refresh history

      } catch (error) {
        console.error('Check-in error:', error);
        alert('❌ Cannot connect to server.');
      } finally {
        submitBtn.textContent = 'Check In';
        submitBtn.disabled = false;
      }
    });
  }

  // Load attendance history
  async function loadAttendanceHistory() {
    const tableBody = document.getElementById('attendanceTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Loading...</td></tr>';

    try {
      const response = await fetch('http://localhost:3000/api/attendance/my-attendance', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">${data.message}</td></tr>`;
        return;
      }

      if (!data.data || data.data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center">No attendance records yet</td></tr>';
        return;
      }

      tableBody.innerHTML = data.data.map(record => {
        const date = new Date(record.timeIn).toLocaleDateString();
        const time = new Date(record.timeIn).toLocaleTimeString();
        const statusClass = {
          'Early': 'badge-success',
          'On-Time': 'badge-primary',
          'Late': 'badge-warning',
          'Absent': 'badge-danger'
        }[record.status] || 'badge-secondary';

        return `
          <tr>
            <td>${date}</td>
            <td>${time}</td>
            <td><span class="badge ${statusClass}">${record.status}</span></td>
            <td>${record.subject || 'General'}</td>
          </tr>
        `;
      }).join('');

    } catch (error) {
      console.error('Error loading attendance:', error);
      tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Failed to load data</td></tr>';
    }
  }

  // Load stats
  async function loadStats() {
    try {
      const response = await fetch('http://localhost:3000/api/attendance/my-attendance', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!data.data) return;

      const stats = {
        'Early': 0,
        'On-Time': 0,
        'Late': 0,
        'Absent': 0
      };

      data.data.forEach(record => {
        if (stats[record.status] !== undefined) {
          stats[record.status]++;
        }
      });

      document.getElementById('statEarly').textContent = stats['Early'];
      document.getElementById('statOnTime').textContent = stats['On-Time'];
      document.getElementById('statLate').textContent = stats['Late'];
      document.getElementById('statAbsent').textContent = stats['Absent'];
      document.getElementById('statTotal').textContent = data.data.length;

    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  // Initial load
  loadAttendanceHistory();
  loadStats();
});