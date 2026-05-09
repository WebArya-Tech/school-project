import React, { useState, useEffect } from 'react';
import { FaArrowRight, FaCheckSquare, FaSquare, FaGraduationCap, FaHistory, FaChevronLeft } from 'react-icons/fa';
import { useNotification } from '../../components/Notification';
import { adminAPI } from '../../services/api';
import { LoadingButton } from '../../components/Loading/LoadingSpinner';

const CLASS_ORDER = ['NS','LKG','UKG','1','2','3','4','5','6','7','8','9','10','11','12'];
const CLASS_LABELS = { NS:'Nursery', LKG:'LKG', UKG:'UKG' };
const label = (c) => CLASS_LABELS[c] || `Class ${c}`;

const currentAY = () => {
  const y = new Date().getFullYear();
  const m = new Date().getMonth();
  const start = m >= 3 ? y : y - 1;
  return `${start}-${start + 1}`;
};
const nextAY = (ay) => {
  const [s] = ay.split('-').map(Number);
  return `${s + 1}-${s + 2}`;
};

export default function PromoteStudents() {
  const { showSuccess, showError } = useNotification();
  const [step, setStep] = useState(1); // 1=configure, 2=select, 3=result
  const [tab, setTab] = useState('promote'); // 'promote' | 'history'

  // Step 1 state
  const [fromClass, setFromClass] = useState('');
  const [toClass, setToClass] = useState('');
  const [toAcYear, setToAcYear] = useState('');
  const [remarks, setRemarks] = useState('');

  // Step 2 state
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState([]);
  const [fetching, setFetching] = useState(false);

  // Step 3 state
  const [promoting, setPromoting] = useState(false);
  const [result, setResult] = useState(null);

  // History tab
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  // Auto-suggest toClass and toAcYear
  useEffect(() => {
    if (!fromClass) { setToClass(''); setToAcYear(''); return; }
    const idx = CLASS_ORDER.indexOf(fromClass);
    setToClass(idx >= 0 && idx < CLASS_ORDER.length - 1 ? CLASS_ORDER[idx + 1] : '');
    setToAcYear(nextAY(currentAY()));
  }, [fromClass]);

  const fetchStudents = async () => {
    setFetching(true);
    try {
      let all = [], page = 1, total = 1;
      do {
        const r = await adminAPI.getStudents({ params: { page, limit: 100, class: fromClass }, retry: true });
        all = [...all, ...(r.data.data.students || [])];
        total = r.data.data.pagination?.totalPages || 1;
        page++;
      } while (page <= total);
      setStudents(all);
      setSelected(all.map(s => s._id));
      setStep(2);
    } catch (e) { showError(e.userMessage || 'Failed to load students'); }
    finally { setFetching(false); }
  };

  const toggleAll = () => setSelected(selected.length === students.length ? [] : students.map(s => s._id));
  const toggle = (id) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const handlePromote = async () => {
    if (!selected.length) { showError('Select at least one student.'); return; }
    setPromoting(true);
    try {
      const r = await adminAPI.promoteStudents({ studentIds: selected, toClass, toAcademicYear: toAcYear, remarks }, { retry: true });
      setResult(r.data.data);
      showSuccess(r.data.message);
      setStep(3);
    } catch (e) { showError(e.userMessage || 'Promotion failed'); }
    finally { setPromoting(false); }
  };

  const loadHistory = async () => {
    setHistLoading(true);
    try {
      const r = await adminAPI.getPromotionHistory({ params: { limit: 100 } });
      setHistory(r.data.data.records || []);
    } catch (e) { showError(e.userMessage || 'Failed to load history'); }
    finally { setHistLoading(false); }
  };

  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab]);

  const reset = () => { setStep(1); setFromClass(''); setToClass(''); setToAcYear(''); setRemarks(''); setStudents([]); setSelected([]); setResult(null); };

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <FaGraduationCap style={{ fontSize: 28, color: '#6c3fc5' }} />
          <div>
            <h1 style={S.title}>Promote Students</h1>
            <p style={S.sub}>Move students to the next class for a new academic year</p>
          </div>
        </div>
        <div style={S.tabs}>
          {['promote','history'].map(t => (
            <button key={t} style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }} onClick={() => { setTab(t); }}>
              {t === 'promote' ? <><FaGraduationCap /> Promote</> : <><FaHistory /> History</>}
            </button>
          ))}
        </div>
      </div>

      {tab === 'history' ? (
        <HistoryTab history={history} loading={histLoading} onRefresh={loadHistory} />
      ) : (
        <>
          {/* Step indicator */}
          <div style={S.steps}>
            {['Configure','Select Students','Results'].map((s, i) => (
              <React.Fragment key={s}>
                <div style={{ ...S.stepBadge, ...(step === i+1 ? S.stepActive : step > i+1 ? S.stepDone : {}) }}>
                  <span style={S.stepNum}>{i+1}</span>
                  <span style={S.stepLabel}>{s}</span>
                </div>
                {i < 2 && <div style={{ ...S.stepLine, ...(step > i+1 ? S.stepLineDone : {}) }} />}
              </React.Fragment>
            ))}
          </div>

          {/* Step 1: Configure */}
          {step === 1 && (
            <div style={S.card}>
              <h2 style={S.cardTitle}>Configure Promotion</h2>
              <div style={S.grid2}>
                <div style={S.field}>
                  <label style={S.lbl}>From Class *</label>
                  <select style={S.sel} value={fromClass} onChange={e => setFromClass(e.target.value)}>
                    <option value="">Select current class</option>
                    {CLASS_ORDER.map(c => <option key={c} value={c}>{label(c)}</option>)}
                  </select>
                </div>
                <div style={S.field}>
                  <label style={S.lbl}>To Class *</label>
                  <select style={S.sel} value={toClass} onChange={e => setToClass(e.target.value)}>
                    <option value="">Select target class</option>
                    {CLASS_ORDER.filter(c => c !== fromClass).map(c => <option key={c} value={c}>{label(c)}</option>)}
                  </select>
                </div>
                <div style={S.field}>
                  <label style={S.lbl}>New Academic Year *</label>
                  <input style={S.inp} placeholder="e.g. 2026-2027" value={toAcYear} onChange={e => setToAcYear(e.target.value)} />
                </div>
                <div style={S.field}>
                  <label style={S.lbl}>Remarks (optional)</label>
                  <input style={S.inp} placeholder="e.g. End of year promotion" value={remarks} onChange={e => setRemarks(e.target.value)} />
                </div>
              </div>
              {fromClass && toClass && (
                <div style={S.previewBanner}>
                  <span style={S.previewFrom}>{label(fromClass)}</span>
                  <FaArrowRight style={{ color: '#6c3fc5', fontSize: 20 }} />
                  <span style={S.previewTo}>{label(toClass)}</span>
                  <span style={S.previewAY}>({toAcYear || '—'})</span>
                </div>
              )}
              <div style={S.actions}>
                <LoadingButton loading={fetching} onClick={fetchStudents} disabled={!fromClass || !toClass || !toAcYear} style={S.btnPrimary}>
                  Next: Load Students &rarr;
                </LoadingButton>
              </div>
            </div>
          )}

          {/* Step 2: Select */}
          {step === 2 && (
            <div style={S.card}>
              <div style={S.cardHead}>
                <h2 style={S.cardTitle}>Select Students to Promote</h2>
                <button style={S.btnBack} onClick={() => setStep(1)}><FaChevronLeft /> Back</button>
              </div>
              <div style={S.selBanner}>
                <span>{label(fromClass)} <FaArrowRight style={{verticalAlign:'middle'}} /> {label(toClass)} &bull; {toAcYear}</span>
                <span style={S.selCount}>{selected.length} / {students.length} selected</span>
              </div>
              {students.length === 0 ? (
                <p style={{ textAlign:'center', color:'#888', padding: 40 }}>No active students found in {label(fromClass)}.</p>
              ) : (
                <div style={S.tableWrap}>
                  <table style={S.table}>
                    <thead>
                      <tr style={S.thead}>
                        <th style={S.th}>
                          <button style={S.cbBtn} onClick={toggleAll}>
                            {selected.length === students.length ? <FaCheckSquare style={{color:'#6c3fc5'}} /> : <FaSquare style={{color:'#ccc'}} />}
                          </button>
                        </th>
                        <th style={S.th}>Roll No.</th>
                        <th style={S.th}>Name</th>
                        <th style={S.th}>Section</th>
                        <th style={S.th}>Current Class</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(s => {
                        const chk = selected.includes(s._id);
                        return (
                          <tr key={s._id} style={{ ...S.tr, ...(chk ? S.trSelected : {}), cursor:'pointer' }} onClick={() => toggle(s._id)}>
                            <td style={S.td}>
                              {chk ? <FaCheckSquare style={{color:'#6c3fc5'}} /> : <FaSquare style={{color:'#ccc'}} />}
                            </td>
                            <td style={S.td}>{s.rollNumber}</td>
                            <td style={S.td}>{`${s.user?.firstName||''} ${s.user?.lastName||''}`.trim() || 'N/A'}</td>
                            <td style={S.td}>{s.section}</td>
                            <td style={S.td}><span style={S.classBadge}>{label(s.class)}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={S.actions}>
                <button style={S.btnSecondary} onClick={() => setStep(1)}><FaChevronLeft /> Back</button>
                <LoadingButton loading={promoting} onClick={handlePromote} disabled={!selected.length || promoting} style={S.btnPrimary}>
                  Promote {selected.length} Student{selected.length !== 1 ? 's' : ''} &rarr;
                </LoadingButton>
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {step === 3 && result && (
            <div style={S.card}>
              <h2 style={S.cardTitle}>Promotion Complete!</h2>
              <div style={S.resultGrid}>
                <div style={{ ...S.resultStat, background:'#eaf6ee', borderColor:'#b6e4c5' }}>
                  <span style={{ fontSize:36, fontWeight:700, color:'#1a7f37' }}>{result.promoted?.length || 0}</span>
                  <span style={{ color:'#1a7f37', fontWeight:600 }}>Promoted Successfully</span>
                </div>
                {result.errors?.length > 0 && (
                  <div style={{ ...S.resultStat, background:'#fef2f2', borderColor:'#fecaca' }}>
                    <span style={{ fontSize:36, fontWeight:700, color:'#dc2626' }}>{result.errors.length}</span>
                    <span style={{ color:'#dc2626', fontWeight:600 }}>Failed</span>
                  </div>
                )}
              </div>
              {result.errors?.length > 0 && (
                <div style={{ marginTop:16 }}>
                  <strong style={{ color:'#dc2626' }}>Errors:</strong>
                  <ul style={{ color:'#dc2626', marginTop:8 }}>
                    {result.errors.map((e,i) => <li key={i}>{e.id}: {e.reason}</li>)}
                  </ul>
                </div>
              )}
              <div style={S.actions}>
                <button style={S.btnPrimary} onClick={reset}>Promote Another Class</button>
                <button style={S.btnSecondary} onClick={() => setTab('history')}>View History</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HistoryTab({ history, loading, onRefresh }) {
  return (
    <div style={S.card}>
      <div style={S.cardHead}>
        <h2 style={S.cardTitle}>Promotion History</h2>
        <LoadingButton loading={loading} onClick={onRefresh} style={S.btnSecondary}>Refresh</LoadingButton>
      </div>
      {loading ? <p style={{ textAlign:'center', padding:40, color:'#888' }}>Loading history...</p>
        : history.length === 0 ? <p style={{ textAlign:'center', padding:40, color:'#888' }}>No promotion records found.</p>
        : (
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr style={S.thead}>
                  <th style={S.th}>Roll No.</th>
                  <th style={S.th}>Student</th>
                  <th style={S.th}>Current Class</th>
                  <th style={S.th}>Promotion Record</th>
                  <th style={S.th}>Date</th>
                  <th style={S.th}>By</th>
                </tr>
              </thead>
              <tbody>
                {history.map(s =>
                  (s.promotionHistory || []).slice().reverse().map((h, i) => (
                    <tr key={`${s._id}-${i}`} style={S.tr}>
                      <td style={S.td}>{s.rollNumber}</td>
                      <td style={S.td}>{`${s.user?.firstName||''} ${s.user?.lastName||''}`.trim()}</td>
                      <td style={S.td}><span style={S.classBadge}>{label(s.class)}</span></td>
                      <td style={S.td}>
                        <span style={S.fromBadge}>{label(h.fromClass)}</span>
                        {' '}<FaArrowRight style={{ color:'#6c3fc5', verticalAlign:'middle', fontSize:11 }} />{' '}
                        <span style={S.toBadge}>{label(h.toClass)}</span>
                        <span style={{ fontSize:11, color:'#888', marginLeft:6 }}>{h.toAcademicYear}</span>
                      </td>
                      <td style={S.td}>{h.promotedAt ? new Date(h.promotedAt).toLocaleDateString('en-IN') : '—'}</td>
                      <td style={S.td}>{h.promotedBy ? `${h.promotedBy.firstName||''} ${h.promotedBy.lastName||''}`.trim() : 'Admin'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

// Inline styles
const S = {
  page: { padding: 24, background: '#f4f6fb', minHeight: '100vh' },
  header: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:16 },
  headerLeft: { display:'flex', alignItems:'center', gap:14 },
  title: { margin:0, fontSize:26, fontWeight:700, color:'#1e1e2e' },
  sub: { margin:'4px 0 0', color:'#666', fontSize:14 },
  tabs: { display:'flex', gap:8 },
  tab: { padding:'9px 18px', borderRadius:8, border:'2px solid #e0e3e8', background:'#fff', color:'#555', cursor:'pointer', fontWeight:500, fontSize:14, display:'flex', alignItems:'center', gap:6, transition:'all .15s' },
  tabActive: { border:'2px solid #6c3fc5', background:'#6c3fc5', color:'#fff' },
  steps: { display:'flex', alignItems:'center', marginBottom:24, gap:0 },
  stepBadge: { display:'flex', alignItems:'center', gap:8, padding:'8px 18px', borderRadius:999, background:'#e9ecef', color:'#888', fontWeight:500, fontSize:14, transition:'all .2s' },
  stepActive: { background:'#6c3fc5', color:'#fff', boxShadow:'0 2px 8px rgba(108,63,197,.3)' },
  stepDone: { background:'#1a7f37', color:'#fff' },
  stepNum: { fontWeight:700 },
  stepLabel: {},
  stepLine: { flex:1, height:3, background:'#e0e3e8', margin:'0 6px' },
  stepLineDone: { background:'#1a7f37' },
  card: { background:'#fff', borderRadius:14, padding:28, boxShadow:'0 4px 20px rgba(0,0,0,.07)' },
  cardHead: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 },
  cardTitle: { margin:0, fontSize:20, fontWeight:700, color:'#1e1e2e' },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:24 },
  field: { display:'flex', flexDirection:'column', gap:6 },
  lbl: { fontSize:13, fontWeight:600, color:'#444' },
  sel: { padding:'10px 12px', borderRadius:8, border:'1.5px solid #d0d5e0', fontSize:14, outline:'none', background:'#f8f9fa' },
  inp: { padding:'10px 12px', borderRadius:8, border:'1.5px solid #d0d5e0', fontSize:14, outline:'none' },
  previewBanner: { display:'flex', alignItems:'center', gap:14, padding:'14px 20px', background:'linear-gradient(135deg,#f0ebff,#e8f4ff)', borderRadius:10, marginBottom:24, justifyContent:'center' },
  previewFrom: { fontWeight:700, color:'#dc2626', fontSize:18 },
  previewTo: { fontWeight:700, color:'#1a7f37', fontSize:18 },
  previewAY: { color:'#888', fontSize:14 },
  actions: { display:'flex', gap:12, justifyContent:'flex-end', marginTop:24, flexWrap:'wrap' },
  btnPrimary: { background:'linear-gradient(135deg,#6c3fc5,#8b5cf6)', color:'#fff', border:'none', padding:'11px 24px', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:14, display:'flex', alignItems:'center', gap:6 },
  btnSecondary: { background:'#f1f3f5', color:'#444', border:'1.5px solid #d0d5e0', padding:'11px 20px', borderRadius:8, cursor:'pointer', fontWeight:500, fontSize:14, display:'flex', alignItems:'center', gap:6 },
  btnBack: { background:'transparent', border:'none', color:'#6c3fc5', cursor:'pointer', fontWeight:500, fontSize:14, display:'flex', alignItems:'center', gap:4 },
  selBanner: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', background:'#f4f0ff', borderRadius:8, marginBottom:16, fontSize:14, color:'#555' },
  selCount: { fontWeight:700, color:'#6c3fc5' },
  tableWrap: { overflowX:'auto', maxHeight:420, overflowY:'auto', borderRadius:8, border:'1px solid #eef0f3' },
  table: { width:'100%', borderCollapse:'collapse' },
  thead: { background:'#f8f9fa', position:'sticky', top:0 },
  th: { padding:'12px 14px', textAlign:'left', fontWeight:600, fontSize:13, color:'#444', borderBottom:'1px solid #eef0f3', whiteSpace:'nowrap' },
  tr: { borderBottom:'1px solid #f5f5f5', transition:'background .1s' },
  trSelected: { background:'#f4f0ff' },
  td: { padding:'11px 14px', fontSize:14, color:'#333', verticalAlign:'middle' },
  cbBtn: { background:'none', border:'none', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center' },
  classBadge: { background:'#e8f4ff', color:'#1565c0', padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600 },
  fromBadge: { background:'#fef2f2', color:'#dc2626', padding:'2px 8px', borderRadius:20, fontSize:12, fontWeight:600 },
  toBadge: { background:'#eaf6ee', color:'#1a7f37', padding:'2px 8px', borderRadius:20, fontSize:12, fontWeight:600 },
  resultGrid: { display:'flex', gap:20, flexWrap:'wrap', marginTop:16, marginBottom:16 },
  resultStat: { flex:'1 1 160px', border:'2px solid', borderRadius:12, padding:'24px 20px', display:'flex', flexDirection:'column', alignItems:'center', gap:6 },
};
