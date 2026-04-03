import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchPresignedUrl, removeVendorMedia, saveVendorMedia, updateVendorMedia } from '../api.js';
import { FallbackImage, FallbackVideo } from '../../../components/MediaWithFallback';
import VendorVerificationManager from './VendorVerificationManager';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

function getMediaType(file) {
  return file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
}

function formatFileSize(size) {
  if (!size) {
    return '0 MB';
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function sortMedia(media) {
  return [...(Array.isArray(media) ? media : [])].sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0));
}

function buildDraftMap(media) {
  return Object.fromEntries(
    sortMedia(media).map(item => [
      item._id,
      {
        caption: item.caption || '',
        altText: item.altText || '',
      },
    ])
  );
}

function MediaPreview({ item }) {
  if (item.type === 'VIDEO') {
    return (
      <FallbackVideo
        src={item.url}
        preload="metadata"
        controls
        className="w-full h-full object-cover"
        aria-label={item.filename || 'Portfolio video'}
      />
    );
  }

  return (
    <FallbackImage
      src={item.url}
      alt={item.altText || item.filename || 'Portfolio image'}
      loading="lazy"
      className="w-full h-full object-cover"
    />
  );
}

export default function VendorPortfolioManager({ token, vendor, media, onVendorUpdated }) {
  const [fileItems, setFileItems] = useState([]);
  const [drafts, setDrafts] = useState(() => buildDraftMap(media));
  const [busyIds, setBusyIds] = useState({});
  const [portfolioError, setPortfolioError] = useState('');
  const [queueError, setQueueError] = useState('');
  const [showUploadSection, setShowUploadSection] = useState(false);
  const inputRef = useRef(null);

  const sortedMedia = useMemo(() => sortMedia(media), [media]);
  const visibleCount = sortedMedia.filter(item => item.isVisible !== false).length;
  const hiddenCount = sortedMedia.length - visibleCount;
  const coverItem = sortedMedia.find(item => item.isCover) || sortedMedia[0] || null;

  useEffect(() => {
    setDrafts(buildDraftMap(media));
  }, [media]);

  function setBusy(mediaId, isBusy) {
    setBusyIds(prev => ({ ...prev, [mediaId]: isBusy }));
  }

  function updateItem(id, patch) {
    setFileItems(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));
  }

  function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    setQueueError('');

    const newItems = files.map(file => ({
      file,
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      status: 'pending',
      progress: 0,
      error: '',
    }));

    setFileItems(prev => [...prev, ...newItems]);
    if (files.length > 0) {
      setShowUploadSection(true);
    }
  }

  async function uploadFile(item) {
    const { file, id } = item;

    if (file.size > MAX_FILE_SIZE) {
      updateItem(id, { status: 'error', error: 'File exceeds the 50 MB size limit.' });
      return;
    }

    updateItem(id, { status: 'uploading', progress: 0, error: '' });

    let presignedData;
    try {
      presignedData = await fetchPresignedUrl(token, {
        filename: file.name,
        contentType: file.type,
        size: file.size,
      });
    } catch (err) {
      updateItem(id, { status: 'error', error: err.message || 'Failed to get upload URL.' });
      return;
    }

    await new Promise(resolve => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', presignedData.uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);

      xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
          updateItem(id, { progress: Math.round((e.loaded / e.total) * 100) });
        }
      };

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          updateItem(id, { progress: 100 });
          try {
            const data = await saveVendorMedia(token, {
              key: presignedData.key,
              url: presignedData.publicUrl,
              type: getMediaType(file),
              filename: file.name,
              size: file.size,
              altText: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
            });
            updateItem(id, { status: 'done' });
            onVendorUpdated?.(data.vendor);
          } catch (err) {
            updateItem(id, { status: 'error', error: err.message || 'Failed to save media record.' });
          }
        } else {
          updateItem(id, { status: 'error', error: `Upload failed (HTTP ${xhr.status}).` });
        }
        resolve();
      };

      xhr.onerror = () => {
        updateItem(id, { status: 'error', error: 'Network error during upload.' });
        resolve();
      };

      xhr.send(file);
    });
  }

  async function uploadAll() {
    const pending = fileItems.filter(item => item.status === 'pending');
    for (const item of pending) {
      // Sequential uploads keep progress and server ordering predictable.
      await uploadFile(item);
    }
  }

  function removeQueuedItem(id) {
    setFileItems(prev => prev.filter(item => item.id !== id));
  }

  function updateDraft(mediaId, patch) {
    setDrafts(prev => ({
      ...prev,
      [mediaId]: {
        caption: prev[mediaId]?.caption || '',
        altText: prev[mediaId]?.altText || '',
        ...patch,
      },
    }));
  }

  async function saveDraft(mediaId) {
    const draft = drafts[mediaId];
    if (!draft) {
      return;
    }

    setPortfolioError('');
    setBusy(mediaId, true);
    try {
      const data = await updateVendorMedia(token, {
        mediaId,
        caption: draft.caption,
        altText: draft.altText,
      });
      onVendorUpdated?.(data.vendor);
    } catch (err) {
      setPortfolioError(err.message || 'Could not save media details.');
    } finally {
      setBusy(mediaId, false);
    }
  }

  async function updateMedia(mediaId, payload, fallbackMessage) {
    setPortfolioError('');
    setBusy(mediaId, true);
    try {
      const data = await updateVendorMedia(token, { mediaId, ...payload });
      onVendorUpdated?.(data.vendor);
    } catch (err) {
      setPortfolioError(err.message || fallbackMessage);
    } finally {
      setBusy(mediaId, false);
    }
  }

  async function handleReorder(mediaId, direction) {
    const index = sortedMedia.findIndex(item => item._id === mediaId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= sortedMedia.length) {
      return;
    }

    const nextOrder = [...sortedMedia];
    const [item] = nextOrder.splice(index, 1);
    nextOrder.splice(targetIndex, 0, item);

    setPortfolioError('');
    setBusy(mediaId, true);
    try {
      const data = await updateVendorMedia(token, {
        mediaIds: nextOrder.map(entry => entry._id),
      });
      onVendorUpdated?.(data.vendor);
    } catch (err) {
      setPortfolioError(err.message || 'Could not reorder portfolio items.');
    } finally {
      setBusy(mediaId, false);
    }
  }

  async function handleRemove(mediaId) {
    setPortfolioError('');
    setBusy(mediaId, true);
    try {
      const data = await removeVendorMedia(token, mediaId);
      onVendorUpdated?.(data.vendor);
    } catch (err) {
      setPortfolioError(err.message || 'Could not remove media item.');
    } finally {
      setBusy(mediaId, false);
    }
  }

  const pendingCount = fileItems.filter(item => item.status === 'pending').length;
  const uploadingCount = fileItems.filter(item => item.status === 'uploading').length;

  return (
    <div className="space-y-6">
      <VendorVerificationManager token={token} vendor={vendor} onVendorUpdated={onVendorUpdated} />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">Portfolio</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{sortedMedia.length}</p>
          <p className="text-sm text-gray-500">Total uploaded items</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Live Now</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{visibleCount}</p>
          <p className="text-sm text-gray-500">Visible in your public portfolio</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">Cover</p>
          <p className="mt-2 text-sm font-semibold text-gray-900 truncate">{coverItem?.filename || 'Not set yet'}</p>
          <p className="text-sm text-gray-500">{hiddenCount > 0 ? `${hiddenCount} hidden item${hiddenCount === 1 ? '' : 's'}` : 'Everything is currently visible'}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="w-full text-center">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 border-0 bg-transparent p-0 text-center text-base font-semibold text-gray-900 shadow-none"
              onClick={() => setShowUploadSection(current => !current)}
              aria-expanded={showUploadSection}
            >
              <span>Upload New Work</span>
              <span className="text-sm text-gray-400">{showUploadSection ? '−' : '+'}</span>
            </button>
            <p className="text-sm text-gray-500">Add photos and videos, then fine-tune how they appear in your portfolio.</p>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFilesSelected}
        />

        {showUploadSection && (
          <div
            className="mt-4 rounded-2xl border-2 border-dashed border-gray-200 bg-white p-5 text-center sm:p-6"
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
          >
            <p className="text-sm font-medium text-gray-700">Tap to choose images or videos</p>
            <p className="mt-1 text-xs text-gray-400">JPG, PNG, WebP, MP4 and more. Max 50 MB per file.</p>
          </div>
        )}

        {queueError && (
          <p className="mt-3 text-sm text-red-600" role="alert">{queueError}</p>
        )}

        {showUploadSection && fileItems.length > 0 && (
          <ul className="mt-4 space-y-2" aria-label="Selected files">
            {fileItems.map(item => (
              <li key={item.id} className="flex flex-col gap-3 rounded-xl bg-white p-3 shadow-sm sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{item.file.name}</p>
                  <p className="text-xs text-gray-400 break-words">
                    {formatFileSize(item.file.size)} · {getMediaType(item.file)}
                  </p>
                  {item.status === 'uploading' && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full rounded-full bg-rose-500 transition-all duration-200" style={{ width: `${item.progress}%` }} />
                    </div>
                  )}
                  {item.status === 'error' && (
                    <p className="mt-1 text-xs text-red-600">{item.error}</p>
                  )}
                </div>

                <div className="flex flex-col gap-2 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between sm:shrink-0 sm:justify-end">
                  {item.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => uploadFile(item)}
                      className="min-h-10 w-full rounded-full bg-rose-500 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-rose-600 min-[360px]:w-auto"
                    >
                      Upload
                    </button>
                  )}
                  {item.status === 'uploading' && (
                    <span className="min-w-10 text-xs text-gray-400 min-[360px]:text-right">{item.progress}%</span>
                  )}
                  {item.status === 'done' && (
                    <span className="text-xs font-medium text-green-600">Uploaded</span>
                  )}
                  {item.status !== 'uploading' && (
                    <button
                      type="button"
                      onClick={() => removeQueuedItem(item.id)}
                      className="flex min-h-10 min-w-10 items-center justify-center rounded-full text-sm text-gray-400 transition-colors hover:text-red-500"
                      aria-label={`Remove ${item.file.name}`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {showUploadSection && pendingCount > 0 && uploadingCount === 0 && (
          <button
            type="button"
            onClick={uploadAll}
            className="mt-4 w-full rounded-xl bg-gray-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            Upload {pendingCount} pending {pendingCount === 1 ? 'file' : 'files'}
          </button>
        )}
      </div>

      {portfolioError && (
        <p className="text-sm text-red-600" role="alert">{portfolioError}</p>
      )}

      {sortedMedia.length === 0 ? (
        <p className="rounded-2xl border border-gray-100 bg-white py-10 text-center text-sm text-gray-400">
          No portfolio items yet. Upload your best work to start building your showcase.
        </p>
      ) : (
        <div className="space-y-4">
          {sortedMedia.map((item, index) => {
            const draft = drafts[item._id] || { caption: '', altText: '' };
            const isBusy = Boolean(busyIds[item._id]);
            const isFirst = index === 0;
            const isLast = index === sortedMedia.length - 1;

            return (
              <div key={item._id} className="grid gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-2xl bg-gray-100 aspect-square">
                  <MediaPreview item={item} />
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{item.type}</span>
                    {item.isCover && <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-600">Cover</span>}
                    {item.isVisible === false && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">Hidden</span>}
                    <span className="text-xs text-gray-400">{item.filename || 'Untitled file'} · {formatFileSize(item.size)}</span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-gray-400">Caption</span>
                      <input
                        type="text"
                        value={draft.caption}
                        onChange={event => updateDraft(item._id, { caption: event.target.value })}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-black outline-none transition placeholder:text-gray-500 focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                        placeholder="Describe this setup or shoot"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-gray-400">Alt Text</span>
                      <input
                        type="text"
                        value={draft.altText}
                        onChange={event => updateDraft(item._id, { altText: event.target.value })}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-black outline-none transition placeholder:text-gray-500 focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                        placeholder="Helpful accessibility description"
                      />
                    </label>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => saveDraft(item._id)}
                      disabled={isBusy}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-black transition-colors hover:border-rose-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      Save Details
                    </button>
                    <button
                      type="button"
                      onClick={() => updateMedia(item._id, { makeCover: true }, 'Could not update the cover image.')}
                      disabled={isBusy || item.isCover}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-black transition-colors hover:border-rose-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      {item.isCover ? 'Current Cover' : 'Make Cover'}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateMedia(item._id, { isVisible: item.isVisible === false }, 'Could not update visibility.')}
                      disabled={isBusy}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-black transition-colors hover:border-rose-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      {item.isVisible === false ? 'Show Publicly' : 'Hide From Public'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReorder(item._id, -1)}
                      disabled={isBusy || isFirst}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-black transition-colors hover:border-rose-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      Move Up
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReorder(item._id, 1)}
                      disabled={isBusy || isLast}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-black transition-colors hover:border-rose-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      Move Down
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(item._id)}
                      disabled={isBusy}
                      className="w-full rounded-xl border border-red-200 bg-white px-3.5 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:border-red-100 disabled:bg-gray-100 disabled:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
