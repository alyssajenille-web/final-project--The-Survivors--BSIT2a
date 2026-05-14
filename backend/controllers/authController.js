const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cache = require('../utils/cache');
const Attendance = require('../models/Attendance');

const generateToken = (id, role, studentId) => {
  const payload = { id, role };
  if (studentId) payload.studentId = studentId;
  return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '30d'
  });
};

exports.register = async (req, res) => {
  try {
    const { username, email, password, role, studentId } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      email,
      password: hashed,
      role: role || 'student',
      studentId
    });

    await user.save();

    cache.del('users_all');

    res.status(201).json({
      success: true,
      message: "Registered successfully",
      token: generateToken(user._id, user.role, user.studentId),
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        studentId: user.studentId
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ success: false, message: "Wrong password" });
    }

    res.json({
      success: true,
      message: "Login successful",
      token: generateToken(user._id, user.role, user.studentId),
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        studentId: user.studentId
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const cachedData = cache.get('users_all');

    if (cachedData) {
      console.log('📦 Serving users from cache');
      return res.json({
        success: true,
        source: 'cache',
        count: cachedData.length,
        data: cachedData
      });
    }
    const users = await User.find()
      .select('-password')
      .lean();

    cache.set('users_all', users);
    console.log('💾 Users stored in cache');

    res.json({
      success: true,
      source: 'database',
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await Attendance.deleteMany({ user: req.params.id });
    cache.del('users_all');
    cache.del('attendance_all');
    cache.del('attendance_student_summary');

    res.json({ success: true, message: 'User deleted and related attendance removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};