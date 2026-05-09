const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const mongoose = require('mongoose');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Admission = require('../models/Admission');
const { FeeStructure, FeePayment, FeeDue } = require('../models/Fee');
const Attendance = require('../models/Attendance');
const Grade = require('../models/Grade');
const Course = require('../models/Course');
const Schedule = require('../models/Schedule');
const FacultyAssignment = require('../models/FacultyAssignment');

// E2E in-memory fee state for admin fees when DB is not available
const e2eFeesState = {
  feeStructures: [],
  payments: [],
  dues: []
};

// E2E in-memory admissions state
const e2eAdmissionsState = {
  admissions: []
};

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard data
// @access  Private (Admin only)
router.get('/dashboard', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    if (process.env.E2E_MODE === 'true') {
      const waitlistedCount = (e2eAdmissionsState.admissions || []).filter(a => a.status === 'submitted').length;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const e2eMonthlyTotal = (e2eFeesState.payments || []).reduce((sum, p) => {
        const d = new Date(p?.paymentDetails?.paymentDate || p?.createdAt || now);
        return (p?.status === 'completed' && d >= startOfMonth && d <= now)
          ? sum + Number(p?.paymentDetails?.amount || 0)
          : sum;
      }, 0);
      const formatShort = (amt) => {
        if (amt >= 100000) return `₹ ${(amt/100000).toFixed(1)}L`;
        if (amt >= 1000) return `₹ ${(amt/1000).toFixed(1)}K`;
        return `₹ ${Math.round(amt)}`;
      };
      return res.json({
        success: true,
        data: {
          stats: {
            totalStudents: 6,
            totalFaculty: 3,
            activeCourses: 12,
            monthlyRevenue: formatShort(e2eMonthlyTotal),
            waitlistedCount
          },
          recentNotifications: [
            { id: 'e2e-1', message: 'E2E mode: dashboard using stub data', time: 'just now', type: 'system' }
          ],
          pendingTasks: [
            { id: 1, task: 'Review new admissions', priority: 'High' },
            { id: 2, task: 'Verify fee entries', priority: 'Medium' }
          ]
        }
      });
    }
    // Get statistics
    const totalStudents = await User.countDocuments({ role: 'student', status: 'active' });
    const totalFaculty = await User.countDocuments({ role: 'faculty', status: 'active' });
    await User.countDocuments({ status: 'active' });
    
    // Get recent notifications (last 10 users registered)
    const recentUsers = await User.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('firstName lastName role createdAt');

    // Generate notifications from recent registrations
    let recentNotifications = recentUsers.map((user) => ({
      id: user._id,
      message: `New ${user.role} registration: ${user.firstName} ${user.lastName}`,
      time: getTimeAgo(user.createdAt),
      type: 'registration'
    }));

    // Include recent admissions submissions
    const recentAdmissions = await Admission.find({ status: 'submitted' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('studentInfo.fullName applicationNumber createdAt');

    const admissionNotifications = recentAdmissions.map((adm) => ({
      id: adm.applicationNumber,
      message: `New admission application: ${adm.studentInfo?.fullName || 'Student'}`,
      time: getTimeAgo(adm.createdAt),
      type: 'admission'
    }));

    recentNotifications = [...admissionNotifications, ...recentNotifications];

    // Include recent contact messages recorded as notices
    try {
      const contactNotices = await require('../models/Notice')
        .find({ category: 'Contact', isActive: true })
        .sort({ effectiveDate: -1 })
        .limit(5)
        .select('title effectiveDate');
      const contactNotifications = contactNotices.map((n) => ({
        id: String(n._id),
        message: n.title,
        time: getTimeAgo(n.effectiveDate),
        type: 'contact'
      }));
      recentNotifications = [...contactNotifications, ...recentNotifications];
    } catch (_) { void 0; }

    // Add some sample system notifications
    recentNotifications.push(
      {
        id: 'sys1',
        message: 'System backup completed successfully',
        time: '2 hours ago',
        type: 'system'
      },
      {
        id: 'sys2',
        message: 'Monthly fee collection report generated',
        time: '1 day ago',
        type: 'report'
      }
    );

    // Pending tasks
    const submittedAdmissionsCount = await Admission.countDocuments({ status: 'submitted' });
    const pendingTasks = [
      { id: 1, task: `Review ${submittedAdmissionsCount} new admission applications`, priority: 'High' },
      { id: 2, task: 'Approve faculty leave requests', priority: 'Medium' },
      { id: 3, task: 'Update fee structure for next session', priority: 'High' },
      { id: 4, task: 'Schedule parent-teacher meeting', priority: 'Medium' }
    ];

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    let monthlyTotal = 0;
    try {
      const agg = await FeePayment.aggregate([
        { $match: { status: 'completed', 'paymentDetails.paymentDate': { $gte: startOfMonth, $lt: endOfMonth } } },
        { $group: { _id: null, total: { $sum: '$paymentDetails.amount' } } }
      ]);
      monthlyTotal = Number(agg?.[0]?.total || 0);
    } catch (_) { void 0; }
    const formatShort = (amt) => {
      if (amt >= 100000) return `₹ ${(amt/100000).toFixed(1)}L`;
      if (amt >= 1000) return `₹ ${(amt/1000).toFixed(1)}K`;
      return `₹ ${Math.round(amt)}`;
    };
    res.json({
      success: true,
      data: {
        stats: {
          totalStudents,
          totalFaculty,
          activeCourses: 42, // This would come from a Courses model
          monthlyRevenue: formatShort(monthlyTotal),
          waitlistedCount: submittedAdmissionsCount
        },
        recentNotifications: recentNotifications.slice(0, 4),
        pendingTasks
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
});

// Helper function to calculate time ago
function getTimeAgo(date) {
  const now = new Date();
  const diffInMs = now - new Date(date);
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 60) {
    return `${diffInMinutes} minutes ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hours ago`;
  } else {
    return `${diffInDays} days ago`;
  }
}

// @route   GET /api/admin/students
// @desc    Get all students with populated user details
// @access  Private (Admin only)
router.get('/students', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', class: studentClass = '' } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const match = { status: 'active' };
    if (studentClass) match.class = studentClass;

    const searchRegex = search ? new RegExp(search, 'i') : null;

    const pipeline = [
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $match: {
        ...match,
        ...(searchRegex ? {
          $or: [
            { rollNumber: searchRegex },
            { 'user.firstName': searchRegex },
            { 'user.lastName': searchRegex },
            { 'user.email': searchRegex }
          ]
        } : {})
      } },
      { $match: { 'user.status': 'active' } },
      { $sort: { createdAt: -1 } },
      { $project: { // Explicitly project all needed fields
          _id: 1,
          rollNumber: 1,
          class: 1,
          section: 1,
          admissionDate: 1,
          'medicalInfo.bloodGroup': 1,
          'father.name': 1,
          'mother.name': 1,
          'guardian.phone': 1,
          status: 1,
          user: { // Project the entire user object with specific fields
            _id: '$user._id',
            firstName: '$user.firstName',
            lastName: '$user.lastName',
            email: '$user.email',
            phone: '$user.phone',
            dateOfBirth: '$user.dateOfBirth',
            gender: '$user.gender',
            address: '$user.address',
            emergencyContact: '$user.emergencyContact'
          }
      }},
      { $facet: { data: [{ $skip: skip }, { $limit: limitNum }], totalCount: [{ $count: 'count' }] } }
    ];

    const agg = await Student.aggregate(pipeline);
    const students = (agg[0]?.data) || [];
    const totalStudents = (agg[0]?.totalCount?.[0]?.count) || 0;
    const totalPages = Math.max(1, Math.ceil(totalStudents / limitNum));

    res.json({
      success: true,
      data: {
        students,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalStudents,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
        }
      }
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ success: false, message: 'Error fetching students', error: error.message });
  }
});

// @route   POST /api/admin/students/promote
// @desc    Bulk-promote students to a new class and academic year
// @access  Private (Admin only)
router.post('/students/promote', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { studentIds, toClass, toAcademicYear, remarks } = req.body;
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'studentIds array is required' });
    }
    if (!toClass || !toAcademicYear) {
      return res.status(400).json({ success: false, message: 'toClass and toAcademicYear are required' });
    }
    // Validate academic year format
    if (!/^\d{4}-\d{4}$/.test(toAcademicYear)) {
      return res.status(400).json({ success: false, message: 'toAcademicYear must be in format YYYY-YYYY' });
    }

    const validClasses = ['NS', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    if (!validClasses.includes(toClass)) {
      return res.status(400).json({ success: false, message: `Invalid toClass. Must be one of: ${validClasses.join(', ')}` });
    }

    const adminUserId = req.user?._id || req.user?.id;
    const promoted = [];
    const errors = [];

    for (const sid of studentIds) {
      try {
        const student = await Student.findById(sid);
        if (!student) { errors.push({ id: sid, reason: 'Student not found' }); continue; }

        const historyEntry = {
          fromClass: student.class,
          toClass,
          fromAcademicYear: student.academicYear,
          toAcademicYear,
          promotedAt: new Date(),
          promotedBy: adminUserId,
          remarks: remarks || ''
        };

        student.class = toClass;
        student.academicYear = toAcademicYear;
        student.isPromoted = true;
        student.promotionHistory = [...(student.promotionHistory || []), historyEntry];
        await student.save();
        promoted.push({ id: String(student._id), rollNumber: student.rollNumber, fromClass: historyEntry.fromClass, toClass });
      } catch (err) {
        errors.push({ id: sid, reason: err.message });
      }
    }

    res.json({
      success: true,
      message: `Promoted ${promoted.length} student(s) successfully${errors.length ? `, ${errors.length} failed` : ''}.`,
      data: { promoted, errors }
    });
  } catch (error) {
    console.error('Promote students error:', error);
    res.status(500).json({ success: false, message: 'Error promoting students', error: error.message });
  }
});

