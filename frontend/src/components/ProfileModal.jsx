import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Sun, Moon, Key, Eye, EyeOff } from 'lucide-react';
import API from '../services/api';

const ProfileModal = ({ isOpen, onClose }) => {
  const { currentUser, theme, setTheme, showToast } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSetTheme = (newTheme) => {
    setTheme(newTheme);
    document.documentElement.className = newTheme;
    localStorage.setItem('theme', newTheme);
    showToast(`Theme updated to ${newTheme === 'dark-theme' ? 'Dark' : 'Light'} Mode`, 'info');
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    if (newPassword.length < 8) {
      showToast('New password must be at least 8 characters long.', 'error');
      return;
    }
    setLoading(true);
    try {
      await API.changePassword(currentPassword, newPassword);
      showToast('Password changed successfully!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowForm(false);
    } catch (error) {
      showToast(error.message || 'Failed to change password.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal" id="profile-modal">
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-content">
        <div className="modal-header">
          <h3>User Profile & Settings</h3>
          <button onClick={onClose} className="modal-close btn-icon-small">
            <X size={16} />
          </button>
        </div>

        <div className="profile-modal-body">
          <div className="profile-section">
            <h4>Account Details</h4>
            <div className="profile-info-grid">
              <div><strong>Username:</strong> <span>{currentUser?.username || 'User'}</span></div>
              <div><strong>Email:</strong> <span>{currentUser?.email || 'you@example.com'}</span></div>
            </div>
          </div>
          
          <div className="profile-section">
            <h4>Application Settings</h4>
            <div className="setting-row">
              <span>Visual Theme</span>
              <div className="theme-option-btns">
                <button 
                  id="theme-light-btn" 
                  className={`btn btn-ghost btn-small ${theme === 'light-theme' ? 'active' : ''}`}
                  onClick={() => handleSetTheme('light-theme')}
                  style={theme === 'light-theme' ? { background: 'var(--bg-tertiary)', border: '1px solid var(--text-muted)' } : {}}
                >
                  <Sun size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Light
                </button>
                <button 
                  id="theme-dark-btn" 
                  className={`btn btn-ghost btn-small ${theme === 'dark-theme' ? 'active' : ''}`}
                  onClick={() => handleSetTheme('dark-theme')}
                  style={theme === 'dark-theme' ? { background: 'var(--bg-tertiary)', border: '1px solid var(--text-muted)' } : {}}
                >
                  <Moon size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Dark
                </button>
              </div>
            </div>
          </div>

          <div className="profile-section">
            <h4>Account Security</h4>
            {!showForm ? (
              <>
                <p className="help-text" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Password modification requires credentials validation.
                </p>
                <button 
                  id="change-pass-toggle" 
                  className="btn btn-ghost btn-small btn-block"
                  onClick={() => setShowForm(true)}
                >
                  <Key size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Update Credentials Options
                </button>
              </>
            ) : (
              <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                <div className="form-group">
                  <label htmlFor="current-password" style={{ fontSize: '0.75rem', fontWeight: '500' }}>Current Password</label>
                  <div className="password-input-container">
                    <input 
                      type={showCurrentPassword ? "text" : "password"} 
                      id="current-password" 
                      autoComplete="current-password"
                      required 
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      style={{ padding: '0.4rem 2.5rem 0.4rem 0.6rem', fontSize: '0.85rem' }}
                    />
                    <button 
                      type="button" 
                      className="password-toggle-btn"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="new-password" style={{ fontSize: '0.75rem', fontWeight: '500' }}>New Password</label>
                  <div className="password-input-container">
                    <input 
                      type={showNewPassword ? "text" : "password"} 
                      id="new-password" 
                      autoComplete="new-password"
                      required 
                      placeholder="At least 8 chars, 1 upper, 1 number, 1 special"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{ padding: '0.4rem 2.5rem 0.4rem 0.6rem', fontSize: '0.85rem' }}
                    />
                    <button 
                      type="button" 
                      className="password-toggle-btn"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="confirm-password" style={{ fontSize: '0.75rem', fontWeight: '500' }}>Confirm New Password</label>
                  <div className="password-input-container">
                    <input 
                      type={showConfirmPassword ? "text" : "password"} 
                      id="confirm-password" 
                      autoComplete="new-password"
                      required 
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      style={{ padding: '0.4rem 2.5rem 0.4rem 0.6rem', fontSize: '0.85rem' }}
                    />
                    <button 
                      type="button" 
                      className="password-toggle-btn"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <button 
                    type="submit" 
                    className="btn btn-primary btn-small" 
                    disabled={loading}
                    style={{ flex: 1 }}
                  >
                    {loading ? 'Updating...' : 'Save Password'}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-ghost btn-small" 
                    onClick={() => {
                      setShowForm(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
