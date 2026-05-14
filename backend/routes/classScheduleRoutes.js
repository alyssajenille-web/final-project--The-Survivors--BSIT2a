const router = require('express').Router();
const { saveSchedule, getSchedule } = require('../controllers/classScheduleController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/', protect, authorize('teacher', 'admin'), saveSchedule);
router.get('/', protect, getSchedule);

module.exports = router;