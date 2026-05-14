const ClassRoster = require('../models/ClassRoster');
const User = require('../models/User');
const Class = require('../models/Class');
const cache = require('../utils/cache');

const normalizeClassName = (className) => className.trim().replace(/\s+/g, ' ');
const displayClassName = (classDoc) => {
    if (!classDoc) return '';
    return classDoc.section ? `${classDoc.name} - ${classDoc.section}` : classDoc.name;
};

// Enroll a student in a class
exports.enrollStudent = async (req, res) => {
    try {
        const { studentId, className, classId } = req.body;

        if (!studentId || (!className && !classId)) {
            return res.status(400).json({
                success: false,
                message: 'studentId and class are required'
            });
        }

        const student = await User.findOne({ studentId });
        if (!student || student.role !== 'student') {
            return res.status(400).json({
                success: false,
                message: 'Student not found or invalid role'
            });
        }

        let classDoc = null;
        if (classId) {
            classDoc = await Class.findOne({ _id: classId, isActive: true });
            if (!classDoc) {
                return res.status(404).json({ success: false, message: 'Class not found' });
            }
        }

        const normalizedClassName = classDoc ? displayClassName(classDoc) : normalizeClassName(className);
        const existingQuery = classDoc
            ? { class: classDoc._id, studentId }
            : { className: normalizedClassName, studentId };
        const existing = await ClassRoster.findOne(existingQuery);

        if (existing?.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Student is already enrolled in this class'
            });
        }

        if (existing) {
            existing.isActive = true;
            existing.enrolledAt = new Date();
            existing.class = classDoc?._id || existing.class;
            existing.className = normalizedClassName;
            await existing.save();
            cache.del(`roster_${normalizedClassName}`);

            return res.json({
                success: true,
                message: 'Student re-enrolled successfully',
                data: existing
            });
        }

        const rosterEntry = new ClassRoster({
            className: normalizedClassName,
            class: classDoc?._id,
            student: student._id,
            studentId,
            isActive: true
        });

        await rosterEntry.save();
        cache.del(`roster_${normalizedClassName}`);

        res.status(201).json({
            success: true,
            message: 'Student enrolled successfully',
            data: rosterEntry
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get roster for a class
exports.getClassRoster = async (req, res) => {
    try {
        const { className } = req.params;

        const cacheKey = `roster_${className}`;
        const cachedData = cache.get(cacheKey);
        if (cachedData) {
            return res.json({
                success: true,
                source: 'cache',
                count: cachedData.length,
                data: cachedData
            });
        }

        const roster = await ClassRoster.find({ className: normalizeClassName(className), isActive: true })
            .populate('student', 'username email')
            .populate('class', 'name section subject teacher')
            .sort({ enrolledAt: 1 });

        cache.set(cacheKey, roster);

        res.json({
            success: true,
            source: 'database',
            count: roster.length,
            data: roster
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Remove a student from a class (soft delete)
exports.unenrollStudent = async (req, res) => {
    try {
        const { rosterEntryId } = req.params;

        const entry = await ClassRoster.findByIdAndUpdate(
            rosterEntryId,
            { isActive: false },
            { new: true }
        );

        if (!entry) {
            return res.status(404).json({ success: false, message: 'Roster entry not found' });
        }

        cache.del(`roster_${entry.className}`);

        res.json({
            success: true,
            message: 'Student unenrolled from class',
            data: entry
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all unique classes
exports.getAllClasses = async (req, res) => {
    try {
        const roster = await ClassRoster.find({ isActive: true })
            .populate('student', 'username email')
            .populate('class', 'name section subject teacher')
            .sort({ className: 1, enrolledAt: 1 });

        res.json({
            success: true,
            count: roster.length,
            data: roster
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
