import React from 'react';
import { useApp } from '../context/AppContext';
import { ClipboardList, Clock, CheckCircle, AlertTriangle, Play, HelpCircle, Briefcase, Award } from 'lucide-react';

const StatsDashboard = () => {
  const { dashboardStats } = useApp();

  return (
    <section className="dashboard-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
      <div className="stat-card total" style={{ padding: '0.75rem 1rem' }}>
        <div className="stat-icon">
          <ClipboardList size={20} />
        </div>
        <div className="stat-details">
          <h4 style={{ fontSize: '1.25rem', margin: 0 }}>{dashboardStats.total}</h4>
          <p style={{ fontSize: '0.75rem', margin: 0 }}>Total Tasks</p>
        </div>
      </div>

      <div className="stat-card pending" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #6b7280' }}>
        <div className="stat-icon" style={{ color: '#6b7280' }}>
          <Clock size={20} />
        </div>
        <div className="stat-details">
          <h4 style={{ fontSize: '1.25rem', margin: 0 }}>{dashboardStats.pending}</h4>
          <p style={{ fontSize: '0.75rem', margin: 0 }}>Pending</p>
        </div>
      </div>

      <div className="stat-card progress" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #8b5cf6' }}>
        <div className="stat-icon" style={{ color: '#8b5cf6' }}>
          <Play size={20} />
        </div>
        <div className="stat-details">
          <h4 style={{ fontSize: '1.25rem', margin: 0 }}>{dashboardStats.inProgress}</h4>
          <p style={{ fontSize: '0.75rem', margin: 0 }}>In Progress</p>
        </div>
      </div>

      <div className="stat-card review" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #f59e0b' }}>
        <div className="stat-icon" style={{ color: '#f59e0b' }}>
          <HelpCircle size={20} />
        </div>
        <div className="stat-details">
          <h4 style={{ fontSize: '1.25rem', margin: 0 }}>{dashboardStats.review}</h4>
          <p style={{ fontSize: '0.75rem', margin: 0 }}>Under Review</p>
        </div>
      </div>

      <div className="stat-card completed" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #10b981' }}>
        <div className="stat-icon" style={{ color: '#10b981' }}>
          <CheckCircle size={20} />
        </div>
        <div className="stat-details">
          <h4 style={{ fontSize: '1.25rem', margin: 0 }}>{dashboardStats.completed}</h4>
          <p style={{ fontSize: '0.75rem', margin: 0 }}>Completed</p>
        </div>
      </div>

      <div className="stat-card overdue" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #ef4444' }}>
        <div className="stat-icon" style={{ color: '#ef4444' }}>
          <AlertTriangle size={20} />
        </div>
        <div className="stat-details">
          <h4 style={{ fontSize: '1.25rem', margin: 0 }}>{dashboardStats.overdue}</h4>
          <p style={{ fontSize: '0.75rem', margin: 0 }}>Overdue</p>
        </div>
      </div>

      <div className="stat-card assigned" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #3b82f6' }}>
        <div className="stat-icon" style={{ color: '#3b82f6' }}>
          <Briefcase size={20} />
        </div>
        <div className="stat-details">
          <h4 style={{ fontSize: '1.25rem', margin: 0 }}>{dashboardStats.assigned}</h4>
          <p style={{ fontSize: '0.75rem', margin: 0 }}>Assigned</p>
        </div>
      </div>

      <div className="stat-card score" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #ec4899' }}>
        <div className="stat-icon" style={{ color: '#ec4899' }}>
          <Award size={20} />
        </div>
        <div className="stat-details">
          <h4 style={{ fontSize: '1.25rem', margin: 0 }}>{dashboardStats.productivityScore}%</h4>
          <p style={{ fontSize: '0.75rem', margin: 0 }}>Productivity</p>
        </div>
      </div>
    </section>
  );
};

export default StatsDashboard;
