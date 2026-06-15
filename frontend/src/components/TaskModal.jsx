import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import API from '../services/api';
import { X, Send, User, MessageSquare } from 'lucide-react';

const TaskModal = ({ isOpen, task, onClose }) => {
  const { categories, loadTasks, showToast, users, loadUsers, currentUser, syncAllData } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('Pending');
  const [assignedTo, setAssignedTo] = useState('');
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [completionNotes, setCompletionNotes] = useState('');
  const [newComment, setNewComment] = useState('');
  const [commentTimeline, setCommentTimeline] = useState([]);

  const isEdit = !!task;
  const isAdmin = currentUser?.role === 'Admin';
  const isCompleted = task && task.status === 'Completed';
  // Check if this task is created by Admin and assigned to current user who is not Admin, or if it is completed
  const isLockedForUser = (!isAdmin && task && task.user_id !== currentUser?.id) || isCompleted;

  // Load comments/timeline for the task
  const loadComments = async () => {
    if (task && task.id) {
      try {
        const data = await API.getTaskUpdates(task.id);
        setCommentTimeline(data);
      } catch (err) {
        console.error('Failed to load task updates:', err.message);
      }
    }
  };

  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };

  // Initialize form fields on open/edit
  useEffect(() => {
    if (isOpen) {
      loadUsers();
      if (isEdit) {
        setTitle(task.title || '');
        setDescription(task.description || '');
        setCategoryId(task.category_id || '');
        setPriority(task.priority || 'Medium');
        setStatus(task.status || 'Pending');
        setAssignedTo(task.assigned_to || '');
        setCompletionPercentage(task.completion_percentage || 0);
        setCompletionNotes(task.completion_notes || '');
        setDueDate(formatDateForInput(task.due_date));
        loadComments();
      } else {
        // Reset fields for Add mode
        setTitle('');
        setDescription('');
        setCategoryId('');
        setPriority('Medium');
        setStatus('Pending');
        setAssignedTo('');
        setCompletionPercentage(0);
        setCompletionNotes('');
        setDueDate('');
        setCommentTimeline([]);
      }
      setNewComment('');
    }
  }, [isOpen, task, isEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast('Task title cannot be empty.', 'warning');
      return;
    }

    const now = new Date();
    const selectedDate = new Date(dueDate);
    if (!isEdit && !isLockedForUser && selectedDate < now) {
      showToast('Due date cannot be set in the past.', 'warning');
      return;
    }

    const taskData = {
      title: title.trim(),
      description: description.trim(),
      category_id: categoryId ? Number(categoryId) : null,
      priority,
      due_date: dueDate,
      assigned_to: assignedTo ? Number(assignedTo) : null,
      completion_percentage: Number(completionPercentage),
      completion_notes: completionNotes.trim()
    };

    try {
      if (isEdit) {
        if (!isAdmin && status === 'Completed') {
          showToast('Only administrators can mark tasks as completed.', 'warning');
          return;
        }
        taskData.status = status;
        await API.updateTask(task.id, taskData);
        showToast('Task updated successfully.', 'success');
      } else {
        await API.createTask(taskData);
        showToast('Task created successfully.', 'success');
      }
      onClose();
      await syncAllData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete task "${task.title}"?\n\nThis action cannot be undone.`)) {
      try {
        await API.deleteTask(task.id);
        showToast('Task deleted successfully.', 'success');
        onClose();
        await syncAllData();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    }
  };

  // Add a new comment
  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await API.createTaskUpdate(task.id, {
        comment: newComment.trim(),
        progress_percentage: completionPercentage,
        status: status
      });
      setNewComment('');
      loadComments();
      await syncAllData();
      showToast('Comment added.', 'success');
    } catch (err) {
      showToast('Failed to add comment.', 'danger');
    }
  };

  return (
    <div className="modal" id="task-modal">
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-content" style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h3 id="task-modal-title">
            {isEdit 
              ? (isLockedForUser ? 'Update Progress on Assigned Task' : 'Edit Task Parameters') 
              : 'Add New Task'}
          </h3>
          <button onClick={onClose} className="modal-close btn-icon-small">
            <X size={16} />
          </button>
        </div>

        <form id="task-form" onSubmit={handleSubmit}>
          {/* Form Fields: Lock details if assigned by Admin to standard user */}
          <div className="form-group">
            <label htmlFor="task-title">Task Title *</label>
            <input 
              type="text" 
              id="task-title" 
              required 
              disabled={isLockedForUser}
              placeholder="e.g. Finalize quarterly presentation"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="task-desc">Description</label>
            <textarea 
              id="task-desc" 
              rows="2" 
              disabled={isLockedForUser}
              placeholder="Describe the task parameters..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="form-group col" style={{ flex: 1, minWidth: '150px' }}>
              <label htmlFor="task-category">Category</label>
              <select 
                id="task-category" 
                className="form-control"
                disabled={isLockedForUser}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">No Category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                ))}
              </select>
            </div>

            <div className="form-group col" style={{ flex: 1, minWidth: '150px' }}>
              <label htmlFor="task-priority">Priority</label>
              <select 
                id="task-priority" 
                className="form-control"
                disabled={isLockedForUser}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>

            {isAdmin && (
              <div className="form-group col" style={{ flex: 1, minWidth: '150px' }}>
                <label htmlFor="task-assignee">Assignee</label>
                <select 
                  id="task-assignee" 
                  className="form-control"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                >
                  <option value="">Self (Unassigned)</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name || u.username} ({u.role})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="form-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="form-group col" style={{ flex: 1, minWidth: '200px' }}>
              <label htmlFor="task-due-date">Due Date & Time *</label>
              <input 
                type="datetime-local" 
                id="task-due-date" 
                required
                disabled={isLockedForUser}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {isEdit && (
              <div className="form-group col" style={{ flex: 1, minWidth: '150px' }}>
                <label htmlFor="task-status">Status</label>
                <select 
                  id="task-status" 
                  className="form-control"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Review">Review (Submit to Admin)</option>
                  {(isAdmin || status === 'Completed') && <option value="Completed">Completed</option>}
                </select>
              </div>
            )}
          </div>

          {/* Progress & Notes controls - visible during edits */}
          {isEdit && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
              <div className="form-group">
                <label htmlFor="task-progress" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Completion Progress</span>
                  <strong>{completionPercentage}%</strong>
                </label>
                <input 
                  type="range" 
                  id="task-progress" 
                  min="0" 
                  max="100" 
                  step="5"
                  value={completionPercentage}
                  onChange={(e) => setCompletionPercentage(e.target.value)}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="task-completion-notes">Progress Updates / Completion Notes</label>
                <textarea 
                  id="task-completion-notes" 
                  rows="2" 
                  placeholder="Describe your progress or submit review notes for this assignment..."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="modal-actions">
            {isEdit && isAdmin && !isCompleted && (
              <button 
                type="button" 
                className="btn btn-danger" 
                onClick={handleDelete}
                style={{ marginRight: 'auto' }}
              >
                Delete Task
              </button>
            )}
            <button type="button" className="btn btn-ghost modal-close" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" id="task-form-submit" disabled={isCompleted}>
              {isEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>

        {/* Task Comments Timeline Section (Only visible during task edits) */}
        {isEdit && (
          <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '1.5rem', paddingTop: '1rem' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              <MessageSquare size={16} /> Progress Timeline & Comments
            </h4>

            {/* Comment Composer */}
            <form onSubmit={handlePostComment} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input 
                type="text" 
                placeholder="Leave progress notes or comments here..." 
                required
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Send size={12} /> Send
              </button>
            </form>

            {/* Timeline comments list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
              {commentTimeline.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>
                  No progress updates or comments yet.
                </div>
              ) : (
                commentTimeline.map(update => (
                  <div key={update.id} style={{ display: 'flex', flexDirection: 'column', padding: '0.5rem', borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                        <User size={10} /> <strong>{update.name || update.username}</strong>
                      </span>
                      <span>{new Date(update.created_at).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{update.comment}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      <span>Status: <strong style={{ color: 'var(--primary-color)' }}>{update.status}</strong></span>
                      <span>Progress: <strong>{update.progress_percentage}%</strong></span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskModal;
