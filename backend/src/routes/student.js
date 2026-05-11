const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const OnlineClass = require('../models/OnlineClass');
const { FeeStructure, FeePayment, FeeDue } = require('../models/Fee');

const e2eStudentFees = new Map();
const Course = require('../models/Course');
const Assignment = require('../models/Assignment');
const AssignmentSubmission = require('../models/AssignmentSubmission');

// Helper function to get time ago
const getTimeAgo = (date) => {
  const now = new Date();
  const diffInMs = now - date;
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);
  
  if (diffInDays > 0) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  if (diffInHours > 0) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  return 'Just now';
};

// @route   GET /api/student/dashboard
// @desc    Get student dashboard data
// @access  Private (Student only)
router.get('/dashboard', authenticateToken, requireRole(['student']), async (req, res) => {
  try {
    // Get student profile using 'user' ref and populate user fields
    const studentProfile = await Student
      .findOne({ user: req.user._id || req.user.id })
      .populate('user', 'firstName lastName email phone status');

    // Sample data for today's classes (would come from actual schedule model)
    const todaysClasses = [
      { id: 1, subject: 'Mathematics', time: '10:00 AM - 11:00 AM', teacher: 'Mr. Sharma', room: 'Room 201', status: 'upcoming' },
      { id: 2, subject: 'Science', time: '11:15 AM - 12:15 PM', teacher: 'Mrs. Gupta', room: 'Lab 2', status: 'upcoming' },
      { id: 3, subject: 'English', time: '01:30 PM - 02:30 PM', teacher: 'Ms. Patel', room: 'Room 105', status: 'upcoming' }
    ];

    // Real assignments for the student's class, with submission status
    let assignments = [];
    try {
      const classAssignments = await Assignment.find({ class: studentProfile?.class })
        .sort({ dueDate: 1 })
        .limit(20);

      const assignmentIds = classAssignments.map(a => a._id);
      const submissions = await AssignmentSubmission.find({
        assignment: { $in: assignmentIds },
        student: studentProfile?._id
      }).select('assignment');
      const submittedSet = new Set(submissions.map(s => String(s.assignment)));

      assignments = classAssignments.map(a => ({
        id: String(a._id),
        subject: a.subject,
        title: a.title,
        dueDate: a.dueDate ? new Date(a.dueDate).toISOString().slice(0, 10) : '',
        status: submittedSet.has(String(a._id)) ? 'submitted' : 'pending'
      }));
    } catch (e) {
      console.warn('Student dashboard assignments error:', e.message);
      assignments = [];
    }

    // Sample recent grades
    const recentGrades = [
      { id: 1, subject: 'Mathematics', assignment: 'Unit Test 1', grade: 'A', marks: '85/100', date: getTimeAgo(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)) },
      { id: 2, subject: 'Science', assignment: 'Lab Practical', grade: 'B+', marks: '78/100', date: getTimeAgo(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)) }
    ];

    // Sample attendance summary
    const attendanceSummary = { totalClasses: 120, attendedClasses: 108, percentage: 90, status: 'good' };

    const studentInfo = {
      name: studentProfile?.user
        ? `${studentProfile.user.firstName || ''} ${studentProfile.user.lastName || ''}`.trim()
        : `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
      email: studentProfile?.user?.email || req.user.email,
      class: studentProfile?.class || 'N/A',
      section: studentProfile?.section || 'N/A',
      rollNumber: studentProfile?.rollNumber || 'N/A',
      studentId: studentProfile?.studentId || 'N/A',
      admissionNumber: studentProfile?.admissionNumber || 'N/A',
      academicYear: studentProfile?.academicYear || 'N/A'
    };

    const dashboardData = {
      studentInfo,
      todaysClasses,
      assignments: {
        total: assignments.length,
        pending: assignments.filter(a => a.status === 'pending').length,
        submitted: assignments.filter(a => a.status === 'submitted').length,
        // Convert status to title-case for dashboard badge if needed
        list: assignments.map(a => ({ ...a, status: a.status === 'submitted' ? 'submitted' : 'Pending' }))
      },
      recentGrades,
      attendanceSummary,
      quickStats: { totalSubjects: 6, upcomingTests: 2, pendingFees: 0, libraryBooks: 3 }
    };

    res.json({ success: true, message: 'Student dashboard data retrieved successfully', data: dashboardData });
  } catch (error) {
    console.error('Student dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch student dashboard data', error: error.message });
  }
});

// @route   GET /api/student/profile
// @desc    Get student profile
// @access  Private (Student only)
router.get('/profile', authenticateToken, requireRole(['student']), async (req, res) => {
  try {
    const student = await Student
      .findOne({ user: req.user._id || req.user.id })
      .populate('user', 'firstName lastName email phone status address dateOfBirth');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    res.json({
      success: true,
      message: 'Student profile retrieved successfully',
      data: {
        id: String(student._id),
        studentId: student.studentId,
        rollNumber: student.rollNumber,
        class: student.class,
        section: student.section,
        academicYear: student.academicYear,
        admissionDate: student.admissionDate,
        admissionNumber: student.admissionNumber,
        status: student.status,
        user: {
          id: String(student.user._id),
          name: `${student.user.firstName || ''} ${student.user.lastName || ''}`.trim(),
          email: student.user.email,
          phone: student.user.phone,
          status: student.user.status,
          address: student.user.address || {},
          dateOfBirth: student.user.dateOfBirth || null
        },
        father: student.father,
        mother: student.mother,
        guardian: student.guardian,
        feeStatus: student.feeStatus,
        transport: student.transport
      }
    });
  } catch (error) {
    console.error('Get student profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch student profile', error: error.message });
  }
});

// Removed placeholder routes for assignments list and submit; real implementations exist below

// @route   GET /api/student/grades
// @desc    Get published grades for the logged-in student
// @access  Private (Student only)
router.get('/grades', authenticateToken, async (req, res) => {
  try {
    const Student = require('../models/Student');
    const Grade = require('../models/Grade');

    const studentDoc = await Student.findOne({ user: req.user._id || req.user.id });
    if (!studentDoc) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const grades = await Grade.find({ student: studentDoc._id, isPublished: true })
      .populate('course', 'courseName courseCode credits')
      .sort({ assessmentDate: -1 })
      .limit(50);

    const data = grades.map(g => ({
      subject: g.course?.courseName || 'Unknown',
      assessment: g.assessmentName,
      marks: g.obtainedMarks,
      totalMarks: g.maxMarks,
      grade: g.letterGrade,
      remarks: g.remarks,
      date: g.assessmentDate
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Student grades error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch grades', error: error.message });
  }
});

// @route   GET /api/student/attendance
// @desc    Get student attendance
// @access  Private (Student only)
router.get('/attendance', authenticateToken, requireRole(['student']), async (req, res) => {
  try {
    const studentDoc = await Student.findOne({ user: req.user._id || req.user.id });
    if (!studentDoc) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const { course, date_from, date_to } = req.query;
    const query = { student: studentDoc._id };
    if (course) query.course = course;
    if (date_from || date_to) {
      query.date = {};
      if (date_from) query.date.$gte = new Date(date_from);
      if (date_to) query.date.$lte = new Date(date_to);
    }

    const records = await Attendance.find(query)
      .populate('course', 'courseName courseCode class section')
      .sort({ date: -1 })
      .limit(200);

    const data = records.map(r => ({
      id: String(r._id),
      date: r.date,
      status: r.status,
      timeIn: r.timeIn,
      timeOut: r.timeOut,
      remarks: r.remarks,
      course: {
        id: String(r.course?._id || ''),
        name: r.course?.courseName || '-',
        code: r.course?.courseCode || '-',
        class: r.course?.class || '-',
        section: r.course?.section || '-',
      }
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Student attendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance' });
  }
});

// @route   GET /api/student/schedule
// @desc    Get class schedule
// @access  Private (Student only)
router.get('/schedule', (req, res) => {
  res.json({
    success: true,
    message: 'Get schedule endpoint - To be implemented',
    data: {
      endpoint: 'GET /api/student/schedule',
      query_params: ['date', 'week']
    }
  });
});

// @route   GET /api/student/online-classes
// @desc    Get online classes for the student's class
// @access  Private (Student only)
router.get('/online-classes', authenticateToken, requireRole(['student']), async (req, res) => {
  try {
    // Find student profile for the authenticated user
    const student = await Student.findOne({ user: req.user._id || req.user.id });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    // Build query for classes matching the student's class
    const query = { className: student.class };

    // Optional filters
    const { date_from, date_to, subject, status } = req.query;
    if (subject) query.subject = subject;
    if (status && ['scheduled', 'live', 'completed'].includes(status)) query.status = status;
    if (date_from || date_to) {
      query.date = {};
      if (date_from) query.date.$gte = new Date(date_from);
      if (date_to) query.date.$lte = new Date(date_to);
    }

    const classes = await OnlineClass.find(query)
      .populate('faculty', 'employeeId department designation')
      .sort({ date: 1, time: 1 });

    res.json({ success: true, message: 'Online classes retrieved successfully', data: classes });
  } catch (error) {
    console.error('Student get online classes error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve online classes', error: error.message });
  }
});

// @route   GET /api/student/courses
// @desc    List courses for the student's class
// @access  Private (Student only)
router.get('/courses', authenticateToken, requireRole(['student']), async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id || req.user.id });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });

    const courses = await Course.find({ class: student.class })
      .populate('faculty', 'employeeId department designation')
      .sort({ subject: 1 });

    res.json({ success: true, message: 'Courses retrieved successfully', data: courses });
  } catch (error) {
    console.error('Student get courses error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve courses', error: error.message });
  }
});

// @route   GET /api/student/assignments
// @desc    List assignments for the student's class
// @access  Private (Student only)
router.get('/assignments', authenticateToken, requireRole(['student']), async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id || req.user.id });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });

    const { subject } = req.query;
    const query = { class: student.class };
    if (subject) query.subject = subject;

    const assignments = await Assignment.find(query)
      .populate('course', 'courseName subject class section')
      .sort({ dueDate: 1 });

    res.json({ success: true, message: 'Assignments retrieved successfully', data: assignments });
  } catch (error) {
    console.error('Student get assignments error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve assignments', error: error.message });
  }
});

// @route   POST /api/student/assignments/:id/submit
// @desc    Submit an assignment
// @access  Private (Student only)
router.post('/assignments/:id/submit', authenticateToken, requireRole(['student']), async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id || req.user.id });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });

    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    if (assignment.class !== student.class) {
      return res.status(403).json({ success: false, message: 'You are not authorized to submit this assignment' });
    }

    const { content, attachments } = req.body;
    const payload = {
      assignment: assignment._id,
      student: student._id,
      content: content || '',
      attachments: Array.isArray(attachments) ? attachments : []
    };

    // Upsert submission: one submission per student per assignment
    const submission = await AssignmentSubmission.findOneAndUpdate(
      { assignment: assignment._id, student: student._id },
      payload,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).populate('student', 'studentId rollNumber user');

    res.json({ success: true, message: 'Assignment submitted successfully', data: submission });
  } catch (error) {
    console.error('Student submit assignment error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit assignment', error: error.message });
  }
});

// @route   POST /api/student/online-classes/:id/join
// @desc    Join an online class (returns meeting link and access code)
// @access  Private (Student only)
router.post('/online-classes/:id/join', authenticateToken, requireRole(['student']), async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id || req.user.id });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const cls = await OnlineClass.findById(req.params.id);
    if (!cls) {
      return res.status(404).json({ success: false, message: 'Online class not found' });
    }

    // Ensure the class is for the student's class
    if (cls.className !== student.class) {
      return res.status(403).json({ success: false, message: 'You are not authorized to join this class' });
    }

    // Optionally add student to the class attendance list
    if (!cls.students.some(s => s.toString() === student._id.toString())) {
      cls.students.push(student._id);
      await cls.save();
    }

    res.json({
      success: true,
      message: 'Join info retrieved successfully',
      data: {
        meetingLink: cls.meetingLink,
        accessCode: cls.accessCode || null,
        platform: cls.platform,
        status: cls.status
      }
    });
  } catch (error) {
    console.error('Student join online class error:', error);
    res.status(500).json({ success: false, message: 'Failed to join online class', error: error.message });
  }
});

// @route   GET /api/student/fees
// @desc    Get fee information
// @access  Private (Student only)
router.get('/fees', authenticateToken, requireRole(['student']), async (req, res) => {
  try {
    if (process.env.E2E_MODE === 'true') {
      const currentYear = new Date().getFullYear();
      const yearFilter = `${currentYear}-${currentYear + 1}`;
      const key = String(req.user._id || req.user.id || 'e2e');
      if (!e2eStudentFees.has(key)) {
        const feeStructure = { _id: 'fs-e2e', class: 'Grade 6-8', academicYear: yearFilter, totalAmount: 66000, paymentSchedule: 'annual' };
        const due = {
          _id: `due-e2e-${Date.now()}`,
          student: key,
          feeStructure: feeStructure._id,
          academicYear: yearFilter,
          installmentNumber: 1,
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          amount: feeStructure.totalAmount,
          paidAmount: 0,
          status: 'pending'
        };
        e2eStudentFees.set(key, { feeStructure, dues: [due], payments: [] });
      }
      const state = e2eStudentFees.get(key);
      return res.json({
        success: true,
        data: {
          student: { _id: key, name: 'E2E Student', class: state.feeStructure.class, studentId: 'E2E001', email: 'e2e@local' },
          feeStructure: state.feeStructure,
          payments: state.payments,
          dues: state.dues,
          fees: state.dues.map(d => ({
            id: String(d._id),
            type: `Installment ${d.installmentNumber}`,
            amount: Number(d.amount || 0),
            dueDate: d.dueDate || new Date(),
            status: d.status,
            session: '',
            description: '',
            paidDate: d.status === 'paid' ? (state.payments.find(p => p.installmentNumber === d.installmentNumber)?.paymentDetails?.paymentDate || null) : null
          })),
          summary: {
            totalPaid: state.payments.reduce((sum, p) => sum + Number(p.paymentDetails?.amount || 0), 0),
            totalDue: state.dues.filter(d => d.status !== 'paid').reduce((sum, d) => sum + Math.max(0, Number(d.amount || 0) - Number(d.paidAmount || 0)), 0),
            totalFeeAmount: state.feeStructure.totalAmount
          }
        }
      });
    }

    const student = await Student
      .findOne({ user: req.user._id || req.user.id })
      .populate('user', 'firstName lastName email');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const currentYear = new Date().getFullYear();
    const academicYear = student.academicYear || `${currentYear}-${currentYear + 1}`;

    let feeStructure = await FeeStructure.findOne({ class: student.class, academicYear, isActive: true });

    // Fallback: If no fee structure is found for the exact academic year, find the most recent active one for their class
    if (!feeStructure) {
      feeStructure = await FeeStructure.findOne({ class: student.class, isActive: true }).sort({ createdAt: -1 });
      if (feeStructure) {
        // If we found a fallback structure, use its academic year to stay consistent
        academicYear = feeStructure.academicYear;
      }
    }

    if (!feeStructure) {
      const totalFromStudent = Number(student.feeStructure?.admissionFee || 0) +
        Number(student.feeStructure?.tuitionFee || 0) +
        Number(student.feeStructure?.examFee || 0) +
        Number(student.feeStructure?.libraryFee || 0) +
        Number(student.feeStructure?.sportsFee || 0) +
        Number(student.feeStructure?.transportFee || 0) +
        Number(student.feeStructure?.otherFees || 0);
      const baseAmount = totalFromStudent > 0 ? totalFromStudent : 0;
      if (baseAmount > 0) {
        feeStructure = await FeeStructure.create({
          class: student.class,
          academicYear,
          feeComponents: { tuitionFee: baseAmount },
          paymentSchedule: 'yearly',
          isActive: true,
          createdBy: student.user
        });
      }
    }

    if (feeStructure) {
      const existingDuesCount = await FeeDue.countDocuments({ student: student._id, academicYear, feeStructure: feeStructure._id });
      if (existingDuesCount === 0) {
        const components = feeStructure.feeComponents ? (typeof feeStructure.feeComponents.toJSON === 'function' ? feeStructure.feeComponents.toJSON() : feeStructure.feeComponents) : {};
        const totalAmount = Object.values(components).reduce((sum, v) => typeof v === 'number' ? sum + v : sum + Number(v || 0), 0);
        if (Array.isArray(feeStructure.dueDates) && feeStructure.dueDates.length > 0) {
          for (const d of feeStructure.dueDates) {
            const due = new FeeDue({
              student: student._id,
              feeStructure: feeStructure._id,
              academicYear,
              installmentNumber: Number(d.installmentNumber || 1),
              installmentName: d.installmentName || `Installment ${d.installmentNumber || 1}`,
              dueDate: d.dueDate || new Date(),
              amount: Number(d.amount || 0)
            });
            await due.save();
          }
        } else {
          const schedule = feeStructure.paymentSchedule || 'yearly';
          let numInstallments = 1;
          let installmentNames = ['Annual Fee'];
          if (schedule === 'monthly') {
            numInstallments = 12;
            installmentNames = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
          } else if (schedule === 'quarterly') {
            numInstallments = 4;
            installmentNames = ['Q1 (Apr-Jun)', 'Q2 (Jul-Sep)', 'Q3 (Oct-Dec)', 'Q4 (Jan-Mar)'];
          } else if (schedule === 'half_yearly') {
            numInstallments = 2;
            installmentNames = ['Term 1 (Apr-Sep)', 'Term 2 (Oct-Mar)'];
          }

          const baseInstallmentAmount = Math.floor(totalAmount / numInstallments);
          const remainder = totalAmount - (baseInstallmentAmount * numInstallments);
          const startYear = parseInt(academicYear.split('-')[0]) || new Date().getFullYear();

          for (let i = 1; i <= numInstallments; i++) {
            let amount = baseInstallmentAmount;
            if (i === 1) amount += remainder;

            let dueDate = new Date();
            if (schedule === 'monthly') {
              const monthOffset = (i - 1 + 3) % 12;
              const yearOffset = (i - 1 + 3) >= 12 ? 1 : 0;
              dueDate = new Date(startYear + yearOffset, monthOffset, 10);
            } else if (schedule === 'quarterly') {
              const monthOffset = ((i - 1) * 3 + 3) % 12;
              const yearOffset = ((i - 1) * 3 + 3) >= 12 ? 1 : 0;
              dueDate = new Date(startYear + yearOffset, monthOffset, 10);
            } else if (schedule === 'half_yearly') {
              const monthOffset = ((i - 1) * 6 + 3) % 12;
              const yearOffset = ((i - 1) * 6 + 3) >= 12 ? 1 : 0;
              dueDate = new Date(startYear + yearOffset, monthOffset, 10);
            } else {
              dueDate = new Date(startYear, 3, 15);
            }

            const due = new FeeDue({
              student: student._id,
              feeStructure: feeStructure._id,
              academicYear,
              installmentNumber: i,
              installmentName: installmentNames[i - 1] || `Installment ${i}`,
              dueDate: dueDate,
              amount: amount
            });
            await due.save();
          }
        }
      }
    }

    const [payments, dues] = await Promise.all([
      FeePayment.find({ student: student._id, academicYear })
        .populate('feeStructure', 'class academicYear')
        .sort({ 'paymentDetails.paymentDate': -1 }),
      FeeDue.find({ student: student._id, academicYear })
        .populate('feeStructure', 'class academicYear')
        .sort({ dueDate: 1 })
    ]);

    const fees = dues.map(d => ({
      id: String(d._id),
      type: d.installmentName || `Installment ${d.installmentNumber}`,
      amount: Number(d.amount || 0),
      dueDate: d.dueDate || new Date(),
      status: d.status,
      session: '',
      description: '',
      paidDate: d.status === 'paid' ? (payments.find(p => p.installmentNumber === d.installmentNumber)?.paymentDetails?.paymentDate || null) : null
    }));

    const totalPaid = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + Number(p.paymentDetails?.amount || 0), 0);

    const totalDue = dues
      .filter(d => d.status !== 'paid')
      .reduce((sum, d) => sum + Math.max(0, Number(d.amount || 0) - Number(d.paidAmount || 0)), 0);

    return res.json({
      success: true,
      data: {
        student: {
          _id: student._id,
          name: student.name,
          class: student.class,
          studentId: student.studentId,
          email: student.user?.email || ''
        },
        feeStructure,
        payments,
        dues,
        fees,
        summary: {
          totalPaid,
          totalDue,
          totalFeeAmount: feeStructure ? (feeStructure.feeComponents ? Object.values(typeof feeStructure.feeComponents.toJSON === 'function' ? feeStructure.feeComponents.toJSON() : feeStructure.feeComponents).reduce((sum, v) => typeof v === 'number' ? sum + v : sum + Number(v || 0), 0) : 0) : 0
        }
      }
    });
  } catch (error) {
    console.error('Get student fees error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch fees', error: error.message });
  }
});

// @route   GET /api/student/fees/structures
// @desc    Get active fee structures for an academic year (optional class filter)
// @access  Public (no auth required for viewing)
router.get('/fees/structures', async (req, res) => {
  try {
    const { academicYear, class: className } = req.query || {};

    const currentYear = new Date().getFullYear();
    const yearFilter = academicYear || `${currentYear}-${currentYear + 1}`;

    const query = { academicYear: yearFilter, isActive: true };
    if (className) query.class = className;

    const structures = await FeeStructure.find(query).sort({ class: 1 });

    const data = structures.map((s) => {
      const components = s.feeComponents ? (typeof s.feeComponents.toJSON === 'function' ? s.feeComponents.toJSON() : s.feeComponents) : {};
      return {
        _id: s._id,
        class: s.class,
        academicYear: s.academicYear,
        paymentSchedule: s.paymentSchedule,
        totalAmount: Object.values(components).reduce((sum, v) => typeof v === 'number' ? sum + v : sum + Number(v || 0), 0),
      };
    });

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Get fee structures error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching fee structures', error: error.message });
  }
});

// @route   POST /api/student/fees/payment
// @desc    Process fee payment
// @access  Private (Student only)
router.post('/fees/payment', authenticateToken, requireRole(['student']), async (req, res) => {
  try {
    if (process.env.E2E_MODE === 'true') {
      const { dueId, paymentMethod } = req.body || {};
      const key = String(req.user._id || req.user.id || 'e2e');
      const state = e2eStudentFees.get(key);
      const due = state?.dues.find(d => String(d._id) === String(dueId));
      if (!state || !due) {
        return res.status(404).json({ success: false, message: 'Fee due not found' });
      }
      const amountToPay = Math.max(0, Number(due.amount || 0) - Number(due.paidAmount || 0));
      if (amountToPay <= 0) {
        return res.status(400).json({ success: false, message: 'No pending amount for this due' });
      }
      const payment = {
        _id: `pay-e2e-${Date.now()}`,
        student: { name: 'E2E Student', class: state.feeStructure.class, studentId: 'E2E001' },
        feeStructure: { class: state.feeStructure.class, academicYear: state.feeStructure.academicYear },
        paymentDetails: { receiptNumber: `E2E-${Date.now()}`, amount: amountToPay, paymentMethod: String(paymentMethod || 'online'), paymentDate: new Date() },
        feeBreakdown: {},
        academicYear: state.feeStructure.academicYear,
        installmentNumber: due.installmentNumber,
        remarks: '',
        processedBy: { name: 'E2E Student' },
        status: 'completed'
      };
      state.payments.push(payment);
      due.paidAmount = Number(due.paidAmount || 0) + amountToPay;
      due.status = 'paid';
      return res.status(201).json({ success: true, message: 'Payment recorded (E2E)', data: { payment } });
    }

    const { dueId, paymentMethod, transactionId } = req.body || {};
    const student = await Student.findOne({ user: req.user._id || req.user.id });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const due = await FeeDue.findById(dueId);
    if (!due || String(due.student) !== String(student._id)) {
      return res.status(404).json({ success: false, message: 'Fee due not found' });
    }

    const feeStructure = await FeeStructure.findById(due.feeStructure);
    if (!feeStructure) {
      return res.status(404).json({ success: false, message: 'Fee structure not found' });
    }

    const amountToPay = Math.max(0, Number(due.amount || 0) - Number(due.paidAmount || 0));
    if (amountToPay <= 0) {
      return res.status(400).json({ success: false, message: 'No pending amount for this due' });
    }

    const payment = new FeePayment({
      student: student._id,
      feeStructure: feeStructure._id,
      paymentDetails: {
        amount: amountToPay,
        paymentMethod: String(paymentMethod || 'online'),
        transactionId: transactionId ? String(transactionId) : undefined,
        paymentDate: new Date()
      },
      feeBreakdown: {},
      academicYear: feeStructure.academicYear,
      installmentNumber: due.installmentNumber,
      processedBy: req.user._id || req.user.id,
      status: 'completed'
    });

    await payment.save();

    due.paidAmount = Number(due.paidAmount || 0) + amountToPay;
    await due.save();

    await payment.populate([
      { path: 'feeStructure', select: 'class academicYear' }
    ]);

    return res.status(201).json({
      success: true,
      message: 'Payment processed successfully',
      data: { payment }
    });
  } catch (error) {
    console.error('Student fee payment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process payment', error: error.message });
  }
});

// @route   GET /api/student/library
// @desc    Get library information
// @access  Private (Student only)
router.get('/library', (req, res) => {
  res.json({
    success: true,
    message: 'Get library info endpoint - To be implemented',
    data: {
      endpoint: 'GET /api/student/library',
      returns: ['issued_books', 'due_dates', 'fines', 'available_books']
    }
  });
});

// @route   POST /api/student/library/request
// @desc    Request book from library
// @access  Private (Student only)
router.post('/library/request', (req, res) => {
  res.json({
    success: true,
    message: 'Request book endpoint - To be implemented',
    data: {
      endpoint: 'POST /api/student/library/request',
      required_fields: ['book_id', 'request_date']
    }
  });
});

// @route   GET /api/student/notifications
// @desc    Get student notifications
// @access  Private (Student only)
router.get('/notifications', (req, res) => {
  res.json({
    success: true,
    message: 'Get notifications endpoint - To be implemented',
    data: {
      endpoint: 'GET /api/student/notifications',
      query_params: ['type', 'read_status', 'limit']
    }
  });
});

// @route   PUT /api/student/notifications/:id/read
// @desc    Mark notification as read
// @access  Private (Student only)
router.put('/notifications/:id/read', (req, res) => {
  res.json({
    success: true,
    message: 'Mark notification read endpoint - To be implemented',
    data: {
      endpoint: 'PUT /api/student/notifications/:id/read',
      notification_id: req.params.id
    }
  });
});

// @route   GET /api/student/fees/public-info/:studentId
// @desc    Get pending fee summary for a student ID
// @access  Public
router.get('/fees/public-info/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const student = await Student.findOne({ studentId }).populate('user', 'firstName lastName email');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    const currentYear = new Date().getFullYear();
    const academicYear = student.academicYear || `${currentYear}-${currentYear + 1}`;

    const dues = await FeeDue.find({ student: student._id, academicYear, status: { $ne: 'paid' } })
      .populate('feeStructure', 'class totalAmount')
      .sort({ dueDate: 1 });

    const totalDue = dues.reduce((sum, d) => sum + Math.max(0, Number(d.amount || 0) - Number(d.paidAmount || 0)), 0);

    return res.json({
      success: true,
      data: {
        studentId: student.studentId,
        studentName: student.name,
        class: student.class,
        totalDue,
        academicYear,
        pendingDues: dues.map(d => ({
          id: d._id,
          installmentName: d.installmentName || `Installment ${d.installmentNumber}`,
          dueDate: d.dueDate,
          amountDue: Math.max(0, Number(d.amount || 0) - Number(d.paidAmount || 0))
        }))
      }
    });
  } catch (error) {
    console.error('Get public fee info error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch fee info', error: error.message });
  }
});

// @route   POST /api/student/fees/public-payment
// @desc    Process a fee payment from the public page
// @access  Public
router.post('/fees/public-payment', async (req, res) => {
  try {
    const { studentId, paymentMethod, transactionId, amount } = req.body;
    
    if (!studentId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Student ID and a valid amount are required' });
    }

    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const currentYear = new Date().getFullYear();
    const academicYear = student.academicYear || `${currentYear}-${currentYear + 1}`;

    const dues = await FeeDue.find({ student: student._id, academicYear, status: { $ne: 'paid' } }).sort({ dueDate: 1 });
    
    let remainingPayment = Number(amount);
    let totalApplied = 0;
    const paidDues = [];

    for (const due of dues) {
      if (remainingPayment <= 0) break;
      
      const duePending = Math.max(0, Number(due.amount || 0) - Number(due.paidAmount || 0));
      if (duePending <= 0) continue;

      const applyAmount = Math.min(duePending, remainingPayment);
      
      const payment = new FeePayment({
        student: student._id,
        feeStructure: due.feeStructure,
        paymentDetails: {
          amount: applyAmount,
          paymentMethod: String(paymentMethod || 'online'),
          transactionId: transactionId ? String(transactionId) : undefined,
          paymentDate: new Date(),
          receiptNumber: `PUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        },
        feeBreakdown: {},
        academicYear,
        installmentNumber: due.installmentNumber,
        installmentName: due.installmentName,
        processedBy: student.user || student._id,
        status: 'completed'
      });

      await payment.save();

      due.paidAmount = Number(due.paidAmount || 0) + applyAmount;
      await due.save();

      remainingPayment -= applyAmount;
      totalApplied += applyAmount;
      paidDues.push({ dueId: due._id, applied: applyAmount });
    }

    if (totalApplied === 0) {
      return res.status(400).json({ success: false, message: 'No pending dues found or payment could not be applied' });
    }

    return res.status(201).json({
      success: true,
      message: 'Payment processed successfully',
      data: { totalApplied, remainder: remainingPayment, paidDues }
    });
  } catch (error) {
    console.error('Public fee payment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process payment', error: error.message });
  }
});

module.exports = router;
