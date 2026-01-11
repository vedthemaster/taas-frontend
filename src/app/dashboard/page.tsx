'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import NextImage from 'next/image';
import {
    Folder,
    File,
    Upload,
    Plus,
    CaretRight,
    CaretDown,
    House,
    Gear,
    SignOut,
    DotsThreeVertical,
    DownloadSimple,
    Trash,
    PencilSimple,
    FolderPlus,
    SpinnerGap,
    X,
    FileText,
    Image as ImageIcon,
    FilmStrip,
    MusicNotes,
    FileZip,
    FileCode,
    List,
    SquaresFour
} from '@phosphor-icons/react';
import { useAuthStore, useFolderStore } from '@/lib/store';
import { fileApi, chunkedUploadApi, splitFileIntoChunks, CHUNK_THRESHOLD } from '@/lib/api';

// File icon helper
const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon weight="duotone" className="w-8 h-8 text-pink-400" />;
    if (mimeType.startsWith('video/')) return <FilmStrip weight="duotone" className="w-8 h-8 text-purple-400" />;
    if (mimeType.startsWith('audio/')) return <MusicNotes weight="duotone" className="w-8 h-8 text-green-400" />;
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar'))
        return <FileZip weight="duotone" className="w-8 h-8 text-yellow-400" />;
    if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('xml'))
        return <FileCode weight="duotone" className="w-8 h-8 text-cyan-400" />;
    return <FileText weight="duotone" className="w-8 h-8 text-blue-400" />;
};

