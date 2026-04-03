import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchAdminChoiceMediaPresignedUrl, fetchAdminChoiceProfiles, updateAdminChoiceProfile } from '../api.js';
import { DEFAULT_VENDORS } from '../../../data';
import { buildAvailabilityState, dateKeyFromDate, getDayAvailability, getDayStatus, parseDateKey } from '../../../vendorAvailability';
import { FallbackImage, FallbackVideo } from '../../../components/MediaWithFallback';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_CAPACITY = 99;
const DEFAULT_CHOICE_NAME_PREFIX = "VivahGo's Choice";
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_FORMATTER = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });
const DATE_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function getChoiceAccountKey(profile) {
  const id = String(profile?.id || profile?._id || '').trim();
  if (id) {
    return id;
  }

  const type = String(profile?.type || '').trim();
  const name = String(profile?.name || '').trim();
  return `${type}::${name || 'draft'}`;
}

function buildChoiceProfileName(type) {
  const trimmedType = String(type || '').trim();
  return trimmedType ? `${DEFAULT_CHOICE_NAME_PREFIX} ${trimmedType}` : DEFAULT_CHOICE_NAME_PREFIX;
}

function buildDraft(profile) {
  const selectedVendorMedia = Array.isArray(profile?.selectedVendorMedia) ? profile.selectedVendorMedia : [];
  const ownedMedia = Array.isArray(profile?.media) ? profile.media : [];
  const mergedSelectedMedia = Array.isArray(profile?.selectedMedia)
    ? profile.selectedMedia
    : [
      ...selectedVendorMedia.map(item => ({
        sourceType: 'vendor',
        vendorId: item.vendorId || '',
        vendorName: item.vendorName || '',
        sourceMediaId: item.sourceMediaId || '',
        url: item.r2Url || item.url || '',
        r2Url: item.r2Url || item.url || '',
        type: item.mediaType || item.type || 'IMAGE',
        mediaType: item.mediaType || item.type || 'IMAGE',
        filename: item.filename || '',
        size: typeof item.size === 'number' ? item.size : 0,
        caption: item.caption || '',
        altText: item.altText || '',
        isCover: Boolean(item.isCover),
        isVisible: item.isVisible !== false,
        sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0,
      })),
      ...ownedMedia.map(item => ({
        sourceType: 'admin',
        vendorId: '',
        vendorName: '',
        sourceMediaId: '',
        key: item.key || '',
        url: item.url || '',
        type: item.type || 'IMAGE',
        mediaType: item.type || 'IMAGE',
        filename: item.filename || '',
        size: typeof item.size === 'number' ? item.size : 0,
        caption: item.caption || '',
        altText: item.altText || '',
        isCover: Boolean(item.isCover),
        isVisible: item.isVisible !== false,
        sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0,
      })),
    ].sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0));

  return {
    id: profile?.id || '',
    type: profile?.type || '',
    name: profile?.name || '',
    businessName: profile?.businessName || profile?.name || '',
    subType: profile?.subType || '',
    description: profile?.description || '',
    services: Array.isArray(profile?.services) ? profile.services : [],
    bundledServices: Array.isArray(profile?.bundledServices) ? profile.bundledServices : [],
    country: profile?.country || '',
    state: profile?.state || '',
    city: profile?.city || '',
    googleMapsLink: profile?.googleMapsLink || '',
    phone: profile?.phone || '',
    website: profile?.website || '',
    budgetRange: profile?.budgetRange || null,
    availabilitySettings: buildAvailabilityState(profile),
    sourceVendorIds: Array.isArray(profile?.sourceVendorIds) ? profile.sourceVendorIds : [],
    selectedVendorMedia,
    media: ownedMedia,
    selectedMedia: mergedSelectedMedia,
  };
}

