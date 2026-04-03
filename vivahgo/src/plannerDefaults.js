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
  theme: 'royal-maroon',
  heroTagline: 'You are invited to celebrate',
  welcomeMessage: '',
  scheduleTitle: 'Wedding Calendar',
};

export const DEFAULT_REMINDER_SETTINGS = {
  enabled: false,
  eventDayBefore: true,
  eventHoursBefore: true,
  paymentThreeDaysBefore: true,
  paymentDayOf: true,
};

export const WEDDING_WEBSITE_THEMES = [
  { id: 'royal-maroon', name: 'Royal Maroon' },
  { id: 'garden-sage', name: 'Garden Sage' },
  { id: 'midnight-navy', name: 'Midnight Navy' },
];

export const EXPECTED_GUEST_OPTIONS = [
  ...Array.from({ length: 16 }, (_, index) => 2000 - (index * 100)),
  ...Array.from({ length: 10 }, (_, index) => 400 - (index * 20)),
  ...Array.from({ length: 20 }, (_, index) => 200 - (index * 10)),
];

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

const DEMO_WEDDING_PROFILE = {
  bride: 'Aarohi',
  groom: 'Pranav',
  date: '2 December 2026',
  venue: 'Jai Mahal Palace, Jaipur',
  guests: '320',
  budget: '6500000',
};

const DEMO_EXTRA_LOCATIONS = [
  'Rajmahal Ballroom',
  'Mughal Courtyard',
  'Neem Lawn',
  'Sunset Terrace',
  'Zenana Suite',
];

const DEMO_WEBSITE_SETTINGS = {
  ...DEFAULT_WEBSITE_SETTINGS,
  theme: 'garden-sage',
  heroTagline: 'Together with our families, we invite you to celebrate',
  welcomeMessage: 'With blessings from both our families, we are gathering in Jaipur for a joyful weekend of music, rituals, and late-night dance floors. We would love to celebrate with you.',
  scheduleTitle: 'Celebration Weekend',
};

