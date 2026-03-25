import { DEFAULT_EVENTS, DEFAULT_TASKS, DEFAULT_VENDORS } from './data.js';

export const EMPTY_WEDDING = {
  bride: '',
  groom: '',
  date: '',
  venue: '',
  guests: '',
  budget: '',
};

export const DEFAULT_WEBSITE_SETTINGS = {
  isActive: true,
  showCountdown: true,
  showCalendar: true,
};

function slugifyWeddingNamePart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function buildWeddingWebsiteBaseSlug(plan = {}) {
  const bride = slugifyWeddingNamePart(plan.bride);
  const groom = slugifyWeddingNamePart(plan.groom);
  const combined = [bride, groom].filter(Boolean).join('-');
  return combined || '';
}

export function buildWeddingWebsitePath(plan = {}, wedding = EMPTY_WEDDING) {
  const storedSlug = typeof plan?.websiteSlug === 'string' ? plan.websiteSlug.trim() : '';
  if (storedSlug) {
    return `/${storedSlug}`;
  }

  const baseSlug = buildWeddingWebsiteBaseSlug({
    bride: plan?.bride || wedding?.bride || '',
    groom: plan?.groom || wedding?.groom || '',
  });

  return baseSlug ? `/${baseSlug}-1` : '/wedding';
}