// @route   GET /api/admin/students/promotion-history
// @desc    Get promotion history — optionally filtered by class or academicYear
// @access  Private (Admin only)
router.get('/students/promotion-history', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { class: filterClass, academicYear, page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const match = { 'promotionHistory.0': { $exists: true } };
    if (filterClass) match.class = filterClass;
    if (academicYear) match.academicYear = academicYear;

    const students = await Student.find(match)
      .populate('user', 'firstName lastName email phone')
      .populate('promotionHistory.promotedBy', 'firstName lastName')
      .select('rollNumber class section academicYear promotionHistory user')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Student.countDocuments(match);

    res.json({
      success: true,
      data: {
        records: students,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.max(1, Math.ceil(total / limitNum)),
          total
        }
      }
    });
  } catch (error) {
    console.error('Promotion history error:', error);
    res.status(500).json({ success: false, message: 'Error fetching promotion history', error: error.message });
  }
});

// @route   GET /api/admin/students/:id
// @desc    Get single student with detailed profile, grades, and attendance
// @access  Private (Admin only)
router.get('/students/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    // Try fetching by Student ID first; if not found, treat id as User ID
    let studentDoc = await Student.findById(id).populate('user', 'firstName lastName email phone dateOfBirth gender status address');
    if (!studentDoc) {
      studentDoc = await Student.findOne({ user: id }).populate('user', 'firstName lastName email phone dateOfBirth gender status address');
    }

    if (!studentDoc) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const academicYear = studentDoc.academicYear;

    // Attendance summary for current academic year
    const [totalClasses, presentClasses] = await Promise.all([
      Attendance.countDocuments({ student: studentDoc._id, academicYear }),
      Attendance.countDocuments({ student: studentDoc._id, academicYear, status: { $in: ['Present', 'Late'] } })
    ]);
    const attendancePercentage = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : studentDoc.overallAttendance || 0;

    // Recent attendance records
    const attendanceHistory = await Attendance.find({ student: studentDoc._id })
      .populate('course', 'name courseCode')
      .sort({ date: -1 })
      .limit(100);

    // Grades (latest 50) and GPA metrics
    const grades = await Grade.find({ student: studentDoc._id, isPublished: true })
      .populate('course', 'name courseCode credits')
      .sort({ assessmentDate: -1 })
      .limit(50);

    let gpaSem1 = 0;
    let gpaSem2 = 0;
    try {
      gpaSem1 = await Grade.calculateGPA(studentDoc._id, academicYear, '1');
      gpaSem2 = await Grade.calculateGPA(studentDoc._id, academicYear, '2');
    } catch (e) {
      // ignore GPA calc errors and default to 0
    }
    const gpaOverall = Number(((gpaSem1 + gpaSem2) / (gpaSem1 && gpaSem2 ? 2 : (gpaSem1 ? 1 : (gpaSem2 ? 1 : 1)))).toFixed(2));

    const profile = {
      personal: {
        id: String(studentDoc._id),
        studentId: studentDoc.studentId,
        rollNumber: studentDoc.rollNumber,
        class: studentDoc.class,
        section: studentDoc.section,
        academicYear: studentDoc.academicYear,
        admissionDate: studentDoc.admissionDate,
        status: studentDoc.status,
        name: `${studentDoc.user?.firstName || ''} ${studentDoc.user?.lastName || ''}`.trim(),
        email: studentDoc.user?.email,
        phone: studentDoc.user?.phone,
        gender: studentDoc.user?.gender,
        dateOfBirth: studentDoc.user?.dateOfBirth
      },
      fee: {
        structure: studentDoc.feeStructure,
        status: studentDoc.feeStatus,
        totalAmount: studentDoc.totalFeeAmount
      },
      transport: studentDoc.transport,
      documents: studentDoc.documents
    };

    const academicRecords = grades.map(g => ({
      id: String(g._id),
      course: {
        id: String(g.course?._id || ''),
        name: g.course?.name,
        code: g.course?.courseCode,
        credits: g.course?.credits
      },
      assessmentType: g.assessmentType,
      assessmentName: g.assessmentName,
      maxMarks: g.maxMarks,
      obtainedMarks: g.obtainedMarks,
      percentage: Number(g.percentage?.toFixed(2) || 0),
      letterGrade: g.letterGrade,
      gradePoints: g.gradePoints,
      assessmentDate: g.assessmentDate,
      session: g.session || g.semester,
      remarks: g.remarks
    }));

    const attendance = attendanceHistory.map(r => ({
      id: String(r._id),
      date: r.date,
      course: { id: String(r.course?._id || ''), name: r.course?.name, code: r.course?.courseCode },
      status: r.status,
      timeIn: r.timeIn,
      timeOut: r.timeOut,
      remarks: r.remarks
    }));

    const performanceMetrics = {
      attendancePercentage,
      gpa: {
        session1: Number(gpaSem1.toFixed ? gpaSem1.toFixed(2) : gpaSem1),
        session2: Number(gpaSem2.toFixed ? gpaSem2.toFixed(2) : gpaSem2),
        // legacy fields for backward compatibility
        semester1: Number(gpaSem1.toFixed ? gpaSem1.toFixed(2) : gpaSem1),
        semester2: Number(gpaSem2.toFixed ? gpaSem2.toFixed(2) : gpaSem2),
        overall: gpaOverall
      },
      status: studentDoc.status
    };

    res.json({ success: true, data: { profile, academicRecords, attendance, performanceMetrics } });
  } catch (error) {
    console.error('Get student details error:', error);
    res.status(500).json({ success: false, message: 'Error fetching student details', error: error.message });
  }
});

