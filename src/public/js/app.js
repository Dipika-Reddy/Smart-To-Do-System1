/**
 * Smart Todo - Frontend Logic Engine (app.js)
 * Implements single-page application behaviour, authentication flows,
 * dynamic dashboard statistics, drag-and-drop task reordering,
 * search debouncing, CSV/PDF exports, and deadline reminders.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- State Variables ---
  let currentUser = null;
  let categories = [];
  let tasks = []; // All tasks of the user
  let activeFilters = {
    status: '',       // All, Pending, Completed
    priority: '',     // All, High, Medium, Low
    category_id: '',  // All
    search: '',       // Search string
    sortBy: 'position',
    order: 'ASC'
  };
  let notifiedTaskIds = new Set(); // Track tasks we have already sent alarms for
  let searchTimeout = null;

  // --- Circular SVG Progress Bar Constants ---
  const CIRCUMFERENCE = 2 * Math.PI * 40; // 251.2

  // ================= DOM ELEMENTS =================
  const elements = {
    // Containers
    landingContainer: document.getElementById('landing-container'),
    appContainer: document.getElementById('app-container'),
    toastContainer: document.getElementById('toast-container'),
    printExportContainer: document.getElementById('print-export-container'),
    
    // Auth Forms
    loginFormWrapper: document.getElementById('login-form-wrapper'),
    registerFormWrapper: document.getElementById('register-form-wrapper'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    
    // Auth buttons
    showLoginBtn: document.getElementById('show-login-btn'),
    showRegisterBtn: document.getElementById('show-register-btn'),
    toRegister: document.getElementById('to-register'),
    toLogin: document.getElementById('to-login'),
    heroGetStarted: document.getElementById('hero-get-started'),
    logoutBtn: document.getElementById('logout-btn'),
    
    // Nav & Profiles
    navUsername: document.getElementById('nav-username'),
    profileDropdownBtn: document.getElementById('profile-dropdown-btn'),
    profileDropdown: document.getElementById('profile-dropdown'),
    openProfileBtn: document.getElementById('open-profile-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    activityLogToggle: document.getElementById('activity-log-toggle'),
    
    // Search, Filters & Sorters
    taskSearch: document.getElementById('task-search'),
    categoryFilter: document.getElementById('category-filter'),
    priorityFilterRadios: document.getElementsByName('priority-filter'),
    sortButtons: document.querySelectorAll('.btn-sort'),
    sortOrderToggle: document.getElementById('sort-order-toggle'),
    
    // Stats Cards
    statTotal: document.getElementById('stat-total'),
    statPending: document.getElementById('stat-pending'),
    statCompleted: document.getElementById('stat-completed'),
    statOverdue: document.getElementById('stat-overdue'),
    radialBar: document.querySelector('.radial-bar'),
    radialPercent: document.getElementById('radial-percent'),
    
    // Task Area
    tasksList: document.getElementById('tasks-list'),
    addTaskBtn: document.getElementById('add-task-btn'),
    manageCategoriesBtn: document.getElementById('manage-categories-btn'),
    
    // Exports
    exportCsvBtn: document.getElementById('export-csv-btn'),
    exportPdfBtn: document.getElementById('export-pdf-btn'),
    
    // Modals
    taskModal: document.getElementById('task-modal'),
    taskForm: document.getElementById('task-form'),
    taskModalTitle: document.getElementById('task-modal-title'),
    taskIdInput: document.getElementById('task-id'),
    taskTitleInput: document.getElementById('task-title'),
    taskDescInput: document.getElementById('task-desc'),
    taskCategorySelect: document.getElementById('task-category'),
    taskPrioritySelect: document.getElementById('task-priority'),
    taskDueDateInput: document.getElementById('task-due-date'),
    taskStatusSelect: document.getElementById('task-status'),
    taskStatusRow: document.getElementById('task-status-row'),
    taskFormSubmit: document.getElementById('task-form-submit'),
    
    categoryModal: document.getElementById('category-modal'),
    categoryAddForm: document.getElementById('category-add-form'),
    newCategoryName: document.getElementById('new-category-name'),
    categoriesList: document.getElementById('categories-list'),
    
    profileModal: document.getElementById('profile-modal'),
    profileUsername: document.getElementById('profile-username'),
    profileEmail: document.getElementById('profile-email'),
    themeLightBtn: document.getElementById('theme-light-btn'),
    themeDarkBtn: document.getElementById('theme-dark-btn'),
    changePassToggle: document.getElementById('change-pass-toggle'),
    
    activitySlideover: document.getElementById('activity-slideover'),
    activitySlideoverClose: document.getElementById('activity-slideover-close'),
    activityLogList: document.getElementById('activity-log-list'),
    
    // Notes & Lists elements
    wsTasksBtn: document.getElementById('ws-tasks-btn'),
    wsNotesBtn: document.getElementById('ws-notes-btn'),
    wsListsBtn: document.getElementById('ws-lists-btn'),
    tasksWorkspace: document.getElementById('tasks-workspace'),
    notesWorkspace: document.getElementById('notes-workspace'),
    checklistsWorkspace: document.getElementById('checklists-workspace'),
    addNoteBtn: document.getElementById('add-note-btn'),
    addListBtn: document.getElementById('add-list-btn'),
    notesGrid: document.getElementById('notes-grid'),
    checklistsGrid: document.getElementById('checklists-grid'),
    
    // Decoupled Note Modal
    noteModal: document.getElementById('note-modal'),
    noteForm: document.getElementById('note-form'),
    noteModalTitle: document.getElementById('note-modal-title'),
    noteIdInput: document.getElementById('note-id'),
    noteTitleInput: document.getElementById('note-title'),
    noteContentInput: document.getElementById('note-content'),
    noteTemplateSelect: document.getElementById('note-template'),
    noteColorPicker: document.getElementById('color-palette-picker'),
    notePatternPicker: document.getElementById('note-pattern-picker'),
    noteFormSubmit: document.getElementById('note-form-submit'),

    // Decoupled Checklist Modal
    checklistModal: document.getElementById('checklist-modal'),
    checklistForm: document.getElementById('checklist-form'),
    checklistModalTitle: document.getElementById('checklist-modal-title'),
    checklistIdInput: document.getElementById('checklist-id'),
    checklistTitleInput: document.getElementById('checklist-title'),
    checklistItemsContainer: document.getElementById('checklist-items-container'),
    checklistAddItemBtn: document.getElementById('checklist-add-item-btn'),
    checklistColorPicker: document.getElementById('checklist-color-picker'),
    checklistPatternPicker: document.getElementById('checklist-pattern-picker'),
    checklistFormSubmit: document.getElementById('checklist-form-submit')
  };

  // ================= TOAST NOTIFICATIONS WIDGET =================
  function showToast(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'warning') icon = 'fa-triangle-exclamation';
    if (type === 'danger') icon = 'fa-circle-xmark';

    toast.innerHTML = `
      <i class="fa-solid ${icon} toast-icon"></i>
      <span class="toast-message">${escapeHTML(message)}</span>
      <button class="toast-close"><i class="fa-solid fa-times"></i></button>
    `;

    elements.toastContainer.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    });

    // Auto dismiss
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  // ================= THEME MANAGER =================
  function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light-theme';
    document.documentElement.className = savedTheme;
    updateThemeIcon(savedTheme);
  }

  function toggleTheme() {
    const current = document.documentElement.className;
    const next = current === 'dark-theme' ? 'light-theme' : 'dark-theme';
    document.documentElement.className = next;
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
    showToast(`Switched to ${next === 'dark-theme' ? 'Dark' : 'Light'} Mode`, 'info');
  }

  function updateThemeIcon(theme) {
    const icon = elements.themeToggle.querySelector('i');
    if (theme === 'dark-theme') {
      icon.className = 'fa-solid fa-sun';
      elements.themeToggle.title = 'Switch to Light Mode';
    } else {
      icon.className = 'fa-solid fa-moon';
      elements.themeToggle.title = 'Switch to Dark Mode';
    }
  }

  // ================= INITIAL SESSION CHECK =================
  async function checkSession() {
    try {
      const data = await API.getMe();
      if (data && data.user) {
        currentUser = data.user;
        setupAppState();
      } else {
        setupLandingState();
      }
    } catch (err) {
      setupLandingState();
    }
  }

  function setupAppState() {
    currentUser = currentUser || { username: 'User', email: 'you@example.com' };
    elements.navUsername.textContent = currentUser.username;
    
    // Toggle container views
    elements.landingContainer.classList.add('hidden');
    elements.appContainer.classList.remove('hidden');
    
    // Load initial tasks & categories
    loadCategories();
    loadTasks();
    
    // Trigger desktop notifications permissions
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Set reminder poller check
    setInterval(checkDeadlines, 60000);
  }

  function setupLandingState() {
    currentUser = null;
    elements.landingContainer.classList.remove('hidden');
    elements.appContainer.classList.add('hidden');
  }

  // ================= LOADING DATABASE ASSETS =================
  async function loadCategories() {
    try {
      categories = await API.getCategories();
      populateCategoryDropdowns();
    } catch (error) {
      showToast('Error loading task categories.', 'danger');
    }
  }

  function populateCategoryDropdowns() {
    // 1. Sidebar Filter select
    const filterSelect = elements.categoryFilter;
    filterSelect.innerHTML = '<option value="">All Categories</option>';
    
    // 2. Form Category select
    const formSelect = elements.taskCategorySelect;
    formSelect.innerHTML = '<option value="">No Category</option>';

    categories.forEach(cat => {
      const optVal = cat.id;
      const optText = cat.category_name;
      
      const opt1 = document.createElement('option');
      opt1.value = optVal;
      opt1.textContent = optText;
      filterSelect.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = optVal;
      opt2.textContent = optText;
      formSelect.appendChild(opt2);
    });
    
    // Re-select active filter value
    filterSelect.value = activeFilters.category_id;
  }

  async function loadTasks() {
    try {
      tasks = await API.getTasks(activeFilters);
      renderTasksList();
      updateDashboardStats();
    } catch (error) {
      showToast('Failed to fetch tasks from server.', 'danger');
    }
  }

  // ================= DASHBOARD STATISTICS & CHARTS =================
  function updateDashboardStats() {
    // Total, pending, completed, overdue
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const pending = total - completed;
    
    // Calculate overdue (pending tasks with due dates in past)
    const now = new Date();
    const overdue = tasks.filter(t => t.status === 'Pending' && new Date(t.due_date) < now).length;

    elements.statTotal.textContent = total;
    elements.statPending.textContent = pending;
    elements.statCompleted.textContent = completed;
    elements.statOverdue.textContent = overdue;

    // Circular Progress Percentage
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    elements.radialPercent.textContent = `${percent}%`;

    // Radial Circle Offset: Circumference is 251.2
    const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;
    elements.radialBar.style.strokeDashoffset = offset;
  }

  // ================= TASK CARD UI RENDERER =================
  function renderTasksList() {
    const list = elements.tasksList;
    list.innerHTML = '';

    if (tasks.length === 0) {
      list.innerHTML = `
        <div class="no-tasks-state">
          <i class="fa-regular fa-folder-open"></i>
          <p>No tasks found matching current filters. Press Add Task to begin.</p>
        </div>
      `;
      return;
    }

    tasks.forEach(task => {
      const card = createTaskCardElement(task);
      list.appendChild(card);
    });

    // Rebind drag & drop event handles since cards have changed
    setupDragAndDrop();
  }

  function createTaskCardElement(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.id = task.id;
    card.draggable = activeFilters.sortBy === 'position'; // Only allow drag-and-drop when sorted by custom position!
    
    // Detect Completed status
    const isCompleted = task.status === 'Completed';
    if (isCompleted) card.classList.add('completed');

    // Detect Overdue status
    const now = new Date();
    const dueDate = new Date(task.due_date);
    const isOverdue = !isCompleted && dueDate < now;
    if (isOverdue) card.classList.add('overdue-task');

    // Format Remaining Time Badge
    const remainingTimeHTML = getRemainingTimeLabel(dueDate, isCompleted);

    // Format Priority Badge
    const priorityClass = `badge-priority-${task.priority.toLowerCase()}`;
    const priorityIcon = task.priority === 'High' ? 'fa-angles-up' : (task.priority === 'Medium' ? 'fa-angle-up' : 'fa-angle-down');

    // Drag handle check
    const dragHandleHTML = activeFilters.sortBy === 'position' 
      ? `<div class="task-card-drag-handle" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></div>`
      : '';

    card.innerHTML = `
      ${dragHandleHTML}
      <div class="task-card-checkbox" title="${isCompleted ? 'Mark Pending' : 'Mark Completed'}">
        <i class="fa-solid fa-check"></i>
      </div>
      <div class="task-card-info">
        <div class="task-card-header">
          <span class="task-card-title" title="${escapeHTML(task.title)}">${escapeHTML(task.title)}</span>
          <span class="badge ${priorityClass}">
            <i class="fa-solid ${priorityIcon}"></i> ${task.priority}
          </span>
          ${task.category_name ? `<span class="badge badge-category"><i class="fa-solid fa-tag"></i> ${escapeHTML(task.category_name)}</span>` : ''}
        </div>
        ${task.description ? `<p class="task-card-desc">${escapeHTML(task.description)}</p>` : ''}
        <div class="task-card-meta">
          <span class="meta-due-date ${isOverdue ? 'danger-text' : ''}">
            <i class="fa-regular fa-calendar-days"></i> Due: ${formatDateTime(dueDate)}
          </span>
          ${remainingTimeHTML}
        </div>
      </div>
      <div class="task-card-actions">
        <button class="btn-icon-small edit-task" title="Edit Task"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-icon-small delete-task" title="Delete Task"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;

    // Bind item specific event listeners
    // 1. Toggle completed state
    const checkbox = card.querySelector('.task-card-checkbox');
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTaskCompletion(task);
    });

    // 2. Edit Action
    const editBtn = card.querySelector('.edit-task');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openTaskModal(task);
    });

    // 3. Delete Action
    const deleteBtn = card.querySelector('.delete-task');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTaskHandler(task.id);
    });

    return card;
  }

  function getRemainingTimeLabel(dueDate, isCompleted) {
    if (isCompleted) {
      return `<span class="badge-success-text"><i class="fa-regular fa-circle-check"></i> Done</span>`;
    }

    const now = new Date();
    const diffMs = dueDate - now;

    if (diffMs < 0) {
      return `<span class="badge-danger-text"><i class="fa-solid fa-circle-exclamation"></i> Overdue</span>`;
    }

    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMs > 24 * 3600000) {
      return `<span><i class="fa-regular fa-clock"></i> ${diffDays} ${diffDays === 1 ? 'day' : 'days'} remaining</span>`;
    }
    if (diffMs >= 60 * 60000) {
      return `<span class="warning-text"><i class="fa-regular fa-clock"></i> ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} remaining</span>`;
    }
    return `<span class="warning-text"><i class="fa-regular fa-clock"></i> ${diffMin} ${diffMin === 1 ? 'min' : 'mins'} left!</span>`;
  }

  function formatDateTime(date) {
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString(undefined, options);
  }

  // ================= TASK CRUD HANDLERS =================
  async function toggleTaskCompletion(task) {
    const newStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    try {
      await API.updateTask(task.id, {
        title: task.title,
        description: task.description,
        category_id: task.category_id,
        priority: task.priority,
        status: newStatus,
        due_date: task.due_date
      });
      showToast(`Task marked as ${newStatus}`, 'success');
      loadTasks();
    } catch (error) {
      showToast(error.message, 'danger');
    }
  }

  async function deleteTaskHandler(id) {
    if (confirm('Are you sure you want to delete this task?')) {
      try {
        await API.deleteTask(id);
        showToast('Task deleted successfully.', 'success');
        loadTasks();
      } catch (error) {
        showToast(error.message, 'danger');
      }
    }
  }

  // ================= DRAG AND DROP PERSISTENCE =================
  let dragSrcEl = null;

  function setupDragAndDrop() {
    // Only bind events if custom layout sort is active
    if (activeFilters.sortBy !== 'position') return;

    const cards = document.querySelectorAll('#tasks-list .task-card');
    cards.forEach(card => {
      card.addEventListener('dragstart', handleDragStart, false);
      card.addEventListener('dragenter', handleDragEnter, false);
      card.addEventListener('dragover', handleDragOver, false);
      card.addEventListener('dragleave', handleDragLeave, false);
      card.addEventListener('drop', handleDrop, false);
      card.addEventListener('dragend', handleDragEnd, false);
    });
  }

  function handleDragStart(e) {
    this.classList.add('dragging');
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    e.dataTransfer.setData('task-id', this.dataset.id);
  }

  function handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault(); // Required to drop
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  function handleDragEnter(e) {
    this.classList.add('drag-over');
  }

  function handleDragLeave(e) {
    this.classList.remove('drag-over');
  }

  async function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    if (dragSrcEl !== this) {
      const sourceId = e.dataTransfer.getData('task-id');
      const targetId = this.dataset.id;

      // Rearrange task elements in DOM list
      const list = elements.tasksList;
      const allCards = Array.from(list.querySelectorAll('.task-card'));
      const sourceIndex = allCards.findIndex(c => c.dataset.id === sourceId);
      const targetIndex = allCards.findIndex(c => c.dataset.id === targetId);

      if (sourceIndex < targetIndex) {
        // Insert source after target
        this.parentNode.insertBefore(dragSrcEl, this.nextSibling);
      } else {
        // Insert source before target
        this.parentNode.insertBefore(dragSrcEl, this);
      }

      // Calculate new positions based on DOM hierarchy order
      const updatedCards = Array.from(list.querySelectorAll('.task-card'));
      const reorderPayload = updatedCards.map((card, index) => ({
        id: Number(card.dataset.id),
        position: index + 1
      }));

      try {
        await API.reorderTasks(reorderPayload);
        // Silently reload local structures without fully rendering immediately
        tasks = await API.getTasks(activeFilters);
        updateDashboardStats();
      } catch (err) {
        showToast('Failed to save task order to server.', 'danger');
        loadTasks(); // Reset layout on fail
      }
    }
    return false;
  }

  function handleDragEnd(e) {
    this.classList.remove('dragging');
    const cards = document.querySelectorAll('#tasks-list .task-card');
    cards.forEach(card => card.classList.remove('drag-over'));
  }

  // ================= MODALS CONTROLLER =================
  // Open Task Modal (Add Mode: no arg / Edit Mode: task object)
  function openTaskModal(task = null) {
    const isEdit = !!task;
    elements.taskModalTitle.textContent = isEdit ? 'Edit Task Parameters' : 'Add New Task';
    elements.taskFormSubmit.textContent = isEdit ? 'Save Changes' : 'Create Task';
    
    if (isEdit) {
      elements.taskIdInput.value = task.id;
      elements.taskTitleInput.value = task.title;
      elements.taskDescInput.value = task.description || '';
      elements.taskCategorySelect.value = task.category_id || '';
      elements.taskPrioritySelect.value = task.priority;
      
      // Format timestamp to YYYY-MM-DDTHH:MM for datetime-local
      const d = new Date(task.due_date);
      const pad = n => String(n).padStart(2, '0');
      const formattedDate = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      elements.taskDueDateInput.value = formattedDate;
      
      elements.taskStatusSelect.value = task.status;
      elements.taskStatusRow.classList.remove('hidden');
    } else {
      elements.taskForm.reset();
      elements.taskIdInput.value = '';
      elements.taskStatusRow.classList.add('hidden');
      
      // Default due date to tomorrow same time
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
      elements.taskDueDateInput.value = tomorrow.toISOString().slice(0, 16);
    }

    elements.taskModal.classList.remove('hidden');
  }

  function closeModals() {
    elements.taskModal.classList.add('hidden');
    elements.categoryModal.classList.add('hidden');
    elements.profileModal.classList.add('hidden');
    elements.noteModal.classList.add('hidden');
    elements.checklistModal.classList.add('hidden');
  }

  // ================= TASK SUBMIT FORM =================
  elements.taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const taskId = elements.taskIdInput.value;
    
    const taskData = {
      title: elements.taskTitleInput.value,
      description: elements.taskDescInput.value,
      category_id: elements.taskCategorySelect.value ? Number(elements.taskCategorySelect.value) : null,
      priority: elements.taskPrioritySelect.value,
      due_date: elements.taskDueDateInput.value
    };

    // Validation: Title not empty
    if (!taskData.title.trim()) {
      showToast('Task title cannot be empty.', 'warning');
      return;
    }

    // Validation: Due date not in past
    const now = new Date();
    const selectedDate = new Date(taskData.due_date);
    if (selectedDate < now) {
      showToast('Due date cannot be set in the past.', 'warning');
      return;
    }

    try {
      if (taskId) {
        // Edit Mode
        taskData.status = elements.taskStatusSelect.value;
        await API.updateTask(taskId, taskData);
        showToast('Task updated successfully.', 'success');
      } else {
        // Add Mode
        await API.createTask(taskData);
        showToast('Task created successfully.', 'success');
      }
      closeModals();
      loadTasks();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // ================= CATEGORY CRUDS MANAGER =================
  async function openCategoryModal() {
    elements.newCategoryName.value = '';
    await renderCategoryManagerList();
    elements.categoryModal.classList.remove('hidden');
  }

  async function renderCategoryManagerList() {
    try {
      categories = await API.getCategories();
      elements.categoriesList.innerHTML = '';
      
      if (categories.length === 0) {
        elements.categoriesList.innerHTML = '<li class="muted-text">No custom categories.</li>';
        return;
      }

      categories.forEach(cat => {
        const li = document.createElement('li');
        li.innerHTML = `
          <span>${escapeHTML(cat.category_name)}</span>
          <div class="manager-list-actions">
            <button class="btn-icon-small delete-cat" data-id="${cat.id}"><i class="fa-solid fa-trash"></i></button>
          </div>
        `;
        
        li.querySelector('.delete-cat').addEventListener('click', async () => {
          if (confirm(`Delete category "${cat.category_name}"? Existing tasks under this category will retain their information but lose category bindings.`)) {
            try {
              await API.deleteCategory(cat.id);
              showToast('Category deleted.', 'success');
              await renderCategoryManagerList();
              await loadCategories();
              loadTasks();
            } catch (err) {
              showToast(err.message, 'danger');
            }
          }
        });

        elements.categoriesList.appendChild(li);
      });
    } catch (err) {
      showToast('Error listing categories.', 'danger');
    }
  }

  elements.categoryAddForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = elements.newCategoryName.value.trim();
    if (!name) return;

    try {
      await API.createCategory(name);
      showToast('Category added successfully.', 'success');
      elements.newCategoryName.value = '';
      await renderCategoryManagerList();
      await loadCategories();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // ================= NOTES & LISTS SYSTEM =================
  let notes = [];
  let selectedNoteColor = 'default';
  let selectedNotePattern = 'blank';
  let selectedChecklistColor = 'default';
  let selectedChecklistPattern = 'blank';

  async function loadNotes() {
    try {
      notes = await API.getNotes();
      renderNotesList();
    } catch (error) {
      showToast('Failed to load notes.', 'danger');
    }
  }

  function createNoteCardDOM(note) {
    const card = document.createElement('div');
    card.className = `note-card note-${note.color_theme || 'default'} note-pattern-${note.pattern_theme || 'blank'}`;
    card.dataset.id = note.id;

    // Note actions overlay (hover visible)
    const actions = document.createElement('div');
    actions.className = 'note-card-actions';
    actions.innerHTML = `
      <button class="btn-icon-small edit-note" title="Edit"><i class="fa-solid fa-pen"></i></button>
      <button class="btn-icon-small delete-note" title="Delete"><i class="fa-solid fa-trash"></i></button>
    `;

    // Content area mapping
    let contentHTML = '';
    if (note.type === 'List') {
      let items = [];
      try {
        items = JSON.parse(note.content || '[]');
      } catch (e) {
        items = [];
      }
      
      if (items.length === 0) {
        contentHTML = `<div class="note-card-content italic-text">Empty checklist</div>`;
      } else {
        // Render checklist items (first 5 to keep card layout tidy)
        const limitItems = items.slice(0, 5);
        const listItemsHTML = limitItems.map((item, idx) => `
          <li class="note-card-checklist-item ${item.checked ? 'checked' : ''}" data-index="${idx}">
            <input type="checkbox" ${item.checked ? 'checked' : ''} class="card-item-check-input">
            <span class="card-item-text-label">${escapeHTML(item.text)}</span>
          </li>
        `).join('');
        
        contentHTML = `
          <ul class="note-card-checklist">
            ${listItemsHTML}
            ${items.length > 5 ? `<li class="note-card-checklist-item italic-text">...and ${items.length - 5} more</li>` : ''}
          </ul>
        `;
      }
    } else {
      contentHTML = `<div class="note-card-content">${escapeHTML(note.content)}</div>`;
    }

    card.innerHTML = `
      <div class="note-card-title">${escapeHTML(note.title)}</div>
      ${contentHTML}
      <div class="note-card-footer">
        <span class="note-card-badge">
          <i class="fa-solid ${note.type === 'List' ? 'fa-square-check' : 'fa-note-sticky'}"></i> ${note.type}
        </span>
        <span>${formatDateTime(new Date(note.created_at || Date.now()))}</span>
      </div>
    `;

    card.appendChild(actions);

    // Event bindings
    // Clicking checkbox input toggles checklist item status immediately from card
    if (note.type === 'List') {
      const checkboxes = card.querySelectorAll('.card-item-check-input');
      checkboxes.forEach(checkInput => {
        checkInput.addEventListener('click', async (e) => {
          e.stopPropagation(); // Stop click from bubbling and opening edit modal!
          const itemEl = checkInput.closest('.note-card-checklist-item');
          const index = Number(itemEl.dataset.index);
          let items = [];
          try {
            items = JSON.parse(note.content || '[]');
          } catch (err) {}
          
          if (items[index]) {
            items[index].checked = checkInput.checked; // sync with native check state
            try {
              await API.updateNote(note.id, {
                title: note.title,
                content: JSON.stringify(items),
                type: note.type,
                color_theme: note.color_theme,
                pattern_theme: note.pattern_theme || 'blank'
              });
              loadNotes();
            } catch (err) {
              showToast('Failed to save checklist state.', 'danger');
            }
          }
        });
      });
    }

    // Card edit click
    card.addEventListener('click', () => {
      if (note.type === 'List') {
        openChecklistModal(note);
      } else {
        openNoteModal(note);
      }
    });

    // Card action buttons click
    card.querySelector('.edit-note').addEventListener('click', (e) => {
      e.stopPropagation();
      if (note.type === 'List') {
        openChecklistModal(note);
      } else {
        openNoteModal(note);
      }
    });

    card.querySelector('.delete-note').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteNoteHandler(note.id);
    });

    return card;
  }

  function renderNotesList() {
    // 1. Text Notes rendering
    const notesGrid = elements.notesGrid;
    notesGrid.innerHTML = '';
    const textNotes = notes.filter(n => n.type !== 'List');

    if (textNotes.length === 0) {
      notesGrid.innerHTML = `
        <div class="no-notes-state">
          <i class="fa-regular fa-lightbulb"></i>
          <p>No notes found. Click "Take Note" to save thoughts!</p>
        </div>
      `;
    } else {
      textNotes.forEach(note => {
        const card = createNoteCardDOM(note);
        notesGrid.appendChild(card);
      });
    }

    // 2. Checklists rendering
    const checklistsGrid = elements.checklistsGrid;
    if (checklistsGrid) {
      checklistsGrid.innerHTML = '';
      const checklistNotes = notes.filter(n => n.type === 'List');

      if (checklistNotes.length === 0) {
        checklistsGrid.innerHTML = `
          <div class="no-notes-state">
            <i class="fa-regular fa-square-check"></i>
            <p>No checklists found. Click "Create Checklist" to get started!</p>
          </div>
        `;
      } else {
        checklistNotes.forEach(note => {
          const card = createNoteCardDOM(note);
          checklistsGrid.appendChild(card);
        });
      }
    }
  }

  async function deleteNoteHandler(id) {
    if (confirm('Are you sure you want to delete this note/list?')) {
      try {
        await API.deleteNote(id);
        showToast('Note deleted.', 'success');
        loadNotes();
      } catch (err) {
        showToast('Failed to delete note.', 'danger');
      }
    }
  }

  function openNoteModal(note = null) {
    const isEdit = !!note;
    elements.noteIdInput.value = isEdit ? note.id : '';
    elements.noteTitleInput.value = isEdit ? note.title : '';
    elements.noteContentInput.value = isEdit ? note.content : '';
    elements.noteTemplateSelect.value = ''; // reset on open

    elements.noteModalTitle.textContent = isEdit ? 'Edit Note' : 'Take a Note';
    elements.noteFormSubmit.textContent = isEdit ? 'Save Note' : 'Add Note';

    // Set styling parameters
    selectedNoteColor = isEdit ? (note.color_theme || 'default') : 'default';
    selectedNotePattern = isEdit ? (note.pattern_theme || 'blank') : 'blank';

    updateColorPickerActive(elements.noteColorPicker, selectedNoteColor);
    updatePatternPickerActive(elements.notePatternPicker, selectedNotePattern);

    elements.noteModal.classList.remove('hidden');
  }

  function openChecklistModal(note = null) {
    const isEdit = !!note;
    elements.checklistIdInput.value = isEdit ? note.id : '';
    elements.checklistTitleInput.value = isEdit ? note.title : '';
    elements.checklistItemsContainer.innerHTML = '';

    elements.checklistModalTitle.textContent = isEdit ? 'Edit Checklist' : 'Create Checklist';
    elements.checklistFormSubmit.textContent = isEdit ? 'Save Checklist' : 'Create Checklist';

    if (isEdit) {
      let items = [];
      try {
        items = JSON.parse(note.content || '[]');
      } catch (e) {}
      
      if (items.length > 0) {
        items.forEach(item => addChecklistItemRow(elements.checklistItemsContainer, item.text, item.checked));
      } else {
        addChecklistItemRow(elements.checklistItemsContainer);
      }
    } else {
      addChecklistItemRow(elements.checklistItemsContainer);
    }

    // Set styling parameters
    selectedChecklistColor = isEdit ? (note.color_theme || 'default') : 'default';
    selectedChecklistPattern = isEdit ? (note.pattern_theme || 'blank') : 'blank';

    updateColorPickerActive(elements.checklistColorPicker, selectedChecklistColor);
    updatePatternPickerActive(elements.checklistPatternPicker, selectedChecklistPattern);

    elements.checklistModal.classList.remove('hidden');
  }

  function addChecklistItemRow(container, text = '', checked = false) {
    const row = document.createElement('div');
    row.className = 'checklist-builder-row';
    row.innerHTML = `
      <input type="checkbox" ${checked ? 'checked' : ''}>
      <input type="text" class="form-control checklist-item-text" required placeholder="List item text..." value="${escapeHTML(text)}">
      <button type="button" class="btn-icon-small remove-item" title="Remove"><i class="fa-solid fa-trash"></i></button>
    `;

    row.querySelector('.remove-item').addEventListener('click', () => {
      row.remove();
    });

    container.appendChild(row);
    row.querySelector('.checklist-item-text').focus();
  }

  function updateColorPickerActive(container, color) {
    const options = container.querySelectorAll('.color-picker-option');
    options.forEach(opt => {
      if (opt.dataset.color === color) {
        opt.classList.add('active');
      } else {
        opt.classList.remove('active');
      }
    });
  }

  function updatePatternPickerActive(container, pattern) {
    const options = container.querySelectorAll('.pattern-picker-option');
    options.forEach(opt => {
      if (opt.dataset.pattern === pattern) {
        opt.classList.add('active');
      } else {
        opt.classList.remove('active');
      }
    });
  }

  // ================= USER ACCOUNT SETTINGS =================
  function openProfileModal() {
    elements.profileUsername.textContent = currentUser.username;
    elements.profileEmail.textContent = currentUser.email;
    elements.profileModal.classList.remove('hidden');
  }

  // ================= SLIDE-OUT ACTIVITY LOGGER =================
  async function toggleActivitySlideover() {
    const isHidden = elements.activitySlideover.classList.contains('hidden');
    if (isHidden) {
      await renderActivityHistory();
      elements.activitySlideover.classList.remove('hidden');
    } else {
      elements.activitySlideover.classList.add('hidden');
    }
  }

  async function renderActivityHistory() {
    try {
      const logs = await API.getActivityLogs();
      const list = elements.activityLogList;
      list.innerHTML = '';

      if (logs.length === 0) {
        list.innerHTML = '<div class="no-activity-text">No activity history recorded yet.</div>';
        return;
      }

      logs.forEach(log => {
        const item = document.createElement('div');
        let actionClass = '';
        if (log.action.toLowerCase().includes('create')) actionClass = 'created-task';
        if (log.action.toLowerCase().includes('complete')) actionClass = 'completed-task';
        if (log.action.toLowerCase().includes('delete')) actionClass = 'deleted-task';

        item.className = `activity-item ${actionClass}`;
        item.innerHTML = `
          <div>
            <strong>${escapeHTML(log.action)}</strong>: ${escapeHTML(log.task_title)}
            <div class="activity-meta">${formatDateTime(new Date(log.created_at))}</div>
          </div>
        `;
        list.appendChild(item);
      });
    } catch (err) {
      showToast('Failed to load activity logs.', 'danger');
    }
  }

  // ================= CSV / PDF EXPORTERS =================
  function exportTasksToCSV() {
    if (tasks.length === 0) {
      showToast('No tasks available to export.', 'warning');
      return;
    }

    // CSV Headers
    const headers = ['ID', 'Title', 'Description', 'Category', 'Priority', 'Status', 'Due Date', 'Created At'];
    
    // Map tasks to CSV rows
    const rows = tasks.map(t => [
      t.id,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${(t.category_name || 'No Category').replace(/"/g, '""')}"`,
      t.priority,
      t.status,
      t.due_date,
      t.created_at
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `smart_todo_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV export downloaded successfully.', 'success');
  }

  function exportTasksToPDF() {
    if (tasks.length === 0) {
      showToast('No tasks available to export.', 'warning');
      return;
    }

    // Generate print layout in the hidden print container
    const container = elements.printExportContainer;
    container.innerHTML = `
      <div class="print-header">
        <h1>Smart Todo - Task Manifest</h1>
        <p>Generated on: ${new Date().toLocaleString()} | User: ${escapeHTML(currentUser.username)}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Category</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Due Date</th>
          </tr>
        </thead>
        <tbody>
          ${tasks.map(t => `
            <tr>
              <td><strong>${escapeHTML(t.title)}</strong>${t.description ? `<br><small>${escapeHTML(t.description)}</small>` : ''}</td>
              <td>${escapeHTML(t.category_name || 'None')}</td>
              <td>${t.priority}</td>
              <td>${t.status}</td>
              <td>${formatDateTime(new Date(t.due_date))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // Trigger Print Dialog
    window.print();
    
    // Clear container
    setTimeout(() => {
      container.innerHTML = '';
    }, 1000);
  }

  // ================= TASK DUE DATE ALERTS & POLL SYSTEM =================
  function checkDeadlines() {
    if (!currentUser || tasks.length === 0) return;

    const now = new Date();
    const alertThresholdMinutes = 15;

    tasks.forEach(task => {
      // Alert rules: task must be pending, not yet alerted, and due within 15 minutes in the future
      if (task.status !== 'Pending') return;
      if (notifiedTaskIds.has(task.id)) return;

      const dueDate = new Date(task.due_date);
      const diffMs = dueDate - now;
      const diffMins = diffMs / 60000;

      if (diffMins > 0 && diffMins <= alertThresholdMinutes) {
        // Mark as alerted
        notifiedTaskIds.add(task.id);

        const alertMsg = `Task deadline approaching: "${task.title}" is due in ${Math.round(diffMins)} minutes!`;
        
        // 1. Show custom Toast alarm
        showToast(alertMsg, 'warning', 10000);

        // 2. Trigger Native browser notification (if permission granted)
        if (Notification.permission === 'granted') {
          try {
            new Notification('Smart Todo Reminder', {
              body: alertMsg,
              icon: '/favicon.ico' // Or default checkmark
            });
          } catch (e) {
            console.error('Notification creation failed:', e);
          }
        }
      }
    });
  }

  // ================= GENERAL SEARCH & FILTER BINDINGS =================
  elements.taskSearch.addEventListener('keyup', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      activeFilters.search = elements.taskSearch.value;
      loadTasks();
    }, 300); // 300ms debouncing
  });

  elements.categoryFilter.addEventListener('change', () => {
    activeFilters.category_id = elements.categoryFilter.value;
    loadTasks();
  });

  // Radio priority filters
  elements.priorityFilterRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        activeFilters.priority = e.target.value;
        loadTasks();
      }
    });
  });

  // Status Filter Chips
  const filterChips = document.querySelectorAll('.filter-chip');
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilters.status = chip.dataset.status;
      loadTasks();
    });
  });

  // Sorting columns
  elements.sortButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.sortButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilters.sortBy = btn.dataset.sort;
      loadTasks();
    });
  });

  elements.sortOrderToggle.addEventListener('click', () => {
    const icon = elements.sortOrderToggle.querySelector('i');
    if (activeFilters.order === 'ASC') {
      activeFilters.order = 'DESC';
      icon.className = 'fa-solid fa-arrow-down-short-wide';
      showToast('Sorted descending', 'info');
    } else {
      activeFilters.order = 'ASC';
      icon.className = 'fa-solid fa-arrow-up-wide-short';
      showToast('Sorted ascending', 'info');
    }
    loadTasks();
  });

  // ================= AUTH FORMS SUBMITS =================
  elements.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const data = await API.login(email, password);
      showToast('Logged in successfully.', 'success');
      currentUser = data.user;
      setupAppState();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  elements.registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    // Frontend validations (matching backend rules)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast('Invalid email address format.', 'warning');
      return;
    }

    if (password.length < 8) {
      showToast('Password must be at least 8 characters.', 'warning');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      showToast('Password must contain an uppercase letter.', 'warning');
      return;
    }
    if (!/[0-9]/.test(password)) {
      showToast('Password must contain a number.', 'warning');
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>_+\-\[\]\\\/]/.test(password)) {
      showToast('Password must contain a special character.', 'warning');
      return;
    }

    try {
      await API.register(username, email, password);
      showToast('Registration successful! You may log in now.', 'success');
      // Toggle back to login form
      elements.registerFormWrapper.classList.add('hidden');
      elements.loginFormWrapper.classList.remove('hidden');
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // ================= GENERAL GLOBAL CLICKS & MODALS =================
  elements.showLoginBtn.addEventListener('click', () => {
    elements.registerFormWrapper.classList.add('hidden');
    elements.loginFormWrapper.classList.remove('hidden');
    elements.authCard.scrollIntoView({ behavior: 'smooth' });
  });

  elements.showRegisterBtn.addEventListener('click', () => {
    elements.loginFormWrapper.classList.add('hidden');
    elements.registerFormWrapper.classList.remove('hidden');
    elements.authCard.scrollIntoView({ behavior: 'smooth' });
  });

  elements.toRegister.addEventListener('click', (e) => {
    e.preventDefault();
    elements.loginFormWrapper.classList.add('hidden');
    elements.registerFormWrapper.classList.remove('hidden');
  });

  elements.toLogin.addEventListener('click', (e) => {
    e.preventDefault();
    elements.registerFormWrapper.classList.add('hidden');
    elements.loginFormWrapper.classList.remove('hidden');
  });

  elements.heroGetStarted.addEventListener('click', () => {
    elements.loginFormWrapper.classList.add('hidden');
    elements.registerFormWrapper.classList.remove('hidden');
    elements.authCard.scrollIntoView({ behavior: 'smooth' });
  });

  // User dropdown menu toggle
  elements.profileDropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.profileDropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    elements.profileDropdown.classList.add('hidden');
  });

  elements.logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await API.logout();
      showToast('Logged out successfully.', 'success');
      setupLandingState();
    } catch (err) {
      showToast('Error logging out.', 'danger');
    }
  });

  // ================= NOTE SUBMIT FORM =================
  elements.noteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const noteId = elements.noteIdInput.value;
    const title = elements.noteTitleInput.value.trim();
    const content = elements.noteContentInput.value.trim();
    
    if (!title) {
      showToast('Note title is required.', 'warning');
      return;
    }

    const payload = {
      title,
      content,
      type: 'Note',
      color_theme: selectedNoteColor,
      pattern_theme: selectedNotePattern
    };

    try {
      if (noteId) {
        await API.updateNote(noteId, payload);
        showToast('Note updated.', 'success');
      } else {
        await API.createNote(payload);
        showToast('Note saved.', 'success');
      }
      closeModals();
      loadNotes();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // ================= CHECKLIST SUBMIT FORM =================
  elements.checklistForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const checklistId = elements.checklistIdInput.value;
    const title = elements.checklistTitleInput.value.trim();
    
    if (!title) {
      showToast('Checklist title is required.', 'warning');
      return;
    }

    const rows = elements.checklistItemsContainer.querySelectorAll('.checklist-builder-row');
    const items = Array.from(rows).map(row => {
      const text = row.querySelector('.checklist-item-text').value.trim();
      const checked = row.querySelector('input[type="checkbox"]').checked;
      return { text, checked };
    }).filter(item => item.text !== ''); // Exclude empty items

    const content = JSON.stringify(items);

    const payload = {
      title,
      content,
      type: 'List',
      color_theme: selectedChecklistColor,
      pattern_theme: selectedChecklistPattern
    };

    try {
      if (checklistId) {
        await API.updateNote(checklistId, payload);
        showToast('Checklist updated.', 'success');
      } else {
        await API.createNote(payload);
        showToast('Checklist saved.', 'success');
      }
      closeModals();
      loadNotes();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // Content template change handler
  elements.noteTemplateSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    let text = '';
    if (val === 'meeting') {
      text = `Date: ${new Date().toLocaleDateString()}\nAttendees: \n\nAgenda:\n- \n\nAction Items:\n- `;
    } else if (val === 'ideas') {
      text = `Core Concept: \n\nKey Pillars:\n1. \n2. \n3. \n\nNext Steps:\n- `;
    } else if (val === 'journal') {
      text = `Date: ${new Date().toLocaleDateString()}\n\nWhat went well today?\n- \n\nChallenges faced:\n- \n\nTomorrow's focus:\n- `;
    }
    
    if (text) {
      if (!elements.noteContentInput.value.trim() || confirm('Over-write existing note content with this template?')) {
        elements.noteContentInput.value = text;
      }
    }
  });

  // Note Modal Color Picker click bindings
  const noteColorOptions = elements.noteColorPicker.querySelectorAll('.color-picker-option');
  noteColorOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      selectedNoteColor = opt.dataset.color;
      updateColorPickerActive(elements.noteColorPicker, selectedNoteColor);
    });
  });

  // Note Modal Pattern Picker click bindings
  const notePatternOptions = elements.notePatternPicker.querySelectorAll('.pattern-picker-option');
  notePatternOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      selectedNotePattern = opt.dataset.pattern;
      updatePatternPickerActive(elements.notePatternPicker, selectedNotePattern);
    });
  });

  // Checklist Modal Color Picker click bindings
  const checklistColorOptions = elements.checklistColorPicker.querySelectorAll('.color-picker-option');
  checklistColorOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      selectedChecklistColor = opt.dataset.color;
      updateColorPickerActive(elements.checklistColorPicker, selectedChecklistColor);
    });
  });

  // Checklist Modal Pattern Picker click bindings
  const checklistPatternOptions = elements.checklistPatternPicker.querySelectorAll('.pattern-picker-option');
  checklistPatternOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      selectedChecklistPattern = opt.dataset.pattern;
      updatePatternPickerActive(elements.checklistPatternPicker, selectedChecklistPattern);
    });
  });

  // Checklist modal add item button
  elements.checklistAddItemBtn.addEventListener('click', () => {
    addChecklistItemRow(elements.checklistItemsContainer);
  });

  // Notes creators opening actions
  elements.addNoteBtn.addEventListener('click', () => openNoteModal(null));
  elements.addListBtn.addEventListener('click', () => openChecklistModal(null));

  // Close note modal click background / close buttons
  elements.noteModal.querySelector('.modal-backdrop').addEventListener('click', closeModals);
  elements.noteModal.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeModals);
  });

  // Close checklist modal click background / close buttons
  elements.checklistModal.querySelector('.modal-backdrop').addEventListener('click', closeModals);
  elements.checklistModal.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeModals);
  });

  // Workspace Nav Switcher click bindings
  elements.wsTasksBtn.addEventListener('click', () => {
    setWorkspaceActive('tasks');
  });

  elements.wsNotesBtn.addEventListener('click', () => {
    setWorkspaceActive('notes');
  });

  if (elements.wsListsBtn) {
    elements.wsListsBtn.addEventListener('click', () => {
      setWorkspaceActive('checklists');
    });
  }

  function setWorkspaceActive(workspace) {
    // 1. Remove active class from all tabs
    elements.wsTasksBtn.classList.remove('active');
    elements.wsNotesBtn.classList.remove('active');
    if (elements.wsListsBtn) elements.wsListsBtn.classList.remove('active');

    // 2. Hide all workspaces
    elements.tasksWorkspace.classList.add('hidden');
    elements.notesWorkspace.classList.add('hidden');
    if (elements.checklistsWorkspace) elements.checklistsWorkspace.classList.add('hidden');

    // 3. Activate selected workspace
    if (workspace === 'tasks') {
      elements.wsTasksBtn.classList.add('active');
      elements.tasksWorkspace.classList.remove('hidden');
      loadTasks();
    } else if (workspace === 'notes') {
      elements.wsNotesBtn.classList.add('active');
      elements.notesWorkspace.classList.remove('hidden');
      loadNotes();
    } else if (workspace === 'checklists') {
      if (elements.wsListsBtn) elements.wsListsBtn.classList.add('active');
      if (elements.checklistsWorkspace) elements.checklistsWorkspace.classList.remove('hidden');
      loadNotes();
    }
  }

  // Close modals clicking outside or close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeModals);
  });
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', closeModals);
  });

  // Trigger modals open
  elements.addTaskBtn.addEventListener('click', () => openTaskModal(null));
  elements.manageCategoriesBtn.addEventListener('click', openCategoryModal);
  elements.openProfileBtn.addEventListener('click', openProfileModal);
  elements.themeToggle.addEventListener('click', toggleTheme);
  elements.activityLogToggle.addEventListener('click', toggleActivitySlideover);
  elements.activitySlideoverClose.addEventListener('click', () => elements.activitySlideover.classList.add('hidden'));

  // Close modals clicking outside or close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeModals);
  });
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', closeModals);
  });

  elements.exportCsvBtn.addEventListener('click', (e) => {
    e.preventDefault();
    exportTasksToCSV();
  });
  
  elements.exportPdfBtn.addEventListener('click', (e) => {
    e.preventDefault();
    exportTasksToPDF();
  });

  elements.themeLightBtn.addEventListener('click', () => {
    document.documentElement.className = 'light-theme';
    localStorage.setItem('theme', 'light-theme');
    updateThemeIcon('light-theme');
    showToast('Theme updated to Light Mode', 'info');
  });

  elements.themeDarkBtn.addEventListener('click', () => {
    document.documentElement.className = 'dark-theme';
    localStorage.setItem('theme', 'dark-theme');
    updateThemeIcon('dark-theme');
    showToast('Theme updated to Dark Mode', 'info');
  });

  elements.changePassToggle.addEventListener('click', () => {
    showToast('Credentials manager options are active.', 'info');
  });

  // ================= START SYSTEM =================
  initTheme();
  checkSession();
});