const DEMO_GUESTS = [
  {
    id: 101,
    title: 'Mr',
    firstName: 'Rajesh',
    lastName: 'Sharma',
    name: 'Mr Rajesh Sharma',
    side: 'bride',
    phone: '+91 98765 43210',
    rsvp: 'yes',
    guestCount: 6,
    groupMembers: ['Mrs Sunaina Sharma', 'Aarav Sharma', 'Kavya Sharma', 'Dadi Sharma', 'Naman Sharma'],
  },
  {
    id: 102,
    title: 'Mrs',
    firstName: 'Priya',
    lastName: 'Mehta',
    name: 'Mrs Priya Mehta',
    side: 'bride',
    phone: '+91 98765 12345',
    rsvp: 'yes',
    guestCount: 4,
    groupMembers: ['Rishabh Mehta', 'Ishaani Mehta', 'Nani Mehta'],
  },
  {
    id: 103,
    title: 'Mr',
    firstName: 'Anil',
    lastName: 'Bhatia',
    name: 'Mr Anil Bhatia',
    side: 'bride',
    phone: '+91 99887 56123',
    rsvp: 'pending',
    guestCount: 7,
    groupMembers: ['Mrs Poonam Bhatia', 'Rhea Bhatia', 'Moksh Bhatia', 'Dadaji Bhatia', 'Dadiji Bhatia', 'Ritu Bua'],
  },
  {
    id: 104,
    title: 'Dr',
    firstName: 'Meera',
    lastName: 'Nanda',
    name: 'Dr Meera Nanda',
    side: 'bride',
    phone: '+91 91234 56789',
    rsvp: 'yes',
    guestCount: 3,
    groupMembers: ['Dr Vikas Nanda', 'Tara Nanda'],
  },
  {
    id: 105,
    title: 'Mrs',
    firstName: 'Neha',
    lastName: 'Bansal',
    name: 'Mrs Neha Bansal',
    side: 'bride',
    phone: '+91 98111 22334',
    rsvp: 'pending',
    guestCount: 6,
    groupMembers: ['Mr Anuj Bansal', 'Diya Bansal', 'Kabira Bansal', 'Badi Masi', 'Rohan Mama'],
  },
  {
    id: 106,
    title: 'Ms',
    firstName: 'Ishita',
    lastName: 'Kapoor',
    name: 'Ms Ishita Kapoor',
    side: 'bride',
    phone: '+91 98222 33445',
    rsvp: 'yes',
    guestCount: 2,
    groupMembers: ['Aanya Kapoor'],
  },
  {
    id: 107,
    title: 'Capt',
    firstName: 'Arvind',
    lastName: 'Verma',
    name: 'Capt Arvind Verma',
    side: 'groom',
    phone: '+91 98333 44556',
    rsvp: 'yes',
    guestCount: 5,
    groupMembers: ['Mrs Ritu Verma', 'Arjun Verma', 'Sia Verma', 'Dadi Verma'],
  },
  {
    id: 108,
    title: 'Mr',
    firstName: 'Rohit',
    lastName: 'Khanna',
    name: 'Mr Rohit Khanna',
    side: 'groom',
    phone: '+91 98444 55667',
    rsvp: 'pending',
    guestCount: 5,
    groupMembers: ['Mrs Shalini Khanna', 'Ved Khanna', 'Myra Khanna', 'Tauji Khanna'],
  },
  {
    id: 109,
    title: 'Mrs',
    firstName: 'Niharika',
    lastName: 'Rao',
    name: 'Mrs Niharika Rao',
    side: 'bride',
    phone: '+91 98555 66778',
    rsvp: 'no',
    guestCount: 4,
    groupMembers: ['Mr Sanjay Rao', 'Aditi Rao', 'Kian Rao'],
  },
  {
    id: 110,
    title: 'Mr',
    firstName: 'Siddharth',
    lastName: 'Khurana',
    name: 'Mr Siddharth Khurana',
    side: 'groom',
    phone: '+91 98666 77889',
    rsvp: 'yes',
    guestCount: 4,
    groupMembers: ['Mrs Tania Khurana', 'Ira Khurana', 'Neil Khurana'],
  },
  {
    id: 111,
    title: 'Mr',
    firstName: 'Sunil',
    lastName: 'Chawla',
    name: 'Mr Sunil Chawla',
    side: 'groom',
    phone: '+91 98777 88990',
    rsvp: 'pending',
    guestCount: 6,
    groupMembers: ['Mrs Kusum Chawla', 'Ritika Chawla', 'Harsh Chawla', 'Bua Neelam', 'Fufaji Rajiv'],
  },
  {
    id: 112,
    title: 'Ms',
    firstName: 'Pooja',
    lastName: 'Nair',
    name: 'Ms Pooja Nair',
    side: 'bride',
    phone: '+91 98888 99001',
    rsvp: 'yes',
    guestCount: 3,
    groupMembers: ['Ananya Nair', 'Ammamma Nair'],
  },
  {
    id: 113,
    title: 'Mr',
    firstName: 'Karan',
    lastName: 'Oberoi',
    name: 'Mr Karan Oberoi',
    side: 'groom',
    phone: '+91 98989 10112',
    rsvp: 'yes',
    guestCount: 4,
    groupMembers: ['Mrs Simran Oberoi', 'Abeer Oberoi', 'Mahi Oberoi'],
  },
  {
    id: 114,
    title: 'Mrs',
    firstName: 'Tanya',
    lastName: 'Bedi',
    name: 'Mrs Tanya Bedi',
    side: 'groom',
    phone: '+91 99090 21223',
    rsvp: 'pending',
    guestCount: 5,
    groupMembers: ['Mr Manav Bedi', 'Aria Bedi', 'Vivaan Bedi', 'Bebe Bedi'],
  },
  {
    id: 115,
    title: 'Mr',
    firstName: 'Rohan',
    lastName: 'Malhotra',
    name: 'Mr Rohan Malhotra',
    side: 'groom',
    phone: '+91 99191 32334',
    rsvp: 'no',
    guestCount: 4,
    groupMembers: ['Mrs Juhi Malhotra', 'Aarush Malhotra', 'Pari Malhotra'],
  },
  {
    id: 116,
    title: 'Ms',
    firstName: 'Aditi',
    lastName: 'Iyer',
    name: 'Ms Aditi Iyer',
    side: 'bride',
    phone: '+91 99292 43445',
    rsvp: 'yes',
    guestCount: 3,
    groupMembers: ['Raghav Iyer', 'Lakshmi Iyer'],
  },
  {
    id: 117,
    title: 'Mr',
    firstName: 'Manish',
    lastName: 'Sethi',
    name: 'Mr Manish Sethi',
    side: 'groom',
    phone: '+91 99393 54556',
    rsvp: 'pending',
    guestCount: 7,
    groupMembers: ['Mrs Jasleen Sethi', 'Yuv Sethi', 'Noor Sethi', 'Bade Papa Sethi', 'Badi Mummy Sethi', 'Masi Renu'],
  },
  {
    id: 118,
    title: 'Mrs',
    firstName: 'Devika',
    lastName: 'Jain',
    name: 'Mrs Devika Jain',
    side: 'bride',
    phone: '+91 99494 65667',
    rsvp: 'yes',
    guestCount: 4,
    groupMembers: ['Mr Nitin Jain', 'Misha Jain', 'Rudra Jain'],
  },
];

