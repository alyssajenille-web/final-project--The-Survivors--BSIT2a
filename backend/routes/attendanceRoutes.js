const router = require('express').Router();
const {
  checkIn,
  checkInWithSession,
  getAll,
  getById,
  update,
  deleteAttendance,
  getStats,
  getMyAttendance,
  getStudentSummary
} = require('../controllers/attendanceController');

const { protect, authorize } = require('../middleware/authMiddleware');
const { checkInValidation, handleValidationErrors } = require('../middleware/validation');

router.post('/checkin-session',
  protect,
  authorize('student'),
  checkInWithSession
);

router.post('/checkin',
  protect,
  authorize('student'),
  checkInValidation,
  handleValidationErrors,
  checkIn
);

router.get('/my-attendance', protect, authorize('student'), getMyAttendance);

router.get('/', protect, authorize('teacher', 'admin'), getAll);
router.get('/stats', protect, authorize('teacher', 'admin'), getStats);
router.get('/student-summary', protect, authorize('teacher', 'admin'), getStudentSummary);
router.get('/:id', protect, authorize('teacher', 'admin'), getById);
router.put('/:id', protect, authorize('admin'), update);
router.delete('/:id', protect, authorize('admin'), deleteAttendance);

module.exports = router;