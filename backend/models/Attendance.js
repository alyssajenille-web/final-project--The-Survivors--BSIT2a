const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    index: true 
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false 
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
    default: 'General' 
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

attendanceSchema.index({ studentId: 1, timeIn: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);