const router = require('express').Router();
const {
    enrollStudent,
    getClassRoster,
    unenrollStudent,
    getAllClasses
} = require('../controllers/classRosterController');

const { protect, authorize } = require('../middleware/authMiddleware');

// Admin only - enroll student in a class
router.post('/enroll', protect, authorize('admin'), enrollStudent);

// Teacher/Admin - get roster for a specific class
router.get('/class/:className', protect, authorize('teacher', 'admin'), getClassRoster);

// Admin - unenroll student
router.delete('/:rosterEntryId', protect, authorize('admin'), unenrollStudent);

// Get all classes
router.get('/', protect, authorize('teacher', 'admin'), getAllClasses);

module.exports = router;
