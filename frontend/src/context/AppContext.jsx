import React, { createContext, useState, useEffect, useContext } from 'react';
import API from '../services/api';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // --- Core States ---
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [theme, setTheme] = useState('light-theme');
  const [toasts, setToasts] = useState([]);

  // --- Data States ---
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [notes, setNotes] = useState(() => {
    try {
      const stored = localStorage.getItem('notes');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });
  const [activityLogs, setActivityLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);

  // --- Analytics States ---
  const [dashboardStats, setDashboardStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    review: 0,
    completed: 0,
    overdue: 0,
    assigned: 0,
    productivityScore: 0
  });
  const [globalDashboardStats, setGlobalDashboardStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    review: 0,
    completed: 0,
    overdue: 0,
    assigned: 0,
    productivityScore: 0
  });
  const [userPerformance, setUserPerformance] = useState([]);
  const [chartDistributions, setChartDistributions] = useState({
    statusDistribution: [],
    categoryDistribution: []
  });
  
  // --- Workspace States ---
  const [activeWorkspace, setActiveWorkspace] = useState('tasks'); // tasks, notes, checklists, admin_dashboard, admin_users, admin_reports
  const [activeFilters, setActiveFilters] = useState({
    status: '',
    priority: '',
    category_id: '',
    search: '',
    sortBy: 'position',
    order: 'ASC',
    assigned_to: ''
  });

  const [notifiedTaskIds, setNotifiedTaskIds] = useState(new Set());

  // ================= TOAST ALERTS SYSTEM =================
  const showToast = (message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // ================= THEME STATE =================
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light-theme';
    setTheme(savedTheme);
    document.documentElement.className = savedTheme;
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark-theme' ? 'light-theme' : 'dark-theme';
    setTheme(nextTheme);
    document.documentElement.className = nextTheme;
    localStorage.setItem('theme', nextTheme);
    showToast(`Switched to ${nextTheme === 'dark-theme' ? 'Dark' : 'Light'} Mode`, 'info');
  };

  // ================= DATA LOADING & SYNC SYSTEM =================
  const loadCategories = async () => {
    if (!currentUser) return;
    try {
      const data = await API.getCategories();
      setCategories(data);
    } catch (err) {
      console.error('Error loading categories:', err.message);
    }
  };

  const loadTasks = async () => {
    if (!currentUser) return;
    try {
      const data = await API.getTasks(activeFilters);
      setTasks(data);
    } catch (err) {
      console.error('Failed to fetch tasks:', err.message);
    }
  };

  const loadNotes = async () => {
    if (!currentUser || currentUser.role === 'Admin') return;
    try {
      const data = await API.getNotes();
      setNotes(data);
      localStorage.setItem('notes', JSON.stringify(data));
    } catch (err) {
      console.error('Failed to load notes:', err.message);
    }
  };

  const loadActivityLogs = async () => {
    if (!currentUser) return;
    try {
      const data = await API.getActivityLogs();
      setActivityLogs(data);
    } catch (err) {
      console.error('Failed to load activity logs:', err.message);
    }
  };

  const loadNotifications = async () => {
    if (!currentUser) return;
    try {
      const data = await API.getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err.message);
    }
  };

  const loadUsers = async () => {
    if (!currentUser) return;
    try {
      const data = await API.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users list:', err.message);
    }
  };

  const loadDashboardAnalytics = async () => {
    if (!currentUser) return;
    try {
      const personalData = await API.getDashboardAnalytics('user');
      setDashboardStats(personalData);

      if (currentUser.role === 'Admin') {
        const globalData = await API.getDashboardAnalytics('all');
        setGlobalDashboardStats(globalData);
      }
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err.message);
    }
  };

  const loadUserPerformance = async () => {
    if (!currentUser || currentUser.role !== 'Admin') return;
    try {
      const data = await API.getUserPerformanceMetrics();
      setUserPerformance(data);
    } catch (err) {
      console.error('Failed to load user performance metrics:', err.message);
    }
  };

  const loadChartDistributions = async () => {
    if (!currentUser) return;
    try {
      const data = await API.getDistributionAnalytics();
      setChartDistributions(data);
    } catch (err) {
      console.error('Failed to load charts distribution data:', err.message);
    }
  };

  // Central Sync Function - updates everything in-place without page refresh
  const syncAllData = async () => {
    if (!currentUser) return;
    await Promise.all([
      loadTasks(),
      loadNotifications(),
      loadActivityLogs(),
      loadDashboardAnalytics(),
      loadChartDistributions(),
      loadUserPerformance(),
      loadCategories(),
      loadUsers(),
      loadNotes()
    ]);
  };

  // Reload tasks and stats when filters change
  useEffect(() => {
    if (currentUser) {
      loadTasks();
      loadDashboardAnalytics();
      loadChartDistributions();
    }
  }, [activeFilters, currentUser]);

  // Initial load when user logs in
  useEffect(() => {
    if (currentUser) {
      syncAllData();
      
      // Request notification permission
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }
    }
  }, [currentUser]);

  // Real-time synchronization loop (polls every 8 seconds for dashboard changes)
  useEffect(() => {
    let timer = null;
    if (currentUser) {
      timer = setInterval(() => {
        syncAllData();
      }, 8000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [currentUser, activeFilters]);

  // ================= USER SESSION MANAGEMENT =================
  const checkSession = async () => {
    try {
      setAuthLoading(true);

      const params = new URLSearchParams(window.location.search);
      const crmEmpId = params.get('crm_emp');
      const crmName = params.get('crm_name');
      const crmRole = params.get('crm_role');

      if (crmEmpId && crmName) {
        const loginRes = await fetch('/api/auth/crm-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ empId: crmEmpId, name: crmName, role: crmRole })
        });
        const loginData = await loginRes.json();
        if (loginRes.ok) {
          setCurrentUser(loginData.user);
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }
      }

      const data = await API.getMe();
      if (data && data.user) {
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const loginUser = async (username, password) => {
    try {
      const data = await API.login(username, password);
      setCurrentUser(data.user);
      showToast('Logged in successfully.', 'success');
      return data.user;
    } catch (error) {
      showToast(error.message, 'danger');
      throw error;
    }
  };

  const registerUser = async (username, email, password, name = '', role = 'User', employeeId = null) => {
    try {
      const data = await API.register(username, email, password, name, role, employeeId);
      showToast('Registration successful! You may log in now.', 'success');
      return data;
    } catch (error) {
      showToast(error.message, 'danger');
      throw error;
    }
  };

  const resetPassword = async (username, email, newPassword) => {
    try {
      const data = await API.resetPassword(username, email, newPassword);
      showToast('Password reset successfully! You can now log in.', 'success');
      return data;
    } catch (error) {
      showToast(error.message, 'danger');
      throw error;
    }
  };

  const logoutUser = async () => {
    try {
      await API.logout();
      setCurrentUser(null);
      setTasks([]);
      setNotes([]);
      localStorage.removeItem('notes');
      setCategories([]);
      setActivityLogs([]);
      setNotifications([]);
      setUsers([]);
      showToast('Logged out successfully.', 'success');
    } catch (error) {
      showToast('Error logging out.', 'danger');
    }
  };

  // ================= DEADLINE REMINDER ALARMS =================
  const checkDeadlines = () => {
    if (!currentUser || tasks.length === 0) return;

    const now = new Date();
    const alertThresholdMinutes = 15;

    tasks.forEach(task => {
      if (task.status === 'Completed' || task.status === 'Review') return;
      if (notifiedTaskIds.has(task.id)) return;

      const dueDate = new Date(task.due_date);
      const diffMs = dueDate - now;
      const diffMins = diffMs / 60000;

      if (diffMins > 0 && diffMins <= alertThresholdMinutes) {
        setNotifiedTaskIds(prev => {
          const next = new Set(prev);
          next.add(task.id);
          return next;
        });

        const alertMsg = `Task deadline approaching: "${task.title}" is due in ${Math.round(diffMins)} minutes!`;
        showToast(alertMsg, 'warning', 10000);

        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('Smart Todo Reminder', {
              body: alertMsg,
              icon: '/favicon.ico'
            });
          } catch (e) {
            console.error('Notification creation failed:', e);
          }
        }
      }
    });
  };

  // Poll for upcoming due tasks every 60s
  useEffect(() => {
    let poller = null;
    if (currentUser) {
      poller = setInterval(checkDeadlines, 60000);
      checkDeadlines();
    }
    return () => {
      if (poller) clearInterval(poller);
    };
  }, [tasks, currentUser, notifiedTaskIds]);

  return (
    <AppContext.Provider value={{
      currentUser,
      authLoading,
      theme,
      toasts,
      tasks,
      categories,
      notes,
      activityLogs,
      notifications,
      users,
      dashboardStats,
      globalDashboardStats,
      userPerformance,
      chartDistributions,
      activeWorkspace,
      activeFilters,
      showToast,
      removeToast,
      toggleTheme,
      setTheme,
      loginUser,
      registerUser,
      resetPassword,
      logoutUser,
      setActiveWorkspace,
      setActiveFilters,
      loadCategories,
      loadTasks,
      loadNotes,
      loadActivityLogs,
      loadNotifications,
      loadUsers,
      loadDashboardAnalytics,
      loadUserPerformance,
      loadChartDistributions,
      syncAllData,
      checkSession
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
