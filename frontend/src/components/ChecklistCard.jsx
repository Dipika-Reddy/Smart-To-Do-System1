import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import API from '../services/api';
import { Edit3, Trash2, CheckSquare, Plus, Trash } from 'lucide-react';

const ChecklistCard = ({ note, onEdit }) => {
  const { loadNotes, showToast } = useApp();
  const [newFocusedItemId, setNewFocusedItemId] = useState(null);

  // Parsing and Sanitizing checklist items (providing unique IDs & originalIndex)
  let rawItems;
  try {
    rawItems = JSON.parse(note.content || '[]');
  } catch (e) {
    rawItems = [];
  }

  const items = rawItems.map((item, idx) => ({
    id: item.id || `item_${idx}_${Date.now()}`,
    text: item.text || '',
    checked: !!item.checked,
    completedAt: item.completedAt || null,
    originalIndex: item.originalIndex !== undefined ? item.originalIndex : idx
  }));

  // Separating and sorting lists
  // 1. Pending items: Sorted by originalIndex (relative original order)
  const pendingItems = items
    .filter(item => !item.checked)
    .sort((a, b) => a.originalIndex - b.originalIndex);

  // 2. Completed items: Sorted by completedAt (in order of completion checkmark trigger)
  const completedItems = items
    .filter(item => item.checked)
    .sort((a, b) => a.completedAt - b.completedAt);

  // Unified save handler
  const saveChecklist = async (updatedItems, updatedTitle = note.title) => {
    try {
      await API.updateNote(note.id, {
        title: updatedTitle,
        content: JSON.stringify(updatedItems),
        type: note.type,
        color_theme: note.color_theme,
        pattern_theme: note.pattern_theme || 'blank'
      });
      loadNotes();
    } catch (err) {
      showToast('Failed to save checklist state.', 'danger');
    }
  };

  // Toggle item checkmark state
  const handleToggleItem = async (e, itemId) => {
    e.stopPropagation();
    const nextItems = items.map(item => {
      if (item.id === itemId) {
        const nextChecked = !item.checked;
        return {
          ...item,
          checked: nextChecked,
          completedAt: nextChecked ? Date.now() : null
        };
      }
      return item;
    });
    await saveChecklist(nextItems);
  };

  // Edit item text textflow
  const handleSaveText = async (itemId, newText) => {
    const item = items.find(i => i.id === itemId);
    if (!item || item.text === newText) return;

    const nextItems = items.map(i => {
      if (i.id === itemId) {
        return { ...i, text: newText };
      }
      return i;
    });
    await saveChecklist(nextItems);
  };

  // Delete item row
  const handleDeleteItem = async (e, itemId) => {
    e.stopPropagation();
    const nextItems = items.filter(item => item.id !== itemId);
    await saveChecklist(nextItems);
  };

  // Add new checklist row inline
  const handleAddItem = async (e) => {
    e.stopPropagation();
    const newId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const maxIndex = items.reduce((max, item) => item.originalIndex > max ? item.originalIndex : max, 0);

    const newItem = {
      id: newId,
      text: '',
      checked: false,
      completedAt: null,
      originalIndex: maxIndex + 1
    };

    const nextItems = [...items, newItem];
    setNewFocusedItemId(newId);
    await saveChecklist(nextItems);
  };

  // Edit title inline
  const handleSaveTitle = async (newTitle) => {
    if (!newTitle.trim() || newTitle === note.title) return;
    await saveChecklist(items, newTitle.trim());
  };

  // Card delete checklist trigger
  const handleDeleteChecklist = async (e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this checklist?')) {
      try {
        await API.deleteNote(note.id);
        showToast('Checklist deleted successfully.', 'success');
        loadNotes();
      } catch (err) {
        showToast('Failed to delete checklist.', 'danger');
      }
    }
  };

  // Formatting date string
  const formatDateTime = (date) => {
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString(undefined, options);
  };

  const colorClass = note.color_theme ? `note-${note.color_theme}` : 'note-default';
  const patternClass = note.pattern_theme ? `note-pattern-${note.pattern_theme}` : 'note-pattern-blank';

  return (
    <div 
      className={`note-card ${colorClass} ${patternClass}`}
      style={{ display: 'flex', flexDirection: 'column', maxHeight: '420px' }}
      onClick={(e) => {
        // Prevents triggering full edit modal when clicking components inside note card
        if (e.target.closest('.checklist-item-input') || e.target.closest('.note-card-title-input') || e.target.closest('.inline-checkbox') || e.target.closest('.btn-inline-actions')) {
          e.stopPropagation();
        } else {
          onEdit(note);
        }
      }}
    >
      {/* Inline Editable Title */}
      <input
        type="text"
        className="note-card-title-input"
        defaultValue={note.title}
        onBlur={(e) => handleSaveTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.target.blur();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.1rem',
          fontWeight: 600,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          padding: '0',
          marginBottom: '0.2rem',
          width: '85%'
        }}
      />
      
      {/* Top right edit/delete controls */}
      <div className="note-card-actions">
        <button 
          className="btn-icon-small edit-note btn-inline-actions" 
          onClick={(e) => { e.stopPropagation(); onEdit(note); }} 
          title="Customize Theme"
        >
          <Edit3 size={12} />
        </button>
        <button 
          className="btn-icon-small delete-note btn-inline-actions" 
          onClick={handleDeleteChecklist} 
          title="Delete Checklist"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Checklist items list */}
      <div className="note-card-checklist" style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', margin: '0.5rem 0' }}>
        
        {/* 1. Pending Items */}
        {pendingItems.map((item) => (
          <div key={item.id} className="note-card-checklist-item checklist-row-hover" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <input 
              type="checkbox"
              className="inline-checkbox"
              checked={false}
              onChange={(e) => handleToggleItem(e, item.id)}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }}
            />
            <input
              type="text"
              className="checklist-item-input"
              defaultValue={item.text}
              placeholder="Blank item..."
              autoFocus={item.id === newFocusedItemId}
              onFocus={() => {
                if (item.id === newFocusedItemId) setNewFocusedItemId(null);
              }}
              onBlur={(e) => handleSaveText(item.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.target.blur();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.875rem',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                padding: '2px 0',
                width: '100%',
                color: 'var(--note-text)'
              }}
            />
            <button
              type="button"
              className="btn-icon-small delete-item btn-inline-actions"
              onClick={(e) => handleDeleteItem(e, item.id)}
              title="Delete Item"
              style={{ padding: 0, opacity: 0, transition: 'opacity 0.2s', flexShrink: 0 }}
            >
              <Trash size={12} />
            </button>
          </div>
        ))}

        {/* Divider if we have completed items */}
        {completedItems.length > 0 && (
          <div className="checklist-divider" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0 0.5rem 0' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Completed Items</span>
            <hr style={{ flex: 1, border: 'none', borderTop: '1px dashed var(--border-color)', opacity: 0.5 }} />
          </div>
        )}

        {/* 2. Completed Items */}
        {completedItems.map((item) => (
          <div key={item.id} className="note-card-checklist-item checklist-row-hover checked" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', opacity: 0.6 }}>
            <input 
              type="checkbox"
              className="inline-checkbox"
              checked={true}
              onChange={(e) => handleToggleItem(e, item.id)}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }}
            />
            <input
              type="text"
              className="checklist-item-input"
              defaultValue={item.text}
              onBlur={(e) => handleSaveText(item.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.target.blur();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.875rem',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                padding: '2px 0',
                width: '100%',
                color: 'var(--note-text)',
                textDecoration: 'line-through'
              }}
            />
            <button
              type="button"
              className="btn-icon-small delete-item btn-inline-actions"
              onClick={(e) => handleDeleteItem(e, item.id)}
              title="Delete Item"
              style={{ padding: 0, opacity: 0, transition: 'opacity 0.2s', flexShrink: 0 }}
            >
              <Trash size={12} />
            </button>
          </div>
        ))}

        {/* Add Item Button */}
        <button
          type="button"
          className="btn-text-icon btn-inline-actions"
          onClick={handleAddItem}
          style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-color)', cursor: 'pointer', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
        >
          <Plus size={12} /> Add Item
        </button>
      </div>

      {/* Footer Details: Counts and Creation Date */}
      <div className="note-card-footer" style={{ borderTop: '1px solid rgba(0, 0, 0, 0.05)', paddingTop: '0.5rem', marginTop: 'auto' }}>
        <span className="note-card-badge" style={{ fontSize: '0.7rem' }}>
          <CheckSquare size={10} /> Pending: {pendingItems.length} | Done: {completedItems.length}
        </span>
        <span>{formatDateTime(new Date(note.created_at || Date.now()))}</span>
      </div>
    </div>
  );
};

export default ChecklistCard;
