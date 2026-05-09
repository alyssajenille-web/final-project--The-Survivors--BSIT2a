const Attendance = require('../models/Attendance');
const User = require('../models/User');
const cache = require('../utils/cache');

const classifyTime = (time) => {
  const hour = new Date(time).getHours();
  const minute = new Date(time).getMinutes();

  // More precise classification
  if (hour < 8) return 'Early';
  if (hour === 8 && minute <= 30) return 'On-Time';  // Grace period until 8:30
  if (hour === 8 && minute > 30 || hour === 9) return 'Late';
  return 'Absent';
};

exports.checkIn = async (req, res) => {
  try {
    const { studentId, subject, notes } = req.body;

    // Verify student exists
    const student = await User.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student ID not found' });
    }

    const now = new Date();
    const status = classifyTime(now);

    const record = new Attendance({
      studentId,
      user: student._id,
      timeIn: now,
      status,
      subject: subject || 'General',
      notes: notes || ''
    });

    await record.save();

    // Clear related caches
    cache.del('attendance_all');
    cache.del(`attendance_student_${studentId}`);

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

exports.getAll = async (req, res) => {
  try {
    const cachedData = cache.get('attendance_all');

    if (cachedData) {
      console.log('📦 Serving attendance from cache');
      return res.json({
        success: true,
        source: 'cache',
        count: cachedData.length,
        data: cachedData
      });
    }

    const data = await Attendance.find()
      .populate('user', 'username email role')
      .lean()
      .sort({ timeIn: -1 });

    cache.set('attendance_all', data);
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await Attendance.aggregate([
      {
        $match: {
          timeIn: { $gte: today }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Format stats with defaults for missing statuses
    const statusCounts = {
      Early: 0,
      'On-Time': 0,
      Late: 0,
      Absent: 0
    };

    stats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });

    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    res.json({
      success: true,
      data: {
        today: statusCounts,
        total,
        percentages: {
          Early: total ? ((statusCounts.Early / total) * 100).toFixed(1) : 0,
          'On-Time': total ? ((statusCounts['On-Time'] / total) * 100).toFixed(1) : 0,
          Late: total ? ((statusCounts.Late / total) * 100).toFixed(1) : 0,
          Absent: total ? ((statusCounts.Absent / total) * 100).toFixed(1) : 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const updated = await Attendance.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    cache.del('attendance_all');
    cache.del(`attendance_${req.params.id}`);
    cache.del(`attendance_student_${updated.studentId}`);

    res.json({
      success: true,
      message: 'Updated successfully',
      data: updated
    });
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

    cache.del('attendance_all');
    cache.del(`attendance_${req.params.id}`);
    cache.del(`attendance_student_${record.studentId}`);

    res.json({
      success: true,
      message: 'Deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};