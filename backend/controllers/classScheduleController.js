const ClassSchedule = require('../models/ClassSchedule');

exports.saveSchedule = async (req, res) => {
    try {
        const { className, startTime, endTime, allowanceMinutes } = req.body;

        if (!className || !startTime || !endTime) {
            return res.status(400).json({ success: false, message: 'Class name, start time, and end time are required' });
        }

        const schedule = await ClassSchedule.findOneAndUpdate(
            {},
            {
                className,
                startTime,
                endTime,
                allowanceMinutes: allowanceMinutes ?? 5,
                createdBy: req.user.id
            },
            { upsert: true, new: true }
        );

        res.json({ success: true, message: 'Schedule saved successfully', data: schedule });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getSchedule = async (req, res) => {
    try {
        const schedule = await ClassSchedule.findOne().sort({ updatedAt: -1 });
        res.json({ success: true, data: schedule });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};