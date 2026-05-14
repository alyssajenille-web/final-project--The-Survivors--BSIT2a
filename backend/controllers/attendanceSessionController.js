const AttendanceSession = require('../models/AttendanceSession');
const Attendance = require('../models/Attendance');
const ClassRoster = require('../models/ClassRoster');
const Class = require('../models/Class');
const cache = require('../utils/cache');
const {
    combineDateAndTime,
    endOfLocalDay,
    parseLocalDateOnly,
    parseTimeToMinutes,
    startOfLocalDay
} = require('../utils/attendanceTime');

const normalizeClassName = (className) => className.trim().replace(/\s+/g, ' ');
const displayClassName = (classDoc) => {
    if (!classDoc) return '';
    return classDoc.section ? `${classDoc.name} - ${classDoc.section}` : classDoc.name;
};

const clearAttendanceCaches = () => {
    cache.del('attendance_all');
    cache.del('attendance_student_summary');
    cache.del('attendance_sessions_all');

    cache.keys()
        .filter((key) => key.startsWith('attendance_student_'))
        .forEach((key) => cache.del(key));
};

// Create an attendance session (for a specific class on a specific date)
exports.createSession = async (req, res) => {
    try {
        const { sessionDate, className, classId, startTime, endTime, allowanceMinutes, notes } = req.body;

        if ((!sessionDate && !classId) || (!className && !classId) || ((!startTime || !endTime) && !classId)) {
            return res.status(400).json({
                success: false,
                message: 'sessionDate, class, startTime, and endTime are required'
            });
        }

        let classDoc = null;
        if (classId) {
            classDoc = await Class.findOne({ _id: classId, isActive: true });
            if (!classDoc) {
                return res.status(404).json({ success: false, message: 'Class not found' });
            }

            if (req.user.role === 'teacher' && classDoc.teacher.toString() !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only open sessions for classes assigned to you'
                });
            }
        }

        const scheduledDate = sessionDate || new Date();
        const scheduledStartTime = startTime || classDoc?.startTime;
        const scheduledEndTime = endTime || classDoc?.endTime;
        const normalizedClassName = classDoc ? displayClassName(classDoc) : normalizeClassName(className);
        const parsedDate = new Date(scheduledDate);
        const startMinutes = parseTimeToMinutes(scheduledStartTime);
        const endMinutes = parseTimeToMinutes(scheduledEndTime);
        const gracePeriod = Number(allowanceMinutes ?? classDoc?.allowanceMinutes ?? 5);

        if (Number.isNaN(parsedDate.getTime())) {
            return res.status(400).json({ success: false, message: 'sessionDate must be a valid date' });
        }

        if (startMinutes === null || endMinutes === null) {
            return res.status(400).json({ success: false, message: 'startTime and endTime must use HH:MM format' });
        }

        if (endMinutes <= startMinutes) {
            return res.status(400).json({ success: false, message: 'endTime must be later than startTime' });
        }

        if (!Number.isInteger(gracePeriod) || gracePeriod < 0 || gracePeriod > 60) {
            return res.status(400).json({
                success: false,
                message: 'allowanceMinutes must be a whole number from 0 to 60'
            });
        }

        if (startOfLocalDay(parsedDate) < startOfLocalDay(new Date())) {
            return res.status(400).json({ success: false, message: 'Cannot create attendance sessions in the past' });
        }

        const sessionStart = combineDateAndTime(parsedDate, scheduledStartTime);
        const sessionEnd = combineDateAndTime(parsedDate, scheduledEndTime);
        if (sessionStart && new Date() < sessionStart) {
            return res.status(400).json({
                success: false,
                message: 'Cannot open this session before the scheduled start time'
            });
        }

        if (sessionEnd <= new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot open a session after its scheduled end time'
            });
        }

        const rosterQuery = classDoc
            ? { class: classDoc._id, isActive: true }
            : { className: normalizedClassName, isActive: true };
        const rosterCount = await ClassRoster.countDocuments(rosterQuery);

        if (rosterCount === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot open a session for a class with no enrolled students'
            });
        }

        const duplicateSessionQuery = {
            sessionDate: {
                $gte: startOfLocalDay(parsedDate),
                $lte: endOfLocalDay(parsedDate)
            }
        };
        if (classDoc) duplicateSessionQuery.class = classDoc._id;
        else duplicateSessionQuery.className = normalizedClassName;

        const duplicateSession = await AttendanceSession.findOne(duplicateSessionQuery);

        if (duplicateSession) {
            return res.status(400).json({
                success: false,
                message: duplicateSession.status === 'open'
                    ? 'This class already has an open attendance session for today'
                    : 'This class session was already closed today and cannot be opened again'
            });
        }

        const session = new AttendanceSession({
            sessionDate: startOfLocalDay(parsedDate),
            className: normalizedClassName,
            class: classDoc?._id,
            startTime: scheduledStartTime,
            endTime: scheduledEndTime,
            allowanceMinutes: gracePeriod,
            createdBy: req.user.id,
            notes: notes || ''
        });

        await session.save();
        cache.del('attendance_sessions_all');

        res.status(201).json({
            success: true,
            message: 'Attendance session created',
            data: session
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all sessions for a class or by date range
exports.getSessions = async (req, res) => {
    try {
        const { className, classId, startDate, endDate } = req.query;
        const query = {};

        if (className) query.className = normalizeClassName(className);
        if (classId) query.class = classId;
        if (startDate || endDate) {
            query.sessionDate = {};
            if (startDate) query.sessionDate.$gte = startOfLocalDay(parseLocalDateOnly(startDate));
            if (endDate) {
                query.sessionDate.$lte = endOfLocalDay(parseLocalDateOnly(endDate));
            }
        }

        if (req.user.role === 'student') {
            const studentRoster = await ClassRoster.find({
                studentId: req.user.studentId || req.user.id,
                isActive: true
            }).select('class className').lean();

            const normalizedClassName = className ? normalizeClassName(className) : null;
            const classNames = studentRoster.map((entry) => entry.className);
            const classIds = studentRoster.filter((entry) => entry.class).map((entry) => entry.class);

            if (normalizedClassName && !classNames.includes(normalizedClassName)) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not enrolled in this class'
                });
            }

            if (classId && !classIds.some((id) => id.toString() === classId)) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not enrolled in this class'
                });
            }

            if (!classId && !normalizedClassName) {
                query.$or = [
                    { class: { $in: classIds } },
                    { className: { $in: classNames } }
                ];
            }
        }

        if (req.user.role === 'teacher') {
            const classIds = await Class.find({ teacher: req.user.id, isActive: true }).distinct('_id');
            query.$or = [
                ...(query.$or || []),
                { class: { $in: classIds } },
                { createdBy: req.user.id }
            ];
        }

        const sessions = await AttendanceSession.find(query)
            .sort({ sessionDate: -1 })
            .populate('createdBy', 'username')
            .populate('class', 'name section subject teacher');

        res.json({
            success: true,
            count: sessions.length,
            data: sessions
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get a single session with attendance details
exports.getSessionDetails = async (req, res) => {
    try {
        const session = await AttendanceSession.findById(req.params.id)
            .populate('createdBy', 'username')
            .populate('class', 'name section subject teacher');

        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        if (req.user.role === 'teacher' && session.class) {
            const classId = session.class._id || session.class;
            if (session.class.teacher?.toString() !== req.user.id && session.createdBy._id?.toString() !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only view sessions for classes assigned to you'
                });
            }
        }

        const attendanceQuery = { session: session._id };

        if (req.user.role === 'student') {
            const studentId = req.user.studentId || req.user.id;
            const rosterQuery = {
                studentId,
                isActive: true
            };
            if (session.class) rosterQuery.class = session.class._id || session.class;
            else rosterQuery.className = session.className;

            const rosterEntry = await ClassRoster.findOne(rosterQuery);

            if (!rosterEntry) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not enrolled in this class'
                });
            }

            attendanceQuery.studentId = studentId;
        }

        const attendance = await Attendance.find(attendanceQuery)
            .populate('user', 'username email');

        res.json({
            success: true,
            data: {
                session,
                attendance,
                attendanceCount: attendance.length
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Close a session and mark all non-checked-in roster students as Absent
exports.closeSession = async (req, res) => {
    try {
        const session = await AttendanceSession.findById(req.params.id);
        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        if (req.user.role === 'teacher' && session.class) {
            const classDoc = await Class.findById(session.class);
            if (!classDoc || classDoc.teacher.toString() !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only close sessions for classes assigned to you'
                });
            }
        }

        if (session.status === 'closed') {
            return res.status(400).json({
                success: false,
                message: 'Session is already closed'
            });
        }

        const sessionEnd = combineDateAndTime(session.sessionDate, session.endTime);
        if (!sessionEnd) {
            return res.status(400).json({ success: false, message: 'Session has an invalid end time' });
        }

        // Get roster for this class
        const rosterQuery = { isActive: true };
        if (session.class) rosterQuery.class = session.class;
        else rosterQuery.className = session.className;
        const roster = await ClassRoster.find(rosterQuery);

        const checkedInStudents = await Attendance.find({ session: session._id })
            .select('studentId');
        const checkedInIds = new Set(checkedInStudents.map(a => a.studentId));

        // Create Absent records for students not checked in
        const absenceRecords = [];
        for (const rosterEntry of roster) {
            if (!checkedInIds.has(rosterEntry.studentId)) {
                const absenceTime = combineDateAndTime(session.sessionDate, session.endTime);

                absenceRecords.push({
                    session: session._id,
                    class: session.class,
                    studentId: rosterEntry.studentId,
                    user: rosterEntry.student,
                    timeIn: absenceTime,
                    status: 'Absent',
                    arrivalType: 'None',
                    subject: session.className,
                    markedByAdmin: true,
                    notes: 'Auto-marked absent: no check-in'
                });
            }
        }

        if (absenceRecords.length > 0) {
            await Attendance.insertMany(absenceRecords);
        }

        session.status = 'closed';
        await session.save();
        clearAttendanceCaches();

        res.json({
            success: true,
            message: `Session closed. ${absenceRecords.length} absence records created.`,
            absencesCreated: absenceRecords.length,
            data: {
                session,
                absencesCreated: absenceRecords.length
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
