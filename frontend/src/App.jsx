import React, { useState, useEffect, useRef } from 'react';

// Use production backend link or default to localhost
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const STATUS_COLUMNS = [
  { id: 'open', label: 'Open', colorClass: 'col-open' },
  { id: 'in_progress', label: 'In Progress', colorClass: 'col-progress' },
  { id: 'resolved', label: 'Resolved', colorClass: 'col-resolved' },
  { id: 'closed', label: 'Closed', colorClass: 'col-closed' }
];

const STATUS_ORDER = ['open', 'in_progress', 'resolved', 'closed'];

export default function App() {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({
    status: { open: 0, in_progress: 0, resolved: 0, closed: 0 },
    priority: { low: 0, medium: 0, high: 0, urgent: 0 },
    slaBreachedCount: 0
  });

  // Filters state
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedBreached, setSelectedBreached] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toast, setToast] = useState({ message: '', visible: false });
  const [activeDragOverCol, setActiveDragOverCol] = useState(null);

  // New Ticket Form State
  const [formSubject, setFormSubject] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPriority, setFormPriority] = useState('medium');
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Fetch tickets and stats
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Build query string
      const params = new URLSearchParams();
      if (selectedPriority !== 'all') params.append('priority', selectedPriority);
      if (selectedBreached === 'true') params.append('breached', 'true');
      if (selectedBreached === 'false') params.append('breached', 'false');

      const ticketsRes = await fetch(`${API_URL}/tickets?${params.toString()}`);
      if (!ticketsRes.ok) throw new Error('Failed to load tickets.');
      const ticketsData = await ticketsRes.json();

      const statsRes = await fetch(`${API_URL}/tickets/stats`);
      if (!statsRes.ok) throw new Error('Failed to load statistics.');
      const statsData = await statsRes.json();

      setTickets(ticketsData);
      setStats(statsData);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Could not connect to the backend server. Please verify it is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPriority, selectedBreached]);

  // Real-time ticking for ticket ages (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      // Fetch fresh tickets to update ages and SLA breaches in real-time
      fetchData();
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedPriority, selectedBreached]);

  // Helper to format minutes into a friendly string (e.g. "2h 45m" or "45m")
  const formatAge = (minutes) => {
    if (minutes < 60) return `${minutes}m`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins}m`;
  };

  // Toast trigger helper
  const showToast = (message) => {
    setToast({ message, visible: true });
    setTimeout(() => {
      setToast({ message: '', visible: false });
    }, 4500);
  };

  // Ticket creation handler
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formSubject.trim() || !formDescription.trim() || !formEmail.trim()) {
      setFormError('All fields are required.');
      return;
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(formEmail)) {
      setFormError('Please enter a valid email address.');
      return;
    }

    try {
      setFormSubmitting(true);
      const res = await fetch(`${API_URL}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: formSubject,
          description: formDescription,
          customerEmail: formEmail,
          priority: formPriority
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create ticket');
      }

      // Reset form and modal
      setFormSubject('');
      setFormEmail('');
      setFormPriority('medium');
      setFormDescription('');
      setShowCreateModal(false);
      
      // Refresh list and stats
      fetchData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Ticket status transition handler (arrow keys & drag-drop)
  const handleUpdateStatus = async (ticketId, currentStatus, newStatus) => {
    try {
      const res = await fetch(`${API_URL}/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await res.json();

      if (!res.ok) {
        // Show validation rules error dynamically in our toast
        showToast(data.error || 'Failed to update status.');
        return;
      }

      // Re-fetch to ensure virtual ages, counts, and SLAs are updated correctly
      fetchData();
    } catch (err) {
      console.error(err);
      showToast('Network error updating ticket status.');
    }
  };

  // Delete ticket
  const handleDeleteTicket = async (ticketId) => {
    if (!window.confirm('Are you sure you want to delete this ticket permanently?')) return;
    try {
      const res = await fetch(`${API_URL}/tickets/${ticketId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to delete ticket.');
      }
    } catch (err) {
      showToast('Error deleting ticket.');
    }
  };

  // Drag and Drop Event Handlers
  const handleDragStart = (e, ticket) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: ticket.id, status: ticket.status }));
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    if (activeDragOverCol !== colId) {
      setActiveDragOverCol(colId);
    }
  };

  const handleDrop = (e, targetStatus) => {
    e.preventDefault();
    setActiveDragOverCol(null);
    try {
      const { id, status } = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (status !== targetStatus) {
        handleUpdateStatus(id, status, targetStatus);
      }
    } catch (err) {
      console.error('Error parsing drag data', err);
    }
  };

  // Search filter
  const filteredTickets = tickets.filter(t => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return t.subject.toLowerCase().includes(q) || 
           t.description.toLowerCase().includes(q) || 
           t.customerEmail.toLowerCase().includes(q);
  });

  return (
    <div className="app-container">
      {/* Toast Alert Popups */}
      {toast.visible && (
        <div className="toast-container">
          <div className="toast">
            <span>⚠️</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="brand-section">
          <h1>DeskFlow ⚡</h1>
          <p>Real-time Support Triage & SLA Monitor Board</p>
        </div>
        <button className="action-btn" onClick={() => setShowCreateModal(true)}>
          <span>+</span> Create New Ticket
        </button>
      </header>

      {/* Stats Strip */}
      <section className="stats-strip">
        <div className="stat-card open-stat">
          <span className="stat-value">{stats.status.open}</span>
          <span className="stat-label">Open Tickets</span>
        </div>
        <div className="stat-card progress-stat">
          <span className="stat-value">{stats.status.in_progress}</span>
          <span className="stat-label">In Progress</span>
        </div>
        <div className="stat-card resolved-stat">
          <span className="stat-value">{stats.status.resolved}</span>
          <span className="stat-label">Resolved</span>
        </div>
        <div className="stat-card closed-stat">
          <span className="stat-value">{stats.status.closed}</span>
          <span className="stat-label">Closed</span>
        </div>
        <div className="stat-card breached-stat">
          <span className="stat-value">{stats.slaBreachedCount}</span>
          <span className="stat-label">Unresolved Breached</span>
        </div>
      </section>

      {/* Filters and Search Bar */}
      <section className="controls-bar">
        <div className="filters-group">
          <input
            type="text"
            placeholder="Search subject, details, email..."
            className="filter-select"
            style={{ minWidth: '240px' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          
          <select 
            className="filter-select"
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
          >
            <option value="all">All Priorities</option>
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
            <option value="urgent">Urgent Priority</option>
          </select>

          <select
            className="filter-select"
            value={selectedBreached}
            onChange={(e) => setSelectedBreached(e.target.value)}
          >
            <option value="all">SLA Status (All)</option>
            <option value="true">SLA Breached Only</option>
            <option value="false">SLA On-Time Only</option>
          </select>
        </div>
        
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
          Showing {filteredTickets.length} tickets
        </div>
      </section>

      {/* Main Kanban Board */}
      {error ? (
        <div className="error-screen">
          <div className="error-message">{error}</div>
          <button className="action-btn" onClick={fetchData}>Try Reconnecting</button>
        </div>
      ) : loading && tickets.length === 0 ? (
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Syncing board in real-time...</p>
        </div>
      ) : (
        <main className="kanban-board">
          {STATUS_COLUMNS.map(col => {
            const colTickets = filteredTickets.filter(t => t.status === col.id);
            const isDragOver = activeDragOverCol === col.id;

            return (
              <div 
                key={col.id} 
                className={`board-column ${col.colorClass} ${isDragOver ? 'drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={() => setActiveDragOverCol(null)}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                <div className="column-header">
                  <div className="column-title">
                    <span className="column-indicator"></span>
                    {col.label}
                  </div>
                  <span className="column-count">{colTickets.length}</span>
                </div>

                <div className="cards-container">
                  {colTickets.length === 0 ? (
                    <div style={{ 
                      textAlign: 'center', 
                      color: 'var(--text-muted)', 
                      fontSize: '0.85rem', 
                      padding: '2rem 1rem',
                      border: '1px dashed rgba(255,255,255,0.05)',
                      borderRadius: '8px'
                    }}>
                      Drop tickets here
                    </div>
                  ) : (
                    colTickets.map(ticket => {
                      const currentIndex = STATUS_ORDER.indexOf(ticket.status);
                      const hasPrev = currentIndex > 0;
                      const hasNext = currentIndex < STATUS_ORDER.length - 1;

                      return (
                        <div
                          key={ticket.id}
                          className="ticket-card"
                          draggable
                          onDragStart={(e) => handleDragStart(e, ticket)}
                        >
                          <div className="card-top">
                            <span className="card-subject">{ticket.subject}</span>
                            <span className={`badge badge-${ticket.priority}`}>
                              {ticket.priority}
                            </span>
                          </div>
                          
                          <p className="card-description">{ticket.description}</p>
                          
                          <div className="card-meta">
                            <span className="meta-item meta-email" title={ticket.customerEmail}>
                              👤 {ticket.customerEmail}
                            </span>
                            
                            <span className="meta-item" title="Ticket age (resolves lock visual calculation)">
                              ⏱️ {formatAge(ticket.ageMinutes)}
                            </span>
                          </div>

                          {/* Breach Alerts */}
                          {ticket.slaBreached && (
                            <div className="breach-alert">
                              🚨 SLA BREACHED
                            </div>
                          )}

                          <div className="card-meta" style={{ border: 'none', paddingTop: 0, marginTop: 0 }}>
                            {/* Delete button */}
                            <button 
                              className="move-btn"
                              style={{ color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                              onClick={() => handleDeleteTicket(ticket.id)}
                            >
                              🗑️ Delete
                            </button>
                            
                            {/* Inline Controls (Forward/Backward transitions) */}
                            <div className="card-actions">
                              {hasPrev && (
                                <button 
                                  className="move-btn"
                                  title={`Move to ${STATUS_COLUMNS[currentIndex - 1].label}`}
                                  onClick={() => handleUpdateStatus(ticket.id, ticket.status, STATUS_ORDER[currentIndex - 1])}
                                >
                                  ◀
                                </button>
                              )}
                              {hasNext && (
                                <button 
                                  className="move-btn"
                                  title={`Move to ${STATUS_COLUMNS[currentIndex + 1].label}`}
                                  onClick={() => handleUpdateStatus(ticket.id, ticket.status, STATUS_ORDER[currentIndex + 1])}
                                >
                                  ▶
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </main>
      )}

      {/* Creation Modal dialog */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Submit Support Ticket</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div className="form-group">
                <label>Customer Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="name@company.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Subject</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Brief summary of issue"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Priority</label>
                <select
                  className="form-select"
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                >
                  <option value="low">Low (72 hr SLA)</option>
                  <option value="medium">Medium (24 hr SLA)</option>
                  <option value="high">High (4 hr SLA)</option>
                  <option value="urgent">Urgent (1 hr SLA)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Description Details</label>
                <textarea
                  className="form-textarea"
                  placeholder="Explain details of the support query..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  required
                />
              </div>

              {formError && <div className="form-error-inline">❌ {formError}</div>}

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="action-btn" disabled={formSubmitting}>
                  {formSubmitting ? 'Submitting...' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
