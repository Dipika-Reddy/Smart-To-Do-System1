import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import API from '../services/api';
import { X, CheckCircle, RotateCcw, MessageSquare } from 'lucide-react';

const TaskReviewModal = ({ isOpen, task, onClose }) => {
  const { syncAllData, showToast } = useApp();
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setComments('');
    }
  }, [isOpen]);

  if (!isOpen || !task) return null;

  const handleReviewAction = async (action) => {
    setLoading(true);
    try {
      await API.reviewTask(task.id, action, comments);
      showToast(
        action === 'approve' 
          ? 'Task approved and marked as Completed!' 
          : 'Task rejected and returned for revisions.',
        action === 'approve' ? 'success' : 'info'
      );
      await syncAllData();
      onClose();
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal" id="task-review-modal">
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3>Review Task Submission</h3>
          <button onClick={onClose} className="modal-close btn-icon-small">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Task Title</span>
            <h4 style={{ margin: '0.2rem 0 0.5rem 0', color: 'var(--text-primary)' }}>{task.title}</h4>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{task.description || 'No description provided.'}</p>
          </div>

          <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Submission Notes / Progress Comments</span>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', fontStyle: 'italic', color: 'var(--text-primary)' }}>
              {task.completion_notes || 'No submission notes provided.'}
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="review-comments" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <MessageSquare size={14} /> Review Feedback Comments
            </label>
            <textarea
              id="review-comments"
              rows="3"
              placeholder="Provide approval comments or revision guidelines..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            />
          </div>

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn btn-ghost" 
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="button" 
              className="btn btn-warning" 
              onClick={() => handleReviewAction('reject')}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <RotateCcw size={14} /> Reject & Revise
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={() => handleReviewAction('approve')}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <CheckCircle size={14} /> Approve & Complete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskReviewModal;
