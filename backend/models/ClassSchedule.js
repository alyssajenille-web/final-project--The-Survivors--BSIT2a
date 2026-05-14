const mongoose = require('mongoose');

const classScheduleSchema = new mongoose.Schema({
    className: { type: String, required: true },
    startTime: { type: String, required: true }, // "HH:MM" format
    endTime: { type: String, required: true }, // "HH:MM" format - new field
    allowanceMinutes: { type: Number, default: 5 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('ClassSchedule', classScheduleSchema);