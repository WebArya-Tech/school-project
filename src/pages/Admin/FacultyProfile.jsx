import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaUser, FaBuilding, FaIdBadge, FaEnvelope, FaPhone, FaMapMarkerAlt, FaBriefcase, FaGraduationCap, FaStar, FaCalendarCheck } from 'react-icons/fa';
import { adminAPI } from '../../services/api';
import { useNotification } from '../../components/Notification';
import LoadingSpinner from '../../components/Loading/LoadingSpinner';

export default function FacultyProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminAPI.getFacultyById(id, { retry: true });
        if (!mounted) return;
        setData(res.data.data);
      } catch (err) {
        if (!mounted) return;
        setError(err.userMessage || 'Failed to load faculty details');
        showError(err.userMessage || 'Failed to load faculty details');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchDetails();
    return () => { mounted = false; };
  }, [id]);

  const profile = data?.profile;

  return (
    <div className="faculty-profile-page">
      <div className="profile-banner">
        <button className="back-btn" onClick={() => navigate(-1)}><FaArrowLeft /> Back</button>
        <h1>Faculty Profile</h1>
      </div>

      {loading && (
        <div className="loading"><LoadingSpinner /> Loading faculty details…</div>
      )}

      {error && (
        <div className="error">{error}</div>
      )}

      {!loading && !error && profile && (
        <div className="content-grid">
          <section className="card personal-info">
            <div className="card-header"><FaUser /> Personal Information</div>
            <div className="card-body">
              <div className="info-grid">
                <div className="info-item">
                  <FaUser className="icon" />
                  <div>
                    <label>Full Name</label>
                    <p>{profile.name || 'N/A'}</p>
                  </div>
                </div>
                <div className="info-item">
                  <FaEnvelope className="icon" />
                  <div>
                    <label>Email Address</label>
                    <p>{profile.email || 'N/A'}</p>
                  </div>
                </div>
                <div className="info-item">
                  <FaPhone className="icon" />
                  <div>
                    <label>Phone Number</label>
                    <p>{profile.phone || 'N/A'}</p>
                  </div>
                </div>
                <div className="info-item">
                  <FaIdBadge className="icon" />
                  <div>
                    <label>Employee ID</label>
                    <p>{profile.employeeId || 'N/A'}</p>
                  </div>
                </div>
                <div className="info-item">
                  <FaMapMarkerAlt className="icon" />
                  <div>
                    <label>Address</label>
                    <p>{profile.address || 'N/A'}</p>
                  </div>
                </div>
                <div className="info-item">
                  <FaIdBadge className="icon" />
                  <div>
                    <label>Status</label>
                    <p className={`status-badge ${profile.status?.toLowerCase()}`}>{profile.status || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="card professional-info">
            <div className="card-header"><FaBriefcase /> Professional Information</div>
            <div className="card-body">
              <div className="info-grid">
                <div className="info-item">
                  <FaBuilding className="icon" />
                  <div>
                    <label>Department</label>
                    <p>{profile.department || 'N/A'}</p>
                  </div>
                </div>
                <div className="info-item">
                  <FaBriefcase className="icon" />
                  <div>
                    <label>Designation</label>
                    <p>{profile.designation || 'N/A'}</p>
                  </div>
                </div>
                <div className="info-item">
                  <FaGraduationCap className="icon" />
                  <div>
                    <label>Qualification</label>
                    <p>{profile.qualification || 'N/A'}</p>
                  </div>
                </div>
                <div className="info-item">
                  <FaStar className="icon" />
                  <div>
                    <label>Specialization</label>
                    <p>{profile.specialization || 'N/A'}</p>
                  </div>
                </div>
                <div className="info-item">
                  <FaBriefcase className="icon" />
                  <div>
                    <label>Experience</label>
                    <p>{profile.experience} Years</p>
                  </div>
                </div>
                <div className="info-item">
                  <FaCalendarCheck className="icon" />
                  <div>
                    <label>Joining Date</label>
                    <p>{profile.joiningDate ? new Date(profile.joiningDate).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      <style>{`
        .faculty-profile-page {
          padding: 0;
          max-width: 100%;
          margin: 0;
          background: #f7fafc;
          min-height: 100vh;
        }
        .profile-banner {
          background: linear-gradient(135deg, #1a237e 0%, #3949ab 100%);
          padding: 40px 24px;
          display: flex;
          align-items: center;
          gap: 20px;
          color: white;
          margin-bottom: 30px;
        }
        .profile-banner h1 {
          margin: 0;
          font-size: 32px;
          font-weight: 700;
          color: white;
        }
        .back-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          color: white;
          transition: all 0.2s;
        }
        .back-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        .content-grid {
          padding: 0 24px 40px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }
        @media (min-width: 992px) {
          .content-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        .card {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          border: 1px solid #edf2f7;
          overflow: hidden;
        }
        .card-header {
          background: #f8fafc;
          padding: 16px 20px;
          font-weight: 600;
          color: #2d3748;
          border-bottom: 1px solid #edf2f7;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .card-body {
          padding: 20px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        @media (min-width: 576px) {
          .info-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        .info-item {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .info-item .icon {
          color: #1a237e;
          font-size: 18px;
          margin-top: 4px;
        }
        .info-item label {
          display: block;
          font-size: 12px;
          color: #718096;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }
        .info-item p {
          margin: 0;
          color: #2d3748;
          font-weight: 500;
          font-size: 15px;
        }
        .status-badge {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 20px;
          font-size: 12px;
          text-transform: capitalize;
        }
        .status-badge.active {
          background: #c6f6d5;
          color: #22543d;
        }
        .status-badge.inactive {
          background: #fed7d7;
          color: #822727;
        }
        .loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px;
          color: #718096;
          gap: 16px;
        }
        .error {
          background: #fff5f5;
          color: #c53030;
          padding: 16px;
          border-radius: 8px;
          border: 1px solid #feb2b2;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
