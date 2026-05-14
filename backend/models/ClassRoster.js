const mongoose = require('mongoose');

const classRosterSchema = new mongoose.Schema({
    className: {
        type: String,
        required: true,
        index: true
    },
    class: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: false,
        index: true
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    studentId: {
        type: String,
        required: true
    },
    enrolledAt: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

classRosterSchema.index({ className: 1, studentId: 1 });
classRosterSchema.index({ className: 1, student: 1 }, { unique: true });
classRosterSchema.index({ class: 1, student: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('ClassRoster', classRosterSchema);
