import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import API from '../services/api';
import { X } from 'lucide-react';

const NoteModal = ({ isOpen, note, onClose }) => {
  const { loadNotes, showToast } = useApp();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [colorTheme, setColorTheme] = useState('default');
  const [patternTheme, setPatternTheme] = useState('blank');
  const [template, setTemplate] = useState('');

  const isEdit = !!note;

  // Initialize fields on open/edit
  useEffect(() => {
    if (isOpen) {
      setTemplate('');
      if (isEdit) {
        setTitle(note.title || '');
        setContent(note.content || '');
        setColorTheme(note.color_theme || 'default');
        setPatternTheme(note.pattern_theme || 'blank');
      } else {
        setTitle('');
        setContent('');
        setColorTheme('default');
        setPatternTheme('blank');
      }
    }
  }, [isOpen, note, isEdit]);

  if (!isOpen) return null;

  // Template switch handler
  const handleTemplateChange = (e) => {
    const val = e.target.value;
    setTemplate(val);
    let text = '';
    
    if (val === 'meeting') {
      text = `Date: ${new Date().toLocaleDateString()}\nAttendees: \n\nAgenda:\n- \n\nAction Items:\n- `;
    } else if (val === 'ideas') {
      text = `Core Concept: \n\nKey Pillars:\n1. \n2. \n3. \n\nNext Steps:\n- `;
    } else if (val === 'journal') {
      text = `Date: ${new Date().toLocaleDateString()}\n\nWhat went well today?\n- \n\nChallenges faced:\n- \n\nTomorrow's focus:\n- `;
    }

    if (text) {
      if (!content.trim() || window.confirm('Over-write existing note content with this template?')) {
        setContent(text);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast('Note title is required.', 'warning');
      return;
    }

    const payload = {
      title: title.trim(),
      content: content.trim(),
      type: 'Note',
      color_theme: colorTheme,
      pattern_theme: patternTheme
    };

    try {
      if (isEdit) {
        await API.updateNote(note.id, payload);
        showToast('Note updated.', 'success');
      } else {
        await API.createNote(payload);
        showToast('Note saved.', 'success');
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
    <div className="modal" id="note-modal">
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-content">
        <div className="modal-header">
          <h3 id="note-modal-title">{isEdit ? 'Edit Note' : 'Take a Note'}</h3>
          <button onClick={onClose} className="modal-close btn-icon-small">
            <X size={16} />
          </button>
        </div>

        <form id="note-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="note-title">Title *</label>
            <input 
              type="text" 
              id="note-title" 
              required 
              placeholder="Note Title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group" id="note-body-group">
            <label htmlFor="note-content">Note Content</label>
            <textarea 
              id="note-content" 
              rows="5" 
              placeholder="Take a note..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <div className="note-styles-group" style={{ border: '1px solid var(--border-color)', padding: '1.25rem', borderRadius: '12px', marginTop: '1.25rem', marginBottom: '1.25rem' }}>
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.85rem', letterSpacing: '0.05em', fontWeight: 700 }}>Note Styles</h4>
            
            <div className="form-group">
              <label htmlFor="note-template">Content Template</label>
              <select 
                id="note-template" 
                className="form-control"
                value={template}
                onChange={handleTemplateChange}
              >
                <option value="">Standard Blank</option>
                <option value="meeting">Meeting Minutes</option>
                <option value="ideas">Brainstorming Ideas</option>
                <option value="journal">Daily Journal Entry</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label>Color Option</label>
              <div className="color-palette-picker" id="color-palette-picker">
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
              <div className="pattern-palette-picker" id="note-pattern-picker">
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
            <button type="submit" className="btn btn-primary" id="note-form-submit">
              {isEdit ? 'Save Note' : 'Add Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NoteModal;
