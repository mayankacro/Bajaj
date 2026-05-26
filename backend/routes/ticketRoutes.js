const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');

const STATUS_ORDER = ['open', 'in_progress', 'resolved', 'closed'];

// @route   POST /api/tickets
// @desc    Create a ticket
router.post('/', async (req, res) => {
  try {
    const { subject, description, customerEmail, priority } = req.body;
    
    // Explicit validation so we return 400 Bad Request instead of Mongoose generic errors
    if (!subject || !description || !customerEmail || !priority) {
      return res.status(400).json({ error: 'All fields (subject, description, customerEmail, priority) are required' });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(customerEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
      return res.status(400).json({ error: 'Priority must be one of: low, medium, high, urgent' });
    }

    const ticket = new Ticket({
      subject,
      description,
      customerEmail,
      priority,
      status: 'open'
    });

    await ticket.save();
    res.status(201).json(ticket);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   GET /api/tickets
// @desc    List tickets with filters (status, priority, breached)
router.get('/', async (req, res) => {
  try {
    const query = {};
    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.priority) {
      query.priority = req.query.priority;
    }

    let tickets = await Ticket.find(query).sort({ createdAt: -1 });

    // Handle breached filter in memory as it's a virtual field
    if (req.query.breached !== undefined) {
      const breachedFilter = req.query.breached === 'true';
      tickets = tickets.filter(t => t.slaBreached === breachedFilter);
    }

    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/tickets/stats
// @desc    Get tickets statistics
router.get('/stats', async (req, res) => {
  try {
    const tickets = await Ticket.find({});
    
    const stats = {
      status: { open: 0, in_progress: 0, resolved: 0, closed: 0 },
      priority: { low: 0, medium: 0, high: 0, urgent: 0 },
      slaBreachedCount: 0
    };

    tickets.forEach(t => {
      if (stats.status[t.status] !== undefined) {
        stats.status[t.status]++;
      }
      if (stats.priority[t.priority] !== undefined) {
        stats.priority[t.priority]++;
      }
      // "number of SLA-breached tickets currently open (unresolved)"
      if (t.slaBreached && t.status !== 'resolved' && t.status !== 'closed') {
        stats.slaBreachedCount++;
      }
    });

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PATCH /api/tickets/:id
// @desc    Update a ticket (used to change status with transition rules)
router.patch('/:id', async (req, res) => {
  try {
    const { status, subject, description, customerEmail, priority } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // If updating other fields (non-status fields), allow them
    if (subject) ticket.subject = subject;
    if (description) ticket.description = description;
    if (customerEmail) {
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(customerEmail)) {
        return res.status(400).json({ error: 'Please provide a valid email address' });
      }
      ticket.customerEmail = customerEmail;
    }
    if (priority) {
      if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
        return res.status(400).json({ error: 'Priority must be one of: low, medium, high, urgent' });
      }
      ticket.priority = priority;
    }

    // Enforce status transition rules
    if (status) {
      const currentStatus = ticket.status;
      const newStatus = status;

      if (currentStatus !== newStatus) {
        const currentIndex = STATUS_ORDER.indexOf(currentStatus);
        const newIndex = STATUS_ORDER.indexOf(newStatus);

        if (newIndex === -1) {
          return res.status(400).json({ error: `Invalid status: ${newStatus}` });
        }

        const diff = newIndex - currentIndex;

        // Rule 1: Skipping forward (e.g. open -> resolved) is not allowed
        if (diff > 1) {
          return res.status(400).json({
            error: `Invalid transition from "${currentStatus}" to "${newStatus}". Skipping forward is not allowed.`
          });
        }

        // Rule 2: Moving backwards is allowed only one step at a time
        if (diff < -1) {
          return res.status(400).json({
            error: `Invalid transition from "${currentStatus}" to "${newStatus}". Moving backward is allowed only one step at a time.`
          });
        }

        // Rule 3: Automatically set resolvedAt when moving to resolved
        if (newStatus === 'resolved') {
          ticket.resolvedAt = new Date();
        } 
        
        // Rule 4: Clear resolvedAt if moved back to an unresolved status (open or in_progress)
        if (newStatus !== 'resolved' && newStatus !== 'closed') {
          ticket.resolvedAt = undefined;
        }

        ticket.status = newStatus;
      }
    }

    await ticket.save();
    res.json(ticket);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   DELETE /api/tickets/:id
// @desc    Delete a ticket
router.delete('/:id', async (req, res) => {
  try {
    const ticket = await Ticket.findByIdAndDelete(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