// @route   POST /api/admin/students
// @desc    Add new student
// @access  Private (Admin only)
router.post('/students', authenticateToken, requireRole(['admin']), async (req, res) => {
  let user;
  let student;
  let userSaved = false;
  let studentSaved = false;
  try {
    const {
      name,
      email,
      phone,
      rollNumber,
      class: studentClass,
      section,
      dateOfBirth,
      gender,
      fatherName,
      motherName,
      guardianPhone,
      address,
      admissionDate,
      bloodGroup,
      emergencyContact
    } = req.body;

    // Validate required fields including user model constraints
    if (!name || !email || !phone || !studentClass || !section || !rollNumber || !admissionDate || !dateOfBirth || !gender) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${[
          !name && 'name',
          !email && 'email',
          !phone && 'phone',
          !rollNumber && 'rollNumber',
          !studentClass && 'class',
          !section && 'section',
          !admissionDate && 'admissionDate',
          !dateOfBirth && 'dateOfBirth',
          !gender && 'gender'
        ].filter(Boolean).join(', ')}`
      });
    }

    // Validate dates early to avoid CastError 500s
    const isValidDate = (val) => {
      const d = new Date(val);
      return !isNaN(d.getTime());
    };
    const dateErrors = [];
    if (!isValidDate(dateOfBirth)) {
      dateErrors.push({ path: 'dateOfBirth', message: 'Invalid date format' });
    }
    if (!isValidDate(admissionDate)) {
      dateErrors.push({ path: 'admissionDate', message: 'Invalid date format' });
    }
    if (dateErrors.length) {
      return res.status(422).json({ success: false, message: 'Validation failed', errors: dateErrors });
    }

    // Normalize and validate phone numbers
    const normalizeDigits = (val) => (val ? String(val).replace(/\D/g, '') : '');
    const phoneDigits = normalizeDigits(phone);
    const guardianDigits = normalizeDigits(guardianPhone);
    if (phoneDigits.length !== 10) {
      return res.status(400).json({ success: false, message: 'Phone must be a valid 10-digit number' });
    }

    // Check for existing user by email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'User with this email already exists' });
    }

    // Derive first and last name
    const [firstName, ...rest] = name.trim().split(' ');
    const lastName = rest.join(' ') || '';

    // Create user with password from request if provided, otherwise fallback to student's 10-digit mobile number
    const defaultPassword = (typeof req.body.password === 'string' && req.body.password.trim()) ? req.body.password.trim() : phoneDigits;

    // Build emergency contact object if provided as a phone string
    let emergencyContactObj;
    if (emergencyContact) {
      const ecDigits = normalizeDigits(emergencyContact);
      if (ecDigits.length === 10) {
        emergencyContactObj = { name: 'Emergency', relationship: 'other', phone: ecDigits };
      }
    }

    user = new User({
      firstName,
      lastName,
      email,
      phone: phoneDigits,
      role: 'student',
      status: 'active',
      password: defaultPassword, // Will be hashed by User pre-save hook
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender: typeof gender === 'string' ? gender.toLowerCase() : undefined,
      address: address ? { street: address } : undefined,
      emergencyContact: emergencyContactObj || (guardianDigits.length === 10 ? { name: fatherName || 'Guardian', relationship: 'parent', phone: guardianDigits } : undefined),
      emailVerified: true,
      phoneVerified: !!phone
    });
    await user.save();
    userSaved = true;

    // Compute academic year (YYYY-YYYY)
    const now = new Date();
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // Academic year starts in April
    const academicYear = `${year}-${year + 1}`;

    // Generate admission number
    const admissionNumber = `ADM${Date.now()}`;

    // Normalize class value to match schema enum
    const classMap = {
      '1st': '1', '2nd': '2', '3rd': '3', '4th': '4', '5th': '5',
      '6th': '6', '7th': '7', '8th': '8', '9th': '9', '10th': '10',
      '11th': '11', '12th': '12'
    };
    const normalizedClass = classMap[studentClass] || studentClass;
    const normalizedSection = typeof section === 'string' ? section.trim().toUpperCase() : section;
    if (typeof normalizedSection === 'string' && normalizedSection.length > 2) {
      return res.status(422).json({ success: false, message: 'Validation failed', errors: [{ path: 'section', message: 'Section cannot exceed 2 characters' }] });
    }

    const guardianValid = guardianDigits.length === 10;
    student = new Student({
      user: user._id,
      studentId: undefined, // will be generated by pre-save
      rollNumber,
      class: normalizedClass,
      section: normalizedSection,
      academicYear,
      admissionDate: new Date(admissionDate),
      admissionNumber,
      father: {
        name: fatherName || 'N/A',
        occupation: undefined,
        phone: guardianValid ? guardianDigits : phoneDigits
      },
      mother: {
        name: motherName || 'N/A'
      },
      guardian: {
        name: fatherName || 'Guardian',
        relationship: 'parent',
        phone: guardianValid ? guardianDigits : undefined
      },
      medicalInfo: {
        bloodGroup: bloodGroup || undefined
      },
      status: 'active'
    });
    await student.save();
    studentSaved = true;

    const savedStudent = await Student.findById(student._id).populate('user', 'firstName lastName email phone status');

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: savedStudent
    });
  } catch (error) {
    console.error('Add student error:', error);
    // Rollback: if user was created but student failed, remove the user to prevent orphan records
    if (userSaved && !studentSaved && user && user._id) {
      try {
        await User.findByIdAndDelete(user._id);
        console.warn(`Rolled back user ${user.email} due to student creation failure`);
      } catch (cleanupErr) {
        console.error('Rollback failed: could not delete user', cleanupErr);
      }
    }
    // Duplicate key errors (e.g., email, admissionNumber, studentId)
    if (error && (error.code === 11000 || error.name === 'MongoServerError')) {
      const key = (error.keyPattern && Object.keys(error.keyPattern)[0]) || (error.keyValue && Object.keys(error.keyValue)[0]) || 'unknown';
      const val = (error.keyValue && error.keyValue[key]) || undefined;
      const message = `Duplicate value for '${key}'${val ? `: ${val}` : ''}`;
      return res.status(409).json({ success: false, message });
    }
    // Cast errors (e.g., invalid dates)
    if (error.name === 'CastError') {
      return res.status(422).json({ success: false, message: 'Validation failed', errors: [{ path: error.path || 'unknown', message: error.message }] });
    }
    if (error.name === 'ValidationError') {
      // Extract detailed field-level validation errors
      const details = error.errors
        ? Object.values(error.errors).map(e => ({ path: e.path, message: e.message }))
        : [{ path: 'unknown', message: error.message }];
      return res.status(422).json({ success: false, message: 'Validation failed', errors: details });
    }
    res.status(500).json({ success: false, message: 'Error creating student', error: error.message });
  }
});

// @route   PUT /api/admin/students/:id
// @desc    Update student
// @access  Private (Admin only)
router.put('/students/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      phone,
      rollNumber,
      class: studentClass,
      section,
      dateOfBirth,
      gender,
      fatherName,
      motherName,
      guardianPhone,
      address,
      admissionDate,
      bloodGroup,
      status
    } = req.body;

    const student = await Student.findById(id).populate('user');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Normalize inputs
    const normalizeDigits = (val) => (val ? String(val).replace(/\D/g, '') : '');
    
    // Validate dates early to avoid CastError 500s
    const isValidDate = (val) => {
      if (!val) return true;
      const d = new Date(val);
      return !isNaN(d.getTime());
    };
    const dateErrors = [];
    if (dateOfBirth && !isValidDate(dateOfBirth)) dateErrors.push({ path: 'dateOfBirth', message: 'Invalid date format' });
    if (admissionDate && !isValidDate(admissionDate)) dateErrors.push({ path: 'admissionDate', message: 'Invalid date format' });
    if (dateErrors.length) {
      return res.status(422).json({ success: false, message: 'Validation failed', errors: dateErrors });
    }

    // Update user
    if (name) {
      const parts = name.trim().split(/\s+/);
      student.user.firstName = parts[0];
      student.user.lastName = parts.slice(1).join(' ');
    }
    if (email) student.user.email = email.toLowerCase();
    if (phone) student.user.phone = normalizeDigits(phone);
    if (dateOfBirth) student.user.dateOfBirth = new Date(dateOfBirth);
    if (gender) student.user.gender = String(gender).toLowerCase();
    if (address) student.user.address = { ...(student.user.address || {}), street: address };
    
    // Save user changes first
    await student.user.save();

    // Update student doc
    if (rollNumber) student.rollNumber = rollNumber;
    if (studentClass) {
      const classMap = {
        '1st': '1', '2nd': '2', '3rd': '3', '4th': '4', '5th': '5',
        '6th': '6', '7th': '7', '8th': '8', '9th': '9', '10th': '10',
        '11th': '11', '12th': '12'
      };
      student.class = classMap[studentClass] || studentClass;
    }
    
    // Handle section carefully - don't set empty string if it's required
    if (section && section.trim()) {
      student.section = section.trim().toUpperCase();
    }
    
    if (admissionDate) student.admissionDate = new Date(admissionDate);
    if (fatherName) student.father = { ...(student.father || {}), name: fatherName };
    if (motherName) student.mother = { ...(student.mother || {}), name: motherName };
    
    if (guardianPhone) {
      const gPhone = normalizeDigits(guardianPhone);
      if (student.guardian) {
        student.guardian.phone = gPhone;
      } else {
        student.guardian = { name: fatherName || 'Guardian', relationship: 'parent', phone: gPhone };
      }
    }
    
    if (bloodGroup) student.medicalInfo = { ...(student.medicalInfo || {}), bloodGroup };
    if (status) student.status = status;

    await student.save();

    const updatedStudent = await Student.findById(student._id).populate('user', 'firstName lastName email phone status');
    res.json({ success: true, message: 'Student updated successfully', data: updatedStudent });
  } catch (error) {
    console.error('Update student error:', error);
    
    // Handle duplicate key errors (e.g., email change)
    if (error && (error.code === 11000 || error.name === 'MongoServerError')) {
      const key = (error.keyPattern && Object.keys(error.keyPattern)[0]) || 'unknown';
      const val = (error.keyValue && error.keyValue[key]) || undefined;
      return res.status(409).json({ 
        success: false, 
        message: `Duplicate value for '${key}'${val ? `: ${val}` : ''}` 
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const details = Object.values(error.errors).map(e => ({ path: e.path, message: e.message }));
      return res.status(422).json({ success: false, message: 'Validation failed', errors: details });
    }

    // Handle cast errors
    if (error.name === 'CastError') {
      return res.status(422).json({ success: false, message: 'Invalid data provided', errors: [{ path: error.path, message: error.message }] });
    }

    res.status(500).json({ success: false, message: 'Error updating student', error: error.message });
  }
});

// @route   DELETE /api/admin/students/:id
// @desc    Delete student
// @access  Private (Admin only)
router.delete('/students/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { hard } = req.query;
    const studentId = req.params.id;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const userId = student.user;

    if (hard === 'true') {
      await Promise.all([
        Student.deleteOne({ _id: studentId }),
        userId ? User.deleteOne({ _id: userId }) : Promise.resolve(),
        Attendance.deleteMany({ student: studentId }),
        Grade.deleteMany({ student: studentId }),
        FeePayment.deleteMany({ student: studentId }),
        FeeDue.deleteMany({ student: studentId })
      ]);

      return res.json({ success: true, message: 'Student permanently deleted' });
    }

    student.status = 'inactive';
    await student.save();
    if (userId) {
      await User.updateOne({ _id: userId }, { $set: { status: 'inactive' } });
    }

    res.json({ success: true, message: 'Student deactivated (soft delete)', data: { id: studentId, status: 'inactive' } });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ success: false, message: 'Error deleting student', error: error.message });
  }
});

// @route   GET /api/admin/faculty
// @desc    Get all faculty
// @access  Private (Admin only)
router.get('/faculty', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 10, department, search } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (department && department !== 'all') {
      query.department = department;
    }

    const searchRegex = search ? new RegExp(search, 'i') : null;

    const baseMatch = {
      'userDetails.role': 'faculty',
      'userDetails.status': 'active',
      status: 'active',
      ...query,
      ...(searchRegex ? {
        $or: [
          { 'userDetails.firstName': searchRegex },
          { 'userDetails.lastName': searchRegex },
          { 'userDetails.email': searchRegex },
          { employeeId: searchRegex }
        ]
      } : {})
    };

    const facultyAggregation = [
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userDetails' } },
      { $unwind: '$userDetails' },
      { $match: baseMatch },
      { $project: {
        employeeId: 1,
        department: 1,
        designation: 1,
        subjects: 1,
        joiningDate: 1,
        status: 1,
        qualifications: 1,
        experience: 1,
        salary: 1,
        specializations: 1,
        'userDetails.firstName': 1,
        'userDetails.lastName': 1,
        'userDetails.email': 1,
        'userDetails.phone': 1,
        'userDetails.status': 1,
        'userDetails.address': 1
      } },
      { $sort: { 'userDetails.firstName': 1 } },
      { $skip: skip },
      { $limit: limitNum }
    ];

    const faculty = await Faculty.aggregate(facultyAggregation);

    const totalCountAggregation = [
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userDetails' } },
      { $unwind: '$userDetails' },
      { $match: baseMatch },
      { $count: 'total' }
    ];

    const totalResult = await Faculty.aggregate(totalCountAggregation);
    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    const transformedFaculty = faculty.map(f => ({
      id: f._id,
      employeeId: f.employeeId,
      name: `${f.userDetails.firstName} ${f.userDetails.lastName}`,
      email: f.userDetails.email,
      phone: f.userDetails.phone,
      department: f.department,
      designation: f.designation,
      subjects: f.subjects,
      joiningDate: f.joiningDate ? new Date(f.joiningDate).toISOString().split('T')[0] : '',
      status: f.status || 'Active',
      qualification: Array.isArray(f.qualifications) ? (f.qualifications[0]?.degree || '') : (f.qualifications || ''),
      experience: f.experience?.totalYears || 0,
      salary: f.salary?.basic || 0,
      specialization: Array.isArray(f.specializations) ? (f.specializations[0] || '') : (f.specializations || ''),
      address: f.userDetails.address?.street || f.userDetails.address || ''
    }));

    const pagination = {
      currentPage: pageNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
      totalItems: total,
      itemsPerPage: limitNum,
      hasNext: pageNum < Math.ceil(total / limitNum),
      hasPrev: pageNum > 1
    };

    res.json({
      success: true,
      message: 'Faculty data retrieved successfully',
      data: { faculty: transformedFaculty, pagination }
    });
  } catch (error) {
    console.error('Get faculty error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch faculty data', error: error.message });
  }
});

// @route   POST /api/admin/faculty
// @desc    Add new faculty
// @access  Private (Admin only)
router.post('/faculty', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const {
      firstName: rawFirstName,
      lastName: rawLastName,
      name,
      email,
      phone,
      department,
      designation,
      qualification,
      experience,
      joiningDate,
      dateOfJoining,
      salary,
      address,
      emergencyContact,
      specialization,
      status
    } = req.body;

    // Derive first/last name from provided fields
    let firstName = rawFirstName;
    let lastName = rawLastName;
    if ((!firstName || !lastName) && name) {
      const parts = String(name).trim().split(/\s+/);
      firstName = firstName || parts[0] || '';
      lastName = lastName || parts.slice(1).join(' ') || '';
    }

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !department) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: firstName, lastName, email, phone, department'
      });
    }

    // Check if user with email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Generate employee ID
    const lastFaculty = await Faculty.findOne().sort({ employeeId: -1 });
    let employeeId = 'FAC001';
    if (lastFaculty && lastFaculty.employeeId) {
      const lastNumber = parseInt(lastFaculty.employeeId.replace('FAC', ''));
      employeeId = `FAC${String(lastNumber + 1).padStart(3, '0')}`;
    }

    // Create user account: prefer provided password; fallback to Employee ID
    const defaultPassword = (typeof req.body.password === 'string' && req.body.password.trim()) ? req.body.password.trim() : employeeId;

    // Normalize address into expected object shape
    const normalizedAddress = (address && typeof address === 'object')
      ? address
      : (address ? { street: String(address) } : {});

    const user = new User({
      firstName,
      lastName,
      email,
      password: defaultPassword, // Will be hashed by User pre-save hook
      role: 'faculty',
      phone,
      address: normalizedAddress,
      status: (status && typeof status === 'string') ? status.toLowerCase() : 'active'
    });

    await user.save();

    // Normalize enums to match Faculty model
    const allowedDepartments = [
      'Mathematics', 'Science', 'English', 'Hindi', 'Social Studies',
      'Physics', 'Chemistry', 'Biology', 'Computer Science',
      'Physical Education', 'Arts', 'Music', 'Library',
      'Administration', 'Counseling'
    ];
    const allowedDesignations = [
      'Principal', 'Vice Principal', 'Head Teacher', 'Senior Teacher',
      'Teacher', 'Assistant Teacher', 'PGT', 'TGT', 'PRT',
      'Lab Assistant', 'Librarian', 'Sports Teacher', 'Music Teacher',
      'Art Teacher', 'Computer Teacher', 'Counselor'
    ];

    const normalizeEnum = (val, allowed) => {
      if (!val || typeof val !== 'string') return null;
      // Try case-insensitive match
      const found = allowed.find(a => a.toLowerCase() === val.toLowerCase());
      if (found) return found;
      // Map common aliases
      const aliasMap = {
        'computer_science': 'Computer Science',
        'cs': 'Computer Science',
        'pe': 'Physical Education',
        'admin': 'Administration',
        'counselling': 'Counseling',
        'assistant_professor': 'Assistant Teacher',
        'assistant teacher': 'Assistant Teacher',
        'teacher': 'Teacher'
      };
      const alias = aliasMap[val.toLowerCase()];
      if (alias && allowed.includes(alias)) return alias;
      return null;
    };

    const normalizedDepartment = normalizeEnum(department, allowedDepartments) || 'Computer Science';
    const normalizedDesignation = normalizeEnum(designation, allowedDesignations) || 'Assistant Teacher';

    // Defaults to satisfy schema-required fields for quick admin creation
    const defaultEmergency = {
      name: 'Primary Contact',
      relationship: 'Guardian',
      phone: (String(phone || '')).match(/^[0-9]{10}$/) ? String(phone) : '9999999999'
    };

    const defaultBank = {
      accountNumber: '123456789012',
      ifscCode: 'HDFC0ABCD12',
      bankName: 'HDFC Bank',
      branchName: 'Main'
    };

    const defaultWorkingHours = {
      startTime: '09:00',
      endTime: '17:00',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    };

    const defaultExperience = {
      totalYears: 0,
      previousSchools: []
    };

    const defaultSubjects = ['General'];
    const defaultClasses = [{ class: '10', section: 'A', subject: 'General', isClassTeacher: false }];

    // Create faculty profile with sane defaults
    const faculty = new Faculty({
      user: user._id,
      employeeId,
      department: normalizedDepartment,
      designation: normalizedDesignation,
      qualifications: Array.isArray(qualification) ? qualification : (qualification ? [{ degree: qualification, institution: 'N/A', year: new Date().getFullYear() }] : []),
      experience: (experience && typeof experience === 'object') ? experience : { totalYears: Number(experience) || 0, previousSchools: [] },
      specializations: Array.isArray(specialization) ? specialization : (specialization ? [specialization] : []),
      joiningDate: joiningDate || dateOfJoining || new Date(),
      employmentType: 'permanent',
      salary: {
        basic: salary || 50000,
        allowances: {
          hra: (salary || 50000) * 0.2,
          da: (salary || 50000) * 0.1,
          ta: 0,
          medical: 0,
          other: 0
        },
        deductions: {
          pf: 0,
          esi: 0,
          tax: 0,
          other: 0
        }
      },
      emergencyContact: (emergencyContact && typeof emergencyContact === 'object') ? emergencyContact : defaultEmergency,
      bankDetails: defaultBank,
      workingHours: defaultWorkingHours,
      subjects: defaultSubjects,
      classes: defaultClasses,
      status: ((status && typeof status === 'string') ? status.toLowerCase() : 'active')
    });

    await faculty.save();

    // Populate user data for response
    await faculty.populate('user', 'firstName lastName email phone');

    res.status(201).json({
      success: true,
      message: 'Faculty member added successfully',
      data: {
        id: faculty._id,
        employeeId: faculty.employeeId,
        name: `${faculty.user.firstName} ${faculty.user.lastName}`,
        email: faculty.user.email,
        phone: faculty.user.phone,
        department: faculty.department,
        designation: faculty.designation,
        status: faculty.status,
        joiningDate: faculty.joiningDate
      }
    });

  } catch (error) {
    console.error('Error adding faculty:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add faculty member',
      error: error.message
    });
  }
});

// @route   GET /api/admin/faculty/:id
// @desc    Get single faculty member details
// @access  Private (Admin only)
router.get('/faculty/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const faculty = await Faculty.findById(id).populate('user', 'firstName lastName email phone dateOfBirth gender status address');
    
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty member not found' });
    }

    res.json({
      success: true,
      data: {
        profile: {
          id: faculty._id,
          employeeId: faculty.employeeId,
          name: `${faculty.user.firstName} ${faculty.user.lastName}`,
          email: faculty.user.email,
          phone: faculty.user.phone,
          department: faculty.department,
          designation: faculty.designation,
          status: faculty.status,
          joiningDate: faculty.joiningDate,
          qualification: Array.isArray(faculty.qualifications) ? (faculty.qualifications[0]?.degree || '') : (faculty.qualifications || ''),
          experience: faculty.experience?.totalYears || 0,
          specialization: Array.isArray(faculty.specializations) ? (faculty.specializations[0] || '') : (faculty.specializations || ''),
          address: faculty.user.address?.street || faculty.user.address || ''
        }
      }
    });
  } catch (error) {
    console.error('Get faculty details error:', error);
    res.status(500).json({ success: false, message: 'Error fetching faculty details', error: error.message });
  }
});

// @route   PUT /api/admin/faculty/:id
// @desc    Update faculty member
// @access  Private (Admin only)
router.put('/faculty/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName: rawFirstName,
      lastName: rawLastName,
      name,
      email,
      phone,
      department,
      designation,
      qualification,
      experience,
      salary,
      specialization,
      status,
      address,
      emergencyContact
    } = req.body;

    // Find faculty member
    const faculty = await Faculty.findById(id).populate('user');
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: 'Faculty member not found'
      });
    }

    // Update user information
    // Derive name updates
    let firstName = rawFirstName;
    let lastName = rawLastName;
    if ((!firstName || !lastName) && name) {
      const parts = String(name).trim().split(/\s+/);
      firstName = firstName || parts[0] || '';
      lastName = lastName || parts.slice(1).join(' ') || '';
    }
    if (firstName) faculty.user.firstName = firstName;
    if (lastName) faculty.user.lastName = lastName;
    if (email) faculty.user.email = email;
    if (phone) faculty.user.phone = phone;
    if (address) {
      const normalizedAddress = (typeof address === 'object') ? address : { street: String(address) };
      faculty.user.address = { ...faculty.user.address, ...normalizedAddress };
    }

    await faculty.user.save();

    // Update faculty information
    if (department) faculty.department = department;
    if (designation) faculty.designation = designation;
    if (qualification) {
      faculty.qualifications = Array.isArray(qualification) ? qualification : [{ degree: qualification, institution: 'N/A', year: new Date().getFullYear() }];
    }
    if (experience !== undefined) {
      faculty.experience = (experience && typeof experience === 'object') ? experience : { totalYears: Number(experience) || 0, previousSchools: [] };
    }
    if (specialization) {
      faculty.specializations = Array.isArray(specialization) ? specialization : [specialization];
    }
    if (salary) {
      faculty.salary.basic = Number(salary);
      faculty.salary.allowances.hra = Number(salary) * 0.2;
      faculty.salary.allowances.da = Number(salary) * 0.1;
    }
    if (status) faculty.status = String(status).toLowerCase();
    if (emergencyContact) faculty.emergencyContact = { ...faculty.emergencyContact, ...emergencyContact };

    await faculty.save();

    res.json({
      success: true,
      message: 'Faculty member updated successfully',
      data: {
        id: faculty._id,
        employeeId: faculty.employeeId,
        name: `${faculty.user.firstName} ${faculty.user.lastName}`,
        email: faculty.user.email,
        phone: faculty.user.phone,
        department: faculty.department,
        designation: faculty.designation,
        status: faculty.status
      }
    });

  } catch (error) {
    console.error('Error updating faculty:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update faculty member',
      error: error.message
    });
  }
});

// @route   DELETE /api/admin/faculty/:id
// @desc    Delete faculty member
// @access  Private (Admin only)
router.delete('/faculty/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { hard } = req.query;

    const faculty = await Faculty.findById(id).populate('user');
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty member not found' });
    }

    if (hard === 'true') {
      const userId = faculty.user?._id;
      await Faculty.deleteOne({ _id: id });
      if (userId) await User.deleteOne({ _id: userId });
      return res.json({ success: true, message: 'Faculty member permanently deleted' });
    }

    faculty.status = 'inactive';
    await faculty.save();

    if (faculty.user) {
      faculty.user.status = 'inactive';
      await faculty.user.save();
    }

    res.json({ success: true, message: 'Faculty member deactivated (soft delete)' });
  } catch (error) {
    console.error('Error deleting faculty:', error);
    res.status(500).json({ success: false, message: 'Failed to delete faculty member', error: error.message });
  }
});

// @route   GET /api/admin/admissions
// @desc    Get admission applications
// @access  Private (Admin only)
router.get('/admissions', async (req, res) => {
  try {
    if (process.env.E2E_MODE === 'true') {
      const { status, page = 1, limit = 10, search } = req.query;
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}-${currentYear + 1}`;
      // Seed stub data
      if (e2eAdmissionsState.admissions.length === 0) {
        e2eAdmissionsState.admissions = [
          { applicationNumber: 'ADM-2025-0001', studentInfo: { fullName: 'Rahul Verma' }, academicInfo: { applyingForClass: 'Grade 6', academicYear }, status: 'submitted', priority: 'normal', contactInfo: { email: 'rahul@example.com', phone: '9999912345' }, feeInfo: { paymentStatus: 'paid' }, createdAt: new Date() },
          { applicationNumber: 'ADM-2025-0002', studentInfo: { fullName: 'Priya Singh' }, academicInfo: { applyingForClass: 'Grade 9', academicYear }, status: 'submitted', priority: 'high', contactInfo: { email: 'priya@example.com', phone: '9999923456' }, feeInfo: { paymentStatus: 'pending' }, createdAt: new Date(Date.now() - 86400000) },
          { applicationNumber: 'ADM-2025-0003', studentInfo: { fullName: 'Aman Gupta' }, academicInfo: { applyingForClass: 'Grade 1', academicYear }, status: 'review', priority: 'normal', contactInfo: { email: 'aman@example.com', phone: '9999934567' }, feeInfo: { paymentStatus: 'paid' }, createdAt: new Date(Date.now() - 2 * 86400000) }
        ];
      }
      let items = e2eAdmissionsState.admissions.slice();
      if (search) {
        const q = String(search).toLowerCase();
        items = items.filter(a => a.studentInfo.fullName.toLowerCase().includes(q) || a.applicationNumber.toLowerCase().includes(q));
      }
      if (status) {
        items = items.filter(a => a.status === status);
      }
      const totalCount = items.length;
      const totalPages = Math.ceil(totalCount / parseInt(limit));
      const start = (parseInt(page) - 1) * parseInt(limit);
      const pageItems = items.slice(start, start + parseInt(limit));
      const statusSummary = items.reduce((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {});
      return res.json({
        success: true,
        message: 'Admission applications (E2E) retrieved successfully',
        data: {
          admissions: pageItems,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalCount,
            hasNextPage: parseInt(page) < totalPages,
            hasPrevPage: parseInt(page) > 1,
            limit: parseInt(limit)
          },
          statusSummary,
          filters: { status, class: req.query.class, academicYear, search }
        }
      });
    }
    const { 
      status, 
      class: applyingClass, 
      academicYear,
      page = 1, 
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (applyingClass) {
      filter['academicInfo.applyingForClass'] = applyingClass;
    }
    
    if (academicYear) {
      filter['academicInfo.academicYear'] = academicYear;
    }
    
    if (search) {
      filter.$or = [
        { 'studentInfo.fullName': { $regex: search, $options: 'i' } },
        { applicationNumber: { $regex: search, $options: 'i' } },
        { 'contactInfo.email': { $regex: search, $options: 'i' } },
        { 'contactInfo.phone': { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const [admissions, totalCount] = await Promise.all([
      Admission.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Admission.countDocuments(filter)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    // Get status summary
    const statusSummary = await Admission.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      message: 'Admission applications retrieved successfully',
      data: {
        admissions,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage,
          hasPrevPage,
          limit: parseInt(limit)
        },
        statusSummary: statusSummary.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        filters: {
          status,
          class: applyingClass,
          academicYear,
          search
        }
      }
    });

  } catch (error) {
    console.error('Error fetching admissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admission applications',
      error: error.message
    });
  }
});

// @route   PUT /api/admin/admissions/:id/approve
// @desc    Approve admission application
// @access  Private (Admin only)
router.put('/admissions/:id/approve', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks, assignedClass, assignedSection } = req.body;
    const adminId = req.user.id;

    // Find the admission application
    const admission = await Admission.findById(id);
    
    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission application not found'
      });
    }

    // Check if application can be approved
    if (admission.status === 'approved' || admission.status === 'admitted') {
      return res.status(400).json({
        success: false,
        message: 'Application is already approved/admitted'
      });
    }

    /* Document check removed to make documents optional
    if (!admission.areRequiredDocumentsUploaded()) {
      return res.status(400).json({
        success: false,
        message: 'Required documents are not uploaded. Cannot approve application.'
      });
    }
    */

    /* Payment check removed to make it optional for admin approval
    if (admission.feeInfo.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Admission fee payment is pending. Cannot approve application.'
      });
    }
    */

    // Update admission status
    admission.status = 'approved';
    admission.processedBy = adminId;
    admission.processedDate = new Date();
    
    if (remarks) {
      admission.remarks = remarks;
    }

    // Update academic info if provided
    if (assignedClass) {
      // Normalize class value to match schema enum (e.g., '12th' -> '12')
      const classMap = {
        '1st': '1', '2nd': '2', '3rd': '3', '4th': '4', '5th': '5',
        '6th': '6', '7th': '7', '8th': '8', '9th': '9', '10th': '10',
        '11th': '11', '12th': '12'
      };
      admission.academicInfo.applyingForClass = classMap[assignedClass] || assignedClass;
    }
    
    if (assignedSection) {
      admission.academicInfo.preferredSection = assignedSection;
    }

    // Add communication log
    admission.communications.push({
      type: 'email',
      subject: 'Admission Application Approved',
      message: `Your admission application ${admission.applicationNumber} has been approved. ${remarks || ''}`,
      sentBy: adminId,
      status: 'sent'
    });

    await admission.save();

    // Populate the processedBy field for response
    await admission.populate('processedBy', 'name email');

    res.json({
      success: true,
      message: 'Admission application approved successfully',
      data: {
        admission: {
          id: admission._id,
          applicationNumber: admission.applicationNumber,
          studentName: admission.studentInfo.fullName,
          status: admission.status,
          processedBy: admission.processedBy,
          processedDate: admission.processedDate,
          remarks: admission.remarks,
          assignedClass: admission.academicInfo.applyingForClass,
          assignedSection: admission.academicInfo.preferredSection
        }
      }
    });

  } catch (error) {
    console.error('Error approving admission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve admission application',
      error: error.message
    });
  }
});

