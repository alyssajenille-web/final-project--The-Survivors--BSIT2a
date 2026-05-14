const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AttendanceSession',
    required: false,
    index: true
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: false,
    index: true
  },
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
    enum: ['Early', 'On-Time', 'Present', 'Late', 'Absent', 'Excused'],
    required: true
  },
  arrivalType: {
    type: String,
    enum: ['Early', 'On-Time', 'Late', 'None'],
    default: 'None'
  },
  subject: {
    type: String,
    default: 'General'
  },
  notes: {
    type: String,
    default: ''
  },
  markedByAdmin: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

attendanceSchema.index({ studentId: 1, timeIn: -1 });
attendanceSchema.index({ session: 1, studentId: 1 }, { sparse: true, unique: true });
attendanceSchema.index({ class: 1, studentId: 1, timeIn: -1 }, { sparse: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
