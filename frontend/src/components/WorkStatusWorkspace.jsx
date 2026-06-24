import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import API from '../services/api';
import { Calendar, RefreshCw, Check, FileText, Clock, AlertTriangle, Briefcase, Search, History, Sparkles } from 'lucide-react';

const WorkStatusWorkspace = () => {
  const { currentUser, showToast } = useApp();
  const isAdmin = currentUser?.role === 'Admin';

  // Helper to get local date string (YYYY-MM-DD)
  const getLocalDateString = (dateObj = new Date()) => {
    const offset = dateObj.getTimezoneOffset();
    const localDate = new Date(dateObj.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };

  const todayStr = getLocalDateString();

  // State shared/conditional
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [loading, setLoading] = useState(false);

  // --- Standard User States ---
  const [summary, setSummary] = useState('');
  const [tasksCompleted, setTasksCompleted] = useState('');
  const [tasksInProgress, setTasksInProgress] = useState('');
  const [blockers, setBlockers] = useState('');
  const [hasExistingReport, setHasExistingReport] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // --- Admin States ---
  const [teamReports, setTeamReports] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch data on date changes or initial load
  useEffect(() => {
    if (isAdmin) {
      fetchTeamReports(selectedDate);
    } else {
      fetchUserReport(selectedDate);
    }
  }, [selectedDate, isAdmin]);

  // Fetch user's own history on mount for standard users
  useEffect(() => {
    if (!isAdmin) {
      fetchUserHistory();
    }
  }, [isAdmin]);

  // Fetch report for logged-in user for specific date
  const fetchUserReport = async (date) => {
    setLoading(true);
    try {
      const report = await API.getEodReport(date);
      if (report && report.id) {
        setSummary(report.summary || '');
        setTasksCompleted(report.tasks_completed || '');
        setTasksInProgress(report.tasks_in_progress || '');
        setBlockers(report.blockers || '');
        setHasExistingReport(true);
      } else {
        // Clear fields for fresh submission
        setSummary('');
        setTasksCompleted('');
        setTasksInProgress('');
        setBlockers('');
        setHasExistingReport(false);
      }
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Fetch user history
  const fetchUserHistory = async () => {
    try {
      const data = await API.getEodHistory();
      setHistory(data || []);
    } catch (err) {
      showToast('Failed to load status history.', 'danger');
    }
  };

  // Fetch all user reports for admin
  const fetchTeamReports = async (date) => {
    setLoading(true);
    try {
      const data = await API.getAllEodReports(date);
      setTeamReports(data || []);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Auto-populate completed and in-progress tasks from task manager
  const handleAutoPopulate = async () => {
    setLoadingSuggestions(true);
    try {
      const suggestions = await API.getEodSuggestions();
      
      const compTasks = suggestions.completed || [];
      const progTasks = suggestions.inProgress || [];

      if (compTasks.length === 0 && progTasks.length === 0) {
        showToast('No active tasks found in your dashboard to pre-populate.', 'info');
        return;
      }

      if (compTasks.length > 0) {
        const formattedCompleted = compTasks.map(t => `- ${t}`).join('\n');
        setTasksCompleted(prev => {
          const separator = prev.trim() ? '\n' : '';
          return prev + separator + formattedCompleted;
        });
      }

      if (progTasks.length > 0) {
        const formattedInProgress = progTasks.map(t => `- ${t}`).join('\n');
        setTasksInProgress(prev => {
          const separator = prev.trim() ? '\n' : '';
          return prev + separator + formattedInProgress;
        });
      }

      showToast('Successfully populated tasks from your dashboard!', 'success');
    } catch (err) {
      showToast('Failed to fetch tasks suggestions.', 'danger');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Handle standard user report submit/update
  const handleSubmitReport = async (e) => {
    e.preventDefault();

    if (!summary || !summary.trim()) {
      showToast('Day summary is required.', 'warning');
      return;
    }

    const payload = {
      report_date: selectedDate,
      summary: summary.trim(),
      tasks_completed: tasksCompleted.trim() || null,
      tasks_in_progress: tasksInProgress.trim() || null,
      blockers: blockers.trim() || null
    };

    setLoading(true);
    try {
      const res = await API.saveEodReport(payload);
      showToast(res.message, 'success');
      setHasExistingReport(true);
      fetchUserHistory();
      setSummary('');
      setTasksCompleted('');
      setTasksInProgress('');
      setBlockers('');
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const parseUtcDate = (dateVal) => {
    if (!dateVal) return null;
    if (dateVal instanceof Date) return dateVal;
    if (typeof dateVal === 'string') {
      if (dateVal.includes('Z') || dateVal.includes('+')) {
        return new Date(dateVal);
      }
      const normalized = dateVal.replace(' ', 'T');
      if (normalized.includes('T') && !normalized.endsWith('Z')) {
        return new Date(normalized + 'Z');
      }
    }
    return new Date(dateVal);
  };

  // Format date helper for UI
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const dateObj = new Date(dateStr);
    return dateObj.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Admin search filtering
  const filteredTeamReports = teamReports.filter(report => {
    const name = (report.name || '').toLowerCase();
    const username = (report.username || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || username.includes(query);
  });

  return (
    <div className="work-status-workspace" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      {/* Workspace Header */}
      <div className="workspace-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Briefcase size={24} style={{ color: 'var(--primary-color)' }} />
          <h2 style={{ margin: 0 }}>Work Status Dashboard</h2>
        </div>

        {/* Date Selector Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <Calendar size={16} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status Date:</span>
          <input
            type="date"
            className="form-control"
            style={{ width: '150px', padding: '0.2rem 0.5rem', fontSize: '0.85rem', height: 'auto', border: 'none', background: 'transparent', color: 'var(--text-primary)' }}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '0.5rem', color: 'var(--text-secondary)' }}>
          <RefreshCw className="spin" size={20} />
          <span>Synchronizing EOD report...</span>
        </div>
      )}

      {!loading && !isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Submission Form */}
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0 }}>
                {hasExistingReport ? `Update Work Status for ${formatDateDisplay(selectedDate)}` : `Submit Work Status for ${formatDateDisplay(selectedDate)}`}
              </h3>
              <button 
                type="button" 
                className="btn btn-ghost btn-small" 
                onClick={handleAutoPopulate} 
                disabled={loadingSuggestions}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--primary-color)' }}
              >
                <Sparkles size={14} />
                {loadingSuggestions ? 'Loading...' : 'Pre-populate from Tasks'}
              </button>
            </div>

            <form onSubmit={handleSubmitReport} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                  What did you achieve today? * (Summary)
                </label>
                <textarea
                  className="form-control"
                  rows="4"
                  required
                  placeholder="Summarize your main achievements and tasks worked on today..."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                    Tasks Completed
                  </label>
                  <textarea
                    className="form-control"
                    rows="4"
                    placeholder="List completed tasks (one per line)..."
                    value={tasksCompleted}
                    onChange={(e) => setTasksCompleted(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                    Tasks In Progress
                  </label>
                  <textarea
                    className="form-control"
                    rows="4"
                    placeholder="List in-progress tasks (one per line)..."
                    value={tasksInProgress}
                    onChange={(e) => setTasksInProgress(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                  Blockers & Challenges
                </label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Mention any difficulties, dependencies or blockers you ran into today..."
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', fontWeight: 600 }}>
                  {hasExistingReport ? 'Update status report' : 'Submit status report'}
                </button>
              </div>
            </form>
          </div>

          {/* User History Log */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.25rem', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                <History size={16} style={{ color: 'var(--text-secondary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>My Status History</h3>
              </div>

              <div style={{ maxHeight: '550px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {history.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>No EOD reports submitted yet.</p>
                ) : (
                  history.map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => setSelectedDate(item.report_date)}
                      style={{ 
                        padding: '0.75rem 1rem', 
                        borderRadius: '8px', 
                        background: selectedDate === item.report_date ? 'var(--primary-color)1c' : 'var(--bg-primary)', 
                        border: `1px solid ${selectedDate === item.report_date ? 'var(--primary-color)' : 'var(--border-color)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {formatDateDisplay(item.report_date)}
                        </strong>
                        {item.report_date === todayStr && (
                          <span style={{ fontSize: '0.7rem', background: 'var(--success-color)1c', color: 'var(--success-color)', padding: '1px 6px', borderRadius: '10px', fontWeight: 'bold' }}>Today</span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {item.summary}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Monitoring Workspace view */}
      {!loading && isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Admin Filters Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div className="search-input-wrapper" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', width: '300px' }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search team members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', width: '100%', fontSize: '0.85rem' }}
              />
            </div>
            
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Total submissions: <strong>{filteredTeamReports.length}</strong>
            </div>
          </div>

          {/* Submissions list */}
          {filteredTeamReports.length === 0 ? (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '3rem', border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <AlertTriangle size={32} style={{ color: 'var(--warning-color)', marginBottom: '0.5rem' }} />
              <p style={{ margin: 0, fontWeight: 500 }}>No EOD status reports submitted for {formatDateDisplay(selectedDate)} yet.</p>
              {searchQuery && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>No results match your search query.</p>}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              {filteredTeamReports.map(report => (
                <div key={report.id} style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
                  
                  {/* Reporter header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                    <div>
                      <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 600 }}>{report.name || report.username}</h4>
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>@{report.username}</small>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      <Clock size={14} />
                      <span>Submitted at {parseUtcDate(report.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.35rem' }}>
                        Daily Summary
                      </strong>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{report.summary}</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.25rem' }}>
                      {report.tasks_completed && (
                        <div style={{ background: 'var(--bg-primary)', borderRadius: '8px', padding: '0.85rem', border: '1px solid var(--border-color)' }}>
                          <strong style={{ fontSize: '0.8rem', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                            <Check size={14} /> Tasks Completed
                          </strong>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{report.tasks_completed}</p>
                        </div>
                      )}

                      {report.tasks_in_progress && (
                        <div style={{ background: 'var(--bg-primary)', borderRadius: '8px', padding: '0.85rem', border: '1px solid var(--border-color)' }}>
                          <strong style={{ fontSize: '0.8rem', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                            <Clock size={14} /> Tasks In Progress
                          </strong>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{report.tasks_in_progress}</p>
                        </div>
                      )}
                    </div>

                    {report.blockers && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', padding: '0.85rem', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                        <strong style={{ fontSize: '0.8rem', color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
                          <AlertTriangle size={14} /> Blockers & Challenges
                        </strong>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{report.blockers}</p>
                      </div>
                    )}
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkStatusWorkspace;