// @route   PUT /api/admin/admissions/:id/reject
// @desc    Reject admission application
// @access  Private (Admin only)
router.put('/admissions/:id/reject', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, remarks } = req.body;
    const adminId = req.user.id;

    // Validate required fields
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    // Find the admission application
    const admission = await Admission.findById(id);
    
    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission application not found'
      });
    }

    // Check if application can be rejected
    if (admission.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Application is already rejected'
      });
    }

    if (admission.status === 'approved' || admission.status === 'admitted') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reject an approved/admitted application'
      });
    }

    // Update admission status
    admission.status = 'rejected';
    admission.processedBy = adminId;
    admission.processedDate = new Date();
    admission.remarks = `Rejected: ${reason}${remarks ? ` - ${remarks}` : ''}`;

    // Add communication log
    admission.communications.push({
      type: 'email',
      subject: 'Admission Application Rejected',
      message: `Your admission application ${admission.applicationNumber} has been rejected. Reason: ${reason}${remarks ? ` Additional remarks: ${remarks}` : ''}`,
      sentBy: adminId,
      status: 'sent'
    });

    // If payment was made, mark for refund
    if (admission.feeInfo.paymentStatus === 'paid') {
      admission.feeInfo.paymentStatus = 'refunded';
      admission.communications.push({
        type: 'email',
        subject: 'Admission Fee Refund Initiated',
        message: `Your admission fee for application ${admission.applicationNumber} will be refunded within 7-10 working days.`,
        sentBy: adminId,
        status: 'sent'
      });
    }

    await admission.save();

    // Populate the processedBy field for response
    await admission.populate('processedBy', 'name email');

    res.json({
      success: true,
      message: 'Admission application rejected successfully',
      data: {
        admission: {
          id: admission._id,
          applicationNumber: admission.applicationNumber,
          studentName: admission.studentInfo.fullName,
          status: admission.status,
          processedBy: admission.processedBy,
          processedDate: admission.processedDate,
          remarks: admission.remarks,
          refundStatus: admission.feeInfo.paymentStatus
        }
      }
    });

  } catch (error) {
    console.error('Error rejecting admission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject admission application',
      error: error.message
    });
  }
});

