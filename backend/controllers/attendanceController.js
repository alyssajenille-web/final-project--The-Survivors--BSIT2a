const Attendance = require('../models/Attendance');
const User = require('../models/User');
const ClassSchedule = require('../models/ClassSchedule');
const AttendanceSession = require('../models/AttendanceSession');
const ClassRoster = require('../models/ClassRoster');
const Class = require('../models/Class');
const cache = require('../utils/cache');
const {
  combineDateAndTime,
  endOfLocalDay,
  getSchoolTimeMinutes,
  getSchoolTimeParts,
  isSameLocalDay,
  parseTimeToMinutes,
  startOfLocalDay
} = require('../utils/attendanceTime');

const clearAttendanceCaches = (studentId, recordId) => {
  cache.del('attendance_all');
  cache.del('attendance_student_summary');
  if (studentId) cache.del(`attendance_student_${studentId}`);
  if (recordId) cache.del(`attendance_${recordId}`);

  cache.keys()
    .filter((key) => key.startsWith('attendance_student_summary_') || key.startsWith('attendance_all_teacher_'))
    .forEach((key) => cache.del(key));
};

const classifyTime = (time, schedule) => {
  const totalMinutes = getSchoolTimeMinutes(time);

  if (schedule && schedule.startTime) {
    const startTotal = parseTimeToMinutes(schedule.startTime);
    if (startTotal === null) return { status: 'Absent', arrivalType: 'None' };

    const allowance = schedule.allowanceMinutes ?? 5;
    const onTimeThreshold = startTotal + allowance;
    const endTotal = parseTimeToMinutes(schedule.endTime) ?? startTotal + 60;

    if (totalMinutes < startTotal) return { status: 'Present', arrivalType: 'Early' };
    if (totalMinutes <= onTimeThreshold) return { status: 'Present', arrivalType: 'On-Time' };
    if (totalMinutes <= endTotal) return { status: 'Late', arrivalType: 'Late' };
    return { status: 'Absent', arrivalType: 'None' };
  }

  // Default fallback if no schedule is saved yet
  if (totalMinutes < 8 * 60) return { status: 'Present', arrivalType: 'Early' };
  if (totalMinutes <= 8 * 60 + 30) return { status: 'Present', arrivalType: 'On-Time' };
  if (totalMinutes <= 9 * 60 + 59) return { status: 'Late', arrivalType: 'Late' };
  return { status: 'Absent', arrivalType: 'None' };
};

const displayClassName = (classDoc) => {
  if (!classDoc) return '';
  return classDoc.section ? `${classDoc.name} - ${classDoc.section}` : classDoc.name;
};

const ensureTodayAbsences = async (user) => {
  const now = new Date();
  const schoolNow = getSchoolTimeParts(now);
  const classQuery = {
    isActive: true,
    daysOfWeek: schoolNow.dayOfWeek
  };

  if (user.role === 'teacher') {
    classQuery.teacher = user.id;
  }

  if (user.role === 'student') {
    const classIds = await ClassRoster.find({
      studentId: user.studentId || user.id,
      isActive: true,
      class: { $exists: true, $ne: null }
    }).distinct('class');
    classQuery._id = { $in: classIds };
  }

  const classes = await Class.find(classQuery);
  let changed = false;

  for (const classDoc of classes) {
    const sessionEnd = combineDateAndTime(now, classDoc.endTime);
    if (!sessionEnd || now <= sessionEnd) continue;

    let session = await AttendanceSession.findOne({
      class: classDoc._id,
      sessionDate: {
        $gte: startOfLocalDay(now),
        $lte: endOfLocalDay(now)
      }
    });

    if (!session) {
      session = await AttendanceSession.create({
        sessionDate: startOfLocalDay(now),
        className: displayClassName(classDoc),
        class: classDoc._id,
        startTime: classDoc.startTime,
        endTime: classDoc.endTime,
        allowanceMinutes: classDoc.allowanceMinutes ?? 5,
        createdBy: classDoc.teacher,
        status: 'closed',
        notes: 'Auto-created after scheduled class ended'
      });
      changed = true;
    }

    const roster = await ClassRoster.find({ class: classDoc._id, isActive: true });
    const checkedIn = await Attendance.find({ session: session._id }).select('studentId');
    const checkedInIds = new Set(checkedIn.map(record => record.studentId));
    const absenceTime = sessionEnd;

    const absences = roster
      .filter(entry => !checkedInIds.has(entry.studentId))
      .map(entry => ({
        session: session._id,
        class: classDoc._id,
        studentId: entry.studentId,
        user: entry.student,
        timeIn: absenceTime,
        status: 'Absent',
        arrivalType: 'None',
        subject: displayClassName(classDoc),
        markedByAdmin: true,
        notes: 'Auto-marked absent: no check-in before scheduled end time'
      }));

    if (absences.length > 0) {
      await Attendance.insertMany(absences, { ordered: false });
      changed = true;
    }

    if (session.status !== 'closed') {
      session.status = 'closed';
      await session.save();
      changed = true;
    }
  }

  if (changed) clearAttendanceCaches();
};

