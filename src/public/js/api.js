/**
 * Smart Todo - Frontend API Client (api.js)
 * Wraps backend REST API endpoints using standard Fetch API
 */

const API = {
  // Helper for requests
  async request(url, options = {}) {
    // Inject headers
    options.headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    // Allow credentials (for cookie sessions)
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
  async register(username, email, password) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password })
    });
  },

  async login(email, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
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
