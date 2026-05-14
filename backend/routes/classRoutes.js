const router = require('express').Router();
const {
  createClass,
  getClasses,
  getClassById,
  updateClass,
  deleteClass
} = require('../controllers/classController');

const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, authorize('student', 'teacher', 'admin'), getClasses);
router.get('/:id', protect, authorize('teacher', 'admin'), getClassById);
router.post('/', protect, authorize('admin'), createClass);
router.put('/:id', protect, authorize('admin'), updateClass);
router.delete('/:id', protect, authorize('admin'), deleteClass);

module.exports = router;
