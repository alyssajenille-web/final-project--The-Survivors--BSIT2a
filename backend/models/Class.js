const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  section: {
    type: String,
    default: '',
    trim: true
  },
  subject: {
    type: String,
    default: '',
    trim: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  daysOfWeek: {
    type: [Number],
    required: true,
    validate: {
      validator: (days) => Array.isArray(days) && days.length > 0 && days.every(day => day >= 0 && day <= 6),
      message: 'At least one valid weekday is required'
    },
    index: true
  },
  startTime: {
    type: String,
    required: false
  },
  endTime: {
    type: String,
    required: false
  },
  allowanceMinutes: {
    type: Number,
    default: 5
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

classSchema.index({ name: 1, section: 1, startTime: 1 });
classSchema.index({ teacher: 1, isActive: 1 });
classSchema.index({ teacher: 1, daysOfWeek: 1, isActive: 1 });

module.exports = mongoose.model('Class', classSchema);
