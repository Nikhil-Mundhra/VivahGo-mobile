import { useRef, useState } from 'react';
import { fetchPresignedUrl, saveVendorMedia } from '../api';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

function getMediaType(file) {
  return file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
}

export default function VendorPortfolioManager({ token, onMediaAdded }) {
  const [fileItems, setFileItems] = useState([]);
  const inputRef = useRef(null);

  function updateItem(id, patch) {
    setFileItems(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));
  }

  function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    // Reset input so the same file can be re-selected if needed
    e.target.value = '';

    const newItems = files.map(file => ({
      file,
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      status: 'pending', // pending | uploading | done | error
      progress: 0,
      error: '',
    }));

    setFileItems(prev => [...prev, ...newItems]);
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

    // Upload directly from client to R2 via XHR — file never passes through Vercel.
    // XHR is used instead of fetch because only XHR exposes upload.onprogress events.
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
              sortOrder: 0,
              filename: file.name,
              size: file.size,
            });
            updateItem(id, { status: 'done' });
            if (onMediaAdded) { onMediaAdded(data.vendor); }
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
      await uploadFile(item);
    }
  }

  function removeItem(id) {
    setFileItems(prev => prev.filter(item => item.id !== id));
  }

  const pendingCount = fileItems.filter(item => item.status === 'pending').length;
  const uploadingCount = fileItems.filter(item => item.status === 'uploading').length;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <button
        type="button"
        className="w-full border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-rose-300 hover:bg-rose-50 transition-colors"
        onClick={() => inputRef.current?.click()}
        aria-label="Select images or videos to upload"
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFilesSelected}
        />
        <svg className="w-8 h-8 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
        </svg>
        <p className="text-sm font-medium text-gray-600">Click to select images or videos</p>
        <p className="text-xs text-gray-400 mt-1">Max 50 MB per file</p>
      </button>

      {/* File list */}
      {fileItems.length > 0 && (
        <ul className="space-y-2" aria-label="Selected files">
          {fileItems.map(item => (
            <li key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{item.file.name}</p>
                <p className="text-xs text-gray-400">
                  {(item.file.size / 1024 / 1024).toFixed(1)} MB · {getMediaType(item.file)}
                </p>

                {item.status === 'uploading' && (
                  <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden" role="progressbar" aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100}>
                    <div
                      className="h-full bg-rose-500 rounded-full transition-all duration-200"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}

                {item.status === 'error' && (
                  <p className="text-xs text-red-600 mt-0.5" role="alert">{item.error}</p>
                )}
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {item.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => uploadFile(item)}
                    className="text-xs bg-rose-500 text-white px-3 py-1 rounded-full hover:bg-rose-600 transition-colors"
                  >
                    Upload
                  </button>
                )}
                {item.status === 'uploading' && (
                  <span className="text-xs text-gray-400">{item.progress}%</span>
                )}
                {item.status === 'done' && (
                  <span className="text-xs text-green-600 font-medium">✓ Done</span>
                )}
                {item.status !== 'uploading' && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    aria-label={`Remove ${item.file.name}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Upload all button */}
      {pendingCount > 0 && uploadingCount === 0 && (
        <button
          type="button"
          onClick={uploadAll}
          className="w-full bg-rose-500 text-white font-medium py-2.5 rounded-xl hover:bg-rose-600 transition-colors"
        >
          Upload {pendingCount} {pendingCount === 1 ? 'file' : 'files'}
        </button>
      )}
    </div>
  );
}