const DEMO_EXPENSES = [
  { id: 201, name: 'Jai Mahal venue advance', amount: 900000, expenseDate: '2026-07-12', category: 'venue', area: 'ceremony', eventId: 9, note: '30% venue block payment' },
  { id: 202, name: 'Reception catering retainer', amount: 285000, expenseDate: '2026-08-02', category: 'catering', area: 'ceremony', eventId: 13, note: 'Menu tasting and first retainer' },
  { id: 203, name: 'Mandap decor concept advance', amount: 240000, expenseDate: '2026-08-18', category: 'decor', area: 'ceremony', eventId: 9, note: 'Fresh florals and ceiling mockup approved' },
  { id: 204, name: 'Photography and film booking', amount: 210000, expenseDate: '2026-09-01', category: 'photography', area: 'vendors', eventId: '', note: 'Two-day coverage locked' },
  { id: 205, name: 'Bridal lehenga first payment', amount: 175000, expenseDate: '2026-09-16', category: 'attire', area: 'bride', eventId: '', note: 'Custom ivory and rose-gold work' },
  { id: 206, name: 'Sherwani and safa fittings', amount: 62000, expenseDate: '2026-09-24', category: 'attire', area: 'groom', eventId: '', note: 'Reception bandhgala included' },
  { id: 207, name: 'Guest room block at palace wing', amount: 410000, expenseDate: '2026-10-09', category: 'stay', area: 'guests', eventId: '', note: '42 rooms reserved for both families' },
  { id: 208, name: 'Invitation suite printing', amount: 68000, expenseDate: '2026-10-22', category: 'invites', area: 'general', eventId: '', note: 'Box invites plus digital motion card' },
  { id: 209, name: 'Sangeet choreography advance', amount: 65000, expenseDate: '2026-11-04', category: 'music', area: 'ceremony', eventId: 6, note: 'Four family sets and couple medley' },
  { id: 210, name: 'Pandit booking and samagri list', amount: 21000, expenseDate: '2026-11-12', category: 'pandit', area: 'ceremony', eventId: 9, note: 'Muhurat and ritual checklist confirmed' },
  { id: 211, name: 'Baraat shuttle deposit', amount: 54000, expenseDate: '2026-11-28', category: 'transport', area: 'guests', eventId: 7, note: 'Airport and hotel transfer matrix started' },
  { id: 212, name: 'Welcome hamper sampling', amount: 38000, expenseDate: '2026-12-06', category: 'misc', area: 'guests', eventId: '', note: 'Room hampers, snacks, and handwritten note cards' },
  { id: 213, name: 'Bridal hair and makeup block', amount: 35000, expenseDate: '2026-12-18', category: 'beauty', area: 'bride', eventId: '', note: 'Wedding plus reception trial booked' },
  { id: 214, name: 'Mehndi artist advance', amount: 27000, expenseDate: '2027-01-05', category: 'vendors', area: 'vendors', eventId: 5, note: 'Bride plus 12 family members' },
];

