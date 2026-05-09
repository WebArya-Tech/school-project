const mongoose = require('mongoose');
const Counter = require('./Counter');

const studentSchema = new mongoose.Schema({
  // Reference to User model
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    unique: true
  },
  
  // Student Identification
  studentId: {
    type: String,
    required: [true, 'Student ID is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  rollNumber: {
    type: String,
    required: [true, 'Roll number is required'],
    trim: true
  },
  
  // Academic Information
  class: {
    type: String,
    required: [true, 'Class is required'],
    enum: ['NS', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
  },
  section: {
    type: String,
    required: [true, 'Section is required'],
    trim: true,
    uppercase: true,
    maxlength: [2, 'Section cannot exceed 2 characters']
  },
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    match: [/^\d{4}-\d{4}$/, 'Academic year must be in format YYYY-YYYY']
  },
  
  // Admission Information
  admissionDate: {
    type: Date,
    required: [true, 'Admission date is required']
  },
  admissionNumber: {
    type: String,
    required: [true, 'Admission number is required'],
    unique: true,
    trim: true
  },
  previousSchool: {
    name: { type: String, trim: true },
    address: { type: String, trim: true },
    lastClass: { type: String, trim: true },
    tcNumber: { type: String, trim: true }, // Transfer Certificate Number
    tcDate: { type: Date }
  },
  
  // Parent/Guardian Information
  father: {
    name: { type: String, required: true, trim: true },
    occupation: { type: String, trim: true },
    phone: { 
      type: String, 
      required: true,
      match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
    },
    email: { 
      type: String, 
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    income: { type: Number, min: 0 }
  },
  mother: {
    name: { type: String, required: true, trim: true },
    occupation: { type: String, trim: true },
    phone: { 
      type: String,
      match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
    },
    email: { 
      type: String, 
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    }
  },
  guardian: {
    name: { type: String, trim: true },
    relationship: { type: String, trim: true },
    phone: { 
      type: String,
      match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
    },
    email: { 
      type: String, 
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    }
  },
  
  // Medical Information
  medicalInfo: {
    bloodGroup: { 
      type: String, 
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
    },
    allergies: [{ type: String, trim: true }],
    medications: [{ type: String, trim: true }],
    medicalConditions: [{ type: String, trim: true }],
    doctorName: { type: String, trim: true },
    doctorPhone: { 
      type: String,
      match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
    }
  },
  
  // Academic Performance
  currentGPA: {
    type: Number,
    min: 0,
    max: 10,
    default: 0
  },
  overallAttendance: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  // Fee Information
  feeStructure: {
    admissionFee: { type: Number, default: 0 },
    tuitionFee: { type: Number, default: 0 },
    examFee: { type: Number, default: 0 },
    libraryFee: { type: Number, default: 0 },
    sportsFee: { type: Number, default: 0 },
    transportFee: { type: Number, default: 0 },
    otherFees: { type: Number, default: 0 }
  },
  feeStatus: {
    type: String,
    enum: ['paid', 'pending', 'overdue', 'partial'],
    default: 'pending'
  },
  
  // Transport Information
  transport: {
    required: { type: Boolean, default: false },
    routeNumber: { type: String, trim: true },
    pickupPoint: { type: String, trim: true },
    dropPoint: { type: String, trim: true }
  },
  
  // Documents
  documents: {
    birthCertificate: { type: String }, // File path
    transferCertificate: { type: String }, // File path
    marksheet: { type: String }, // File path
    photograph: { type: String }, // File path
    aadharCard: { type: String }, // File path
    casteCertificate: { type: String }, // File path
    incomeCertificate: { type: String } // File path
  },
  
  // Status and Flags
  status: {
    type: String,
    enum: ['active', 'inactive', 'transferred', 'graduated', 'suspended'],
    default: 'active'
  },
  isPromoted: {
    type: Boolean,
    default: false
  },
  
  // Additional Information
  hobbies: [{ type: String, trim: true }],
  achievements: [{
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    date: { type: Date },
    category: { 
      type: String, 
      enum: ['academic', 'sports', 'cultural', 'other'] 
    }
  }],
  
  // Disciplinary Records
  disciplinaryRecords: [{
    date: { type: Date, required: true },
    incident: { type: String, required: true, trim: true },
    action: { type: String, required: true, trim: true },
    reportedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    }
  }],

  // Promotion History — appended each time admin promotes the student
  promotionHistory: [{
    fromClass: { type: String, trim: true },
    toClass: { type: String, trim: true },
    fromAcademicYear: { type: String, trim: true },
    toAcademicYear: { type: String, trim: true },
    promotedAt: { type: Date, default: Date.now },
    promotedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    remarks: { type: String, trim: true }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total fee amount
studentSchema.virtual('totalFeeAmount').get(function() {
  const fees = this.feeStructure;
  return fees.admissionFee + fees.tuitionFee + fees.examFee + 
         fees.libraryFee + fees.sportsFee + fees.transportFee + fees.otherFees;
});

// Virtual for age calculation
studentSchema.virtual('age').get(function() {
  if (!this.user || !this.user.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.user.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Indexes for better query performance
// Removed explicit studentId index to avoid duplication with unique: true on field
studentSchema.index({ class: 1, section: 1 });
studentSchema.index({ academicYear: 1 });
// Removed explicit admissionNumber index to avoid duplication with unique: true on field
// studentSchema.index({ admissionNumber: 1 });
studentSchema.index({ status: 1 });
studentSchema.index({ 'father.phone': 1 });
studentSchema.index({ 'mother.phone': 1 });

// Generate student ID BEFORE validation so the required check passes
studentSchema.pre('validate', async function(next) {
  if (this.isNew && !this.studentId) {
    try {
      const yearSuffix = (new Date().getFullYear()).toString().slice(-2);
      const key = `studentId:${this.academicYear}`;

      // Seed counter from current max for this academic year if it doesn't exist
      let counterDoc = await Counter.findOne({ key });
      if (!counterDoc) {
        const prefix = `STU${yearSuffix}`;
        const existing = await this.constructor.find({ academicYear: this.academicYear, studentId: { $regex: `^${prefix}\\d{4}$` } })
          .select('studentId')
          .sort({ studentId: -1 })
          .limit(1);
        let maxSeq = 0;
        if (existing && existing.length > 0) {
          const tail = existing[0].studentId.slice(prefix.length);
          const parsed = parseInt(tail, 10);
          if (!isNaN(parsed)) maxSeq = parsed;
        }
        // Create counter with maxSeq to preserve continuity
        counterDoc = await Counter.findOneAndUpdate(
          { key },
          { $setOnInsert: { seq: maxSeq } },
          { new: true, upsert: true }
        );
      }

      // Atomically get next sequence
      const nextSeq = await Counter.next(key);
      this.studentId = `STU${yearSuffix}${String(nextSeq).padStart(4, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Static method to find students by class and section
studentSchema.statics.findByClassSection = function(className, section) {
  return this.find({ 
    class: className, 
    section: section, 
    status: 'active' 
  }).populate('user', 'firstName lastName email phone');
};

// Static method to find students by academic year
studentSchema.statics.findByAcademicYear = function(year) {
  return this.find({ 
    academicYear: year, 
    status: 'active' 
  }).populate('user', 'firstName lastName email phone');
};

// Instance method to calculate attendance percentage
studentSchema.methods.calculateAttendance = async function() {
  // This would typically involve querying attendance records
  // For now, return the stored value
  return this.overallAttendance;
};

// Instance method to get fee summary
studentSchema.methods.getFeeSummary = function() {
  return {
    totalAmount: this.totalFeeAmount,
    status: this.feeStatus,
    breakdown: this.feeStructure
  };
};

module.exports = mongoose.model('Student', studentSchema);