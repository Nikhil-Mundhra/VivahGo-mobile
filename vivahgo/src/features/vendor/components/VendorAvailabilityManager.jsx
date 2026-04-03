import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { updateVendorProfile } from '../api.js';
import { buildAvailabilityState, dateKeyFromDate, getDayAvailability, getDayStatus, parseDateKey } from '../../../vendorAvailability';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_FORMATTER = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });
const DATE_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const MAX_CAPACITY = 99;
const SYNC_DELAY_MS = 700;
const AVAILABILITY_TIP_DISMISSED_KEY = 'vendor-availability-tip-dismissed';

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

function getStatusStyles(status, isCurrentMonth) {
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

function buildSelectedDayDraft(availability, dateKey) {
  const day = getDayAvailability(availability, dateKey);
  return {
    usesDefaultCapacity: availability.hasDefaultCapacity && !day.hasOverride,
    maxCapacity: String(day.maxCapacity),
    bookingsCount: String(day.bookingsCount),
    unavailable: day.maxCapacity === 0,
  };
}

function formatBookings(count) {
  return `${count} booking${count === 1 ? '' : 's'}`;
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

export default function VendorAvailabilityManager({ token, vendor, onVendorUpdated }) {
  const [availability, setAvailability] = useState(() => buildAvailabilityState(vendor));
  const [displayMonth, setDisplayMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => dateKeyFromDate(new Date()));
  const [selectedDayDraft, setSelectedDayDraft] = useState(() => buildSelectedDayDraft(buildAvailabilityState(vendor), dateKeyFromDate(new Date())));
  const [isTipDismissed, setIsTipDismissed] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.localStorage.getItem(AVAILABILITY_TIP_DISMISSED_KEY) === 'true';
  });
  const [showCapacityControls, setShowCapacityControls] = useState(false);
  const [savingDay, setSavingDay] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const successTimeoutRef = useRef(null);
  const syncTimeoutRef = useRef(null);
  const selectedDateRef = useRef(selectedDate);

  const todayKey = dateKeyFromDate(new Date());
  const overrideMap = useMemo(
    () => new Map(availability.dateOverrides.map((item) => [item.date, item])),
    [availability.dateOverrides]
  );
  const calendarDays = useMemo(() => buildCalendarDays(displayMonth), [displayMonth]);
  const selectedDateLabel = DATE_FORMATTER.format(parseDateKey(selectedDate));

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setIsTipDismissed(window.localStorage.getItem(AVAILABILITY_TIP_DISMISSED_KEY) === 'true');
  }, []);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    const nextAvailability = buildAvailabilityState(vendor);
    setAvailability(nextAvailability);
    setSelectedDayDraft(buildSelectedDayDraft(nextAvailability, selectedDateRef.current));
  }, [vendor]);

  useEffect(() => {
    const selectedDateObject = parseDateKey(selectedDate);
    setDisplayMonth((current) => {
      if (
        current.getFullYear() === selectedDateObject.getFullYear() &&
        current.getMonth() === selectedDateObject.getMonth()
      ) {
        return current;
      }
      return startOfMonth(selectedDateObject);
    });
  }, [selectedDate]);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  function queueSuccess(message) {
    setSuccessMessage(message);
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }
    successTimeoutRef.current = setTimeout(() => setSuccessMessage(''), 2500);
  }

  function dismissTip() {
    setIsTipDismissed(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AVAILABILITY_TIP_DISMISSED_KEY, 'true');
    }
  }

  const persistAvailability = useCallback(async (nextAvailability, successCopy) => {
    const data = await updateVendorProfile(token, { availabilitySettings: nextAvailability });
    const normalized = buildAvailabilityState(data.vendor);
    setAvailability(normalized);
    setSelectedDayDraft(buildSelectedDayDraft(normalized, selectedDateRef.current));
    onVendorUpdated?.(data.vendor);
    queueSuccess(successCopy);
  }, [onVendorUpdated, token]);

  function handleToggleUnavailable() {
    setSelectedDayDraft((current) => {
      if (current.unavailable) {
        const restoredCapacity = availability.hasDefaultCapacity && current.usesDefaultCapacity
          ? availability.defaultMaxCapacity
          : Math.max(0, sanitizeCount(current.maxCapacity, 0));
        return {
          ...current,
          unavailable: false,
          maxCapacity: String(restoredCapacity),
        };
      }

      return {
        ...current,
        usesDefaultCapacity: false,
        unavailable: true,
        maxCapacity: '0',
        bookingsCount: '0',
      };
    });
  }

  function handleCapacityInput(rawValue) {
    if (!/^\d*$/.test(rawValue)) {
      return;
    }

    setSelectedDayDraft((current) => {
      const nextCapacity = rawValue === '' ? '' : String(Math.min(MAX_CAPACITY, Number(rawValue)));
      const currentBookings = sanitizeCount(current.bookingsCount, 0);
      const parsedCapacity = nextCapacity === '' ? 0 : Number(nextCapacity);
      return {
        ...current,
        usesDefaultCapacity: false,
        unavailable: false,
        maxCapacity: nextCapacity,
        bookingsCount: String(Math.min(currentBookings, parsedCapacity)),
      };
    });
  }

  function handleBookingsInput(rawValue) {
    if (!/^\d*$/.test(rawValue)) {
      return;
    }

    setSelectedDayDraft((current) => {
      const nextBookings = rawValue === '' ? '' : rawValue;
      const capacityLimit = current.unavailable
        ? 0
        : current.usesDefaultCapacity && availability.hasDefaultCapacity
          ? availability.defaultMaxCapacity
          : sanitizeCount(current.maxCapacity, 0);
      const parsedBookings = nextBookings === '' ? 0 : Number(nextBookings);

      return {
        ...current,
        bookingsCount: String(Math.min(capacityLimit, Math.min(MAX_CAPACITY, parsedBookings))),
      };
    });
  }

  function incrementCapacity(delta) {
    setSelectedDayDraft((current) => {
      const currentCapacity = sanitizeCount(current.maxCapacity, 0);
      const nextCapacity = Math.max(0, Math.min(MAX_CAPACITY, currentCapacity + delta));
      const nextBookings = Math.min(sanitizeCount(current.bookingsCount, 0), nextCapacity);

      return {
        ...current,
        usesDefaultCapacity: false,
        unavailable: nextCapacity === 0,
        maxCapacity: String(nextCapacity),
        bookingsCount: String(nextCapacity === 0 ? 0 : nextBookings),
      };
    });
  }

  function incrementBookings(delta) {
    setSelectedDayDraft((current) => {
      const capacityLimit = current.unavailable
        ? 0
        : current.usesDefaultCapacity && availability.hasDefaultCapacity
          ? availability.defaultMaxCapacity
          : sanitizeCount(current.maxCapacity, 0);
      const currentBookings = sanitizeCount(current.bookingsCount, 0);
      const nextBookings = Math.max(0, Math.min(capacityLimit, currentBookings + delta));

      return {
        ...current,
        bookingsCount: String(nextBookings),
      };
    });
  }

  function jumpToDate(dateKey) {
    setSelectedDate(dateKey);
    setSelectedDayDraft(buildSelectedDayDraft(availability, dateKey));
    setDisplayMonth(startOfMonth(parseDateKey(dateKey)));
  }

  useEffect(() => {
    const hasTransientBlankInput = !selectedDayDraft.unavailable && (
      (!selectedDayDraft.usesDefaultCapacity && selectedDayDraft.maxCapacity === '') ||
      selectedDayDraft.bookingsCount === ''
    );

    if (hasTransientBlankInput) {
      return undefined;
    }

    const baselineDraft = buildSelectedDayDraft(availability, selectedDate);
    if (JSON.stringify(baselineDraft) === JSON.stringify(selectedDayDraft)) {
      return undefined;
    }

    const nextAvailability = buildNextAvailabilityForDate(availability, selectedDate, selectedDayDraft);

    syncTimeoutRef.current = setTimeout(async () => {
      setError('');
      setSavingDay(true);
      try {
        await persistAvailability(nextAvailability, `Availability synced for ${selectedDateLabel}.`);
      } catch (err) {
        setError(err.message || 'Could not sync the day changes.');
      } finally {
        setSavingDay(false);
      }
    }, SYNC_DELAY_MS);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [availability, persistAvailability, selectedDate, selectedDateLabel, selectedDayDraft]);

  const effectiveDraftCapacity = selectedDayDraft.unavailable
    ? 0
    : selectedDayDraft.usesDefaultCapacity && availability.hasDefaultCapacity
      ? availability.defaultMaxCapacity
      : sanitizeCount(selectedDayDraft.maxCapacity, 0);
  const effectiveDraftBookings = effectiveDraftCapacity > 0
    ? Math.min(sanitizeCount(selectedDayDraft.bookingsCount, 0), effectiveDraftCapacity)
    : 0;
  const selectedStatus = getDayStatus(effectiveDraftCapacity, effectiveDraftBookings);
  const selectedStatusClasses = selectedStatus === 'open'
    ? 'bg-emerald-50 text-emerald-800'
    : selectedStatus === 'partial'
      ? 'bg-amber-100 text-amber-900'
      : selectedStatus === 'near-full'
        ? 'bg-orange-200 text-orange-900'
      : selectedStatus === 'full'
        ? 'bg-rose-200 text-rose-800'
        : 'border border-gray-400 bg-gray-200 text-gray-700';
  const selectedStatusLabel = selectedStatus === 'open'
    ? formatBookings(effectiveDraftBookings)
    : selectedStatus === 'partial'
      ? formatBookings(effectiveDraftBookings)
      : selectedStatus === 'full'
        ? formatBookings(effectiveDraftBookings)
        : 'Not available';

  return (
    <div className="space-y-5">
      {!isTipDismissed && (
        <div className="relative rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3 pr-8 text-sm text-amber-900">
          <p className="pr-2">
            Set day-specific capacity and track bookings for each date. Days shift from green to amber to orange to rose as they fill up, with gray for unavailable.
          </p>
          <button
            type="button"
            onClick={dismissTip}
            className="absolute right-3 top-3 bg-transparent p-0 text-sm font-semibold leading-none text-amber-800 shadow-none outline-none appearance-none"
            aria-label="Dismiss availability tip"
          >
            x
          </button>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">{MONTH_FORMATTER.format(displayMonth)}</h3>
              <p className="text-sm text-gray-500">Tap any date to update bookings and capacity for that day.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                onClick={() => setDisplayMonth((current) => addMonths(current, -1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                onClick={() => setDisplayMonth((current) => addMonths(current, 1))}
              >
                Next
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                {label}
              </div>
            ))}

            {calendarDays.map((day) => {
              const dayAvailability = overrideMap.get(day.key) || getDayAvailability(availability, day.key);
              const status = getDayStatus(dayAvailability.maxCapacity, dayAvailability.bookingsCount);
              const isSelected = day.key === selectedDate;
              const todayClasses = day.key === todayKey ? 'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7)]' : '';
              const selectedClasses = isSelected ? 'outline outline-3 outline-slate-900 outline-offset-0 z-10' : '';

              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => jumpToDate(day.key)}
                  className={`relative min-h-[92px] rounded-none border px-2 py-2 text-left transition ${getStatusStyles(status, day.isCurrentMonth)} ${todayClasses} ${selectedClasses}`}
                >
                  <div className="flex items-center justify-center text-center">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center text-sm font-semibold ${
                        day.key === todayKey ? 'rounded-full bg-emerald-600 text-white shadow-sm' : ''
                      }`}
                      aria-label={day.key === todayKey ? 'Today' : undefined}
                    >
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

          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-3 py-1.5 text-emerald-800">
              0 bookings
            </span>
            <span className="inline-flex items-center rounded-md bg-amber-100 px-3 py-1.5 text-amber-900">
              Some bookings
            </span>
            <span className="inline-flex items-center rounded-md bg-orange-200 px-3 py-1.5 text-orange-900">
              Near capacity
            </span>
            <span className="inline-flex items-center rounded-md bg-rose-200 px-3 py-1.5 text-rose-800">
              Fully booked
            </span>
            <span className="inline-flex items-center rounded-md border border-gray-400 bg-gray-200 px-3 py-1.5 text-gray-700">
              Unavailable
            </span>
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Selected Day</h3>
                <p className="mt-1 text-sm text-gray-500">{selectedDateLabel}</p>
              </div>
              <span className={`rounded-md px-3 py-1 text-xs font-semibold ${selectedStatusClasses}`}>
                {selectedStatusLabel}
              </span>
            </div>

            {!availability.hasDefaultCapacity && (
              <div className="mt-4 overflow-hidden rounded-md border border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCapacityControls((current) => !current)}
                  className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left transition hover:bg-gray-100"
                >
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">Capacity options</span>
                    <span className="block text-sm text-gray-500">This vendor uses day-by-day capacity only.</span>
                  </span>
                  <span className="text-lg font-semibold text-gray-500">{showCapacityControls ? '-' : '+'}</span>
                </button>

                {showCapacityControls && (
                  <div className="space-y-3 border-t border-gray-200 bg-white p-4">
                    <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                      Default capacity is turned off in Business Details. Set this day manually below.
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleToggleUnavailable}
              className={`mt-4 inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold transition ${selectedDayDraft.unavailable ? 'bg-red-600 text-white hover:bg-red-700' : 'border border-gray-200 bg-white text-gray-700 hover:border-red-200 hover:text-red-700'}`}
            >
              {selectedDayDraft.unavailable ? 'Unavailable' : 'Mark Unavailable'}
            </button>

            {!availability.hasDefaultCapacity && (
              <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Set Capacity</span>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => incrementCapacity(-1)}
                        disabled={selectedDayDraft.unavailable}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-white text-lg font-semibold text-gray-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                        aria-label="Decrease capacity"
                      >
                        -
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={selectedDayDraft.maxCapacity}
                        onChange={(event) => handleCapacityInput(event.target.value)}
                        disabled={selectedDayDraft.unavailable}
                        className="w-full rounded-md border border-gray-200 bg-white px-4 py-3 text-center text-lg font-semibold text-gray-900 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                      />
                      <button
                        type="button"
                        onClick={() => incrementCapacity(1)}
                        disabled={selectedDayDraft.unavailable || sanitizeCount(selectedDayDraft.maxCapacity, 0) >= MAX_CAPACITY}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-900 bg-slate-900 text-lg font-semibold text-white transition hover:bg-slate-950 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
                        aria-label="Increase capacity"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-500">Default value: 0</p>
              </div>
            )}

            {!selectedDayDraft.unavailable && (
              <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Number of Bookings</span>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => incrementBookings(-1)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-white text-lg font-semibold text-gray-700 transition hover:border-slate-300 hover:text-slate-900"
                        aria-label="Decrease bookings"
                      >
                        -
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={selectedDayDraft.bookingsCount}
                        onChange={(event) => handleBookingsInput(event.target.value)}
                        className="w-full rounded-md border border-gray-200 bg-white px-4 py-3 text-center text-lg font-semibold text-gray-900 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                      />
                      <button
                        type="button"
                        onClick={() => incrementBookings(1)}
                        disabled={effectiveDraftBookings >= effectiveDraftCapacity}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-900 bg-slate-900 text-lg font-semibold text-white transition hover:bg-slate-950 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
                        aria-label="Increase bookings"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  {availability.hasDefaultCapacity
                    ? `Bookings are capped at your default capacity of ${availability.defaultMaxCapacity}.`
                    : 'Bookings are capped at the set capacity for the day.'}
                </p>
              </div>
            )}

            <div className="mt-4 text-sm">
              {savingDay ? (
                <p className="font-medium text-slate-600">Syncing changes...</p>
              ) : (
                <p className="text-gray-500">Changes sync automatically.</p>
              )}
            </div>
          </div>
        </section>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      {successMessage && <p className="text-sm font-medium text-emerald-600">{successMessage}</p>}
    </div>
  );
}
