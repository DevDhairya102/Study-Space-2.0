import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Music as MusicIcon,
  File as FileIcon,
  Clock as ClockIcon,
  Settings as SettingsIcon,
  UploadCloud,
  Search,
  Trash2,
  Download,
  Eye,
  Plus,
  Check,
  AlertCircle,
  X,
  Bell,
  RefreshCw,
  Database,
  Cloud,
  Sparkles
} from 'lucide-react';
import type {
  SharedFile,
  SupabaseConfig
} from './storage';
import {
  getFileCategory,
  formatBytes,
  getSavedSyncConfig,
  saveSyncConfig,
  getMetadataList,
  saveMetadataList,
  saveFileBlobLocal,
  deleteFileFromSpace,
  getFileDownloadUrl,
  syncWithCloud
} from './storage';

// Interfaces
interface Reminder {
  id: string;
  title: string;
  time: string; // "HH:MM"
  active: boolean;
  priority: 'low' | 'medium' | 'high';
  triggeredToday?: boolean;
}

interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface SyncLog {
  timestamp: string;
  text: string;
}

export default function App() {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<'files' | 'clock' | 'settings'>('files');

  // File explorer states
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // File preview modal
  const [previewFile, setPreviewFile] = useState<SharedFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [textPreviewContent, setTextPreviewContent] = useState<string>('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Clock & Alarm states
  const [currentTime, setCurrentTime] = useState(new Date());
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [alarmForm, setAlarmForm] = useState({
    title: '',
    time: '',
    priority: 'medium' as Reminder['priority']
  });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Active alarm firing modal
  const [activeAlarm, setActiveAlarm] = useState<Reminder | null>(null);
  const audioIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Settings & Sync states
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig | null>(null);
  const [configInputs, setConfigInputs] = useState({
    url: '',
    anonKey: '',
    bucketName: ''
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

  // Toast System
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [theme, setTheme] = useState<'rose' | 'midnight' | 'earth'>('rose');

  // Load initial data
  useEffect(() => {
    // Load theme
    const savedTheme = localStorage.getItem('file_sharer_theme') as 'rose' | 'midnight' | 'earth';
    if (savedTheme) {
      setTheme(savedTheme);
      document.body.className = `theme-${savedTheme}`;
    } else {
      document.body.className = 'theme-rose';
    }

    // Load files
    getMetadataList().then(list => setFiles(list));

    // Load alarms from LocalStorage
    try {
      const savedReminders = localStorage.getItem('file_sharer_reminders');
      if (savedReminders) {
        setReminders(JSON.parse(savedReminders));
      }
    } catch (e) {
      console.error('Failed to load reminders', e);
    }

    // Load Sync Settings
    const config = getSavedSyncConfig();
    if (config) {
      setSupabaseConfig(config);
      setConfigInputs({
        url: config.url,
        anonKey: config.anonKey,
        bucketName: config.bucketName
      });
      
      // Auto-sync in the background on mount so new files from other devices appear automatically!
      setIsSyncing(true);
      syncWithCloud(config)
        .then(res => {
          if (res.success) {
            setFiles(res.updatedList);
          }
        })
        .catch(err => console.error('Auto-sync error on mount:', err))
        .finally(() => setIsSyncing(false));
    }

    // Read initial Notification state
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Save reminders to LocalStorage when changed
  useEffect(() => {
    localStorage.setItem('file_sharer_reminders', JSON.stringify(reminders));
  }, [reminders]);

  // Clock tick interval
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      // Check Alarms every second
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const timeString = `${currentHours}:${currentMinutes}`;

      reminders.forEach(reminder => {
        if (
          reminder.active &&
          reminder.time === timeString &&
          !reminder.triggeredToday &&
          now.getSeconds() === 0 // Trigger exactly at start of minute
        ) {
          triggerAlarm(reminder);
        }
      });

      // Reset triggeredToday flag at midnight
      if (currentHours === '00' && currentMinutes === '00' && now.getSeconds() === 0) {
        setReminders(prev => prev.map(r => ({ ...r, triggeredToday: false })));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [reminders]);

  // Request Notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        showToast('Notifications enabled successfully!', 'success');
      } else {
        showToast('Notification permission denied or dismissed.', 'warning');
      }
    }
  };

  // Toast notification helper
  const showToast = (text: string, type: ToastMessage['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Theme changer helper
  const handleThemeChange = (newTheme: 'rose' | 'midnight' | 'earth') => {
    setTheme(newTheme);
    localStorage.setItem('file_sharer_theme', newTheme);
    document.body.className = `theme-${newTheme}`;
    showToast(`Theme switched to ${newTheme === 'rose' ? 'Warm Rose' : newTheme === 'midnight' ? 'Midnight Desert' : 'Cozy Earth'}!`, 'info');
  };

  // Log Sync event helper
  const addSyncLog = (text: string) => {
    const timeStr = new Date().toLocaleTimeString();
    setSyncLogs(prev => [...prev, { timestamp: timeStr, text }]);
  };

  // Audio chimer helper using Web Audio API
  const playElectronicChime = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      
      // Resume if suspended (browser security)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Play 3 tones in quick sequence
      const playTone = (freq: number, startDelay: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Alternate waves to create retro synthesizer feel
        osc.type = freq > 600 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startDelay);

        gain.gain.setValueAtTime(0, ctx.currentTime + startDelay);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + startDelay + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startDelay + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + startDelay);
        osc.stop(ctx.currentTime + startDelay + duration);
      };

      // Create a nice synthesizer alert sound (arpeggio)
      playTone(523.25, 0, 0.4);   // C5
      playTone(659.25, 0.15, 0.4); // E5
      playTone(783.99, 0.3, 0.6);   // G5
    } catch (e) {
      console.error('Audio synthesis failed', e);
    }
  };

  // Triggering Alarms
  const triggerAlarm = (reminder: Reminder) => {
    // 1. Set active alarm state (opens dialog)
    setActiveAlarm(reminder);

    // 2. Play Audio synthesised chime, and repeat every 2.5 seconds
    playElectronicChime();
    audioIntervalRef.current = window.setInterval(() => {
      playElectronicChime();
    }, 2500);

    // 3. Native Browser Notification
    if (Notification.permission === 'granted') {
      new Notification(`Reminder: ${reminder.title || 'Alarm!'}`, {
        body: `Scheduled for ${reminder.time}. Priority: ${reminder.priority.toUpperCase()}`,
        icon: '/favicon.ico'
      });
    }

    // 4. Mark reminder as triggered for today
    setReminders(prev =>
      prev.map(r => (r.id === reminder.id ? { ...r, triggeredToday: true } : r))
    );
  };

  // Dismissing Alarm
  const dismissAlarm = () => {
    if (audioIntervalRef.current) {
      window.clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
    setActiveAlarm(null);
    showToast('Alarm dismissed', 'info');
  };

  // Add Reminder
  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alarmForm.title || !alarmForm.time) {
      showToast('Please fill in both title and time.', 'error');
      return;
    }

    const newReminder: Reminder = {
      id: Math.random().toString(36).substring(2, 9),
      title: alarmForm.title,
      time: alarmForm.time,
      active: true,
      priority: alarmForm.priority
    };

    setReminders(prev => [newReminder, ...prev]);
    setAlarmForm({ title: '', time: '', priority: 'medium' });
    showToast(`Reminder "${newReminder.title}" set successfully!`, 'success');
  };

  // Toggle Reminder Status
  const toggleReminder = (id: string) => {
    setReminders(prev =>
      prev.map(r => (r.id === id ? { ...r, active: !r.active, triggeredToday: false } : r))
    );
  };

  // Delete Reminder
  const deleteReminder = (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    showToast('Reminder deleted', 'info');
  };

  // Drag & Drop Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFilesUpload(e.target.files);
    }
  };

  // Core file upload implementation
  const handleFilesUpload = async (fileList: FileList) => {
    setUploadProgress(0);
    const totalFiles = fileList.length;
    let successCount = 0;

    for (let i = 0; i < totalFiles; i++) {
      const file = fileList[i];
      const category = getFileCategory(file.type, file.name);
      
      const newFileMetadata: SharedFile = {
        id: Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
        category,
        isSynced: false
      };

      try {
        // Save raw content in IndexedDB
        await saveFileBlobLocal(newFileMetadata.id, file);

        // Add to local state metadata list
        setFiles(prev => {
          const updated = [newFileMetadata, ...prev];
          saveMetadataList(updated);
          return updated;
        });

        successCount++;
        setUploadProgress(Math.round((successCount / totalFiles) * 100));

        // Auto sync if cloud is connected!
        if (supabaseConfig) {
          triggerBackgroundSync();
        }
      } catch (err) {
        console.error('File write error', err);
        showToast(`Failed to upload ${file.name}`, 'error');
      }
    }

    showToast(`Uploaded ${successCount} file(s) successfully!`, 'success');
    setTimeout(() => setUploadProgress(null), 1000);
  };

  // Trigger background cloud synchronisation
  const triggerBackgroundSync = async () => {
    if (!supabaseConfig) return;
    try {
      const result = await syncWithCloud(supabaseConfig);
      if (result.success) {
        setFiles(result.updatedList);
        showToast('Synced files with cloud storage', 'success');
      }
    } catch (e) {
      console.error('Auto sync failed', e);
    }
  };

  // Delete file handler
  const handleFileDelete = async (file: SharedFile) => {
    try {
      const updated = await deleteFileFromSpace(file, supabaseConfig);
      setFiles(updated);
      showToast(`Deleted file ${file.name}`, 'info');
    } catch (e) {
      console.error(e);
      showToast('Could not delete file', 'error');
    }
  };

  // Preview File Handler
  const handleFilePreview = async (file: SharedFile) => {
    setLoadingPreview(true);
    setPreviewFile(file);
    try {
      const url = await getFileDownloadUrl(file, supabaseConfig);
      setPreviewUrl(url);

      // Read text contents for document rendering
      if (file.category === 'document' && (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.json'))) {
        const response = await fetch(url);
        const text = await response.text();
        setTextPreviewContent(text);
      } else {
        setTextPreviewContent('');
      }
    } catch (e: any) {
      console.error(e);
      showToast(`Error opening preview: ${e.message}`, 'error');
      setPreviewFile(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleClosePreview = () => {
    // Revoke object URL to prevent memory leaks
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewFile(null);
    setPreviewUrl('');
    setTextPreviewContent('');
  };

  // Direct File Download
  const handleFileDownload = async (file: SharedFile) => {
    try {
      const url = await getFileDownloadUrl(file, supabaseConfig);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`Downloading ${file.name}...`, 'info');
    } catch (e: any) {
      showToast(`Download failed: ${e.message}`, 'error');
    }
  };

  // Save Settings Config
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configInputs.url || !configInputs.anonKey || !configInputs.bucketName) {
      showToast('Please fill out all Supabase configuration fields.', 'error');
      return;
    }

    const config: SupabaseConfig = {
      url: configInputs.url.trim(),
      anonKey: configInputs.anonKey.trim(),
      bucketName: configInputs.bucketName.trim()
    };

    setIsSyncing(true);
    setSyncLogs([]);
    addSyncLog('Initializing connection...');

    try {
      const res = await syncWithCloud(config, text => addSyncLog(text));
      if (res.success) {
        saveSyncConfig(config);
        setSupabaseConfig(config);
        setFiles(res.updatedList);
        addSyncLog('Sync successful! Configuration saved.');
        showToast('Supabase connected and files synced!', 'success');
      } else {
        addSyncLog(`Sync failed: ${res.error}`);
        showToast(`Sync failed: ${res.error}`, 'error');
      }
    } catch (err: any) {
      addSyncLog(`Connection error: ${err.message}`);
      showToast(`Connection failed: ${err.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Force Manual Synchronisation
  const handleManualSync = async () => {
    if (!supabaseConfig) return;
    setIsSyncing(true);
    setSyncLogs([]);
    addSyncLog('Starting manual sync...');
    try {
      const res = await syncWithCloud(supabaseConfig, text => addSyncLog(text));
      if (res.success) {
        setFiles(res.updatedList);
        addSyncLog('Manual sync successfully completed.');
        showToast('All files synced!', 'success');
      } else {
        addSyncLog(`Sync failed: ${res.error}`);
        showToast(`Sync failed: ${res.error}`, 'error');
      }
    } catch (err: any) {
      addSyncLog(`Sync error: ${err.message}`);
      showToast(`Sync error: ${err.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Disconnect Cloud Storage
  const handleDisconnectCloud = () => {
    saveSyncConfig(null);
    setSupabaseConfig(null);
    setConfigInputs({ url: '', anonKey: '', bucketName: '' });
    setSyncLogs([]);
    showToast('Supabase cloud storage disconnected', 'info');
  };

  // Filtered files view
  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || file.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Category Icon helper
  const getCategoryIcon = (category: SharedFile['category']) => {
    switch (category) {
      case 'photo': return <ImageIcon size={20} />;
      case 'document': return <FileText size={20} />;
      case 'video': return <VideoIcon size={20} />;
      case 'audio': return <MusicIcon size={20} />;
      default: return <FileIcon size={20} />;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="app-sidebar">
        <div className="logo-section">
          <div className="logo-icon">
            <Sparkles size={24} />
          </div>
          <span className="logo-text">StudySpace</span>
        </div>

        <nav className="nav-links">
          <button
            className={`nav-button ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            <Folder size={20} />
            <span>File Sharer</span>
          </button>
          <button
            className={`nav-button ${activeTab === 'clock' ? 'active' : ''}`}
            onClick={() => setActiveTab('clock')}
          >
            <ClockIcon size={20} />
            <span>Reminder Clock</span>
          </button>
          <button
            className={`nav-button ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <SettingsIcon size={20} />
            <span>Cloud Sync Settings</span>
          </button>
        </nav>

        {/* Theme Switcher Widget */}
        <div className="theme-switcher-container">
          <span className="theme-switcher-label">Select Theme</span>
          <div className="theme-pills">
            <button
              className={`theme-pill-btn ${theme === 'rose' ? 'active' : ''}`}
              title="Warm Rose Palette"
              onClick={() => handleThemeChange('rose')}
            >
              <span className="color-dot pink" />
              <span className="color-dot cream" />
              <span className="color-dot teal" />
            </button>
            <button
              className={`theme-pill-btn ${theme === 'midnight' ? 'active' : ''}`}
              title="Midnight Desert Palette"
              onClick={() => handleThemeChange('midnight')}
            >
              <span className="color-dot midnight-navy" />
              <span className="color-dot midnight-charcoal" />
              <span className="color-dot midnight-peach" />
            </button>
            <button
              className={`theme-pill-btn ${theme === 'earth' ? 'active' : ''}`}
              title="Cozy Earth Palette"
              onClick={() => handleThemeChange('earth')}
            >
              <span className="color-dot earth-khaki" />
              <span className="color-dot earth-sand" />
              <span className="color-dot earth-linen" />
            </button>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="sync-status-indicator">
            <div className={`status-dot ${supabaseConfig ? 'active' : 'inactive'}`} />
            <span>{supabaseConfig ? 'Cloud Synced' : 'Local Mode'}</span>
          </div>
          <span style={{ color: 'var(--text-muted)' }}>
            Files: {files.length} ({files.filter(f => f.isSynced).length} synced)
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            Alarms Active: {reminders.filter(r => r.active).length}
          </span>
        </div>
      </aside>

      {/* Main viewport content */}
      <main className="app-content">
        
        {/* TAB 1: FILE SHARER */}
        {activeTab === 'files' && (
          <div className="files-explorer">
            <header className="page-header">
              <div className="page-title">
                <h1>Important Study Materials</h1>
                <p>Upload, store, preview and organize your lectures, notes, PDFs and photos.</p>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {supabaseConfig && (
                  <button className="btn-secondary" onClick={handleManualSync} disabled={isSyncing} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem' }}>
                    <RefreshCw size={16} className={isSyncing ? 'spin-anim' : ''} />
                    <span>Sync Now</span>
                  </button>
                )}
              </div>
            </header>

            {/* Drag & Drop Upload Zone */}
            <div
              className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-picker')?.click()}
            >
              <input
                id="file-picker"
                type="file"
                multiple
                className="file-input-hidden"
                onChange={handleFileChange}
              />
              <div className="upload-icon-container">
                <UploadCloud size={32} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>Drag & Drop study materials here</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  or click to browse from device (PDFs, images, notes, zip, videos, audio)
                </p>
              </div>
              {uploadProgress !== null && (
                <div style={{ width: '80%', maxWidth: '300px', background: 'var(--bg-tertiary)', height: '6px', borderRadius: '3px', marginTop: '1rem', overflow: 'hidden' }}>
                  <div style={{ width: `${uploadProgress}%`, background: 'var(--accent-primary)', height: '100%', transition: 'width 0.2s' }} />
                </div>
              )}
            </div>

            {/* Control Filters */}
            <div className="explorer-controls">
              <div className="search-bar">
                <Search size={18} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search file name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="category-pills">
                {['all', 'document', 'photo', 'video', 'audio', 'other'].map(cat => (
                  <button
                    key={cat}
                    className={`pill-button ${categoryFilter === cat ? 'active' : ''}`}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    <span>{cat.charAt(0).toUpperCase() + cat.slice(1)}s</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Files Grid View */}
            {filteredFiles.length > 0 ? (
              <div className="files-grid">
                {filteredFiles.map(file => (
                  <div key={file.id} className={`file-card ${file.category}`}>
                    <div className="file-card-top">
                      <div className="file-icon-wrapper">
                        {getCategoryIcon(file.category)}
                      </div>
                      <span className={`sync-badge ${file.isSynced ? 'synced' : 'local'}`}>
                        {file.isSynced ? <Cloud size={12} /> : <Database size={12} />}
                        {file.isSynced ? 'Cloud' : 'Local'}
                      </span>
                    </div>

                    <div className="file-meta-main">
                      <h4 className="file-name" title={file.name}>
                        {file.name}
                      </h4>
                      <div className="file-size-date">
                        <span>Size: {formatBytes(file.size)}</span>
                        <span>Uploaded: {file.uploadedAt}</span>
                      </div>
                    </div>

                    <div className="file-card-actions">
                      <button
                        className="action-btn"
                        title="Preview File"
                        onClick={() => handleFilePreview(file)}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="action-btn"
                        title="Download"
                        onClick={() => handleFileDownload(file)}
                      >
                        <Download size={16} />
                      </button>
                      <button
                        className="action-btn delete"
                        title="Delete"
                        onClick={() => handleFileDelete(file)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Folder size={36} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>No files found</h3>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    {searchQuery ? 'Try adjusting your search query' : 'Upload your first study material to get started!'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: REMINDER CLOCK */}
        {activeTab === 'clock' && (
          <div className="files-explorer">
            <header className="page-header">
              <div className="page-title">
                <h1>Clock & Reminders</h1>
                <p>Set electronic timers and notification alarms to help stay focused on your study routines.</p>
              </div>
              <div>
                {notificationPermission !== 'granted' && (
                  <button className="btn-primary" onClick={requestNotificationPermission} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem' }}>
                    <Bell size={16} />
                    <span>Enable Desktop Alarms</span>
                  </button>
                )}
              </div>
            </header>

            <div className="clock-dashboard">
              {/* Floating glowing clock widget */}
              <div className="clock-card">
                <div className="digital-time">
                  {currentTime.toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  })}
                  <span className="seconds">
                    {String(currentTime.getSeconds()).padStart(2, '0')}
                  </span>
                </div>
                <div className="digital-date">
                  {currentTime.toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
                <div className="digital-timezone">
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </div>
              </div>

              {/* Reminder management and setting */}
              <div className="reminders-section">
                <form className="reminder-form-card" onSubmit={handleAddReminder}>
                  <h3 className="form-title">
                    <Plus size={20} />
                    Create Study Reminder
                  </h3>
                  
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label htmlFor="alarm-title">Reminder Goal</label>
                      <input
                        id="alarm-title"
                        type="text"
                        placeholder="e.g. Solve Math Assignment, Chemistry quiz study..."
                        value={alarmForm.title}
                        onChange={e => setAlarmForm(prev => ({ ...prev, title: e.target.value }))}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="alarm-time">Alarm Time</label>
                      <input
                        id="alarm-time"
                        type="time"
                        value={alarmForm.time}
                        onChange={e => setAlarmForm(prev => ({ ...prev, time: e.target.value }))}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="alarm-priority">Priority</label>
                      <select
                        id="alarm-priority"
                        value={alarmForm.priority}
                        onChange={e => setAlarmForm(prev => ({ ...prev, priority: e.target.value as Reminder['priority'] }))}
                      >
                        <option value="low">Low (Chime)</option>
                        <option value="medium">Medium (Standard)</option>
                        <option value="high">High (Loud Alarm)</option>
                      </select>
                    </div>
                  </div>

                  <button type="submit" className="btn-primary">
                    Create Alarm Clock
                  </button>
                </form>

                {/* Alarm Checklist */}
                <div className="reminders-list-container">
                  <h3 className="reminders-list-header">Active Alarms ({reminders.length})</h3>
                  {reminders.length > 0 ? (
                    <div className="reminders-list">
                      {reminders.map(reminder => (
                        <div key={reminder.id} className={`reminder-item ${!reminder.active ? 'inactive' : ''}`}>
                          <div className="reminder-item-left">
                            <div className={`reminder-priority-indicator ${reminder.priority}`} title={`Priority: ${reminder.priority}`} />
                            <div className="reminder-info">
                              <span className="reminder-time">{reminder.time}</span>
                              <span className="reminder-label">{reminder.title}</span>
                            </div>
                          </div>

                          <div className="reminder-item-actions">
                            <label className="switch">
                              <input
                                type="checkbox"
                                checked={reminder.active}
                                onChange={() => toggleReminder(reminder.id)}
                              />
                              <span className="slider" />
                            </label>
                            <button
                              className="action-btn delete"
                              title="Delete Alarm"
                              onClick={() => deleteReminder(reminder.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: '2rem' }}>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No reminder clocks set.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CLOUD SYNC SETTINGS */}
        {activeTab === 'settings' && (
          <div className="settings-container">
            <header className="page-header">
              <div className="page-title">
                <h1>Cloud Storage Sync</h1>
                <p>Integrate your own free-tier Supabase project bucket to access your uploaded study material from any device via your Vercel link!</p>
              </div>
            </header>

            <div className="settings-card">
              <h3 className="settings-section-title">
                <Database size={20} />
                Supabase Credentials
              </h3>

              <div className="settings-info-alert">
                <AlertCircle size={24} style={{ color: 'var(--info)', flexShrink: 0 }} />
                <div>
                  <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>How to connect your storage:</p>
                  <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <li>Create a free project at <code>supabase.com</code>.</li>
                    <li>Go to Storage and create a new **Public** bucket named e.g. <code>files</code>.</li>
                    <li>Go to Project Settings &gt; API, and copy the **Project URL** and **anon public API key**.</li>
                    <li>Paste them here. Files uploaded locally will immediately sync up to your secure cloud bucket, keeping you organized!</li>
                  </ol>
                </div>
              </div>

              <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label htmlFor="settings-url">Supabase Project URL</label>
                  <input
                    id="settings-url"
                    type="url"
                    placeholder="https://your-project-id.supabase.co"
                    value={configInputs.url}
                    onChange={e => setConfigInputs(prev => ({ ...prev, url: e.target.value }))}
                    disabled={isSyncing}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="settings-key">Supabase Public API Anon Key</label>
                  <input
                    id="settings-key"
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={configInputs.anonKey}
                    onChange={e => setConfigInputs(prev => ({ ...prev, anonKey: e.target.value }))}
                    disabled={isSyncing}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="settings-bucket">Supabase Storage Bucket Name</label>
                  <input
                    id="settings-bucket"
                    type="text"
                    placeholder="e.g. files, studies, bucket-name"
                    value={configInputs.bucketName}
                    onChange={e => setConfigInputs(prev => ({ ...prev, bucketName: e.target.value }))}
                    disabled={isSyncing}
                  />
                </div>

                <div className="settings-actions">
                  <button type="submit" className="btn-primary" disabled={isSyncing} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isSyncing ? <RefreshCw size={16} className="spin-anim" /> : <Check size={16} />}
                    <span>{supabaseConfig ? 'Update & Re-sync' : 'Test Connection & Connect'}</span>
                  </button>
                  
                  {supabaseConfig && (
                    <button type="button" className="btn-secondary" onClick={handleDisconnectCloud} disabled={isSyncing} style={{ color: 'var(--danger)' }}>
                      Disconnect Cloud
                    </button>
                  )}
                </div>
              </form>

              {/* Sync Logging details */}
              {(syncLogs.length > 0 || isSyncing) && (
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Connection Terminal:</h4>
                  <div className="sync-log-terminal">
                    {syncLogs.map((log, index) => (
                      <div key={index} className="sync-log-line">
                        <span className="timestamp">[{log.timestamp}]</span>
                        <span>{log.text}</span>
                      </div>
                    ))}
                    {isSyncing && (
                      <div className="sync-log-line" style={{ color: 'var(--text-secondary)' }}>
                        <span className="timestamp">[{new Date().toLocaleTimeString()}]</span>
                        <span>Processing sync operation...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: FILE PREVIEW */}
      {previewFile && (
        <div className="modal-overlay" onClick={handleClosePreview}>
          <div className="modal-content preview-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{previewFile.name}</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '1rem' }}>
                ({formatBytes(previewFile.size)})
              </span>
              <button className="modal-close-btn" onClick={handleClosePreview}>
                <X size={18} />
              </button>
            </div>

            {loadingPreview ? (
              <div className="preview-viewer-body">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <RefreshCw size={36} className="spin-anim" style={{ color: 'var(--accent-primary)' }} />
                  <p style={{ color: 'var(--text-secondary)' }}>Retrieving file content...</p>
                </div>
              </div>
            ) : (
              <div className="preview-viewer-body">
                {previewFile.category === 'photo' && previewUrl && (
                  <img src={previewUrl} alt={previewFile.name} />
                )}

                {previewFile.category === 'video' && previewUrl && (
                  <video src={previewUrl} controls autoPlay />
                )}

                {previewFile.category === 'audio' && previewUrl && (
                  <audio src={previewUrl} controls autoPlay />
                )}

                {previewFile.category === 'document' && textPreviewContent && (
                  <div className="text-preview-scroll">
                    {textPreviewContent}
                  </div>
                )}

                {/* For non-previewable files (PDF, archives, office docs) */}
                {(!previewUrl || 
                  (previewFile.category === 'document' && !textPreviewContent) ||
                  previewFile.category === 'other') && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', color: 'var(--text-secondary)', padding: '3rem 2rem' }}>
                    <FileIcon size={64} style={{ color: 'var(--text-muted)' }} />
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontWeight: 600, color: 'white', marginBottom: '0.25rem' }}>No in-browser preview available</p>
                      <p style={{ fontSize: '0.85rem' }}>This file type ({previewFile.type || 'unknown'}) cannot be previewed directly.</p>
                    </div>
                    <button className="btn-primary" onClick={() => handleFileDownload(previewFile)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem' }}>
                      <Download size={18} />
                      <span>Download file to view</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: ALARM CLOCK TRIGGERED */}
      {activeAlarm && (
        <div className="modal-overlay">
          <div className="modal-content alarm-modal-content">
            <div className="alarm-icon-glowing">
              <Bell size={40} />
            </div>
            <div className="alarm-title-heading">ALARM CLOCK TRIGGERED</div>
            <div className="alarm-label-text">
              {activeAlarm.title || 'Study session reminder!'}
            </div>
            
            <div className="alarm-actions">
              <button className="btn-alarm-dismiss" onClick={dismissAlarm}>
                Dismiss Alarm Clock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST SYSTEM CONTAINER */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.type === 'error' && <AlertCircle size={18} style={{ color: 'var(--danger)' }} />}
            {toast.type === 'success' && <Check size={18} style={{ color: 'var(--success)' }} />}
            <span>{toast.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
