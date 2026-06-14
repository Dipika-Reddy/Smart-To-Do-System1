/**
 * Smart Todo - React API Client (api.js)
 * Wraps backend REST API endpoints using standard Fetch API
 */

const API = {
  // Helper for requests
  async request(url, options = {}) {
    options.headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    // Allow credentials (for cookie session)
    options.credentials = 'include';

    try {
      const response = await fetch(url, options);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong.');
      }
      
      return data;
    } catch (error) {
      console.error(`API Error on ${url}:`, error.message);
      throw error;
    }
  },

  // ================= AUTHENTICATION =================
  async register(username, email, password, name = '', role = 'User', employee_id = null) {
    const dbEmployeeId = role === 'Admin' ? null : (employee_id || username);
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ employee_id: dbEmployeeId, username, email, password, name, role })
    });
  },

  async login(username, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  async logout() {
    return this.request('/api/auth/logout', {
      method: 'POST'
    });
  },

  async getMe() {
    return this.request('/api/auth/me');
  },

  async changePassword(currentPassword, newPassword) {
    return this.request('/api/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  },

  async resetPassword(username, newPassword) {
    return this.request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ username, newPassword })
    });
  },

  // ================= USERS =================
  async getUsers() {
    return this.request('/api/users');
  },

  async deleteUser(id) {
    return this.request(`/api/users/${id}`, {
      method: 'DELETE'
    });
  },

  // ================= TASKS =================
  async getTasks(filters = {}) {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        params.append(key, filters[key]);
      }
    });

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/tasks${queryString}`);
  },

  async getTask(id) {
    return this.request(`/api/tasks/${id}`);
  },

  async createTask(taskData) {
    return this.request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
  },

  async updateTask(id, taskData) {
    return this.request(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(taskData)
    });
  },

  async deleteTask(id) {
    return this.request(`/api/tasks/${id}`, {
      method: 'DELETE'
    });
  },

  async reorderTasks(orders) {
    return this.request('/api/tasks/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orders })
    });
  },

  async reviewTask(id, action, comments) {
    return this.request(`/api/tasks/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({ action, comments })
    });
  },

  async getTaskUpdates(id) {
    return this.request(`/api/tasks/${id}/updates`);
  },

  async createTaskUpdate(id, updateData) {
    return this.request(`/api/tasks/${id}/updates`, {
      method: 'POST',
      body: JSON.stringify(updateData)
    });
  },

  async getActivityLogs() {
    return this.request('/api/tasks/activities');
  },

  // ================= CATEGORIES =================
  async getCategories() {
    return this.request('/api/categories');
  },

  async createCategory(category_name) {
    return this.request('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ category_name })
    });
  },

  async updateCategory(id, category_name) {
    return this.request(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ category_name })
    });
  },

  async deleteCategory(id) {
    return this.request(`/api/categories/${id}`, {
      method: 'DELETE'
    });
  },

  // ================= CHECKLISTS =================
  async getChecklistItems(taskId) {
    return this.request(`/api/checklists/tasks/${taskId}`);
  },

  async createChecklistItem(taskId, title) {
    return this.request(`/api/checklists/tasks/${taskId}`, {
      method: 'POST',
      body: JSON.stringify({ title })
    });
  },

  async updateChecklistItem(itemId, data) {
    return this.request(`/api/checklists/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteChecklistItem(itemId) {
    return this.request(`/api/checklists/${itemId}`, {
      method: 'DELETE'
    });
  },

  // ================= NOTIFICATIONS =================
  async getNotifications() {
    return this.request('/api/notifications');
  },

  async markNotificationRead(id) {
    return this.request(`/api/notifications/${id}/read`, {
      method: 'PUT'
    });
  },

  async markAllNotificationsRead() {
    return this.request('/api/notifications/read-all', {
      method: 'POST'
    });
  },

  // ================= ANALYTICS =================
  async getDashboardAnalytics(scope) {
    const url = scope ? `/api/analytics/dashboard?scope=${scope}` : '/api/analytics/dashboard';
    return this.request(url);
  },

  async getUserPerformanceMetrics() {
    return this.request('/api/analytics/performance');
  },

  async getDistributionAnalytics(scope) {
    const url = scope ? `/api/analytics/distributions?scope=${scope}` : '/api/analytics/distributions';
    return this.request(url);
  },

  // ================= NOTES =================
  async getNotes() {
    return this.request('/api/notes');
  },

  async createNote(noteData) {
    return this.request('/api/notes', {
      method: 'POST',
      body: JSON.stringify(noteData)
    });
  },

  async updateNote(id, noteData) {
    return this.request(`/api/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(noteData)
    });
  },

  async deleteNote(id) {
    return this.request(`/api/notes/${id}`, {
      method: 'DELETE'
    });
  }
};

export default API;
