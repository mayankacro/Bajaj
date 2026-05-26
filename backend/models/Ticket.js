const mongoose = require('mongoose');

const SLA_LIMITS = {
  urgent: 60,   // 1 hour
  high: 240,    // 4 hours
  medium: 1440, // 24 hours
  low: 4320     // 72 hours
};

const ticketSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  customerEmail: {
    type: String,
    required: [true, 'Customer email is required'],
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  priority: {
    type: String,
    required: [true, 'Priority is required'],
    enum: {
      values: ['low', 'medium', 'high', 'urgent'],
      message: 'Priority must be one of: low, medium, high, urgent'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['open', 'in_progress', 'resolved', 'closed'],
      message: 'Status must be one of: open, in_progress, resolved, closed'
    },
    default: 'open'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual field for ageMinutes
ticketSchema.virtual('ageMinutes').get(function() {
  const endTime = this.status === 'resolved' || this.status === 'closed' 
    ? (this.resolvedAt || new Date()) 
    : new Date();
  const diffMs = endTime - this.createdAt;
  return Math.max(0, Math.floor(diffMs / 1000 / 60));
});

// Virtual field for slaBreached
ticketSchema.virtual('slaBreached').get(function() {
  const limitMinutes = SLA_LIMITS[this.priority] || 4320;
  
  // If resolved/closed, check if the resolution time breached the SLA limit
  if (this.status === 'resolved' || this.status === 'closed') {
    if (!this.resolvedAt) return false;
    const diffMs = this.resolvedAt - this.createdAt;
    const resolvedAgeMinutes = Math.floor(diffMs / 1000 / 60);
    return resolvedAgeMinutes > limitMinutes;
  }
  
  // If still unresolved/open, check if current age breaches the SLA limit
  const currentDiffMs = new Date() - this.createdAt;
  const currentAgeMinutes = Math.floor(currentDiffMs / 1000 / 60);
  return currentAgeMinutes > limitMinutes;
});

module.exports = mongoose.model('Ticket', ticketSchema);
