const mongoose = require('mongoose');

// Fee Structure Schema
const feeStructureSchema = new mongoose.Schema({
  class: {
    type: String,
    required: true,
    enum: ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
  },
  academicYear: {
    type: String,
    required: true,
    match: /^\d{4}-\d{4}$/
  },
  feeComponents: {
    tuitionFee: {
      type: Number,
      required: true,
      min: 0
    },
    admissionFee: {
      type: Number,
      default: 0,
      min: 0
    },
    developmentFee: {
      type: Number,
      default: 0,
      min: 0
    },
    examFee: {
      type: Number,
      default: 0,
      min: 0
    },
    libraryFee: {
      type: Number,
      default: 0,
      min: 0
    },
    sportsFee: {
      type: Number,
      default: 0,
      min: 0
    },
    transportFee: {
      type: Number,
      default: 0,
      min: 0
    },
    uniformFee: {
      type: Number,
      default: 0,
      min: 0
    },
    booksFee: {
      type: Number,
      default: 0,
      min: 0
    },
    miscellaneousFee: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  paymentSchedule: {
    type: String,
    enum: ['monthly', 'quarterly', 'half_yearly', 'yearly'],
    default: 'quarterly'
  },
  dueDates: [{
    installmentNumber: Number,
    dueDate: Date,
    amount: Number
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Fee Payment Schema
const feePaymentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  feeStructure: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeStructure',
    required: true
  },
  paymentDetails: {
    receiptNumber: {
      type: String,
      unique: true,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'cheque', 'online', 'bank_transfer', 'card'],
      required: true
    },
    transactionId: String,
    chequeNumber: String,
    bankName: String,
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now
    }
  },
  feeBreakdown: {
    tuitionFee: { type: Number, default: 0 },
    admissionFee: { type: Number, default: 0 },
    developmentFee: { type: Number, default: 0 },
    examFee: { type: Number, default: 0 },
    libraryFee: { type: Number, default: 0 },
    sportsFee: { type: Number, default: 0 },
    transportFee: { type: Number, default: 0 },
    uniformFee: { type: Number, default: 0 },
    booksFee: { type: Number, default: 0 },
    miscellaneousFee: { type: Number, default: 0 },
    lateFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 }
  },
  academicYear: {
    type: String,
    required: true
  },
  installmentNumber: {
    type: Number,
    required: true
  },
  installmentName: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'completed'
  },
  remarks: String,
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  refundDetails: {
    refundAmount: Number,
    refundDate: Date,
    refundReason: String,
    refundMethod: String,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true
});

// Fee Due Schema
const feeDueSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  feeStructure: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeStructure',
    required: true
  },
  academicYear: {
    type: String,
    required: true
  },
  installmentNumber: {
    type: Number,
    required: true
  },
  installmentName: {
    type: String,
    default: ''
  },
  dueDate: {
    type: Date,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'overdue'],
    default: 'pending'
  },
  lateFee: {
    type: Number,
    default: 0,
    min: 0
  },
  lastReminderSent: Date,
  reminderCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better performance
feeStructureSchema.index({ class: 1, academicYear: 1 });
feeStructureSchema.index({ isActive: 1 });

feePaymentSchema.index({ student: 1, academicYear: 1 });
// Removed explicit receiptNumber index to avoid duplication with unique: true on field
feePaymentSchema.index({ 'paymentDetails.paymentDate': 1 });
feePaymentSchema.index({ status: 1 });

feeDueSchema.index({ student: 1, academicYear: 1 });
feeDueSchema.index({ dueDate: 1 });
feeDueSchema.index({ status: 1 });

// Virtual for total fee amount
feeStructureSchema.virtual('totalAmount').get(function() {
  const components = this.feeComponents;
  return Object.values(components).reduce((total, amount) => total + (amount || 0), 0);
});

// Virtual for remaining amount in fee due
feeDueSchema.virtual('remainingAmount').get(function() {
  return Math.max(0, this.amount - this.paidAmount);
});

// Pre-save middleware to generate receipt number
feePaymentSchema.pre('validate', async function(next) {
  if (this.isNew && !this.paymentDetails.receiptNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments({
      'paymentDetails.paymentDate': {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1)
      }
    });
    this.paymentDetails.receiptNumber = `RCP${year}${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Pre-save middleware to update fee due status
feeDueSchema.pre('save', function(next) {
  if (this.paidAmount >= this.amount) {
    this.status = 'paid';
  } else if (this.paidAmount > 0) {
    this.status = 'partial';
  } else if (new Date() > this.dueDate) {
    this.status = 'overdue';
  } else {
    this.status = 'pending';
  }
  next();
});

// Static methods
feeStructureSchema.statics.findByClassAndYear = function(className, academicYear) {
  return this.findOne({ class: className, academicYear, isActive: true });
};

feePaymentSchema.statics.getPaymentHistory = function(studentId, academicYear) {
  return this.find({ student: studentId, academicYear })
    .populate('feeStructure')
    .sort({ 'paymentDetails.paymentDate': -1 });
};

feeDueSchema.statics.getPendingDues = function(studentId, academicYear) {
  return this.find({ 
    student: studentId, 
    academicYear,
    status: { $in: ['pending', 'partial', 'overdue'] }
  }).populate('feeStructure');
};

// Instance methods
feePaymentSchema.methods.generateReceipt = function() {
  return {
    receiptNumber: this.paymentDetails.receiptNumber,
    studentName: this.student.name,
    amount: this.paymentDetails.amount,
    paymentDate: this.paymentDetails.paymentDate,
    paymentMethod: this.paymentDetails.paymentMethod,
    feeBreakdown: this.feeBreakdown,
    academicYear: this.academicYear
  };
};

const FeeStructure = mongoose.model('FeeStructure', feeStructureSchema);
const FeePayment = mongoose.model('FeePayment', feePaymentSchema);
const FeeDue = mongoose.model('FeeDue', feeDueSchema);

module.exports = {
  FeeStructure,
  FeePayment,
  FeeDue
};
