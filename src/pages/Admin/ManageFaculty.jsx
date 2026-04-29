import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaEdit, FaTrash, FaUserPlus, FaEye } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { adminAPI } from '../../services/api';
import { useLoading } from '../../hooks/useLoading';
import { useNotification } from '../../hooks/useNotification';
import FacultyForm from '../../components/admin/FacultyForm';
// import config from '../../config/config.js';
import './ManageFaculty.css';

export default function ManageFaculty() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { loading, setLoading } = useLoading();
  const { showSuccess, showError } = useNotification();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [faculty, setFaculty] = useState([]);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  
  // Faculty Form State
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [facultyToDelete, setFacultyToDelete] = useState(null);

  // Fetch faculty data
  const fetchFaculty = async (page = 1, search = '') => {
    try {
      setLoading(true);
      setError(null);

      const response = await adminAPI.getFaculty({
        params: {
          page,
          limit: 10,
          ...(search ? { search } : {})
        }
      });

      if (response.data?.success) {
        setFaculty(response.data.data?.faculty || response.data.faculty || []);
        setPagination(response.data.data?.pagination || response.data.pagination || {});
      } else {
        const msg = response.data?.message || 'Failed to fetch faculty data';
        setError(msg);
        showError(msg);
      }
    } catch (error) {
      console.error('Error fetching faculty:', error);
      const msg = error.userMessage || 'Failed to connect to server';
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaculty(currentPage, searchTerm);
  }, [currentPage, token]);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchFaculty(1, searchTerm);
  };

  // Faculty Form Handlers
  const handleAddFaculty = () => {
    setSelectedFaculty(null);
    setIsFormOpen(true);
  };

  const handleEditFaculty = (faculty) => {
    setSelectedFaculty(faculty);
    setIsFormOpen(true);
  };

  const handleViewFaculty = (member) => {
    navigate(`/admin/faculty/${member._id || member.id}`);
  };

  const handleDeleteFaculty = (faculty) => {
    setFacultyToDelete(faculty);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteFaculty = async () => {
    if (!facultyToDelete) return;

    try {
      setLoading(true);
      await adminAPI.deleteFaculty(
        facultyToDelete._id || facultyToDelete.id,
        { params: { hard: true }, retry: true }
      );
      
      showSuccess('Faculty member permanently deleted!');
      setShowDeleteConfirm(false);
      setFacultyToDelete(null);
      
      // Refresh the faculty list
      fetchFaculty(currentPage, searchTerm);
    } catch (error) {
      console.error('Error deleting faculty:', error);
      if (error?.response?.status === 404) {
        // Treat missing record as already deleted; close modal and refresh
        showSuccess('Faculty already deleted. Refreshing list…');
        setShowDeleteConfirm(false);
        setFacultyToDelete(null);
        fetchFaculty(currentPage, searchTerm);
      } else {
        const msg = error.userMessage || error.response?.data?.message || 'Failed to delete faculty member';
        showError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFaculty = async (formData) => {
    try {
      setLoading(true);
      const isUpdate = !!(selectedFaculty?._id || selectedFaculty?.id);

      // Map UI form data to backend payload schema
      const nameParts = String(formData.name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const payload = {
        firstName,
        lastName,
        email: formData.email,
        phone: formData.phone,
        department: formData.department,
        designation: formData.designation,
        qualification: formData.qualification,
        experience: formData.experience,
        specialization: formData.specialization,
        // Model expects joiningDate
        joiningDate: formData.joiningDate || undefined,
        // Normalize address to object shape
        ...(formData.address ? { address: { street: String(formData.address) } } : {}),
        // Salary basic only; backend adds allowances
        ...(formData.salary ? { salary: Number(formData.salary) } : {}),
      };

      if (isUpdate) {
        await adminAPI.updateFaculty(selectedFaculty._id || selectedFaculty.id, payload);
        showSuccess('Faculty member updated successfully!');
      } else {
        await adminAPI.addFaculty(payload);
        showSuccess('Faculty member added successfully!');
      }
      setIsFormOpen(false);
      setSelectedFaculty(null);
      fetchFaculty(currentPage, searchTerm);
    } catch (error) {
      console.error('Error saving faculty:', error);
      const msg = error.userMessage || error.response?.data?.message || 'Failed to save faculty';
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Bulk import removed for production readiness

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  if (loading) {
    return (
      <div className="manage-faculty">
        <div className="loading">Loading faculty data...</div>
      </div>
    );
  }

  return (
    <div className="manage-faculty">
      <div className="header">
        <h1>Manage Faculty</h1>
        <div className="header-actions">
          <button className="add-btn" onClick={handleAddFaculty}>
            <FaUserPlus /> Add New Faculty
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="search-section">
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-group">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search faculty by name, department, or employee ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <button type="submit" className="search-btn">Search</button>
        </form>
      </div>

      <div className="faculty-table-container">
        <table className="faculty-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {faculty.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-data">
                  No faculty members found
                </td>
              </tr>
            ) : (
              faculty.map((member) => (
                <tr key={member._id || member.id}>
                  <td>{member.employeeId}</td>
                  <td>{member.name}</td>
                  <td>{member.email}</td>
                  <td>{member.department}</td>
                  <td>{member.phone}</td>
                  <td>
                    <span className={`status ${member.status.toLowerCase()}`}>
                      {member.status}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        onClick={() => handleViewFaculty(member)}
                        className="view-btn"
                        title="View Details"
                      >
                        <FaEye />
                      </button>
                      <button
                        onClick={() => handleEditFaculty(member)}
                        className="edit-btn"
                        title="Edit"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDeleteFaculty(member)}
                        className="delete-btn"
                        title="Delete"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`page-btn ${currentPage === page ? 'active' : ''}`}
            >
              {page}
            </button>
          ))}
        </div>
      )}

      {/* Faculty Form Modal */}
      {isFormOpen && (
        <FacultyForm
          faculty={selectedFaculty}
          onSubmit={handleSubmitFaculty}
          onCancel={() => {
            setIsFormOpen(false);
            setSelectedFaculty(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this faculty member?</p>
            <div className="modal-actions">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteFaculty}
                className="confirm-delete-btn"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

<style>{`
        .manage-faculty {
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
          gap: 10px;
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
        }

        .add-btn:hover {
          opacity: 0.9;
        }

        .add-btn:hover {
          background: #0056b3;
        }

        .error-message {
          background: #f8d7da;
          color: #721c24;
          padding: 10px;
          border-radius: 5px;
          margin-bottom: 20px;
        }

        .search-section {
          margin-bottom: 20px;
        }

        .search-form {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .search-input-group {
          position: relative;
          flex: 1;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #666;
        }

        .search-input {
          width: 100%;
          padding: 10px 10px 10px 40px;
          border: 1px solid #ddd;
          border-radius: 5px;
          font-size: 14px;
        }

        .search-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
        }

        .search-btn:hover {
          background: #0056b3;
        }

        .faculty-table-container {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .faculty-table {
          width: 100%;
          border-collapse: collapse;
        }

        .faculty-table th,
        .faculty-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }

        .faculty-table th {
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
          gap: 5px;
        }

        .view-btn, .edit-btn, .delete-btn {
          padding: 6px 10px;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          color: white;
        }

        .view-btn {
          background: #17a2b8;
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

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          max-width: 400px;
          width: 90%;
        }

        .modal-content h3 {
          margin-top: 0;
          color: #333;
        }

        .modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 20px;
        }

        .cancel-btn, .confirm-delete-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .cancel-btn {
          background: #6c757d;
          color: white;
        }

        .cancel-btn:hover {
          background: #5a6268;
        }

        .confirm-delete-btn {
          background: #dc3545;
          color: white;
        }

        .confirm-delete-btn:hover {
          background: #c82333;
        }

        .no-data {
          text-align: center;
          color: #666;
          font-style: italic;
        }

        .pagination {
          display: flex;
          justify-content: center;
          gap: 5px;
          margin-top: 20px;
        }

        .page-btn {
          padding: 8px 12px;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
          border-radius: 4px;
        }

        .page-btn:hover {
          background: #f8f9fa;
        }

        .page-btn.active {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #666;
        }
      `}</style>
    </div>
  );
}