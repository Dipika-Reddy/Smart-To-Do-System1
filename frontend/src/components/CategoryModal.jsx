import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import API from '../services/api';
import { X, Trash2 } from 'lucide-react';

const CategoryModal = ({ isOpen, onClose }) => {
  const { categories, loadCategories, loadTasks, showToast } = useApp();
  const [newCatName, setNewCatName] = useState('');

  if (!isOpen) return null;

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;

    try {
      await API.createCategory(name);
      showToast('Category added successfully.', 'success');
      setNewCatName('');
      loadCategories();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleDeleteCategory = async (id, name) => {
    if (window.confirm(`Delete category "${name}"? Existing tasks under this category will retain their information but lose category bindings.`)) {
      try {
        await API.deleteCategory(id);
        showToast('Category deleted.', 'success');
        loadCategories();
        loadTasks(); // refresh task cards category names
      } catch (err) {
        showToast(err.message, 'danger');
      }
    }
  };

  return (
    <div className="modal" id="category-modal">
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-content">
        <div className="modal-header">
          <h3>Manage Categories</h3>
          <button onClick={onClose} className="modal-close btn-icon-small">
            <X size={16} />
          </button>
        </div>

        <div className="category-manager-body">
          <form id="category-add-form" className="inline-form" onSubmit={handleAddCategory}>
            <input 
              type="text" 
              placeholder="New category name..." 
              required
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">Add</button>
          </form>

          <div className="categories-list-wrapper">
            <ul id="categories-list" class="manager-list">
              {categories.length === 0 ? (
                <li className="muted-text">No custom categories.</li>
              ) : (
                categories.map(cat => (
                  <li key={cat.id}>
                    <span>{cat.category_name}</span>
                    <div className="manager-list-actions">
                      <button 
                        className="btn-icon-small delete-cat" 
                        onClick={() => handleDeleteCategory(cat.id, cat.category_name)}
                        title="Delete Category"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryModal;
