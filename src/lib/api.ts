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

// Auth API
export const authApi = {
    register: (email: string, password: string) =>
        api.post('/auth/register', { email, password }),

    login: (email: string, password: string) =>
        api.post('/auth/login', { email, password }),

    getMe: () => api.get('/auth/me'),
};

// Telegram API
export const telegramApi = {
    setup: (botToken: string, channelId: string, apiId: string, apiHash: string) =>
        api.post('/telegram/setup', { botToken, channelId, apiId, apiHash }),

    getStatus: () => api.get('/telegram/status'),

    validate: () => api.post('/telegram/validate'),
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

    delete: (id: string) => api.delete(`/folders/${id}`),
};

// File API
export const fileApi = {
    getAll: (folderId?: string) =>
        api.get('/files', { params: { folderId } }),

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

    delete: (id: string) => api.delete(`/files/${id}`),
};

export default api;
