const { body, validationResult } = require('express-validator');

exports.registerValidation = [
    body('username')
        .trim()
        .notEmpty().withMessage('Username is required')
        .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
        .matches(/^[a-zA-Z\s]+$/).withMessage('Username can only contain letters and spaces'),

    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email address')
        .normalizeEmail(),

    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number'),

    body('role')
        .optional()
        .isIn(['student', 'teacher']).withMessage('Role must be student or teacher'),

    body('studentId')
        .trim()
        .notEmpty().withMessage('Student ID is required')
        .matches(/^20(2[0-6])-\d{4}-\d{5}$|^(TEACHER)\d{2}$/i)
        .withMessage('Invalid ID format. Use YYYY-XXXX-XXXXX (2020-2026) for students or TEACHER01 for teachers')
];

exports.loginValidation = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email address'),

    body('password')
        .notEmpty().withMessage('Password is required')
];

exports.checkInValidation = [
    body('studentId')
        .optional()
        .trim()
        .notEmpty().withMessage('Student ID cannot be empty')
];

exports.handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};
