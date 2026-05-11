import React, { useState, useEffect } from 'react';
import { FaSearch, FaPlus, FaEdit, FaEye, FaDownload, FaFilter, FaMoneyBillWave, FaCalendarAlt, FaUsers, FaTrash } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import config from '../../config/config.js';
import { adminAPI } from '../../services/api.js';
import './FeeManagement.css';

export default function FeeManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    academicYear: '',
    class: '',
    status: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({});

  const classOptions = [
    { value: '', label: 'All Classes' },
    ...config.CLASS_OPTIONS
  ];

  const statusOptions = {
    payments: [
      { value: '', label: 'All Status' },
      { value: 'completed', label: 'Completed' },
      { value: 'pending', label: 'Pending' },
      { value: 'failed', label: 'Failed' },
      { value: 'refunded', label: 'Refunded' }
    ],
    dues: [
      { value: '', label: 'All Status' },
      { value: 'pending', label: 'Pending' },
      { value: 'partial', label: 'Partial' },
      { value: 'paid', label: 'Paid' },
      { value: 'overdue', label: 'Overdue' }
    ]
  };

  const paymentMethods = [
    { value: 'cash', label: 'Cash' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'online', label: 'Online' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'card', label: 'Card' }
  ];

  const toModelClass = (value) => {
    const map = {
      NS: 'Nursery',
      LKG: 'LKG',
      UKG: 'UKG',
      '1st': '1',
      '2nd': '2',
      '3rd': '3',
      '4th': '4',
      '5th': '5',
      '6th': '6',
      '7th': '7',
      '8th': '8',
      '9th': '9',
      '10th': '10',
      '11th': '11',
      '12th': '12'
    };
    return map[value] || value;
  };

  const fromModelClass = (value) => {
    const reverse = {
      Nursery: 'NS',
      LKG: 'LKG',
      UKG: 'UKG',
      '1': '1st',
      '2': '2nd',
      '3': '3rd',
      '4': '4th',
      '5': '5th',
      '6': '6th',
      '7': '7th',
      '8': '8th',
      '9': '9th',
      '10': '10th',
      '11': '11th',
      '12': '12th'
    };
    return reverse[String(value)] || value;
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, filters, searchTerm, currentPage]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShowModal(false);
    };
    if (showModal) {
      window.addEventListener('keydown', onKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showModal]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getFees({
        params: {
          type: activeTab,
          page: currentPage,
          limit: 10,
          ...(filters.academicYear && { academicYear: filters.academicYear }),
          ...(filters.class && { class: toModelClass(filters.class) }),
          ...(filters.status && { status: filters.status }),
          ...(searchTerm && { search: searchTerm })
        }
      });
      const result = response.data;
      setData(result.data);
      setError('');
    } catch (err) {
      setError(err.userMessage || 'Failed to load fee data');
      console.error('Error fetching fee data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleCreateFeeStructure = () => {
    setModalType('feeStructure');
    setSelectedItem(null);
    setFormData({
      class: '',
      academicYear: '',
      feeComponents: {
        tuitionFee: 0,
        admissionFee: 0,
        developmentFee: 0,
        examFee: 0,
        libraryFee: 0,
        sportsFee: 0,
        transportFee: 0,
        uniformFee: 0,
        booksFee: 0,
        miscellaneousFee: 0
      },
      paymentSchedule: 'yearly'
    });
    setShowModal(true);
  };

  const handleEditFeeStructure = (structure) => {
    setModalType('feeStructure');
    setSelectedItem(structure);
    setFormData({
      class: fromModelClass(structure.class),
      academicYear: structure.academicYear,
      feeComponents: structure.feeComponents || {
        tuitionFee: 0,
        admissionFee: 0,
        developmentFee: 0,
        examFee: 0,
        libraryFee: 0,
        sportsFee: 0,
        transportFee: 0,
        uniformFee: 0,
        booksFee: 0,
        miscellaneousFee: 0
      },
      paymentSchedule: structure.paymentSchedule || 'yearly'
    });
    setShowModal(true);
  };

  const handleViewFeeStructure = (structure) => {
    setModalType('viewStructure');
    setSelectedItem(structure);
    setShowModal(true);
  };

  const handleDeleteFeeStructure = async (id) => {
    if (!window.confirm('Are you sure you want to delete this fee structure?')) return;
    try {
      await adminAPI.deleteFeeStructure(id);
      await fetchData();
      alert('Fee structure deleted successfully!');
    } catch (err) {
      alert(`Error: ${err.userMessage || err.message}`);
    }
  };

  const handleRecordPayment = () => {
    setModalType('payment');
    setSelectedItem(null);
    setFormData({
      studentId: '',
      feeStructureId: '',
      paymentDetails: {
        amount: 0,
        paymentMethod: 'cash',
        paymentDate: new Date().toISOString().split('T')[0],
        transactionId: '',
        chequeNumber: '',
        bankName: ''
      },
      installmentNumber: 1,
      remarks: ''
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      if (modalType === 'feeStructure') {
        const yearPattern = /^\d{4}-\d{4}$/;
        if (!formData.class) {
          alert('Please select Class');
          return;
        }
        if (!formData.academicYear || !yearPattern.test(String(formData.academicYear))) {
          alert('Academic Year must be in format YYYY-YYYY');
          return;
        }
        if (!formData.feeComponents || isNaN(Number(formData.feeComponents.tuitionFee))) {
          alert('Please enter a valid Tuition Fee');
          return;
        }
        if (!formData.paymentSchedule) {
          alert('Please select Payment Schedule');
          return;
        }
        const payload = { ...formData, class: toModelClass(formData.class) };
        await adminAPI.createFeeStructure(payload);
      } else if (modalType === 'payment') {
        await adminAPI.recordPayment(formData);
      }

      await fetchData();
      setShowModal(false);
      setFormData({});
      alert(`${modalType === 'feeStructure' ? 'Fee structure' : 'Payment'} ${selectedItem ? 'updated' : 'created'} successfully!`);
    } catch (err) {
      alert(`Error: ${err.userMessage || err.message}`);
    }
  };

  const getStatusBadge = (status, type = 'payments') => {
    const colors = {
      payments: {
        completed: 'bg-green-100 text-green-800',
        pending: 'bg-yellow-100 text-yellow-800',
        failed: 'bg-red-100 text-red-800',
        refunded: 'bg-purple-100 text-purple-800'
      },
      dues: {
        pending: 'bg-yellow-100 text-yellow-800',
        partial: 'bg-blue-100 text-blue-800',
        paid: 'bg-green-100 text-green-800',
        overdue: 'bg-red-100 text-red-800'
      }
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[type][status] || 'bg-gray-100 text-gray-800'}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="loader">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="fee-management">
      <div className="container">
        {/* Header */}
        <div className="page-header">
          <h1 className="page-title">Fee Management</h1>
          <p className="page-subtitle">Manage fee structures, payments, and dues</p>
        </div>

        {/* Tab Navigation */}
        <div className="tabs">
          <nav className="tabs-nav">
            {['overview', 'payments', 'dues'].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setCurrentPage(1);
                }}
                className={`tab ${activeTab === tab ? 'active' : ''}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && data.type === 'overview' && (
          <div className="sections">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon stat-icon--green">
                  <FaMoneyBillWave className="icon" />
                </div>
                <div className="stat-content">
                  <p className="stat-label">Total Collection</p>
                  <p className="stat-value">{formatCurrency(data.summary?.totalCollection)}</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon stat-icon--red">
                  <FaCalendarAlt className="icon" />
                </div>
                <div className="stat-content">
                  <p className="stat-label">Pending Amount</p>
                  <p className="stat-value">{formatCurrency(data.summary?.totalPendingAmount)}</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon stat-icon--blue">
                  <FaUsers className="icon" />
                </div>
                <div className="stat-content">
                  <p className="stat-label">Fee Structures</p>
                  <p className="stat-value">{data.feeStructures?.length || 0}</p>
                </div>
              </div>
            </div>

            <div className="actions">
              <button onClick={handleCreateFeeStructure} className="btn btn-primary">
                <FaPlus />
                <span>Create Fee Structure</span>
              </button>
              <button onClick={handleRecordPayment} className="btn btn-success">
                <FaMoneyBillWave />
                <span>Record Payment</span>
              </button>
            </div>

            {/* Fee Structures */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Fee Structures</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Class
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Academic Year
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment Schedule
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.feeStructures?.map((structure) => (
                      <tr key={structure._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {fromModelClass(structure.class)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {structure.academicYear}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(structure.totalAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {structure.paymentSchedule.replace('_', ' ').toUpperCase()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button className="text-blue-600 hover:text-blue-900 mr-3" onClick={() => handleViewFeeStructure(structure)} title="View">
                            <FaEye />
                          </button>
                          <button className="text-green-600 hover:text-green-900 mr-3" onClick={() => handleEditFeeStructure(structure)} title="Edit">
                            <FaEdit />
                          </button>
                          <button className="text-red-600 hover:text-red-900" onClick={() => handleDeleteFeeStructure(structure._id)} title="Delete">
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Payments */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Recent Payments</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Receipt No.
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Method
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.recentPayments?.map((payment) => (
                      <tr key={payment._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {payment.paymentDetails.receiptNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {payment.student?.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            Class {payment.student?.class}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(payment.paymentDetails.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(payment.paymentDetails.paymentDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {payment.paymentDetails.paymentMethod.toUpperCase()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && data.type === 'payments' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by student name, receipt number, or transaction ID..."
                      value={searchTerm}
                      onChange={handleSearch}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {statusOptions.payments.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filters.class}
                    onChange={(e) => handleFilterChange('class', e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {classOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Payments Table */}
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Receipt No.
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Installment
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment Method
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.payments?.map((payment) => (
                      <tr key={payment._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {payment.paymentDetails.receiptNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {payment.student?.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {payment.student?.studentId} - Class {payment.student?.class}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(payment.paymentDetails.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {payment.installmentName || `Installment ${payment.installmentNumber || ''}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {payment.paymentDetails.paymentMethod.replace('_', ' ').toUpperCase()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(payment.paymentDetails.paymentDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(payment.status, 'payments')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button className="text-blue-600 hover:text-blue-900 mr-3">
                            <FaEye />
                          </button>
                          <button className="text-green-600 hover:text-green-900">
                            <FaDownload />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data.pagination && data.pagination.totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, data.pagination.totalPages))}
                      disabled={currentPage === data.pagination.totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Page <span className="font-medium">{currentPage}</span> of{' '}
                        <span className="font-medium">{data.pagination.totalPages}</span>
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, data.pagination.totalPages))}
                          disabled={currentPage === data.pagination.totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dues Tab */}
        {activeTab === 'dues' && data.type === 'dues' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by student name or ID..."
                      value={searchTerm}
                      onChange={handleSearch}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {statusOptions.dues.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filters.class}
                    onChange={(e) => handleFilterChange('class', e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {classOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Dues Table */}
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Class
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Installment
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Paid Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.dues?.map((due) => (
                      <tr key={due._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {due.student?.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {due.student?.studentId}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {due.student?.class}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {due.installmentName || `Installment ${due.installmentNumber || ''}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(due.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(due.paidAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(due.dueDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(due.status, 'dues')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button className="text-blue-600 hover:text-blue-900 mr-3">
                            <FaEye />
                          </button>
                          <button className="text-green-600 hover:text-green-900">
                            <FaMoneyBillWave />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data.pagination && data.pagination.totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, data.pagination.totalPages))}
                      disabled={currentPage === data.pagination.totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Page <span className="font-medium">{currentPage}</span> of{' '}
                        <span className="font-medium">{data.pagination.totalPages}</span>
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, data.pagination.totalPages))}
                          disabled={currentPage === data.pagination.totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">
                  {modalType === 'feeStructure' ? 'Create Fee Structure' : (modalType === 'payment' ? 'Record Payment' : 'Fee Structure Details')}
                </h3>
                <button className="modal-close" aria-label="Close" onClick={() => setShowModal(false)}>×</button>
              </div>
              <div className="modal-content">
                
                {modalType === 'feeStructure' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Class *
                      </label>
                      <select
                        value={formData.class}
                        onChange={(e) => setFormData(prev => ({ ...prev, class: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select Class</option>
                        {classOptions.slice(1).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Academic Year *
                      </label>
                      <input
                        type="text"
                        value={formData.academicYear}
                        onChange={(e) => setFormData(prev => ({ ...prev, academicYear: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="2024-2025"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tuition Fee *
                      </label>
                      <input
                        type="number"
                        value={formData.feeComponents?.tuitionFee || 0}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          feeComponents: { 
                            ...prev.feeComponents, 
                            tuitionFee: parseInt(e.target.value) || 0 
                          } 
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Schedule *
                      </label>
                      <select
                        value={formData.paymentSchedule}
                        onChange={(e) => setFormData(prev => ({ ...prev, paymentSchedule: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="half_yearly">Half Yearly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                  </div>
                )}

                {modalType === 'viewStructure' && selectedItem && (
                  <div className="space-y-4">
                    <div>
                      <strong>Class:</strong> {selectedItem.class}
                    </div>
                    <div>
                      <strong>Academic Year:</strong> {selectedItem.academicYear}
                    </div>
                    <div>
                      <strong>Payment Schedule:</strong> {String(selectedItem.paymentSchedule).replace('_', ' ')}
                    </div>
                    <div>
                      <strong>Total Amount:</strong> {formatCurrency(selectedItem.totalAmount || (selectedItem.feeComponents ? Object.values(selectedItem.feeComponents).reduce((s,v)=>s+Number(v||0),0) : 0))}
                    </div>
                    {selectedItem.feeComponents && (
                      <div>
                        <strong>Components:</strong>
                        <div className="components-grid" style={{ marginTop: '8px' }}>
                          {Object.entries(selectedItem.feeComponents).map(([key, val]) => (
                            <div className="component-item" key={key}>
                              <span className="component-name">{key.replace('_',' ')}</span>
                              <span className="component-amount">{formatCurrency(val)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {modalType === 'payment' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Student ID *
                      </label>
                      <input
                        type="text"
                        value={formData.studentId}
                        onChange={(e) => setFormData(prev => ({ ...prev, studentId: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter student ID"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount *
                      </label>
                      <input
                        type="number"
                        value={formData.paymentDetails?.amount || 0}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          paymentDetails: { 
                            ...prev.paymentDetails, 
                            amount: parseInt(e.target.value) || 0 
                          } 
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Method *
                      </label>
                      <select
                        value={formData.paymentDetails?.paymentMethod}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          paymentDetails: { 
                            ...prev.paymentDetails, 
                            paymentMethod: e.target.value 
                          } 
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        {paymentMethods.map((method) => (
                          <option key={method.value} value={method.value}>
                            {method.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="modal-actions">
                  <button onClick={() => setShowModal(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  {modalType !== 'viewStructure' && (
                  <button onClick={handleSubmit} className="btn btn-primary"
                  >
                    {modalType === 'feeStructure' ? (selectedItem ? 'Update Structure' : 'Create Structure') : 'Record Payment'}
                  </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}