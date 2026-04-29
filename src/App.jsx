import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import { NotificationProvider } from './components/Notification';
import GlobalLoadingIndicator from './components/GlobalLoading/GlobalLoadingIndicator';
import Navbar from './components/Navbar/Navbar';
import Footer from './components/Footer/Footer.jsx';
import ScrollToTop from './components/ScrollToTop/ScrollToTop.jsx';
import BackToTop from './components/BackToTop/BackToTop';
import Home from './pages/Home/Home';
import About from './pages/About/About.jsx';
import Contact from './pages/Contact/Contact';
import Academic from './pages/Academic/Academic';
import AcademyUpdate from './pages/Academic/AcademyUpdate.jsx';
import Admissions from './pages/Admissions/Admissions';
import FeePayment from './pages/FeePayment/FeePayment';
import Gallery from './pages/Gallery/Gallery';

// Admin Pages
import AdminDashboard from './pages/Admin/AdminDashboard';
import ManageStudents from './pages/Admin/ManageStudents';
import ManageFaculty from './pages/Admin/ManageFaculty';
import ScheduleManager from './pages/Admin/ScheduleManager';
import FacultyAssignment from './pages/Admin/FacultyAssignment';
import StudentEnrollment from './pages/Admin/StudentEnrollment';
import AdminSettings from './pages/Admin/AdminSettings';
import AdminGrades from './pages/Admin/AdminGrades.jsx';
import AdmissionsManagement from './pages/Admin/AdmissionsManagement.jsx';
import FeeManagement from './pages/Admin/FeeManagement.jsx';
import Reports from './pages/Admin/Reports';
import AdminLogin from './pages/Admin/AdminLogin.jsx';
import AcademicCalendar from './pages/Admin/AcademicCalendar.jsx';
import TransportManagement from './pages/Admin/TransportManagement.jsx';
// Grade Management (Admin reuses FacultyGrades)
import AdminStudentProfile from './pages/Admin/StudentProfile.jsx';
import AdminFacultyProfile from './pages/Admin/FacultyProfile.jsx';

// Faculty Pages
import FacultyDashboard from './pages/Faculty/FacultyDashboard';
import FacultyAttendance from './pages/Faculty/FacultyAttendance';
import FacultyGrades from './pages/Faculty/FacultyGrades';
import FacultyCourses from './pages/Faculty/FacultyCourses';
import FacultyCourseDetails from './pages/Faculty/FacultyCourseDetails.jsx';
import FacultyAssignments from './pages/Faculty/FacultyAssignments';
import FacultyProfile from './pages/Faculty/FacultyProfile';
import FacultyOnlineClasses from './pages/Faculty/OnlineClasses';
import TeachingAssignments from './pages/Faculty/TeachingAssignments.jsx';
import FacultyLogin from './pages/Faculty/FacultyLogin';
import SubjectManagement from './pages/Faculty/SubjectManagement.jsx';

// Student Pages
import StudentDashboard from './pages/Student/StudentDashboard';
import StudentCourses from './pages/Student/StudentCourses';
import StudentGrades from './pages/Student/StudentGrades';
import StudentAssignments from './pages/Student/StudentAssignments.jsx';
import StudentAttendance from './pages/Student/StudentAttendance';
import StudentOnlineClasses from './pages/Student/OnlineClasses';
import StudentFeePayment from './pages/Student/FeePayment';
import StudentProfile from './pages/Student/StudentProfile';
import StudentLogin from './pages/Student/StudentLogin';

