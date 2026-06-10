import React, { useState, useEffect, useRef } from 'react';
import { useApp } from './context/AppContext';
import API from './services/api';

// Components
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import StatsDashboard from './components/StatsDashboard';
import TaskCard from './components/TaskCard';
import NoteCard from './components/NoteCard';
import ChecklistCard from './components/ChecklistCard';
import ToastContainer from './components/ToastContainer';
import ActivityLogSlideover from './components/ActivityLogSlideover';
import NotificationCenter from './components/NotificationCenter';

// Modals
import TaskModal from './components/TaskModal';
import CategoryModal from './components/CategoryModal';
import NoteModal from './components/NoteModal';
import ChecklistModal from './components/ChecklistModal';
import ProfileModal from './components/ProfileModal';
import UserManagementModal from './components/UserManagementModal';
import TaskReviewModal from './components/TaskReviewModal';

// Icons
import { 
  CheckCircle2, ListTodo, Plus, Calendar, ArrowUp, ArrowDown, 
  StickyNote, CheckSquare, Shield, BarChart2, Briefcase, 
  User, Check, Clock, AlertTriangle, Play, RefreshCw, MessageSquare,
  Settings
} from 'lucide-react';
function App() {
  const {
    currentUser,
    authLoading,
    tasks,
    categories,
    notes,
    activeWorkspace,
    setActiveWorkspace,
    activeFilters,
    setActiveFilters,
    showToast,
    loadTasks,
    loadNotes,
    loginUser,
    registerUser,
    dashboardStats,
    globalDashboardStats,
    userPerformance,
    chartDistributions,
    syncAllData
  } = useApp();

  // Modal Open States
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);

  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState(null);

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [activitySlideoverOpen, setActivitySlideoverOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [usersModalOpen, setUsersModalOpen] = useState(false);

  // Task Review Modal for Admin
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTask, setReviewTask] = useState(null);

  // Auth Card Scroll Reference
  const authCardRef = useRef(null);

  // Auth screen state
  const [authRoleSelection, setAuthRoleSelection] = useState(false); // No landing selection screen by default
  const [selectedAuthRole, setSelectedAuthRole] = useState(
    window.location.hash === '#admin' || window.location.search.includes('admin=true') ? 'Admin' : 'User'
  );
  const [authForm, setAuthForm] = useState('login'); // login | register

  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#admin') {
        setSelectedAuthRole('Admin');
      } else if (window.location.hash === '#user' || !window.location.hash) {
        setSelectedAuthRole('User');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Drag and Drop Local States
  const [draggedTaskId, setDraggedTaskId] = useState(null);

  // PDF Export Layout Local State
  const [printTasks, setPrintTasks] = useState([]);

  // ================= DRAG AND DROP HANDLERS (KANBAN COLUMNS) =================
  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('task-id', taskId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragEnter = (e) => {
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDropColumn = async (e, targetStatus) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const sourceId = Number(e.dataTransfer.getData('task-id') || draggedTaskId);
    if (!sourceId) return;

    const task = tasks.find(t => t.id === sourceId);
    if (!task || task.status === targetStatus) return;

    // Auto-progress mapping by status
    const getAutoProgress = (status) => {
      switch (status) {
        case 'Pending': return 0;
        case 'In Progress': return 25;
        case 'Review': return 75;
        case 'Completed': return 100;
        default: return 0;
      }
    };

    // Permissions logic
    const isAdmin = currentUser?.role === 'Admin';
    if (!isAdmin && targetStatus === 'Completed') {
      showToast('Only administrators can approve reviewed tasks or mark tasks as completed. Please move the task to Review to request approval.', 'warning');
      return;
    }

    try {
      let finalStatus = targetStatus;
      if (!isAdmin && task.user_id !== currentUser?.id && targetStatus === 'Completed') {
        finalStatus = 'Review';
      }

      await API.updateTask(sourceId, {
        title: task.title,
        description: task.description,
        category_id: task.category_id,
        priority: task.priority,
        status: finalStatus,
        due_date: task.due_date,
        completion_percentage: getAutoProgress(finalStatus)
      });
      showToast(`Task moved to ${finalStatus}`, 'success');
      await syncAllData();
    } catch (err) {
      showToast('Failed to update task status.', 'danger');
      await syncAllData(); // rollback UI
    }
  };

  // ================= AUTH FORMS FLOWS =================
  const selectRoleAndGo = (role) => {
    setSelectedAuthRole(role);
    setAuthRoleSelection(false);
    setAuthForm('login');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      const user = await loginUser(loginUsername, loginPassword);
      // Validate role choice match (Warn if logging into mismatched roles, but log them in anyway)
      if (user.role !== selectedAuthRole) {
        showToast(`Logged in as ${user.role} (Selection was: ${selectedAuthRole})`, 'info');
      }
      setLoginUsername('');
      setLoginPassword('');
      // Route workspaces on login
      if (user.role === 'Admin') {
        setActiveWorkspace('tasks');
      } else {
        setActiveWorkspace('tasks');
      }
    } catch (err) {
      // already toast alert in context
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    // Validations matching backend
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(regEmail)) {
      showToast('Invalid email address format.', 'warning');
      return;
    }
    if (regPassword.length < 8) {
      showToast('Password must be at least 8 characters.', 'warning');
      return;
    }
    if (!/[A-Z]/.test(regPassword)) {
      showToast('Password must contain an uppercase letter.', 'warning');
      return;
    }
    if (!/[0-9]/.test(regPassword)) {
      showToast('Password must contain a number.', 'warning');
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>_+\-\[\]\\\/]/.test(regPassword)) {
      showToast('Password must contain a special character.', 'warning');
      return;
    }

    try {
      await registerUser(regUsername, regEmail, regPassword, regFullName, selectedAuthRole);
      // Switch back to login form
      setAuthForm('login');
      setLoginUsername(regUsername);
      setRegUsername('');
      setRegFullName('');
      setRegEmail('');
      setRegPassword('');
    } catch (err) {
      // Already alerted
    }
  };

  // ================= CSV & PDF EXPORT PROCEDURES =================
  const handleExportCsv = () => {
    if (tasks.length === 0) {
      showToast('No tasks available to export.', 'warning');
      return;
    }

    const headers = ['ID', 'Title', 'Description', 'Category', 'Priority', 'Status', 'Due Date', 'Progress %', 'Creator', 'Assignee'];
    const rows = tasks.map(t => [
      t.id,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${(t.category_name || 'No Category').replace(/"/g, '""')}"`,
      t.priority,
      t.status,
      t.due_date,
      t.completion_percentage,
      t.creator_name || 'Admin',
      t.assignee_name || 'Unassigned'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `smart_todo_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV export downloaded successfully.', 'success');
  };

  const handleExportPdf = () => {
    if (tasks.length === 0) {
      showToast('No tasks available to export.', 'warning');
      return;
    }

    setPrintTasks(tasks);
    setTimeout(() => {
      window.print();
      setPrintTasks([]);
    }, 150);
  };

  // ================= MODAL TRIGGERS =================
  const handleOpenTaskAdd = () => {
    setSelectedTask(null);
    setTaskModalOpen(true);
  };

  const handleOpenTaskEdit = (task) => {
    // If standard user click review task, show review details or comments modal
    if (task.status === 'Review' && currentUser?.role === 'Admin') {
      setReviewTask(task);
      setReviewModalOpen(true);
    } else {
      setSelectedTask(task);
      setTaskModalOpen(true);
    }
  };

  const handleDeleteTask = async (id, title) => {
    if (window.confirm(`Are you sure you want to delete task "${title}"?\n\nThis action cannot be undone.`)) {
      try {
        await API.deleteTask(id);
        showToast('Task deleted successfully.', 'success');
        await syncAllData();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    }
  };

  const handleOpenNoteAdd = () => {
    setSelectedNote(null);
    setNoteModalOpen(true);
  };

  const handleOpenNoteEdit = (note) => {
    setSelectedNote(note);
    setNoteModalOpen(true);
  };

  const handleOpenChecklistAdd = () => {
    setSelectedChecklist(null);
    setChecklistModalOpen(true);
  };

  const handleOpenChecklistEdit = (note) => {
    setSelectedChecklist(note);
    setChecklistModalOpen(true);
  };

  const handleSortChange = (sortBy) => {
    setActiveFilters(prev => ({ ...prev, sortBy }));
  };

  const toggleSortOrder = () => {
    const nextOrder = activeFilters.order === 'ASC' ? 'DESC' : 'ASC';
    setActiveFilters(prev => ({ ...prev, order: nextOrder }));
    showToast(`Sorted ${nextOrder === 'DESC' ? 'descending' : 'ascending'}`, 'info');
  };

  if (authLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
        <CheckCircle2 size={48} className="gradient-text" style={{ color: 'var(--primary-color)', animation: 'spin 1.5s linear infinite' }} />
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Syncing Security Session...</p>
      </div>
    );
  }

  // --- Landing & Auth Layout ---
  if (!currentUser) {
    return (
      <div className="container auth-mode" id="landing-container">
        <header className="landing-header">
          <div className="logo">
            <CheckCircle2 />
            <span>SmartTodo</span>
          </div>
          <div className="landing-nav-btns">
            {selectedAuthRole === 'Admin' && (
              <a href="#" className="btn btn-ghost" onClick={() => { setSelectedAuthRole('User'); window.location.hash = ''; }}>User Workspace</a>
            )}
          </div>
        </header>

        <main className="landing-main">
          <div className="auth-form-outer">
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span className="badge badge-priority-high" style={{ textTransform: 'uppercase' }}>Authenticating as: {selectedAuthRole}</span>
            </div>

            <div className="auth-card" ref={authCardRef} id="auth-card" style={{ width: '100%' }}>
              {authForm === 'login' ? (
                <div className="auth-form-wrapper" id="login-form-wrapper">
                  <h2>{selectedAuthRole} Sign In</h2>
                  <p className="subtitle">Enter credentials to load dashboard</p>
                  <form id="login-form" onSubmit={handleLoginSubmit}>
                    <div className="form-group">
                      <label htmlFor="login-username">Username</label>
                      <input 
                        type="text" 
                        id="login-username" 
                        required 
                        placeholder="Enter your username"
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="login-password">Password</label>
                      <input 
                        type="password" 
                        id="login-password" 
                        autoComplete="current-password"
                        required 
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary btn-block">Log In</button>
                  </form>
                  <p className="switch-auth">Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); setAuthForm('register'); }}>Sign up</a></p>

                  {selectedAuthRole === 'Admin' && (
                    <p className="switch-auth" style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                      Not an admin? <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = ''; setSelectedAuthRole('User'); }}>User Sign In</a>
                    </p>
                  )}
                </div>
              ) : (
                <div className="auth-form-wrapper" id="register-form-wrapper">
                  <h2>Create {selectedAuthRole} Account</h2>
                  <p className="subtitle">Join SmartTodo system</p>
                  <form id="register-form" onSubmit={handleRegisterSubmit}>
                    <div className="form-group">
                      <label htmlFor="reg-username">Username</label>
                      <input 
                        type="text" 
                        id="reg-username" 
                        required 
                        placeholder="e.g. jsmith"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="reg-fullname">Full Name</label>
                      <input 
                        type="text" 
                        id="reg-fullname" 
                        required 
                        placeholder="e.g. John Smith"
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="reg-email">Email Address</label>
                      <input 
                        type="email" 
                        id="reg-email" 
                        required 
                        placeholder="username@example.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="reg-password">Password</label>
                      <input 
                        type="password" 
                        id="reg-password" 
                        autoComplete="new-password"
                        required 
                        placeholder="••••••••"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                      />
                      <span className="password-tip">At least 8 characters, 1 uppercase, 1 number, 1 special character.</span>
                    </div>
                    <button type="submit" className="btn btn-primary btn-block">Sign Up</button>
                  </form>
                  <p className="switch-auth">Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setAuthForm('login'); }}>Log in</a></p>

                  {selectedAuthRole === 'Admin' && (
                    <p className="switch-auth" style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                      Not an admin? <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = ''; setSelectedAuthRole('User'); }}>User Sign In</a>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
        <ToastContainer />
      </div>
    );
  }

  // Kanban workspace filter selectors
  const isTasksWorkspace = activeWorkspace === 'tasks';

  // Filter tasks arrays for Kanban display
  const kanbanTasks = tasks.filter(task => {
    if (currentUser.role === 'Admin') {
      return true; // Admin sees all
    }
    // Users see their own tasks (created by them) and tasks assigned to them
    return task.user_id === currentUser.id || task.assigned_to === currentUser.id;
  });

  const columns = [
    { title: 'Pending', status: 'Pending', bgClass: 'kanban-col-pending', color: '#6b7280' },
    { title: 'In Progress', status: 'In Progress', bgClass: 'kanban-col-progress', color: '#8b5cf6' },
    { title: 'Review', status: 'Review', bgClass: 'kanban-col-review', color: '#f59e0b' },
    { title: 'Completed', status: 'Completed', bgClass: 'kanban-col-completed', color: '#10b981' }
  ];

  return (
    <div className="container app-mode" id="app-container">
      <Navbar 
        onOpenProfile={() => setProfileModalOpen(true)}
        onOpenActivity={() => setActivitySlideoverOpen(true)}
        onOpenNotifications={() => setNotificationsOpen(true)}
        onOpenUsers={() => setUsersModalOpen(true)}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
      />

      <div className="app-layout">
        <Sidebar />

        <main className="app-main">

          {/* 1. KANBAN BOARDS WORKSPACE (Tasks & Assigned Tasks) */}
          {isTasksWorkspace && (
            <div id="tasks-workspace" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
              
              <StatsDashboard />

              <section className="tasks-control-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div className="sorting-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>Sort cards:</span>
                  <div className="sort-buttons" style={{ display: 'flex', gap: '0.25rem' }}>
                    {['position', 'due_date', 'priority', 'title', 'created_at'].map(criteria => (
                      <button 
                        key={criteria}
                        className={`btn btn-sort ${activeFilters.sortBy === criteria ? 'active' : ''}`}
                        onClick={() => handleSortChange(criteria)}
                      >
                        {criteria === 'position' ? 'Custom' : 
                         criteria === 'due_date' ? 'Due Date' : 
                         criteria === 'priority' ? 'Priority' : 
                         criteria === 'title' ? 'Alphabetical' : 'Creation Date'}
                      </button>
                    ))}
                  </div>
                  <button 
                    id="sort-order-toggle" 
                    className="btn-icon-small" 
                    onClick={toggleSortOrder}
                    title="Toggle Order"
                  >
                    {activeFilters.order === 'ASC' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                  </button>
                </div>
                {currentUser?.role === 'Admin' && (
                  <button className="btn btn-primary" onClick={handleOpenTaskAdd}>
                    <Plus size={16} /> Create Task
                  </button>
                )}
              </section>

              {/* Categories dropdown below sort cards */}
              <div className="categories-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', maxWidth: 'fit-content' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Categories:</span>
                <select 
                  className="form-control" 
                  style={{ width: '180px', padding: '0.35rem 0.75rem', fontSize: '0.85rem', height: 'auto' }}
                  value={activeFilters.category_id}
                  onChange={(e) => setActiveFilters(prev => ({ ...prev, category_id: e.target.value }))}
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                  ))}
                </select>
                <button 
                  className="btn-icon-small" 
                  onClick={() => setCategoryModalOpen(true)}
                  title="Manage Categories"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Settings size={14} />
                </button>
              </div>

              {/* Kanban Column Grids */}
              <div className="kanban-board-container" style={{ display: 'flex', gap: '1rem', overflowX: 'auto', flex: 1, paddingBottom: '1rem', minHeight: '450px' }}>
                {columns.map(col => {
                  const colTasks = kanbanTasks.filter(t => t.status === col.status);
                  return (
                    <div 
                      key={col.status}
                      className={`kanban-column ${col.bgClass}`}
                      onDragOver={handleDragOver}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDropColumn(e, col.status)}
                      style={{
                        flex: 1,
                        minWidth: '250px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '12px',
                        padding: '1rem',
                        border: '1px solid var(--border-color)',
                        borderTop: `4px solid ${col.color}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: col.color }}>{col.title}</h3>
                        <span style={{ fontSize: '0.8rem', padding: '2px 8px', background: `${col.color}1c`, borderRadius: '12px', color: col.color, fontWeight: 'bold' }}>
                          {colTasks.length}
                        </span>
                      </div>

                      <div className="kanban-task-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '340px', overflowY: 'auto' }}>
                        {colTasks.map(task => (
                          <TaskCard 
                            key={task.id} 
                            task={task} 
                            onEdit={handleOpenTaskEdit}
                            isDraggable={true}
                            dragHandlers={{
                              onDragStart: (e) => handleDragStart(e, task.id),
                              onDragOver: handleDragOver,
                              onDragEnter: handleDragEnter,
                              onDragLeave: handleDragLeave
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* 2. ADMIN MONITORING DASHBOARD */}
          {activeWorkspace === 'admin_dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="workspace-header-bar">
                <h2>Analytics Dashboard</h2>
              </div>

              {/* Status aggregates */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                <div className="stat-card" style={{ borderLeft: '4px solid var(--primary-color)' }}>
                  <h4>{globalDashboardStats.total}</h4>
                  <p>Total Tasks</p>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #6b7280' }}>
                  <h4>{globalDashboardStats.pending}</h4>
                  <p>Pending</p>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
                  <h4>{globalDashboardStats.inProgress}</h4>
                  <p>In Progress</p>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                  <h4>{globalDashboardStats.review}</h4>
                  <p>Pending Review</p>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
                  <h4>{globalDashboardStats.completed}</h4>
                  <p>Completed</p>
                </div>
                <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
                  <h4>{globalDashboardStats.overdue}</h4>
                  <p>Overdue</p>
                </div>
              </div>

              {/* Categories filter dropdown above the task tracking table */}
              <div className="categories-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', maxWidth: 'fit-content' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Categories:</span>
                <select 
                  className="form-control" 
                  style={{ width: '180px', padding: '0.35rem 0.75rem', fontSize: '0.85rem', height: 'auto' }}
                  value={activeFilters.category_id}
                  onChange={(e) => setActiveFilters(prev => ({ ...prev, category_id: e.target.value }))}
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                  ))}
                </select>
                <button 
                  className="btn-icon-small" 
                  onClick={() => setCategoryModalOpen(true)}
                  title="Manage Categories"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Settings size={14} />
                </button>
              </div>

              {/* Tasks overview tabular layout */}
              <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
                <h3 style={{ marginBottom: '1rem' }}>General Task Assignment Tracking</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.5rem' }}>Task Title</th>
                        <th style={{ padding: '0.5rem' }}>Assignee</th>
                        <th style={{ padding: '0.5rem' }}>Priority</th>
                        <th style={{ padding: '0.5rem' }}>Status</th>
                        <th style={{ padding: '0.5rem' }}>Progress</th>
                        <th style={{ padding: '0.5rem' }}>Due Date</th>
                        <th style={{ padding: '0.5rem' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map(t => (
                        <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <strong>{t.title}</strong>
                            {t.category_name && <span className="badge badge-category" style={{ marginLeft: '4px', fontSize: '0.65rem' }}>{t.category_name}</span>}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{t.assignee_name || 'Unassigned'}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <span className={`badge badge-priority-${t.priority.toLowerCase()}`}>{t.priority}</span>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <span className="badge" style={{ backgroundColor: t.status === 'Review' ? '#f59e0b' : (t.status === 'Completed' ? '#10b981' : '#3b82f6'), color: '#fff' }}>
                              {t.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', width: '120px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <div style={{ flex: 1, height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${t.completion_percentage}%`, height: '100%', background: 'var(--primary-color)' }} />
                              </div>
                              <span style={{ fontSize: '0.75rem' }}>{t.completion_percentage}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{new Date(t.due_date).toLocaleDateString()}</td>
                          <td style={{ padding: '0.75rem 0.5rem', display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-ghost btn-small" onClick={() => handleOpenTaskEdit(t)}>
                              {t.status === 'Review' ? 'Review Submission' : 'Edit details'}
                            </button>
                            <button 
                              className="btn btn-ghost btn-small" 
                              onClick={() => handleDeleteTask(t.id, t.title)}
                              style={{ color: 'var(--danger-color)' }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 3. USER PERFORMANCE REPORTS */}
          {activeWorkspace === 'admin_reports' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="workspace-header-bar">
                <h2>User Performance Analytics</h2>
              </div>

              {/* Analytics distributions CSS based rendering */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {/* 1. Status distribution */}
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.25rem', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>Task Status Distribution</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {chartDistributions.statusDistribution.map(item => {
                      const totalTasksCount = chartDistributions.statusDistribution.reduce((acc, curr) => acc + curr.value, 0);
                      const barPercent = totalTasksCount > 0 ? (item.value / totalTasksCount) * 100 : 0;
                      return (
                        <div key={item.name}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                            <span>{item.name}</span>
                            <strong>{item.value} tasks ({Math.round(barPercent)}%)</strong>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${barPercent}%`, height: '100%', background: 'var(--primary-color)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Category distribution */}
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.25rem', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>Tasks Category Distribution</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {chartDistributions.categoryDistribution.map(item => {
                      const totalCatCount = chartDistributions.categoryDistribution.reduce((acc, curr) => acc + curr.value, 0);
                      const barPercent = totalCatCount > 0 ? (item.value / totalCatCount) * 100 : 0;
                      return (
                        <div key={item.name}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                            <span>{item.name}</span>
                            <strong>{item.value} tasks ({Math.round(barPercent)}%)</strong>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${barPercent}%`, height: '100%', background: '#8b5cf6' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* User Performance Index list */}
              <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
                <h3 style={{ marginBottom: '1rem' }}>User Performance Index</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.5rem' }}>User Name</th>
                        <th style={{ padding: '0.5rem' }}>Email</th>
                        <th style={{ padding: '0.5rem' }}>Assigned</th>
                        <th style={{ padding: '0.5rem' }}>Completed</th>
                        <th style={{ padding: '0.5rem' }}>Pending</th>
                        <th style={{ padding: '0.5rem' }}>Overdue</th>
                        <th style={{ padding: '0.5rem' }}>Completion Rate</th>
                        <th style={{ padding: '0.5rem' }}>Avg Completion Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userPerformance.map(perf => (
                        <tr key={perf.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <strong>{perf.name}</strong>
                            <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--text-muted)' }}>@{perf.username}</span>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{perf.email}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{perf.totalAssigned}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{perf.completed}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{perf.pending}</td>
                          <td style={{ padding: '0.75rem 0.5rem', color: perf.overdue > 0 ? 'var(--danger-color)' : 'var(--text-primary)' }}>
                            {perf.overdue}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <strong>{perf.completionRate}%</strong>
                              <div style={{ width: '60px', height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${perf.completionRate}%`, height: '100%', background: 'var(--success-color)' }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            {perf.averageCompletionTimeHours} hours
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* 4. NOTES WORKSPACE */}
          {activeWorkspace === 'notes' && (
            <div id="notes-workspace">
              <div className="workspace-header-bar">
                <h2>Notes</h2>
                <div className="notes-header-actions">
                  <button className="btn btn-primary" onClick={handleOpenNoteAdd}>
                    <Plus size={16} /> Take Note
                  </button>
                </div>
              </div>

              <div id="notes-grid" className="notes-grid">
                {notes.filter(n => n.type !== 'List').length === 0 ? (
                  <div className="no-notes-state">
                    <StickyNote />
                    <p>No notes found. Click "Take Note" to save thoughts!</p>
                  </div>
                ) : (
                  notes.filter(n => n.type !== 'List').map(note => (
                    <NoteCard key={note.id} note={note} onEdit={handleOpenNoteEdit} />
                  ))
                )}
              </div>
            </div>
          )}

          {/* 5. CHECKLISTS WORKSPACE */}
          {activeWorkspace === 'checklists' && (
            <div id="checklists-workspace">
              <div className="workspace-header-bar">
                <h2>Checklists</h2>
                <div className="notes-header-actions">
                  <button className="btn btn-primary" onClick={handleOpenChecklistAdd}>
                    <CheckSquare size={16} /> Create Checklist
                  </button>
                </div>
              </div>

              <div id="checklists-grid" className="notes-grid">
                {notes.filter(n => n.type === 'List').length === 0 ? (
                  <div className="no-notes-state">
                    <CheckSquare />
                    <p>No checklists found. Click "Create Checklist" to get started!</p>
                  </div>
                ) : (
                  notes.filter(n => n.type === 'List').map(note => (
                    <ChecklistCard key={note.id} note={note} onEdit={handleOpenChecklistEdit} />
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ================= MODAL DIALOGS ================= */}
      <TaskModal 
        isOpen={taskModalOpen} 
        task={selectedTask} 
        onClose={() => { setTaskModalOpen(false); setSelectedTask(null); }} 
      />

      <CategoryModal 
        isOpen={categoryModalOpen} 
        onClose={() => setCategoryModalOpen(false)} 
      />

      <NoteModal 
        isOpen={noteModalOpen} 
        note={selectedNote} 
        onClose={() => { setNoteModalOpen(false); setSelectedNote(null); }} 
      />

      <ChecklistModal 
        isOpen={checklistModalOpen} 
        note={selectedChecklist} 
        onClose={() => { setChecklistModalOpen(false); setSelectedChecklist(null); }} 
      />

      <ProfileModal 
        isOpen={profileModalOpen} 
        onClose={() => setProfileModalOpen(false)} 
      />

      <UserManagementModal
        isOpen={usersModalOpen}
        onClose={() => setUsersModalOpen(false)}
      />

      <TaskReviewModal
        isOpen={reviewModalOpen}
        task={reviewTask}
        onClose={() => { setReviewModalOpen(false); setReviewTask(null); }}
      />

      <ActivityLogSlideover 
        isOpen={activitySlideoverOpen} 
        onClose={() => setActivitySlideoverOpen(false)} 
      />

      <NotificationCenter
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />

      <ToastContainer />

      {/* Hidden Print Container for PDF/Print Export */}
      {printTasks.length > 0 && (
        <div className="print-export-hidden">
          <div className="print-header">
            <h1>Smart Todo - Task Manifest</h1>
            <p>Generated on: {new Date().toLocaleString()} | User: {currentUser?.username}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Assignee</th>
              </tr>
            </thead>
            <tbody>
              {printTasks.map(t => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.title}</strong>
                    {t.description && <><br /><small>{t.description}</small></>}
                  </td>
                  <td>{t.category_name || 'None'}</td>
                  <td>{t.priority}</td>
                  <td>{t.status}</td>
                  <td>{new Date(t.due_date).toLocaleString()}</td>
                  <td>{t.assignee_name || 'Unassigned'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;
