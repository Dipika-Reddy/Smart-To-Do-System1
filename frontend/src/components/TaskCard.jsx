import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import API from '../services/api';
import { 
  GripVertical, Check, Tag, Calendar, Clock, Edit2, Trash2, 
  ChevronUp, ChevronsUp, ChevronDown, CheckCircle2, AlertTriangle,
  Plus, Trash, User, MessageSquare, CheckSquare, MoreVertical, 
  Eye, Copy, Archive, PlusCircle, AlignLeft
} from 'lucide-react';

const TaskCard = ({ task, onEdit, dragHandlers, isDraggable }) => {
  const { loadTasks, syncAllData, showToast, currentUser, loadNotes } = useApp();
  const [checklist, setChecklist] = useState([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [showAddChecklist, setShowAddChecklist] = useState(false);
  
  // Collapse state for card details
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Dropdown menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);
  const menuRef = useRef(null);

  const isCompleted = task.status === 'Completed';
  const now = new Date();
  const dueDate = new Date(task.due_date);
  const isOverdue = !isCompleted && dueDate < now;
  const isAdmin = currentUser?.role === 'Admin';
  const isPersonalTask = task.user_id === currentUser?.id && task.assigned_to === currentUser?.id;

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

  // Permissions gate
  const canModifyMetadata = isAdmin;
  const canDeleteTask = isAdmin;

  // Load checklists on task.id change
  const loadChecklist = async () => {
    try {
      const data = await API.getChecklistItems(task.id);
      setChecklist(data);
    } catch (err) {
      console.error('Error loading card checklist:', err.message);
    }
  };

  useEffect(() => {
    loadChecklist();
  }, [task.id]);

  // Click-Outside menu closer
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
        setShowMoveSubmenu(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [menuOpen]);

  // Status toggle checkmark click
  const handleToggleCheck = async (e) => {
    e.stopPropagation();
    let nextStatus = isCompleted ? 'Pending' : 'Completed';
    if (!isAdmin && nextStatus === 'Completed') {
      nextStatus = 'Review';
    }

    try {
      await API.updateTask(task.id, {
        title: task.title,
        description: task.description,
        category_id: task.category_id,
        priority: task.priority,
        status: nextStatus,
        due_date: task.due_date,
        completion_percentage: getAutoProgress(nextStatus)
      });
      showToast(`Task moved to ${nextStatus}`, 'success');
      await syncAllData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // Actions menu handlers
  const handleEditTask = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    onEdit(task); // open task details modal
  };

  const handleDuplicate = async (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    try {
      const duplicateData = {
        title: `${task.title} (Copy)`,
        description: task.description,
        category_id: task.category_id,
        priority: task.priority,
        due_date: task.due_date,
        assigned_to: task.assigned_to
      };
      await API.createTask(duplicateData);
      showToast('Task duplicated successfully.', 'success');
      await syncAllData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleAddNote = async (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    
    const noteTitle = window.prompt("Enter note title:");
    if (noteTitle === null) return;
    if (!noteTitle.trim()) {
      showToast('Note title is required.', 'warning');
      return;
    }

    const noteContent = window.prompt(`Enter note content for "${task.title}":`, `Notes for: ${task.title}`);
    if (noteContent === null) return;

    try {
      await API.createNote({
        title: noteTitle.trim(),
        content: noteContent.trim(),
        type: 'Note',
        color_theme: 'default',
        pattern_theme: 'blank'
      });
      showToast('Note added successfully.', 'success');
      if (loadNotes) {
        await loadNotes();
      }
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleMoveTask = async (e, nextStatus) => {
    e.stopPropagation();
    setMenuOpen(false);
    setShowMoveSubmenu(false);

    if (!isAdmin && task.status === 'Review' && nextStatus === 'Completed') {
      showToast('Only administrators can approve reviewed tasks.', 'warning');
      return;
    }

    try {
      await API.updateTask(task.id, {
        title: task.title,
        description: task.description,
        category_id: task.category_id,
        priority: task.priority,
        status: nextStatus,
        due_date: task.due_date,
        completion_percentage: getAutoProgress(nextStatus)
      });
      showToast(`Task moved to ${nextStatus}`, 'success');
      await syncAllData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleMarkComplete = async (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (!isAdmin && task.status === 'Review') {
      showToast('Only administrators can approve reviewed tasks.', 'warning');
      return;
    }
    try {
      await API.updateTask(task.id, {
        title: task.title,
        description: task.description,
        category_id: task.category_id,
        priority: task.priority,
        status: 'Completed',
        due_date: task.due_date,
        completion_percentage: 100
      });
      showToast('Task marked as Completed.', 'success');
      await syncAllData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };



  const handleDelete = async (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    
    // Explicit confirmation dialog format
    const confirmed = window.confirm(
      "Are you sure you want to delete this task?\n\nThis action cannot be undone."
    );

    if (confirmed) {
      try {
        await API.deleteTask(task.id);
        showToast('Task deleted successfully.', 'success');
        await syncAllData();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    }
  };

  // Checklist Handlers
  const handleToggleChecklistItem = async (e, item) => {
    e.stopPropagation();
    try {
      const nextCompleted = item.is_completed ? 0 : 1;
      const res = await API.updateChecklistItem(item.id, {
        is_completed: nextCompleted
      });
      task.completion_percentage = res.completion_percentage;
      await loadChecklist();
      await syncAllData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleAddChecklistItem = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newChecklistText.trim()) return;

    try {
      await API.createChecklistItem(task.id, newChecklistText.trim());
      setNewChecklistText('');
      setShowAddChecklist(false);
      await loadChecklist();
      await syncAllData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleDeleteChecklistItem = async (e, itemId) => {
    e.stopPropagation();
    try {
      await API.deleteChecklistItem(itemId);
      await loadChecklist();
      await syncAllData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // Sorting checklist: incomplete on top, completed on bottom sorted by completed_at
  const sortedChecklist = [
    ...checklist.filter(item => !item.is_completed),
    ...checklist.filter(item => item.is_completed).sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at))
  ];

  const getRemainingTimeBadge = () => {
    if (isCompleted) {
      return (
        <span className="badge-success-text">
          <CheckCircle2 size={12} style={{ marginRight: '2px', verticalAlign: 'middle' }} /> Done
        </span>
      );
    }
    if (task.status === 'Review') {
      return (
        <span className="badge-priority-medium" style={{ fontSize: '0.75rem', padding: '2px 6px', color: '#fff', borderRadius: '4px' }}>
          In Review
        </span>
      );
    }

    const diffMs = dueDate - now;
    if (diffMs < 0) {
      return (
        <span className="badge-danger-text">
          <AlertTriangle size={12} style={{ marginRight: '2px', verticalAlign: 'middle' }} /> Overdue
        </span>
      );
    }

    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return (
        <span>
          <Clock size={12} /> {diffDays}d remaining
        </span>
      );
    }
    return (
      <span className="warning-text">
        <Clock size={12} /> {diffMin} mins left!
      </span>
    );
  };

  const getPriorityBadge = () => {
    const priority = task.priority;
    const priorityClass = `badge-priority-${priority.toLowerCase()}`;
    let icon = <ChevronDown size={10} />;
    if (priority === 'High') icon = <ChevronsUp size={10} />;
    if (priority === 'Medium') icon = <ChevronUp size={10} />;

    return (
      <span className={`badge ${priorityClass}`} style={{ fontSize: '0.7rem' }}>
        {icon} {priority}
      </span>
    );
  };

  const formatDateTime = (date) => {
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  };

  return (
    <div 
      className={`task-card ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue-task' : ''}`}
      style={{ 
        borderLeft: `4px solid ${
          task.status === 'Pending' ? '#6b7280' : 
          task.status === 'In Progress' ? '#8b5cf6' : 
          task.status === 'Review' ? '#f59e0b' : 
          task.status === 'Completed' ? '#10b981' : 'transparent'
        }`,
        padding: '0.85rem',
        borderRadius: '10px',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        cursor: 'pointer'
      }}
      data-id={task.id}
      draggable={isDraggable}
      {...(isDraggable ? dragHandlers : {})}
      onClick={() => setIsExpanded(!isExpanded)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', width: '100%' }}>
        {isDraggable && (
          <div className="task-card-drag-handle" title="Drag to reorder" onClick={e => e.stopPropagation()}>
            <GripVertical size={14} />
          </div>
        )}

        <div 
          className="task-card-checkbox" 
          onClick={handleToggleCheck}
          title={isCompleted ? 'Mark Pending' : (task.status === 'Review' ? 'In Review' : 'Submit for Review')}
          style={{
            flexShrink: 0
          }}
        >
          <Check />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Card Header row with Title and 3-Dot Menu */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
            <span className="task-card-title" title={task.title} style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {task.title}
            </span>

            {/* 3-Dot Dropdown actions Menu */}
            <div className="task-card-menu-wrapper" ref={menuRef} onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
              <button 
                className="btn-icon-small" 
                onClick={(e) => { 
                  e.preventDefault(); 
                  if (menuOpen) {
                    setMenuOpen(false);
                    setShowMoveSubmenu(false);
                  } else {
                    setMenuOpen(true);
                  }
                }}
                aria-label="Task Actions"
                aria-haspopup="true"
                aria-expanded={menuOpen}
                style={{ padding: '2px', border: 'none', background: 'transparent' }}
              >
                <MoreVertical size={16} />
              </button>

              {menuOpen && (
                <div 
                  className="dropdown-menu" 
                  style={{ 
                    position: 'absolute', 
                    right: 0, 
                    top: '24px', 
                    zIndex: 200, 
                    minWidth: '175px', 
                    padding: '0.35rem 0',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-lg)',
                    animation: 'fadeIn 0.15s ease'
                  }}
                >
                  {!showMoveSubmenu ? (
                    <>
                      {canModifyMetadata && (
                        <button onClick={handleEditTask} style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0.45rem 0.75rem', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                          <Edit2 size={14} style={{ marginRight: '6px' }} /> Edit Task
                        </button>
                      )}
                      <button onClick={handleDuplicate} style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0.45rem 0.75rem', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                        <Copy size={14} style={{ marginRight: '6px' }} /> Duplicate Task
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setShowMoveSubmenu(true); }} style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0.45rem 0.75rem', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                        <GripVertical size={14} style={{ marginRight: '6px' }} /> Move Task
                      </button>
                      <button onClick={handleAddNote} style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0.45rem 0.75rem', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                        <AlignLeft size={14} style={{ marginRight: '6px' }} /> Add Note
                      </button>
                      {!isCompleted && isAdmin && (
                        <button onClick={handleMarkComplete} style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0.45rem 0.75rem', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                          <CheckCircle2 size={14} style={{ marginRight: '6px' }} /> Mark Complete
                        </button>
                      )}
                      <button onClick={() => { setMenuOpen(false); setShowAddChecklist(true); setIsExpanded(true); }} style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0.45rem 0.75rem', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                        <PlusCircle size={14} style={{ marginRight: '6px' }} /> Add Checklist Item
                      </button>
                      {canDeleteTask && (
                        <>
                          <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />
                          <button className="logout-link" onClick={handleDelete} style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0.45rem 0.75rem', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--danger-color)' }}>
                            <Trash2 size={14} style={{ marginRight: '6px' }} /> Delete Task
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ padding: '0.25rem 0.75rem', fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                        Move Task to:
                      </div>
                      {['Pending', 'In Progress', 'Review', 'Completed'].map((status) => {
                        const isCompletedOptionDisabled = !isAdmin && status === 'Completed';
                        if (isCompletedOptionDisabled) return null;
                        return (
                          <button 
                            key={status}
                            disabled={task.status === status}
                            onClick={(e) => handleMoveTask(e, status)} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              width: '100%', 
                              padding: '0.45rem 0.75rem', 
                              background: 'none', 
                              border: 'none', 
                              textAlign: 'left', 
                              cursor: task.status === status ? 'not-allowed' : 'pointer', 
                              fontSize: '0.8rem', 
                              color: task.status === status ? 'var(--text-muted)' : 'var(--text-primary)',
                              opacity: task.status === status ? 0.5 : 1
                            }}
                          >
                            {status}
                          </button>
                        );
                      })}
                      <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />
                      <button onClick={(e) => { e.stopPropagation(); setShowMoveSubmenu(false); }} style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0.45rem 0.75rem', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                        &larr; Back to Actions
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Badges / Primary Metadata row */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', margin: '0.35rem 0', alignItems: 'center' }}>
            {getPriorityBadge()}
            {task.category_name && (
              <span className="badge badge-category" style={{ fontSize: '0.7rem' }}>
                <Tag size={8} /> {task.category_name}
              </span>
            )}
            {task.assignee_name && (
              <span className="badge" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '2px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                <User size={8} /> {task.assignee_name}
              </span>
            )}
          </div>

          {/* Progress bar info */}
          <div style={{ margin: '0.4rem 0 0 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.1rem' }}>
              <span>Progress</span>
              <span>{task.completion_percentage}%</span>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${task.completion_percentage}%`, height: '100%', background: 'var(--primary-color)', transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* Secondary Details (Collapsible Area) */}
          {isExpanded && (
            <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.50rem', animation: 'fadeIn 0.2s ease' }} onClick={e => e.stopPropagation()}>
              {task.description && (
                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <AlignLeft size={12} style={{ color: 'var(--text-muted)', marginTop: '2px', flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: '0.785rem', color: 'var(--text-secondary)', lineHeight: '1.25' }}>{task.description}</p>
                </div>
              )}

              {/* Checklist details block */}
              <div className="note-card-checklist" style={{ padding: '0.35rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px', margin: '0.25rem 0 0 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Checklist ({checklist.filter(i => i.is_completed).length}/{checklist.length})
                  </span>
                  <button 
                    className="btn-icon-small btn-inline-actions"
                    onClick={() => setShowAddChecklist(!showAddChecklist)}
                    title="Add Checklist Item"
                    style={{ padding: '2px' }}
                  >
                    <Plus size={8} />
                  </button>
                </div>

                {showAddChecklist && (
                  <form onSubmit={handleAddChecklistItem} style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.35rem' }}>
                    <input 
                      type="text" 
                      placeholder="New item..."
                      required
                      value={newChecklistText}
                      onChange={e => setNewChecklistText(e.target.value)}
                      style={{ flex: 1, padding: '2px 4px', fontSize: '0.7rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                    <button type="submit" className="btn btn-primary" style={{ padding: '2px 6px', fontSize: '0.7rem' }}>Add</button>
                  </form>
                )}

                <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                  {sortedChecklist.map(item => (
                    <div key={item.id} className="note-card-checklist-item checklist-row-hover" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', margin: '0.15rem 0' }}>
                      <input 
                        type="checkbox"
                        checked={!!item.is_completed}
                        onChange={(e) => handleToggleChecklistItem(e, item)}
                        style={{ width: '10px', height: '10px', cursor: 'pointer' }}
                      />
                      <span style={{ 
                        fontSize: '0.725rem', 
                        color: 'var(--text-primary)',
                        textDecoration: item.is_completed ? 'line-through' : 'none',
                        opacity: item.is_completed ? 0.6 : 1,
                        flex: 1
                      }}>
                        {item.title}
                      </span>
                      <button
                        className="btn-icon-small delete-item btn-inline-actions"
                        onClick={(e) => handleDeleteChecklistItem(e, item.id)}
                        title="Delete Item"
                        style={{ padding: 0 }}
                      >
                        <Trash size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Footer Metadata */}
          <div className="task-card-meta" style={{ marginTop: '0.45rem', fontSize: '0.7rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-color)', paddingTop: '0.35rem' }}>
            <span className={`meta-due-date ${isOverdue ? 'danger-text' : ''}`}>
              <Calendar size={10} /> {formatDateTime(dueDate)}
            </span>
            {getRemainingTimeBadge()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
