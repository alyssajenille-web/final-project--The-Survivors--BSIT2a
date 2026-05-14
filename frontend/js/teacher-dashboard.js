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
  if (userData.role !== 'teacher' && userData.role !== 'admin') {
    alert('Access denied. Teachers only.');
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('teacherName').textContent = userData.username || 'Teacher';

  document.getElementById('logoutBtn')?.addEventListener('click', function () {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
  });

  // Tab switching
  window.switchTab = function (evt, tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

    evt.currentTarget.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');

    if (tabName === 'sessions') {
      loadTodayClasses();
    }
    if (tabName === 'records') loadAttendance();
  };

  // ── Session Management (NEW) ────────────────────────────────

  function classLabel(classItem) {
    return classItem.className || [classItem.name, classItem.section].filter(Boolean).join(' - ');
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

    if (now < start) return { label: 'Waiting', className: 'bg-secondary' };
    if (now > end) return { label: 'Closed', className: 'bg-danger' };
    return { label: 'Open', className: 'bg-success' };
  }

  async function loadTodayClasses() {
    const grid = document.getElementById('todayClassesGrid');
    if (!grid) return;

    try {
      const response = await fetch(`${API_URL}/classes?today=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      const classes = result.data || [];

      if (!response.ok || classes.length === 0) {
        grid.innerHTML = '<p class="text-muted text-center p-3">No assigned classes scheduled for today.</p>';
        return;
      }

      grid.innerHTML = classes.map(c => {
        const label = classLabel(c);
        const subject = c.subject || 'No subject';
        const time = formatTimeRange(c.startTime, c.endTime);
        const state = getScheduleState(c);

        return `
          <div class="session-card p-3 border rounded bg-light d-flex justify-content-between align-items-center">
            <div>
              <h4 class="mb-1 text-primary">${label}</h4>
              <p class="mb-1 fw-semibold">${subject}</p>
              <p class="mb-1 text-secondary">
                <i class="fas fa-calendar-alt me-1"></i> Today |
                <i class="fas fa-clock me-1"></i> ${time}
              </p>
              <p class="mb-0 text-muted small">Grace period: ${c.allowanceMinutes ?? 5} minutes</p>
            </div>
            <span class="badge ${state.className}">${state.label}</span>
          </div>
        `;
      }).join('');
    } catch (error) {
      grid.innerHTML = '<p class="text-danger text-center">Failed to load today classes.</p>';
    }
  }

  // ── Attendance Records ──────────────────────────────────────
  let attendanceRecords = [];
  let scheduleOptions = [];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function getRecordSubject(record) {
    return record.class?.subject || record.subject || record.session?.className || 'General';
  }

  function getRecordSchedule(record) {
    const classSchedule = record.class;
    const startTime = classSchedule?.startTime || record.session?.startTime || '';
    const endTime = classSchedule?.endTime || record.session?.endTime || '';
    const days = classSchedule?.daysOfWeek || [];
    return {
      days,
      timeValue: startTime && endTime ? `${startTime}-${endTime}` : '',
      timeLabel: startTime && endTime ? `${startTime} - ${endTime}` : 'N/A',
      dayLabel: days.length ? days.map(day => dayNames[day]).join(', ') : new Date(record.timeIn).toLocaleDateString(undefined, { weekday: 'long' })
    };
  }

  function scheduleFilterValue(schedule) {
    return `${schedule._id || 'legacy'}|${schedule.startTime || ''}|${schedule.endTime || ''}`;
  }

  function scheduleFilterLabel(schedule) {
    const subject = schedule.subject || classLabel(schedule);
    const days = (schedule.daysOfWeek || []).map(day => dayNames[day]?.slice(0, 3)).filter(Boolean).join('/');
    const time = schedule.startTime && schedule.endTime ? `${schedule.startTime} - ${schedule.endTime}` : 'No time';
    return `${subject} - ${days || 'No day'} - ${time}`;
  }

  async function loadRecordFilters() {
    try {
      const response = await fetch(`${API_URL}/classes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      scheduleOptions = result.data || [];

      const scheduleFilter = document.getElementById('scheduleFilter');
      if (!scheduleFilter) return;

      scheduleFilter.innerHTML = '<option value="">All Class Schedules</option>' + scheduleOptions
        .map(schedule => `<option value="${scheduleFilterValue(schedule)}">${scheduleFilterLabel(schedule)}</option>`)
        .join('');
    } catch (error) {
      console.error('Error loading record filters:', error);
    }
  }

  function renderAttendance(records) {
    const tableBody = document.getElementById('attendanceTableBody');
    if (!tableBody) return;

    if (!records.length) {
      tableBody.innerHTML = '<tr><td colspan="8" class="text-center">No attendance records match the filters</td></tr>';
      return;
    }

    tableBody.innerHTML = records.map(record => {
      const date = new Date(record.timeIn).toLocaleDateString();
      const time = record.markedByAdmin && record.status === 'Absent' ? '--:--' : new Date(record.timeIn).toLocaleTimeString();
      const schedule = getRecordSchedule(record);

      let statusClass = 'badge-secondary';
      if (record.status === 'Present') statusClass = 'bg-success';
      if (record.status === 'Early') statusClass = 'bg-success';
      if (record.status === 'On-Time') statusClass = 'bg-primary';
      if (record.status === 'Late') statusClass = 'bg-warning text-dark';
      if (record.status === 'Absent') statusClass = 'bg-danger';
      if (record.status === 'Excused') statusClass = 'bg-info text-dark';

      const studentName = record.user?.username || record.studentId || 'Unknown';
      const autoTag = record.markedByAdmin ? ' <small class="text-white-50">(Auto)</small>' : '';

      return `
        <tr>
          <td>${studentName}</td>
          <td>${record.studentId || 'N/A'}</td>
          <td>${getRecordSubject(record)}</td>
          <td>${schedule.dayLabel}<br><small class="text-muted">${schedule.timeLabel}</small></td>
          <td>${date}</td>
          <td>${time}</td>
          <td><span class="badge ${statusClass}">${record.status}${autoTag}</span></td>
          <td>
            <button class="btn btn-sm btn-info" onclick="viewDetails('${record._id}')">View</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function applyAttendanceFilters() {
    const searchValue = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
    const scheduleValue = document.getElementById('scheduleFilter')?.value || '';
    const statusValue = document.getElementById('statusFilter')?.value || '';

    const filtered = attendanceRecords.filter(record => {
      const schedule = getRecordSchedule(record);
      const studentName = (record.user?.username || '').toLowerCase();
      const studentId = (record.studentId || '').toLowerCase();
      const recordScheduleValue = `${record.class?._id || 'legacy'}|${record.class?.startTime || record.session?.startTime || ''}|${record.class?.endTime || record.session?.endTime || ''}`;

      return (!searchValue || studentName.includes(searchValue) || studentId.includes(searchValue))
        && (!scheduleValue || recordScheduleValue === scheduleValue)
        && (!statusValue || record.status === statusValue);
    });

    renderAttendance(filtered);
  }

  async function loadAttendance() {
    const tableBody = document.getElementById('attendanceTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="8" class="text-center">Loading...</td></tr>';

    try {
      await loadRecordFilters();
      const response = await fetch(`${API_URL}/attendance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (!response.ok) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">${data.message}</td></tr>`;
        return;
      }

      if (!data.data || data.data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center">No attendance records yet</td></tr>';
        return;
      }

      attendanceRecords = data.data;
      applyAttendanceFilters();

    } catch (error) {
      console.error('Error loading attendance:', error);
      tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Failed to load data</td></tr>';
    }
  }

  ['searchInput', 'scheduleFilter', 'statusFilter'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', applyAttendanceFilters);
    document.getElementById(id)?.addEventListener('change', applyAttendanceFilters);
  });

  // ── Stats ───────────────────────────────────────────────────

  async function loadStats() {
    try {
      const response = await fetch(`${API_URL}/attendance/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (!data.data) return;

      document.getElementById('statEarly').textContent = data.data.today.Early || 0;
      document.getElementById('statOnTime').textContent = data.data.today['On-Time'] || 0;
      document.getElementById('statLate').textContent = data.data.today.Late || 0;
      document.getElementById('statAbsent').textContent = data.data.today.Absent || 0;
      document.getElementById('statTotal').textContent = data.data.total || 0;

    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  // ── Student Summary ─────────────────────────────────────────

  async function loadStudentSummary() {
    const grid = document.getElementById('studentSummaryGrid');
    if (!grid) return;

    try {
      const response = await fetch(`${API_URL}/attendance/student-summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();

      if (!response.ok || !result.data || result.data.length === 0) {
        grid.innerHTML = '<div class="text-center w-100 p-3">No student activity data available.</div>';
        return;
      }
      renderStudentCards(result.data);
    } catch (error) {
      grid.innerHTML = '<div class="text-center text-danger w-100 p-3">Failed to load student data.</div>';
    }
  }

  function renderStudentCards(students) {
    const grid = document.getElementById('studentSummaryGrid');
    if (!grid) return;

    // Using the same rendering logic you previously had
    grid.innerHTML = students.map(student => {
      const total = student.total || 1;
      const earlyPct = ((student.Early / total) * 100).toFixed(1);
      const absentPct = ((student.Absent / total) * 100).toFixed(1);

      return `
        <div class="student-card p-3 border rounded mb-2">
          <h4>${student.studentName}</h4>
          <div class="text-muted">ID: ${student.studentId}</div>
          <div class="mt-2">
            <span class="badge bg-success">Early: ${student.Early}</span>
            <span class="badge bg-success">Present: ${student.Present || 0}</span>
            <span class="badge bg-primary">On-Time: ${student['On-Time']}</span>
            <span class="badge bg-warning text-dark">Late: ${student.Late}</span>
            <span class="badge bg-danger">Absent: ${student.Absent}</span>
            <span class="badge bg-info text-dark">Excused: ${student.Excused || 0}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── View Details ────────────────────────────────────────────
  window.viewDetails = async function (id) {
    try {
      const response = await fetch(`${API_URL}/attendance/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        const record = data.data;
        alert(`Student: ${record.user?.username || record.studentId}\nStatus: ${record.status}\nSubject: ${record.subject || 'General'}\nNotes: ${record.notes || 'None'}`);
      }
    } catch (error) {
      alert('Failed to load details');
    }
  };

  // ── Init ────────────────────────────────────────────────────
  loadTodayClasses();
  loadAttendance();
  loadStats();
  loadStudentSummary();
});
