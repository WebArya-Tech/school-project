import React, { useState, useEffect } from 'react';
import { useLoading } from '../../hooks/useLoading';
import { useNotification } from '../../hooks/useNotification';
import { adminAPI, subjectAPI } from '../../services/api.js';
import './FacultyAssignment.css';

const FacultyAssignment = () => {
  const { loading, setLoading } = useLoading();
  const { showNotification } = useNotification();
  const [assignments, setAssignments] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [filterFaculty, setFilterFaculty] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [viewMode, setViewMode] = useState('assignments'); // 'assignments', 'faculty', 'courses'

  const [formData, setFormData] = useState({
    employeeId: '',
    academicYear: '',
    assignmentType: 'primary', // primary, secondary, substitute
    startDate: '',
    endDate: '',
    workload: '',
    notes: ''
  });

  const departments = [
    'Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
    'English', 'Social Studies'
  ];

  const sessions = ['1', '2'];
  const currentYear = new Date().getFullYear();
  const academicYears = [
    `${currentYear}-${currentYear + 1}`,
    `${currentYear + 1}-${currentYear + 2}`,
    `${currentYear - 1}-${currentYear}`
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [facultyRes, subjectsRes, schedulesRes, assignmentsRes] = await Promise.all([
        adminAPI.getFaculty({ retry: true, params: { page: 1, limit: 100 } }),
        subjectAPI.getSubjects({ retry: true, params: { page: 1, limit: 100 } }),
        adminAPI.getSchedules({ retry: true }),
        adminAPI.getAssignments({ retry: true })
      ]);

      // Extract arrays from varied response shapes
      const facultyData = facultyRes.data?.data?.faculty 
        || facultyRes.data?.faculty 
        || facultyRes.data?.data 
        || facultyRes.data 
        || [];
      const coursesData = subjectsRes.data?.data?.subjects 
        || subjectsRes.data?.subjects 
        || subjectsRes.data?.data 
        || subjectsRes.data 
        || [];
      const scheduleItems = schedulesRes.data?.data 
        || schedulesRes.data 
        || [];
      const assignmentsData = assignmentsRes.data?.data 
        || assignmentsRes.data 
        || [];

      // Normalize for local usage
      const normalizedFaculty = (facultyData || []).map(f => ({
        id: f._id || f.id,
        name: `${f.firstName || f.name || ''} ${f.lastName || ''}`.trim(),
        email: f.email,
        department: f.department,
        designation: f.designation,
        specialization: f.specialization || '',
        maxWorkload: f.maxWorkload || 16,
        employeeId: f.employeeId || f.employeeID || f.empId || f.employeeCode || ''
      }));

      const normalizedCourses = (coursesData || []).map(c => ({
        id: c._id || c.id,
        code: c.subjectCode || c.code,
        name: c.subjectName || c.name,
        department: c.department,
        credits: c.credits || 0
      }));

      // Build unique classes from schedules (admin-accessible)
      const classNameSet = new Set(
        (scheduleItems || [])
          .map(it => it.className)
          .filter(Boolean)
      );
      const normalizedClasses = Array.from(classNameSet).map(name => ({
        id: name,
        name
      }));

      const normalizedAssignments = (assignmentsData || []).map(a => {
        const facultyObj = a.faculty || normalizedFaculty.find(f => f.id === (a.facultyId || a.faculty?._id)) || { name: 'Unknown', department: 'N/A' };
        const courseObj = a.course || normalizedCourses.find(c => c.id === (a.courseId || a.course?._id)) || { id: a.courseId || 'GENERAL', code: '-', name: 'General' };
        const classObj = a.class || normalizedClasses.find(cl => cl.id === (a.classId || a.class?._id)) || { id: a.classId || 'GENERAL', name: 'General' };

        return {
          id: a._id || a.id,
          facultyId: a.facultyId || a.faculty?._id,
          courseId: a.courseId || a.course?._id,
          classId: a.classId || a.class?._id,
          session: (a.session?.toString?.() || a.session || a.semester || '1'),
          academicYear: a.academicYear,
          assignmentType: a.assignmentType || 'primary',
          startDate: a.startDate,
          endDate: a.endDate,
          workload: a.workload || 0,
          notes: a.notes || '',
          completed: !!a.completed,
          faculty: facultyObj,
          course: courseObj,
          class: classObj
        };
      });

      setFaculty(normalizedFaculty);
      setCourses(normalizedCourses);
      setClasses(normalizedClasses);
      setAssignments(normalizedAssignments);
    } catch (error) {
      showNotification(error.userMessage || 'Error fetching data', 'error');
      setFaculty([]);
      setCourses([]);
      setClasses([]);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Simplified: require Employee ID and resolve to faculty
      if (!formData.employeeId) {
        showNotification('Employee ID is required', 'error');
        setLoading(false);
        return;
      }
      const byEmployee = faculty.find(f => `${f.employeeId}` === `${formData.employeeId}`);
      if (!byEmployee) {
        showNotification('No faculty found for the provided Employee ID', 'error');
        setLoading(false);
        return;
      }
      const effectiveFacultyId = byEmployee.id?.toString?.() || byEmployee.id;
      const selectedFaculty = byEmployee;

      // Validate workload
      const currentWorkload = assignments
        .filter(a => `${a.facultyId}` === `${effectiveFacultyId}` && a.academicYear === formData.academicYear)
        .reduce((total, a) => total + a.workload, 0);
      
      const newWorkload = editingAssignment ? 
        currentWorkload - (editingAssignment.workload || 0) + parseInt(formData.workload) :
        currentWorkload + parseInt(formData.workload);

      if (newWorkload > selectedFaculty.maxWorkload) {
        showNotification(
          `Workload exceeds maximum limit. Current: ${currentWorkload}, Max: ${selectedFaculty.maxWorkload}`,
          'error'
        );
        setLoading(false);
        return;
      }

      // Simplified conflict: same faculty + academic year + overlapping dates
      const hasConflict = assignments.some(assignment => {
        if (editingAssignment && assignment.id === editingAssignment.id) return false;
        const sameFacultyYear = `${assignment.facultyId}` === `${effectiveFacultyId}` && assignment.academicYear === formData.academicYear;
        if (!sameFacultyYear) return false;
        const aStart = assignment.startDate ? new Date(assignment.startDate) : null;
        const aEnd = assignment.endDate ? new Date(assignment.endDate) : null;
        const fStart = formData.startDate ? new Date(formData.startDate) : null;
        const fEnd = formData.endDate ? new Date(formData.endDate) : null;
        if (!aStart || !aEnd || !fStart || !fEnd) return false;
        return (fStart <= aEnd && aStart <= fEnd);
      });

      if (hasConflict) {
        showNotification('Assignment conflict detected! This faculty is already assigned to this course and class.', 'error');
        setLoading(false);
        return;
      }

      const payload = {
        employeeId: formData.employeeId || selectedFaculty?.employeeId,
        facultyId: effectiveFacultyId,
        courseId: 'GENERAL',
        classId: 'GENERAL',
        session: '1',
        academicYear: formData.academicYear,
        assignmentType: formData.assignmentType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        workload: parseInt(formData.workload),
        notes: formData.notes || ''
      };

      if (editingAssignment) {
        await adminAPI.updateAssignment(editingAssignment.id, payload);
        // Optimistically update local state
        setAssignments(prev => prev.map(assignment => 
          assignment.id === editingAssignment.id
            ? {
                ...payload,
                id: editingAssignment.id,
                faculty: selectedFaculty,
                course: { id: 'GENERAL', code: '-', name: 'General' },
                class: { id: 'GENERAL', name: 'General' }
              }
            : assignment
        ));
        showNotification('Assignment updated successfully', 'success');
      } else {
        const res = await adminAPI.createAssignment(payload);
        const created = res.data?.data || res.data || payload;
        const newAssignment = {
          ...created,
          id: created._id || created.id || Date.now(),
          faculty: selectedFaculty,
          course: { id: 'GENERAL', code: '-', name: 'General' },
          class: { id: 'GENERAL', name: 'General' }
        };
        setAssignments(prev => [...prev, newAssignment]);
        showNotification('Assignment created successfully', 'success');
      }

      resetForm();
    } catch (error) {
      showNotification(error.userMessage || 'Error saving assignment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (assignment) => {
    setEditingAssignment(assignment);
    setFormData({
      employeeId: assignment.employeeId || assignment.faculty?.employeeId || '',
      academicYear: assignment.academicYear || '',
      assignmentType: assignment.assignmentType || 'primary',
      startDate: assignment.startDate || '',
      endDate: assignment.endDate || '',
      workload: (assignment.workload ?? 0).toString(),
      notes: assignment.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (assignmentId) => {
    if (!window.confirm('Are you sure you want to delete this assignment?')) return;

    setLoading(true);
    try {
      await adminAPI.deleteAssignment(assignmentId);
      setAssignments(prev => prev.filter(assignment => assignment.id !== assignmentId));
      showNotification('Assignment deleted successfully', 'success');
    } catch (error) {
      showNotification(error.userMessage || 'Error deleting assignment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (assignment) => {
    if (assignment.completed) return; // already completed
    setLoading(true);
    try {
      await adminAPI.updateAssignment(assignment.id, { completed: true });
      setAssignments(prev => prev.map(a => a.id === assignment.id ? { ...a, completed: true } : a));
      showNotification('Assignment marked as completed', 'success');
    } catch (error) {
      showNotification(error.userMessage || 'Error completing assignment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      academicYear: '',
      assignmentType: 'primary',
      startDate: '',
      endDate: '',
      workload: '',
      notes: ''
    });
    setEditingAssignment(null);
    setShowForm(false);
  };

  const getFilteredAssignments = () => {
    return assignments.filter(assignment => {
      const matchesFaculty = !filterFaculty || String(assignment.facultyId) === String(filterFaculty);
      const matchesDepartment = !filterDepartment || assignment.faculty?.department === filterDepartment;
      return matchesFaculty && matchesDepartment;
    });
  };

  const getFacultyWorkload = (facultyId, academicYear) => {
    return assignments
      .filter(a => a.facultyId === facultyId && a.academicYear === academicYear)
      .reduce((total, a) => total + a.workload, 0);
  };

  const renderAssignmentsView = () => {
    const filteredAssignments = getFilteredAssignments();
    
    return (
      <div className="assignments-grid">
        {filteredAssignments.length === 0 ? (
          <div className="no-assignments">No assignments found</div>
        ) : (
          filteredAssignments.map(assignment => (
            <div key={assignment.id} className={`assignment-card ${assignment.assignmentType}`}>
              <div className="assignment-header">
                <h3>{assignment.course.code} - {assignment.course.name}</h3>
                <div className="assignment-actions">
                  <button onClick={() => handleEdit(assignment)} className="btn-edit">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(assignment.id)} className="btn-delete">
                    Delete
                  </button>
                  <button onClick={() => handleComplete(assignment)} className={`btn-complete ${assignment.completed ? 'disabled' : ''}`} disabled={assignment.completed}>
                    {assignment.completed ? 'Completed' : 'Complete'}
                  </button>
                </div>
              </div>
              <div className="assignment-details">
                <p><strong>Faculty:</strong> {assignment.faculty.name}</p>
                <p><strong>Class:</strong> {assignment.class.name}</p>
                <p><strong>Department:</strong> {assignment.faculty.department}</p>
                <p><strong>Session:</strong> {assignment.session ?? assignment.semester}</p>
                <p><strong>Academic Year:</strong> {assignment.academicYear}</p>
                <p><strong>Type:</strong> {assignment.assignmentType}</p>
                <p><strong>Workload:</strong> {assignment.workload} hours/week</p>
                <p><strong>Duration:</strong> {assignment.startDate} to {assignment.endDate}</p>
                {assignment.completed && (
                  <p><strong>Status:</strong> Completed</p>
                )}
                {assignment.notes && (
                  <p><strong>Notes:</strong> {assignment.notes}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderFacultyView = () => {
    return (
      <div className="faculty-workload-grid">
        {faculty.map(member => {
          const currentWorkload = getFacultyWorkload(member.id, academicYears[0] || '');
          const workloadPercentage = member.maxWorkload > 0 ? (currentWorkload / member.maxWorkload) * 100 : 0;
          
          return (
            <div key={member.id} className="faculty-workload-card">
              <div className="faculty-info">
                <div className="faculty-fields">
                  <p><span className="field-label">Name:-</span> <span className="field-value">{member.name}</span></p>
                  <p><span className="field-label">Department:-</span> <span className="field-value">{member.department}</span></p>
                  <p><span className="field-label">Designation:-</span> <span className="field-value">{member.designation}</span></p>
                  {member.specialization && (
                    <p><span className="field-label">Specialization:-</span> <span className="field-value">{member.specialization}</span></p>
                  )}
                </div>
              </div>
              <div className="workload-info">
                <div className="workload-bar">
                  <div 
                    className="workload-fill"
                    style={{ 
                      width: `${Math.min(workloadPercentage, 100)}%`,
                      backgroundColor: workloadPercentage > 90 ? '#e74c3c' : 
                                     workloadPercentage > 70 ? '#f39c12' : '#27ae60'
                    }}
                  ></div>
                </div>
                <p className="workload-text">
                  {currentWorkload} / {member.maxWorkload} hours ({workloadPercentage.toFixed(1)}%)
                </p>
              </div>
              <div className="faculty-assignments">
                <h4>Current Assignments:</h4>
                {assignments
                  .filter(a => a.facultyId === member.id)
                  .map(assignment => (
                    <div key={assignment.id} className="mini-assignment">
                      {assignment.course.code} - {assignment.class.name} ({assignment.workload}h)
                    </div>
                  ))
                }
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="faculty-assignment">
      <div className="assignment-header">
        <h2>Faculty Assignment</h2>
        <div className="header-actions">
          <div className="view-modes">
            <button 
              className={`view-btn ${viewMode === 'assignments' ? 'active' : ''}`}
              onClick={() => setViewMode('assignments')}
            >
              Assignments
            </button>
            <button 
              className={`view-btn ${viewMode === 'faculty' ? 'active' : ''}`}
              onClick={() => setViewMode('faculty')}
            >
              Faculty Workload
            </button>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => setShowForm(true)}
            disabled={loading}
          >
            New Assignment
          </button>
        </div>
      </div>

      <div className="assignment-filters">
        <div className="filter-group">
          <select
            value={filterFaculty}
            onChange={(e) => setFilterFaculty(e.target.value)}
            className="filter-select"
          >
            <option value="">All Faculty</option>
            {faculty.map(member => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="filter-select"
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="assignment-form-modal">
            <div className="modal-header">
              <h3>{editingAssignment ? 'Edit Assignment' : 'New Assignment'}</h3>
              <button className="close-btn" onClick={resetForm}>×</button>
            </div>
            
            <form onSubmit={handleSubmit} className="assignment-form">
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Employee ID *</label>
                  <input
                    type="text"
                    name="employeeId"
                    value={formData.employeeId}
                    onChange={handleInputChange}
                    placeholder="Enter Employee ID (e.g., FAC011)"
                    required
                  />
                </div>
              </div>

              {/* Simplified: no faculty/course/class/session selections */}

              <div className="form-row">
                <div className="form-group">
                  <label>Academic Year *</label>
                  <select
                    name="academicYear"
                    value={formData.academicYear}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select Academic Year</option>
                    {academicYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Assignment Type</label>
                  <select
                    name="assignmentType"
                    value={formData.assignmentType}
                    onChange={handleInputChange}
                  >
                    <option value="primary">Primary Instructor</option>
                    <option value="secondary">Secondary Instructor</option>
                    <option value="substitute">Substitute</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Date *</label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>End Date *</label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Workload (hours/week) *</label>
                  <input
                    type="number"
                    name="workload"
                    value={formData.workload}
                    onChange={handleInputChange}
                    required
                    min="1"
                    max="20"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Additional notes or comments..."
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={resetForm} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : editingAssignment ? 'Update Assignment' : 'Create Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="assignment-content">
        {loading ? (
          <div className="loading-message">Loading assignments...</div>
        ) : viewMode === 'assignments' ? (
          renderAssignmentsView()
        ) : (
          renderFacultyView()
        )}
      </div>
    </div>
  );
};

export default FacultyAssignment;