import React, { useEffect, useState } from 'react';
import { FaCreditCard, FaUniversity, FaWallet, FaDownload, FaCheckCircle, FaExclamationTriangle, FaClock, FaMoneyBillWave } from 'react-icons/fa';
import { studentAPI, paymentsAPI } from '../../services/api';
import config from '../../config/config.js';
import jsPDF from 'jspdf';

export default function FeePayment() {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('card');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedFee, setSelectedFee] = useState(null);
  const [fees, setFees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [studentProfile, setStudentProfile] = useState(null);
  const [quickPayAmount, setQuickPayAmount] = useState('');
  const [summary, setSummary] = useState({ totalDue: 0, totalPaid: 0, totalFeeAmount: 0 });
  const [cashReceiptNumber, setCashReceiptNumber] = useState('');
  const [receiptPhotoBase64, setReceiptPhotoBase64] = useState('');

  const handleReceiptPhotoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setReceiptPhotoBase64(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const loadFees = async () => {
      setIsLoading(true);
      try {
        const res = await studentAPI.getFees();
        const payload = res?.data?.data || {};
        setStudentProfile(payload.student || null);
        const dues = Array.isArray(payload.dues) ? payload.dues : [];
        const payments = Array.isArray(payload.payments) ? payload.payments : [];
        const normalized = dues.map(d => ({
          id: String(d._id || Math.random()),
          type: d.installmentName || `Installment ${d.installmentNumber}`,
          amount: Number(d.amount || 0),
          dueDate: d.dueDate || new Date().toISOString(),
          status: d.status || 'pending',
          session: '',
          description: '',
          paidDate: d.status === 'paid' ? (payments.find(p => p.installmentNumber === d.installmentNumber)?.paymentDetails?.paymentDate || null) : null
        }));
        setFees(normalized);
        const srvSummary = payload.summary || { totalDue: 0, totalPaid: 0, totalFeeAmount: 0 };
        setSummary({
          totalDue: Number(srvSummary.totalDue || 0),
          totalPaid: Number(srvSummary.totalPaid || 0),
          totalFeeAmount: Number(srvSummary.totalFeeAmount || 0)
        });
        const pendingTotal = Number(srvSummary.totalDue || 0);
        if (!quickPayAmount) setQuickPayAmount(String(pendingTotal || ''));
        setHistory(payments.map(p => ({
          id: String(p._id || Math.random()),
          type: p.installmentName || `Installment ${p.installmentNumber}`,
          amount: Number(p.paymentDetails?.amount || 0),
          date: p.paymentDetails?.paymentDate || new Date().toISOString(),
          transactionId: p.paymentDetails?.transactionId || '',
          method: p.paymentDetails?.paymentMethod || ''
        })));
      } catch (error) {
        setFees([]);
        setHistory([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadFees();
  }, []);

  const [history, setHistory] = useState([]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return '#28a745';
      case 'pending': return '#ffc107';
      case 'overdue': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid': return <FaCheckCircle />;
      case 'pending': return <FaClock />;
      case 'overdue': return <FaExclamationTriangle />;
      default: return <FaClock />;
    }
  };

  const handlePayNow = (fee) => {
    setSelectedFee(fee);
    setShowPaymentModal(true);
  };

  const processPayment = async () => {
    if (!selectedFee) return;

    if (selectedPaymentMethod === 'cash') {
      if (!cashReceiptNumber) {
        alert('Please enter the cash receipt number or transaction ID');
        return;
      }
      if (!receiptPhotoBase64) {
        alert('Please upload a photo of the cash receipt');
        return;
      }
      try {
        const res = await studentAPI.payFees({ 
          dueId: selectedFee.id, 
          paymentMethod: 'cash', 
          transactionId: cashReceiptNumber,
          receiptPhoto: receiptPhotoBase64
        });
        const p = res?.data?.data?.payment;
        alert(`Payment of ₹${selectedFee.amount} processed successfully!`);
        setFees(prev => prev.map(f => f.id === selectedFee.id ? { ...f, status: 'paid', paidDate: new Date().toISOString() } : f));
        setSummary(prev => ({
          totalDue: Math.max(0, Number(prev.totalDue || 0) - Number(selectedFee.amount || 0)),
          totalPaid: Number(prev.totalPaid || 0) + Number(selectedFee.amount || 0),
          totalFeeAmount: Number(prev.totalFeeAmount || 0)
        }));
        if (p) {
          setHistory(prev => [{
            id: String(p._id || Math.random()),
            type: `Installment ${p.installmentNumber}`,
            amount: Number(p.paymentDetails?.amount || 0),
            date: p.paymentDetails?.paymentDate || new Date().toISOString(),
            transactionId: p.paymentDetails?.transactionId || '',
            method: p.paymentDetails?.paymentMethod || ''
          }, ...prev]);
        }
      } catch (e) {
        alert(e.userMessage || 'Payment failed');
      } finally {
        setShowPaymentModal(false);
        setSelectedFee(null);
        setCashReceiptNumber('');
        setReceiptPhotoBase64('');
      }
      return;
    }

    try {
      const create = await paymentsAPI.create({ amount: selectedFee.amount, currency: 'INR', description: selectedFee.type, metadata: { dueId: selectedFee.id } });
      const { intent, keyId } = create.data || {};
      const load = await new Promise((resolve, reject) => {
        if (window.Razorpay) return resolve(true);
        const s = document.createElement('script');
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = () => resolve(true);
        s.onerror = reject;
        document.body.appendChild(s);
      });
      void load;
      const options = {
        key: keyId || config.RAZORPAY_KEY_ID,
        amount: intent?.amount,
        currency: intent?.currency || 'INR',
        name: config.APP_NAME,
        description: selectedFee.type,
        order_id: intent?.id,
        prefill: {},
        handler: async (response) => {
          try {
            const cap = await paymentsAPI.capture({ paymentId: response.razorpay_payment_id, orderId: response.razorpay_order_id, signature: response.razorpay_signature });
            void cap;
            const res = await studentAPI.payFees({ dueId: selectedFee.id, paymentMethod: 'online', transactionId: response.razorpay_payment_id });
            const p = res?.data?.data?.payment;
            alert(`Payment of ₹${selectedFee.amount} processed successfully!`);
            setFees(prev => prev.map(f => f.id === selectedFee.id ? { ...f, status: 'paid', paidDate: new Date().toISOString() } : f));
            setSummary(prev => ({
              totalDue: Math.max(0, Number(prev.totalDue || 0) - Number(selectedFee.amount || 0)),
              totalPaid: Number(prev.totalPaid || 0) + Number(selectedFee.amount || 0),
              totalFeeAmount: Number(prev.totalFeeAmount || 0)
            }));
            if (p) {
              setHistory(prev => [{
                id: String(p._id || Math.random()),
                type: `Installment ${p.installmentNumber}`,
                amount: Number(p.paymentDetails?.amount || 0),
                date: p.paymentDetails?.paymentDate || new Date().toISOString(),
                transactionId: p.paymentDetails?.transactionId || '',
                method: p.paymentDetails?.paymentMethod || ''
              }, ...prev]);
            }
          } catch (e) {
            alert(e.userMessage || 'Payment verification failed');
          } finally {
            setShowPaymentModal(false);
            setSelectedFee(null);
          }
        }
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      alert(error.userMessage || 'Payment failed. Please try again.');
      setShowPaymentModal(false);
      setSelectedFee(null);
    }
  };

  const processQuickPay = async () => {
    const amt = Number(quickPayAmount || 0);
    if (!amt || amt <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    try {
      const create = await paymentsAPI.create({ amount: amt, currency: 'INR', description: 'Fee Payment', metadata: { source: 'quickPay' } });
      const { intent, keyId } = create.data || {};
      const load = await new Promise((resolve, reject) => {
        if (window.Razorpay) return resolve(true);
        const s = document.createElement('script');
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = () => resolve(true);
        s.onerror = reject;
        document.body.appendChild(s);
      });
      void load;
      const options = {
        key: keyId || config.RAZORPAY_KEY_ID,
        amount: intent?.amount,
        currency: intent?.currency || 'INR',
        name: config.APP_NAME,
        description: 'Fee Payment',
        order_id: intent?.id,
        prefill: { name: studentProfile?.name },
        handler: async (response) => {
          try {
            const cap = await paymentsAPI.capture({
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              signature: response.razorpay_signature,
              studentId: studentProfile?.studentId,
              studentName: studentProfile?.name,
              class: studentProfile?.class,
              amount: amt
            });
            void cap;
            alert(`Payment of ₹${amt} processed successfully!`);
            setSummary(prev => ({
              totalDue: Math.max(0, Number(prev.totalDue || 0) - Number(amt || 0)),
              totalPaid: Number(prev.totalPaid || 0) + Number(amt || 0),
              totalFeeAmount: Number(prev.totalFeeAmount || 0)
            }));
          } catch (e) {
            alert(e.userMessage || 'Payment verification failed');
          }
        }
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      alert(error.userMessage || 'Payment failed. Please try again.');
    }
  };

  const totalPending = Number(summary.totalDue || 0);
  const totalPaid = Number(summary.totalPaid || 0);

  const handleDownloadReceipt = (item) => {
    const doc = new jsPDF();
    const marginLeft = 20;

    doc.setFontSize(18);
    doc.text('BBD Academy - Fee Payment Receipt', marginLeft, 20);

    doc.setFontSize(12);
    doc.text(`Receipt Date: ${new Date().toLocaleDateString()}`, marginLeft, 40);

    doc.text('Student Details:', marginLeft, 60);
    doc.text(`Student ID: ${studentProfile?.studentId || 'N/A'}`, marginLeft, 68);
    doc.text(`Student Name: ${studentProfile?.name || 'N/A'}`, marginLeft, 76);
    doc.text(`Class: ${studentProfile?.class || 'N/A'}`, marginLeft, 84);

    doc.text('Payment Details:', marginLeft, 100);
    doc.text(`Fee Type: ${item.type}`, marginLeft, 108);
    doc.text(`Amount Paid: Rs. ${item.amount}`, marginLeft, 116);
    
    let currentY = 124;
    const paymentDate = item.paidDate || item.date;
    if (paymentDate) {
      doc.text(`Payment Date: ${new Date(paymentDate).toLocaleDateString()}`, marginLeft, currentY);
      currentY += 8;
    }
    
    if (item.method) {
      doc.text(`Payment Method: ${item.method.toUpperCase()}`, marginLeft, currentY);
      currentY += 8;
    }

    if (item.transactionId) {
      doc.text(`Transaction ID: ${item.transactionId}`, marginLeft, currentY);
      currentY += 8;
    }
    
    doc.text(`Status: PAID`, marginLeft, currentY);

    doc.text('Thank you for your payment!', marginLeft, currentY + 28);

    doc.save(`Receipt-${item.transactionId || item.type.replace(/\s+/g, '-')}.pdf`);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '30px', color: '#333' }}>Fee Payment</h1>

      {/* Fee Summary */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '20px',
          borderRadius: '10px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Total Pending</h3>
          <p style={{ margin: '0', fontSize: '2rem', fontWeight: 'bold' }}>₹{totalPending.toLocaleString()}</p>
        </div>
        
        <div style={{
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          color: 'white',
          padding: '20px',
          borderRadius: '10px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Total Paid</h3>
          <p style={{ margin: '0', fontSize: '2rem', fontWeight: 'bold' }}>₹{totalPaid.toLocaleString()}</p>
        </div>
        
        <div style={{
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          color: 'white',
          padding: '20px',
          borderRadius: '10px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Total Fees</h3>
          <p style={{ margin: '0', fontSize: '2rem', fontWeight: 'bold' }}>₹{(totalPending + totalPaid).toLocaleString()}</p>
        </div>
      </div>

      {/* Current Fees */}
      <div style={{
        background: 'white',
        borderRadius: '10px',
        padding: '25px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
        marginBottom: '30px'
      }}>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>Current Session Fees</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {(!isLoading && fees.length === 0) && (
            <div style={{
              border: '1px solid #e9ecef',
              borderRadius: '8px',
              padding: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#fff'
            }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, color: '#333' }}>Quick Pay</h4>
                <p style={{ margin: '6px 0', color: '#666', fontSize: '0.9rem' }}>Enter amount to pay your fees online</p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input type="number" min="1" value={quickPayAmount} onChange={(e) => setQuickPayAmount(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e0e0e0' }} />
                  <span style={{ color: '#333', fontWeight: 600 }}>₹</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <button
                  onClick={processQuickPay}
                  style={{ background: '#007bff', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  Pay Now
                </button>
              </div>
            </div>
          )}
          {(isLoading ? [] : fees).map(fee => (
            <div key={fee.id} style={{
              border: '1px solid #e9ecef',
              borderRadius: '8px',
              padding: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: fee.status === 'overdue' ? '#fff5f5' : '#fff'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                  <h4 style={{ margin: '0', color: '#333' }}>{fee.type}</h4>
                  <span style={{ 
                    color: getStatusColor(fee.status),
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.9rem'
                  }}>
                    {getStatusIcon(fee.status)}
                    {fee.status.charAt(0).toUpperCase() + fee.status.slice(1)}
                  </span>
                </div>
                <p style={{ margin: '0', color: '#666', fontSize: '0.9rem' }}>{fee.description}</p>
                <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '0.8rem' }}>
                  Due: {new Date(fee.dueDate).toLocaleDateString()}
                  {fee.paidDate && ` | Paid: ${new Date(fee.paidDate).toLocaleDateString()}`}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '1.2rem', fontWeight: 'bold', color: '#333' }}>
                  ₹{fee.amount.toLocaleString()}
                </p>
                {fee.status !== 'paid' && (
                  <button
                    onClick={() => handlePayNow(fee)}
                    style={{
                      background: fee.status === 'overdue' ? '#dc3545' : '#007bff',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    Pay Now
                  </button>
                )}
                {fee.status === 'paid' && (
                  <button
                    onClick={() => handleDownloadReceipt(fee)}
                    style={{
                      background: '#6c757d',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    <FaDownload style={{ marginRight: '5px' }} />
                    Receipt
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment History */}
      <div style={{
        background: 'white',
        borderRadius: '10px',
        padding: '25px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>Payment History</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Fee Type</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Amount</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Date</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Transaction ID</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Method</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {history.map(payment => (
                <tr key={payment.id}>
                  <td style={{ padding: '12px', borderBottom: '1px solid #dee2e6' }}>{payment.type}</td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #dee2e6' }}>₹{payment.amount.toLocaleString()}</td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #dee2e6' }}>{new Date(payment.date).toLocaleDateString()}</td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #dee2e6' }}>{payment.transactionId}</td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #dee2e6' }}>{payment.method}</td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #dee2e6' }}>
                    <button 
                      onClick={() => handleDownloadReceipt(payment)}
                      style={{
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}>
                      <FaDownload style={{ marginRight: '5px' }} />
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '10px',
            padding: '30px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ marginBottom: '20px', color: '#333' }}>Payment Details</h3>
            
            <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>{selectedFee?.type}</p>
              <p style={{ margin: '0 0 5px 0', color: '#666' }}>{selectedFee?.description}</p>
              <p style={{ margin: '0', fontSize: '1.2rem', fontWeight: 'bold', color: '#007bff' }}>
                Amount: ₹{selectedFee?.amount.toLocaleString()}
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '15px', color: '#333' }}>Payment Method</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    value="card"
                    checked={selectedPaymentMethod === 'card'}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  />
                  <FaCreditCard />
                  Credit/Debit Card
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    value="netbanking"
                    checked={selectedPaymentMethod === 'netbanking'}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  />
                  <FaUniversity />
                  Net Banking
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    value="wallet"
                    checked={selectedPaymentMethod === 'wallet'}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  />
                  <FaWallet />
                  Digital Wallet
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    value="cash"
                    checked={selectedPaymentMethod === 'cash'}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  />
                  <FaMoneyBillWave />
                  Cash (Upload Receipt)
                </label>
              </div>
            </div>

            {selectedPaymentMethod === 'cash' && (
              <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Cash Receipt Number / Transaction ID *</label>
                  <input 
                    type="text" 
                    value={cashReceiptNumber} 
                    onChange={(e) => setCashReceiptNumber(e.target.value)} 
                    placeholder="Enter receipt number" 
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Upload Receipt Photo *</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleReceiptPhotoUpload} 
                    style={{ width: '100%' }}
                  />
                  {receiptPhotoBase64 && (
                    <div style={{ marginTop: '10px' }}>
                      <img src={receiptPhotoBase64} alt="Preview" style={{ maxWidth: '100%', maxHeight: '150px', objectFit: 'contain', border: '1px solid #ccc', padding: '2px', borderRadius: '4px' }} />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowPaymentModal(false)}
                style={{
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={processPayment}
                style={{
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Pay ₹{selectedFee?.amount.toLocaleString()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
