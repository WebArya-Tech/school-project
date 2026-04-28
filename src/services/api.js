import axios from 'axios';
import config from '../config/config.js';

// Base API configuration
// Force dev to use Vite proxy (`/api`) to avoid direct localhost calls
// Ignore VITE_API_BASE_URL in development to prevent cross-port issues
const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.DEV)
  ? '/api'
  : config.API_BASE_URL;

// Loading state management
let loadingRequests = new Set();
let loadingCallbacks = new Set();
let isRefreshing = false;
let refreshSubscribers = [];

export const apiLoadingState = {
  addCallback: (callback) => {
    loadingCallbacks.add(callback);
  },
  removeCallback: (callback) => {
    loadingCallbacks.delete(callback);
  },
  isLoading: () => loadingRequests.size > 0,
  getActiveRequests: () => loadingRequests.size
};

// Notify loading state changes
const notifyLoadingChange = () => {
  const isLoading = loadingRequests.size > 0;
  loadingCallbacks.forEach(callback => callback(isLoading, loadingRequests.size));
};

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helpful dev log to confirm base URL routing
if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  console.log('[API] Base URL (dev):', API_BASE_URL);
}

// Request interceptor to add auth token and track loading
api.interceptors.request.use(
  (config) => {
    // Add request to loading tracker
    const requestId = `${config.method}-${config.url}-${Date.now()}`;
    config.metadata = { requestId };
    loadingRequests.add(requestId);
    notifyLoadingChange();

    // Add auth token
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add request timestamp for performance monitoring
    config.metadata.startTime = Date.now();

    return config;
  },
  async (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and loading tracking
api.interceptors.response.use(
  (response) => {
    // Remove request from loading tracker
    if (response.config.metadata?.requestId) {
      loadingRequests.delete(response.config.metadata.requestId);
      notifyLoadingChange();
    }

    // Log performance in development
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV && response.config.metadata?.startTime) {
      const duration = Date.now() - response.config.metadata.startTime;
      console.log(`API Request: ${response.config.method?.toUpperCase()} ${response.config.url} - ${duration}ms`);
    }

    return response;
  },
  async (error) => {
    // Remove request from loading tracker
    if (error.config?.metadata?.requestId) {
      loadingRequests.delete(error.config.metadata.requestId);
      notifyLoadingChange();
    }

    // Enhanced error handling
    if (error.response?.status === 401) {
      const originalRequest = error.config;
      
      // Prevent infinite loops if retry also fails
      if (originalRequest._retry) {
        if (!config.IS_E2E) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('userRole');
          window.location.href = '/';
        }
        return Promise.reject(error);
      }

      // NEVER retry or refresh for login/auth routes - 401 here means wrong credentials
      // ✅ FIX: Added /auth/verify to prevent refresh loop on app load with bad/expired token
      const isAuthPath = [
        '/auth/login',
        '/auth/register',
        '/auth/forgot-password',
        '/auth/reset-password',
        '/auth/refresh',
        '/auth/verify',  // ✅ ADDED: prevents token refresh loop on failed verify
      ].some(path => String(originalRequest?.url || '').includes(path));

      if (isAuthPath) {
        if (!config.IS_E2E && String(originalRequest?.url || '').includes('/auth/refresh')) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('userRole');
          window.location.href = '/';
        }
        return Promise.reject(error);
      }

      const rt = localStorage.getItem('refreshToken');
      if (!rt) {
        if (!config.IS_E2E) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('userRole');
          window.location.href = '/';
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshSubscribers.push((token) => {
            if (!token) return reject(error);
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${token}`;
            originalRequest._retry = true;
            resolve(api(originalRequest));
          });
        });
      }

      try {
        isRefreshing = true;
        const res = await api.post('/auth/refresh', { refreshToken: rt });
        const newToken = res.data?.data?.token;
        const newRefresh = res.data?.data?.refreshToken;
        isRefreshing = false;
        const subs = refreshSubscribers.slice();
        refreshSubscribers = [];
        if (newToken) {
          localStorage.setItem('authToken', newToken);
          if (newRefresh) localStorage.setItem('refreshToken', newRefresh);
          subs.forEach((cb) => { try { cb(newToken); } catch (_) { void 0; } });
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          originalRequest._retry = true;
          return api(originalRequest);
        }
      } catch (_) {
        isRefreshing = false;
        refreshSubscribers = [];
      }

      if (!config.IS_E2E) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userRole');
        window.location.href = '/';
      }
    }

    // Add user-friendly error messages
    const enhancedError = {
      ...error,
      userMessage: getUserFriendlyErrorMessage(error),
      isNetworkError: !error.response,
      statusCode: error.response?.status,
      timestamp: new Date().toISOString()
    };

    return Promise.reject(enhancedError);
  }
);

// Helper function to get user-friendly error messages
const getUserFriendlyErrorMessage = (error) => {
  if (error.code === 'ECONNABORTED') {
    return 'Request timed out. Please try again.';
  }
  if (!error.response) {
    return 'Network error. Please check your internet connection.';
  }

  const status = error.response.status;
  const message = error.response.data?.message || error.message;
  const detailsArray = error.response.data?.errors;
  const detailString = Array.isArray(detailsArray) && detailsArray.length
    ? `: ${detailsArray.map(d => `${d.path}: ${d.message}`).join('; ')}`
    : (error.response.data?.error ? `: ${error.response.data.error}` : '');

  switch (status) {
    case 400:
      return (message || 'Invalid request. Please check your input.') + detailString;
    case 401:
      return (message || 'Authentication required. Please log in again.');
    case 403:
      return (message || 'You do not have permission to perform this action.') + detailString;
    case 404:
      return 'The requested resource was not found.';
    case 405:
      return 'Method not allowed. Please contact support.';
    case 408:
      return 'Request timeout. Please try again.';
    case 409:
      return message || 'Conflict with existing data.';
    case 413:
      return 'File size too large. Please upload a smaller file.';
    case 422:
      return (message || 'Validation error. Please check your input.') + detailString;
    case 429:
      return 'Too many requests. Please try again later.';
    case 500:
      return 'Internal server error. Our team has been notified.';
    case 502:
    case 503:
    case 504:
      return 'Service temporarily unavailable. Please try again later.';
    default:
      return message || 'An unexpected error occurred. Please try again.';
  }
};

// Retry logic for failed requests
const retryRequest = async (originalRequest, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      return await api(originalRequest);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      if (error.response?.status < 500) throw error; // Don't retry client errors
    }
  }
};

// Enhanced API wrapper with loading states and retry logic
const createAPIMethod = (method, url, options = {}) => {
  return async (data, config = {}) => {
    const { retry = false, retryCount = 3, ...restConfig } = config;
    
    try {
      let response;
      if (method === 'get' || method === 'delete') {
        response = await api[method](url, { ...restConfig, ...options });
      } else {
        response = await api[method](url, data, { ...restConfig, ...options });
      }
      return response;
    } catch (error) {
      if (retry && error.response?.status >= 500) {
        return retryRequest({ method, url, data, ...restConfig }, retryCount);
      }
      throw error;
    }
  };
};

// Authentication API calls
export const authAPI = {
  login: (credentials) => {
    return api.post('/auth/login', credentials);
  },
  register: (userData) => api.post('/auth/register', userData),
  logout: () => api.post('/auth/logout'),
  verifyToken: () => api.get('/auth/verify'),
  forgotPassword: (payload) => api.post('/auth/forgot-password', payload),
  resetPassword: (payload) => api.post('/auth/reset-password', payload),
};

// Admin API calls
export const adminAPI = {
  // Dashboard
  getDashboard: (config) => api.get('/admin/dashboard', config),

  // Students
  getStudents: (config) => api.get('/admin/students', config),
  getStudentById: (id, config) => api.get(`/admin/students/${id}`, config),
  addStudent: (studentData, config) => api.post('/admin/students', studentData, config),
  updateStudent: (id, studentData, config) => api.put(`/admin/students/${id}`, studentData, config),
  deleteStudent: (id, config) => api.delete(`/admin/students/${id}`, config),

  // Faculty
  getFaculty: (config) => api.get('/admin/faculty', config),
  addFaculty: (facultyData, config) => api.post('/admin/faculty', facultyData, config),
  updateFaculty: (id, facultyData, config) => api.put(`/admin/faculty/${id}`, facultyData, config),
  deleteFaculty: (id, config) => api.delete(`/admin/faculty/${id}`, config),

  // Reports
  getReports: (config) => api.get('/admin/reports', config),

  // Assignments (Faculty-course-class assignments)
  getAssignments: (config) => api.get('/admin/assignments', config),
  createAssignment: (assignmentData, config) => api.post('/admin/assignments', assignmentData, config),
  updateAssignment: (id, assignmentData, config) => api.put(`/admin/assignments/${id}`, assignmentData, config),
  deleteAssignment: (id, config) => api.delete(`/admin/assignments/${id}`, config),

  // Schedules (Timetable management)
  getSchedules: (config) => api.get('/admin/schedules', config),
  createSchedule: (scheduleData, config) => api.post('/admin/schedules', scheduleData, config),
  updateSchedule: (id, scheduleData, config) => api.put(`/admin/schedules/${id}`, scheduleData, config),
  deleteSchedule: (id, config) => api.delete(`/admin/schedules/${id}`, config),

  // Admissions
  getAdmissions: (config) => api.get('/admin/admissions', config),
  approveAdmission: (id, payload, config) => api.put(`/admin/admissions/${id}/approve`, payload, config),
  rejectAdmission: (id, payload, config) => api.put(`/admin/admissions/${id}/reject`, payload, config),

  // Fees
  getFees: (config) => api.get('/admin/fees', config),
  createFeeStructure: (feeStructureData, config) => api.post('/admin/fees/structure', feeStructureData, config),
  recordPayment: (paymentData, config) => api.post('/admin/fees/payment', paymentData, config),

  // Grades
  createGrade: (gradeData, config) => api.post('/admin/grades', gradeData, config),
  getGrades: (params = {}, config = {}) => api.get('/admin/grades', { params, ...config }),

  // NEW: minimal subject creation (Course with defaults)
  createSimpleSubject: (payload, config) => api.post('/admin/subjects/simple', payload, config),
};

// Student API calls
export const studentAPI = {
  getDashboard: () => api.get('/student/dashboard'),
  getProfile: () => api.get('/student/profile'),
  updateProfile: (profileData) => api.put('/student/profile', profileData),
  getAttendance: () => api.get('/student/attendance'),
  getGrades: () => api.get('/student/grades'),
  getFees: () => api.get('/student/fees'),
  payFees: (paymentData) => api.post('/student/fees/payment', paymentData),
  getFeeStructures: (params = {}) => api.get('/student/fees/structures', { params }),
  getClasses: () => api.get('/student/courses'),
  getOnlineClasses: (params = {}) => api.get('/student/online-classes', { params }),
  joinOnlineClass: (id) => api.post(`/student/online-classes/${id}/join`),
  getAssignments: (params = {}) => api.get('/student/assignments', { params }),
  submitAssignment: (id, payload) => api.post(`/student/assignments/${id}/submit`, payload),
};

// Faculty API calls
export const facultyAPI = {
  getDashboard: (params = {}) => api.get('/faculty/dashboard', { params }),
  getProfile: () => api.get('/faculty/profile'),
  updateProfile: (profileData) => api.put('/faculty/profile', profileData),
  getClasses: () => api.get('/faculty/classes'),
  getCourses: (params = {}) => api.get('/faculty/courses', { params }),
  createCourse: (courseData) => api.post('/faculty/courses', courseData),
  getAssignments: (params = {}) => api.get('/faculty/assignments', { params }),
  createAssignment: (payload) => api.post('/faculty/assignments', payload),
  getAssignmentSubmissions: (id, params = {}) => api.get(`/faculty/assignments/${id}/submissions`, { params }),
  // Admin-assigned teaching assignments for the logged-in faculty
  getTeachingAssignments: (params = {}) => api.get('/faculty/teaching-assignments', { params }),
  getStudents: () => api.get('/faculty/students'),
  markAttendance: (attendanceData) => api.post('/faculty/attendance', attendanceData),
  // Fetch attendance records with optional query parameters
  // params can include: course, student, date_from, date_to, session
  getAttendance: (params = {}) => api.get('/faculty/attendance', { params }),
  // Online Classes Management
  getOnlineClasses: (params = {}) => api.get('/faculty/online-classes', { params }),
  createOnlineClass: (classData) => api.post('/faculty/online-classes', classData),
  updateOnlineClass: (id, classData) => api.put(`/faculty/online-classes/${id}`, classData),
  deleteOnlineClass: (id) => api.delete(`/faculty/online-classes/${id}`),
  updateOnlineClassStatus: (id, status) => api.patch(`/faculty/online-classes/${id}/status`, { status }),
  deleteCourse: (id, config) => api.delete(`/faculty/courses/${id}`, config),
};

// Subjects API calls
export const subjectAPI = {
  // Managed subjects (private, requires auth)
  getSubjects: (params = {}, config = {}) => api.get('/subjects', { params, ...config }),
  getSubjectById: (id, config) => api.get(`/subjects/${id}`, config),
  createSubject: (subjectData, config) => api.post('/subjects', subjectData, config),
  updateSubject: (id, subjectData, config) => api.put(`/subjects/${id}`, subjectData, config),
  deleteSubject: (id, config) => api.delete(`/subjects/${id}`, config),
  addCurriculumUnit: (id, unitData, config) => api.post(`/subjects/${id}/curriculum/units`, unitData, config),
  assignFaculty: (id, payload, config) => api.post(`/subjects/${id}/faculty`, payload, config),
  updateApprovalStatus: (id, payload, config) => api.put(`/subjects/${id}/approval`, payload, config),
  getDepartmentStats: (config) => api.get('/subjects/departments/stats', config),
};

// General API calls
export const generalAPI = {
  sendOTP: (mobile) => api.post('/general/send-otp', { mobile }),
  verifyOTP: (mobile, otp) => api.post('/general/verify-otp', { mobile, otp }),
  sendEmailOTP: (email) => api.post('/general/send-email-otp', { email }),
  verifyEmailOTP: (email, otp) => api.post('/general/verify-email-otp', { email, otp }),
  submitAdmission: (admissionData) => api.post('/general/admissions', admissionData),
  getNotices: () => api.get('/general/notices'),
  // Academy updates (notices)
  createNotice: (noticeData, config) => api.post('/general/notices', noticeData, config),
  updateNotice: (id, noticeData, config) => api.put(`/general/notices/${id}`, noticeData, config),
  deleteNotice: (id, config) => api.delete(`/general/notices/${id}`, config),
  // Fetch public academic events with optional filters
  // Example: generalAPI.getEvents({ eventType: 'Administrative' })
  getEvents: (params = {}) => api.get('/general/events', { params }),
  // Public subjects (basic info only)
  getPublicSubjects: (params = {}) => api.get('/general/subjects/public', { params }),
};

export const paymentsAPI = {
  create: (payload) => api.post('/payments/create', payload),
  capture: (payload) => api.post('/payments/capture', payload)
};

// Admin Calendar API calls (manage AcademicCalendar)
export const calendarAPI = {
  getEvents: (params = {}, config = {}) => api.get('/calendar', { params, ...config }),
  getEventById: (id, config = {}) => api.get(`/calendar/${id}`, { ...config }),
  createEvent: (eventData, config = {}) => api.post('/calendar', eventData, { ...config }),
  updateEvent: (id, eventData, config = {}) => api.put(`/calendar/${id}`, eventData, { ...config }),
  deleteEvent: (id, config = {}) => api.delete(`/calendar/${id}`, { ...config }),
};

export default api;
