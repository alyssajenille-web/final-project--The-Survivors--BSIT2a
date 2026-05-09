document.addEventListener('DOMContentLoaded', function() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('currentUser');

  if (!token || !user) {
    window.location.href = 'login.html';
    return;
  }

  const userData = JSON.parse(user);
  if (userData.role !== 'teacher' && userData.role !== 'admin') {
    alert('Access denied. Teachers only.');
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('teacherName').textContent = userData.username || 'Teacher';

  document.getElementById('logoutBtn')?.addEventListener('click', function() {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
  });

  async function loadAttendance() {
    const tableBody = document.getElementById('attendanceTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

    try {
      const response = await fetch('http://localhost:3000/api/attendance', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${data.message}</td></tr>`;
        return;
      }

      if (!data.data || data.data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No attendance records yet</td></tr>';
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

        const studentName = record.user?.username || record.studentId || 'Unknown';

        return `
          <tr>
            <td>${studentName}</td>
            <td>${record.studentId || 'N/A'}</td>
            <td>${date}</td>
            <td>${time}</td>
            <td><span class="badge ${statusClass}">${record.status}</span></td>
            <td>
              <button class="btn btn-sm btn-info" onclick="viewDetails('${record._id}')">View</button>
            </td>
          </tr>
        `;
      }).join('');

    } catch (error) {
      console.error('Error loading attendance:', error);
      tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load data</td></tr>';
    }
  }

  async function loadStats() {
    try {
      const response = await fetch('http://localhost:3000/api/attendance/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!data.data) return;

      document.getElementById('statEarly').textContent = data.data.today.Early;
      document.getElementById('statOnTime').textContent = data.data.today['On-Time'];
      document.getElementById('statLate').textContent = data.data.today.Late;
      document.getElementById('statAbsent').textContent = data.data.today.Absent;
      document.getElementById('statTotal').textContent = data.data.total;

    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const term = this.value.toLowerCase();
      const rows = document.querySelectorAll('#attendanceTableBody tr');

      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
      });
    });
  }

  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', function() {
      const status = this.value;
      const rows = document.querySelectorAll('#attendanceTableBody tr');

      rows.forEach(row => {
        if (!status || row.textContent.includes(status)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    });
  }

  window.viewDetails = async function(id) {
    try {
      const response = await fetch(`http://localhost:3000/api/attendance/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.message || 'Failed to load details');
        return;
      }

      const record = data.data;
      const details = `
        Student: ${record.user?.username || record.studentId}
        ID: ${record.studentId}
        Date: ${new Date(record.timeIn).toLocaleString()}
        Status: ${record.status}
        Subject: ${record.subject || 'General'}
        Notes: ${record.notes || 'None'}
      `;

      alert(details);

    } catch (error) {
      console.error('Error:', error);
      alert('Failed to load details');
    }
  };

  
  loadAttendance();
  loadStats();
});