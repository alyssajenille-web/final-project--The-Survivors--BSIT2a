const router = require('express').Router();
const { register, login, getAllUsers, deleteUser } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { registerValidation, loginValidation, handleValidationErrors } = require('../middleware/validation');

router.post('/register',
    registerValidation,
    handleValidationErrors,
    register
);
router.post('/login',
    loginValidation,
    handleValidationErrors,
    login
);
router.get('/users', protect, authorize('teacher', 'admin'), getAllUsers);
router.delete('/users/:id', protect, authorize('admin'), deleteUser);
router.get('/secure-data',
    protect,
    authorize('admin'),
    (req, res) => {
        res.json({
            success: true,
            message: 'This is secure admin-only data',
            data: {
                systemStatus: 'operational',
                totalUsers: 150,
                lastBackup: new Date().toISOString()
            }
        });
    }
);

module.exports = router;