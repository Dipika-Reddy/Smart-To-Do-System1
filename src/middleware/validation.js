const rateLimitWindowMs = 15 * 60 * 1000; // 15 minutes
const maxRequestsPerWindow = 100; // max 100 requests per IP per window
const ipRequests = new Map();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of ipRequests.entries()) {
    if (now - data.resetTime > rateLimitWindowMs) {
      ipRequests.delete(ip);
    }
  }
}, rateLimitWindowMs);

const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  
  if (!ipRequests.has(ip)) {
    ipRequests.set(ip, {
      count: 1,
      resetTime: now + rateLimitWindowMs
    });
    return next();
  }
  
  const data = ipRequests.get(ip);
  if (now > data.resetTime) {
    data.count = 1;
    data.resetTime = now + rateLimitWindowMs;
    return next();
  }
  
  data.count++;
  if (data.count > maxRequestsPerWindow) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  
  next();
};

const sanitizeHtml = (str) => {
  if (typeof str !== 'string') return str;
  // Strip standard HTML tags to prevent script injection/XSS
  return str.replace(/<[^>]*>/g, '');
};

const validateRegister = (req, res, next) => {
  const { employee_id, username, email, password, role } = req.body;
  const targetEmpId = employee_id || username;

  if (!targetEmpId || !targetEmpId.trim()) {
    return res.status(400).json({ error: 'Employee ID is required.' });
  }

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  // Simple email structure validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  // Password rules:
  // - 8 characters minimum
  // - 1 uppercase letter
  // - 1 number
  // - 1 special character
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  const hasUppercase = /[A-Z]/.test(password);
  if (!hasUppercase) {
    return res.status(400).json({ error: 'Password must contain at least one uppercase letter.' });
  }

  const hasNumber = /[0-9]/.test(password);
  if (!hasNumber) {
    return res.status(400).json({ error: 'Password must contain at least one number.' });
  }

  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_+\-\[\]\\\/]/.test(password);
  if (!hasSpecial) {
    return res.status(400).json({ error: 'Password must contain at least one special character (e.g., !@#$%^&*).' });
  }

  if (role && !['Admin', 'User'].includes(role)) {
    return res.status(400).json({ error: 'Role must be Admin or User.' });
  }

  // Sanitize name/username if present
  if (req.body.name) req.body.name = sanitizeHtml(req.body.name);
  if (req.body.username) req.body.username = sanitizeHtml(req.body.username);

  next();
};

const validateTask = (req, res, next) => {
  const { title, due_date, priority, status, category_id, assigned_to, completion_percentage, description, completion_notes } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Task title cannot be empty.' });
  }

  // Sanitize fields
  req.body.title = sanitizeHtml(title);
  if (description) req.body.description = sanitizeHtml(description);
  if (completion_notes) req.body.completion_notes = sanitizeHtml(completion_notes);

  if (!due_date) {
    return res.status(400).json({ error: 'Due date is required.' });
  }

  const parsedDueDate = new Date(due_date);
  if (isNaN(parsedDueDate.getTime())) {
    return res.status(400).json({ error: 'Invalid due date format.' });
  }

  // Compare due date against current time, allowing a 24-hour buffer for timezone differences.
  // The client side performs the exact local validation.
  const now = new Date();
  const timezoneBufferMs = 24 * 60 * 60 * 1000;
  if (req.method === 'POST' && parsedDueDate.getTime() < (now.getTime() - timezoneBufferMs)) {
    return res.status(400).json({ error: 'Due date cannot be in the past.' });
  }

  // Extended security validations
  if (priority && !['High', 'Medium', 'Low'].includes(priority)) {
    return res.status(400).json({ error: 'Invalid task priority.' });
  }

  if (status && !['Pending', 'In Progress', 'Review', 'Completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid task status.' });
  }

  if (category_id !== undefined && category_id !== null && isNaN(Number(category_id))) {
    return res.status(400).json({ error: 'Category ID must be a valid number.' });
  }

  if (assigned_to !== undefined && assigned_to !== null && isNaN(Number(assigned_to))) {
    return res.status(400).json({ error: 'Assignee ID must be a valid number.' });
  }

  if (completion_percentage !== undefined && completion_percentage !== null) {
    const pct = Number(completion_percentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ error: 'Completion percentage must be a number between 0 and 100.' });
    }
  }

  next();
};

module.exports = {
  validateRegister,
  validateTask,
  rateLimiter,
  sanitizeHtml
};

