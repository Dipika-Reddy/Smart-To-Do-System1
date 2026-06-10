import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import API from '../services/api';
import { X, Trash2, Shield, User } from 'lucide-react';

const UserManagementModal = ({ isOpen, onClose }) => {
  const { users, currentUser, loadUsers, showToast } = useApp();

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDeleteUser = async (id, username) => {
    if (id === currentUser.id) {
      showToast('You cannot delete your own account.', 'warning');
      return;
    }

    if (window.confirm(`Delete user account "${username}"? All tasks created by or assigned to this user will be impacted.`)) {
      try {
        await API.deleteUser(id);
        showToast('User account deleted successfully.', 'success');
        loadUsers();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    }
  };

  return (
    <div className="modal" id="user-management-modal">
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-content">
        <div className="modal-header">
          <h3>User Administration</h3>
          <button onClick={onClose} className="modal-close btn-icon-small">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body user-manager-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <div className="categories-list-wrapper">
            <ul className="manager-list">
              {users.length === 0 ? (
                <li className="muted-text">No registered users in the database.</li>
              ) : (
                users.map(user => (
                  <li key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {user.role === 'Admin' ? <Shield size={16} style={{ color: 'var(--primary-color)' }} /> : <User size={16} style={{ color: 'var(--text-secondary)' }} />}
                      <div>
                        <strong style={{ color: 'var(--text-primary)' }}>{user.name || user.username}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                          @{user.username} | {user.email} | {user.role}
                        </span>
                      </div>
                    </div>
                    {user.id !== currentUser.id && (
                      <button 
                        className="btn-icon-small delete-cat" 
                        onClick={() => handleDeleteUser(user.id, user.username)}
                        title="Delete User"
                        style={{ color: 'var(--danger-color)', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagementModal;
