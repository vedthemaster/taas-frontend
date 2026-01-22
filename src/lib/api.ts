import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

// Handle auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('token');
                window.location.href = '/';
            }
        }
        return Promise.reject(error);
    }
);

// Auth API - Google Sign-In
export const authApi = {
    // Sign in with Google ID token
    googleSignIn: (credential: string) =>
        api.post('/auth/google', { credential }),

    getMe: () => api.get('/auth/me'),
};

// Telegram API
export const telegramApi = {
    setup: (botToken: string, channelId: string) =>
        api.post('/telegram/setup', { botToken, channelId }),

    skipSetup: () =>
        api.post('/telegram/skip'),

    getStatus: () => api.get('/telegram/status'),

    validate: () => api.post('/telegram/validate'),
};

// Bot Management API
export const botApi = {
    getAll: () => api.get('/bots'),

    add: (botToken: string, channelId?: string) =>
        api.post('/bots', { botToken, channelId }),

    remove: (botId: string) => api.delete(`/bots/${botId}`),

    updateChannel: (channelId: string) =>
        api.put('/bots/channel', { channelId }),
};

// Channel Management API (for multi-channel throughput)
export const channelApi = {
    getAll: () => api.get('/channels'),

    add: (channelId: string, name?: string) =>
        api.post('/channels', { channelId, name }),

    update: (id: string, data: { name?: string; isActive?: boolean }) =>
        api.patch(`/channels/${id}`, data),

    remove: (id: string) => api.delete(`/channels/${id}`),
};


// Folder API
export const folderApi = {
    getAll: (parentId?: string) =>
        api.get('/folders', { params: { parentId } }),

    getById: (id: string) => api.get(`/folders/${id}`),

    getTree: () => api.get('/folders/tree'),

    create: (name: string, parentId?: string) =>
        api.post('/folders', { name, parentId }),

    update: (id: string, name: string) =>
        api.put(`/folders/${id}`, { name }),

    move: (id: string, targetParentId: string | null) =>
        api.patch(`/folders/${id}/move`, { targetParentId }),

    delete: (id: string) => api.delete(`/folders/${id}`),
};

// File API
export const fileApi = {
    getAll: (folderId?: string, search?: string, sortBy?: string, sortOrder?: string) =>
        api.get('/files', { params: { folderId, search, sortBy, sortOrder } }),

    getById: (id: string) => api.get(`/files/${id}`),

    upload: (file: File, folderId?: string) => {
        const formData = new FormData();
        formData.append('file', file);
        if (folderId) {
            formData.append('folderId', folderId);
        }
        return api.post('/files/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },

    download: (id: string) =>
        api.get(`/files/${id}/download`, { responseType: 'blob' }),

    move: (id: string, targetFolderId: string | null) =>
        api.patch(`/files/${id}/move`, { targetFolderId }),

    delete: (id: string) => api.delete(`/files/${id}`),
};

// Chunked upload constants
export const CHUNK_SIZE = 19 * 1024 * 1024; // 19 MB (Telegram download limit is 20MB)
export const CHUNK_THRESHOLD = 19 * 1024 * 1024; // 19 MB - all files >19MB get chunked

// Chunked upload API
export const chunkedUploadApi = {
    // Initialize a chunked upload
    initUpload: (filename: string, size: number, mimeType: string, folderId?: string) =>
        api.post('/files/upload/init', { filename, size, mimeType, folderId }),

    // Upload a single chunk with progress tracking
    uploadChunk: (
        uploadId: string,
        chunk: Blob,
        chunkIndex: number,
        onProgress?: (loaded: number, total: number) => void
    ): Promise<any> => {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('chunk', chunk);
            formData.append('chunkIndex', chunkIndex.toString());

            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${API_URL}/files/upload/chunk/${uploadId}`);

            // Add auth token
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable && onProgress) {
                    onProgress(event.loaded, event.total);
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    reject(new Error(xhr.responseText || 'Upload failed'));
                }
            };

            xhr.onerror = () => reject(new Error('Network error'));
            xhr.send(formData);
        });
    },

    // Complete the chunked upload
    completeUpload: (uploadId: string) =>
        api.post(`/files/upload/complete/${uploadId}`),

    // Cancel/abort an upload
    cancelUpload: (uploadId: string) =>
        api.delete(`/files/upload/${uploadId}`),

    // Download chunked file with progress
    downloadChunked: (
        fileId: string,
        onProgress?: (loaded: number, total: number) => void
    ): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', `${API_URL}/files/${fileId}/download/stream`);
            xhr.responseType = 'blob';

            // Add auth token
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }

            xhr.onprogress = (event) => {
                if (event.lengthComputable && onProgress) {
                    onProgress(event.loaded, event.total);
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(xhr.response);
                } else {
                    reject(new Error('Download failed'));
                }
            };

            xhr.onerror = () => reject(new Error('Network error'));
            xhr.send();
        });
    },
};

// Helper to split file into chunks
export const splitFileIntoChunks = (file: File): Blob[] => {
    const chunks: Blob[] = [];
    let offset = 0;
    while (offset < file.size) {
        const end = Math.min(offset + CHUNK_SIZE, file.size);
        chunks.push(file.slice(offset, end));
        offset = end;
    }
    return chunks;
};

// File System Access API for streaming downloads
// Writes directly to disk without buffering entire file in memory
export const streamingDownload = async (
    fileId: string,
    fileName: string,
    fileSize: number,
    onProgress?: (loaded: number, total: number) => void
): Promise<void> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    // Check if File System Access API is supported
    if ('showSaveFilePicker' in window) {
        try {
            // Use File System Access API for direct-to-disk writing
            const handle = await (window as any).showSaveFilePicker({
                suggestedName: fileName,
            });
            const writable = await handle.createWritable();

            const response = await fetch(`${API_URL}/files/${fileId}/download/stream`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });

            if (!response.ok) {
                throw new Error('Download failed');
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }

            let loaded = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                await writable.write(value);
                loaded += value.length;

                if (onProgress) {
                    onProgress(loaded, fileSize);
                }
            }

            await writable.close();
            return;
        } catch (error: any) {
            // User cancelled the save dialog or API not available
            if (error.name === 'AbortError') {
                throw error;
            }
            console.warn('File System Access API failed, falling back to blob download:', error);
        }
    }

    // Fallback: Download as blob and trigger download
    const blob = await chunkedUploadApi.downloadChunked(fileId, onProgress);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export default api;
