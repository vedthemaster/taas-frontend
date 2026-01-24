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
    List as ListIcon,
    SquaresFour,
    MagnifyingGlass,
    SortAscending,
    ArrowRight,
    FolderOpen,
    List
} from '@phosphor-icons/react';
import { useAuthStore, useFolderStore } from '@/lib/store';
import { fileApi, folderApi, chunkedUploadApi, splitFileIntoChunks, CHUNK_THRESHOLD, botApi, channelApi, streamingDownload } from '@/lib/api';

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

// Folder tree item for move modal
interface FolderTreeItemProps {
    folder: {
        id: string;
        name: string;
        childCount: number;
        children: any[];
    };
    depth: number;
    onSelect: (folderId: string) => void;
    disabled?: boolean;
    moveItemId?: string;
}

const FolderTreeItem = ({ folder, depth, onSelect, disabled, moveItemId }: FolderTreeItemProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const isDisabled = disabled || folder.id === moveItemId;

    return (
        <div>
            <button
                onClick={() => !isDisabled && onSelect(folder.id)}
                disabled={isDisabled}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${isDisabled
                    ? 'opacity-50 cursor-not-allowed text-gray-500'
                    : 'hover:bg-white/5 text-gray-300 hover:text-white'
                    }`}
                style={{ paddingLeft: `${12 + depth * 16}px` }}
            >
                {folder.children && folder.children.length > 0 ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                        className="p-0.5 hover:bg-white/10 rounded"
                    >
                        {isOpen ? <CaretDown weight="bold" className="w-3 h-3" /> : <CaretRight weight="bold" className="w-3 h-3" />}
                    </button>
                ) : (
                    <span className="w-4" />
                )}
                <Folder weight="duotone" className="w-4 h-4 text-blue-400" />
                <span className="truncate flex-1 text-sm">{folder.name}</span>
            </button>
            {isOpen && folder.children?.map((child: any) => (
                <FolderTreeItem
                    key={child.id}
                    folder={child}
                    depth={depth + 1}
                    onSelect={onSelect}
                    disabled={disabled}
                    moveItemId={moveItemId}
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
        error?: string;
    }

    const [showNewFolderModal, setShowNewFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [activeUpload, setActiveUpload] = useState<UploadState | null>(null);
    const uploadAbortRef = useRef<boolean>(false);

    // Upload queue for multiple files
    const [uploadQueue, setUploadQueue] = useState<File[]>([]);
    const isUploadingRef = useRef(false);
    const processedFilesRef = useRef<Set<string>>(new Set());

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

    // Download queue
    const [downloadQueue, setDownloadQueue] = useState<Array<{ id: string; name: string; size: number }>>([]);
    const isDownloadingRef = useRef(false);
    const downloadQueueRef = useRef<Array<{ id: string; name: string; size: number }>>([]);
    const processedDownloadsRef = useRef<Set<string>>(new Set());

    // Multi-select state
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    // Bot management state
    const [showBotModal, setShowBotModal] = useState(false);
    const [bots, setBots] = useState<Array<{ id: string; username: string | null; isActive: boolean }>>([]);
    const [channelId, setChannelId] = useState('');
    const [newBotToken, setNewBotToken] = useState('');
    const [newChannelId, setNewChannelId] = useState('');
    const [isAddingBot, setIsAddingBot] = useState(false);
    const [botError, setBotError] = useState('');

    // Channel management state (additional channels for throughput)
    const [additionalChannels, setAdditionalChannels] = useState<Array<{ id: string; channelId: string; name: string | null; isActive: boolean }>>([]);
    const [newAdditionalChannel, setNewAdditionalChannel] = useState('');
    const [isAddingChannel, setIsAddingChannel] = useState(false);
    const [channelError, setChannelError] = useState('');

    // Search and sort state
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        type: 'file' | 'folder';
        item: any;
    } | null>(null);

    // Move modal state
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [moveItem, setMoveItem] = useState<{
        type: 'file' | 'folder';
        id: string;
        name: string;
    } | null>(null);
    const [isMoving, setIsMoving] = useState(false);

    // Mobile sidebar state
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Load bots for management
    const loadBots = useCallback(async () => {
        try {
            const response = await botApi.getAll();
            setBots(response.data.bots || []);
            setChannelId(response.data.channelId || '');
            setNewChannelId(response.data.channelId || '');

            // Also load additional channels
            try {
                const channelResponse = await channelApi.getAll();
                setAdditionalChannels(channelResponse.data.channels || []);
            } catch (e) {
                console.error('Failed to load channels:', e);
            }
        } catch (error) {
            console.error('Failed to load bots:', error);
        }
    }, []);

    // Add a new bot
    const handleAddBot = async () => {
        if (!newBotToken.trim()) {
            setBotError('Bot token is required');
            return;
        }

        setIsAddingBot(true);
        setBotError('');

        try {
            await botApi.add(newBotToken.trim(), bots.length === 0 ? newChannelId : undefined);
            setNewBotToken('');
            await loadBots();
        } catch (error: any) {
            setBotError(error.response?.data?.error || 'Failed to add bot');
        } finally {
            setIsAddingBot(false);
        }
    };

    // Remove a bot
    const handleRemoveBot = async (botId: string) => {
        try {
            await botApi.remove(botId);
            await loadBots();
        } catch (error) {
            console.error('Failed to remove bot:', error);
        }
    };

    // Update channel ID
    const handleUpdateChannel = async () => {
        if (!newChannelId.trim()) return;
        try {
            await botApi.updateChannel(newChannelId.trim());
            setChannelId(newChannelId);
        } catch (error) {
            console.error('Failed to update channel:', error);
        }
    };

    // Add an additional channel for throughput
    const handleAddChannel = async () => {
        if (!newAdditionalChannel.trim()) {
            setChannelError('Channel ID is required');
            return;
        }

        setIsAddingChannel(true);
        setChannelError('');

        try {
            await channelApi.add(newAdditionalChannel.trim());
            setNewAdditionalChannel('');
            await loadBots(); // Reloads channels too
        } catch (error: any) {
            setChannelError(error.response?.data?.error || error.response?.data?.details || 'Failed to add channel');
        } finally {
            setIsAddingChannel(false);
        }
    };

    // Remove an additional channel
    const handleRemoveChannel = async (channelDbId: string) => {
        try {
            await channelApi.remove(channelDbId);
            await loadBots(); // Reloads channels too
        } catch (error) {
            console.error('Failed to remove channel:', error);
        }
    };

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

    // Process a single file upload
    const processFileUpload = useCallback(async (file: File) => {
        if (!file) {
            isUploadingRef.current = false;
            return;
        }

        // Check file size limit for system bot users
        // Only enforce limit if user is explicitly using system bots
        if (user?.useSystemBots) {
            const maxSize = user.maxUploadSize || (100 * 1024 * 1024); // Default 100MB for system bot users
            if (file.size > maxSize) {
                const limitMB = Math.round(maxSize / (1024 * 1024));
                setActiveUpload({
                    fileName: file.name,
                    progress: 0,
                    uploadedBytes: 0,
                    totalBytes: file.size,
                    status: 'error',
                    error: `File size exceeds ${limitMB}MB per file limit. Set up your own bot in Settings to upload larger files.`
                });
                // Process next file after delay
                setTimeout(() => {
                    setActiveUpload(null);
                    isUploadingRef.current = false;
                }, 3000);
                return;
            }
        }

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

                // Upload chunks with configurable concurrency
                // Set NEXT_PUBLIC_MAX_CONCURRENT_UPLOADS in .env (default: 4)
                const MAX_CONCURRENT = parseInt(process.env.NEXT_PUBLIC_MAX_CONCURRENT_UPLOADS || '4', 10);
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
                    processNextFromQueue();
                    return;
                }

                // Complete upload
                await chunkedUploadApi.completeUpload(uploadId);

                setActiveUpload(prev => prev ? { ...prev, status: 'complete', progress: 100 } : null);

                // Clear after showing completion, then process next
                setTimeout(() => {
                    setActiveUpload(null);
                    processNextFromQueue();
                }, 1000);

            } catch (error) {
                console.error('Chunked upload failed:', error);
                setActiveUpload(prev => prev ? { ...prev, status: 'error' } : null);
                setTimeout(() => {
                    setActiveUpload(null);
                    processNextFromQueue();
                }, 2000);
            }
        } else {
            // Standard upload for small files
            setActiveUpload({
                fileName: file.name,
                progress: 0,
                uploadedBytes: 0,
                totalBytes: file.size,
                status: 'uploading',
            });
            try {
                await fileApi.upload(file, currentFolderId || undefined);
                setActiveUpload(prev => prev ? { ...prev, status: 'complete', progress: 100 } : null);
                setTimeout(() => {
                    setActiveUpload(null);
                    processNextFromQueue();
                }, 800);
            } catch (error) {
                console.error('Failed to upload file:', error);
                setActiveUpload(prev => prev ? { ...prev, status: 'error' } : null);
                setTimeout(() => {
                    setActiveUpload(null);
                    processNextFromQueue();
                }, 2000);
            }
        }
    }, [currentFolderId, loadFolderContents]);

    // Ref-based queue to avoid React state issues
    const uploadQueueRef = useRef<File[]>([]);

    // Process next file from ref-based queue
    const processNextFromQueue = useCallback(() => {
        if (uploadQueueRef.current.length > 0) {
            const next = uploadQueueRef.current.shift()!;
            setUploadQueue([...uploadQueueRef.current]); // Sync state for UI
            processFileUpload(next);
        } else {
            isUploadingRef.current = false;
            processedFilesRef.current.clear();
            loadFolderContents(currentFolderId || undefined);
            setUploadQueue([]);
        }
    }, [processFileUpload, currentFolderId, loadFolderContents]);

    // Handle multiple files - queue them up
    const handleFileUpload = useCallback((fileList: FileList) => {
        const files = Array.from(fileList);
        if (files.length === 0) return;

        // Create unique keys for files and filter out already processed ones
        const getFileKey = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;
        const newFiles = files.filter(f => {
            const key = getFileKey(f);
            if (processedFilesRef.current.has(key)) {
                console.log('Skipping duplicate:', f.name);
                return false; // Skip duplicate
            }
            processedFilesRef.current.add(key);
            return true;
        });

        if (newFiles.length === 0) return;

        // Add to ref-based queue
        uploadQueueRef.current.push(...newFiles);
        setUploadQueue([...uploadQueueRef.current]); // Sync state for UI

        // If not currently uploading, start processing
        if (!isUploadingRef.current) {
            isUploadingRef.current = true;
            processNextFromQueue();
        }
    }, [processNextFromQueue]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files);
        }
    }, [handleFileUpload]);

    // Process next download from ref-based queue
    const processNextDownload = () => {
        if (downloadQueueRef.current.length > 0) {
            const next = downloadQueueRef.current.shift()!;
            setDownloadQueue([...downloadQueueRef.current]); // Sync state for UI
            executeDownload(next.id, next.name, next.size);
        } else {
            isDownloadingRef.current = false;
            processedDownloadsRef.current.clear();
            setDownloadQueue([]);
        }
    };

    // Execute actual download using File System Access API
    const executeDownload = async (fileId: string, fileName: string, fileSize: number) => {
        try {
            setDownloadProgress({
                fileName,
                loaded: 0,
                total: fileSize,
                percent: 0,
            });

            await streamingDownload(fileId, fileName, fileSize, (loaded, total) => {
                const percent = Math.round((loaded / total) * 100);
                setDownloadProgress({
                    fileName,
                    loaded,
                    total,
                    percent,
                });
            });

            setDownloadProgress(null);
            processNextDownload();
        } catch (error: any) {
            // User cancelled save dialog
            if (error.name === 'AbortError') {
                setDownloadProgress(null);
                processNextDownload();
                return;
            }
            console.error('Failed to download file:', error);
            setDownloadProgress(null);
            processNextDownload();
        }
    };

    // Queue a file for download
    const handleDownload = (fileId: string, fileName: string, fileSize: number) => {
        // Check for duplicate
        if (processedDownloadsRef.current.has(fileId)) {
            console.log('Skipping duplicate download:', fileName);
            return;
        }
        processedDownloadsRef.current.add(fileId);

        // Add to ref-based queue
        downloadQueueRef.current.push({ id: fileId, name: fileName, size: fileSize });
        setDownloadQueue([...downloadQueueRef.current]); // Sync state for UI

        // If not currently downloading, start processing
        if (!isDownloadingRef.current) {
            isDownloadingRef.current = true;
            processNextDownload();
        }
    };

    // Toggle file selection
    const toggleFileSelection = (fileId: string) => {
        setSelectedFiles(prev => {
            const newSet = new Set(prev);
            if (newSet.has(fileId)) {
                newSet.delete(fileId);
            } else {
                newSet.add(fileId);
            }
            // Auto-enable selection mode if files selected
            if (newSet.size > 0) {
                setIsSelectionMode(true);
            }
            return newSet;
        });
    };

    // Select all files
    const selectAllFiles = () => {
        const allFileIds = files.map((f: any) => f.id);
        setSelectedFiles(new Set(allFileIds));
        setIsSelectionMode(true);
    };

    // Clear selection
    const clearSelection = () => {
        setSelectedFiles(new Set());
        setIsSelectionMode(false);
    };

    // Bulk download selected files
    const handleBulkDownload = () => {
        const selectedFilesList = files.filter((f: any) => selectedFiles.has(f.id));
        selectedFilesList.forEach((file: any) => {
            handleDownload(file.id, file.name, Number(file.size));
        });
        clearSelection();
    };

    // Bulk delete selected files
    const handleBulkDelete = () => {
        if (selectedFiles.size === 0) return;
        setShowBulkDeleteModal(true);
    };

    // Confirm bulk delete
    const confirmBulkDelete = async () => {
        setIsBulkDeleting(true);
        try {
            for (const fileId of selectedFiles) {
                await fileApi.delete(fileId);
            }
            loadFolderContents(currentFolderId || undefined);
            clearSelection();
        } catch (error) {
            console.error('Failed to delete files:', error);
        } finally {
            setIsBulkDeleting(false);
            setShowBulkDeleteModal(false);
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

    // Context menu handler
    const handleContextMenu = (e: React.MouseEvent, type: 'file' | 'folder', item: any) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            type,
            item,
        });
    };

    // Close context menu
    const closeContextMenu = () => {
        setContextMenu(null);
    };

    // Handle move action from context menu
    const handleMoveAction = () => {
        if (contextMenu) {
            setMoveItem({
                type: contextMenu.type,
                id: contextMenu.item.id,
                name: contextMenu.item.name,
            });
            setShowMoveModal(true);
            closeContextMenu();
        }
    };

    // Confirm move
    const confirmMove = async (targetFolderId: string | null) => {
        if (!moveItem) return;

        setIsMoving(true);
        try {
            if (moveItem.type === 'file') {
                await fileApi.move(moveItem.id, targetFolderId);
            } else {
                await folderApi.move(moveItem.id, targetFolderId);
            }
            loadFolderContents(currentFolderId || undefined);
            loadFolderTree();
            setShowMoveModal(false);
            setMoveItem(null);
        } catch (error) {
            console.error('Failed to move:', error);
        } finally {
            setIsMoving(false);
        }
    };

    // Close context menu on click outside
    useEffect(() => {
        const handleClick = () => closeContextMenu();
        if (contextMenu) {
            document.addEventListener('click', handleClick);
        }
        return () => document.removeEventListener('click', handleClick);
    }, [contextMenu]);

    // Computed filtered and sorted files
    const filteredFiles = files
        .filter((f: any) =>
            !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a: any, b: any) => {
            let comparison = 0;
            switch (sortBy) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'date':
                    comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                    break;
                case 'size':
                    comparison = parseInt(a.size) - parseInt(b.size);
                    break;
            }
            return sortOrder === 'desc' ? -comparison : comparison;
        });

    // Computed filtered folders (search only)
    const filteredFolders = folders.filter((f: any) =>
        !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (authLoading) {
        return (
            <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-dark flex">
            {/* Mobile sidebar overlay */}
            <div
                className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''} lg:hidden`}
                onClick={() => setIsSidebarOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`sidebar flex flex-col ${isSidebarOpen ? 'open' : ''}`}>
                {/* Logo and close button */}
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                    <NextImage src="/tass.png" alt="TAAS" width={100} height={32} className="h-8 w-auto" />
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="lg:hidden p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
                    >
                        <X weight="bold" className="w-5 h-5" />
                    </button>
                </div>

                {/* Folder tree */}
                <div className="flex-1 overflow-y-auto py-4 px-2">
                    <button
                        onClick={() => { setCurrentFolder(null); setIsSidebarOpen(false); }}
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
                                onSelect={(id) => { setCurrentFolder(id); setIsSidebarOpen(false); }}
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
                            onClick={() => { setShowBotModal(true); loadBots(); }}
                            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
                            title="Bot Settings"
                        >
                            <Gear weight="duotone" className="w-4 h-4" />
                        </button>
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
            <main className="flex-1 flex flex-col overflow-hidden lg:ml-0">
                {/* Header - Desktop: original single row layout, Mobile: stacked */}
                <header className="border-b border-white/5">
                    {/* Desktop header - hidden on mobile */}
                    <div className="hidden lg:flex items-center justify-between px-6 py-4">
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

                        {/* Search and Sort */}
                        <div className="flex items-center gap-3">
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500/50 focus:outline-none w-48"
                            />
                            <div className="relative">
                                <select
                                    value={`${sortBy}-${sortOrder}`}
                                    onChange={(e) => {
                                        const [newSortBy, newSortOrder] = e.target.value.split('-') as ['name' | 'date' | 'size', 'asc' | 'desc'];
                                        setSortBy(newSortBy);
                                        setSortOrder(newSortOrder);
                                    }}
                                    className="appearance-none pl-3 pr-8 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:border-blue-500/50 focus:outline-none cursor-pointer"
                                >
                                    <option value="name-asc" className="bg-gray-800">Name (A-Z)</option>
                                    <option value="name-desc" className="bg-gray-800">Name (Z-A)</option>
                                    <option value="date-desc" className="bg-gray-800">Date (Newest)</option>
                                    <option value="date-asc" className="bg-gray-800">Date (Oldest)</option>
                                    <option value="size-desc" className="bg-gray-800">Size (Largest)</option>
                                    <option value="size-asc" className="bg-gray-800">Size (Smallest)</option>
                                </select>
                                <SortAscending weight="bold" className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3">
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
                                    <ListIcon weight={viewMode === 'list' ? 'fill' : 'regular'} className="w-4 h-4" />
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
                                    multiple
                                    className="hidden"
                                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                                />
                            </label>
                        </div>
                    </div>

                    {/* Mobile header */}
                    <div className="lg:hidden px-4 py-3 space-y-3">
                        {/* Top row: Hamburger + Breadcrumbs + Upload */}
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setIsSidebarOpen(true)}
                                    className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
                                >
                                    <List weight="bold" className="w-5 h-5" />
                                </button>
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
                                                className={`truncate max-w-[80px] ${index === breadcrumbs.length - 1 ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                                            >
                                                {crumb.name}
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <label className="btn-primary flex items-center gap-2 text-sm py-2 px-3 cursor-pointer">
                                <Upload weight="duotone" className="w-4 h-4" />
                                <span className="hidden sm:inline">Upload</span>
                                <input
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                                />
                            </label>
                        </div>

                        {/* Bottom row: Search + View toggle */}
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="flex-1 min-w-0 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500/50 focus:outline-none"
                            />
                            <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg flex-shrink-0">
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
                                    <ListIcon weight={viewMode === 'list' ? 'fill' : 'regular'} className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* System bots warning banner */}
                {user?.useSystemBots && (
                    <div className="px-4 lg:px-6 py-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-amber-500/20">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                <p className="text-sm text-amber-200">
                                    <span className="font-medium">100MB per file limit active.</span>
                                    <span className="text-amber-300/80 ml-1 hidden sm:inline">Set up your own bot and channel to upload files up to 2GB each.</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setShowBotModal(true)}
                                className="text-sm text-amber-300 hover:text-amber-200 font-medium flex items-center gap-1 flex-shrink-0"
                            >
                                Settings
                                <ArrowRight weight="bold" className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Selection toolbar */}
                {isSelectionMode && (
                    <div className="px-6 py-3 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-b border-blue-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium text-white">
                                {selectedFiles.size} file(s) selected
                            </span>
                            <button
                                onClick={selectAllFiles}
                                className="text-sm text-blue-300 hover:text-blue-200"
                            >
                                Select All ({files.length})
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleBulkDownload}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                <DownloadSimple weight="bold" className="w-4 h-4" />
                                Download
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                <Trash weight="bold" className="w-4 h-4" />
                                Delete
                            </button>
                            <button
                                onClick={clearSelection}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                <X weight="bold" className="w-4 h-4" />
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

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
                                        {uploadQueue.length > 0 && (
                                            <span className="ml-2 text-cyan-400">• {uploadQueue.length} more in queue</span>
                                        )}
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
                    className={`flex-1 overflow-y-auto p-4 lg:p-6 ${dragOver ? 'bg-blue-500/10' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                >
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="spinner" />
                        </div>
                    ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
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
                            {filteredFolders.map((folder: any) => (
                                <button
                                    key={folder.id}
                                    onClick={() => setCurrentFolder(folder.id)}
                                    onContextMenu={(e) => handleContextMenu(e, 'folder', folder)}
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
                            {filteredFiles.map((file: any) => (
                                <div
                                    key={file.id}
                                    className={`glass-card p-4 hover:border-blue-500/50 transition-all group relative ${selectedFiles.has(file.id) ? 'border-blue-500 bg-blue-500/10' : ''
                                        }`}
                                    onClick={() => isSelectionMode && toggleFileSelection(file.id)}
                                    onContextMenu={(e) => handleContextMenu(e, 'file', file)}
                                >
                                    {/* Selection checkbox */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFileSelection(file.id);
                                        }}
                                        className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selectedFiles.has(file.id)
                                            ? 'bg-blue-500 border-blue-500'
                                            : 'border-gray-500 hover:border-blue-400 opacity-0 group-hover:opacity-100'
                                            } ${selectedFiles.has(file.id) ? 'opacity-100' : ''}`}
                                    >
                                        {selectedFiles.has(file.id) && (
                                            <span className="text-white text-xs font-bold">✓</span>
                                        )}
                                    </button>

                                    <div className="flex items-start justify-between mb-3">
                                        <div className="w-12 h-12 rounded-xl bg-gray-500/20 flex items-center justify-center">
                                            {getFileIcon(file.mimeType)}
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDownload(file.id, file.name, file.size);
                                                }}
                                                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-blue-400"
                                                title="Download"
                                            >
                                                <DownloadSimple weight="duotone" className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteFile(file.id, file.name);
                                                }}
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
                            {filteredFolders.map((folder: any) => (
                                <button
                                    key={folder.id}
                                    onClick={() => setCurrentFolder(folder.id)}
                                    onContextMenu={(e) => handleContextMenu(e, 'folder', folder)}
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
                            {filteredFiles.map((file: any) => (
                                <div
                                    key={file.id}
                                    className={`flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-all group ${selectedFiles.has(file.id) ? 'bg-blue-500/10' : ''
                                        }`}
                                    onClick={() => isSelectionMode && toggleFileSelection(file.id)}
                                    onContextMenu={(e) => handleContextMenu(e, 'file', file)}
                                >
                                    {/* Selection checkbox */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFileSelection(file.id);
                                        }}
                                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${selectedFiles.has(file.id)
                                            ? 'bg-blue-500 border-blue-500 opacity-100'
                                            : 'border-gray-500 hover:border-blue-400 opacity-0 group-hover:opacity-100'
                                            } ${selectedFiles.has(file.id) ? 'opacity-100' : ''}`}
                                    >
                                        {selectedFiles.has(file.id) && (
                                            <span className="text-white text-xs font-bold">✓</span>
                                        )}
                                    </button>

                                    <div className="w-10 h-10 rounded-lg bg-gray-500/20 flex items-center justify-center flex-shrink-0">
                                        {getFileIcon(file.mimeType)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium truncate" title={file.name}>{file.name}</h4>
                                        <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDownload(file.id, file.name, file.size);
                                            }}
                                            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-blue-400"
                                            title="Download"
                                        >
                                            <DownloadSimple weight="duotone" className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteFile(file.id, file.name);
                                            }}
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

            {/* Bulk Delete Confirmation Modal */}
            {showBulkDeleteModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="glass-card p-6 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                <Trash weight="duotone" className="w-6 h-6 text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">
                                    Delete {selectedFiles.size} files?
                                </h3>
                                <p className="text-gray-400 text-sm">
                                    This will permanently delete the selected files. This action cannot be undone.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowBulkDeleteModal(false)}
                                disabled={isBulkDeleting}
                                className="btn-secondary text-sm py-2 px-4"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmBulkDelete}
                                disabled={isBulkDeleting}
                                className="bg-red-600 hover:bg-red-500 text-white text-sm py-2 px-4 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
                            >
                                {isBulkDeleting ? (
                                    <>
                                        <SpinnerGap weight="bold" className="w-4 h-4 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash weight="bold" className="w-4 h-4" />
                                        Delete All
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Download Progress Toast (non-blocking) */}
            {downloadProgress && (
                <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
                    <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-white/10 rounded-xl p-4 shadow-2xl min-w-[300px] max-w-[400px]">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                <DownloadSimple weight="duotone" className="w-5 h-5 text-blue-400 animate-bounce" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate" title={downloadProgress.fileName}>
                                    {downloadProgress.fileName}
                                </p>
                                <p className="text-xs text-gray-400">
                                    {formatSize(downloadProgress.loaded)} / {formatSize(downloadProgress.total)}
                                    {downloadQueue.length > 0 && (
                                        <span className="ml-2 text-cyan-400">• {downloadQueue.length} in queue</span>
                                    )}
                                </p>
                            </div>
                            <span className="text-sm font-bold text-blue-400">{downloadProgress.percent}%</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                                style={{ width: `${downloadProgress.percent}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Bot Management Modal */}
            {showBotModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gradient-to-b from-gray-900 to-gray-950 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between mb-6 flex-shrink-0">
                            <h2 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                                Bot Settings
                            </h2>
                            <button
                                onClick={() => setShowBotModal(false)}
                                className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"
                            >
                                <X weight="bold" className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1 -mx-6 px-6">

                            {/* Setup Guide */}
                            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                <h3 className="text-sm font-semibold text-blue-300 mb-3">📋 Setup Guide</h3>

                                <div className="space-y-3 text-xs text-gray-300">
                                    <div>
                                        <p className="font-medium text-white mb-1">1. Create a Bot Token:</p>
                                        <p className="text-gray-400">
                                            Open <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">@BotFather</a> on Telegram → Send <code className="bg-white/10 px-1 rounded">/newbot</code> → Follow the prompts → Copy the token
                                        </p>
                                    </div>

                                    <div>
                                        <p className="font-medium text-white mb-1">2. Get Channel ID:</p>
                                        <p className="text-gray-400">
                                            Open <a href="https://t.me/chat_id_echo_bot" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">@chat_id_echo_bot</a> → Select your channel from the list → Copy the ID (starts with -100)
                                        </p>
                                    </div>

                                    <div>
                                        <p className="font-medium text-white mb-1">3. Add Bots to Channel:</p>
                                        <p className="text-gray-400">
                                            Add each bot as an <span className="text-amber-400 font-medium">Admin</span> to your channel with permission to post messages
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-blue-500/20">
                                    <p className="text-xs text-amber-300 flex items-start gap-2">
                                        <span className="text-amber-400">⚠️</span>
                                        <span><strong>Important:</strong> All bots must be added as admins to ALL channels you configure below.</span>
                                    </p>
                                </div>
                            </div>

                            {/* Channel ID */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-300 mb-2">Channel ID</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newChannelId}
                                        onChange={(e) => setNewChannelId(e.target.value)}
                                        placeholder="-100xxxxxxxxxx"
                                        className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                    {channelId !== newChannelId && (
                                        <button
                                            onClick={handleUpdateChannel}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors"
                                        >
                                            Save
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Add Bot */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-300 mb-2">Add Bot Token</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newBotToken}
                                        onChange={(e) => setNewBotToken(e.target.value)}
                                        placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                                        className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                    <button
                                        onClick={handleAddBot}
                                        disabled={isAddingBot}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
                                    >
                                        {isAddingBot ? <SpinnerGap className="w-5 h-5 animate-spin" /> : <Plus weight="bold" className="w-5 h-5" />}
                                    </button>
                                </div>
                                {botError && (
                                    <p className="text-red-400 text-sm mt-2">{botError}</p>
                                )}
                            </div>

                            {/* Bot List */}
                            <div className="mb-6">
                                <h3 className="text-sm font-medium text-gray-300 mb-3">Configured Bots ({bots.length})</h3>
                                {bots.length === 0 ? (
                                    <p className="text-gray-500 text-sm py-4 text-center">No bots configured. Add your first bot above.</p>
                                ) : (
                                    <div className="space-y-2 max-h-32 overflow-y-auto">
                                        {bots.map((bot, index) => (
                                            <div key={bot.id} className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-sm">
                                                        {index + 1}
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-medium">
                                                            @{bot.username || 'Unknown Bot'}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {bot.isActive ? '🟢 Active' : '🔴 Inactive'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveBot(bot.id)}
                                                    className="p-2 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                                                    title="Remove bot"
                                                >
                                                    <Trash weight="duotone" className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Additional Channels for Throughput */}
                            <div className="border-t border-white/10 pt-6 mb-6">
                                <h3 className="text-sm font-medium text-gray-300 mb-2">
                                    Additional Channels <span className="text-xs text-gray-500">(for faster uploads)</span>
                                </h3>
                                <p className="text-xs text-gray-500 mb-3">
                                    Add more channels to increase upload speed. Each bot can send 20 msg/min per channel.
                                </p>

                                {/* Add Channel */}
                                <div className="flex gap-2 mb-3">
                                    <input
                                        type="text"
                                        value={newAdditionalChannel}
                                        onChange={(e) => setNewAdditionalChannel(e.target.value)}
                                        placeholder="-100xxxxxxxxxx"
                                        className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm"
                                    />
                                    <button
                                        onClick={handleAddChannel}
                                        disabled={isAddingChannel}
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
                                    >
                                        {isAddingChannel ? <SpinnerGap className="w-5 h-5 animate-spin" /> : <Plus weight="bold" className="w-5 h-5" />}
                                    </button>
                                </div>
                                {channelError && (
                                    <p className="text-red-400 text-sm mb-3">{channelError}</p>
                                )}

                                {/* Channel List */}
                                {additionalChannels.length > 0 && (
                                    <div className="space-y-2 max-h-24 overflow-y-auto">
                                        {additionalChannels.map((ch, index) => (
                                            <div key={ch.id} className="flex items-center justify-between px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-purple-400 text-sm font-mono">{ch.channelId}</span>
                                                    {ch.name && <span className="text-gray-400 text-xs">({ch.name})</span>}
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveChannel(ch.id)}
                                                    className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors"
                                                    title="Remove channel"
                                                >
                                                    <Trash weight="duotone" className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Scrollable container ends here */}
                        </div>

                        <div className="pt-4 border-t border-white/10 flex-shrink-0">
                            <p className="text-xs text-gray-500 text-center">
                                {bots.length} bot{bots.length !== 1 ? 's' : ''} × {1 + additionalChannels.length} channel{additionalChannels.length !== 0 ? 's' : ''} = {bots.length * (1 + additionalChannels.length) * 20} msg/min max
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 bg-gray-800 border border-white/10 rounded-lg shadow-xl py-1 min-w-48"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {contextMenu.type === 'file' && (
                        <button
                            onClick={() => {
                                handleDownload(contextMenu.item.id, contextMenu.item.name, Number(contextMenu.item.size));
                                closeContextMenu();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 text-gray-300 hover:text-white text-sm"
                        >
                            <DownloadSimple weight="duotone" className="w-4 h-4" />
                            Download
                        </button>
                    )}
                    <button
                        onClick={handleMoveAction}
                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 text-gray-300 hover:text-white text-sm"
                    >
                        <ArrowRight weight="duotone" className="w-4 h-4" />
                        Move to...
                    </button>
                    <div className="border-t border-white/10 my-1" />
                    <button
                        onClick={() => {
                            showDeleteConfirm(contextMenu.type, contextMenu.item.id, contextMenu.item.name);
                            closeContextMenu();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-red-500/10 text-red-400 hover:text-red-300 text-sm"
                    >
                        <Trash weight="duotone" className="w-4 h-4" />
                        Delete
                    </button>
                </div>
            )}

            {/* Move Modal */}
            {showMoveModal && moveItem && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="glass-card p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4">
                            Move "{moveItem.name}"
                        </h3>
                        <p className="text-sm text-gray-400 mb-4">Select destination folder:</p>

                        <div className="max-h-64 overflow-y-auto bg-black/20 rounded-lg p-2 mb-4">
                            {/* Root option */}
                            <button
                                onClick={() => confirmMove(null)}
                                disabled={isMoving}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-left text-gray-300 hover:text-white"
                            >
                                <House weight="duotone" className="w-4 h-4 text-blue-400" />
                                Root (All Files)
                            </button>

                            {/* Folder tree */}
                            {folderTree.map((folder: any) => (
                                <FolderTreeItem
                                    key={folder.id}
                                    folder={folder}
                                    depth={0}
                                    onSelect={(folderId) => confirmMove(folderId)}
                                    disabled={isMoving || (moveItem.type === 'folder' && folder.id === moveItem.id)}
                                    moveItemId={moveItem.type === 'folder' ? moveItem.id : undefined}
                                />
                            ))}
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => { setShowMoveModal(false); setMoveItem(null); }}
                                className="btn-secondary"
                                disabled={isMoving}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