function normalizeListInput(value) {
  return Array.from(new Set(
    String(value || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  ));
}

function serializeBudgetRange(value) {
  const min = Number(value?.min);
  const max = Number(value?.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) {
    return null;
  }
  return {
    min: Math.round(Math.min(min, max)),
    max: Math.round(Math.max(min, max)),
  };
}

function computeAggregatedBudgetRange(vendors) {
  const minValues = vendors
    .map(vendor => Number(vendor?.budgetRange?.min))
    .filter(value => Number.isFinite(value) && value > 0);
  const maxValues = vendors
    .map(vendor => Number(vendor?.budgetRange?.max))
    .filter(value => Number.isFinite(value) && value > 0);

  if (minValues.length === 0 || maxValues.length === 0) {
    return null;
  }

  return {
    min: Math.min(...minValues),
    max: Math.max(...maxValues),
  };
}

function computeAggregatedServices(vendors) {
  return Array.from(new Set(
    vendors.flatMap(vendor => [
      vendor?.subType,
      ...(Array.isArray(vendor?.bundledServices) ? vendor.bundledServices : []),
    ])
      .filter(value => typeof value === 'string')
      .map(value => value.trim())
      .filter(Boolean)
  )).sort((a, b) => a.localeCompare(b));
}

function sortSelectedMedia(items) {
  return [...(Array.isArray(items) ? items : [])].map((item, index) => ({
    ...item,
    sortOrder: index,
    isCover: index === 0,
  }));
}

function formatBudgetRange(range) {
  const min = Number(range?.min);
  const max = Number(range?.max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return 'Not enough source pricing yet';
  }
  return `₹${min.toLocaleString('en-IN')} - ₹${max.toLocaleString('en-IN')}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, offset) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function buildCalendarDays(displayMonth) {
  const firstDayOfMonth = startOfMonth(displayMonth);
  const lastDayOfMonth = new Date(
    firstDayOfMonth.getFullYear(),
    firstDayOfMonth.getMonth() + 1,
    0
  );
  const firstVisibleDay = new Date(
    firstDayOfMonth.getFullYear(),
    firstDayOfMonth.getMonth(),
    1 - firstDayOfMonth.getDay()
  );
  const lastVisibleDay = new Date(
    lastDayOfMonth.getFullYear(),
    lastDayOfMonth.getMonth(),
    lastDayOfMonth.getDate() + (6 - lastDayOfMonth.getDay())
  );
  const totalDays = Math.round((lastVisibleDay - firstVisibleDay) / (24 * 60 * 60 * 1000)) + 1;

  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(
      firstVisibleDay.getFullYear(),
      firstVisibleDay.getMonth(),
      firstVisibleDay.getDate() + index
    );

    return {
      key: dateKeyFromDate(date),
      date,
      isCurrentMonth: date.getMonth() === firstDayOfMonth.getMonth(),
    };
  });
}

function sanitizeCount(rawValue, fallback = 0) {
  const value = Number(rawValue);
  if (!Number.isInteger(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(MAX_CAPACITY, value));
}

function buildSelectedDayDraft(availability, dateKey) {
  const day = getDayAvailability(availability, dateKey);
  return {
    usesDefaultCapacity: availability.hasDefaultCapacity && !day.hasOverride,
    maxCapacity: String(day.maxCapacity),
    bookingsCount: String(day.bookingsCount),
    unavailable: day.maxCapacity === 0,
  };
}

function buildNextAvailabilityForDate(availability, selectedDate, selectedDayDraft) {
  const nextOverrides = availability.dateOverrides.filter((item) => item.date !== selectedDate);
  const resolvedCapacity = selectedDayDraft.unavailable
    ? 0
    : selectedDayDraft.usesDefaultCapacity && availability.hasDefaultCapacity
      ? availability.defaultMaxCapacity
      : sanitizeCount(selectedDayDraft.maxCapacity, 0);
  const resolvedBookings = resolvedCapacity > 0
    ? Math.min(sanitizeCount(selectedDayDraft.bookingsCount, 0), resolvedCapacity)
    : 0;

  if (
    availability.hasDefaultCapacity &&
    selectedDayDraft.usesDefaultCapacity &&
    resolvedBookings === 0 &&
    resolvedCapacity === availability.defaultMaxCapacity
  ) {
    return {
      hasDefaultCapacity: availability.hasDefaultCapacity,
      defaultMaxCapacity: availability.defaultMaxCapacity,
      dateOverrides: nextOverrides.sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  if (resolvedCapacity > 0 || resolvedBookings > 0 || selectedDayDraft.unavailable) {
    nextOverrides.push({
      date: selectedDate,
      maxCapacity: resolvedCapacity,
      bookingsCount: resolvedBookings,
    });
  }

  return {
    hasDefaultCapacity: availability.hasDefaultCapacity,
    defaultMaxCapacity: availability.defaultMaxCapacity,
    dateOverrides: nextOverrides.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function getStatusClasses(status, isCurrentMonth) {
  const palette = {
    unavailable: isCurrentMonth
      ? 'border-gray-400 bg-gray-200 text-gray-800 hover:bg-gray-300'
      : 'border-gray-300 bg-gray-200 text-gray-600 hover:bg-gray-300',
    open: isCurrentMonth
      ? 'border-emerald-200 bg-emerald-50 text-emerald-950 hover:bg-emerald-100'
      : 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    partial: isCurrentMonth
      ? 'border-amber-200 bg-amber-100 text-amber-950 hover:bg-amber-200'
      : 'border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-100',
    'near-full': isCurrentMonth
      ? 'border-orange-300 bg-orange-200 text-orange-950 hover:bg-orange-300'
      : 'border-orange-200 bg-orange-100 text-orange-800 hover:bg-orange-200',
    full: isCurrentMonth
      ? 'border-rose-300 bg-rose-200 text-rose-950 hover:bg-rose-300'
      : 'border-rose-200 bg-rose-100 text-rose-800 hover:bg-rose-200',
  };

  return palette[status];
}

function buildFallbackChoiceProfile(type, vendorsForType) {
  const normalizedVendors = Array.isArray(vendorsForType) ? vendorsForType : [];
  const defaultSourceVendors = normalizedVendors.filter(vendor => vendor?.tier !== 'Plus');
  const aggregatedAvailabilitySettings = buildAvailabilityState({
    availabilitySettings: {
      hasDefaultCapacity: defaultSourceVendors.length > 0,
      defaultMaxCapacity: Math.min(MAX_CAPACITY, defaultSourceVendors.reduce((sum, vendor) => {
        const availability = buildAvailabilityState(vendor);
        return sum + (availability.hasDefaultCapacity ? availability.defaultMaxCapacity : 0);
      }, 0)),
      dateOverrides: Array.from(new Set(
        defaultSourceVendors.flatMap(vendor => buildAvailabilityState(vendor).dateOverrides.map(item => item.date))
      )).sort((a, b) => a.localeCompare(b)).map(date => {
        const totals = defaultSourceVendors.reduce((accumulator, vendor) => {
          const day = getDayAvailability(buildAvailabilityState(vendor), date);
          return {
            maxCapacity: Math.min(MAX_CAPACITY, accumulator.maxCapacity + day.maxCapacity),
            bookingsCount: Math.min(MAX_CAPACITY, accumulator.bookingsCount + day.bookingsCount),
          };
        }, { maxCapacity: 0, bookingsCount: 0 });

        return {
          date,
          maxCapacity: totals.maxCapacity,
          bookingsCount: Math.min(totals.bookingsCount, totals.maxCapacity),
        };
      }),
    },
  });

  return {
    id: `fallback:${type}`,
    type,
    name: buildChoiceProfileName(type),
    subType: '',
    description: '',
    services: [],
    bundledServices: [],
    country: '',
    state: '',
    city: '',
    googleMapsLink: '',
    phone: '',
    website: '',
    budgetRange: computeAggregatedBudgetRange(defaultSourceVendors),
    aggregatedBudgetRange: computeAggregatedBudgetRange(defaultSourceVendors),
    availabilitySettings: aggregatedAvailabilitySettings,
    aggregatedAvailabilitySettings,
    aggregatedServices: computeAggregatedServices(defaultSourceVendors),
    sourceVendorIds: defaultSourceVendors.map(vendor => vendor.id).filter(Boolean),
    sourceVendorCount: defaultSourceVendors.length,
    selectedMedia: [],
    mediaCount: 0,
    isActive: true,
    createdAt: null,
    updatedAt: null,
  };
}

function buildSeededChoiceProfile(seedVendor) {
  const type = String(seedVendor?.type || '').trim();

  return {
    id: `seed:${type}`,
    type,
    name: String(seedVendor?.name || '').trim() || buildChoiceProfileName(type),
    subType: String(seedVendor?.subType || '').trim(),
    description: String(seedVendor?.description || '').trim(),
    services: Array.isArray(seedVendor?.services) ? seedVendor.services : [],
    bundledServices: Array.isArray(seedVendor?.bundledServices) ? seedVendor.bundledServices : [],
    country: String(seedVendor?.country || '').trim(),
    state: String(seedVendor?.state || '').trim(),
    city: String(seedVendor?.city || '').trim(),
    googleMapsLink: String(seedVendor?.googleMapsLink || '').trim(),
    phone: String(seedVendor?.phone || '').trim(),
    website: String(seedVendor?.website || '').trim(),
    budgetRange: seedVendor?.budgetRange || null,
    aggregatedBudgetRange: seedVendor?.budgetRange || null,
    availabilitySettings: buildAvailabilityState(seedVendor),
    aggregatedAvailabilitySettings: buildAvailabilityState(seedVendor),
    aggregatedServices: Array.isArray(seedVendor?.services) ? seedVendor.services : [],
    sourceVendorIds: [],
    sourceVendorCount: 0,
    selectedMedia: [],
    mediaCount: 0,
    isActive: true,
    createdAt: null,
    updatedAt: null,
  };
}

function MediaTile({ item, removable = false, onRemove }) {
  return (
    <div className="rounded-2xl border border-stone-200 overflow-hidden bg-stone-50">
      <div className="aspect-square bg-stone-100">
        {item.type === 'VIDEO' ? (
          <FallbackVideo src={item.url} preload="metadata" className="w-full h-full object-cover" />
        ) : (
          <FallbackImage src={item.url} alt={item.altText || item.filename || 'Choice media'} className="w-full h-full object-cover" />
        )}
      </div>
      <div className="px-3 py-2 space-y-1">
        <p className="text-xs font-medium text-stone-800 truncate">{item.filename || item.vendorName || 'Media item'}</p>
        <p className="text-[11px] text-stone-500 truncate">
          {item.sourceType === 'vendor' ? (item.vendorName || 'Vendor asset') : 'VivahGo upload'}
        </p>
        {removable && (
          <button type="button" className="text-xs text-rose-600 hover:underline" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminChoiceProfilesPanel({ token, access, vendors }) {
  const uploadInputRef = useRef(null);
  const [choiceProfiles, setChoiceProfiles] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [selectedAccountKey, setSelectedAccountKey] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [availabilityDisplayMonth, setAvailabilityDisplayMonth] = useState(() => startOfMonth(new Date()));
  const [selectedAvailabilityDate, setSelectedAvailabilityDate] = useState(() => dateKeyFromDate(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [savingType, setSavingType] = useState('');
  const [uploading, setUploading] = useState(false);

  const approvedVendors = useMemo(
    () => (Array.isArray(vendors) ? vendors : []).filter(vendor => vendor?.isApproved),
    [vendors]
  );
  const fallbackChoiceProfiles = useMemo(() => {
    const seededProfilesByType = new Map(
      (Array.isArray(DEFAULT_VENDORS) ? DEFAULT_VENDORS : [])
        .map(vendor => buildSeededChoiceProfile(vendor))
        .filter(profile => profile.type)
        .map(profile => [profile.type, profile])
    );
    const vendorsByType = approvedVendors.reduce((map, vendor) => {
      const type = String(vendor?.type || '').trim();
      if (!type) {
        return map;
      }
      if (!map.has(type)) {
        map.set(type, []);
      }
      map.get(type).push(vendor);
      return map;
    }, new Map());

    vendorsByType.forEach((vendorsForType, type) => {
      const approvedFallback = buildFallbackChoiceProfile(type, vendorsForType);
      const seededProfile = seededProfilesByType.get(type);
      seededProfilesByType.set(type, seededProfile
        ? {
          ...seededProfile,
          budgetRange: approvedFallback.budgetRange || seededProfile.budgetRange,
          aggregatedBudgetRange: approvedFallback.aggregatedBudgetRange || seededProfile.aggregatedBudgetRange,
          aggregatedServices: approvedFallback.aggregatedServices.length > 0 ? approvedFallback.aggregatedServices : seededProfile.aggregatedServices,
          sourceVendorIds: approvedFallback.sourceVendorIds,
          sourceVendorCount: approvedFallback.sourceVendorCount,
        }
        : approvedFallback);
    });

    return Array.from(seededProfilesByType.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [approvedVendors]);

  useEffect(() => {
    if (!token) {
      setChoiceProfiles([]);
      setDrafts({});
      setSelectedAccountKey('');
      setAccountFilter('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    fetchAdminChoiceProfiles(token)
      .then((result) => {
        if (cancelled) {
          return;
        }
        const profiles = Array.isArray(result?.choiceProfiles) ? result.choiceProfiles : [];
        setChoiceProfiles(profiles);
        setDrafts(Object.fromEntries(profiles.map(profile => [getChoiceAccountKey(profile), buildDraft(profile)])));
        setSelectedAccountKey((current) => (
          profiles.some(profile => getChoiceAccountKey(profile) === current)
            ? current
            : (profiles[0] ? getChoiceAccountKey(profiles[0]) : '')
        ));
      })
      .catch((nextError) => {
        if (!cancelled) {
          setChoiceProfiles([]);
          setDrafts({});
          setSelectedAccountKey('');
          setError(nextError.message || 'Could not load Choice profiles.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const effectiveChoiceProfiles = useMemo(() => {
    const mergedByType = new Map(fallbackChoiceProfiles.map(profile => [profile.type, profile]));
    choiceProfiles.forEach(profile => {
      if (profile?.type) {
        mergedByType.set(profile.type, profile);
      }
    });
    return Array.from(mergedByType.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [choiceProfiles, fallbackChoiceProfiles]);

  useEffect(() => {
    if (effectiveChoiceProfiles.length === 0) {
      setSelectedAccountKey('');
      return;
    }

    setSelectedAccountKey(current => (
      effectiveChoiceProfiles.some(profile => getChoiceAccountKey(profile) === current)
        ? current
        : getChoiceAccountKey(effectiveChoiceProfiles[0])
    ));
  }, [effectiveChoiceProfiles]);

  const currentProfile = useMemo(
    () => effectiveChoiceProfiles.find(profile => getChoiceAccountKey(profile) === selectedAccountKey) || null,
    [effectiveChoiceProfiles, selectedAccountKey]
  );
  const currentDraft = useMemo(
    () => (selectedAccountKey ? drafts[selectedAccountKey] || buildDraft(currentProfile) : null),
    [currentProfile, drafts, selectedAccountKey]
  );
  const choiceAccounts = useMemo(
    () => effectiveChoiceProfiles
      .map(profile => {
        const accountKey = getChoiceAccountKey(profile);
        const draft = drafts[accountKey];
        const label = String(draft?.name || profile?.name || '').trim() || profile?.type || 'Untitled VCA';
        return {
          key: accountKey,
          type: profile?.type || '',
          label,
          searchText: `${label} ${profile?.type || ''}`.toLowerCase(),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label)),
    [effectiveChoiceProfiles, drafts]
  );
  const visibleChoiceAccounts = useMemo(() => {
    const query = accountFilter.trim().toLowerCase();
    if (!query) {
      return choiceAccounts;
    }
    const filtered = choiceAccounts.filter(account => account.searchText.includes(query));
    if (filtered.some(account => account.key === selectedAccountKey)) {
      return filtered;
    }
    const selectedAccount = choiceAccounts.find(account => account.key === selectedAccountKey);
    return selectedAccount ? [selectedAccount, ...filtered] : filtered;
  }, [accountFilter, choiceAccounts, selectedAccountKey]);
  const currentAccount = useMemo(
    () => choiceAccounts.find(account => account.key === selectedAccountKey) || null,
    [choiceAccounts, selectedAccountKey]
  );
  const hasActiveAccount = Boolean(currentDraft);
  const displayDraft = currentDraft || buildDraft(null);
  const vendorsForType = useMemo(
    () => approvedVendors.filter(vendor => vendor.type === currentDraft?.type),
    [approvedVendors, currentDraft?.type]
  );
  const selectedSourceVendors = useMemo(() => {
    if (!currentDraft) {
      return [];
    }
    const sourceIdSet = new Set(currentDraft.sourceVendorIds);
    return vendorsForType.filter(vendor => sourceIdSet.has(vendor.id));
  }, [currentDraft, vendorsForType]);
  const aggregatedBudgetRange = useMemo(
    () => computeAggregatedBudgetRange(selectedSourceVendors),
    [selectedSourceVendors]
  );
  const aggregatedServices = useMemo(
    () => computeAggregatedServices(selectedSourceVendors),
    [selectedSourceVendors]
  );
  const aggregatedAvailabilitySettings = useMemo(() => {
    if (selectedSourceVendors.length === 0) {
      return currentProfile?.aggregatedAvailabilitySettings || buildAvailabilityState({ availabilitySettings: { hasDefaultCapacity: false, defaultMaxCapacity: 0, dateOverrides: [] } });
    }

    const defaultMaxCapacity = Math.min(
      MAX_CAPACITY,
      selectedSourceVendors.reduce((sum, vendor) => {
        const availability = buildAvailabilityState(vendor);
        return sum + (availability.hasDefaultCapacity ? availability.defaultMaxCapacity : 0);
      }, 0)
    );
    const dateKeys = Array.from(new Set(
      selectedSourceVendors.flatMap(vendor => buildAvailabilityState(vendor).dateOverrides.map(item => item.date))
    )).sort((a, b) => a.localeCompare(b));

    return buildAvailabilityState({
      availabilitySettings: {
        hasDefaultCapacity: defaultMaxCapacity > 0,
        defaultMaxCapacity,
        dateOverrides: dateKeys.map(date => {
          const totals = selectedSourceVendors.reduce((accumulator, vendor) => {
            const day = getDayAvailability(buildAvailabilityState(vendor), date);
            return {
              maxCapacity: Math.min(MAX_CAPACITY, accumulator.maxCapacity + day.maxCapacity),
              bookingsCount: Math.min(MAX_CAPACITY, accumulator.bookingsCount + day.bookingsCount),
            };
          }, { maxCapacity: 0, bookingsCount: 0 });

          return {
            date,
            maxCapacity: totals.maxCapacity,
            bookingsCount: Math.min(totals.bookingsCount, totals.maxCapacity),
          };
        }),
      },
    });
  }, [currentProfile?.aggregatedAvailabilitySettings, selectedSourceVendors]);
  const activeAvailabilitySettings = useMemo(
    () => buildAvailabilityState({ availabilitySettings: currentDraft?.availabilitySettings || aggregatedAvailabilitySettings }),
    [currentDraft?.availabilitySettings, aggregatedAvailabilitySettings]
  );
  const selectedAvailabilityDraft = useMemo(
    () => buildSelectedDayDraft(activeAvailabilitySettings, selectedAvailabilityDate),
    [activeAvailabilitySettings, selectedAvailabilityDate]
  );
  const availabilityCalendarDays = useMemo(
    () => buildCalendarDays(availabilityDisplayMonth),
    [availabilityDisplayMonth]
  );

  useEffect(() => {
    const selectedDateObject = parseDateKey(selectedAvailabilityDate);
    setAvailabilityDisplayMonth((current) => {
      if (
        current.getFullYear() === selectedDateObject.getFullYear()
        && current.getMonth() === selectedDateObject.getMonth()
      ) {
        return current;
      }
      return startOfMonth(selectedDateObject);
    });
  }, [selectedAvailabilityDate]);

  function updateDraft(patch) {
    if (!currentDraft?.type || !selectedAccountKey) {
      return;
    }
    setDrafts(current => ({
      ...current,
      [selectedAccountKey]: {
        ...currentDraft,
        ...patch,
      },
    }));
  }

  function updateAvailabilityDraft(nextSelectedDayDraft) {
    if (!currentDraft) {
      return;
    }

    const nextAvailabilitySettings = buildNextAvailabilityForDate(
      activeAvailabilitySettings,
      selectedAvailabilityDate,
      nextSelectedDayDraft
    );
    updateDraft({ availabilitySettings: nextAvailabilitySettings });
  }

  function handleAvailabilityCapacityInput(rawValue) {
    if (!/^\d*$/.test(rawValue)) {
      return;
    }

    const nextCapacity = rawValue === '' ? '' : String(Math.min(MAX_CAPACITY, Number(rawValue)));
    const currentBookings = sanitizeCount(selectedAvailabilityDraft.bookingsCount, 0);
    const parsedCapacity = nextCapacity === '' ? 0 : Number(nextCapacity);
    updateAvailabilityDraft({
      ...selectedAvailabilityDraft,
      usesDefaultCapacity: false,
      unavailable: false,
      maxCapacity: nextCapacity,
      bookingsCount: String(Math.min(currentBookings, parsedCapacity)),
    });
  }

  function handleAvailabilityBookingsInput(rawValue) {
    if (!/^\d*$/.test(rawValue)) {
      return;
    }

    const nextBookings = rawValue === '' ? '' : rawValue;
    const capacityLimit = selectedAvailabilityDraft.unavailable
      ? 0
      : selectedAvailabilityDraft.usesDefaultCapacity && activeAvailabilitySettings.hasDefaultCapacity
        ? activeAvailabilitySettings.defaultMaxCapacity
        : sanitizeCount(selectedAvailabilityDraft.maxCapacity, 0);
    const parsedBookings = nextBookings === '' ? 0 : Number(nextBookings);
    updateAvailabilityDraft({
      ...selectedAvailabilityDraft,
      bookingsCount: String(Math.min(capacityLimit, Math.min(MAX_CAPACITY, parsedBookings))),
    });
  }

  function handleAvailabilityUseMergedCalendar() {
    updateDraft({ availabilitySettings: aggregatedAvailabilitySettings });
  }

  function handleAvailabilityUseMergedSelectedDay() {
    updateAvailabilityDraft(buildSelectedDayDraft(aggregatedAvailabilitySettings, selectedAvailabilityDate));
  }

  function handleAvailabilityToggleUnavailable() {
    const nextDraft = selectedAvailabilityDraft.unavailable
      ? {
        ...selectedAvailabilityDraft,
        unavailable: false,
        maxCapacity: String(
          selectedAvailabilityDraft.usesDefaultCapacity && activeAvailabilitySettings.hasDefaultCapacity
            ? activeAvailabilitySettings.defaultMaxCapacity
            : Math.max(0, sanitizeCount(selectedAvailabilityDraft.maxCapacity, 0))
        ),
      }
      : {
        ...selectedAvailabilityDraft,
        usesDefaultCapacity: false,
        unavailable: true,
        maxCapacity: '0',
        bookingsCount: '0',
      };
    updateAvailabilityDraft(nextDraft);
  }

  function toggleSourceVendor(vendorId) {
    if (!currentDraft) {
      return;
    }
    updateDraft({
      sourceVendorIds: currentDraft.sourceVendorIds.includes(vendorId)
        ? currentDraft.sourceVendorIds.filter(id => id !== vendorId)
        : [...currentDraft.sourceVendorIds, vendorId],
    });
  }

  function toggleVendorMedia(vendor, mediaItem) {
    if (!currentDraft) {
      return;
    }

    const existingIndex = currentDraft.selectedMedia.findIndex(item => (
      item.sourceType === 'vendor'
        && item.vendorId === vendor.id
        && item.sourceMediaId === String(mediaItem?._id || '')
    ));

    if (existingIndex >= 0) {
      updateDraft({
        selectedMedia: sortSelectedMedia(currentDraft.selectedMedia.filter((_, index) => index !== existingIndex)),
      });
      return;
    }

    updateDraft({
      selectedMedia: sortSelectedMedia([
        ...currentDraft.selectedMedia,
        {
          sourceType: 'vendor',
          vendorId: vendor.id,
          vendorName: vendor.businessName || '',
          sourceMediaId: String(mediaItem?._id || ''),
          url: mediaItem?.url || '',
          type: mediaItem?.type || 'IMAGE',
          filename: mediaItem?.filename || '',
          size: typeof mediaItem?.size === 'number' ? mediaItem.size : 0,
          caption: mediaItem?.caption || '',
          altText: mediaItem?.altText || '',
          isVisible: mediaItem?.isVisible !== false,
        },
      ]),
    });
  }

  function removeSelectedMedia(indexToRemove) {
    if (!currentDraft) {
      return;
    }
    updateDraft({
      selectedMedia: sortSelectedMedia(currentDraft.selectedMedia.filter((_, index) => index !== indexToRemove)),
    });
  }

  async function uploadFiles(files) {
    if (!token || !currentDraft || files.length === 0) {
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');

    try {
      const uploadedMedia = [];
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`${file.name} exceeds the 50 MB upload limit.`);
        }

        const presigned = await fetchAdminChoiceMediaPresignedUrl(token, {
          choiceProfileId: String(currentDraft.id || '').startsWith('vca-') ? currentDraft.id : '',
          type: currentDraft.type,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        });

        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', presigned.uploadUrl);
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
              return;
            }
            reject(new Error(`Upload failed for ${file.name} (HTTP ${xhr.status}).`));
          };
          xhr.onerror = () => reject(new Error(`Network error while uploading ${file.name}.`));
          xhr.send(file);
        });

        uploadedMedia.push({
          sourceType: 'admin',
          vendorId: '',
          vendorName: '',
          sourceMediaId: '',
          key: presigned.key,
          url: presigned.publicUrl,
          type: file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE',
          filename: file.name,
          size: file.size,
          caption: '',
          altText: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
          isVisible: true,
        });
      }

      updateDraft({
        selectedMedia: sortSelectedMedia([...currentDraft.selectedMedia, ...uploadedMedia]),
      });
      setMessage(`Uploaded ${uploadedMedia.length} file${uploadedMedia.length === 1 ? '' : 's'} into the Choice draft.`);
    } catch (nextError) {
      setError(nextError.message || 'Could not upload media.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!token || !currentDraft?.type) {
      return;
    }

    setSavingType(currentDraft.type);
    setError('');
    setMessage('');

    try {
      const result = await updateAdminChoiceProfile(token, {
        id: String(currentDraft.id || '').startsWith('vca-') ? currentDraft.id : '',
        type: currentDraft.type,
        businessName: currentDraft.businessName || currentDraft.name,
        name: currentDraft.name || currentDraft.businessName,
        subType: currentDraft.subType,
        description: currentDraft.description,
        services: currentDraft.services,
        bundledServices: currentDraft.bundledServices,
        country: currentDraft.country,
        state: currentDraft.state,
        city: currentDraft.city,
        googleMapsLink: currentDraft.googleMapsLink,
        availabilitySettings: currentDraft.availabilitySettings,
        phone: currentDraft.phone,
        website: currentDraft.website,
        budgetRange: serializeBudgetRange(currentDraft.budgetRange) || aggregatedBudgetRange,
        sourceVendorIds: currentDraft.sourceVendorIds,
        selectedVendorMedia: currentDraft.selectedMedia
          .filter(item => item.sourceType === 'vendor')
          .map((item, index) => ({
            vendorId: item.vendorId,
            sourceMediaId: item.sourceMediaId,
            r2Url: item.r2Url || item.url,
            mediaType: item.mediaType || item.type,
            filename: item.filename,
            size: item.size,
            caption: item.caption,
            altText: item.altText,
            isVisible: item.isVisible !== false,
            isCover: index === 0,
            sortOrder: item.sortOrder ?? index,
          })),
        media: currentDraft.selectedMedia
          .filter(item => item.sourceType !== 'vendor')
          .map((item, index) => ({
            key: item.key,
            url: item.url,
            type: item.type,
            filename: item.filename,
            size: item.size,
            caption: item.caption,
            altText: item.altText,
            isVisible: item.isVisible !== false,
            isCover: index === 0 && !currentDraft.selectedMedia.some(mediaItem => mediaItem.sourceType === 'vendor'),
            sortOrder: item.sortOrder ?? index,
          })),
      });

      const savedProfile = result?.choiceProfile || null;
      if (!savedProfile) {
        throw new Error('Choice profile did not save correctly.');
      }

      setChoiceProfiles(current => {
        const next = current.some(profile => profile.type === savedProfile.type)
          ? current.map(profile => (profile.type === savedProfile.type ? savedProfile : profile))
          : [...current, savedProfile];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      const savedAccountKey = getChoiceAccountKey(savedProfile);
      setDrafts(current => {
        const next = { ...current };
        if (savedAccountKey !== selectedAccountKey) {
          delete next[selectedAccountKey];
        }
        next[savedAccountKey] = buildDraft(savedProfile);
        return next;
      });
      setSelectedAccountKey(savedAccountKey);
      setMessage(`${savedProfile.name} saved.`);
    } catch (nextError) {
      setError(nextError.message || 'Could not save Choice profile.');
    } finally {
      setSavingType('');
    }
  }

  const effectiveAvailabilityDraftCapacity = selectedAvailabilityDraft.unavailable
    ? 0
    : selectedAvailabilityDraft.usesDefaultCapacity && activeAvailabilitySettings.hasDefaultCapacity
      ? activeAvailabilitySettings.defaultMaxCapacity
      : sanitizeCount(selectedAvailabilityDraft.maxCapacity, 0);
  const effectiveAvailabilityDraftBookings = effectiveAvailabilityDraftCapacity > 0
    ? Math.min(sanitizeCount(selectedAvailabilityDraft.bookingsCount, 0), effectiveAvailabilityDraftCapacity)
    : 0;
  const selectedAvailabilityStatus = getDayStatus(effectiveAvailabilityDraftCapacity, effectiveAvailabilityDraftBookings);
  const selectedAvailabilityDateLabel = DATE_FORMATTER.format(parseDateKey(selectedAvailabilityDate));

  if (loading) {
    return (
      <section className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-10 text-sm text-stone-500">Loading Choice profiles...</div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-200 space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Choice profiles</h2>
          <p className="text-sm text-stone-500">Use the VCA dropdown to isolate one VivahGo&apos;s Choice account by name, then curate its vendors, media, aggregated values, and business details.</p>
        </div>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,180px)_minmax(0,1fr)_240px_auto] xl:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">Filter accounts</span>
            <input
              type="text"
              value={accountFilter}
              onChange={event => setAccountFilter(event.target.value)}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-300"
              placeholder="Search by VCA name or category"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">VCA account</span>
            <select
              value={selectedAccountKey}
              onChange={event => {
                setSelectedAccountKey(event.target.value);
                setError('');
                setMessage('');
              }}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-300"
              disabled={visibleChoiceAccounts.length === 0}
            >
              {visibleChoiceAccounts.length === 0 && (
                <option value="">No VCA accounts available yet</option>
              )}
              {visibleChoiceAccounts.map(account => (
                <option key={account.key} value={account.key}>{account.label}</option>
              ))}
            </select>
          </label>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
            <div className="font-medium text-stone-800">{currentAccount?.label || displayDraft.name || 'Selected VCA'}</div>
            <div>{displayDraft.type || 'Unassigned category'}</div>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
            <div>{vendorsForType.length} approved vendors</div>
            <div>{displayDraft.selectedMedia.length} selected assets</div>
          </div>
          <button
            type="button"
            className="login-secondary-btn"
            onClick={handleSave}
            disabled={!access?.canManageVendors || !hasActiveAccount || savingType === displayDraft.type || uploading}
          >
            {savingType === displayDraft.type ? 'Saving...' : 'Save Choice Profile'}
          </button>
        </div>
      </div>

      {(error || message) && (
        <div className="px-5 pt-4 space-y-3">
          {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
        </div>
      )}

      <div className="p-5 grid gap-6">
        {!hasActiveAccount && (
          <div className="rounded-3xl border border-stone-200 bg-stone-50 px-5 py-6 text-sm text-stone-500">
            No approved vendor categories or saved VCA accounts are ready for Choice curation yet.
          </div>
        )}

        {hasActiveAccount && (
          <>
        <div className="rounded-3xl border border-stone-200 bg-stone-50/70 p-5 space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-semibold text-stone-900">Part 1: Resource pool and media manager</h3>
              <p className="text-sm text-stone-500">Review the selected VCA&apos;s approved Free and Plus vendors, choose which vendors feed the aggregate, pick media from each vendor, or upload VivahGo-owned assets.</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={event => {
                  const files = Array.from(event.target.files || []);
                  event.target.value = '';
                  uploadFiles(files);
                }}
              />
              <button
                type="button"
                className="login-secondary-btn"
                onClick={() => uploadInputRef.current?.click()}
                disabled={!access?.canManageVendors || uploading}
              >
                {uploading ? 'Uploading...' : 'Upload VivahGo Media'}
              </button>
            </div>
          </div>

          {currentDraft.selectedMedia.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-stone-700">Selected assets</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {currentDraft.selectedMedia.map((item, index) => (
                  <MediaTile
                    key={`${item.sourceType}-${item.vendorId}-${item.sourceMediaId}-${index}`}
                    item={item}
                    removable={access?.canManageVendors}
                    onRemove={() => removeSelectedMedia(index)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {vendorsForType.length === 0 && (
              <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500">
                No approved vendors are available in this category yet.
              </div>
            )}
            {vendorsForType.map(vendor => {
              const media = Array.isArray(vendor.media) ? vendor.media : [];
              const selectedVendor = currentDraft.sourceVendorIds.includes(vendor.id);
              return (
                <div key={vendor.id} className="rounded-2xl border border-stone-200 bg-white p-4 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-stone-900">{vendor.businessName}</h4>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${vendor.tier === 'Plus' ? 'bg-sky-100 text-sky-700' : 'bg-stone-100 text-stone-700'}`}>
                          {vendor.tier}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-stone-500">
                        {[vendor.city, vendor.state, vendor.country].filter(Boolean).join(', ') || 'Location not set'}
                      </p>
                      {vendor.description && <p className="mt-2 text-sm text-stone-700">{vendor.description}</p>}
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-stone-700">
                      <input
                        type="checkbox"
                        checked={selectedVendor}
                        onChange={() => toggleSourceVendor(vendor.id)}
                        disabled={!access?.canManageVendors}
                      />
                      Include in aggregate values
                    </label>
                  </div>

                  {media.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {media.map((item, mediaIndex) => {
                        const isSelected = currentDraft.selectedMedia.some(selected => (
                          selected.sourceType === 'vendor'
                            && selected.vendorId === vendor.id
                            && selected.sourceMediaId === String(item?._id || '')
                        ));

                        return (
                          <button
                            key={`${vendor.id}-${String(item?._id || item?.url || mediaIndex)}`}
                            type="button"
                            className={`rounded-2xl overflow-hidden border text-left ${isSelected ? 'border-rose-300 ring-2 ring-rose-100' : 'border-stone-200'}`}
                            onClick={() => toggleVendorMedia(vendor, item)}
                            disabled={!access?.canManageVendors}
                          >
                            <div className="aspect-square bg-stone-100">
                              {item.type === 'VIDEO' ? (
                                <FallbackVideo src={item.url} preload="metadata" className="w-full h-full object-cover" />
                              ) : (
                                <FallbackImage src={item.url} alt={item.altText || item.filename || vendor.businessName} className="w-full h-full object-cover" />
                              )}
                            </div>
                            <div className="px-3 py-2">
                              <p className="text-xs font-medium text-stone-800 truncate">{item.filename || 'Vendor media'}</p>
                              <p className="text-[11px] text-stone-500">{isSelected ? 'Selected for Choice' : 'Tap to include'}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-stone-500">No portfolio media uploaded yet.</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-stone-200 p-5 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-stone-900">Part 2: Aggregated editable values</h3>
            <p className="text-sm text-stone-500">Start with the merged values from the selected resource pool, then edit them into the public-facing Choice profile.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Merged Price Range</p>
              <p className="mt-2 text-sm font-semibold text-stone-900">{formatBudgetRange(aggregatedBudgetRange)}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Merged Services</p>
              <p className="mt-2 text-sm font-semibold text-stone-900">{aggregatedServices.length || 0}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Source Vendors</p>
              <p className="mt-2 text-sm font-semibold text-stone-900">{selectedSourceVendors.length}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Public Assets</p>
              <p className="mt-2 text-sm font-semibold text-stone-900">{currentDraft.selectedMedia.length}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">Profile name</span>
              <input
                type="text"
                value={currentDraft.name}
                onChange={event => updateDraft({ name: event.target.value })}
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-300"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">Subcategory</span>
              <input
                type="text"
                value={currentDraft.subType}
                onChange={event => updateDraft({ subType: event.target.value })}
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-300"
                placeholder="Optional subcategory"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">Description</span>
            <textarea
              value={currentDraft.description}
              onChange={event => updateDraft({ description: event.target.value })}
              rows={4}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-300"
            />
          </label>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">Services</span>
              <textarea
                value={currentDraft.services.join(', ')}
                onChange={event => updateDraft({ services: normalizeListInput(event.target.value) })}
                rows={4}
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-300"
                placeholder={aggregatedServices.join(', ') || 'Comma-separated services'}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">Also offers</span>
              <textarea
                value={currentDraft.bundledServices.join(', ')}
                onChange={event => updateDraft({ bundledServices: normalizeListInput(event.target.value) })}
                rows={4}
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-300"
                placeholder="Comma-separated bundled services"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">Budget min</span>
              <input
                type="number"
                min="0"
                value={currentDraft.budgetRange?.min || ''}
                onChange={event => updateDraft({
                  budgetRange: {
                    min: event.target.value,
                    max: currentDraft.budgetRange?.max || '',
                  },
                })}
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-300"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">Budget max</span>
              <input
                type="number"
                min="0"
                value={currentDraft.budgetRange?.max || ''}
                onChange={event => updateDraft({
                  budgetRange: {
                    min: currentDraft.budgetRange?.min || '',
                    max: event.target.value,
                  },
                })}
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-300"
              />
            </label>
            <button
              type="button"
              className="login-secondary-btn"
              onClick={() => updateDraft({ budgetRange: aggregatedBudgetRange })}
              disabled={!aggregatedBudgetRange}
            >
              Use merged range
            </button>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-stone-50/60 p-5 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-stone-900">Availability calendar</h4>
                <p className="text-sm text-stone-500">This calendar starts from the merged vendor availability pool and can be edited for the selected VCA.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="login-secondary-btn"
                  onClick={handleAvailabilityUseMergedSelectedDay}
                  disabled={!aggregatedAvailabilitySettings.hasDefaultCapacity && aggregatedAvailabilitySettings.dateOverrides.length === 0}
                >
                  Use merged day
                </button>
                <button
                  type="button"
                  className="login-secondary-btn"
                  onClick={handleAvailabilityUseMergedCalendar}
                  disabled={!aggregatedAvailabilitySettings.hasDefaultCapacity && aggregatedAvailabilitySettings.dateOverrides.length === 0}
                >
                  Use merged calendar
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Merged default capacity</p>
                <p className="mt-2 text-sm font-semibold text-stone-900">
                  {aggregatedAvailabilitySettings.hasDefaultCapacity ? aggregatedAvailabilitySettings.defaultMaxCapacity : 'Unavailable by default'}
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Custom blocked or booked days</p>
                <p className="mt-2 text-sm font-semibold text-stone-900">{activeAvailabilitySettings.dateOverrides.length}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Selected day</p>
                <p className="mt-2 text-sm font-semibold text-stone-900">{selectedAvailabilityDateLabel}</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-400">Selected day status</p>
                <p className="mt-2 text-sm font-semibold text-stone-900">{selectedAvailabilityStatus}</p>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
              <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-stone-900">{MONTH_FORMATTER.format(availabilityDisplayMonth)}</h4>
                    <p className="text-sm text-stone-500">Choose a date to edit the VCA availability inherited from your selected vendors.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => setAvailabilityDisplayMonth((current) => addMonths(current, -1))}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => setAvailabilityDisplayMonth((current) => addMonths(current, 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-7 gap-1">
                  {WEEKDAY_LABELS.map((label) => (
                    <div key={label} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                      {label}
                    </div>
                  ))}

                  {availabilityCalendarDays.map((day) => {
                    const dayAvailability = getDayAvailability(activeAvailabilitySettings, day.key);
                    const status = getDayStatus(dayAvailability.maxCapacity, dayAvailability.bookingsCount);
                    const isSelected = day.key === selectedAvailabilityDate;

                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => {
                          setSelectedAvailabilityDate(day.key);
                        }}
                        className={`relative min-h-[92px] rounded-none border px-2 py-2 text-left transition ${getStatusClasses(status, day.isCurrentMonth)} ${isSelected ? 'outline outline-2 outline-slate-900 outline-offset-0 z-10' : ''}`}
                      >
                        <div className="flex items-center justify-center text-center">
                          <span className="inline-flex h-7 w-7 items-center justify-center text-sm font-semibold">
                            {day.date.getDate()}
                          </span>
                        </div>
                        <div className="mt-4 flex items-baseline justify-center gap-1 text-center">
                          <div className="text-xl font-semibold leading-none">{dayAvailability.bookingsCount}</div>
                          <div className="hidden text-[9px] font-semibold uppercase tracking-[0.08em] opacity-70 sm:block">bookings</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
                <div>
                  <h4 className="text-base font-semibold text-stone-900">Selected day</h4>
                  <p className="mt-1 text-sm text-stone-500">{selectedAvailabilityDateLabel}</p>
                </div>

                <div className="grid gap-4">
                  <label className="inline-flex items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={selectedAvailabilityDraft.usesDefaultCapacity && activeAvailabilitySettings.hasDefaultCapacity && !selectedAvailabilityDraft.unavailable}
                      onChange={() => {
                        const nextDraft = {
                          usesDefaultCapacity: true,
                          maxCapacity: String(activeAvailabilitySettings.defaultMaxCapacity),
                          bookingsCount: String(Math.min(sanitizeCount(selectedAvailabilityDraft.bookingsCount, 0), activeAvailabilitySettings.defaultMaxCapacity)),
                          unavailable: false,
                        };
                        updateAvailabilityDraft(nextDraft);
                      }}
                      disabled={!activeAvailabilitySettings.hasDefaultCapacity || selectedAvailabilityDraft.unavailable}
                    />
                    Use default merged capacity
                  </label>

                  <label className="inline-flex items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={selectedAvailabilityDraft.unavailable}
                      onChange={handleAvailabilityToggleUnavailable}
                    />
                    Mark this day unavailable
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">Max capacity</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={selectedAvailabilityDraft.unavailable ? '0' : selectedAvailabilityDraft.maxCapacity}
                        onChange={event => handleAvailabilityCapacityInput(event.target.value)}
                        disabled={selectedAvailabilityDraft.unavailable || selectedAvailabilityDraft.usesDefaultCapacity}
                        className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-300 disabled:bg-stone-100"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">Bookings count</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={selectedAvailabilityDraft.unavailable ? '0' : selectedAvailabilityDraft.bookingsCount}
                        onChange={event => handleAvailabilityBookingsInput(event.target.value)}
                        disabled={selectedAvailabilityDraft.unavailable}
                        className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-300 disabled:bg-stone-100"
                      />
                    </label>
                  </div>

                  <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                    <div>Resolved capacity: <span className="font-semibold text-stone-900">{effectiveAvailabilityDraftCapacity}</span></div>
                    <div>Bookings: <span className="font-semibold text-stone-900">{effectiveAvailabilityDraftBookings}</span></div>
                    <div>Status: <span className="font-semibold text-stone-900">{selectedAvailabilityStatus}</span></div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-stone-200 p-5 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-stone-900">Part 3: Business details</h3>
            <p className="text-sm text-stone-500">Fill in anything the aggregate does not provide, including the phone number used for leads.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">Phone</span>
              <input
                type="text"
                value={currentDraft.phone}
                onChange={event => updateDraft({ phone: event.target.value })}
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-300"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">Website</span>
              <input
                type="url"
                value={currentDraft.website}
                onChange={event => updateDraft({ website: event.target.value })}
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-300"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">Google Maps link</span>
            <input
              type="url"
              value={currentDraft.googleMapsLink}
              onChange={event => updateDraft({ googleMapsLink: event.target.value })}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-300"
            />
          </label>

          <div className="grid gap-4 lg:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">Country</span>
              <input
                type="text"
                value={currentDraft.country}
                onChange={event => updateDraft({ country: event.target.value })}
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-300"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">State</span>
              <input
                type="text"
                value={currentDraft.state}
                onChange={event => updateDraft({ state: event.target.value })}
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-300"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">City</span>
              <input
                type="text"
                value={currentDraft.city}
                onChange={event => updateDraft({ city: event.target.value })}
                className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-300"
              />
            </label>
          </div>
        </div>
          </>
        )}
      </div>
    </section>
  );
}
