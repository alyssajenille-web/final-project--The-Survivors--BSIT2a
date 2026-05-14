const router = require('express').Router();
const {
    getSessions,
    getSessionDetails
} = require('../controllers/attendanceSessionController');

const { protect, authorize } = require('../middleware/authMiddleware');

// Get sessions (all users can view their own class sessions)
router.get('/', protect, getSessions);

// Get specific session details
router.get('/:id', protect, getSessionDetails);

module.exports = router;
