import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaEdit, FaTrash, FaUserPlus, FaSyncAlt, FaEye, FaDownload, FaFileExcel, FaTimes } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { useAuth } from '../../contexts/AuthContext';
import { useLoading, useMultipleLoading } from '../../hooks/useLoading';
import { useNotification } from '../../components/Notification';
import LoadingSpinner, { SkeletonLoader, LoadingButton } from '../../components/Loading/LoadingSpinner';
import { adminAPI } from '../../services/api';
import StudentForm from '../../components/admin/StudentForm';
import './ManageStudents.css';

export default function ManageStudents() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState([]);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // StudentForm state variables
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // Download by class state
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadClass, setDownloadClass] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  const { loading, withLoading } = useLoading();
  const { setLoading: setActionLoading, isLoading: isActionLoading } = useMultipleLoading();

  const fetchStudents = async (page = 1, search = '') => {
    try {
      const response = await adminAPI.getStudents({
        params: { page, limit: 10, search },
        retry: true
      });
      
      setStudents(response.data.data.students || []);
      setCurrentPage(response.data.data.pagination?.currentPage || 1);
      setTotalPages(response.data.data.pagination?.totalPages || 1);
      setError(null);
    } catch (err) {
      setError(err.userMessage || 'Failed to fetch students');
      showError(err.userMessage || 'Failed to fetch students');
    }
  };

  useEffect(() => {
    withLoading(() => fetchStudents(1, searchTerm));
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm !== '') {
        withLoading(() => fetchStudents(1, searchTerm));
      } else {
        withLoading(() => fetchStudents(1));
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const filteredStudents = students.filter(student => {
    const fullName = `${student.user?.firstName || ''} ${student.user?.lastName || ''}`.trim();
    return fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           student.rollNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           student.class?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleEdit = async (studentId) => {
    const student = students.find(s => s._id === studentId);
    if (student) {
      setSelectedStudent(student);
      setIsFormOpen(true);
    }
  };

  const handleAddStudent = () => {
    setSelectedStudent(null);
    setIsFormOpen(true);
  };

  const handleViewStudent = (student) => {
    navigate(`/admin/student/${student._id}`);
  };

  const handleFormSave = (savedStudent) => {
    if (selectedStudent) {
      // Update existing student
      setStudents(prev => prev.map(student => 
        student._id === savedStudent._id ? savedStudent : student
      ));
      showSuccess('Student updated successfully');
    } else {
      // Add new student
      setStudents(prev => [savedStudent, ...prev]);
      showSuccess('Student added successfully');
    }
    setIsFormOpen(false);
    setSelectedStudent(null);
  };

  const handleFormSubmit = async (formData) => {
    try {
      let response;
      if (selectedStudent) {
        // Update existing student
        response = await adminAPI.updateStudent(selectedStudent._id, formData, { retry: true });
      } else {
        // Add new student
        response = await adminAPI.addStudent(formData, { retry: true });
      }
      const saved = response?.data?.data;
      if (!saved) throw new Error('Invalid response from server');
      handleFormSave(saved);
    } catch (err) {
      showError(err.userMessage || 'Failed to save student');
    }
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setSelectedStudent(null);
  };

  // Removed demo message for bulk import; button hidden until feature is available

  const handleDelete = async (studentId) => {
    if (!window.confirm('Are you sure you want to delete this student?')) {
      return;
    }

    setActionLoading(`delete-${studentId}`, true);
    try {
      await adminAPI.deleteStudent(studentId, { params: { hard: true }, retry: true });
      setStudents(prev => prev.filter(student => student._id !== studentId));
      showSuccess('Student permanently deleted');
    } catch (err) {
      showError(err.userMessage || 'Failed to delete student');
    } finally {
      setActionLoading(`delete-${studentId}`, false);
    }
  };

  const confirmDeleteStudent = async (studentId) => {
    return handleDelete(studentId);
  };

  const handleRefresh = () => {
    withLoading(() => fetchStudents(currentPage, searchTerm));
  };

  // Class options for the download modal
  const classOptions = [
    { value: 'NS', label: 'Nursery' },
    { value: 'LKG', label: 'LKG' },
    { value: 'UKG', label: 'UKG' },
    { value: '1', label: 'Class 1' },
    { value: '2', label: 'Class 2' },
    { value: '3', label: 'Class 3' },
    { value: '4', label: 'Class 4' },
    { value: '5', label: 'Class 5' },
    { value: '6', label: 'Class 6' },
    { value: '7', label: 'Class 7' },
    { value: '8', label: 'Class 8' },
    { value: '9', label: 'Class 9' },
    { value: '10', label: 'Class 10' },
    { value: '11', label: 'Class 11' },
    { value: '12', label: 'Class 12' },
  ];

  // Fetch ALL students for a given class (across all pages)
  const fetchAllStudentsForClass = async (studentClass) => {
    let allStudents = [];
    let page = 1;
    let totalPages = 1;
    do {
      const response = await adminAPI.getStudents({
        params: { page, limit: 100, class: studentClass },
        retry: true,
      });
      const data = response.data.data;
      allStudents = [...allStudents, ...(data.students || [])];
      totalPages = data.pagination?.totalPages || 1;
      page++;
    } while (page <= totalPages);
    return allStudents;
  };

  const handleDownloadExcel = async () => {
    if (!downloadClass) {
      showError('Please select a class to download.');
      return;
    }
    setIsDownloading(true);
    try {
      const students = await fetchAllStudentsForClass(downloadClass);
      if (!students.length) {
        showError(`No students found in Class ${downloadClass}.`);
        setIsDownloading(false);
        return;
      }

      // Build worksheet rows
      const rows = students.map((s, idx) => ({
        'S.No': idx + 1,
        'Roll Number': s.rollNumber || 'N/A',
        'First Name': s.user?.firstName || 'N/A',
        'Last Name': s.user?.lastName || 'N/A',
        'Class': s.class || 'N/A',
        'Section': s.section || 'N/A',
        'Email': s.user?.email || 'N/A',
        'Phone': s.user?.phone || 'N/A',
        'Gender': s.user?.gender || 'N/A',
        'Date of Birth': s.user?.dateOfBirth ? new Date(s.user.dateOfBirth).toLocaleDateString('en-IN') : 'N/A',
        'Blood Group': s.medicalInfo?.bloodGroup || 'N/A',
        "Father's Name": s.father?.name || 'N/A',
        "Mother's Name": s.mother?.name || 'N/A',
        'Guardian Phone': s.guardian?.phone || 'N/A',
        'Admission Date': s.admissionDate ? new Date(s.admissionDate).toLocaleDateString('en-IN') : 'N/A',
        'Academic Year': s.academicYear || 'N/A',
        'Status': s.status || 'N/A',
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Auto-size columns
      const colWidths = Object.keys(rows[0] || {}).map(key => ({
        wch: Math.max(key.length, ...rows.map(r => String(r[key] || '').length)) + 2,
      }));
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `Class ${downloadClass} Students`);

      const filename = `Students_Class_${downloadClass}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, filename);

      showSuccess(`Downloaded data for ${students.length} student(s) from Class ${downloadClass}.`);
      setShowDownloadModal(false);
      setDownloadClass('');
    } catch (err) {
      showError(err.userMessage || 'Failed to download student data.');
    } finally {
      setIsDownloading(false);
    }
  };

  const renderTableContent = () => {
    if (loading) {
      return (
        <tbody>
          {[...Array(5)].map((_, index) => (
            <tr key={index}>
              <td><SkeletonLoader width="80px" height="20px" /></td>
              <td><SkeletonLoader width="120px" height="20px" /></td>
              <td><SkeletonLoader width="60px" height="20px" /></td>
              <td><SkeletonLoader width="100px" height="20px" /></td>
              <td><SkeletonLoader width="60px" height="20px" /></td>
              <td><SkeletonLoader width="80px" height="20px" /></td>
            </tr>
          ))}
        </tbody>
      );
    }

    if (error) {
      return (
        <tbody>
          <tr>
            <td colSpan="6" className="error-row">
              <div className="error-content">
                <p>{error}</p>
                <LoadingButton 
                  onClick={handleRefresh}
                  loading={loading}
                  variant="primary"
                  size="small"
                >
                  <FaSyncAlt /> Retry
                </LoadingButton>
              </div>
            </td>
          </tr>
        </tbody>
      );
    }

    if (filteredStudents.length === 0) {
      return (
        <tbody>
          <tr>
            <td colSpan="6" className="empty-row">
              <div className="empty-content">
                <p>No students found</p>
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="clear-search-btn"
                  >
                    Clear search
                  </button>
                )}
              </div>
            </td>
          </tr>
        </tbody>
      );
    }

    return (
      <tbody>
        {filteredStudents.map((student, index) => (
          <tr key={student._id || student.id || student.rollNumber || index}>
            <td>{student.rollNumber}</td>
            <td>{`${student.user?.firstName || ''} ${student.user?.lastName || ''}`.trim() || 'N/A'}</td>
            <td>{student.class}</td>
            <td>{student.user?.phone}</td>
            <td>
              <span className={`status ${student.status?.toLowerCase()}`}>
                {student.status}
              </span>
            </td>
            <td>
              <div className="actions">
                <LoadingButton
                  onClick={() => handleViewStudent(student)}
                  className="view-btn"
                  title="View"
                  size="small"
                >
                  <FaEye />
                </LoadingButton>
                <LoadingButton
                  onClick={() => handleEdit(student._id)}
                  className="edit-btn"
                  title="Edit"
                  size="small"
                >
                  <FaEdit />
                </LoadingButton>
                <LoadingButton
                  onClick={() => handleDelete(student._id)}
                  loading={isActionLoading(`delete-${student._id}`)}
                  className="delete-btn"
                  title="Delete"
                  size="small"
                  variant="danger"
                >
                  <FaTrash />
                </LoadingButton>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    );
  };

  return (
    <div className="manage-students">
      <div className="header">
        <h1>Manage Students</h1>
        <div className="header-actions">
          <LoadingButton
            onClick={handleRefresh}
            loading={loading}
            className="refresh-btn"
            title="Refresh"
            size="medium"
          >
            <FaSyncAlt />
          </LoadingButton>
          <LoadingButton
            onClick={() => { setShowDownloadModal(true); setDownloadClass(''); }}
            className="download-excel-btn"
            title="Download student data by class"
          >
            <FaFileExcel /> Download by Class
          </LoadingButton>
          <LoadingButton 
            onClick={handleAddStudent}
            className="add-btn"
          >
            <FaUserPlus /> Add New Student
          </LoadingButton>
        </div>
      </div>

      <div className="search-section">
        <div className="search-input-group">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search students by name, roll number, or class..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
            disabled={loading}
          />
          {loading && <LoadingSpinner size="small" className="search-loading" />}
        </div>
      </div>

      <div className="students-table-container">
        <table className="students-table">
          <thead>
            <tr>
              <th>Roll Number</th>
              <th>Name</th>
              <th>Class</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          {renderTableContent()}
        </table>
      </div>

      {!loading && !error && totalPages > 1 && (
        <div className="pagination">
          <LoadingButton
            onClick={() => withLoading(() => fetchStudents(currentPage - 1, searchTerm))}
            disabled={currentPage === 1}
            loading={loading}
            size="small"
            className="pagination-btn"
          >
            Previous
          </LoadingButton>
          
          <div className="pagination-info">
            <span>Page {currentPage} of {totalPages}</span>
            <span className="total-records">
              ({filteredStudents.length} students)
            </span>
          </div>
          
          <LoadingButton
            onClick={() => withLoading(() => fetchStudents(currentPage + 1, searchTerm))}
            disabled={currentPage === totalPages}
            loading={loading}
            size="small"
            className="pagination-btn"
          >
            Next
          </LoadingButton>
        </div>
      )}

      <style>{`
        .manage-students {
          padding: 20px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .header h1 {
          color: #333;
          margin: 0;
        }

        .header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .add-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: background-color 0.2s;
        }

        .add-btn:hover {
          background: #0056b3;
        }

        /* Import button styles removed with demo feature */

        .refresh-btn {
          background: #6c757d;
          color: white;
          border: none;
          padding: 10px 12px;
          border-radius: 5px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .refresh-btn:hover {
          background: #545b62;
        }

        .search-section {
          margin-bottom: 20px;
        }

        .search-input-group {
          position: relative;
          max-width: 400px;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #666;
          z-index: 1;
        }

        .search-loading {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
        }

        .search-input {
          width: 100%;
          padding: 10px 40px 10px 40px;
          border: 1px solid #ddd;
          border-radius: 5px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .search-input:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }

        .search-input:disabled {
          background-color: #f8f9fa;
          cursor: not-allowed;
        }

        .students-table-container {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .students-table {
          width: 100%;
          border-collapse: collapse;
        }

        .students-table th,
        .students-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }

        .students-table th {
          background: #f8f9fa;
          font-weight: 600;
          color: #333;
        }

        .status {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .status.active {
          background: #d4edda;
          color: #155724;
        }

        .status.inactive {
          background: #f8d7da;
          color: #721c24;
        }

        .actions {
          display: flex;
          gap: 8px;
        }

        .view-btn,
        .edit-btn,
        .delete-btn {
          padding: 6px 8px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .view-btn {
          background: #17a2b8;
          color: white;
        }

        .view-btn:hover {
          background: #138496;
        }

        .edit-btn {
          background: #ffc107;
          color: #212529;
        }

        .edit-btn:hover {
          background: #e0a800;
        }

        .delete-btn {
          background: #dc3545;
          color: white;
        }

        .delete-btn:hover {
          background: #c82333;
        }

        .error-row,
        .empty-row {
          text-align: center;
          padding: 40px 20px;
        }

        .error-content,
        .empty-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .error-content p {
          color: #dc3545;
          margin: 0;
          font-weight: 500;
        }

        .empty-content p {
          color: #666;
          margin: 0;
          font-size: 16px;
        }

        .clear-search-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        }

        .clear-search-btn:hover {
          background: #0056b3;
        }

        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 16px;
          margin-top: 20px;
          padding: 20px;
        }

        .pagination-btn {
          background: #3498db;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 5px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s;
        }

        .pagination-btn:hover:not(:disabled) {
          background: #2980b9;
        }

        .pagination-btn:disabled {
          background: #bdc3c7;
          cursor: not-allowed;
        }

        .pagination-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .total-records {
          font-size: 12px;
          color: #6c757d;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #666;
        }
      `}</style>

      {/* Student Form Modal */}
      {isFormOpen && (
        <StudentForm
          student={selectedStudent}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
        />
      )}

      {/* Download by Class Modal */}
      {showDownloadModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) { setShowDownloadModal(false); setDownloadClass(''); } }}>
          <div className="download-modal">
            <div className="modal-header">
              <div className="modal-title-group">
                <FaFileExcel className="modal-excel-icon" />
                <h3>Download Student Data</h3>
              </div>
              <button
                onClick={() => { setShowDownloadModal(false); setDownloadClass(''); }}
                className="close-btn"
                title="Close"
              >
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <p className="download-desc">Select a class to export all student records as an Excel (.xlsx) file.</p>
              <div className="class-grid">
                {classOptions.map(opt => (
                  <button
                    key={opt.value}
                    className={`class-chip ${downloadClass === opt.value ? 'selected' : ''}`}
                    onClick={() => setDownloadClass(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {downloadClass && (
                <div className="selected-class-info">
                  <FaDownload />
                  <span>Ready to download: <strong>Class {downloadClass}</strong></span>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button
                onClick={() => { setShowDownloadModal(false); setDownloadClass(''); }}
                className="cancel-btn"
                disabled={isDownloading}
              >
                Cancel
              </button>
              <LoadingButton
                onClick={handleDownloadExcel}
                loading={isDownloading}
                className="confirm-download-btn"
                disabled={!downloadClass || isDownloading}
              >
                <FaDownload /> {isDownloading ? 'Downloading...' : 'Download Excel'}
              </LoadingButton>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="delete-modal">
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="close-btn"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="warning-icon">
                ⚠️
              </div>
              <p>Are you sure you want to delete this student?</p>
              <p className="warning-text">This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <LoadingButton
                 onClick={() => confirmDeleteStudent(showDeleteConfirm)}
                 loading={isActionLoading(`delete-${showDeleteConfirm}`)}
                 className="confirm-delete-btn"
               >
                 Delete Student
               </LoadingButton>
            </div>
          </div>
        </div>
      )}

<style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(3px);
        }

        .delete-modal {
          background: white;
          border-radius: 10px;
          padding: 0;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }

        /* ---- Download Excel Modal ---- */
        .download-modal {
          background: #fff;
          border-radius: 14px;
          padding: 0;
          max-width: 480px;
          width: 92%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.22);
          animation: slideInUp 0.25s ease;
        }

        @keyframes slideInUp {
          from { transform: translateY(30px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }

        .download-modal .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #eef0f3;
          background: linear-gradient(135deg, #1a7f37 0%, #22863a 100%);
          border-radius: 14px 14px 0 0;
        }

        .modal-title-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .modal-excel-icon {
          font-size: 22px;
          color: #fff;
        }

        .download-modal .modal-header h3 {
          margin: 0;
          color: #fff;
          font-size: 17px;
          font-weight: 600;
        }

        .download-modal .close-btn {
          background: rgba(255,255,255,0.15);
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          color: #fff;
          padding: 6px 8px;
          display: flex;
          align-items: center;
          transition: background 0.2s;
        }

        .download-modal .close-btn:hover {
          background: rgba(255,255,255,0.3);
        }

        .download-modal .modal-body {
          padding: 24px;
          text-align: left;
        }

        .download-desc {
          color: #555;
          font-size: 14px;
          margin: 0 0 18px 0;
        }

        .class-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 16px;
        }

        .class-chip {
          padding: 10px 6px;
          border: 2px solid #e0e3e8;
          border-radius: 8px;
          background: #f8f9fa;
          color: #444;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.18s;
          text-align: center;
        }

        .class-chip:hover {
          border-color: #1a7f37;
          background: #eaf6ee;
          color: #1a7f37;
        }

        .class-chip.selected {
          border-color: #1a7f37;
          background: #1a7f37;
          color: #fff;
          box-shadow: 0 2px 8px rgba(26,127,55,0.3);
          transform: scale(1.04);
        }

        .selected-class-info {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #eaf6ee;
          border: 1px solid #b6e4c5;
          border-radius: 7px;
          padding: 10px 14px;
          font-size: 14px;
          color: #1a7f37;
          margin-top: 4px;
        }

        .download-modal .modal-actions {
          display: flex;
          gap: 10px;
          padding: 16px 24px 20px;
          border-top: 1px solid #eef0f3;
          justify-content: flex-end;
        }

        .confirm-download-btn {
          background: linear-gradient(135deg, #1a7f37 0%, #22863a 100%);
          color: white;
          border: none;
          padding: 10px 22px;
          border-radius: 7px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 7px;
          transition: opacity 0.2s, transform 0.15s;
        }

        .confirm-download-btn:hover:not(:disabled) {
          opacity: 0.88;
          transform: translateY(-1px);
        }

        .confirm-download-btn:disabled {
          background: #adb5bd;
          cursor: not-allowed;
          transform: none;
        }

        /* ---- Download Excel button in header ---- */
        .download-excel-btn {
          background: linear-gradient(135deg, #1a7f37, #22863a);
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 5px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 500;
          transition: opacity 0.2s, transform 0.15s;
          white-space: nowrap;
        }

        .download-excel-btn:hover {
          opacity: 0.88;
          transform: translateY(-1px);
        }

        /* ---- Shared modal styles ---- */
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e1e8ed;
        }

        .modal-header h3 {
          margin: 0;
          color: #2c3e50;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: #6c757d;
          padding: 5px;
        }

        .close-btn:hover {
          color: #dc3545;
        }

        .modal-body {
          padding: 20px;
          text-align: center;
        }

        .warning-icon {
          font-size: 48px;
          margin-bottom: 15px;
        }

        .modal-body p {
          margin: 10px 0;
          color: #2c3e50;
        }

        .warning-text {
          font-size: 14px;
          color: #6c757d;
        }

        .modal-actions {
          display: flex;
          gap: 10px;
          padding: 20px;
          border-top: 1px solid #e1e8ed;
          justify-content: flex-end;
        }

        .cancel-btn {
          background: #6c757d;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .cancel-btn:hover:not(:disabled) {
          background: #545b62;
        }

        .cancel-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .confirm-delete-btn {
          background: #dc3545;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .confirm-delete-btn:hover {
          background: #c82333;
        }
      `}</style>
    </div>
  );
}