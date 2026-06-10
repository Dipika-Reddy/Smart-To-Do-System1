import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import API from '../services/api';
import { Bell, X, Check, CheckSquare } from 'lucide-react';

const NotificationCenter = ({ isOpen, onClose }) => {
  const { notifications, loadNotifications, showToast } = useApp();

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMarkAsRead = async (id) => {
    try {
      await API.markNotificationRead(id);
      loadNotifications();
    } catch (err) {
      showToast('Error marking notification as read.', 'danger');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await API.markAllNotificationsRead();
      showToast('All notifications marked as read.', 'success');
      loadNotifications();
    } catch (err) {
      showToast('Error marking all as read.', 'danger');
    }
  };

  const formatDateTime = (date) => {
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString(undefined, options);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="slideover" id="notifications-slideover">
      <div className="slideover-backdrop" onClick={onClose}></div>
      
      <div className="slideover-content" style={{ right: 0, left: 'auto' }}>
        <div className="slideover-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>
            <Bell size={18} /> Notifications {unreadCount > 0 && <span style={{ fontSize: '0.8rem', padding: '2px 6px', background: 'var(--danger-color)', color: '#fff', borderRadius: '10px', marginLeft: '4px' }}>{unreadCount} new</span>}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllRead} 
                className="btn btn-ghost btn-small"
                title="Mark all as read"
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
              >
                <CheckSquare size={12} style={{ marginRight: '2px' }} /> Mark All Read
              </button>
            )}
            <button 
              onClick={onClose} 
              className="btn-icon-small" 
              id="notifications-slideover-close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="slideover-body" style={{ overflowY: 'auto', flex: 1, padding: '1rem' }}>
          {notifications.length === 0 ? (
            <div className="no-activity-text" style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-muted)' }}>
              No notifications yet.
            </div>
          ) : (
            notifications.map((notif) => {
              const isUnread = !notif.is_read;
              return (
                <div 
                  key={notif.id} 
                  className={`activity-item`}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    padding: '0.75rem', 
                    borderRadius: '8px', 
                    marginBottom: '0.5rem', 
                    backgroundColor: isUnread ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                    borderLeft: isUnread ? '4px solid var(--primary-color)' : '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ flex: 1, paddingRight: '0.5rem' }}>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block' }}>{notif.title}</strong>
                    <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>{notif.message}</span>
                    <div className="activity-meta" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {formatDateTime(new Date(notif.created_at))}
                    </div>
                  </div>
                  {isUnread && (
                    <button
                      className="btn-icon-small"
                      onClick={() => handleMarkAsRead(notif.id)}
                      title="Mark as read"
                      style={{ padding: '2px', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      <Check size={12} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
