const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
require('dotenv').config();

const connectDB = require('../config/db');

const seedData = async () => {
  try {
    await connectDB();

    console.log('⚠️  Note: Skipping data clear due to Atlas permissions');
    
    const existingAdmin = await User.findOne({ email: 'admin@school.edu' });
    if (existingAdmin) {
      console.log('✅ Demo data already exists. Skipping seed.');
      console.log('\nDemo Login Credentials:');
      console.log('Admin:    admin@school.edu    / Password123');
      console.log('Teacher:  teacher@school.edu  / Password123');
      console.log('Student:  student1@school.edu / Password123');
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash('Password123', 10);

    const users = [
      {
        username: 'Admin User',
        email: 'admin@school.edu',
        password: hashedPassword,
        role: 'admin',
        studentId: 'ADMIN01'
      },
      {
        username: 'Teacher One',
        email: 'teacher@school.edu',
        password: hashedPassword,
        role: 'teacher',
        studentId: 'TEACHER01'
      },
      {
        username: 'Student One',
        email: 'student1@school.edu',
        password: hashedPassword,
        role: 'student',
        studentId: '2023001'
      },
      {
        username: 'Student Two',
        email: 'student2@school.edu',
        password: hashedPassword,
        role: 'student',
        studentId: '2023002'
      },
      {
        username: 'Student Three',
        email: 'student3@school.edu',
        password: hashedPassword,
        role: 'student',
        studentId: '2023003'
      }
    ];

    const createdUsers = await User.insertMany(users);
    console.log(`✅ Created ${createdUsers.length} users`);

    const today = new Date();
    const attendanceRecords = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      createdUsers.filter(u => u.role === 'student').forEach((student) => {
        const hour = 7 + Math.floor(Math.random() * 4);
        const minute = Math.floor(Math.random() * 60);
        date.setHours(hour, minute, 0, 0);

        let status;
        if (hour < 8) status = 'Early';
        else if (hour === 8 && minute <= 30) status = 'On-Time';
        else if ((hour === 8 && minute > 30) || hour === 9) status = 'Late';
        else status = 'Absent';

        attendanceRecords.push({
          studentId: student.studentId,
          user: student._id,
          timeIn: new Date(date),
          status,
          subject: ['Math', 'Science', 'English', 'History'][Math.floor(Math.random() * 4)]
        });
      });
    }

    await Attendance.insertMany(attendanceRecords);
    console.log(`✅ Created ${attendanceRecords.length} attendance records`);

    console.log('\n🎉 Seed completed successfully!');
    console.log('\nDemo Login Credentials:');
    console.log('Admin:    admin@school.edu    / Password123');
    console.log('Teacher:  teacher@school.edu  / Password123');
    console.log('Student:  student1@school.edu / Password123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error.message);
    process.exit(1);
  }
};

seedData();