const DEMO_COMPLETED_TASK_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);

const DEMO_EXTRA_TASKS = [
  { id: 26, name: 'Launch wedding website preview for close family', done: true, due: '4 months before', priority: 'medium', group: '4 months', eventId: '', ceremony: 'General' },
  { id: 27, name: 'Complete catering tasting with both families', done: true, due: '4 months before', priority: 'high', group: '4 months', eventId: 13, ceremony: 'Reception' },
  { id: 28, name: 'Shortlist bridal jewelry pieces for pheras', done: true, due: '3 months before', priority: 'medium', group: '3 months', eventId: 9, ceremony: 'Pheras' },
  { id: 29, name: 'Lock airport pickup matrix for VIP guests', done: false, due: '1 month before', priority: 'high', group: '1 month', eventId: '', ceremony: 'General' },
  { id: 30, name: 'Collect final rooming list from cousins', done: false, due: '3 weeks before', priority: 'medium', group: 'Final', eventId: '', ceremony: 'General' },
];

const DEMO_BOOKED_VENDOR_TYPES = new Set([
  'Venue',
  'Catering',
  'Photography',
  'Wedding Videography',
  'Wedding Decorators',
  'Florists',
  'Pandit',
  'Choreographer',
  'Bridal & Pre-Bridal',
  'Groom Services',
]);

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

function normalizeCustomTemplateEvents(events) {
  if (!Array.isArray(events)) {
    return [];
  }

  return events
    .filter(event => event && typeof event === 'object')
    .map((event, index) => ({
      name: String(event.name || '').trim(),
      emoji: String(event.emoji || '✨').trim() || '✨',
      sortOrder: Number.isFinite(Number(event.sortOrder)) ? Number(event.sortOrder) : index,
    }))
    .filter(event => event.name)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((event, index) => ({ ...event, sortOrder: index }));
}

export function normalizeCustomTemplates(templates) {
  if (!Array.isArray(templates)) {
    return [];
  }

  const byId = new Map();

  templates
    .filter(template => template && typeof template === 'object')
    .forEach((template, index) => {
      const id = typeof template.id === 'string' && template.id.trim()
        ? template.id.trim()
        : `custom_template_${index}`;
      const events = normalizeCustomTemplateEvents(template.events);

      byId.set(id, {
        id,
        name: String(template.name || '').trim() || 'Custom Template',
        description: String(template.description || '').trim() || 'Built for your wedding flow',
        emoji: String(template.emoji || '✨').trim() || '✨',
        culture: String(template.culture || 'Custom').trim() || 'Custom',
        highlights: events.slice(0, 3).map(event => event.name),
        eventCount: events.length,
        events,
        createdAt: template.createdAt || new Date(),
        isCustom: true,
      });
    });

  return [...byId.values()];
}

