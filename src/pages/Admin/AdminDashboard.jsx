import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaUsers, 
  FaChalkboardTeacher, 
  FaGraduationCap, 
  FaMoneyBillWave,
  FaCalendarAlt,
  FaBus,
  FaBell,
  FaTasks,
  FaChartLine,
  FaClock,
  FaUserCheck,
  FaGraduationCap as FaStudentEnrollment,
  FaChartBar,
  FaSyncAlt,
  FaArrowAltCircleUp
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import './AdminDashboard.css';
import api, { adminAPI } from '../../services/api.js';
import config from '../../config/config.js';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState({
    stats: {
      totalStudents: 0,
      totalFaculty: 0,
      monthlyRevenue: '₹ 0'
    },
    recentNotifications: [],
    pendingTasks: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [waitlistedCount, setWaitlistedCount] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getDashboard({ retry: true });
      const data = response.data;

      if (data.success) {
        let mergedData = data.data;
        // Merge E2E messages only when E2E mode is enabled
        if (config.IS_E2E) {
          try {
            const msgRes = await api.get('/e2e/messages');
            const messages = Array.isArray(msgRes?.data?.data)
              ? msgRes.data.data
              : (Array.isArray(msgRes?.data) ? msgRes.data : []);
            const msgNotifs = (messages || []).slice(0, 5).map((m) => ({
              id: m._id,
              type: 'system',
              message: `${m.name} sent a message: ${m.subject}`,
              time: new Date(m.time).toLocaleString()
            }));
            mergedData = {
              ...mergedData,
              recentNotifications: [...msgNotifs, ...(mergedData.recentNotifications || [])].slice(0, 10)
            };
          } catch (msgErr) {
            console.warn('E2E messages fetch failed:', msgErr);
          }
        }

        setDashboardData(mergedData);
        setError('');
      } else {
        setError(data.message || 'Failed to fetch dashboard data');
      }

      const fromDashboard = data?.data?.stats?.waitlistedCount;
      if (typeof fromDashboard === 'number') {
        setWaitlistedCount(fromDashboard);
      } else {
        // Admissions count: prefer E2E store, fall back to real DB
        try {
          if (config.IS_E2E) {
            const admRes = await api.get('/e2e/admissions');
            const admissionsData = Array.isArray(admRes?.data?.data)
              ? admRes.data.data
              : (Array.isArray(admRes?.data) ? admRes.data : []);
            const e2eCount = (admissionsData || []).filter(a => a.status === 'submitted').length;
            if (e2eCount > 0) {
              setWaitlistedCount(e2eCount);
            } else {
              const dbRes = await adminAPI.getAdmissions({ params: { status: 'submitted', limit: 1 } });
              const total = dbRes?.data?.data?.pagination?.totalCount || 0;
              setWaitlistedCount(total);
            }
          } else {
            const dbRes = await adminAPI.getAdmissions({ params: { status: 'submitted', limit: 1 } });
            const total = dbRes?.data?.data?.pagination?.totalCount || 0;
            setWaitlistedCount(total);
          }
        } catch (admErr) {
          console.warn('Admissions count fetch failed:', admErr);
          setWaitlistedCount(0);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError(error.userMessage || 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  const ErrorBanner = () => error ? (
    <div className="error">
      <p>Error loading dashboard stats: {error}</p>
      <button onClick={fetchDashboardData}>Retry</button>
    </div>
  ) : null;

  return (
    <div className="admin-dashboard">
      <ErrorBanner />
      <div className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <p>Welcome back, Sunil Yadav</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon students">
            <FaGraduationCap />
          </div>
          <div className="stat-content">
            <h3>{dashboardData.stats.totalStudents}</h3>
            <p>Total Students</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon faculty">
            <FaChalkboardTeacher />
          </div>
          <div className="stat-content">
            <h3>{dashboardData.stats.totalFaculty}</h3>
            <p>Total Faculty</p>
          </div>
        </div>



        <div className="stat-card">
          <div className="stat-icon revenue">
            <FaMoneyBillWave />
          </div>
          <div className="stat-content">
            <h3>{dashboardData.stats.monthlyRevenue}</h3>
            <p>Monthly Revenue</p>
          </div>
        </div>

        {/* E2E Waitlisted count (online applications) */}
        <div className="stat-card">
          <div className="stat-icon courses">
            <FaBell />
          </div>
          <div className="stat-content">
            <h3>{waitlistedCount}</h3>
            <p>Waitlisted Students</p>
          </div>
        </div>
      </div>

      {/* Dashboard Content Grid */}
      <div className="dashboard-content">
        {/* Recent Notifications */}
        <div className="dashboard-card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3><FaBell /> Recent Notifications</h3>
            <button className="action-btn" onClick={fetchDashboardData} title="Refresh notifications">
              <FaSyncAlt /> Refresh
            </button>
          </div>
          <div className="card-content">
            {dashboardData.recentNotifications.length > 0 ? (
              <div className="notifications-list">
                {dashboardData.recentNotifications.map((notification) => (
                  <div key={notification.id} className="notification-item">
                    <div className={`notification-type ${notification.type}`}></div>
                    <div className="notification-content">
                      <p>{notification.message}</p>
                      <span className="notification-time">{notification.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-data">No recent notifications</p>
            )}
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="dashboard-card">
          <div className="card-header">
            <h3><FaTasks /> Pending Tasks</h3>
          </div>
          <div className="card-content">
            {dashboardData.pendingTasks.length > 0 ? (
              <div className="tasks-list">
                {dashboardData.pendingTasks.map((task) => (
                  <div key={task.id} className="task-item">
                    <div className="task-content">
                      <p>{task.task}</p>
                      <span className={`task-priority ${task.priority.toLowerCase()}`}>
                        {task.priority} Priority
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-data">No pending tasks</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="dashboard-card">
          <div className="card-header">
            <h3><FaChartLine /> Quick Actions</h3>
          </div>
          <div className="card-content">
            <div className="quick-actions">
              <button className="action-btn" onClick={() => navigate('/admin/manage-students')}>
                <FaUsers /> Manage Students
              </button>
              <button className="action-btn" onClick={() => navigate('/admin/manage-faculty')}>
                <FaChalkboardTeacher /> Manage Faculty
              </button>
              <button className="action-btn" onClick={() => navigate('/admin/schedule-manager')}>
                <FaClock /> Schedule Manager
              </button>
              <button className="action-btn" onClick={() => navigate('/admin/faculty-assignment')}>
                <FaUserCheck /> Faculty Assignment
              </button>
              <button className="action-btn" onClick={() => navigate('/admin/student-enrollment')}>
                <FaStudentEnrollment /> Student Enrollment
              </button>
              <button className="action-btn" onClick={() => navigate('/admin/reports')}>
                <FaChartBar /> Reports & Analytics
              </button>
              <button className="action-btn" onClick={() => navigate('/admin/fee-management')}>
                <FaMoneyBillWave /> Fee Management
              </button>
              <button className="action-btn" onClick={() => navigate('/admin/academic-calendar')}>
                <FaCalendarAlt /> Academic Calendar
              </button>
              <button className="action-btn" onClick={() => navigate('/admin/transport-management')}>
                <FaBus /> Transport Management
              </button>
              <button className="action-btn" onClick={() => navigate('/admin/grades')}>
                <FaGraduationCap /> Grade Management
              </button>
              <button className="action-btn" onClick={() => navigate('/admin/promote-students')} style={{ background: 'linear-gradient(135deg, #1a7f37 0%, #22863a 100%)' }}>
                <FaArrowAltCircleUp /> Promote Students
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .admin-dashboard {
          padding: 20px;
          background: #f8f9fa;
          min-height: 100vh;
        }

        .loading, .error {
          text-align: center;
          padding: 40px;
          background: white;
          border-radius: 8px;
          margin: 20px 0;
        }

        .error button {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 10px;
        }

        .dashboard-header {
          margin-bottom: 30px;
        }

        .dashboard-header h1 {
          color: #333;
          margin-bottom: 5px;
          font-size: 2.5rem;
        }

        .dashboard-header p {
          color: #666;
          font-size: 16px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .stat-card {
          background: white;
          padding: 25px;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          display: flex;
          align-items: center;
          gap: 20px;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 15px rgba(0,0,0,0.15);
        }

        .stat-icon {
          padding: 20px;
          border-radius: 50%;
          font-size: 28px;
          color: white;
        }

        .stat-icon.students { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .stat-icon.faculty { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
        .stat-icon.courses { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
        .stat-icon.revenue { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }

        .stat-content h3 {
          margin: 0;
          font-size: 32px;
          color: #333;
          font-weight: 700;
        }

        .stat-content p {
          margin: 5px 0 0 0;
          color: #666;
          font-size: 14px;
          font-weight: 500;
        }

        .dashboard-content {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 20px;
        }

        .dashboard-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          overflow: hidden;
        }

        .card-header {
          background: #f8f9fa;
          padding: 20px;
          border-bottom: 1px solid #e9ecef;
        }

        .card-header h3 {
          margin: 0;
          color: #333;
          font-size: 18px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .card-content {
          padding: 20px;
        }

        .notifications-list, .tasks-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .notification-item, .task-item {
          display: flex;
          align-items: flex-start;
          gap: 15px;
          padding: 15px 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .notification-item:last-child, .task-item:last-child {
          border-bottom: none;
        }

        .notification-type {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-top: 8px;
          flex-shrink: 0;
        }

        .notification-type.registration { background: #28a745; }
        .notification-type.system { background: #007bff; }
        .notification-type.report { background: #ffc107; }

        .notification-content p, .task-content p {
          margin: 0 0 5px 0;
          color: #333;
          font-size: 14px;
        }

        .notification-time {
          color: #666;
          font-size: 12px;
        }

        .task-priority {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .task-priority.high {
          background: #fee;
          color: #dc3545;
        }

        .task-priority.medium {
          background: #fff3cd;
          color: #856404;
        }

        .task-priority.low {
          background: #d1ecf1;
          color: #0c5460;
        }

        .quick-actions {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
        }

        .action-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 15px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: transform 0.2s, box-shadow 0.2s;
          white-space: nowrap;
          min-height: 50px;
        }

        .action-btn:hover {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #fff;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .no-data {
          text-align: center;
          color: #666;
          font-style: italic;
          padding: 20px;
        }

        @media (max-width: 768px) {
          .admin-dashboard {
            padding: 15px;
          }
          
          .stats-grid {
            grid-template-columns: 1fr;
          }
          
          .dashboard-content {
            grid-template-columns: 1fr;
          }
          
          .quick-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
