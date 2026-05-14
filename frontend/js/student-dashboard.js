// DYNAMIC API URL SETUP (Ensures it works on local and Render)
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
  if (userData.role !== 'student') {
    alert('Access denied. Students only.');
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('studentName').textContent = userData.username || 'Student';
  document.getElementById('studentId').textContent = userData.studentId || 'N/A';

  document.getElementById('logoutBtn')?.addEventListener('click', function () {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
  });

  // Load available sessions
  function todayLocalDate() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  function classLabel(classItem) {
    return [classItem.name, classItem.subject, classItem.section].filter(Boolean).join(' - ') || classItem.className || 'Class';
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

  function getScheduleState(schedule) {
    const now = new Date();
    const [startHour, startMinute] = (schedule.startTime || '00:00').split(':').map(Number);
    const [endHour, endMinute] = (schedule.endTime || '00:00').split(':').map(Number);
    const start = new Date(now);
    start.setHours(startHour, startMinute, 0, 0);
    const end = new Date(now);
    end.setHours(endHour, endMinute, 0, 0);

    if (now < start) return { label: 'Waiting', className: 'bg-secondary', canCheckIn: false };
    if (now > end) return { label: 'Closed', className: 'bg-danger', canCheckIn: false };
    return { label: 'Open', className: 'bg-success', canCheckIn: true };
  }

  async function loadAvailableSessions() {
    const container = document.getElementById('availableSessionsContainer');
    if (!container) return;

    try {
      const today = todayLocalDate();
      const headers = { 'Authorization': `Bearer ${token}` };
      const [classesResponse, sessionsResponse, attendanceResponse] = await Promise.all([
        fetch(`${API_URL}/classes?today=true`, { headers }),
        fetch(`${API_URL}/sessions?startDate=${today}&endDate=${today}`, { headers }),
        fetch(`${API_URL}/attendance/my-attendance`, { headers })
      ]);

      const classesResult = await classesResponse.json();
      const sessionsResult = await sessionsResponse.json();
      const attendanceResult = await attendanceResponse.json();

      const classes = classesResult.data || [];
      const sessions = sessionsResult.data || [];
      const records = attendanceResult.data || [];

      if (!classesResponse.ok || classes.length === 0) {
        container.innerHTML = '<p class="text-muted">No classes scheduled for you today.</p>';
        return;
      }

      const sessionsByClass = new Map(
        sessions.map(session => [(session.class?._id || session.class || session.className || '').toString(), session])
      );
      const checkedSessionIds = new Set(records.filter(record => record.session).map(record => (record.session._id || record.session).toString()));

      container.innerHTML = `
        <div class="sessions-list d-flex flex-column gap-3">
          ${classes.map(classItem => {
        const session = sessionsByClass.get(classItem._id.toString());
        const time = formatTimeRange(classItem.startTime, classItem.endTime);
        const isCheckedIn = session && checkedSessionIds.has(session._id.toString());
        const state = getScheduleState(classItem);
        const statusClass = isCheckedIn ? 'bg-primary' : state.className;
        const statusText = isCheckedIn ? 'Checked In' : state.label;
        const action = state.canCheckIn && !isCheckedIn
          ? `<button class="btn btn-success" onclick="quickCheckIn('${classItem._id}', '${classLabel(classItem).replace(/'/g, "\\'")}')">
              <i class="fas fa-check-circle me-1"></i> Check In
            </button>`
          : `<button class="btn btn-outline-secondary" disabled>${statusText}</button>`;

        return `
              <div class="session-card p-3 border rounded bg-light">
                <div class="d-flex justify-content-between align-items-start gap-3">
                  <h4 class="mb-2 text-primary">${classLabel(classItem)}</h4>
                  <span class="badge ${statusClass}">${statusText}</span>
                </div>
                <p class="mb-1 text-secondary">
                  <i class="fas fa-calendar-alt me-1"></i> Today | 
                  <i class="fas fa-clock me-1"></i> ${time}
                </p>
                <p class="mb-3 text-muted small">Grace period: ${classItem.allowanceMinutes ?? 5} minutes</p>
                ${action}
              </div>
            `;
      }).join('')}
        </div>
      `;
    } catch (error) {
      console.error('Error loading sessions:', error);
      container.innerHTML = '<p class="text-danger">Failed to load available sessions.</p>';
    }
  }

  // Quick check-in to a scheduled class
  window.quickCheckIn = async function (classId, className) {
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`${API_URL}/attendance/checkin-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          classId,
          subject: className,
          notes: 'Checked in via Student Dashboard'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // Specifically look for the "Not enrolled" error from the backend
        if (response.status === 403) {
          alert(`❌ You cannot check in because you are not enrolled in ${className}.`);
        } else {
          alert(`❌ ${data.message || 'Check-in failed'}`);
        }
        return;
      }

      alert(`✅ Check-in successful!\nStatus: ${data.data.status}\nClass: ${className}`);

      // Refresh the UI
      loadAttendanceHistory();
      loadStats();
      loadAvailableSessions();

    } catch (error) {
      console.error('Check-in error:', error);
      alert('❌ Cannot connect to server.');
    }
  };

  async function loadAttendanceHistory() {
    const tableBody = document.getElementById('attendanceTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Loading...</td></tr>';

    try {
      const response = await fetch(`${API_URL}/attendance/my-attendance`, {
        headers: { 'Authorization': `Bearer ${token}` }
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

        let badgeColor = 'bg-secondary';
        if (record.status === 'Present') badgeColor = 'bg-success';
        if (record.status === 'Early') badgeColor = 'bg-success';
        if (record.status === 'On-Time') badgeColor = 'bg-primary';
        if (record.status === 'Late') badgeColor = 'bg-warning text-dark';
        if (record.status === 'Absent') badgeColor = 'bg-danger';
        if (record.status === 'Excused') badgeColor = 'bg-info text-dark';

        return `
          <tr>
            <td>${date}</td>
            <td>${time}</td>
            <td><span class="badge ${badgeColor}">${record.status}</span>${record.arrivalType && record.arrivalType !== 'None' ? `<div class="small text-muted">${record.arrivalType}</div>` : ''}</td>
            <td>${record.subject || 'General'}</td>
          </tr>
        `;
      }).join('');

    } catch (error) {
      console.error('Error loading attendance:', error);
      tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Failed to load data</td></tr>';
    }
  }

  async function loadStats() {
    try {
      const response = await fetch(`${API_URL}/attendance/my-attendance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (!data.data) return;

      const stats = { 'Early': 0, 'On-Time': 0, 'Late': 0, 'Absent': 0 };

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

  // Initial Load
  loadAttendanceHistory();
  loadStats();
  loadAvailableSessions();
});