function getTemplateDefinition(templateId, customTemplates = []) {
  const resolvedTemplateId = resolveTemplateId(templateId);
  if (resolvedTemplateId !== 'blank') {
    if (MARRIAGE_TEMPLATES[resolvedTemplateId]) {
      return { ...MARRIAGE_TEMPLATES[resolvedTemplateId], isCustom: false };
    }
  }

  return normalizeCustomTemplates(customTemplates).find(template => template.id === templateId) || null;
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

function createTemplateEvents(templateId, planId, customTemplates = []) {
  const templateDefinition = getTemplateDefinition(templateId, customTemplates);
  if (!templateDefinition) {
    return [];
  }

  const templateEvents = templateDefinition.isCustom
    ? templateDefinition.events || []
    : TEMPLATE_EVENT_SETS[templateDefinition.id] || [];

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

function createTemplateTasks(templateId, planId, events, customTemplates = []) {
  const templateDefinition = getTemplateDefinition(templateId, customTemplates);
  if (!templateDefinition) {
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

function createTemplateVendors(templateId, planId, customTemplates = []) {
  const templateDefinition = getTemplateDefinition(templateId, customTemplates);
  if (!templateDefinition) {
    return [];
  }

  return cloneCollection(DEFAULT_VENDORS).map((vendor, index) => ({
    ...vendor,
    id: Date.now() + 200 + index,
    booked: false,
    planId,
  }));
}

export function createTemplatePlanCollections(templateId, planId, customTemplates = []) {
  const events = createTemplateEvents(templateId, planId, customTemplates);

  return {
    events,
    expenses: [],
    guests: [],
    vendors: createTemplateVendors(templateId, planId, customTemplates),
    tasks: createTemplateTasks(templateId, planId, events, customTemplates),
  };
}

function createDemoEvents(planId) {
  const demoEventDetails = [
    { date: '18 October 2026', time: '6:30 PM', venue: 'Zenana Suite', status: 'completed', note: 'Immediate families hosted an intimate ring exchange and dinner.' },
    { date: '14 November 2026', time: '7:00 PM', venue: 'Rajmahal Ballroom', status: 'completed', note: 'Stage design, ring trays, and family speeches are already wrapped.' },
    { date: '30 November 2026', time: '10:00 AM', venue: 'Zenana Suite', status: 'confirmed', note: 'Close-family puja with samagri checklist and pandit flow approved.', isPublicWebsiteVisible: false },
    { date: '1 December 2026', time: '10:30 AM', venue: 'Neem Lawn', status: 'confirmed', note: 'Floral swings, marigold umbrellas, and dhol welcome are locked in.' },
    { date: '1 December 2026', time: '2:00 PM', venue: 'Mughal Courtyard', status: 'confirmed', note: 'Bridesmaids lounge, live chaat stations, and artist roster confirmed.' },
    { date: '1 December 2026', time: '8:00 PM', venue: 'Rajmahal Ballroom', status: 'confirmed', note: 'Four family performances and one couple set with cold pyro finale.' },
    { date: '2 December 2026', time: '4:30 PM', venue: 'Palace Entrance', status: 'upcoming', note: 'Horse, dhol team, and guest coaches are staggered in 20-minute waves.' },
    { date: '2 December 2026', time: '7:00 PM', venue: 'Mughal Courtyard', status: 'upcoming', note: 'Hydraulic entry stage under a floral ceiling with family aisle seating.' },
    { date: '2 December 2026', time: '10:30 PM', venue: 'Lotus Mandap', status: 'upcoming', note: 'Mandap faces the fountain lawn and dinner service begins after the fourth phera.' },
    { date: '2 December 2026', time: '11:45 PM', venue: 'Lotus Mandap', status: 'upcoming', note: 'Reserved seating planned for grandparents and immediate family.', isPublicWebsiteVisible: false },
    { date: '3 December 2026', time: '12:10 AM', venue: 'Lotus Mandap', status: 'upcoming', note: 'Soft instrumental set and printed vow cards on both sides of the havan.', isPublicWebsiteVisible: false },
    { date: '3 December 2026', time: '12:35 AM', venue: 'Lotus Mandap', status: 'upcoming', note: 'Photography team briefed for intimate, no-flash close coverage.', isPublicWebsiteVisible: false },
    { date: '3 December 2026', time: '7:30 PM', venue: 'Sunset Terrace', status: 'confirmed', note: 'Live sufi set at cocktails, followed by dinner and an open dance floor.' },
    { date: '3 December 2026', time: '11:00 AM', venue: 'Palace Porte Cochere', status: 'upcoming', note: 'Breakfast hampers, floral car decor, and core-family send-off sequence ready.' },
    { date: '3 December 2026', time: '2:30 PM', venue: "Pranav's family home", status: 'upcoming', note: 'Private family ritual with immediate relatives only.', isPublicWebsiteVisible: false },
  ];

  return cloneCollection(DEFAULT_EVENTS).map((event, index) => ({
    ...event,
    ...demoEventDetails[index],
    planId,
  }));
}

function createDemoGuests(planId) {
  return DEMO_GUESTS.map(guest => ({
    ...guest,
    groupMembers: [...(guest.groupMembers || [])],
    planId,
  }));
}

function createDemoExpenses(planId) {
  return DEMO_EXPENSES.map(expense => normalizeExpense(expense, planId));
}

function createDemoTasks(planId) {
  const seededTasks = cloneCollection(DEFAULT_TASKS).map(task => normalizeTask({
    ...task,
    done: DEMO_COMPLETED_TASK_IDS.has(task.id),
  }, planId));
  const extraTasks = DEMO_EXTRA_TASKS.map(task => normalizeTask(task, planId));

  return [...seededTasks, ...extraTasks];
}

function createDemoVendors(planId) {
  return cloneCollection(DEFAULT_VENDORS).map(vendor => {
    const booked = DEMO_BOOKED_VENDOR_TYPES.has(vendor.type);

    return {
      ...vendor,
      booked,
      featuredLabel: booked ? 'Booked for this wedding' : vendor.featuredLabel,
      reviewCount: booked ? (vendor.reviewCount || 0) + 4 : vendor.reviewCount,
      planId,
    };
  });
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
    extraLocations: [],
    guests: '',
    budget: '',
    websiteSlug: '',
    websiteSettings: { ...DEFAULT_WEBSITE_SETTINGS },
    reminderSettings: { ...DEFAULT_REMINDER_SETTINGS },
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
    ...DEMO_WEDDING_PROFILE,
    extraLocations: [...DEMO_EXTRA_LOCATIONS],
    websiteSlug: 'aarohi-pranav-1',
    websiteSettings: { ...DEMO_WEBSITE_SETTINGS },
    reminderSettings: { ...DEFAULT_REMINDER_SETTINGS, enabled: true },
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
    customTemplates: [],
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
    customTemplates: [],
    wedding: { ...DEMO_WEDDING_PROFILE },
    events: createDemoEvents(planId),
    expenses: createDemoExpenses(planId),
    guests: createDemoGuests(planId),
    vendors: createDemoVendors(planId),
    tasks: createDemoTasks(planId),
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
        extraLocations: Array.isArray(marriage.extraLocations)
          ? marriage.extraLocations
            .filter(location => typeof location === 'string' && location.trim())
            .map(location => location.trim())
          : [],
        websiteSlug: typeof marriage.websiteSlug === 'string' ? marriage.websiteSlug : '',
        websiteSettings: {
          ...DEFAULT_WEBSITE_SETTINGS,
          ...(marriage.websiteSettings && typeof marriage.websiteSettings === 'object' ? marriage.websiteSettings : {}),
        },
        reminderSettings: {
          ...DEFAULT_REMINDER_SETTINGS,
          ...(marriage.reminderSettings && typeof marriage.reminderSettings === 'object' ? marriage.reminderSettings : {}),
          enabled: Boolean(marriage.reminderSettings?.enabled),
          eventDayBefore: marriage.reminderSettings?.eventDayBefore !== false,
          eventHoursBefore: marriage.reminderSettings?.eventHoursBefore !== false,
          paymentThreeDaysBefore: marriage.reminderSettings?.paymentThreeDaysBefore !== false,
          paymentDayOf: marriage.reminderSettings?.paymentDayOf !== false,
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
      extraLocations: [],
      guests: planner.wedding.guests || '',
      budget: planner.wedding.budget || '',
      websiteSlug: '',
      websiteSettings: { ...DEFAULT_WEBSITE_SETTINGS },
      reminderSettings: { ...DEFAULT_REMINDER_SETTINGS },
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
    customTemplates: normalizeCustomTemplates(planner.customTemplates),
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
