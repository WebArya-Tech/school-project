import { useEffect, useState } from 'react';
import { FaDownload, FaCreditCard, FaUniversity, FaMoneyBillWave, FaQrcode, FaCheck } from 'react-icons/fa';
import './FeePayment.css';

// Add jsPDF import
import jsPDF from 'jspdf';
import { studentAPI, paymentsAPI } from '../../services/api.js';
import config from '../../config/config.js';

const FeePayment = () => {
  const [activeTab, setActiveTab] = useState('card');
  const [studentInfo, setStudentInfo] = useState({
    studentId: '',
    studentName: '',
    class: '',
    feeAmount: ''
  });
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [feeStructures, setFeeStructures] = useState([]);
  const [loadingFees, setLoadingFees] = useState(false);
  const [feesError, setFeesError] = useState('');
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

  const toModelClass = (value) => {
    if (value === 'NS') return 'Nursery';
    return value; // LKG, UKG, and numeric strings 1-12 already match the DB
  };

  const fromModelClass = (value) => {
    if (value === 'Nursery') return 'NS';
    return value;
  };

  useEffect(() => {
    const fetchFeeStructures = async () => {
      try {
        setLoadingFees(true);
        const res = await studentAPI.getFeeStructures();
        const list = res.data?.data || [];
        setFeeStructures(list);
      } catch (err) {
        setFeesError(err.userMessage || 'Failed to load fee structures');
      } finally {
        setLoadingFees(false);
      }
    };
    fetchFeeStructures();
  }, []);

  const handleStudentInfoChange = (e) => {
    const { name, value } = e.target;
    setStudentInfo(prevState => ({ ...prevState, [name]: value }));
  };

  const fetchStudentDues = async () => {
    if (!studentInfo.studentId) {
      alert('Please enter a Student ID');
      return;
    }
    try {
      setLoadingFees(true);
      setFeesError('');
      const res = await studentAPI.getPublicFeeInfo(studentInfo.studentId);
      const data = res.data?.data;
      if (data) {
        setStudentInfo(prev => ({
          ...prev,
          studentName: data.studentName,
          class: data.class,
          feeAmount: String(data.totalDue)
        }));
      }
    } catch (err) {
      setFeesError(err.userMessage || 'Failed to fetch student dues');
      alert(err.userMessage || 'Failed to fetch student dues. Check Student ID.');
    } finally {
      setLoadingFees(false);
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    try {
      const amount = Number(studentInfo.feeAmount || 0);
      if (!amount || amount <= 0) {
        alert('Please select a class to auto-fill fee amount');
        return;
      }

      if (activeTab === 'cash') {
        if (!cashReceiptNumber) {
          alert('Please enter the cash receipt number or transaction ID');
          return;
        }
        if (!receiptPhotoBase64) {
          alert('Please upload a photo of the cash receipt');
          return;
        }

        await studentAPI.processPublicPayment({
          studentId: studentInfo.studentId,
          paymentMethod: 'cash',
          transactionId: cashReceiptNumber,
          amount: amount,
          receiptPhoto: receiptPhotoBase64
        });

        const receiptNumber = `PUB-${Math.floor(Math.random() * 100000)}`;
        const paymentDate = new Date().toLocaleDateString();
        setReceiptData({
          receiptNumber,
          paymentDate,
          studentId: studentInfo.studentId,
          studentName: studentInfo.studentName,
          class: studentInfo.class,
          amount: String(amount),
          paymentMethod: getPaymentMethodName(activeTab)
        });
        setPaymentComplete(true);
        return;
      }

      const create = await paymentsAPI.create({ amount, currency: 'INR', description: 'Fee Payment', metadata: { studentId: studentInfo.studentId } });
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
        prefill: { name: studentInfo.studentName },
        handler: async (response) => {
          try {
            // Verify payment signature
            const cap = await paymentsAPI.capture({ 
              paymentId: response.razorpay_payment_id, 
              orderId: response.razorpay_order_id, 
              signature: response.razorpay_signature 
            });
            
            // Process the payment in our system
            await studentAPI.processPublicPayment({
              studentId: studentInfo.studentId,
              paymentMethod: activeTab,
              transactionId: response.razorpay_payment_id,
              amount: amount
            });

            const receiptNumber = `PUB-${Math.floor(Math.random() * 100000)}`;
            const paymentDate = new Date().toLocaleDateString();
            setReceiptData({
              receiptNumber,
              paymentDate,
              studentId: studentInfo.studentId,
              studentName: studentInfo.studentName,
              class: studentInfo.class,
              amount: String(amount),
              paymentMethod: getPaymentMethodName(activeTab)
            });
            setPaymentComplete(true);
          } catch (err) {
            alert(err.userMessage || 'Payment verification failed');
          }
        }
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      alert(err.userMessage || 'Payment failed. Please try again.');
    }
  };

  const getPaymentMethodName = (method) => {
    switch(method) {
      case 'card': return 'Credit/Debit Card';
      case 'netbanking': return 'Net Banking';
      case 'upi': return 'UPI';
      case 'cash': return 'Cash';
      default: return 'Unknown';
    }
  };

  const downloadReceipt = () => {
    if (!receiptData) {
      alert('No receipt data available. Please complete a payment first.');
      return;
    }

    const doc = new jsPDF();
    const marginLeft = 20;

    doc.setFontSize(18);
    doc.text('BBD Academy - Fee Payment Receipt', marginLeft, 20);

    doc.setFontSize(12);
    doc.text(`Receipt Number: ${receiptData.receiptNumber}`, marginLeft, 40);
    doc.text(`Date: ${receiptData.paymentDate}`, marginLeft, 48);

    doc.text('Student Details:', marginLeft, 64);
    doc.text(`Student ID: ${receiptData.studentId}`, marginLeft, 72);
    doc.text(`Student Name: ${receiptData.studentName}`, marginLeft, 80);
    doc.text(`Class: ${receiptData.class}`, marginLeft, 88);
    // Removed term from receipt as requested

    doc.text('Payment Details:', marginLeft, 104);
    doc.text(`Amount Paid: ₹${receiptData.amount}`, marginLeft, 112);
    doc.text(`Payment Method: ${receiptData.paymentMethod}`, marginLeft, 120);
    doc.text('Status: PAID', marginLeft, 128);

    doc.text('Thank you for your payment!', marginLeft, 156);

    doc.save(`BBD-Academy-Receipt-${receiptData.receiptNumber}.pdf`);
  };

  const resetForm = () => {
    setPaymentComplete(false);
    setStudentInfo({
      studentId: '',
      studentName: '',
      class: '',
      feeAmount: ''
    });
  };

  return (
    <main className="fee-payment-page">
      {/* Hero Section */}
      <section className="fee-payment-hero">
        <div className="container">
          <h1>Fee Payment</h1>
          <p>Pay your fees securely and conveniently</p>
        </div>
      </section>

      {/* Fee Payment Content */}
      <section className="fee-payment-content section">
        <div className="container">
          {paymentComplete ? (
            <div className="payment-success">
              <div className="success-icon">
                <FaCheck />
              </div>
              <h2>Payment Successful!</h2>
              <p>Your payment has been processed successfully.</p>
              
              <div className="receipt">
                <h3>Payment Receipt</h3>
                <div className="receipt-details">
                  <div className="receipt-row">
                    <span>Receipt Number:</span>
                    <span>{receiptData.receiptNumber}</span>
                  </div>
                  <div className="receipt-row">
                    <span>Date:</span>
                    <span>{receiptData.paymentDate}</span>
                  </div>
                  <div className="receipt-row">
                    <span>Student ID:</span>
                    <span>{receiptData.studentId}</span>
                  </div>
                  <div className="receipt-row">
                    <span>Student Name:</span>
                    <span>{receiptData.studentName}</span>
                  </div>
                  <div className="receipt-row">
                    <span>Class:</span>
                    <span>{receiptData.class}</span>
                  </div>
                  <div className="receipt-row">
                    <span>Amount Paid:</span>
                    <span>₹{receiptData.amount}</span>
                  </div>
                  <div className="receipt-row">
                    <span>Payment Method:</span>
                    <span>{receiptData.paymentMethod}</span>
                  </div>
                  <div className="receipt-row">
                    <span>Status:</span>
                    <span className="status-paid">PAID</span>
                  </div>
                </div>
                
                <div className="receipt-actions">
                  <button className="download-receipt-btn" onClick={downloadReceipt}>
                    <FaDownload /> Download Receipt
                  </button>
                  <button className="make-another-payment-btn" onClick={resetForm}>
                    Make Another Payment
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="fee-payment-container">
              <div className="fee-info">
                <h2>Fee Payment Information</h2>
                <p>Please enter the student details and select a payment method to proceed with the fee payment.</p>
                
                <div className="fee-structure">
                  <h3>Fee Structure</h3>
                  {loadingFees ? (
                    <p>Loading fee structures...</p>
                  ) : feesError ? (
                    <p className="error">{feesError}</p>
                  ) : (
                    <table className="fee-table">
                      <thead>
                        <tr>
                          <th>Class</th>
                          <th>Total Fee</th>
                          <th>Schedule</th>
                        </tr>
                      </thead>
                      <tbody>
                        {feeStructures.map((fs) => (
                          <tr key={fs._id}>
                            <td>{fromModelClass(fs.class)}</td>
                            <td>₹{fs.totalAmount}</td>
                            <td>{String(fs.paymentSchedule).replace('_', ' ')}</td>
                          </tr>
                        ))}
                        {feeStructures.length === 0 && (
                          <tr>
                            <td colSpan={3}>No fee structures available.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              
              <div className="payment-form-container">
                <h2>Make a Payment</h2>
                
                <form className="payment-form" onSubmit={handlePayment}>
                  <div className="form-section">
                    <h3>Student Information</h3>
                    
                    <div className="form-group">
                      <label htmlFor="studentId">Student ID *</label>
                      <div className="input-group" style={{ display: 'flex', gap: '10px' }}>
                        <input 
                          type="text" 
                          id="studentId" 
                          name="studentId" 
                          value={studentInfo.studentId} 
                          placeholder="e.g. STU001"
                          onChange={handleStudentInfoChange} 
                          required 
                          style={{ flex: 1 }}
                        />
                        <button type="button" onClick={fetchStudentDues} className="btn btn-secondary" style={{ padding: '0 15px', whiteSpace: 'nowrap', backgroundColor: '#3b82f6', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer' }} disabled={loadingFees}>
                          {loadingFees ? 'Fetching...' : 'Fetch Dues'}
                        </button>
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="studentName">Student Name *</label>
                      <input 
                        type="text" 
                        id="studentName" 
                        name="studentName" 
                        value={studentInfo.studentName} 
                        placeholder="Student Name"
                        onChange={handleStudentInfoChange} 
                        required 
                        readOnly
                        style={{ backgroundColor: '#f3f4f6' }}
                      />
                    </div>
                    
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="class">Class *</label>
                        <input 
                          type="text" 
                          id="class" 
                          name="class" 
                          value={studentInfo.class} 
                          placeholder="Class"
                          onChange={handleStudentInfoChange} 
                          required
                          readOnly
                          style={{ backgroundColor: '#f3f4f6' }}
                        />
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="feeAmount">Fee Amount (₹) *</label>
                      <input 
                        type="number" 
                        id="feeAmount" 
                        name="feeAmount" 
                        value={studentInfo.feeAmount} 
                        onChange={handleStudentInfoChange} 
                        required 
                      />
                    </div>
                  </div>
                  
                  <div className="form-section">
                    <h3>Payment Method</h3>
                    
                    <div className="payment-tabs">
                      <div 
                        className={`payment-tab ${activeTab === 'card' ? 'active' : ''}`}
                        onClick={() => setActiveTab('card')}
                      >
                        <FaCreditCard />
                        <span>Card</span>
                      </div>
                      
                      <div 
                        className={`payment-tab ${activeTab === 'netbanking' ? 'active' : ''}`}
                        onClick={() => setActiveTab('netbanking')}
                      >
                        <FaUniversity />
                        <span>Net Banking</span>
                      </div>
                      
                      <div 
                        className={`payment-tab ${activeTab === 'upi' ? 'active' : ''}`}
                        onClick={() => setActiveTab('upi')}
                      >
                        <FaQrcode />
                        <span>UPI</span>
                      </div>
                      
                      <div 
                        className={`payment-tab ${activeTab === 'cash' ? 'active' : ''}`}
                        onClick={() => setActiveTab('cash')}
                      >
                        <FaMoneyBillWave />
                        <span>Cash</span>
                      </div>
                    </div>
                    
                    <div className="payment-tab-content">
                      {activeTab === 'card' && (
                        <div className="card-payment">
                          <div className="form-group">
                            <label htmlFor="cardNumber">Card Number *</label>
                            <input type="text" id="cardNumber" placeholder="1234 5678 9012 3456" required />
                          </div>
                          
                          <div className="form-row">
                            <div className="form-group">
                              <label htmlFor="expiryDate">Expiry Date *</label>
                              <input type="text" id="expiryDate" placeholder="MM/YY" required />
                            </div>
                            
                            <div className="form-group">
                              <label htmlFor="cvv">CVV *</label>
                              <input type="text" id="cvv" placeholder="123" required />
                            </div>
                          </div>
                          
                          <div className="form-group">
                            <label htmlFor="cardName">Name on Card *</label>
                            <input type="text" id="cardName" required />
                          </div>
                        </div>
                      )}
                      
                      {activeTab === 'netbanking' && (
                        <div className="netbanking-payment">
                          <div className="form-group">
                            <label htmlFor="bank">Select Bank *</label>
                            <select id="bank" required>
                              <option value="">Select Bank</option>
                              <option value="sbi">State Bank of India</option>
                              <option value="hdfc">HDFC Bank</option>
                              <option value="icici">ICICI Bank</option>
                              <option value="axis">Axis Bank</option>
                              <option value="pnb">Punjab National Bank</option>
                              <option value="bob">Bank of Baroda</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                        </div>
                      )}
                      
                      {activeTab === 'upi' && (
                        <div className="upi-payment">
                          <div className="form-group">
                            <label htmlFor="upiId">UPI ID *</label>
                            <input type="text" id="upiId" placeholder="name@upi" required />
                          </div>
                          
                          <div className="upi-apps">
                            <p>Or pay using UPI apps</p>
                            <div className="upi-app-icons">
                              <div className="upi-app">
                                <img src="https://play-lh.googleusercontent.com/HArtbyi53u0jnqhnnxkQnMx9dHOERNcprZyKnInd2nrfM7Wd9ivMNTiz7IJP6-mSpwk" alt="Google Pay" />
                                <span>Google Pay</span>
                              </div>
                              <div className="upi-app">
                                <img src="https://i.pinimg.com/736x/b2/e1/af/b2e1af76fbbe9bc446544b8fa71b37b1.jpg" alt="PhonePe" />
                                <span>PhonePe</span>
                              </div>
                              <div className="upi-app">
                                <img src="https://www.citypng.com/public/uploads/preview/paytm-circle-logo-hd-png-701751694706614zmho56voff.png" alt="Paytm" />
                                <span>Paytm</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {activeTab === 'cash' && (
                        <div className="cash-payment">
                          <p>Please visit the school's accounts office to make a cash payment. After payment, you will receive a receipt that you can upload here.</p>
                          
                          <div className="form-group">
                            <label htmlFor="cashReceiptNumber">Cash Receipt Number / Transaction ID *</label>
                            <input type="text" id="cashReceiptNumber" placeholder="Enter receipt number" value={cashReceiptNumber} onChange={(e) => setCashReceiptNumber(e.target.value)} required={activeTab === 'cash'} />
                          </div>

                          <div className="form-group">
                            <label htmlFor="receiptPhoto">Upload Receipt Photo *</label>
                            <input type="file" id="receiptPhoto" accept="image/*" onChange={handleReceiptPhotoUpload} required={activeTab === 'cash' && !receiptPhotoBase64} />
                            {receiptPhotoBase64 && (
                              <div style={{ marginTop: '10px' }}>
                                <img src={receiptPhotoBase64} alt="Receipt Preview" style={{ maxWidth: '200px', maxHeight: '150px', objectFit: 'contain', border: '1px solid #ccc', padding: '2px', borderRadius: '4px' }} />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="form-actions">
                    <button type="submit" className="pay-now-btn">
                      Pay Now
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
};

export default FeePayment;
