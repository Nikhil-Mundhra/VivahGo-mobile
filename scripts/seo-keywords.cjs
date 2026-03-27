const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT_DIR = path.resolve(__dirname, '..');
const APP_DIR = path.join(ROOT_DIR, 'vivahgo');
const GENERATED_JSON_PATH = path.join(APP_DIR, 'src', 'generated', 'seo-keywords.json');
const GENERATED_TEXT_PATH = path.join(ROOT_DIR, 'docs', 'seo-keywords.txt');

const CORE_PRODUCT_TERMS = [
  'indian wedding planner',
  'indian wedding planning app',
  'indian wedding planning software',
  'indian wedding planning platform',
  'wedding planning app',
  'wedding planner app',
  'wedding planner software',
  'wedding planning workspace',
  'wedding planning dashboard',
  'wedding checklist app',
  'wedding checklist planner',
  'wedding budget planner',
  'wedding budget tracker',
  'wedding guest list manager',
  'wedding vendor manager',
  'wedding vendor coordination app',
  'wedding task manager',
  'wedding timeline planner',
  'wedding event planner',
  'wedding ceremony planner',
  'wedding website builder',
  'wedding website for guests',
  'wedding rsvp manager',
  'wedding reminder app',
  'family wedding planner',
  'couple wedding planner',
  'wedding planner for families',
  'wedding planner for wedding planners',
  'destination wedding planner',
  'multi event wedding planner',
];

const FEATURE_TOPICS = [
  'guest list',
  'rsvp tracking',
  'wedding budget',
  'vendor coordination',
  'wedding website',
  'wedding checklist',
  'wedding timeline',
  'wedding tasks',
  'wedding reminders',
  'family coordination',
  'shared wedding workspace',
  'destination wedding planning',
];

const FEATURE_MODIFIERS = [
  'app',
  'software',
  'tool',
  'template',
  'planner',
  'tracker',
  'manager',
  'for indian weddings',
];

const CULTURE_INTENTS = [
  'wedding planner',
  'wedding planning app',
  'wedding checklist',
  'wedding budget planner',
  'wedding guest list planner',
  'wedding vendor planner',
  'wedding timeline',
  'wedding website',
];

const CEREMONY_INTENTS = [
  'checklist',
  'planner',
  'planning guide',
  'timeline',
  'budget planning',
  'vendor planning',
  'guest planning',
  'coordination',
];

const VENDOR_INTENTS = [
  'for indian weddings',
  'planning checklist',
  'booking planner',
  'budget planning',
  'vendor coordination',
  'wedding planning app',
];

const LOCATION_INTENTS = [
  'indian wedding planner',
  'wedding planner',
  'wedding planning app',
  'wedding checklist',
  'wedding budget planner',
  'wedding vendor planner',
];

const CULTURE_LOCATION_INTENTS = [
  'wedding planner',
  'wedding planning app',
  'wedding checklist',
];

const TASK_SUFFIXES = [
  'checklist',
  'planning task',
  'wedding planning step',
];

