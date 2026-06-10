import React from 'react';
import { useApp } from '../context/AppContext';
import API from '../services/api';
import { Edit3, Trash2, StickyNote } from 'lucide-react';

const NoteCard = ({ note, onEdit }) => {
  const { loadNotes, showToast } = useApp();

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this note?')) {
      try {
        await API.deleteNote(note.id);
        showToast('Note deleted successfully.', 'success');
        loadNotes();
      } catch (err) {
        showToast('Failed to delete note.', 'danger');
      }
    }
  };

  const formatDateTime = (date) => {
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString(undefined, options);
  };

  const colorClass = note.color_theme ? `note-${note.color_theme}` : 'note-default';
  const patternClass = note.pattern_theme ? `note-pattern-${note.pattern_theme}` : 'note-pattern-blank';

  return (
    <div 
      className={`note-card ${colorClass} ${patternClass}`}
      onClick={() => onEdit(note)}
    >
      <div className="note-card-title">{note.title}</div>
      <div className="note-card-content">{note.content}</div>
      
      <div className="note-card-actions">
        <button 
          className="btn-icon-small edit-note" 
          onClick={(e) => { e.stopPropagation(); onEdit(note); }} 
          title="Edit"
        >
          <Edit3 size={12} />
        </button>
        <button 
          className="btn-icon-small delete-note" 
          onClick={handleDelete} 
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="note-card-footer">
        <span className="note-card-badge">
          <StickyNote size={10} /> Note
        </span>
        <span>{formatDateTime(new Date(note.created_at || Date.now()))}</span>
      </div>
    </div>
  );
};

export default NoteCard;
