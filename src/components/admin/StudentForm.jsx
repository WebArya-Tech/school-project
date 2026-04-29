import React, { useState } from 'react';
import config from '../../config/config.js';
import './StudentForm.css';

const StudentForm = ({ student = null, onSubmit, onCancel }) => {
  // Extract and format student data for pre-filling form
  const getInitialFormData = () => {
    if (!student) {
      return {
        name: '',
        email: '',
        phone: '',
        rollNumber: '',
        class: '',
        section: '',
        dateOfBirth: '',
        gender: '',
        fatherName: '',
        motherName: '',
        guardianPhone: '',
        address: '',
        admissionDate: '',
        bloodGroup: '',
        emergencyContact: ''
      };
    }

    // Combine firstName and lastName into full name
    const fullName = `${student.user?.firstName || ''} ${student.user?.lastName || ''}`.trim();
    
    // Format date fields (convert from ISO string to YYYY-MM-DD format for input)
    const formatDate = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    };

    // Map backend class values (e.g., '1') to frontend display values (e.g., '1st')
    const frontendClassMap = {
      '1': '1st', '2': '2nd', '3': '3rd', '4': '4th', '5': '5th',
      '6': '6th', '7': '7th', '8': '8th', '9': '9th', '10': '10th',
      '11': '11th', '12': '12th',
      'NS': 'NS', 'LKG': 'LKG', 'UKG': 'UKG'
    };
    const mappedClass = frontendClassMap[student.class] || student.class || '';

    const validGenders = ['male', 'female', 'other'];
    const mappedGender = student.user?.gender && validGenders.includes(student.user.gender) ? student.user.gender : '';

    console.log('Student data received in getInitialFormData:', student);
    console.log('User data:', student.user);
    console.log('Date of Birth:', student.user?.dateOfBirth);
    console.log('Gender:', student.user?.gender);
    console.log('Address:', student.user?.address?.street);
    console.log('Emergency Contact Phone:', student.user?.emergencyContact?.phone);

    return {
      name: fullName,
      email: student.user?.email || '',
      phone: student.user?.phone || '',
      rollNumber: student.rollNumber || '',
      class: mappedClass,
      section: student.section || '',
      dateOfBirth: formatDate(student.user?.dateOfBirth),
      gender: mappedGender,
      fatherName: student.father?.name || '',
      motherName: student.mother?.name || '',
      guardianPhone: student.father?.phone || student.guardian?.phone || '',
      address: student.user?.address?.street || '',
      admissionDate: formatDate(student.admissionDate),
      bloodGroup: student.medicalInfo?.bloodGroup || '',
      emergencyContact: student.user?.emergencyContact?.phone || ''
    };
  };

  const [formData, setFormData] = useState(getInitialFormData());

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Required fields for adding student
    if (!formData.name.trim()) newErrors.name = 'Full Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required';
    else if (!/^[0-9]{10}$/.test(formData.phone.trim())) newErrors.phone = 'Enter a valid 10-digit phone';
    if (!formData.class.trim()) newErrors.class = 'Grade is required';
    if (!formData.section.trim()) newErrors.section = 'Section is required';
    if (!formData.fatherName.trim()) newErrors.fatherName = 'Parent/Guardian Name is required';
    if (!formData.guardianPhone.trim()) newErrors.guardianPhone = 'Guardian Phone is required';
    else if (!/^[0-9]{10}$/.test(formData.guardianPhone.trim())) newErrors.guardianPhone = 'Enter a valid 10-digit phone';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  return (
    <div className="student-form-overlay">
      <div className="student-form-container">
        <div className="student-form-header">
          <h2>{student ? 'Edit Student' : 'Add New Student'}</h2>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="student-form">
          <div className="form-section">
            <h3>Personal Information</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">Full Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={errors.name ? 'error' : ''}
                  placeholder="Enter full name"
                />
                {errors.name && <span className="error-message">{errors.name}</span>}
              </div>
              
              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={errors.email ? 'error' : ''}
                  placeholder="Enter email address"
                />
                {errors.email && <span className="error-message">{errors.email}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="phone">Phone *</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={errors.phone ? 'error' : ''}
                  placeholder="Enter 10-digit phone number"
                />
                {errors.phone && <span className="error-message">{errors.phone}</span>}
              </div>
              
              <div className="form-group">
                <label htmlFor="dateOfBirth">Date of Birth</label>
                <input
                  type="date"
                  id="dateOfBirth"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="gender">Gender</label>
                <select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                {errors.gender && <span className="error-message">{errors.gender}</span>}
              </div>
              
              <div className="form-group">
                <label htmlFor="bloodGroup">Blood Group</label>
                <select
                  id="bloodGroup"
                  name="bloodGroup"
                  value={formData.bloodGroup}
                  onChange={handleChange}
                >
                  <option value="">Select Blood Group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Academic Information</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="rollNumber">Roll Number</label>
                <input
                  type="text"
                  id="rollNumber"
                  name="rollNumber"
                  value={formData.rollNumber}
                  onChange={handleChange}
                  placeholder="Enter roll number"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="class">Applying for Grade *</label>
                <select
                  id="class"
                  name="class"
                  value={formData.class}
                  onChange={handleChange}
                  className={errors.class ? 'error' : ''}
                >
                  <option value="">Select Class</option>
                  {config.CLASS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {errors.class && <span className="error-message">{errors.class}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="section">Section *</label>
                <select
                  id="section"
                  name="section"
                  value={formData.section}
                  onChange={handleChange}
                  className={errors.section ? 'error' : ''}
                >
                  <option value="">Select Section</option>
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="C">Section C</option>
                  <option value="D">Section D</option>
                </select>
                {errors.section && <span className="error-message">{errors.section}</span>}
              </div>
              
              <div className="form-group">
                <label htmlFor="admissionDate">Admission Date</label>
                <input
                  type="date"
                  id="admissionDate"
                  name="admissionDate"
                  value={formData.admissionDate}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Guardian Information</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="fatherName">Parent/Guardian Name *</label>
                <input
                  type="text"
                  id="fatherName"
                  name="fatherName"
                  value={formData.fatherName}
                  onChange={handleChange}
                  className={errors.fatherName ? 'error' : ''}
                  placeholder="Enter parent/guardian name"
                />
                {errors.fatherName && <span className="error-message">{errors.fatherName}</span>}
              </div>
              
              <div className="form-group">
                <label htmlFor="motherName">Mother's Name</label>
                <input
                  type="text"
                  id="motherName"
                  name="motherName"
                  value={formData.motherName}
                  onChange={handleChange}
                  placeholder="Enter mother's name"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="guardianPhone">Guardian Phone *</label>
                <input
                  type="tel"
                  id="guardianPhone"
                  name="guardianPhone"
                  value={formData.guardianPhone}
                  onChange={handleChange}
                  className={errors.guardianPhone ? 'error' : ''}
                  placeholder="Enter 10-digit guardian phone"
                />
                {errors.guardianPhone && <span className="error-message">{errors.guardianPhone}</span>}
              </div>
              
              <div className="form-group">
                <label htmlFor="emergencyContact">Emergency Contact</label>
                <input
                  type="tel"
                  id="emergencyContact"
                  name="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={handleChange}
                  placeholder="Enter emergency contact"
                />
              </div>
            </div>

            <div className="form-group full-width">
              <label htmlFor="address">Address *</label>
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows="3"
                className={errors.address ? 'error' : ''}
                placeholder="Enter complete address"
              />
              {errors.address && <span className="error-message">{errors.address}</span>}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-submit">
              {student ? 'Update Student' : 'Add Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentForm;