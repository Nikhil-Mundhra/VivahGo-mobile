import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchAdminChoiceProfiles, fetchPresignedUrl, updateAdminChoiceProfile } from '../api';
import { FallbackImage, FallbackVideo } from './MediaWithFallback';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function buildDraft(profile) {
  return {
    type: profile?.type || '',
    name: profile?.name || '',
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
    sourceVendorIds: Array.isArray(profile?.sourceVendorIds) ? profile.sourceVendorIds : [],
    selectedMedia: Array.isArray(profile?.selectedMedia) ? profile.selectedMedia : [],
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
  const [selectedType, setSelectedType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [savingType, setSavingType] = useState('');
  const [uploading, setUploading] = useState(false);

  const approvedVendors = useMemo(
    () => (Array.isArray(vendors) ? vendors : []).filter(vendor => vendor?.isApproved),
    [vendors]
  );

  useEffect(() => {
    if (!token) {
      setChoiceProfiles([]);
      setDrafts({});
      setSelectedType('');
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
        setDrafts(Object.fromEntries(profiles.map(profile => [profile.type, buildDraft(profile)])));
        setSelectedType((current) => (
          profiles.some(profile => profile.type === current)
            ? current
            : (profiles[0]?.type || '')
        ));
      })
      .catch((nextError) => {
        if (!cancelled) {
          setChoiceProfiles([]);
          setDrafts({});
          setSelectedType('');
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

  const currentProfile = useMemo(
    () => choiceProfiles.find(profile => profile.type === selectedType) || null,
    [choiceProfiles, selectedType]
  );
  const currentDraft = selectedType ? drafts[selectedType] || buildDraft(currentProfile) : null;
  const vendorsForType = useMemo(
    () => approvedVendors.filter(vendor => vendor.type === selectedType),
    [approvedVendors, selectedType]
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

  function updateDraft(patch) {
    if (!currentDraft?.type) {
      return;
    }
    setDrafts(current => ({
      ...current,
      [currentDraft.type]: {
        ...currentDraft,
        ...patch,
      },
    }));
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

        const presigned = await fetchPresignedUrl(token, {
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
        type: currentDraft.type,
        name: currentDraft.name,
        subType: currentDraft.subType,
        description: currentDraft.description,
        services: currentDraft.services,
        bundledServices: currentDraft.bundledServices,
        country: currentDraft.country,
        state: currentDraft.state,
        city: currentDraft.city,
        googleMapsLink: currentDraft.googleMapsLink,
        phone: currentDraft.phone,
        website: currentDraft.website,
        budgetRange: serializeBudgetRange(currentDraft.budgetRange) || aggregatedBudgetRange,
        sourceVendorIds: currentDraft.sourceVendorIds,
        selectedMedia: currentDraft.selectedMedia.map(item => (
          item.sourceType === 'vendor'
            ? {
              sourceType: 'vendor',
              vendorId: item.vendorId,
              sourceMediaId: item.sourceMediaId,
              isVisible: item.isVisible !== false,
            }
            : {
              sourceType: 'admin',
              key: item.key,
              url: item.url,
              type: item.type,
              filename: item.filename,
              size: item.size,
              caption: item.caption,
              altText: item.altText,
              isVisible: item.isVisible !== false,
            }
        )),
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
      setDrafts(current => ({
        ...current,
        [savedProfile.type]: buildDraft(savedProfile),
      }));
      setMessage(`${savedProfile.name} saved.`);
    } catch (nextError) {
      setError(nextError.message || 'Could not save Choice profile.');
    } finally {
      setSavingType('');
    }
  }

  if (loading) {
    return (
      <section className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-10 text-sm text-stone-500">Loading Choice profiles...</div>
      </section>
    );
  }

  if (!currentDraft) {
    return (
      <section className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-10 text-sm text-stone-500">No approved vendor categories are ready for Choice curation yet.</div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-200 space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Choice profiles</h2>
          <p className="text-sm text-stone-500">Curate one VivahGo-managed profile per category by combining approved vendor assets, services, and pricing.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">Choice account</span>
            <select
              value={selectedType}
              onChange={event => {
                setSelectedType(event.target.value);
                setError('');
                setMessage('');
              }}
              className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-300"
            >
              {choiceProfiles.map(profile => (
                <option key={profile.type} value={profile.type}>{profile.name}</option>
              ))}
            </select>
          </label>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
            <div>{vendorsForType.length} approved vendors</div>
            <div>{currentDraft.selectedMedia.length} selected assets</div>
          </div>
          <button
            type="button"
            className="login-secondary-btn"
            onClick={handleSave}
            disabled={!access?.canManageVendors || savingType === currentDraft.type || uploading}
          >
            {savingType === currentDraft.type ? 'Saving...' : 'Save Choice Profile'}
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
        <div className="rounded-3xl border border-stone-200 bg-stone-50/70 p-5 space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-semibold text-stone-900">Part 1: Resource pool and media manager</h3>
              <p className="text-sm text-stone-500">Choose which approved vendors shape the aggregate and which photos or videos appear on the Choice profile.</p>
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
      </div>
    </section>
  );
}