// Check in with session ID (new session-based check-in)
exports.checkInWithSession = async (req, res) => {
  try {
    const { sessionId, classId, subject, notes } = req.body;

    const student = await User.findById(req.user.id);
    if (!student || student.role !== 'student') {
      return res.status(403).json({ success: false, message: 'Only student accounts can check in' });
    }

    let session = sessionId ? await AttendanceSession.findById(sessionId) : null;
    let classDoc = null;

    if (!session && classId) {
      classDoc = await Class.findOne({ _id: classId, isActive: true });
      if (!classDoc) {
        return res.status(404).json({ success: false, message: 'Class schedule not found' });
      }

      const now = new Date();
      const schoolNow = getSchoolTimeParts(now);
      if (!classDoc.daysOfWeek.includes(schoolNow.dayOfWeek)) {
        return res.status(400).json({ success: false, message: 'This class is not scheduled today' });
      }

      const nowMinutes = schoolNow.hour * 60 + schoolNow.minute;
      const startMinutes = parseTimeToMinutes(classDoc.startTime);
      const endMinutes = parseTimeToMinutes(classDoc.endTime);
      if (startMinutes === null || endMinutes === null || nowMinutes < startMinutes || nowMinutes > endMinutes) {
        return res.status(400).json({ success: false, message: 'Check-in is only open during the scheduled class time' });
      }

      session = await AttendanceSession.findOne({
        class: classDoc._id,
        sessionDate: {
          $gte: startOfLocalDay(now),
          $lte: endOfLocalDay(now)
        }
      });

      if (!session) {
        session = await AttendanceSession.create({
          sessionDate: startOfLocalDay(now),
          className: displayClassName(classDoc),
          class: classDoc._id,
          startTime: classDoc.startTime,
          endTime: classDoc.endTime,
          allowanceMinutes: classDoc.allowanceMinutes ?? 5,
          createdBy: classDoc.teacher,
          status: 'open',
          notes: 'Auto-created from class schedule at student check-in'
        });
      } else if (session.status === 'closed' && now <= sessionEnd) {
        session.status = 'open';
        await session.save();
      }
    }

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.status === 'closed') {
      return res.status(400).json({ success: false, message: 'This session is closed' });
    }

    const now = new Date();
    if (!isSameLocalDay(now, session.sessionDate)) {
      return res.status(400).json({
        success: false,
        message: 'Check-in is only allowed on the scheduled session date'
      });
    }

    const sessionEnd = combineDateAndTime(session.sessionDate, session.endTime);
    if (!sessionEnd) {
      return res.status(400).json({ success: false, message: 'Session has an invalid end time' });
    }

    if (now > sessionEnd) {
      return res.status(400).json({
        success: false,
        message: 'Check-in is closed because the class session has ended'
      });
    }

    const studentIdValue = student.studentId || student._id.toString();

    // Validate student is in roster for this class
    const rosterQuery = {
      studentId: studentIdValue,
      isActive: true
    };
    if (session.class) rosterQuery.class = session.class;
    else rosterQuery.className = session.className;

    const rosterEntry = await ClassRoster.findOne(rosterQuery);

    if (!rosterEntry) {
      return res.status(403).json({
        success: false,
        message: 'You are not enrolled in this class'
      });
    }

    // Check if already checked in for this session
    const alreadyCheckedIn = await Attendance.findOne({
      session: session._id,
      studentId: studentIdValue
    });

    if (alreadyCheckedIn) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked in for this session'
      });
    }

    const { status, arrivalType } = classifyTime(now, session);

    const record = new Attendance({
      session: session._id,
      class: session.class,
      studentId: studentIdValue,
      user: student._id,
      timeIn: now,
      status,
      arrivalType,
      subject: subject || session.className,
      notes: notes || '',
      markedByAdmin: false
    });

    await record.save();

    clearAttendanceCaches(studentIdValue);

    res.status(201).json({
      success: true,
      message: 'Check-in successful',
      data: {
        ...record.toObject(),
        studentName: student.username,
        session: {
          className: session.className,
          sessionDate: session.sessionDate
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Legacy check-in (backward compatibility with old flow)
exports.checkIn = async (req, res) => {
  try {
    const { subject, notes } = req.body;

    const student = await User.findById(req.user.id);
    if (!student || student.role !== 'student') {
      return res.status(403).json({ success: false, message: 'Only student accounts can check in' });
    }

    const now = new Date();
    const studentIdValue = student.studentId || student._id.toString();

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // For legacy flow, check if already checked in today
    const alreadyCheckedIn = await Attendance.findOne({
      studentId: studentIdValue,
      timeIn: { $gte: startOfDay, $lt: endOfDay },
      markedByAdmin: false
    });

    if (alreadyCheckedIn) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked in today. Multiple same-day check-ins are not allowed.'
      });
    }

    // Fetch active schedule from DB
    const schedule = await ClassSchedule.findOne().sort({ updatedAt: -1 });
    const { status, arrivalType } = classifyTime(now, schedule);

    const record = new Attendance({
      studentId: studentIdValue,
      user: student._id,
      timeIn: now,
      status,
      arrivalType,
      subject: subject || (schedule?.className) || 'General',
      notes: notes || '',
      markedByAdmin: false
    });

    await record.save();

    clearAttendanceCaches(studentIdValue);

    res.status(201).json({
      success: true,
      message: 'Check-in successful',
      data: {
        ...record.toObject(),
        studentName: student.username
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// Keep all other exports exactly as they were (getAll, getMyAttendance, getById, getStats, getStudentSummary, update, deleteAttendance)
exports.getAll = async (req, res) => {
  try {
    await ensureTodayAbsences(req.user);
    const cacheKey = req.user.role === 'teacher'
      ? `attendance_all_teacher_${req.user.id}`
      : 'attendance_all';
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      console.log('📦 Serving attendance from cache');
      return res.json({
        success: true,
        source: 'cache',
        count: cachedData.length,
        data: cachedData
      });
    }

    const query = {};

    if (req.user.role === 'teacher') {
      const classIds = await Class.find({ teacher: req.user.id, isActive: true }).distinct('_id');
      const sessions = await AttendanceSession.find({
        $or: [
          { class: { $in: classIds } },
          { createdBy: req.user.id }
        ]
      }).distinct('_id');

      query.$or = [
        { class: { $in: classIds } },
        { session: { $in: sessions } }
      ];
    }

    const data = await Attendance.find(query)
      .populate('user', 'username email role')
      .populate('class', 'name section subject daysOfWeek startTime endTime')
      .populate('session', 'className sessionDate startTime endTime')
      .lean()
      .sort({ timeIn: -1 });

    cache.set(cacheKey, data);
    console.log('💾 Attendance stored in cache');

    res.json({
      success: true,
      source: 'database',
      count: data.length,
      data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyAttendance = async (req, res) => {
  try {
    await ensureTodayAbsences(req.user);
    const studentId = req.user.studentId || req.user.id;
    const cacheKey = `attendance_student_${studentId}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json({
        success: true,
        source: 'cache',
        count: cachedData.length,
        data: cachedData
      });
    }

    const data = await Attendance.find({ studentId })
      .lean()
      .sort({ timeIn: -1 });

    cache.set(cacheKey, data);

    res.json({
      success: true,
      source: 'database',
      count: data.length,
      data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const cacheKey = `attendance_${req.params.id}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json({
        success: true,
        source: 'cache',
        data: cachedData
      });
    }

    const record = await Attendance.findById(req.params.id)
      .populate('user', 'username email')
      .lean();

    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    cache.set(cacheKey, record);

    res.json({
      success: true,
      source: 'database',
      data: record
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    await ensureTodayAbsences(req.user);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const match = { timeIn: { $gte: today } };
    if (req.user.role === 'teacher') {
      const classIds = await Class.find({ teacher: req.user.id, isActive: true }).distinct('_id');
      const sessions = await AttendanceSession.find({
        $or: [
          { class: { $in: classIds } },
          { createdBy: req.user.id }
        ]
      }).distinct('_id');
      match.$or = [
        { class: { $in: classIds } },
        { session: { $in: sessions } }
      ];
    }

    const records = await Attendance.find(match).select('status arrivalType').lean();
    const statusCounts = {
      Early: 0,
      'On-Time': 0,
      Present: 0,
      Late: 0,
      Absent: 0,
      Excused: 0
    };

    records.forEach((record) => {
      if (['Present', 'Early', 'On-Time'].includes(record.status)) statusCounts.Present += 1;
      if (record.status === 'Late') statusCounts.Late += 1;
      if (record.status === 'Absent') statusCounts.Absent += 1;
      if (record.status === 'Excused') statusCounts.Excused += 1;

      if (record.arrivalType === 'Early' || record.status === 'Early') statusCounts.Early += 1;
      if (record.arrivalType === 'On-Time' || record.status === 'On-Time') statusCounts['On-Time'] += 1;
    });

    const total = records.length;

    res.json({
      success: true,
      data: {
        today: statusCounts,
        total,
        percentages: {
          Early: total ? ((statusCounts.Early / total) * 100).toFixed(1) : 0,
          'On-Time': total ? ((statusCounts['On-Time'] / total) * 100).toFixed(1) : 0,
          Present: total ? ((statusCounts.Present / total) * 100).toFixed(1) : 0,
          Late: total ? ((statusCounts.Late / total) * 100).toFixed(1) : 0,
          Absent: total ? ((statusCounts.Absent / total) * 100).toFixed(1) : 0,
          Excused: total ? ((statusCounts.Excused / total) * 100).toFixed(1) : 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStudentSummary = async (req, res) => {
  try {
    await ensureTodayAbsences(req.user);
    const cacheKey = req.user.role === 'teacher'
      ? `attendance_student_summary_${req.user.id}`
      : 'attendance_student_summary';
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json({ success: true, source: 'cache', count: cachedData.length, data: cachedData });
    }

    const matchStage = {};
    if (req.user.role === 'teacher') {
      const classIds = await Class.find({ teacher: req.user.id, isActive: true }).distinct('_id');
      const sessions = await AttendanceSession.find({
        $or: [
          { class: { $in: classIds } },
          { createdBy: req.user.id }
        ]
      }).distinct('_id');
      matchStage.$or = [
        { class: { $in: classIds } },
        { session: { $in: sessions } }
      ];
    }

    const pipeline = [];
    if (Object.keys(matchStage).length) pipeline.push({ $match: matchStage });

    const summary = await Attendance.aggregate([
      ...pipeline,
      {
        $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userInfo' }
      },
      {
        $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true }
      },
      {
        $group: {
          _id: '$studentId',
          studentName: { $first: { $ifNull: ['$userInfo.username', '$studentId'] } },
          email: { $first: { $ifNull: ['$userInfo.email', 'N/A'] } },
          Early: { $sum: { $cond: [{ $or: [{ $eq: ['$arrivalType', 'Early'] }, { $eq: ['$status', 'Early'] }] }, 1, 0] } },
          'On-Time': { $sum: { $cond: [{ $or: [{ $eq: ['$arrivalType', 'On-Time'] }, { $eq: ['$status', 'On-Time'] }] }, 1, 0] } },
          Present: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Early', 'On-Time']] }, 1, 0] } },
          Late: { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } },
          Absent: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
          Excused: { $sum: { $cond: [{ $eq: ['$status', 'Excused'] }, 1, 0] } },
          total: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          studentId: '$_id',
          studentName: 1,
          email: 1,
          Early: 1,
          'On-Time': 1,
          Present: 1,
          Late: 1,
          Absent: 1,
          Excused: 1,
          total: 1,
          percentages: {
            Early: { $cond: [{ $eq: ['$total', 0] }, 0, { $multiply: [{ $divide: ['$Early', '$total'] }, 100] }] },
            'On-Time': { $cond: [{ $eq: ['$total', 0] }, 0, { $multiply: [{ $divide: ['$On-Time', '$total'] }, 100] }] },
            Present: { $cond: [{ $eq: ['$total', 0] }, 0, { $multiply: [{ $divide: ['$Present', '$total'] }, 100] }] },
            Late: { $cond: [{ $eq: ['$total', 0] }, 0, { $multiply: [{ $divide: ['$Late', '$total'] }, 100] }] },
            Absent: { $cond: [{ $eq: ['$total', 0] }, 0, { $multiply: [{ $divide: ['$Absent', '$total'] }, 100] }] },
            Excused: { $cond: [{ $eq: ['$total', 0] }, 0, { $multiply: [{ $divide: ['$Excused', '$total'] }, 100] }] }
          }
        }
      },
      { $sort: { studentName: 1 } }
    ]);

    cache.set(cacheKey, summary);

    res.json({ success: true, source: 'database', count: summary.length, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const allowedStatuses = ['Present', 'Late', 'Absent', 'Excused'];
    const updates = {};

    if (req.body.status !== undefined) {
      if (!allowedStatuses.includes(req.body.status)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be Present, Late, Absent, or Excused'
        });
      }
      updates.status = req.body.status;
      updates.arrivalType = req.body.status === 'Present' ? 'On-Time' : 'None';
    }

    if (req.body.notes !== undefined) updates.notes = req.body.notes;
    if (req.body.subject !== undefined) updates.subject = req.body.subject;
    updates.markedByAdmin = true;

    const updated = await Attendance.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    clearAttendanceCaches(updated.studentId, req.params.id);

    res.json({ success: true, message: 'Updated successfully', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAttendance = async (req, res) => {
  try {
    const record = await Attendance.findByIdAndDelete(req.params.id);

    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    clearAttendanceCaches(record.studentId, req.params.id);

    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
