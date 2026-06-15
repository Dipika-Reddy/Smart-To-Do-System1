import React from 'react';
import { useApp } from '../context/AppContext';
import { ListTodo, FileText, CheckSquare, Search, Tag, Shield, BarChart2, Briefcase } from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
  const { 
    tasks, 
    activeWorkspace, 
    setActiveWorkspace, 
    activeFilters, 
    setActiveFilters,
    currentUser
  } = useApp();

  const isAdmin = currentUser?.role === 'Admin';

  // Circular progress math
  const CIRCUMFERENCE = 2 * Math.PI * 40; // 251.2
  
  // Filter tasks based on workspace selection to show accurate progress tracker
  const workspaceTasks = tasks.filter(t => {
    return t.user_id === currentUser?.id || t.assigned_to === currentUser?.id;
  });

  const totalTasks = workspaceTasks.length;
  const completedTasks = workspaceTasks.filter(t => t.status === 'Completed').length;
  const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;

  // Filter change handlers
  const handleSearchChange = (e) => {
    setActiveFilters(prev => ({ ...prev, search: e.target.value }));
  };

  const handlePriorityChange = (priority) => {
    setActiveFilters(prev => ({ ...prev, priority }));
  };

  const handleWorkspaceChange = (workspace) => {
    setActiveWorkspace(workspace);
    if (onClose) onClose();
  };

  const isTaskWorkspace = activeWorkspace === 'tasks' || activeWorkspace === 'admin_dashboard';

  return (
    <aside className={`app-sidebar ${isOpen ? 'sidebar-open' : ''}`}>
      {/* Search Bar - only show for tasks workspace */}
      {isTaskWorkspace && (
        <div className="sidebar-box search-box" style={{ marginBottom: '1rem' }}>
          <h3>Search</h3>
          <div className="search-input-wrapper">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Search tasks..." 
              value={activeFilters.search}
              onChange={handleSearchChange}
            />
          </div>
        </div>
      )}

      {/* Workspace Selector */}
      <div className="sidebar-box workspace-selector">
        <h3>Workspace</h3>
        <div className="workspace-nav">
          {isAdmin ? (
            <>
              <button 
                className={`ws-tab-btn ${activeWorkspace === 'tasks' ? 'active' : ''}`}
                onClick={() => handleWorkspaceChange('tasks')}
              >
                <ListTodo size={16} /> Tasks
              </button>
              <button 
                className={`ws-tab-btn ${activeWorkspace === 'admin_dashboard' ? 'active' : ''}`}
                onClick={() => handleWorkspaceChange('admin_dashboard')}
              >
                <Shield size={16} /> Analytics
              </button>
              <button 
                className={`ws-tab-btn ${activeWorkspace === 'admin_reports' ? 'active' : ''}`}
                onClick={() => handleWorkspaceChange('admin_reports')}
              >
                <BarChart2 size={16} /> Performance Analytics
              </button>
            </>
          ) : (
            <>
              <button 
                className={`ws-tab-btn ${activeWorkspace === 'tasks' ? 'active' : ''}`}
                onClick={() => handleWorkspaceChange('tasks')}
              >
                <ListTodo size={16} /> Tasks
              </button>
              <button 
                className={`ws-tab-btn ${activeWorkspace === 'notes' ? 'active' : ''}`}
                onClick={() => handleWorkspaceChange('notes')}
              >
                <FileText size={16} /> Notes
              </button>
              <button 
                className={`ws-tab-btn ${activeWorkspace === 'checklists' ? 'active' : ''}`}
                onClick={() => handleWorkspaceChange('checklists')}
              >
                <CheckSquare size={16} /> Checklists
              </button>
            </>
          )}
        </div>
      </div>



      {/* Progress Tracker - only show for tasks workspace */}
      {isTaskWorkspace && (
        <div className="sidebar-box progress-box">
          <h3>Progress Tracker</h3>
          <div className="progress-radial-wrapper">
            <svg className="radial-progress-svg" viewBox="0 0 100 100">
              <circle className="radial-bg" cx="50" cy="50" r="40"></circle>
              <circle 
                className="radial-bar" 
                cx="50" 
                cy="50" 
                r="40" 
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={offset}
              ></circle>
            </svg>
            <div className="progress-radial-text">
              <span>{percent}%</span>
              <small>Done</small>
            </div>
          </div>
        </div>
      )}

      {/* Task Filters - only show for tasks workspace */}
      {isTaskWorkspace && (
        <div className="sidebar-box filters-box">
          <h3>Filters</h3>
          


          <div className="filter-section">
            <h4>Priority</h4>
            <div className="filter-checkboxes">
              <label>
                <input 
                  type="radio" 
                  name="priority-filter" 
                  value="" 
                  checked={activeFilters.priority === ''}
                  onChange={() => handlePriorityChange('')}
                /> All Priorities
              </label>
              <label>
                <input 
                  type="radio" 
                  name="priority-filter" 
                  value="High" 
                  checked={activeFilters.priority === 'High'}
                  onChange={() => handlePriorityChange('High')}
                /> <span className="priority-indicator high"></span> High
              </label>
              <label>
                <input 
                  type="radio" 
                  name="priority-filter" 
                  value="Medium" 
                  checked={activeFilters.priority === 'Medium'}
                  onChange={() => handlePriorityChange('Medium')}
                /> <span className="priority-indicator medium"></span> Medium
              </label>
              <label>
                <input 
                  type="radio" 
                  name="priority-filter" 
                  value="Low" 
                  checked={activeFilters.priority === 'Low'}
                  onChange={() => handlePriorityChange('Low')}
                /> <span className="priority-indicator low"></span> Low
              </label>
            </div>
          </div>


        </div>
      )}
    </aside>
  );
};

export default Sidebar;
