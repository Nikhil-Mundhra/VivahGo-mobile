import { DEFAULT_EVENTS, DEFAULT_TASKS, DEFAULT_VENDORS } from './data';

export const EMPTY_WEDDING = {
  bride: '',
  groom: '',
  date: '',
  venue: '',
  guests: '',
  budget: '',
};

const SAMPLE_GUESTS = [
  { id: 1, name: 'Rajesh Sharma', side: 'bride', phone: '+91 98765 43210', rsvp: 'yes', guestCount: 4 },
  { id: 2, name: 'Priya Mehta', side: 'bride', phone: '+91 98765 12345', rsvp: 'yes', guestCount: 2 },
  { id: 3, name: 'Vikram Singh', side: 'groom', phone: '+91 99887 56123', rsvp: 'pending', guestCount: 3 },
  { id: 4, name: 'Sunita Verma', side: 'groom', phone: '+91 91234 56789', rsvp: 'no', guestCount: 1 },
  { id: 5, name: 'Arjun Kapoor', side: 'bride', phone: '+91 87654 32109', rsvp: 'pending', guestCount: 5 },
];

const SAMPLE_EXPENSES = [
  { id: 1, name: 'Haldi venue advance', amount: 200000, expenseDate: '2027-02-10', category: 'venue', area: 'ceremony', eventId: 4, note: '50% advance' },
  { id: 2, name: 'Bridal lehenga', amount: 150000, expenseDate: '2026-11-20', category: 'attire', area: 'bride', eventId: '', note: 'Sabyasachi' },
  { id: 3, name: 'Guest hotel block', amount: 85000, expenseDate: '2027-01-15', category: 'stay', area: 'guests', eventId: '', note: '40 deluxe rooms reserved' },
];

function normalizeExpense(expense) {
  if (!expense || typeof expense !== 'object') {
    return { id: Date.now(), name: '', amount: 0, expenseDate: '', category: 'misc', area: 'general', eventId: '', note: '' };
  }

  return {
    id: expense.id ?? Date.now(),
    name: expense.name || '',
    amount: Number(expense.amount || 0),
    expenseDate: expense.expenseDate || '',
    category: expense.category || 'misc',
    area: expense.area || (expense.eventId ? 'ceremony' : 'general'),
    eventId: expense.eventId ?? '',
    note: expense.note || '',
  };
}

function normalizeTask(task) {
  if (!task || typeof task !== 'object') {
    return {
      id: Date.now(),
      name: '',
      done: false,
      due: '',
      priority: 'medium',
      group: 'Final',
      eventId: '',
      ceremony: 'General',
    };
  }

  return {
    id: task.id ?? Date.now(),
    name: task.name || '',
    done: Boolean(task.done),
    due: task.due || '',
    priority: task.priority || 'medium',
    group: task.group || 'Final',
    eventId: task.eventId ?? '',
    ceremony: task.ceremony || 'General',
  };
}

function cloneCollection(items) {
  return items.map(item => ({ ...item }));
}

function createDemoEvents() {
  return cloneCollection(DEFAULT_EVENTS).map((event, index) => ({
    ...event,
    date: ['12 Feb 2027', '13 Feb 2027', '13 Feb 2027', '14 Feb 2027', '14 Feb 2027', '15 Feb 2027'][index] || '',
    time: ['11:00 AM', '4:00 PM', '8:00 PM', '5:00 PM', '9:30 PM', '7:30 PM'][index] || '',
    venue: ['Jaipur Courtyard', 'Terrace Lawn', 'Royal Ballroom', 'Palace Entrance', 'Lotus Mandap', 'Sunset Pavilion'][index] || '',
    status: index < 2 ? 'confirmed' : 'upcoming',
    note: index === 4 ? 'Mandap setup by 7 PM' : '',
  }));
}

export function createBlankPlanner() {
  return {
    wedding: { ...EMPTY_WEDDING },
    events: [],
    expenses: [],
    guests: [],
    vendors: [],
    tasks: [],
  };
}

export function createDemoPlanner() {
  return {
    wedding: {
      bride: 'Aarohi',
      groom: 'Kabir',
      date: '14 February 2027',
      venue: 'Jaipur Palace Grounds',
      guests: '320',
      budget: '6500000',
    },
    events: createDemoEvents(),
    expenses: cloneCollection(SAMPLE_EXPENSES),
    guests: cloneCollection(SAMPLE_GUESTS),
    vendors: cloneCollection(DEFAULT_VENDORS),
    tasks: cloneCollection(DEFAULT_TASKS),
  };
}

export function normalizePlanner(planner) {
  const blankPlanner = createBlankPlanner();

  if (!planner || typeof planner !== 'object') {
    return blankPlanner;
  }

  return {
    wedding: { ...EMPTY_WEDDING, ...(planner.wedding || {}) },
    events: Array.isArray(planner.events) ? planner.events : blankPlanner.events,
    expenses: Array.isArray(planner.expenses) ? planner.expenses.map(normalizeExpense) : blankPlanner.expenses,
    guests: Array.isArray(planner.guests) ? planner.guests : blankPlanner.guests,
    vendors: Array.isArray(planner.vendors) ? planner.vendors : blankPlanner.vendors,
    tasks: Array.isArray(planner.tasks) ? planner.tasks.map(normalizeTask) : blankPlanner.tasks,
  };
}

export function hasWeddingProfile(wedding) {
  return Boolean(
    wedding && (wedding.bride || wedding.groom || wedding.date || wedding.venue || wedding.guests || wedding.budget)
  );
}