function normalizePhrase(value) {
  return String(value || '')
    .replace(/&/g, ' and ')
    .replace(/\//g, ' ')
    .replace(/['".,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function uniqueSorted(values) {
  return Array.from(new Set(values.map(normalizePhrase).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function limit(values, max) {
  return values.slice(0, max);
}

async function loadSourceModules() {
  const toImport = (relativePath) => import(pathToFileURL(path.join(ROOT_DIR, relativePath)).href);
  const [dataModule, plannerDefaultsModule, locationOptionsModule] = await Promise.all([
    toImport('vivahgo/src/data.js'),
    toImport('vivahgo/src/plannerDefaults.js'),
    toImport('vivahgo/src/locationOptions.js'),
  ]);

  return {
    DEFAULT_EVENTS: dataModule.DEFAULT_EVENTS || [],
    BUDGET_CATEGORIES: dataModule.BUDGET_CATEGORIES || [],
    DEFAULT_VENDORS: dataModule.DEFAULT_VENDORS || [],
    DEFAULT_TASKS: dataModule.DEFAULT_TASKS || [],
    MARRIAGE_TEMPLATES: plannerDefaultsModule.MARRIAGE_TEMPLATES || {},
    POPULAR_WEDDING_LOCATIONS: locationOptionsModule.POPULAR_WEDDING_LOCATIONS || {},
  };
}

function buildKeywordLibraryFromSources({
  DEFAULT_EVENTS,
  BUDGET_CATEGORIES,
  DEFAULT_VENDORS,
  DEFAULT_TASKS,
  MARRIAGE_TEMPLATES,
  POPULAR_WEDDING_LOCATIONS,
}) {
  const templateEntries = Object.values(MARRIAGE_TEMPLATES).filter((template) => template?.id && template.id !== 'blank');
  const cultures = uniqueSorted(templateEntries.flatMap((template) => [template.name, template.culture]));
  const ceremonies = uniqueSorted([
    ...DEFAULT_EVENTS.map((event) => event?.name),
    ...templateEntries.flatMap((template) => template.highlights || []),
  ]);
  const vendorTypes = uniqueSorted(DEFAULT_VENDORS.flatMap((vendor) => [vendor?.type, vendor?.subType]));
  const budgetCategories = uniqueSorted(BUDGET_CATEGORIES.map((category) => category?.label));
  const planningTasks = uniqueSorted(DEFAULT_TASKS.map((task) => task?.name));

  const indiaLocations = POPULAR_WEDDING_LOCATIONS?.India || {};
  const states = uniqueSorted(Object.keys(indiaLocations).filter((state) => state && state !== 'Other'));
  const cities = uniqueSorted(
    Object.values(indiaLocations)
      .flatMap((stateCities) => stateCities || [])
      .filter((city) => city && city !== 'Other City')
  );

  const primary = uniqueSorted([
    ...CORE_PRODUCT_TERMS,
    ...FEATURE_TOPICS.map((topic) => `indian wedding ${topic}`),
    ...FEATURE_TOPICS.map((topic) => `wedding ${topic} app`),
    ...FEATURE_TOPICS.map((topic) => `wedding ${topic} planner`),
  ]);

  const features = uniqueSorted(
    FEATURE_TOPICS.flatMap((topic) => FEATURE_MODIFIERS.map((modifier) => `${topic} ${modifier}`))
  );

  const cultural = uniqueSorted(
    cultures.flatMap((culture) => CULTURE_INTENTS.map((intent) => `${culture} ${intent}`))
  );

  const ceremony = uniqueSorted(
    ceremonies.flatMap((name) => CEREMONY_INTENTS.map((intent) => `${name} ${intent}`))
  );

  const vendors = uniqueSorted(
    vendorTypes.flatMap((type) => VENDOR_INTENTS.map((intent) => `${type} ${intent}`))
  );

  const budgets = uniqueSorted(
    budgetCategories.flatMap((category) => [
      `${category} wedding budget`,
      `${category} wedding planning`,
      `${category} vendor planning`,
      `${category} checklist for indian wedding`,
    ])
  );

  const tasks = uniqueSorted(
    planningTasks.flatMap((task) => TASK_SUFFIXES.map((suffix) => `${task} ${suffix}`))
  );

  const locations = uniqueSorted([
    ...states.flatMap((state) => LOCATION_INTENTS.map((intent) => `${state} ${intent}`)),
    ...cities.flatMap((city) => LOCATION_INTENTS.map((intent) => `${city} ${intent}`)),
  ]);

  const culturalLocations = uniqueSorted(
    cities.flatMap((city) =>
      cultures.flatMap((culture) => CULTURE_LOCATION_INTENTS.map((intent) => `${culture} ${intent} ${city}`))
    )
  );

  const keywords = uniqueSorted([
    ...primary,
    ...features,
    ...cultural,
    ...ceremony,
    ...vendors,
    ...budgets,
    ...tasks,
    ...locations,
    ...culturalLocations,
  ]);

  return {
    summary: {
      keywordCount: keywords.length,
      primaryCount: primary.length,
      featureCount: features.length,
      culturalCount: cultural.length,
      ceremonyCount: ceremony.length,
      vendorCount: vendors.length,
      budgetCount: budgets.length,
      taskCount: tasks.length,
      locationCount: locations.length,
      culturalLocationCount: culturalLocations.length,
    },
    sourceSummary: {
      cultures: cultures.length,
      ceremonies: ceremonies.length,
      vendorTypes: vendorTypes.length,
      budgetCategories: budgetCategories.length,
      planningTasks: planningTasks.length,
      states: states.length,
      cities: cities.length,
    },
    sourceSnapshot: {
      cultures,
      ceremonies,
      vendorTypes,
      budgetCategories,
      planningTasks: limit(planningTasks, 32),
      indianStates: states,
      indianCities: cities,
    },
    clusters: {
      primary,
      features,
      cultural,
      ceremony,
      vendors,
      budgets,
      tasks,
      locations,
      culturalLocations,
    },
    keywords,
  };
}

async function buildKeywordLibrary() {
  const sources = await loadSourceModules();
  return buildKeywordLibraryFromSources(sources);
}

function formatKeywordText(keywordLibrary) {
  return [
    `# VivahGo SEO Keyword Library`,
    `# Total keywords: ${keywordLibrary.summary.keywordCount}`,
    '',
    ...keywordLibrary.keywords,
    '',
  ].join('\n');
}

function writeKeywordAssets(keywordLibrary) {
  fs.mkdirSync(path.dirname(GENERATED_JSON_PATH), { recursive: true });
  fs.mkdirSync(path.dirname(GENERATED_TEXT_PATH), { recursive: true });
  fs.writeFileSync(GENERATED_JSON_PATH, `${JSON.stringify(keywordLibrary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(GENERATED_TEXT_PATH, formatKeywordText(keywordLibrary), 'utf8');
}

module.exports = {
  GENERATED_JSON_PATH,
  GENERATED_TEXT_PATH,
  buildKeywordLibrary,
  buildKeywordLibraryFromSources,
  formatKeywordText,
  loadSourceModules,
  writeKeywordAssets,
};
