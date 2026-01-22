import { create } from 'zustand';
import { authApi, telegramApi } from './api';

interface User {
    id: string;
    email: string;
    name?: string;
    picture?: string;
    createdAt: string;
    hasTelegramConfig: boolean;
    useSystemBots?: boolean;
    maxUploadSize?: number;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;

    googleSignIn: (credential: string) => Promise<void>;
    logout: () => void;
    checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
    isLoading: true,
    isAuthenticated: false,

    googleSignIn: async (credential: string) => {
        const response = await authApi.googleSignIn(credential);
        const { user, token } = response.data;

        localStorage.setItem('token', token);
        set({ user, token, isAuthenticated: true, isLoading: false });
    },

    logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    },

    checkAuth: async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            set({ isLoading: false, isAuthenticated: false });
            return;
        }

        try {
            const response = await authApi.getMe();
            set({
                user: response.data.user,
                token,
                isAuthenticated: true,
                isLoading: false
            });
        } catch (error) {
            localStorage.removeItem('token');
            set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
    },
}));

// Folder store
interface Folder {
    id: string;
    name: string;
    parentId: string | null;
    childCount?: number;
    fileCount?: number;
    children?: FolderTreeItem[];
}

interface FolderTreeItem {
    id: string;
    name: string;
    childCount: number;
    fileCount: number;
    children: FolderTreeItem[];
}

interface FileItem {
    id: string;
    name: string;
    size: string;
    mimeType: string;
    createdAt: string;
}

interface BreadcrumbItem {
    id: string;
    name: string;
}

interface FolderState {
    currentFolderId: string | null;
    folders: Folder[];
    files: FileItem[];
    folderTree: FolderTreeItem[];
    breadcrumbs: BreadcrumbItem[];
    isLoading: boolean;

    setCurrentFolder: (folderId: string | null) => void;
    loadFolderContents: (folderId?: string) => Promise<void>;
    loadFolderTree: () => Promise<void>;
    createFolder: (name: string) => Promise<void>;
    deleteFolder: (id: string) => Promise<void>;
    renameFolder: (id: string, name: string) => Promise<void>;
}

export const useFolderStore = create<FolderState>((set, get) => ({
    currentFolderId: null,
    folders: [],
    files: [],
    folderTree: [],
    breadcrumbs: [],
    isLoading: false,

    setCurrentFolder: (folderId) => {
        set({ currentFolderId: folderId });
        get().loadFolderContents(folderId || undefined);
    },

    loadFolderContents: async (folderId) => {
        set({ isLoading: true });
        try {
            const [foldersRes, filesRes] = await Promise.all([
                await import('./api').then(m => m.folderApi.getAll(folderId)),
                await import('./api').then(m => m.fileApi.getAll(folderId)),
            ]);

            // Get breadcrumbs if viewing a folder
            let breadcrumbs: BreadcrumbItem[] = [];
            if (folderId) {
                const folderRes = await import('./api').then(m => m.folderApi.getById(folderId));
                breadcrumbs = folderRes.data.breadcrumbs || [];
            }

            set({
                folders: foldersRes.data.folders,
                files: filesRes.data.files,
                breadcrumbs,
                isLoading: false
            });
        } catch (error) {
            console.error('Failed to load folder contents:', error);
            set({ isLoading: false });
        }
    },

    loadFolderTree: async () => {
        try {
            const response = await import('./api').then(m => m.folderApi.getTree());
            set({ folderTree: response.data.tree });
        } catch (error) {
            console.error('Failed to load folder tree:', error);
        }
    },

    createFolder: async (name) => {
        const { currentFolderId } = get();
        await import('./api').then(m => m.folderApi.create(name, currentFolderId || undefined));
        await get().loadFolderContents(currentFolderId || undefined);
        await get().loadFolderTree();
    },

    deleteFolder: async (id) => {
        const { currentFolderId } = get();
        await import('./api').then(m => m.folderApi.delete(id));
        await get().loadFolderContents(currentFolderId || undefined);
        await get().loadFolderTree();
    },

    renameFolder: async (id, name) => {
        const { currentFolderId } = get();
        await import('./api').then(m => m.folderApi.update(id, name));
        await get().loadFolderContents(currentFolderId || undefined);
        await get().loadFolderTree();
    },
}));
