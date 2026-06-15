import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, Sun, Moon, History, UserCircle, FileSpreadsheet, FileText, LogOut, Settings, Bell, Shield, Menu, X } from 'lucide-react';

const Navbar = ({ onOpenProfile, onOpenActivity, onOpenNotifications, onExportCsv, onExportPdf, onOpenUsers, onToggleSidebar, isSidebarOpen }) => {
  const { currentUser, theme, toggleTheme, logoutUser, notifications } = useApp();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="app-navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {currentUser && (
          <button 
            className="mobile-menu-toggle" 
            onClick={onToggleSidebar}
            title={isSidebarOpen ? "Close menu" : "Open menu"}
            aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        )}
        <div className="logo">
          <img src="/logo.png" alt="SmartTodo Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          <span>SmartTodo</span>
          {currentUser && (
            <span className={`badge ${currentUser.role === 'Admin' ? 'badge-priority-high' : 'badge-priority-low'}`} style={{ marginLeft: '8px', fontSize: '0.7rem' }}>
              {currentUser.role}
            </span>
          )}
        </div>
      </div>

      <div className="nav-right">
        {/* Theme Toggle */}
        <button 
          className="btn-icon" 
          onClick={toggleTheme} 
          title={theme === 'dark-theme' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark-theme' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Notifications Bell */}
        <button 
          className="btn-icon" 
          onClick={onOpenNotifications} 
          title="Notifications Center"
          style={{ position: 'relative' }}
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--danger-color)',
              display: 'block'
            }} />
          )}
        </button>

        {/* Activity Bell */}
        <button 
          className="btn-icon" 
          onClick={onOpenActivity} 
          title="Activity History"
        >
          <History size={20} />
        </button>

        {/* User Profile Dropdown */}
        <div className="user-profile-menu" ref={dropdownRef}>
          <button 
            className="btn btn-ghost user-badge" 
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <UserCircle size={20} />
            <span>{currentUser?.name || currentUser?.username || 'User'}</span>
          </button>

          {dropdownOpen && (
            <div className="dropdown-menu">
              <button onClick={() => { setDropdownOpen(false); onOpenProfile(); }}>
                <Settings size={16} /> View Profile & Settings
              </button>
              {currentUser?.role === 'Admin' && (
                <button onClick={() => { setDropdownOpen(false); onOpenUsers(); }}>
                  <Shield size={16} style={{ marginRight: '6px' }} /> User Administration
                </button>
              )}
              <button onClick={() => { setDropdownOpen(false); onExportCsv(); }}>
                <FileSpreadsheet size={16} /> Export to CSV
              </button>
              <button onClick={() => { setDropdownOpen(false); onExportPdf(); }}>
                <FileText size={16} /> Export to PDF
              </button>
              <hr />
              <button className="logout-link" onClick={() => { setDropdownOpen(false); logoutUser(); }}>
                <LogOut size={16} /> Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
