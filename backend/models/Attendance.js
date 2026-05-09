const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    index: true  // Index for faster queries
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false  // Optional reference to User model
  },
  timeIn: {
    type: Date,
    required: true,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['Early', 'On-Time', 'Late', 'Absent'],
    required: true
  },
  subject: {
    type: String,
    default: 'General'  // For future class/subject tracking
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// Compound index for efficient querying
attendanceSchema.index({ studentId: 1, timeIn: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);