// Format file size
const formatSize = (bytes: string | number) => {
    const size = typeof bytes === 'number' ? bytes : parseInt(bytes);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

// Folder tree item component
interface TreeItemProps {
    item: {
        id: string;
        name: string;
        childCount: number;
        fileCount: number;
        children: any[];
    };
    level: number;
    currentFolderId: string | null;
    onSelect: (id: string) => void;
}

const TreeItem = ({ item, level, currentFolderId, onSelect }: TreeItemProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const isSelected = currentFolderId === item.id;

    return (
        <div>
            <button
                onClick={() => {
                    onSelect(item.id);
                    if (item.children.length > 0) setIsOpen(!isOpen);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all hover:bg-white/5 ${isSelected ? 'bg-blue-500/20 text-blue-400' : 'text-gray-300'
                    }`}
                style={{ paddingLeft: `${12 + level * 16}px` }}
            >
                {item.children.length > 0 ? (
                    isOpen ? <CaretDown weight="bold" className="w-4 h-4" /> : <CaretRight weight="bold" className="w-4 h-4" />
                ) : (
                    <span className="w-4" />
                )}
                <Folder weight="duotone" className="w-4 h-4 text-blue-400" />
                <span className="truncate flex-1">{item.name}</span>
                {item.fileCount > 0 && (
                    <span className="text-xs text-gray-500">{item.fileCount}</span>
                )}
            </button>
            {isOpen && item.children.map((child) => (
                <TreeItem
                    key={child.id}
                    item={child}
                    level={level + 1}
                    currentFolderId={currentFolderId}
                    onSelect={onSelect}
                />
            ))}
        </div>
    );
};

export default function DashboardPage() {
    const router = useRouter();
    const { user, checkAuth, logout, isLoading: authLoading, isAuthenticated } = useAuthStore();
    const {
        currentFolderId,
        folders,
        files,
        folderTree,
        breadcrumbs,
        isLoading,
        setCurrentFolder,
        loadFolderContents,
        loadFolderTree,
        createFolder,
        deleteFolder
    } = useFolderStore();

    // Upload state
    interface UploadState {
        fileName: string;
        progress: number;
        uploadedBytes: number;
        totalBytes: number;
        status: 'uploading' | 'complete' | 'error';
        uploadId?: string;
    }

    const [showNewFolderModal, setShowNewFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [activeUpload, setActiveUpload] = useState<UploadState | null>(null);
    const uploadAbortRef = useRef<boolean>(false);

    // Delete confirmation modal state
    const [deleteModal, setDeleteModal] = useState<{
        isOpen: boolean;
        type: 'file' | 'folder';
        id: string;
        name: string;
    } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Download progress state
    const [downloadProgress, setDownloadProgress] = useState<{
        fileName: string;
        loaded: number;
        total: number;
        percent: number;
    } | null>(null);

    useEffect(() => {
        checkAuth();
    }, []);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/');
        } else if (isAuthenticated && user && !user.hasTelegramConfig) {
            router.push('/setup');
        } else if (isAuthenticated) {
            loadFolderContents();
            loadFolderTree();
        }
    }, [authLoading, isAuthenticated, user]);

    const handleLogout = () => {
        logout();
        router.push('/');
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;

        setIsCreatingFolder(true);
        try {
            await createFolder(newFolderName);
            setNewFolderName('');
            setShowNewFolderModal(false);
        } catch (error) {
            console.error('Failed to create folder:', error);
        } finally {
            setIsCreatingFolder(false);
        }
    };

    const handleFileUpload = useCallback(async (fileList: FileList) => {
        const file = fileList[0];
        if (!file) return;

        uploadAbortRef.current = false;

        // Check if file needs chunked upload
        if (file.size > CHUNK_THRESHOLD) {
            // Chunked upload
            setActiveUpload({
                fileName: file.name,
                progress: 0,
                uploadedBytes: 0,
                totalBytes: file.size,
                status: 'uploading',
            });

            try {
                // Initialize upload
                const initRes = await chunkedUploadApi.initUpload(
                    file.name,
                    file.size,
                    file.type || 'application/octet-stream',
                    currentFolderId || undefined
                );

                const { uploadId, totalChunks } = initRes.data;
                setActiveUpload(prev => prev ? { ...prev, uploadId } : null);

                // Split file into chunks
                const chunks = splitFileIntoChunks(file);
                let completedChunks = 0;
                let uploadedBytes = 0;

                // Upload chunks with rate limiting (max 3 concurrent)
                const MAX_CONCURRENT = 3;
                const chunkQueue = [...chunks.map((chunk, index) => ({ chunk, index }))];
                const activeUploads: Promise<void>[] = [];

                const uploadNextChunk = async () => {
                    if (uploadAbortRef.current) return;

                    const item = chunkQueue.shift();
                    if (!item) return;

                    const { chunk, index } = item;

                    await chunkedUploadApi.uploadChunk(
                        uploadId,
                        chunk,
                        index,
                        (loaded, total) => {
                            // Calculate overall progress
                            const chunkProgress = loaded / total;
                            const overallBytes = uploadedBytes + (chunk.size * chunkProgress);
                            const overallProgress = Math.round((overallBytes / file.size) * 100);

                            setActiveUpload(prev => prev ? {
                                ...prev,
                                progress: overallProgress,
                                uploadedBytes: Math.round(overallBytes),
                            } : null);
                        }
                    );

                    completedChunks++;
                    uploadedBytes += chunk.size;

                    // Update progress
                    setActiveUpload(prev => prev ? {
                        ...prev,
                        progress: Math.round((completedChunks / totalChunks) * 100),
                        uploadedBytes,
                    } : null);

                    // Upload next chunk
                    await uploadNextChunk();
                };

                // Start initial concurrent uploads
                for (let i = 0; i < Math.min(MAX_CONCURRENT, chunks.length); i++) {
                    activeUploads.push(uploadNextChunk());
                }

                // Wait for all uploads to complete
                await Promise.all(activeUploads);

                if (uploadAbortRef.current) {
                    await chunkedUploadApi.cancelUpload(uploadId);
                    setActiveUpload(null);
                    return;
                }

                // Complete upload
                await chunkedUploadApi.completeUpload(uploadId);

                setActiveUpload(prev => prev ? { ...prev, status: 'complete', progress: 100 } : null);

                // Refresh folder contents
                loadFolderContents(currentFolderId || undefined);

                // Clear after showing completion
                setTimeout(() => setActiveUpload(null), 2000);

            } catch (error) {
                console.error('Chunked upload failed:', error);
                setActiveUpload(prev => prev ? { ...prev, status: 'error' } : null);
                setTimeout(() => setActiveUpload(null), 3000);
            }
        } else {
            // Standard upload for small files
            setUploadProgress(0);
            try {
                await fileApi.upload(file, currentFolderId || undefined);
                loadFolderContents(currentFolderId || undefined);
                setUploadProgress(null);
            } catch (error) {
                console.error('Failed to upload file:', error);
                setUploadProgress(null);
            }
        }
    }, [currentFolderId, loadFolderContents]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files);
        }
    }, [handleFileUpload]);

    const handleDownload = async (fileId: string, fileName: string, fileSize: number) => {
        try {
            // Use XHR for progress tracking
            const xhr = new XMLHttpRequest();
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

            setDownloadProgress({
                fileName,
                loaded: 0,
                total: fileSize,
                percent: 0,
            });

            xhr.open('GET', `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/files/${fileId}/download`);
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
            xhr.responseType = 'blob';

            xhr.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    setDownloadProgress({
                        fileName,
                        loaded: event.loaded,
                        total: event.total,
                        percent,
                    });
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    const blob = xhr.response;
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', fileName);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(url);
                }
                setDownloadProgress(null);
            };

            xhr.onerror = () => {
                console.error('Download failed');
                setDownloadProgress(null);
            };

            xhr.send();
        } catch (error) {
            console.error('Failed to download file:', error);
            setDownloadProgress(null);
        }
    };

    // Show delete confirmation modal
    const showDeleteConfirm = (type: 'file' | 'folder', id: string, name: string) => {
        setDeleteModal({ isOpen: true, type, id, name });
    };

    // Cancel delete
    const cancelDelete = () => {
        setDeleteModal(null);
    };

    // Confirm delete
    const confirmDelete = async () => {
        if (!deleteModal) return;

        setIsDeleting(true);
        try {
            if (deleteModal.type === 'file') {
                await fileApi.delete(deleteModal.id);
            } else {
                await deleteFolder(deleteModal.id);
            }
            loadFolderContents(currentFolderId || undefined);
            loadFolderTree();
        } catch (error) {
            console.error(`Failed to delete ${deleteModal.type}:`, error);
        } finally {
            setIsDeleting(false);
            setDeleteModal(null);
        }
    };

    const handleDeleteFile = (fileId: string, fileName: string) => {
        showDeleteConfirm('file', fileId, fileName);
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-dark flex">
            {/* Sidebar */}
            <aside className="sidebar flex flex-col">
                {/* Logo */}
                <div className="p-5 border-b border-white/5">
                    <NextImage src="/tass.png" alt="TAAS" width={100} height={32} className="h-8 w-auto" />
                </div>

                {/* Folder tree */}
                <div className="flex-1 overflow-y-auto py-4 px-2">
                    <button
                        onClick={() => setCurrentFolder(null)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all hover:bg-white/5 mb-2 ${currentFolderId === null ? 'bg-blue-500/20 text-blue-400' : 'text-gray-300'
                            }`}
                    >
                        <House weight="duotone" className="w-4 h-4" />
                        <span>All Files</span>
                    </button>

                    <div className="mt-4">
                        <div className="flex items-center justify-between px-3 mb-2">
                            <span className="text-xs font-medium text-gray-500 uppercase">Folders</span>
                            <button
                                onClick={() => setShowNewFolderModal(true)}
                                className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
                            >
                                <Plus weight="bold" className="w-4 h-4" />
                            </button>
                        </div>
                        {folderTree.map((item) => (
                            <TreeItem
                                key={item.id}
                                item={item}
                                level={0}
                                currentFolderId={currentFolderId}
                                onSelect={setCurrentFolder}
                            />
                        ))}
                    </div>
                </div>

                {/* User section */}
                <div className="border-t border-white/5 p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-sm font-medium">
                            {user?.email?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{user?.email}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
                            title="Log out"
                        >
                            <SignOut weight="duotone" className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 text-sm">
                        <button
                            onClick={() => setCurrentFolder(null)}
                            className="text-gray-400 hover:text-white"
                        >
                            All Files
                        </button>
                        {breadcrumbs.map((crumb, index) => (
                            <span key={crumb.id} className="flex items-center gap-2">
                                <CaretRight weight="bold" className="w-4 h-4 text-gray-600" />
                                <button
                                    onClick={() => setCurrentFolder(crumb.id)}
                                    className={index === breadcrumbs.length - 1 ? 'text-white' : 'text-gray-400 hover:text-white'}
                                >
                                    {crumb.name}
                                </button>
                            </span>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        {/* View mode toggle */}
                        <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                                title="Grid view"
                            >
                                <SquaresFour weight={viewMode === 'grid' ? 'fill' : 'regular'} className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                                title="List view"
                            >
                                <List weight={viewMode === 'list' ? 'fill' : 'regular'} className="w-4 h-4" />
                            </button>
                        </div>

                        <button
                            onClick={() => setShowNewFolderModal(true)}
                            className="btn-secondary flex items-center gap-2 text-sm py-2 px-4"
                        >
                            <FolderPlus weight="duotone" className="w-4 h-4" />
                            New Folder
                        </button>
                        <label className="btn-primary flex items-center gap-2 text-sm py-2 px-4 cursor-pointer">
                            <Upload weight="duotone" className="w-4 h-4" />
                            Upload
                            <input
                                type="file"
                                className="hidden"
                                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                            />
                        </label>
                    </div>
                </header>

                {/* Upload progress - Standard */}
                {uploadProgress !== null && !activeUpload && (
                    <div className="px-6 py-3 bg-blue-500/10 border-b border-blue-500/20">
                        <div className="flex items-center gap-3">
                            <SpinnerGap weight="bold" className="w-5 h-5 text-blue-400 animate-spin" />
                            <span className="text-sm text-blue-200">Uploading file...</span>
                        </div>
                    </div>
                )}

                {/* Upload progress - Chunked */}
                {activeUpload && (
                    <div className="px-6 py-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-blue-500/20">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                {activeUpload.status === 'uploading' && (
                                    <SpinnerGap weight="bold" className="w-5 h-5 text-blue-400 animate-spin" />
                                )}
                                {activeUpload.status === 'complete' && (
                                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                                        <span className="text-white text-xs">✓</span>
                                    </div>
                                )}
                                {activeUpload.status === 'error' && (
                                    <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                                        <span className="text-white text-xs">✕</span>
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm font-medium text-white truncate max-w-xs">
                                        {activeUpload.fileName}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {formatSize(activeUpload.uploadedBytes.toString())} / {formatSize(activeUpload.totalBytes.toString())}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-blue-300">
                                    {activeUpload.progress}%
                                </span>
                                {activeUpload.status === 'uploading' && (
                                    <button
                                        onClick={() => {
                                            uploadAbortRef.current = true;
                                            setActiveUpload(null);
                                        }}
                                        className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400"
                                        title="Cancel upload"
                                    >
                                        <X weight="bold" className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-300 ${activeUpload.status === 'complete' ? 'bg-green-500' :
                                    activeUpload.status === 'error' ? 'bg-red-500' :
                                        'bg-gradient-to-r from-blue-500 to-purple-500'
                                    }`}
                                style={{ width: `${activeUpload.progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Content area */}
                <div
                    className={`flex-1 overflow-y-auto p-6 ${dragOver ? 'bg-blue-500/10' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                >
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="spinner" />
                        </div>
                    ) : folders.length === 0 && files.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                <Folder weight="duotone" className="w-10 h-10 text-gray-600" />
                            </div>
                            <h3 className="text-xl font-medium text-gray-300 mb-2">No files yet</h3>
                            <p className="text-gray-500 mb-6 max-w-md">
                                Drag and drop files here or click the Upload button to get started
                            </p>
                            <label className="btn-primary flex items-center gap-2 cursor-pointer">
                                <Upload weight="duotone" className="w-4 h-4" />
                                Upload your first file
                                <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                                />
                            </label>
                        </div>
                    ) : viewMode === 'grid' ? (
                        <div key="grid" className="file-grid view-transition">
                            {/* Folders - Grid */}
                            {folders.map((folder: any) => (
                                <button
                                    key={folder.id}
                                    onClick={() => setCurrentFolder(folder.id)}
                                    className="glass-card p-4 text-left hover:border-blue-500/50 transition-all group"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                            <Folder weight="duotone" className="w-6 h-6 text-blue-400" />
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                showDeleteConfirm('folder', folder.id, folder.name);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400"
                                        >
                                            <Trash weight="duotone" className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <h4 className="font-medium truncate">{folder.name}</h4>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {folder._count?.files || 0} files
                                    </p>
                                </button>
                            ))}

                            {/* Files - Grid */}
                            {files.map((file: any) => (
                                <div
                                    key={file.id}
                                    className="glass-card p-4 hover:border-blue-500/50 transition-all group"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="w-12 h-12 rounded-xl bg-gray-500/20 flex items-center justify-center">
                                            {getFileIcon(file.mimeType)}
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                            <button
                                                onClick={() => handleDownload(file.id, file.name, file.size)}
                                                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-blue-400"
                                                title="Download"
                                            >
                                                <DownloadSimple weight="duotone" className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteFile(file.id, file.name)}
                                                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400"
                                                title="Delete"
                                            >
                                                <Trash weight="duotone" className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <h4 className="font-medium truncate" title={file.name}>{file.name}</h4>
                                    <p className="text-sm text-gray-500 mt-1">{formatSize(file.size)}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div key="list" className="space-y-1 view-transition">
                            {/* Folders - List */}
                            {folders.map((folder: any) => (
                                <button
                                    key={folder.id}
                                    onClick={() => setCurrentFolder(folder.id)}
                                    className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-all group text-left"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                        <Folder weight="duotone" className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium truncate">{folder.name}</h4>
                                        <p className="text-xs text-gray-500">{folder._count?.files || 0} files</p>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            showDeleteConfirm('folder', folder.id, folder.name);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400"
                                    >
                                        <Trash weight="duotone" className="w-4 h-4" />
                                    </button>
                                </button>
                            ))}

                            {/* Files - List */}
                            {files.map((file: any) => (
                                <div
                                    key={file.id}
                                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-gray-500/20 flex items-center justify-center flex-shrink-0">
                                        {getFileIcon(file.mimeType)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium truncate" title={file.name}>{file.name}</h4>
                                        <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                        <button
                                            onClick={() => handleDownload(file.id, file.name, file.size)}
                                            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-blue-400"
                                            title="Download"
                                        >
                                            <DownloadSimple weight="duotone" className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteFile(file.id, file.name)}
                                            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400"
                                            title="Delete"
                                        >
                                            <Trash weight="duotone" className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* New Folder Modal */}
            {showNewFolderModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="glass-card p-6 w-full max-w-md animate-fade-in-up">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Create new folder</h3>
                            <button
                                onClick={() => setShowNewFolderModal(false)}
                                className="p-1 rounded hover:bg-white/10"
                            >
                                <X weight="bold" className="w-5 h-5" />
                            </button>
                        </div>
                        <input
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="Folder name"
                            className="mb-4"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowNewFolderModal(false)}
                                className="btn-secondary text-sm py-2 px-4"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateFolder}
                                disabled={isCreatingFolder || !newFolderName.trim()}
                                className="btn-primary text-sm py-2 px-4 flex items-center gap-2"
                            >
                                {isCreatingFolder ? (
                                    <SpinnerGap weight="bold" className="w-4 h-4 animate-spin" />
                                ) : (
                                    <FolderPlus weight="duotone" className="w-4 h-4" />
                                )}
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Drag overlay */}
            {dragOver && (
                <div className="fixed inset-0 bg-blue-500/20 backdrop-blur-sm flex items-center justify-center z-40 pointer-events-none">
                    <div className="text-center">
                        <Upload weight="duotone" className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                        <p className="text-xl font-medium">Drop files to upload</p>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="glass-card p-6 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                <Trash weight="duotone" className="w-6 h-6 text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">
                                    Delete {deleteModal.type}?
                                </h3>
                                <p className="text-gray-400 text-sm">
                                    Are you sure you want to delete <span className="text-white font-medium">"{deleteModal.name}"</span>?
                                    This action cannot be undone.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={cancelDelete}
                                disabled={isDeleting}
                                className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isDeleting ? (
                                    <>
                                        <SpinnerGap weight="bold" className="w-4 h-4 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash weight="bold" className="w-4 h-4" />
                                        Delete
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Download Progress Modal */}
            {downloadProgress && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="glass-card p-6 max-w-md w-full mx-4">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                <DownloadSimple weight="duotone" className="w-6 h-6 text-blue-400 animate-bounce" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-semibold text-white">Downloading...</h3>
                                <p className="text-gray-400 text-sm truncate" title={downloadProgress.fileName}>
                                    {downloadProgress.fileName}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">
                                    {formatSize(downloadProgress.loaded)} / {formatSize(downloadProgress.total)}
                                </span>
                                <span className="text-blue-400 font-medium">{downloadProgress.percent}%</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                                    style={{ width: `${downloadProgress.percent}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