import './App.css';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Breadcrumbs from './components/Breadcrumbs/Breadcrumbs.jsx';
import ContextNav from './components/ContextNav/ContextNav.jsx';
import NotFound from './components/NotFound.jsx';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <div className="app">
            <ScrollToTop />
            <GlobalLoadingIndicator />
            {/* Skip to main content link for accessibility */}
            <a href="#main-content" className="skip-link">Skip to main content</a>
            <Navbar />
            <Breadcrumbs />
            <ContextNav />
            <div id="main-content" tabIndex="-1">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/academic" element={<Academic />} />
                <Route path="/academic/updates" element={<AcademyUpdate />} />
                <Route path="/programs" element={<Academic />} />
                <Route path="/admissions" element={<Admissions />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="/fee-payment" element={<FeePayment />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/admin-login" element={<AdminLogin />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/faculty-login" element={<FacultyLogin />} />
                <Route path="/faculty/login" element={<FacultyLogin />} />
                <Route path="/student-login" element={<StudentLogin />} />
                <Route path="/student/login" element={<StudentLogin />} />
                
                {/* Admin Routes */}
                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="/admin/dashboard" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
                <Route path="/admin/manage-students" element={<ProtectedRoute roles={['admin']}><ManageStudents /></ProtectedRoute>} />
                <Route path="/admin/manage-faculty" element={<ProtectedRoute roles={['admin']}><ManageFaculty /></ProtectedRoute>} />
                <Route path="/admin/schedule-manager" element={<ProtectedRoute roles={['admin']}><ScheduleManager /></ProtectedRoute>} />
                <Route path="/admin/faculty-assignment" element={<ProtectedRoute roles={['admin']}><FacultyAssignment /></ProtectedRoute>} />
                <Route path="/admin/student-enrollment" element={<ProtectedRoute roles={['admin']}><StudentEnrollment /></ProtectedRoute>} />
                <Route path="/admin/settings" element={<ProtectedRoute roles={['admin']}><AdminSettings /></ProtectedRoute>} />
                <Route path="/admin/admissions" element={<ProtectedRoute roles={['admin']}><AdmissionsManagement /></ProtectedRoute>} />
                <Route path="/admin/fee-management" element={<ProtectedRoute roles={['admin']}><FeeManagement /></ProtectedRoute>} />
                <Route path="/admin/reports" element={<ProtectedRoute roles={['admin']}><Reports /></ProtectedRoute>} />
                <Route path="/admin/academic-calendar" element={<ProtectedRoute roles={['admin']}><AcademicCalendar /></ProtectedRoute>} />
                <Route path="/admin/transport-management" element={<ProtectedRoute roles={['admin']}><TransportManagement /></ProtectedRoute>} />
                <Route path="/admin/grades" element={<ProtectedRoute roles={['admin']}><AdminGrades /></ProtectedRoute>} />
                <Route path="/admin/student/:id" element={<ProtectedRoute roles={['admin']}><AdminStudentProfile /></ProtectedRoute>} />
                <Route path="/admin/faculty/:id" element={<ProtectedRoute roles={['admin']}><AdminFacultyProfile /></ProtectedRoute>} />
                
                {/* Faculty Routes */}
                <Route path="/faculty" element={<Navigate to="/faculty/dashboard" replace />} />
                <Route path="/faculty/dashboard" element={<ProtectedRoute roles={['faculty']}><FacultyDashboard /></ProtectedRoute>} />
                <Route path="/faculty/attendance" element={<ProtectedRoute roles={['faculty']}><FacultyAttendance /></ProtectedRoute>} />
                <Route path="/faculty/courses" element={<ProtectedRoute roles={['faculty']}><FacultyCourses /></ProtectedRoute>} />
                <Route path="/faculty/courses/:id" element={<ProtectedRoute roles={['faculty']}><FacultyCourseDetails /></ProtectedRoute>} />
                <Route path="/faculty/online-classes" element={<ProtectedRoute roles={['faculty']}><FacultyOnlineClasses /></ProtectedRoute>} />
                <Route path="/faculty/assignments" element={<ProtectedRoute roles={['faculty']}><FacultyAssignments /></ProtectedRoute>} />
                <Route path="/faculty/teaching-assignments" element={<ProtectedRoute roles={['faculty']}><TeachingAssignments /></ProtectedRoute>} />
                <Route path="/faculty/subjects" element={<ProtectedRoute roles={['faculty']}><SubjectManagement /></ProtectedRoute>} />
                <Route path="/faculty/profile" element={<ProtectedRoute roles={['faculty']}><FacultyProfile /></ProtectedRoute>} />
                
                {/* Student Routes */}
                <Route path="/student" element={<Navigate to="/student/dashboard" replace />} />
                <Route path="/student/dashboard" element={<ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>} />
                <Route path="/student/courses" element={<ProtectedRoute roles={['student']}><StudentCourses /></ProtectedRoute>} />
                <Route path="/student/grades" element={<ProtectedRoute roles={['student']}><StudentGrades /></ProtectedRoute>} />
                <Route path="/student/assignments" element={<ProtectedRoute roles={['student']}><StudentAssignments /></ProtectedRoute>} />
                <Route path="/student/attendance" element={<ProtectedRoute roles={['student']}><StudentAttendance /></ProtectedRoute>} />
                <Route path="/student/online-classes" element={<ProtectedRoute roles={['student']}><StudentOnlineClasses /></ProtectedRoute>} />
                <Route path="/student/fee-payment" element={<ProtectedRoute roles={['student']}><StudentFeePayment /></ProtectedRoute>} />
                <Route path="/student/profile" element={<ProtectedRoute roles={['student']}><StudentProfile /></ProtectedRoute>} />
                
                {/* Fallback */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
            <Footer />
            <BackToTop />
          </div>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;