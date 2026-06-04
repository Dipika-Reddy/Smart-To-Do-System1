const validateRegister = (req, res, next) => {
  const { username, email, password } = req.body;

  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Username is required.' });
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

  next();
};

const validateTask = (req, res, next) => {
  const { title, due_date } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Task title cannot be empty.' });
  }

  if (!due_date) {
    return res.status(400).json({ error: 'Due date is required.' });
  }

  const parsedDueDate = new Date(due_date);
  if (isNaN(parsedDueDate.getTime())) {
    return res.status(400).json({ error: 'Invalid due date format.' });
  }

  // Compare due date against current time
  const now = new Date();
  // We can strip seconds to avoid tiny discrepancies if submitted exactly now,
  // but a simple comparison checks if it is before the current millisecond.
  if (parsedDueDate.getTime() < now.getTime()) {
    return res.status(400).json({ error: 'Due date cannot be in the past.' });
  }

  next();
};

module.exports = {
  validateRegister,
  validateTask
};
