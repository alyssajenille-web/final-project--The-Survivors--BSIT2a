const mongoose = require('mongoose');

const attendanceSessionSchema = new mongoose.Schema({
    sessionDate: {
        type: Date,
        required: true,
        index: true
    },
    className: {
        type: String,
        required: true
    },
    class: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: false,
        index: true
    },
    startTime: {
        type: String, // "HH:MM"
        required: true
    },
    endTime: {
        type: String, // "HH:MM"
        required: true
    },
    allowanceMinutes: {
        type: Number,
        default: 5
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['open', 'closed'],
        default: 'open'
    },
    notes: {
        type: String,
        default: ''
    }
}, { timestamps: true });

attendanceSessionSchema.index({ sessionDate: 1, className: 1 });
attendanceSessionSchema.index({ className: 1, sessionDate: 1, status: 1 });
attendanceSessionSchema.index({ class: 1, sessionDate: 1, status: 1 }, { sparse: true });

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