// Generate unique ID for marriage plans
export function generatePlanId() {
  return `plan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Template definitions for new marriage plans
export const MARRIAGE_TEMPLATES = {
  blank: {
    id: 'blank',
    name: 'Start Fresh',
    description: 'Create a blank planning canvas',
    emoji: '✨',
    culture: 'Custom',
    eventCount: 0,
    highlights: ['No preloaded events'],
  },
  punjabi: {
    id: 'punjabi',
    name: 'Punjabi Wedding',
    description: 'Big-energy functions with Jaggo and Anand Karaj',
    emoji: '🪔',
    culture: 'Punjabi',
    eventCount: 12,
    highlights: ['Jaggo', 'Anand Karaj', 'Milni'],
  },
  gujarati: {
    id: 'gujarati',
    name: 'Gujarati Wedding',
    description: 'Garba-led celebrations with Mameru and Hasta Milap',
    emoji: '🪷',
    culture: 'Gujarati',
    eventCount: 11,
    highlights: ['Gol Dhana', 'Mameru', 'Hasta Milap'],
  },
  marwari: {
    id: 'marwari',
    name: 'Marwari Wedding',
    description: 'Royal-style flow with Baan, Pithi Dastoor, and Toran',
    emoji: '👑',
    culture: 'Marwari',
    eventCount: 11,
    highlights: ['Baan', 'Pithi Dastoor', 'Toran'],
  },
  bengali: {
    id: 'bengali',
    name: 'Bengali Wedding',
    description: 'Aiburo Bhaat to Bou Bhaat with classic Bengali rituals',
    emoji: '🌺',
    culture: 'Bengali',
    eventCount: 11,
    highlights: ['Gaye Holud', 'Shubho Drishti', 'Bou Bhaat'],
  },
  'south-indian': {
    id: 'south-indian',
    name: 'South Indian Wedding',
    description: 'Temple-style sequence with Vratham and Kashi Yatra',
    emoji: '🛕',
    culture: 'South Indian',
    eventCount: 11,
    highlights: ['Vratham', 'Kashi Yatra', 'Saptapadi'],
  },
};

const LEGACY_TEMPLATE_MAP = {
  traditional: 'punjabi',
  modern: 'gujarati',
  minimalist: 'marwari',
  adventure: 'south-indian',
};

const TEMPLATE_EVENT_SETS = {
  punjabi: [
    { name: 'Roka', emoji: '🪔' },
    { name: 'Chunni Ceremony', emoji: '🧣' },
    { name: 'Mehndi', emoji: '🌿' },
    { name: 'Sangeet', emoji: '🎶' },
    { name: 'Maiyan', emoji: '🫧' },
    { name: 'Jaggo', emoji: '🏮' },
    { name: 'Choora Ceremony', emoji: '📿' },
    { name: 'Baraat', emoji: '🐴' },
    { name: 'Milni', emoji: '🤝' },
    { name: 'Anand Karaj', emoji: '🛕' },
    { name: 'Vidaai', emoji: '💐' },
    { name: 'Reception', emoji: '✨' },
  ],
  gujarati: [
    { name: 'Chandlo Matli', emoji: '🪔' },
    { name: 'Gol Dhana', emoji: '🍬' },
    { name: 'Mehndi', emoji: '🌸' },
    { name: 'Garba Night', emoji: '💃' },
    { name: 'Mandap Muhurat', emoji: '🪵' },
    { name: 'Grah Shanti', emoji: '🙏' },
    { name: 'Pithi', emoji: '🌼' },
    { name: 'Mameru', emoji: '🎁' },
    { name: 'Baraat', emoji: '🐎' },
    { name: 'Hasta Milap & Pheras', emoji: '🔥' },
    { name: 'Reception', emoji: '🎉' },
  ],
  marwari: [
    { name: 'Roka', emoji: '🪔' },
    { name: 'Baan', emoji: '🌿' },
    { name: 'Pithi Dastoor', emoji: '🌼' },
    { name: 'Mehndi', emoji: '🌺' },
    { name: 'Sangeet Sandhya', emoji: '🎵' },
    { name: 'Sehra Bandi', emoji: '👑' },
    { name: 'Baraat', emoji: '🐴' },
    { name: 'Toran', emoji: '🚪' },
    { name: 'Pheras', emoji: '🔥' },
    { name: 'Vidaai', emoji: '💐' },
    { name: 'Reception', emoji: '✨' },
  ],
  bengali: [
    { name: 'Aiburo Bhaat', emoji: '🍽️' },
    { name: 'Gaye Holud', emoji: '🌼' },
    { name: 'Dodhi Mongol', emoji: '🥣' },
    { name: 'Saat Paak', emoji: '🌀' },
    { name: 'Shubho Drishti', emoji: '👀' },
    { name: 'Mala Badal', emoji: '🌸' },
    { name: 'Sampradan', emoji: '🙏' },
    { name: 'Yagna & Saptapadi', emoji: '🔥' },
    { name: 'Sindoor Daan', emoji: '❤️' },
    { name: 'Bidaay', emoji: '🚗' },
    { name: 'Bou Bhaat', emoji: '🍛' },
  ],
  'south-indian': [
    { name: 'Nischayathartham', emoji: '💍' },
    { name: 'Pellikuthuru / Haldi', emoji: '🌿' },
    { name: 'Mehndi', emoji: '🌸' },
    { name: 'Vratham', emoji: '🪔' },
    { name: 'Janavasam', emoji: '🚗' },
    { name: 'Kashi Yatra', emoji: '🛕' },
    { name: 'Oonjal', emoji: '🎐' },
    { name: 'Muhurtham', emoji: '🔥' },
    { name: 'Saptapadi', emoji: '🪷' },
    { name: 'Grihapravesam', emoji: '🏠' },
    { name: 'Reception', emoji: '🎉' },
  ],
};

const SAMPLE_GUESTS = [
  { id: 1, name: 'Rajesh Sharma', side: 'bride', phone: '+91 98765 43210', rsvp: 'yes', guestCount: 4 },
  { id: 2, name: 'Priya Mehta', side: 'bride', phone: '+91 98765 12345', rsvp: 'yes', guestCount: 2 },
  { id: 3, name: 'Vikram Singh', side: 'groom', phone: '+91 99887 56123', rsvp: 'pending', guestCount: 3 },
  { id: 4, name: 'Sunita Verma', side: 'groom', phone: '+91 91234 56789', rsvp: 'no', guestCount: 1 },
  { id: 5, name: 'Arjun Kapoor', side: 'bride', phone: '+91 87654 32109', rsvp: 'pending', guestCount: 5 },
  { id: 6, name: 'Neha Bansal', side: 'bride', phone: '+91 98111 22334', rsvp: 'yes', guestCount: 2 },
  { id: 7, name: 'Kunal Arora', side: 'groom', phone: '+91 98222 33445', rsvp: 'pending', guestCount: 2 },
  { id: 8, name: 'Meera Iyer', side: 'bride', phone: '+91 98333 44556', rsvp: 'yes', guestCount: 3 },
  { id: 9, name: 'Rohan Malhotra', side: 'groom', phone: '+91 98444 55667', rsvp: 'no', guestCount: 1 },
  { id: 10, name: 'Ananya Rao', side: 'bride', phone: '+91 98555 66778', rsvp: 'pending', guestCount: 4 },
  { id: 11, name: 'Siddharth Khanna', side: 'groom', phone: '+91 98666 77889', rsvp: 'yes', guestCount: 2 },
  { id: 12, name: 'Pooja Nair', side: 'bride', phone: '+91 98777 88990', rsvp: 'pending', guestCount: 3 },
];

const SAMPLE_EXPENSES = [
  { id: 1, name: 'Haldi venue advance', amount: 200000, expenseDate: '2027-02-10', category: 'venue', area: 'ceremony', eventId: 4, note: '50% advance' },
  { id: 2, name: 'Bridal lehenga', amount: 150000, expenseDate: '2026-11-20', category: 'attire', area: 'bride', eventId: '', note: 'Sabyasachi' },
  { id: 3, name: 'Guest hotel block', amount: 85000, expenseDate: '2027-01-15', category: 'stay', area: 'guests', eventId: '', note: '40 deluxe rooms reserved' },
];

function normalizeExpense(expense, planId) {
  if (!expense || typeof expense !== 'object') {
    return { id: Date.now(), name: '', amount: 0, expenseDate: '', category: 'misc', area: 'general', eventId: '', note: '', planId };
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
    planId: expense.planId || planId,
  };
}

function normalizeTask(task, planId) {
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
      planId,
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
    planId: task.planId || planId,
  };
}

function resolveTemplateId(templateId) {
  if (MARRIAGE_TEMPLATES[templateId]) {
    return templateId;
  }

  return LEGACY_TEMPLATE_MAP[templateId] || 'blank';
}

function cloneCollection(items) {
  return items.map(item => ({ ...item }));
}

function hasValidPlanId(item, validPlanIds) {
  return Boolean(item?.planId && validPlanIds.has(item.planId));
}

function normalizePlanScopedItems(items, activePlanId, validPlanIds) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter(item => item && typeof item === 'object')
    .map(item => {
      if (hasValidPlanId(item, validPlanIds)) {
        return { ...item };
      }

      // One-time migration for legacy records without a valid plan id.
      return {
        ...item,
        planId: activePlanId,
      };
    });
}

function createTemplateEvents(templateId, planId) {
  const resolvedTemplateId = resolveTemplateId(templateId);
  if (resolvedTemplateId === 'blank') {
    return [];
  }

  const templateEvents = TEMPLATE_EVENT_SETS[resolvedTemplateId] || [];

  return cloneCollection(templateEvents).map((event, index) => ({
    ...event,
    id: Date.now() + index,
    planId,
    colorIdx: index,
    status: 'upcoming',
    date: '',
    time: '',
    venue: '',
    note: '',
  }));
}

function createTemplateTasks(templateId, planId, events) {
  const resolvedTemplateId = resolveTemplateId(templateId);
  if (resolvedTemplateId === 'blank') {
    return [];
  }

  const planningTasks = cloneCollection(DEFAULT_TASKS)
    .filter(task => !task.eventId || task.ceremony === 'General')
    .slice(0, 8)
    .map((task, index) => normalizeTask({
      ...task,
      id: Date.now() + 100 + index,
      done: false,
      eventId: '',
      ceremony: 'General',
    }, planId));

  const timelineGroups = ['6 months', '5 months', '4 months', '3 months', '2 months', '1 month', 'Final'];
  const eventTasks = events.map((event, index) => normalizeTask({
    id: Date.now() + 500 + index,
    name: `Finalize ${event.name} logistics`,
    done: false,
    due: `${Math.max(1, 6 - Math.floor(index / 2))} months before`,
    priority: index % 3 === 0 ? 'high' : index % 3 === 1 ? 'medium' : 'low',
    group: timelineGroups[Math.min(index, timelineGroups.length - 1)],
    eventId: event.id,
    ceremony: event.name,
  }, planId));

  return [...planningTasks, ...eventTasks];
}

function createTemplateVendors(templateId, planId) {
  const resolvedTemplateId = resolveTemplateId(templateId);
  if (resolvedTemplateId === 'blank') {
    return [];
  }

  return cloneCollection(DEFAULT_VENDORS).map((vendor, index) => ({
    ...vendor,
    id: Date.now() + 200 + index,
    booked: false,
    planId,
  }));
}

export function createTemplatePlanCollections(templateId, planId) {
  const events = createTemplateEvents(templateId, planId);

  return {
    events,
    expenses: [],
    guests: [],
    vendors: createTemplateVendors(templateId, planId),
    tasks: createTemplateTasks(templateId, planId, events),
  };
}

function createDemoEvents(planId) {
  return cloneCollection(DEFAULT_EVENTS).map((event, index) => ({
    ...event,
    planId,
    date: ['12 Feb 2027', '13 Feb 2027', '13 Feb 2027', '14 Feb 2027', '14 Feb 2027', '15 Feb 2027'][index] || '',
    time: ['11:00 AM', '4:00 PM', '8:00 PM', '5:00 PM', '9:30 PM', '7:30 PM'][index] || '',
    venue: ['Jaipur Courtyard', 'Terrace Lawn', 'Royal Ballroom', 'Palace Entrance', 'Lotus Mandap', 'Sunset Pavilion'][index] || '',
    status: index < 2 ? 'confirmed' : 'upcoming',
    note: index === 4 ? 'Mandap setup by 7 PM' : '',
  }));
}

// Create a blank marriage plan
export function createBlankMarriagePlan(planId = null) {
  const id = planId || generatePlanId();
  return {
    id,
    bride: '',
    groom: '',
    date: '',
    venue: '',
    guests: '',
    budget: '',
    websiteSlug: '',
    websiteSettings: { ...DEFAULT_WEBSITE_SETTINGS },
    template: 'blank',
    collaborators: [],
    createdAt: new Date(),
  };
}

// Create a demo marriage plan
export function createDemoMarriagePlan() {
  const planId = generatePlanId();
  return {
    id: planId,
    bride: 'Aarohi',
    groom: 'Kabir',
    date: '14 February 2027',
    venue: 'Jaipur Palace Grounds',
    guests: '320',
    budget: '6500000',
    websiteSlug: 'aarohi-kabir-1',
    websiteSettings: { ...DEFAULT_WEBSITE_SETTINGS },
    template: 'punjabi',
    collaborators: [],
    createdAt: new Date(),
  };
}

// Create a blank planner with multi-marriage support
export function createBlankPlanner() {
  const planId = generatePlanId();
  return {
    marriages: [createBlankMarriagePlan(planId)],
    activePlanId: planId,
    wedding: { ...EMPTY_WEDDING },
    events: [],
    expenses: [],
    guests: [],
    vendors: [],
    tasks: [],
  };
}

// Create a demo planner with multi-marriage support
export function createDemoPlanner() {
  const demoMarriage = createDemoMarriagePlan();
  const planId = demoMarriage.id;
  
  return {
    marriages: [demoMarriage],
    activePlanId: planId,
    wedding: {
      bride: 'Aarohi',
      groom: 'Kabir',
      date: '14 February 2027',
      venue: 'Jaipur Palace Grounds',
      guests: '320',
      budget: '6500000',
    },
    events: createDemoEvents(planId),
    expenses: cloneCollection(SAMPLE_EXPENSES).map(e => normalizeExpense(e, planId)),
    guests: cloneCollection(SAMPLE_GUESTS).map(g => ({ ...g, planId })),
    vendors: cloneCollection(DEFAULT_VENDORS).map(v => ({ ...v, planId })),
    tasks: cloneCollection(DEFAULT_TASKS).map(t => normalizeTask(t, planId)),
  };
}

// Normalize planner to handle both old single-plan and new multi-plan formats
export function normalizePlanner(planner) {
  const blankPlanner = createBlankPlanner();

  if (!planner || typeof planner !== 'object') {
    return blankPlanner;
  }

  // Handle migration from old single-plan format
  let marriages = Array.isArray(planner.marriages)
    ? planner.marriages
      .filter(marriage => marriage && typeof marriage === 'object')
      .map(marriage => ({
        ...marriage,
        websiteSlug: typeof marriage.websiteSlug === 'string' ? marriage.websiteSlug : '',
        websiteSettings: {
          ...DEFAULT_WEBSITE_SETTINGS,
          ...(marriage.websiteSettings && typeof marriage.websiteSettings === 'object' ? marriage.websiteSettings : {}),
        },
        collaborators: Array.isArray(marriage.collaborators)
          ? marriage.collaborators
            .filter(item => item && typeof item === 'object' && typeof item.email === 'string' && item.email.trim())
            .map(item => ({
              email: item.email.trim().toLowerCase(),
              role: item.role === 'owner' || item.role === 'editor' || item.role === 'viewer' ? item.role : 'viewer',
              addedAt: item.addedAt || new Date(),
              addedBy: item.addedBy || '',
            }))
          : [],
      }))
    : [];
  let activePlanId = planner.activePlanId;

  // If no marriages but has old wedding data, migrate it
  if (marriages.length === 0 && planner.wedding && hasWeddingProfile(planner.wedding)) {
    const planId = generatePlanId();
    marriages = [{
      id: planId,
      bride: planner.wedding.bride || '',
      groom: planner.wedding.groom || '',
      date: planner.wedding.date || '',
      venue: planner.wedding.venue || '',
      guests: planner.wedding.guests || '',
      budget: planner.wedding.budget || '',
      websiteSlug: '',
      websiteSettings: { ...DEFAULT_WEBSITE_SETTINGS },
      template: 'blank',
      collaborators: [],
      createdAt: new Date(),
    }];
    activePlanId = planId;
  }

  // Ensure we have at least one plan
  if (marriages.length === 0) {
    marriages = [createBlankMarriagePlan()];
    activePlanId = marriages[0].id;
  }

  // Ensure activePlanId is set and points to an existing plan
  if (!activePlanId || !marriages.some(m => m.id === activePlanId)) {
    activePlanId = marriages[0]?.id;
  }

  const validPlanIds = new Set(marriages.map(m => m.id).filter(Boolean));

  // Get the active marriage for wedding object
  const activeMarriage = marriages.find(m => m.id === activePlanId) || marriages[0];
  const wedding = {
    ...EMPTY_WEDDING,
    bride: activeMarriage.bride || '',
    groom: activeMarriage.groom || '',
    date: activeMarriage.date || '',
    venue: activeMarriage.venue || '',
    guests: activeMarriage.guests || '',
    budget: activeMarriage.budget || '',
  };

  const normalizedEvents = normalizePlanScopedItems(planner.events, activePlanId, validPlanIds);
  const normalizedEventsWithVisibility = normalizedEvents.map(event => ({
    ...event,
    isPublicWebsiteVisible: event?.isPublicWebsiteVisible !== false,
  }));
  const normalizedExpenses = normalizePlanScopedItems(planner.expenses, activePlanId, validPlanIds)
    .map(e => normalizeExpense(e, activePlanId));
  const normalizedGuests = normalizePlanScopedItems(planner.guests, activePlanId, validPlanIds);
  const normalizedVendors = normalizePlanScopedItems(planner.vendors, activePlanId, validPlanIds);
  const normalizedTasks = normalizePlanScopedItems(planner.tasks, activePlanId, validPlanIds)
    .map(t => normalizeTask(t, activePlanId));

  return {
    marriages,
    activePlanId,
    wedding,
    events: normalizedEventsWithVisibility,
    expenses: normalizedExpenses,
    guests: normalizedGuests,
    vendors: normalizedVendors,
    tasks: normalizedTasks,
  };
}

export function hasWeddingProfile(wedding) {
  return Boolean(
    wedding && (wedding.bride || wedding.groom || wedding.date || wedding.venue || wedding.guests || wedding.budget)
  );
}