// @route   GET /api/admin/fees
// @desc    Get fee management data
// @access  Private (Admin only)
router.get('/fees', async (req, res) => {
  try {
    if (process.env.E2E_MODE === 'true') {
      const {
        type = 'overview',
        page = 1,
        limit = 10,
      } = req.query;
      const currentYear = new Date().getFullYear();
      const yearFilter = `${currentYear}-${currentYear + 1}`;

      // Seed default structures if empty (matches screenshot)
      if (e2eFeesState.feeStructures.length === 0) {
        e2eFeesState.feeStructures = [
          { _id: 'fs-e2e-kg', class: 'Nursery - KG', academicYear: yearFilter, feeComponents: { annualFee: 45000 }, totalAmount: 45000, paymentSchedule: 'annual' },
          { _id: 'fs-e2e-1-5', class: 'Grade 1-5', academicYear: yearFilter, feeComponents: { annualFee: 54000 }, totalAmount: 54000, paymentSchedule: 'annual' },
          { _id: 'fs-e2e-6-8', class: 'Grade 6-8', academicYear: yearFilter, feeComponents: { annualFee: 66000 }, totalAmount: 66000, paymentSchedule: 'annual' },
          { _id: 'fs-e2e-9-10', class: 'Grade 9-10', academicYear: yearFilter, feeComponents: { annualFee: 75000 }, totalAmount: 75000, paymentSchedule: 'annual' },
          { _id: 'fs-e2e-11-12', class: 'Grade 11-12', academicYear: yearFilter, feeComponents: { annualFee: 90000 }, totalAmount: 90000, paymentSchedule: 'annual' },
        ];
      }

      if (type === 'overview') {
        const totalCollection = e2eFeesState.payments.reduce((sum, p) => sum + Number(p.paymentDetails?.amount || 0), 0);
        return res.json({
          success: true,
          data: {
            type: 'overview',
            academicYear: yearFilter,
            summary: {
              totalCollection,
              pendingDues: {},
              totalPendingAmount: 0
            },
            feeStructures: e2eFeesState.feeStructures,
            recentPayments: e2eFeesState.payments.slice().reverse().slice(0, 10)
          }
        });
      }

      if (type === 'payments') {
        const start = (parseInt(page) - 1) * parseInt(limit);
        const items = e2eFeesState.payments.slice().reverse();
        return res.json({
          success: true,
          data: {
            type: 'payments',
            payments: items.slice(start, start + parseInt(limit)),
            pagination: {
              currentPage: parseInt(page),
              totalPages: Math.ceil(items.length / parseInt(limit)),
              totalItems: items.length,
              hasNext: parseInt(page) < Math.ceil(items.length / parseInt(limit)),
              hasPrev: parseInt(page) > 1
            }
          }
        });
      }

      if (type === 'dues') {
        const start = (parseInt(page) - 1) * parseInt(limit);
        const items = e2eFeesState.dues.slice().reverse();
        return res.json({
          success: true,
          data: {
            type: 'dues',
            dues: items.slice(start, start + parseInt(limit)),
            pagination: {
              currentPage: parseInt(page),
              totalPages: Math.ceil(items.length / parseInt(limit)),
              totalItems: items.length,
              hasNext: parseInt(page) < Math.ceil(items.length / parseInt(limit)),
              hasPrev: parseInt(page) > 1
            }
          }
        });
      }
      return res.status(400).json({ success: false, message: 'Invalid type parameter. Use: overview, payments, or dues' });
    }
    const { 
      type = 'overview', 
      class: className, 
      academicYear, 
      status,
      page = 1, 
      limit = 10,
      search 
    } = req.query;

    const currentYear = new Date().getFullYear();
    const defaultAcademicYear = `${currentYear}-${currentYear + 1}`;
    const yearFilter = academicYear || defaultAcademicYear;

    if (type === 'overview') {
      // Get overview data
      const [feeStructures, totalCollections, pendingDues, recentPayments] = await Promise.all([
        FeeStructure.find({ academicYear: yearFilter, isActive: true })
          .populate('createdBy', 'name')
          .sort({ class: 1 }),
        
        FeePayment.aggregate([
          { $match: { academicYear: yearFilter, status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$paymentDetails.amount' } } }
        ]),
        
        FeeDue.aggregate([
          { $match: { academicYear: yearFilter, status: { $in: ['pending', 'partial', 'overdue'] } } },
          { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$remainingAmount' } } }
        ]),
        
        FeePayment.find({ academicYear: yearFilter, status: 'completed' })
          .populate('student', 'name class')
          .sort({ 'paymentDetails.paymentDate': -1 })
          .limit(10)
      ]);

      const summary = {
        totalCollection: totalCollections[0]?.total || 0,
        pendingDues: pendingDues.reduce((acc, due) => {
          acc[due._id] = { count: due.count, amount: due.amount };
          return acc;
        }, {}),
        totalPendingAmount: pendingDues.reduce((sum, due) => sum + due.amount, 0)
      };

      return res.json({
        success: true,
        data: {
          type: 'overview',
          academicYear: yearFilter,
          summary,
          feeStructures,
          recentPayments
        }
      });
    }

    if (type === 'payments') {
      // Get payment history
      const query = { academicYear: yearFilter };
      if (status) query.status = status;

      let searchQuery = {};
      if (search) {
        const students = await Student.find({
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { studentId: { $regex: search, $options: 'i' } }
          ]
        }).select('_id');
        
        searchQuery = {
          $or: [
            { student: { $in: students.map(s => s._id) } },
            { 'paymentDetails.receiptNumber': { $regex: search, $options: 'i' } },
            { 'paymentDetails.transactionId': { $regex: search, $options: 'i' } }
          ]
        };
      }

      const finalQuery = { ...query, ...searchQuery };
      
      const payments = await FeePayment.find(finalQuery)
        .populate('student', 'name class studentId')
        .populate('feeStructure', 'class')
        .populate('processedBy', 'name')
        .sort({ 'paymentDetails.paymentDate': -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));

      const totalPayments = await FeePayment.countDocuments(finalQuery);

      return res.json({
        success: true,
        data: {
          type: 'payments',
          payments,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalPayments / parseInt(limit)),
            totalItems: totalPayments,
            hasNext: parseInt(page) < Math.ceil(totalPayments / parseInt(limit)),
            hasPrev: parseInt(page) > 1
          }
        }
      });
    }

    if (type === 'dues') {
      // Get pending dues
      const query = { academicYear: yearFilter };
      if (status) query.status = status;
      if (className) {
        const feeStructures = await FeeStructure.find({ class: className, academicYear: yearFilter });
        query.feeStructure = { $in: feeStructures.map(fs => fs._id) };
      }

      let searchQuery = {};
      if (search) {
        const students = await Student.find({
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { studentId: { $regex: search, $options: 'i' } }
          ]
        }).select('_id');
        
        searchQuery = { student: { $in: students.map(s => s._id) } };
      }

      const finalQuery = { ...query, ...searchQuery };
      
      const dues = await FeeDue.find(finalQuery)
        .populate('student', 'name class studentId')
        .populate('feeStructure', 'class')
        .sort({ dueDate: 1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));

      const totalDues = await FeeDue.countDocuments(finalQuery);

      return res.json({
        success: true,
        data: {
          type: 'dues',
          dues,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalDues / parseInt(limit)),
            totalItems: totalDues,
            hasNext: parseInt(page) < Math.ceil(totalDues / parseInt(limit)),
            hasPrev: parseInt(page) > 1
          }
        }
      });
    }

    res.status(400).json({
      success: false,
      message: 'Invalid type parameter. Use: overview, payments, or dues'
    });

  } catch (error) {
    console.error('Get fees error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching fee data',
      error: error.message
    });
  }
});

