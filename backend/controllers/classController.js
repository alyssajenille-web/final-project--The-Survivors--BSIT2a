const Class = require('../models/Class');
const User = require('../models/User');
const ClassRoster = require('../models/ClassRoster');
const cache = require('../utils/cache');
const { parseTimeToMinutes } = require('../utils/attendanceTime');

const normalize = (value) => (value || '').trim().replace(/\s+/g, ' ');

const buildClassName = (classDoc) => {
  if (!classDoc) return '';
  return classDoc.section ? `${classDoc.name} - ${classDoc.section}` : classDoc.name;
};

const parseDaysOfWeek = (daysOfWeek) => {
  const rawDays = Array.isArray(daysOfWeek) ? daysOfWeek : [daysOfWeek];
  return [...new Set(rawDays.map(Number))]
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
};

exports.createClass = async (req, res) => {
  try {
    const { name, section, subject, teacherId, daysOfWeek, startTime, endTime, allowanceMinutes } = req.body;
    const normalizedName = normalize(name);
    const normalizedSection = normalize(section);
    const normalizedSubject = normalize(subject);
    const normalizedDays = parseDaysOfWeek(daysOfWeek);
    const startMinutes = parseTimeToMinutes(startTime);
    const endMinutes = parseTimeToMinutes(endTime);
    const gracePeriod = Number(allowanceMinutes ?? 5);

    if (!normalizedName || !teacherId || normalizedDays.length === 0 || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Class name, teacher, weekday, start time, and end time are required'
      });
    }

    const teacher = await User.findById(teacherId);
    if (!teacher || !['teacher', 'admin'].includes(teacher.role)) {
      return res.status(400).json({ success: false, message: 'Assigned teacher was not found' });
    }

    if (startMinutes === null || endMinutes === null) {
      return res.status(400).json({ success: false, message: 'Start and end time must use HH:MM format' });
    }

    if (endMinutes <= startMinutes) {
      return res.status(400).json({ success: false, message: 'End time must be later than start time' });
    }

    if (!Number.isInteger(gracePeriod) || gracePeriod < 0 || gracePeriod > 60) {
      return res.status(400).json({ success: false, message: 'Grace period must be from 0 to 60 minutes' });
    }

    const existing = await Class.findOne({
      name: normalizedName,
      section: normalizedSection,
      startTime,
      teacher: teacher._id,
      daysOfWeek: normalizedDays
    });

    if (existing) {
      if (existing.isActive) {
        return res.status(400).json({ success: false, message: 'This class schedule already exists' });
      }

      existing.subject = normalizedSubject;
      existing.teacher = teacher._id;
      existing.daysOfWeek = normalizedDays;
      existing.startTime = startTime;
      existing.endTime = endTime;
      existing.allowanceMinutes = gracePeriod;
      existing.isActive = true;
      await existing.save();
      cache.del('classes_all');

      return res.json({ success: true, message: 'Class schedule restored successfully', data: existing });
    }

    const classDoc = await Class.create({
      name: normalizedName,
      section: normalizedSection,
      subject: normalizedSubject,
      teacher: teacher._id,
      daysOfWeek: normalizedDays,
      startTime,
      endTime,
      allowanceMinutes: gracePeriod
    });

    cache.del('classes_all');
    res.status(201).json({ success: true, message: 'Class schedule created successfully', data: classDoc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getClasses = async (req, res) => {
  try {
    const query = { isActive: true };
    if (req.user.role === 'teacher') query.teacher = req.user.id;
    if (req.user.role === 'student') {
      const enrolledClassIds = await ClassRoster.find({
        studentId: req.user.studentId || req.user.id,
        isActive: true,
        class: { $exists: true, $ne: null }
      }).distinct('class');
      query._id = { $in: enrolledClassIds };
    }
    if (req.query.today === 'true') {
      query.daysOfWeek = new Date().getDay();
    }
    if (req.query.dayOfWeek !== undefined) {
      query.daysOfWeek = Number(req.query.dayOfWeek);
    }

    const classes = await Class.find(query)
      .populate('teacher', 'username email')
      .sort({ startTime: 1, name: 1, section: 1 })
      .lean();

    res.json({
      success: true,
      count: classes.length,
      data: classes.map((classDoc) => ({
        ...classDoc,
        className: buildClassName(classDoc)
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getClassById = async (req, res) => {
  try {
    const query = { _id: req.params.id, isActive: true };
    if (req.user.role === 'teacher') query.teacher = req.user.id;

    const classDoc = await Class.findOne(query).populate('teacher', 'username email').lean();
    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    res.json({ success: true, data: { ...classDoc, className: buildClassName(classDoc) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateClass = async (req, res) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) updates.name = normalize(req.body.name);
    if (req.body.section !== undefined) updates.section = normalize(req.body.section);
    if (req.body.subject !== undefined) updates.subject = normalize(req.body.subject);
    if (req.body.daysOfWeek !== undefined) updates.daysOfWeek = parseDaysOfWeek(req.body.daysOfWeek);
    if (req.body.startTime !== undefined) updates.startTime = req.body.startTime;
    if (req.body.endTime !== undefined) updates.endTime = req.body.endTime;
    if (req.body.allowanceMinutes !== undefined) updates.allowanceMinutes = Number(req.body.allowanceMinutes);

    if (req.body.teacherId) {
      const teacher = await User.findById(req.body.teacherId);
      if (!teacher || !['teacher', 'admin'].includes(teacher.role)) {
        return res.status(400).json({ success: false, message: 'Assigned teacher was not found' });
      }
      updates.teacher = teacher._id;
    }

    const classDoc = await Class.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    });

    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    cache.del('classes_all');
    res.json({ success: true, message: 'Class updated successfully', data: classDoc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteClass = async (req, res) => {
  try {
    const classDoc = await Class.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    cache.del('classes_all');
    res.json({ success: true, message: 'Class archived successfully', data: classDoc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
