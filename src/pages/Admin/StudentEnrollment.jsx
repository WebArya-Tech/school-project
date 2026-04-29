import React, { useEffect, useState } from 'react';
import api, { adminAPI } from '../../services/api.js';
import config from '../../config/config.js';
import StudentForm from '../../components/admin/StudentForm';
import { useNotification } from '../../components/Notification';
import './StudentEnrollment.css';

// Minimal implementation aligned with tests in src/tests/StudentEnrollment.test.js
const StudentEnrollment = () => {
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [waitlists, setWaitlists] = useState([]);
  const [view, setView] = useState('students');
  const [classFilter, setClassFilter] = useState('All Classes');
  const [search, setSearch] = useState('');

  const [selectedAdmission, setSelectedAdmission] = useState(null);
  const [showProcessModal, setShowProcessModal] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      let studentsRes, admissionsRes;

      if (config.IS_E2E) {
        [studentsRes, admissionsRes] = await Promise.all([
          adminAPI.getStudents({ params: { page: 1, limit: 50 } }),
          api.get('/e2e/admissions')
        ]);
      } else {
        [studentsRes] = await Promise.all([
          adminAPI.getStudents({ params: { page: 1, limit: 50 } })
        ]);
        try {
          admissionsRes = await adminAPI.getAdmissions({ params: { status: 'submitted', limit: 50 } });
        } catch (admErr) {
          console.warn('Admin admissions fetch failed:', admErr);
        }
      }

      // Students (admin list API returns transformed data)
      const studentsData = studentsRes?.data?.data?.students || [];
      const mappedStudents = studentsData.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        studentId: s.studentId || s.admissionNumber || '-',
        department: s.department || '-',
        year: s.year || '-',
        gpa: s.gpa || null
      }));

      // Admissions mapped into local waitlist view
      let mappedWaitlists = [];
      if (admissionsRes) {
        const admissionsData = config.IS_E2E
          ? (Array.isArray(admissionsRes?.data?.data)
              ? admissionsRes.data.data
              : (Array.isArray(admissionsRes?.data) ? admissionsRes.data : []))
          : (Array.isArray(admissionsRes?.data?.data?.admissions)
              ? admissionsRes.data.data.admissions
              : []);

        mappedWaitlists = (admissionsData || []).map(app => ({
          id: app._id || app.id || app.applicationNumber,
          applicantName: app?.studentInfo?.name || app?.studentInfo?.fullName || '-',
          applyingClass: app?.academicInfo?.applyingForClass || '-',
          applicationNumber: app?.applicationNumber || '-',
          status: app?.status || 'submitted',
          receivedAt: app?.submittedAt || app?.createdAt || null,
          processed: app?.status === 'approved',
          rawData: app // Keep original data for processing
        }));
      }

      setStudents(mappedStudents);
      setEnrollments([]);
      setWaitlists(mappedWaitlists);
    } catch (err) {
      console.error('Enrollment data fetch error:', err);
      setError(err.userMessage || 'Failed to load enrollment data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Courses enrollment actions removed

  const processWaitlist = (wl) => {
    const app = wl.rawData;
    // Map admission data to what StudentForm expects as a "student" prop
    // StudentForm.jsx uses:
    // name: fullName (from user.firstName + user.lastName)
    // email: student.user?.email
    // phone: student.user?.phone
    // etc.
    const mappedStudent = {
      _id: app._id,
      admissionId: app._id,
      user: {
        firstName: app.studentInfo?.fullName?.split(' ')[0] || '',
        lastName: app.studentInfo?.fullName?.split(' ').slice(1).join(' ') || '',
        email: app.contactInfo?.email || '',
        phone: app.contactInfo?.phone || '',
        gender: app.studentInfo?.gender || 'other',
        dateOfBirth: app.studentInfo?.dateOfBirth || '2005-01-01',
        address: { street: app.contactInfo?.address?.street || '' }
      },
      father: {
        name: app.parentInfo?.father?.name || app.parentName || '',
        phone: app.parentInfo?.father?.phone || app.contactInfo?.phone || ''
      },
      mother: {
        name: app.parentInfo?.mother?.name || ''
      },
      guardian: {
        name: app.parentInfo?.father?.name || app.parentName || 'Guardian',
        phone: app.parentInfo?.father?.phone || app.contactInfo?.phone || ''
      },
      class: app.academicInfo?.applyingForClass || '',
      admissionDate: app.createdAt || new Date(),
      medicalInfo: {
        bloodGroup: ''
      }
    };
    setSelectedAdmission(mappedStudent);
    setShowProcessModal(true);
  };

  const handleProcessSubmit = async (formData) => {
    try {
      setLoading(true);
      
      // Ensure all required fields for the backend are present in the top-level
      const payload = {
        ...formData,
        // The form nested structure might need flattening for the backend /students endpoint
        name: formData.name || `${formData.user?.firstName || ''} ${formData.user?.lastName || ''}`.trim(),
        email: formData.email || formData.user?.email,
        phone: formData.phone || formData.user?.phone,
        gender: formData.gender || formData.user?.gender,
        dateOfBirth: formData.dateOfBirth || formData.user?.dateOfBirth,
        address: formData.address || formData.user?.address?.street || '',
        fatherName: formData.fatherName || formData.father?.name,
        motherName: formData.motherName || formData.mother?.name,
        guardianPhone: formData.guardianPhone || formData.guardian?.phone,
        // Ensure class is named 'class' as expected by backend destructured req.body
        class: formData.class
      };

      // 1. Create the student
      const studentRes = await adminAPI.addStudent(payload);
      
      if (studentRes.data?.success) {
        // 2. Mark admission as approved
        if (selectedAdmission.admissionId) {
          await adminAPI.approveAdmission(selectedAdmission.admissionId, {
            remarks: 'Student enrolled successfully',
            assignedClass: formData.class,
            assignedSection: formData.section
          });
        }
        
        showSuccess('Student enrolled successfully!');
        setShowProcessModal(false);
        setSelectedAdmission(null);
        fetchData(); // Refresh lists
      }
    } catch (err) {
      console.error('Processing error:', err);
      showError(err.userMessage || 'Failed to process enrollment');
    } finally {
      setLoading(false);
    }
  };

  const removeFromWaitlist = async (wl) => {
    if (!window.confirm('Are you sure you want to remove this application?')) return;
    try {
      setLoading(true);
      await adminAPI.rejectAdmission(wl.id, { reason: 'Withdrawn by Admin' });
      showSuccess('Application removed');
      fetchData();
    } catch (err) {
      showError(err.userMessage || 'Failed to remove application');
    } finally {
      setLoading(false);
    }
  };

  // Metrics derived directly in render

  return (
    <div className="enroll-container">
      <h1 className="enroll-title">Student Enrollment Management</h1>

      {loading && <div>Loading enrollment data...</div>}
      {error && !loading && (
        <div style={{ color: 'red', marginBottom: 12 }}>Error: {error}</div>
      )}

      {!loading && (
        <>
          <div className="metrics">
            <div className="metric">
              <span className="metric-label">Total Students</span>
              <span className="metric-value">{students.length}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Active Enrollments</span>
              <span className="metric-value">{enrollments.length}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Waitlisted Students</span>
              <span className="metric-value">{waitlists.length}</span>
            </div>
          </div>

          <div className="filters">
            <select value={view} onChange={(e) => setView(e.target.value)}>
              <option value="students">Student</option>
              <option value="waitlist">Waitlist</option>
              <option value="analytics">Analytics</option>
            </select>

            {view === 'students' && (
              <>
                <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                  <option>All Classes</option>
                  {config.CLASS_OPTIONS?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <input
                  className="search-input"
                  placeholder="Search Student..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </>
            )}

            {/* Courses filter removed */}
          </div>

          {/* Student Management view */}
          {view === 'students' && (
            <div>
              <h2>Student Management</h2>
              <div className="card-grid">
                {students
                  .filter(s => (
                    classFilter === 'All Classes' || s.year === classFilter || s.class === classFilter
                  ))
                  .filter(s => (
                    search ? (s.name?.toLowerCase().includes(search.toLowerCase()) || s.studentId?.toLowerCase().includes(search.toLowerCase())) : true
                  ))
                  .map((s, idx) => (
                    <div key={s.id || s.studentId || s.email || idx} className="course-card">
                      <div className="card-header">
                        <strong>{s.name}</strong>
                        <span className="status-badge active">STUDENT</span>
                      </div>
                      <div className="card-sub">ID: {s.studentId} • {s.department} • {s.year || '-'}</div>
                      <div className="card-sub">{s.email}</div>
                    </div>
                  ))}
                {students.length === 0 && (
                  <div style={{ color: '#666' }}>No students found.</div>
                )}
              </div>
            </div>
          )}

          {/* Waitlist view */}
          {view === 'waitlist' && (
            <div>
              <h2>Waitlist Management</h2>
              <div className="card-grid">
                {waitlists.length === 0 && (
                  <div style={{ color: '#666' }}>No waitlisted applications yet.</div>
                )}
                {waitlists.map((wl) => (
                  <div key={wl.id} className="course-card">
                    <div className="card-header">
                      <strong>{wl.applicantName}</strong>
                      <span className={`status-badge ${wl.processed ? 'approved' : 'submitted'}`}>{(wl.status || 'submitted').toUpperCase()}</span>
                    </div>
                    <div className="card-sub">Application #{wl.applicationNumber}</div>
                    <div className="card-sub">Class: {wl.applyingClass}</div>
                    {wl.receivedAt && <div className="card-sub">Received: {new Date(wl.receivedAt).toLocaleString()}</div>}
                    <div className="card-actions">
                      <button onClick={() => processWaitlist(wl)}>Process</button>
                      <button onClick={() => removeFromWaitlist(wl)} className="secondary">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analytics view */}
          {view === 'analytics' && (
            <div>
              <h2>Enrollment Analytics</h2>
              <div style={{ marginTop: 12, marginBottom: 8, fontWeight: 600 }}>Enrollment by Classes</div>
              {(() => {
                const counts = students.reduce((acc, s) => {
                  const key = s.year || s.class || 'Unknown';
                  acc[key] = (acc[key] || 0) + 1;
                  return acc;
                }, {});
                const entries = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
                const max = Math.max(1, ...entries.map(([_, c]) => c));
                return (
                  <div>
                    {entries.length === 0 && (
                      <div style={{ color: '#666' }}>No enrollment data available.</div>
                    )}
                    {entries.map(([cls, count]) => (
                      <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '6px 0' }}>
                        <div style={{ width: 120 }}>{cls}</div>
                        <div style={{ flex: 1, background: '#eef2ff', height: 12, position: 'relative' }}>
                          <div style={{ width: `${(count / max) * 100}%`, height: '100%', background: '#3b82f6' }}></div>
                        </div>
                        <div style={{ width: 36, textAlign: 'right' }}>{count}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Enrollment Processing Modal */}
          {showProcessModal && (
            <StudentForm
              student={selectedAdmission}
              onSubmit={handleProcessSubmit}
              onCancel={() => {
                setShowProcessModal(false);
                setSelectedAdmission(null);
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

export default StudentEnrollment;