// @route   POST /api/admin/fees/structure
// @desc    Create or update fee structure
// @access  Private (Admin only)
router.post('/fees/structure', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    if (process.env.E2E_MODE === 'true') {
      const { class: className, academicYear, feeComponents = {}, paymentSchedule = 'annual' } = req.body || {};
      if (!className || !academicYear) {
        return res.status(400).json({ success: false, message: 'Class and academic year are required' });
      }
      const id = `fs-e2e-${Date.now()}`;
      const totalAmount = Object.values(feeComponents).reduce((sum, v) => sum + Number(v || 0), 0);
      const item = { _id: id, class: className, academicYear, feeComponents, totalAmount, paymentSchedule };
      e2eFeesState.feeStructures.push(item);
      return res.status(201).json({ success: true, message: 'Fee structure saved (E2E)', data: item });
    }
    const {
      class: className,
      academicYear,
      feeComponents,
      paymentSchedule,
      dueDates
    } = req.body;

    // Validate required fields
    if (!className || !academicYear || !feeComponents) {
      return res.status(400).json({
        success: false,
        message: 'Class, academic year, and fee components are required'
      });
    }

    // Check if fee structure already exists
    const existingStructure = await FeeStructure.findOne({
      class: className,
      academicYear,
      isActive: true
    });

    if (existingStructure) {
      // Update existing structure
      existingStructure.feeComponents = feeComponents;
      existingStructure.paymentSchedule = paymentSchedule || existingStructure.paymentSchedule;
      existingStructure.dueDates = dueDates || existingStructure.dueDates;
      existingStructure.updatedBy = req.user._id || req.user.id;
      
      await existingStructure.save();

      return res.json({
        success: true,
        message: 'Fee structure updated successfully',
        data: { feeStructure: existingStructure }
      });
    }

    // Create new fee structure
    const feeStructure = new FeeStructure({
      class: className,
      academicYear,
      feeComponents,
      paymentSchedule: paymentSchedule || 'quarterly',
      dueDates: dueDates || [],
      createdBy: req.user._id || req.user.id
    });

    await feeStructure.save();

    res.status(201).json({
      success: true,
      message: 'Fee structure created successfully',
      data: { feeStructure }
    });

  } catch (error) {
    console.error('Create fee structure error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating fee structure',
      error: error.message
    });
  }
});

// @route   DELETE /api/admin/fees/structure/:id
// @desc    Delete a fee structure
// @access  Private (Admin only)
router.delete('/fees/structure/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    if (process.env.E2E_MODE === 'true') {
      const { id } = req.params;
      e2eFeesState.feeStructures = e2eFeesState.feeStructures.filter(fs => fs._id !== id);
      return res.json({ success: true, message: 'Fee structure deleted (E2E)' });
    }

    const { id } = req.params;
    const structure = await FeeStructure.findById(id);

    if (!structure) {
      return res.status(404).json({
        success: false,
        message: 'Fee structure not found'
      });
    }

    // Check if there are any payments associated with this structure
    const paymentCount = await FeePayment.countDocuments({ feeStructure: id });
    if (paymentCount > 0) {
      // Instead of hard delete, we could mark as inactive
      structure.isActive = false;
      structure.updatedBy = req.user._id || req.user.id;
      await structure.save();
      
      return res.json({
        success: true,
        message: 'Fee structure marked as inactive because it has associated payments'
      });
    }

    await FeeStructure.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Fee structure deleted successfully'
    });

  } catch (error) {
    console.error('Delete fee structure error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting fee structure',
      error: error.message
    });
  }
});

// @route   POST /api/admin/grades
// @desc    Create a grade record
// @access  Private (Admin only)
router.post('/grades', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const {
      // Student identification options (provide at least one)
      student, // ObjectId of Student (optional)
      studentId, // custom studentId (optional)
      admissionNumber, // optional
      email, // student's email (optional)
      // Simplified admin fields for course resolution
      subjectName,        // NEW: human subject name (Course.courseName or Course.name)
      courseName,         // alias to subjectName
      // Legacy/alternative course identification
      course,             // optional ObjectId (still supported)
      courseCode,         // optional code (still supported)
      // Faculty identification
      faculty,            // optional ObjectId (still supported)
      employeeId,         // Faculty Employee ID
      // Grade fields
      assessmentType,
      assessmentName,     // optional; will default
      maxMarks,
      obtainedMarks,
      assessmentDate,     // optional; will default
      academicYear,       // optional
      session,
      remarks,
      isPublished
    } = req.body || {};

    // Validate required grade fields (student resolved below).
    const missing = [];
    // Require at least one student identifier
    if (!email && !student && !studentId && !admissionNumber) missing.push('student identifier (email or student/studentId/admissionNumber)');
    // Accept any of course | courseCode | subjectName | courseName
    if (!course && !courseCode && !subjectName && !courseName) missing.push('subjectName (or courseCode/course/courseName)');
    // Accept either `faculty` (ObjectId) OR `employeeId`
    if (!faculty && !employeeId) missing.push('employeeId (or faculty ObjectId)');
    if (!assessmentType) missing.push('assessmentType');
    if (maxMarks === undefined) missing.push('maxMarks');
    if (obtainedMarks === undefined) missing.push('obtainedMarks');
    if (!session) missing.push('session');
    if (missing.length) {
      return res.status(400).json({ success: false, message: `Missing fields: ${missing.join(', ')}` });
    }

    // Additional validations
    const allowedSessions = ['1', '2'];
    const allowedTypes = ['Quiz', 'Assignment', 'Midterm', 'Final', 'Project', 'Presentation', 'Lab', 'Homework'];
    if (!allowedSessions.includes(String(session))) {
      return res.status(422).json({ success: false, message: 'Session must be \'1\' or \'2\'' });
    }
    if (!allowedTypes.includes(String(assessmentType))) {
      return res.status(422).json({ success: false, message: `assessmentType must be one of: ${allowedTypes.join(', ')}` });
    }

    // Resolve student
    let studentDoc = null;
    if (student) {
      studentDoc = await Student.findById(student);
    }
    if (!studentDoc && (studentId || admissionNumber)) {
      studentDoc = await Student.findOne({
        ...(studentId ? { studentId } : {}),
        ...(admissionNumber ? { admissionNumber } : {})
      });
    }
    if (!studentDoc && email) {
      const userDoc = await User.findOne({
        email: String(email).trim().toLowerCase(),
        role: 'student',
        status: 'active'
      });
      if (userDoc) {
        studentDoc = await Student.findOne({ user: userDoc._id });
      }
    }
    if (!studentDoc) {
      return res.status(404).json({
        success: false,
        message: 'Student not found via provided identifiers (student, studentId, admissionNumber, email).'
      });
    }

    // Helper
    const isValidObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v));
    const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Resolve course: prefer ObjectId, else code, else subjectName/courseName (case-insensitive exact match)
    let courseId = course;
    if (!courseId || !isValidObjectId(courseId)) {
      if (courseCode) {
        const code = String(courseCode).trim().toUpperCase();
        const courseDoc = await Course.findOne({ courseCode: code });
        if (!courseDoc) {
          return res.status(404).json({ success: false, message: `Course not found for courseCode: ${code}` });
        }
        courseId = courseDoc._id;
      } else {
        const name = (subjectName || courseName || '').toString().trim();
        if (!name) {
          return res.status(400).json({ success: false, message: 'Provide subjectName (or courseCode/course/courseName)' });
        }
        const regex = new RegExp(`^${escapeRegExp(name)}$`, 'i');
        const courseDoc = await Course.findOne({ $or: [{ courseName: regex }, { name: regex }] });
        if (!courseDoc) {
          return res.status(404).json({ success: false, message: `Course not found for courseName: ${name}` });
        }
        courseId = courseDoc._id;
      }
    }

    // Resolve faculty by employeeId (or ObjectId)
    let facultyId = faculty;
    if (!facultyId || !isValidObjectId(facultyId)) {
      const empId = (employeeId || faculty)?.toString().trim().toUpperCase();
      if (!empId) {
        return res.status(400).json({ success: false, message: 'Provide faculty (ObjectId) or employeeId' });
      }
      const facultyDoc = await Faculty.findOne({ employeeId: empId });
      if (!facultyDoc) {
        return res.status(404).json({ success: false, message: `Faculty not found for employeeId: ${empId}` });
      }
      facultyId = facultyDoc._id;
    }

    // Prepare numeric and date values with sensible defaults
    const max = Number(maxMarks);
    const obtained = Number(obtainedMarks);
    const finalAssessmentName = assessmentName || `${assessmentType} - ${(subjectName || courseName || courseCode || 'Assessment')}`;
    const assessDate = assessmentDate ? new Date(assessmentDate) : new Date();

    const doc = await Grade.create({
      student: studentDoc._id,
      course: courseId,
      faculty: facultyId,
      assessmentType,
      assessmentName: finalAssessmentName,
      maxMarks: max,
      obtainedMarks: obtained,
      percentage: max > 0 ? (obtained / max) * 100 : undefined,
      assessmentDate: assessDate,
      academicYear,
      session: String(session),
      remarks,
      isPublished: !!isPublished
    });

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const details = error.errors
        ? Object.values(error.errors).map(e => ({ path: e.path, message: e.message }))
        : [{ path: 'unknown', message: error.message }];
      return res.status(422).json({ success: false, message: 'Validation failed', errors: details });
    }
    console.error('Create grade error:', error);
    res.status(500).json({ success: false, message: 'Error creating grade', error: error.message });
  }
});

// @route   GET /api/admin/grades
// @desc    List grades with optional filters
// @access  Private (Admin only)
router.get('/grades', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const {
      student, // Student ObjectId
      studentId,
      admissionNumber,
      email,
      course,
      session,
      academicYear,
      isPublished,
      page = 1,
      limit = 10
    } = req.query || {};

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Resolve student if email/studentId/admissionNumber provided
    let studentIdResolved = student || null;
    if (!studentIdResolved && (studentId || admissionNumber || email)) {
      let studentDoc = null;
      if (studentId || admissionNumber) {
        studentDoc = await Student.findOne({
          ...(studentId ? { studentId } : {}),
          ...(admissionNumber ? { admissionNumber } : {})
        });
      }
      if (!studentDoc && email) {
        const userDoc = await User.findOne({ email: String(email).trim().toLowerCase(), role: 'student', status: 'active' });
        if (userDoc) {
          studentDoc = await Student.findOne({ user: userDoc._id });
        }
      }
      if (studentDoc) studentIdResolved = String(studentDoc._id);
    }

    const match = {
      ...(studentIdResolved ? { student: studentIdResolved } : {}),
      ...(course ? { course } : {}),
      ...(session ? { session } : {}),
      ...(academicYear ? { academicYear } : {}),
      ...(typeof isPublished !== 'undefined' ? { isPublished: String(isPublished) === 'true' } : {}),
    };

    const [grades, totalCount] = await Promise.all([
      Grade.find(match)
        .populate('student', 'rollNumber')
        .populate('course', 'courseName name subject courseCode credits class session')
        .populate('faculty', 'employeeId department')
        .sort({ assessmentDate: -1 })
        .skip(skip)
        .limit(limitNum),
      Grade.countDocuments(match)
    ]);

    res.json({
      success: true,
      data: grades,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.max(1, Math.ceil(totalCount / limitNum)),
        totalItems: totalCount,
        hasNext: pageNum * limitNum < totalCount,
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('List grades error:', error);
    res.status(500).json({ success: false, message: 'Error fetching grades', error: error.message });
  }
});

// @route   POST /api/admin/fees/payment
// @desc    Record fee payment
// @access  Private (Admin only)
router.post('/fees/payment', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    if (process.env.E2E_MODE === 'true') {
      const { studentId = 'e2e-student', feeStructureId, paymentDetails = {}, feeBreakdown = {}, installmentNumber = 1, remarks } = req.body || {};
      if (!feeStructureId || !paymentDetails?.amount) {
        return res.status(400).json({ success: false, message: 'Fee structure ID and amount are required' });
      }
      const payment = {
        _id: `pay-e2e-${Date.now()}`,
        student: { name: 'E2E Student', class: 'N/A', studentId },
        feeStructure: { class: (e2eFeesState.feeStructures.find(fs => fs._id === feeStructureId)?.class) || 'N/A', academicYear: (e2eFeesState.feeStructures.find(fs => fs._id === feeStructureId)?.academicYear) || '' },
        paymentDetails: { receiptNumber: `E2E-${Date.now()}`, ...paymentDetails, paymentDate: paymentDetails.paymentDate || new Date(), status: 'completed' },
        feeBreakdown,
        academicYear: (e2eFeesState.feeStructures.find(fs => fs._id === feeStructureId)?.academicYear) || '',
        installmentNumber,
        remarks,
        processedBy: { name: 'E2E Admin' },
        status: 'completed'
      };
      e2eFeesState.payments.push(payment);
      return res.status(201).json({ success: true, message: 'Payment recorded (E2E)', data: { payment } });
    }
    const {
      studentId,
      feeStructureId,
      paymentDetails,
      feeBreakdown,
      installmentNumber,
      remarks
    } = req.body;

    // Validate required fields
    if (!studentId || !feeStructureId || !paymentDetails || !installmentNumber) {
      return res.status(400).json({
        success: false,
        message: 'Student ID, fee structure ID, payment details, and installment number are required'
      });
    }

    // Verify student and fee structure exist
    const [student, feeStructure] = await Promise.all([
      Student.findById(studentId),
      FeeStructure.findById(feeStructureId)
    ]);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'Fee structure not found'
      });
    }

    // Create payment record
    const payment = new FeePayment({
      student: studentId,
      feeStructure: feeStructureId,
      paymentDetails: {
        ...paymentDetails,
        paymentDate: paymentDetails.paymentDate || new Date()
      },
      feeBreakdown: feeBreakdown || {},
      academicYear: feeStructure.academicYear,
      installmentNumber,
      remarks,
      processedBy: req.user.id
    });

    await payment.save();

    // Update or create fee due record
    const feeDue = await FeeDue.findOne({
      student: studentId,
      feeStructure: feeStructureId,
      installmentNumber,
      academicYear: feeStructure.academicYear
    });

    if (feeDue) {
      feeDue.paidAmount += paymentDetails.amount;
      await feeDue.save();
    }

    // Populate the payment for response
    await payment.populate([
      { path: 'student', select: 'name class studentId' },
      { path: 'feeStructure', select: 'class academicYear' },
      { path: 'processedBy', select: 'name' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: { payment }
    });

  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording payment',
      error: error.message
    });
  }
});

