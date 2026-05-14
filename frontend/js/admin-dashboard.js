// DYNAMIC API URL SETUP
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '/api'
  : 'https://final-project-the-survivors-bsit2a-6cdr.onrender.com/api';

document.addEventListener('DOMContentLoaded', function () {
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

  document.getElementById('adminName').textContent = userData.username || 'Admin';

  document.getElementById('logoutBtn')?.addEventListener('click', function () {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
  });

  let cachedClasses = [];
  let cachedUsers = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function classLabel(classItem) {
    return [classItem.name, classItem.subject, classItem.section].filter(Boolean).join(' - ');
  }

  function daysLabel(days) {
    return (days || []).map(day => dayNames[day]).filter(Boolean).join(', ') || 'N/A';
  }

  function formatTime12Hour(time) {
    if (!time) return '--:--';
    const [hourValue, minute = '00'] = time.split(':');
    const hour = Number(hourValue);
    if (Number.isNaN(hour)) return time;

    const period = hour >= 12 ? 'pm' : 'am';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minute}${period}`;
  }

  function formatTimeRange(startTime, endTime) {
    return `${formatTime12Hour(startTime)} - ${formatTime12Hour(endTime)}`;
  }

  function populateTeacherSelect() {
    const teacherSelect = document.getElementById('classTeacherSelect');
    if (!teacherSelect) return;

    const teachers = cachedUsers.filter(u => u.role === 'teacher' || u.role === 'admin');
    teacherSelect.innerHTML = teachers.length
      ? '<option value="">Select teacher</option>' + teachers.map(t => `<option value="${t._id}">${t.username}</option>`).join('')
      : '<option value="">No teacher accounts found</option>';
  }

  async function loadClasses() {
    const tableBody = document.getElementById('classesTableBody');
    const enrollClassSelect = document.getElementById('enrollClassSelect');

    try {
      const response = await fetch(`${API_URL}/classes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      cachedClasses = result.data || [];

      if (enrollClassSelect) {
        enrollClassSelect.innerHTML = cachedClasses.length
          ? '<option value="">Select class</option>' + cachedClasses.map(c => `<option value="${c._id}">${classLabel(c)}</option>`).join('')
          : '<option value="">No classes yet</option>';
      }

      if (!tableBody) return;
      if (!response.ok || cachedClasses.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No class schedules created yet.</td></tr>';
        return;
      }

      tableBody.innerHTML = cachedClasses.map(c => `
        <tr>
          <td><strong class="text-primary">${classLabel(c)}</strong></td>
          <td>${c.subject || 'N/A'}</td>
          <td>${c.teacher?.username || 'Unassigned'}</td>
          <td>${daysLabel(c.daysOfWeek)}</td>
          <td>${c.startTime && c.endTime ? formatTimeRange(c.startTime, c.endTime) : 'N/A'}</td>
          <td>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteClassSchedule('${c._id}', '${classLabel(c).replace(/'/g, "\\'")}')">
              Delete
            </button>
          </td>
        </tr>
      `).join('');
    } catch (error) {
      if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load schedules</td></tr>';
    }
  }

  window.deleteClassSchedule = async function (id, label) {
    if (!confirm(`Delete class schedule "${label}"?`)) return;

    try {
      const response = await fetch(`${API_URL}/classes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (!response.ok) {
        alert(`Failed: ${data.message || 'Unable to delete schedule'}`);
        return;
      }

      await loadClasses();
      await loadRoster();
      alert('Class schedule deleted.');
    } catch (error) {
      alert('Cannot connect to server.');
    }
  };

  document.getElementById('classForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const payload = {
      name: document.getElementById('classNameInput').value.trim(),
      section: document.getElementById('classSectionInput').value.trim(),
      subject: document.getElementById('classSubjectInput').value.trim(),
      teacherId: document.getElementById('classTeacherSelect').value,
      daysOfWeek: Array.from(document.querySelectorAll('.schedule-day:checked')).map(input => Number(input.value)),
      startTime: document.getElementById('classStartTimeInput').value,
      endTime: document.getElementById('classEndTimeInput').value,
      allowanceMinutes: parseInt(document.getElementById('classAllowanceInput').value, 10) || 5
    };

    try {
      const response = await fetch(`${API_URL}/classes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok) {
        alert(`Failed: ${data.message}`);
        return;
      }

      alert('Class schedule added successfully.');
      e.target.reset();
      await loadClasses();
    } catch (error) {
      alert('Cannot connect to server.');
    }
  });

  // ── 1. ROSTER MANAGEMENT (NEW) ──────────────────────────────────────

  async function loadRoster() {
    const tableBody = document.getElementById('rosterTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Loading...</td></tr>';

    try {
      const response = await fetch(`${API_URL}/roster`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();

      if (!response.ok || !result.data || result.data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No students enrolled in any classes yet.</td></tr>';
        return;
      }

      // Flatten the grouped data if the backend groups it by class, or map directly if it's an array
      let rosterHTML = '';
      const rosterData = result.data;

      rosterData.forEach(entry => {
        const studentName = entry.student ? entry.student.username : 'Unknown User';
        const className = entry.class ? classLabel(entry.class) : entry.className;
        rosterHTML += `
          <tr>
            <td><strong class="text-primary">${className}</strong></td>
            <td>${entry.studentId}</td>
            <td>${studentName}</td>
            <td>
              <button class="btn btn-sm btn-outline-danger" onclick="unenroll('${entry._id}')">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      });

      tableBody.innerHTML = rosterHTML;

    } catch (error) {
      console.error('Error loading roster:', error);
      tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Failed to load roster data</td></tr>';
    }
  }

  const enrollForm = document.getElementById('enrollForm');
  if (enrollForm) {
    enrollForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const studentId = document.getElementById('enrollStudentId').value.trim();
      const classSelect = document.getElementById('enrollClassSelect');
      const classId = classSelect.value;
      const className = classSelect.selectedOptions[0]?.textContent || 'class';
      const submitBtn = enrollForm.querySelector('button[type="submit"]');

      submitBtn.innerHTML = 'Enrolling...';
      submitBtn.disabled = true;

      try {
        const response = await fetch(`${API_URL}/roster/enroll`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ studentId, classId })
        });

        const data = await response.json();

        if (response.ok) {
          alert(`Success: Student ${studentId} is now enrolled in ${className}`);
          enrollForm.reset();
          loadRoster();
        } else {
          alert(`❌ Failed: ${data.message}`);
        }
      } catch (error) {
        alert('❌ Cannot connect to server.');
      } finally {
        submitBtn.innerHTML = '<i class="fas fa-plus-circle me-1"></i> Enroll Student';
        submitBtn.disabled = false;
      }
    });
  }

  window.unenroll = async function (id) {
    if (!confirm('Are you sure you want to remove this student from this class?')) return;

    try {
      const response = await fetch(`${API_URL}/roster/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        loadRoster();
      } else {
        const data = await response.json();
        alert(`Failed: ${data.message}`);
      }
    } catch (error) {
      alert('Cannot connect to server.');
    }
  };


  // ── 2. USERS MANAGEMENT ─────────────────────────────────────────────

  async function loadUsers() {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;

    try {
      const response = await fetch(`${API_URL}/auth/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      cachedUsers = data.data || [];
      populateTeacherSelect();

      if (!response.ok || cachedUsers.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No users found</td></tr>';
        return;
      }

      tableBody.innerHTML = cachedUsers.map(u => {
        let roleClass = 'badge-secondary';
        if (u.role === 'student') roleClass = 'bg-primary';
        if (u.role === 'teacher') roleClass = 'bg-success';
        if (u.role === 'admin') roleClass = 'bg-danger';

        return `
          <tr>
            <td>${u.username}</td>
            <td>${u.email}</td>
            <td>${u.studentId || 'N/A'}</td>
            <td><span class="badge ${roleClass}">${u.role}</span></td>
            <td>
              <button class="btn btn-sm btn-danger" onclick="deleteUser('${u._id}')">Delete</button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (error) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Failed to load users</td></tr>';
    }
  }

  window.deleteUser = async function (id) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const response = await fetch(`${API_URL}/auth/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) { loadUsers(); loadStats(); }
      else alert('Failed to delete user');
    } catch (error) { alert('Error deleting user'); }
  };


  // ── 3. ATTENDANCE MANAGEMENT ────────────────────────────────────────

  // ── 4. STATS ────────────────────────────────────────────────────────

  async function loadStats() {
    try {
      const [attendanceRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/attendance/stats`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/auth/users`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const attendanceData = await attendanceRes.json();
      const usersData = await usersRes.json();

      if (attendanceData.data) {
        document.getElementById('statEarly').textContent = attendanceData.data.today.Early || 0;
        document.getElementById('statOnTime').textContent = attendanceData.data.today['On-Time'] || 0;
        document.getElementById('statLate').textContent = attendanceData.data.today.Late || 0;
        document.getElementById('statAbsent').textContent = attendanceData.data.today.Absent || 0;
        document.getElementById('statTotalToday').textContent = attendanceData.data.total || 0;
      }

      if (usersData.data) {
        document.getElementById('statTotalUsers').textContent = usersData.data.length;
        document.getElementById('statStudents').textContent = usersData.data.filter(u => u.role === 'student').length;
        document.getElementById('statTeachers').textContent = usersData.data.filter(u => u.role === 'teacher').length;
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  // Init
  loadClasses();
  loadRoster();
  loadUsers();
  loadStats();
});
