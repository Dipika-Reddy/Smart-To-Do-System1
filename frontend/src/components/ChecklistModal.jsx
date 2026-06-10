import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import API from '../services/api';
import { X, Trash2, Plus } from 'lucide-react';

const ChecklistModal = ({ isOpen, note, onClose }) => {
  const { loadNotes, showToast } = useApp();
  const [title, setTitle] = useState('');
  const [items, setItems] = useState([{ text: '', checked: false }]);
  const [colorTheme, setColorTheme] = useState('default');
  const [patternTheme, setPatternTheme] = useState('blank');

  const isEdit = !!note;

  // Initialize fields on open/edit
  useEffect(() => {
    if (isOpen) {
      if (isEdit) {
        setTitle(note.title || '');
        setColorTheme(note.color_theme || 'default');
        setPatternTheme(note.pattern_theme || 'blank');
        
        try {
          const parsed = JSON.parse(note.content || '[]');
          if (parsed.length > 0) {
            setItems(parsed);
          } else {
            setItems([{ text: '', checked: false }]);
          }
        } catch (e) {
          setItems([{ text: '', checked: false }]);
        }
      } else {
        setTitle('');
        setItems([{ text: '', checked: false }]);
        setColorTheme('default');
        setPatternTheme('blank');
      }
    }
  }, [isOpen, note, isEdit]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems(prev => [...prev, { text: '', checked: false }]);
  };

  const handleRemoveItem = (index) => {
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleItemTextChange = (index, value) => {
    setItems(prev => {
      const next = [...prev];
      if (next[index]) {
        next[index].text = value;
      }
      return next;
    });
  };

  const handleItemCheckChange = (index) => {
    setItems(prev => {
      const next = [...prev];
      if (next[index]) {
        next[index].checked = !next[index].checked;
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast('Checklist title is required.', 'warning');
      return;
    }

    // Filter out rows with empty text
    const filteredItems = items.filter(item => item.text.trim() !== '');

    const payload = {
      title: title.trim(),
      content: JSON.stringify(filteredItems),
      type: 'List',
      color_theme: colorTheme,
      pattern_theme: patternTheme
    };

    try {
      if (isEdit) {
        await API.updateNote(note.id, payload);
        showToast('Checklist updated.', 'success');
      } else {
        await API.createNote(payload);
        showToast('Checklist saved.', 'success');
      }
      onClose();
      loadNotes();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const colors = ['default', 'yellow', 'blue', 'green', 'pink', 'purple', 'gray'];
  const patterns = ['blank', 'lined', 'grid', 'dots', 'diagonal', 'gradient'];

  return (
    <div className="modal" id="checklist-modal">
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-content">
        <div className="modal-header">
          <h3 id="checklist-modal-title">{isEdit ? 'Edit Checklist' : 'Create Checklist'}</h3>
          <button onClick={onClose} className="modal-close btn-icon-small">
            <X size={16} />
          </button>
        </div>

        <form id="checklist-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="checklist-title">Checklist Title *</label>
            <input 
              type="text" 
              id="checklist-title" 
              required 
              placeholder="Checklist Title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Checklist Items</label>
            <div id="checklist-items-container" className="checklist-builder">
              {items.map((item, idx) => (
                <div key={idx} className="checklist-builder-row" style={{ marginBottom: '0.5rem' }}>
                  <input 
                    type="checkbox" 
                    checked={item.checked} 
                    onChange={() => handleItemCheckChange(idx)}
                  />
                  <input 
                    type="text" 
                    className="form-control checklist-item-text" 
                    required 
                    placeholder="List item text..."
                    value={item.text}
                    onChange={(e) => handleItemTextChange(idx, e.target.value)}
                  />
                  <button 
                    type="button" 
                    className="btn-icon-small remove-item" 
                    onClick={() => handleRemoveItem(idx)}
                    title="Remove Item"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            
            <button 
              type="button" 
              id="checklist-add-item-btn" 
              className="btn-text-icon"
              onClick={handleAddItem}
            >
              <Plus size={14} /> Add Item
            </button>
          </div>

          <div className="note-styles-group" style={{ border: '1px solid var(--border-color)', padding: '1.25rem', borderRadius: '12px', marginTop: '1.25rem', marginBottom: '1.25rem' }}>
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.85rem', letterSpacing: '0.05em', fontWeight: 700 }}>Checklist Styles</h4>

            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label>Color Option</label>
              <div className="color-palette-picker" id="checklist-color-picker">
                {colors.map(color => (
                  <span 
                    key={color}
                    className={`color-picker-option ${color} ${colorTheme === color ? 'active' : ''}`}
                    onClick={() => setColorTheme(color)}
                    title={color.charAt(0).toUpperCase() + color.slice(1)}
                  />
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Template Pattern</label>
              <div className="pattern-palette-picker" id="checklist-pattern-picker">
                {patterns.map(pattern => (
                  <span 
                    key={pattern}
                    className={`pattern-picker-option ${pattern} ${patternTheme === pattern ? 'active' : ''}`}
                    onClick={() => setPatternTheme(pattern)}
                    title={pattern.charAt(0).toUpperCase() + pattern.slice(1)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost modal-close" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" id="checklist-form-submit">
              {isEdit ? 'Save Checklist' : 'Create Checklist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChecklistModal;