// @route   GET /api/admin/fees/student/:studentId
// @desc    Get fee details for a specific student
// @access  Private (Admin only)
router.get('/fees/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { academicYear } = req.query;

    const currentYear = new Date().getFullYear();
    const yearFilter = academicYear || `${currentYear}-${currentYear + 1}`;

    // Get student details
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get fee structure for student's class
    const feeStructure = await FeeStructure.findOne({
      class: student.class,
      academicYear: yearFilter,
      isActive: true
    });

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'Fee structure not found for this class and academic year'
      });
    }

    // Get payment history and pending dues
    const [payments, dues] = await Promise.all([
      FeePayment.find({ student: studentId, academicYear: yearFilter })
        .populate('feeStructure', 'class')
        .populate('processedBy', 'name')
        .sort({ 'paymentDetails.paymentDate': -1 }),
      
      FeeDue.find({ student: studentId, academicYear: yearFilter })
        .populate('feeStructure', 'class')
        .sort({ dueDate: 1 })
    ]);

    const totalPaid = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.paymentDetails.amount, 0);

    const totalDue = dues
      .filter(d => d.status !== 'paid')
      .reduce((sum, d) => sum + d.remainingAmount, 0);

    res.json({
      success: true,
      data: {
        student: {
          _id: student._id,
          name: student.name,
          class: student.class,
          studentId: student.studentId
        },
        feeStructure,
        payments,
        dues,
        summary: {
          totalPaid,
          totalDue,
          totalFeeAmount: feeStructure.totalAmount
        }
      }
    });

  } catch (error) {
    console.error('Get student fees error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching student fee details',
      error: error.message
    });
  }
});

// @route   GET /api/admin/reports
// @desc    Generate various reports
// @access  Private (Admin only)
router.get('/reports', (req, res) => {
  res.json({
    success: true,
    message: 'Reports endpoint - To be implemented',
    data: {
      endpoint: 'GET /api/admin/reports',
      query_params: ['type', 'class', 'date_from', 'date_to'],
      report_types: ['academic', 'financial', 'attendance', 'enrollment']
    }
  });
});

// @route   POST /api/admin/subjects/simple
// @desc    Create a simple subject (Course) with minimal fields
// @access  Private (Admin only)
router.post('/subjects/simple', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { subjectName, employeeId } = req.body || {};
    if (!subjectName || !employeeId) {
      return res.status(400).json({ success: false, message: 'subjectName and employeeId are required' });
    }

    const name = String(subjectName).trim();
    const emp = String(employeeId).trim().toUpperCase();

    const facultyDoc = await Faculty.findOne({ employeeId: emp });
    if (!facultyDoc) {
      return res.status(404).json({ success: false, message: `Faculty not found for employeeId: ${emp}` });
    }

    // Auto-generate a unique courseCode from subjectName
    const base = name.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'SUBJECT';
    let courseCode = `${base.slice(0, 6)}-${Math.floor(100 + Math.random() * 900)}`;
    for (let attempts = 0; attempts < 5; attempts++) {
      const exists = await Course.findOne({ courseCode });
      if (!exists) break;
      courseCode = `${base.slice(0, 6)}-${Math.floor(100 + Math.random() * 900)}`;
    }

    // Safe defaults to keep the model valid
    const defaults = {
      credits: 4,
      department: 'Mathematics',
      class: '11',
      session: '1',
      isActive: true
    };

    const doc = await Course.create({
      courseCode,
      courseName: name,
      subject: name,
      class: defaults.class,
      faculty: facultyDoc._id
    });

    return res.status(201).json({ success: true, data: doc });
  } catch (error) {
    if (error && error.name === 'ValidationError') {
      const details = error.errors
        ? Object.values(error.errors).map(e => ({ path: e.path, message: e.message }))
        : [{ path: 'unknown', message: error.message }];
      return res.status(422).json({ success: false, message: 'Validation failed', errors: details });
    }
    console.error('Create simple subject error:', error);
    return res.status(500).json({ success: false, message: 'Error creating subject', error: error.message });
  }
});

// Schedules (Timetable management)
router.get('/schedules', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { className, subject, day } = req.query;
    const query = {};
    if (className) query.className = className;
    if (subject) query.subject = subject;
    if (day) query.day = day;

    const items = await Schedule.find(query).sort({ day: 1, startTime: 1 });
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ success: false, message: 'Error fetching schedules', error: error.message });
  }
});

router.post('/schedules', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const {
      className, subject, teacher, room, day, startTime, endTime, duration,
      type = 'regular', description = '', recurring = true, academicYear,
      facultyId, employeeId
    } = req.body;

    if (!className || !subject || !teacher || !day || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Attempt to link to a faculty document when provided
    let linkedFacultyId = null;
    try {
      if (facultyId) {
        const f = await Faculty.findById(facultyId).select('_id');
        if (f) linkedFacultyId = f._id;
      } else if (employeeId) {
        const f = await Faculty.findOne({ employeeId }).select('_id');
        if (f) linkedFacultyId = f._id;
      }
    } catch (e) {
      // Non-fatal: continue without faculty linkage
      console.warn('Faculty linkage error (create schedule):', e.message);
    }

    const schedule = new Schedule({
      className, subject, teacher, room, day, startTime, endTime,
      duration: Number(duration || 0), type, description, recurring: !!recurring,
      academicYear, createdBy: req.user.id,
      ...(linkedFacultyId ? { faculty: linkedFacultyId } : {})
    });
    const saved = await schedule.save();
    res.status(201).json({ success: true, message: 'Schedule created', data: saved });
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ success: false, message: 'Error creating schedule', error: error.message });
  }
});

router.put('/schedules/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const update = { ...req.body };
    if (update.duration !== undefined) update.duration = Number(update.duration);

    // If facultyId or employeeId is provided in the update, resolve and set Schedule.faculty
    if (update.facultyId || update.employeeId) {
      try {
        let fDoc = null;
        if (update.facultyId) {
          fDoc = await Faculty.findById(update.facultyId).select('_id');
        } else if (update.employeeId) {
          fDoc = await Faculty.findOne({ employeeId: update.employeeId }).select('_id');
        }
        if (fDoc) {
          update.faculty = fDoc._id;
        }
        // Do not persist helper keys
        delete update.facultyId;
        delete update.employeeId;
      } catch (e) {
        console.warn('Faculty linkage error (update schedule):', e.message);
      }
    }

    const saved = await Schedule.findByIdAndUpdate(id, update, { new: true });
    if (!saved) return res.status(404).json({ success: false, message: 'Schedule not found' });
    res.json({ success: true, message: 'Schedule updated', data: saved });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ success: false, message: 'Error updating schedule', error: error.message });
  }
});

router.delete('/schedules/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const resDel = await Schedule.findByIdAndDelete(id);
    if (!resDel) return res.status(404).json({ success: false, message: 'Schedule not found' });
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ success: false, message: 'Error deleting schedule', error: error.message });
  }
});

// Assignments (Faculty-course-class assignments)
router.get('/assignments', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { facultyId, employeeId, academicYear, courseId, classId } = req.query;
    const query = {};

    // Resolve employeeId to facultyId if provided
    let resolvedFacultyId = facultyId;
    if (!resolvedFacultyId && employeeId) {
      const facultyDoc = await Faculty.findOne({ employeeId }).select('_id').lean();
      if (facultyDoc) resolvedFacultyId = String(facultyDoc._id);
    }

    if (resolvedFacultyId) query.facultyId = resolvedFacultyId;
    if (academicYear) query.academicYear = academicYear;
    if (courseId) query.courseId = courseId;
    if (classId) query.classId = classId;

    const items = await FacultyAssignment.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ success: false, message: 'Error fetching assignments', error: error.message });
  }
});

router.post('/assignments', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const {
      facultyId,
      employeeId,
      courseId,
      classId,
      session,
      academicYear,
      assignmentType = 'primary',
      startDate,
      endDate,
      workload = 0,
      notes = ''
    } = req.body;

    // Resolve employeeId to facultyId when provided
    let resolvedFacultyId = facultyId;
    if (!resolvedFacultyId && employeeId) {
      const facultyDoc = await Faculty.findOne({ employeeId }).select('_id').lean();
      if (!facultyDoc) {
        return res.status(400).json({ success: false, message: 'Invalid employeeId: faculty not found' });
      }
      resolvedFacultyId = String(facultyDoc._id);
    }

    if (!resolvedFacultyId || !courseId || !classId || !session || !academicYear) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const assignment = new FacultyAssignment({
      facultyId: resolvedFacultyId,
      courseId,
      classId,
      session,
      academicYear,
      assignmentType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      workload: Number(workload || 0),
      notes
    });
    const saved = await assignment.save();
    res.status(201).json({ success: true, message: 'Assignment created', data: saved });
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(500).json({ success: false, message: 'Error creating assignment', error: error.message });
  }
});

router.put('/assignments/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const update = { ...req.body };
    if (update.workload !== undefined) update.workload = Number(update.workload);
    if (update.startDate) update.startDate = new Date(update.startDate);
    if (update.endDate) update.endDate = new Date(update.endDate);
    const saved = await FacultyAssignment.findByIdAndUpdate(id, update, { new: true });
    if (!saved) return res.status(404).json({ success: false, message: 'Assignment not found' });
    res.json({ success: true, message: 'Assignment updated', data: saved });
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({ success: false, message: 'Error updating assignment', error: error.message });
  }
});

router.delete('/assignments/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const resDel = await FacultyAssignment.findByIdAndDelete(id);
    if (!resDel) return res.status(404).json({ success: false, message: 'Assignment not found' });
    res.json({ success: true, message: 'Assignment deleted' });
  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({ success: false, message: 'Error deleting assignment', error: error.message });
  }
});

module.exports = router;