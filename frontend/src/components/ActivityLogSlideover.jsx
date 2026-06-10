import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { History, X } from 'lucide-react';

const ActivityLogSlideover = ({ isOpen, onClose }) => {
  const { activityLogs, loadActivityLogs } = useApp();

  useEffect(() => {
    if (isOpen) {
      loadActivityLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatDateTime = (date) => {
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString(undefined, options);
  };

  return (
    <div className="slideover" id="activity-slideover">
      <div className="slideover-backdrop" onClick={onClose}></div>
      
      <div className="slideover-content">
        <div className="slideover-header">
          <h3>
            <History size={18} /> Task Activity History
          </h3>
          <button 
            onClick={onClose} 
            className="btn-icon-small" 
            id="activity-slideover-close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="slideover-body" id="activity-log-list">
          {activityLogs.length === 0 ? (
            <div className="no-activity-text">No activity history recorded yet.</div>
          ) : (
            activityLogs.map((log) => {
              let actionClass = '';
              const actionLower = log.action.toLowerCase();
              if (actionLower.includes('create')) actionClass = 'created-task';
              if (actionLower.includes('complete')) actionClass = 'completed-task';
              if (actionLower.includes('delete')) actionClass = 'deleted-task';

              return (
                <div key={log.id} className={`activity-item ${actionClass}`}>
                  <div>
                    <strong>{log.action}</strong>: {log.task_title}
                    <div className="activity-meta">
                      {formatDateTime(new Date(log.created_at))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityLogSlideover;
