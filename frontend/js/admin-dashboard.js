document.addEventListener('DOMContentLoaded', function() {
  // Auth check
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('currentUser');

  if (!token || !user) {
    window.location.href = 'login.html';
    return;
  }

  const userData = JSON.parse(user);
  if (userData.role !== 'admin') {
    alert('Access denied. Admin only.');
    window.location.href = 'index.html';
    return;
  }

  // Display user info
  document.getElementById('adminName').textContent = userData.username || 'Admin';

  // Setup logout
  document.getElementById('logoutBtn')?.addEventListener('click', function() {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
  });

  // Load all users
  async function loadUsers() {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';

    try {
      const response = await fetch('http://localhost:3000/api/auth/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">${data.message}</td></tr>`;
        return;
      }

      if (!data.data || data.data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No users found</td></tr>';
        return;
      }

      tableBody.innerHTML = data.data.map(user => {
        const roleClass = {
          'student': 'badge-primary',
          'teacher': 'badge-success',
          'admin': 'badge-danger'
        }[user.role] || 'badge-secondary';

        return `
          <tr>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${user.studentId || 'N/A'}</td>
            <td><span class="badge ${roleClass}">${user.role}</span></td>
            <td>
              <button class="btn btn-sm btn-danger" onclick="deleteUser('${user._id}')">Delete</button>
            </td>
          </tr>
        `;
      }).join('');

    } catch (error) {
      console.error('Error loading users:', error);
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Failed to load users</td></tr>';
    }
  }

  // Load attendance
  async function loadAttendance() {
    const tableBody = document.getElementById('attendanceTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';

    try {
      const response = await fetch('http://localhost:3000/api/attendance', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">${data.message}</td></tr>`;
        return;
      }

      if (!data.data || data.data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No attendance records</td></tr>';
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
            <td>${record.user?.username || 'Unknown'}</td>
            <td>${record.studentId || 'N/A'}</td>
            <td>${date}</td>
            <td>${time}</td>
            <td><span class="badge ${statusClass}">${record.status}</span></td>
            <td>${record.subject || 'General'}</td>
            <td>
              <button class="btn btn-sm btn-warning" onclick="editRecord('${record._id}')">Edit</button>
              <button class="btn btn-sm btn-danger" onclick="deleteRecord('${record._id}')">Delete</button>
            </td>
          </tr>
        `;
      }).join('');

    } catch (error) {
      console.error('Error loading attendance:', error);
      tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Failed to load data</td></tr>';
    }
  }

  // Load stats
  async function loadStats() {
    try {
      const [attendanceRes, usersRes] = await Promise.all([
        fetch('http://localhost:3000/api/attendance/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('http://localhost:3000/api/auth/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const attendanceData = await attendanceRes.json();
      const usersData = await usersRes.json();

      if (attendanceData.data) {
        document.getElementById('statEarly').textContent = attendanceData.data.today.Early;
        document.getElementById('statOnTime').textContent = attendanceData.data.today['On-Time'];
        document.getElementById('statLate').textContent = attendanceData.data.today.Late;
        document.getElementById('statAbsent').textContent = attendanceData.data.today.Absent;
        document.getElementById('statTotalToday').textContent = attendanceData.data.total;
      }

      if (usersData.data) {
        document.getElementById('statTotalUsers').textContent = usersData.data.length;
        const students = usersData.data.filter(u => u.role === 'student').length;
        const teachers = usersData.data.filter(u => u.role === 'teacher').length;
        document.getElementById('statStudents').textContent = students;
        document.getElementById('statTeachers').textContent = teachers;
      }

    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  // Delete user
  window.deleteUser = async function(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/auth/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (response.ok) {
        alert('User deleted successfully');
        loadUsers();
      } else {
        alert(data.message || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to delete user');
    }
  };

  // Delete attendance record
  window.deleteRecord = async function(id) {
    if (!confirm('Are you sure you want to delete this record?')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/attendance/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (response.ok) {
        alert('Record deleted successfully');
        loadAttendance();
        loadStats();
      } else {
        alert(data.message || 'Failed to delete record');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to delete record');
    }
  };

  // Edit record (simple prompt for now)
  window.editRecord = async function(id) {
    const newStatus = prompt('Enter new status (Early, On-Time, Late, Absent):');
    if (!newStatus) return;

    try {
      const response = await fetch(`http://localhost:3000/api/attendance/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();
      if (response.ok) {
        alert('Record updated successfully');
        loadAttendance();
        loadStats();
      } else {
        alert(data.message || 'Failed to update record');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to update record');
    }
  };

  // Initial load
  loadUsers();
  loadAttendance();
  loadStats();
});