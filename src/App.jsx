import React, { useState, useEffect, useRef } from "react";
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
  Sparkles,
  ExternalLink,
  Calendar
} from "lucide-react";
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
} from "./storage";
export default function App() {
  const [activeTab, setActiveTab] = useState("files");
  const [files, setFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [textPreviewContent, setTextPreviewContent] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [currentTime, setCurrentTime] = useState(/* @__PURE__ */ new Date());
  const [reminders, setReminders] = useState(() => {
    try {
      const saved = localStorage.getItem("file_sharer_reminders");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse reminders from localStorage", e);
      return [];
    }
  });
  const [alarmForm, setAlarmForm] = useState({
    title: "",
    time: "",
    priority: "medium"
  });
  const [notificationPermission, setNotificationPermission] = useState("default");
  const [activeAlarm, setActiveAlarm] = useState(null);
  const audioIntervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const [supabaseConfig, setSupabaseConfig] = useState(null);
  const [configInputs, setConfigInputs] = useState({
    url: "",
    anonKey: "",
    bucketName: ""
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useState("rose");
  useEffect(() => {
    const savedTheme = localStorage.getItem("file_sharer_theme");
    if (savedTheme) {
      setTheme(savedTheme);
      document.body.className = `theme-${savedTheme}`;
    } else {
      document.body.className = "theme-rose";
    }
    getMetadataList().then((list) => setFiles(list));
    const config = getSavedSyncConfig();
    if (config) {
      setSupabaseConfig(config);
      setConfigInputs({
        url: config.url,
        anonKey: config.anonKey,
        bucketName: config.bucketName
      });
      setIsSyncing(true);
      syncWithCloud(config).then((res) => {
        if (res.success) {
          setFiles(res.updatedList);
        }
      }).catch((err) => console.error("Auto-sync error on mount:", err)).finally(() => setIsSyncing(false));
    }
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("file_sharer_reminders", JSON.stringify(reminders));
  }, [reminders]);
  useEffect(() => {
    const timer = setInterval(() => {
      const now = /* @__PURE__ */ new Date();
      setCurrentTime(now);
      const currentHours = String(now.getHours()).padStart(2, "0");
      const currentMinutes = String(now.getMinutes()).padStart(2, "0");
      const timeString = `${currentHours}:${currentMinutes}`;
      reminders.forEach((reminder) => {
        if (reminder.active && reminder.time === timeString && !reminder.triggeredToday && now.getSeconds() === 0) {
          triggerAlarm(reminder);
        }
      });
      if (currentHours === "00" && currentMinutes === "00" && now.getSeconds() === 0) {
        setReminders((prev) => prev.map((r) => ({ ...r, triggeredToday: false })));
      }
    }, 1e3);
    return () => clearInterval(timer);
  }, [reminders]);
  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        showToast("Notifications enabled successfully!", "success");
      } else {
        showToast("Notification permission denied or dismissed.", "warning");
      }
    }
  };
  const showToast = (text, type = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4e3);
  };
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem("file_sharer_theme", newTheme);
    document.body.className = `theme-${newTheme}`;
    showToast(`Theme switched to ${newTheme === "rose" ? "Warm Rose" : newTheme === "midnight" ? "Midnight Desert" : "Cozy Earth"}!`, "info");
  };
  const addSyncLog = (text) => {
    const timeStr = (/* @__PURE__ */ new Date()).toLocaleTimeString();
    setSyncLogs((prev) => [...prev, { timestamp: timeStr, text }]);
  };
  const playElectronicChime = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const playTone = (freq, startDelay, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = freq > 600 ? "sine" : "triangle";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startDelay);
        gain.gain.setValueAtTime(0, ctx.currentTime + startDelay);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + startDelay + 0.05);
        gain.gain.exponentialRampToValueAtTime(1e-4, ctx.currentTime + startDelay + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + startDelay);
        osc.stop(ctx.currentTime + startDelay + duration);
      };
      playTone(523.25, 0, 0.4);
      playTone(659.25, 0.15, 0.4);
      playTone(783.99, 0.3, 0.6);
    } catch (e) {
      console.error("Audio synthesis failed", e);
    }
  };
  const triggerAlarm = (reminder) => {
    setActiveAlarm(reminder);
    playElectronicChime();
    audioIntervalRef.current = window.setInterval(() => {
      playElectronicChime();
    }, 2500);
    if (Notification.permission === "granted") {
      new Notification(`Reminder: ${reminder.title || "Alarm!"}`, {
        body: `Scheduled for ${reminder.time}. Priority: ${reminder.priority.toUpperCase()}`,
        icon: "/favicon.ico"
      });
    }
    setReminders(
      (prev) => prev.map((r) => r.id === reminder.id ? { ...r, triggeredToday: true } : r)
    );
  };
  const dismissAlarm = () => {
    if (audioIntervalRef.current) {
      window.clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
    setActiveAlarm(null);
    showToast("Alarm dismissed", "info");
  };
  const handleAddReminder = (e) => {
    e.preventDefault();
    if (!alarmForm.title || !alarmForm.time) {
      showToast("Please fill in both title and time.", "error");
      return;
    }
    const newReminder = {
      id: Math.random().toString(36).substring(2, 9),
      title: alarmForm.title,
      time: alarmForm.time,
      active: true,
      priority: alarmForm.priority
    };
    setReminders((prev) => [newReminder, ...prev]);
    setAlarmForm({ title: "", time: "", priority: "medium" });
    showToast(`Reminder "${newReminder.title}" set successfully!`, "success");
  };
  const toggleReminder = (id) => {
    setReminders(
      (prev) => prev.map((r) => r.id === id ? { ...r, active: !r.active, triggeredToday: false } : r)
    );
  };
  const deleteReminder = (id) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    showToast("Reminder deleted", "info");
  };
  const getGoogleCalendarUrl = (reminder) => {
    const now = new Date();
    const [hours, minutes] = reminder.time.split(":");
    const targetDate = new Date();
    targetDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // If the target time has already passed today, schedule for tomorrow!
    if (targetDate.getTime() < now.getTime()) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, "0");
    const day = String(targetDate.getDate()).padStart(2, "0");
    const dateStr = `${year}${month}${day}`;
    
    const startTime = `${dateStr}T${hours}${minutes}00`;
    const endMin = (parseInt(minutes) + 30) % 60;
    const endHours = (parseInt(hours) + Math.floor((parseInt(minutes) + 30) / 60)) % 24;
    
    // If end hours roll over, end date rolls over to next day
    const endDate = new Date(targetDate);
    if (endHours < parseInt(hours)) {
      endDate.setDate(endDate.getDate() + 1);
    }
    const endYear = endDate.getFullYear();
    const endMonth = String(endDate.getMonth() + 1).padStart(2, "0");
    const endDay = String(endDate.getDate()).padStart(2, "0");
    const endDateStr = `${endYear}${endMonth}${endDay}`;
    
    const endTime = `${endDateStr}T${String(endHours).padStart(2, "0")}${String(endMin).padStart(2, "0")}00`;
    const title = encodeURIComponent(`StudySpace: ${reminder.title}`);
    const details = encodeURIComponent(`StudySpace 2.0 reminder alarm. Priority: ${reminder.priority.toUpperCase()}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startTime}/${endTime}&details=${details}&sf=true`;
  };
  const downloadIcsFile = (reminder) => {
    const now = new Date();
    const [hours, minutes] = reminder.time.split(":");
    const targetDate = new Date();
    targetDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // If the target time has already passed today, schedule for tomorrow!
    if (targetDate.getTime() < now.getTime()) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, "0");
    const day = String(targetDate.getDate()).padStart(2, "0");
    const dateStr = `${year}${month}${day}`;
    
    const startTime = `${dateStr}T${hours}${minutes}00`;
    const endMin = (parseInt(minutes) + 30) % 60;
    const endHours = (parseInt(hours) + Math.floor((parseInt(minutes) + 30) / 60)) % 24;
    
    // If end hours roll over, end date rolls over to next day
    const endDate = new Date(targetDate);
    if (endHours < parseInt(hours)) {
      endDate.setDate(endDate.getDate() + 1);
    }
    const endYear = endDate.getFullYear();
    const endMonth = String(endDate.getMonth() + 1).padStart(2, "0");
    const endDay = String(endDate.getDate()).padStart(2, "0");
    const endDateStr = `${endYear}${endMonth}${endDay}`;
    
    const endTime = `${endDateStr}T${String(endHours).padStart(2, "0")}${String(endMin).padStart(2, "0")}00`;
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//StudySpace//Alarm Reminder//EN",
      "BEGIN:VEVENT",
      `UID:${reminder.id}@studyspace.vercel.app`,
      `DTSTAMP:${startTime}`,
      `DTSTART:${startTime}`,
      `DTEND:${endTime}`,
      `SUMMARY:StudySpace: ${reminder.title}`,
      `DESCRIPTION:StudySpace 2.0 reminder alarm. Priority: ${reminder.priority.toUpperCase()}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT10M", // Alert 10 minutes prior
      "ACTION:DISPLAY",
      `DESCRIPTION:StudySpace: ${reminder.title} is starting in 10 minutes`,
      "END:VALARM",
      "BEGIN:VALARM",
      "TRIGGER:-PT0M", // Alert exactly at start
      "ACTION:DISPLAY",
      `DESCRIPTION:StudySpace: ${reminder.title}`,
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${reminder.title.replace(/\s+/g, "_")}_reminder.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Downloaded calendar invite (.ics)!", "success");
  };
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFilesUpload(e.target.files);
    }
  };
  const handleFilesUpload = async (fileList) => {
    setUploadProgress(0);
    const totalFiles = fileList.length;
    let successCount = 0;
    for (let i = 0; i < totalFiles; i++) {
      const file = fileList[i];
      const category = getFileCategory(file.type, file.name);
      const newFileMetadata = {
        id: Math.random().toString(36).substring(2, 9) + "_" + Date.now(),
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: (/* @__PURE__ */ new Date()).toLocaleDateString(void 0, {
          month: "short",
          day: "numeric",
          year: "numeric"
        }),
        category,
        isSynced: false
      };
      try {
        await saveFileBlobLocal(newFileMetadata.id, file);
        setFiles((prev) => {
          const updated = [newFileMetadata, ...prev];
          saveMetadataList(updated);
          return updated;
        });
        successCount++;
        setUploadProgress(Math.round(successCount / totalFiles * 100));
        if (supabaseConfig) {
          triggerBackgroundSync();
        }
      } catch (err) {
        console.error("File write error", err);
        showToast(`Failed to upload ${file.name}`, "error");
      }
    }
    showToast(`Uploaded ${successCount} file(s) successfully!`, "success");
    setTimeout(() => setUploadProgress(null), 1e3);
  };
  const triggerBackgroundSync = async () => {
    if (!supabaseConfig) return;
    try {
      const result = await syncWithCloud(supabaseConfig);
      if (result.success) {
        setFiles(result.updatedList);
        showToast("Synced files with cloud storage", "success");
      }
    } catch (e) {
      console.error("Auto sync failed", e);
    }
  };
  const handleFileDelete = async (file) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${file.name}"?`)) {
      return;
    }
    try {
      const updated = await deleteFileFromSpace(file, supabaseConfig);
      setFiles(updated);
      showToast(`Deleted file ${file.name}`, "info");
    } catch (e) {
      console.error(e);
      showToast("Could not delete file", "error");
    }
  };
  const handleFilePreview = async (file) => {
    setLoadingPreview(true);
    setPreviewFile(file);
    try {
      const url = await getFileDownloadUrl(file, supabaseConfig);
      setPreviewUrl(url);
      if (file.category === "document" && (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md") || file.name.endsWith(".json"))) {
        const response = await fetch(url);
        const text = await response.text();
        setTextPreviewContent(text);
      } else {
        setTextPreviewContent("");
      }
    } catch (e) {
      console.error(e);
      showToast(`Error opening preview: ${e.message}`, "error");
      setPreviewFile(null);
    } finally {
      setLoadingPreview(false);
    }
  };
  const handleClosePreview = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewFile(null);
    setPreviewUrl("");
    setTextPreviewContent("");
  };
  const handleFileDownload = async (file) => {
    try {
      const url = await getFileDownloadUrl(file, supabaseConfig);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`Downloading ${file.name}...`, "info");
    } catch (e) {
      showToast(`Download failed: ${e.message}`, "error");
    }
  };
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!configInputs.url || !configInputs.anonKey || !configInputs.bucketName) {
      showToast("Please fill out all Supabase configuration fields.", "error");
      return;
    }
    const config = {
      url: configInputs.url.trim(),
      anonKey: configInputs.anonKey.trim(),
      bucketName: configInputs.bucketName.trim()
    };
    setIsSyncing(true);
    setSyncLogs([]);
    addSyncLog("Initializing connection...");
    try {
      const res = await syncWithCloud(config, (text) => addSyncLog(text));
      if (res.success) {
        saveSyncConfig(config);
        setSupabaseConfig(config);
        setFiles(res.updatedList);
        addSyncLog("Sync successful! Configuration saved.");
        showToast("Supabase connected and files synced!", "success");
      } else {
        addSyncLog(`Sync failed: ${res.error}`);
        showToast(`Sync failed: ${res.error}`, "error");
      }
    } catch (err) {
      addSyncLog(`Connection error: ${err.message}`);
      showToast(`Connection failed: ${err.message}`, "error");
    } finally {
      setIsSyncing(false);
    }
  };
  const handleManualSync = async () => {
    if (!supabaseConfig) return;
    setIsSyncing(true);
    setSyncLogs([]);
    addSyncLog("Starting manual sync...");
    try {
      const res = await syncWithCloud(supabaseConfig, (text) => addSyncLog(text));
      if (res.success) {
        setFiles(res.updatedList);
        addSyncLog("Manual sync successfully completed.");
        showToast("All files synced!", "success");
      } else {
        addSyncLog(`Sync failed: ${res.error}`);
        showToast(`Sync failed: ${res.error}`, "error");
      }
    } catch (err) {
      addSyncLog(`Sync error: ${err.message}`);
      showToast(`Sync error: ${err.message}`, "error");
    } finally {
      setIsSyncing(false);
    }
  };
  const handleDisconnectCloud = () => {
    saveSyncConfig(null);
    setSupabaseConfig(null);
    setConfigInputs({ url: "", anonKey: "", bucketName: "" });
    setSyncLogs([]);
    showToast("Supabase cloud storage disconnected", "info");
  };
  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || file.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });
  const getCategoryIcon = (category) => {
    switch (category) {
      case "photo":
        return /* @__PURE__ */ React.createElement(ImageIcon, { size: 20 });
      case "document":
        return /* @__PURE__ */ React.createElement(FileText, { size: 20 });
      case "video":
        return /* @__PURE__ */ React.createElement(VideoIcon, { size: 20 });
      case "audio":
        return /* @__PURE__ */ React.createElement(MusicIcon, { size: 20 });
      default:
        return /* @__PURE__ */ React.createElement(FileIcon, { size: 20 });
    }
  };
  return /* @__PURE__ */ React.createElement("div", { className: "app-container" }, /* @__PURE__ */ React.createElement("aside", { className: "app-sidebar" }, /* @__PURE__ */ React.createElement("div", { className: "logo-section" }, /* @__PURE__ */ React.createElement("div", { className: "logo-icon" }, /* @__PURE__ */ React.createElement(Sparkles, { size: 24 })), /* @__PURE__ */ React.createElement("span", { className: "logo-text" }, "StudySpace")), /* @__PURE__ */ React.createElement("nav", { className: "nav-links" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `nav-button ${activeTab === "files" ? "active" : ""}`,
      onClick: () => setActiveTab("files")
    },
    /* @__PURE__ */ React.createElement(Folder, { size: 20 }),
    /* @__PURE__ */ React.createElement("span", null, "File Sharer")
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `nav-button ${activeTab === "clock" ? "active" : ""}`,
      onClick: () => setActiveTab("clock")
    },
    /* @__PURE__ */ React.createElement(ClockIcon, { size: 20 }),
    /* @__PURE__ */ React.createElement("span", null, "Reminder Clock")
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `nav-button ${activeTab === "settings" ? "active" : ""}`,
      onClick: () => setActiveTab("settings")
    },
    /* @__PURE__ */ React.createElement(SettingsIcon, { size: 20 }),
    /* @__PURE__ */ React.createElement("span", null, "Cloud Sync Settings")
  )), /* @__PURE__ */ React.createElement("div", { className: "theme-switcher-container" }, /* @__PURE__ */ React.createElement("span", { className: "theme-switcher-label" }, "Select Theme"), /* @__PURE__ */ React.createElement("div", { className: "theme-pills" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `theme-pill-btn ${theme === "rose" ? "active" : ""}`,
      title: "Warm Rose Palette",
      onClick: () => handleThemeChange("rose")
    },
    /* @__PURE__ */ React.createElement("span", { className: "color-dot pink" }),
    /* @__PURE__ */ React.createElement("span", { className: "color-dot cream" }),
    /* @__PURE__ */ React.createElement("span", { className: "color-dot teal" })
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `theme-pill-btn ${theme === "midnight" ? "active" : ""}`,
      title: "Midnight Desert Palette",
      onClick: () => handleThemeChange("midnight")
    },
    /* @__PURE__ */ React.createElement("span", { className: "color-dot midnight-navy" }),
    /* @__PURE__ */ React.createElement("span", { className: "color-dot midnight-charcoal" }),
    /* @__PURE__ */ React.createElement("span", { className: "color-dot midnight-peach" })
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `theme-pill-btn ${theme === "earth" ? "active" : ""}`,
      title: "Cozy Earth Palette",
      onClick: () => handleThemeChange("earth")
    },
    /* @__PURE__ */ React.createElement("span", { className: "color-dot earth-khaki" }),
    /* @__PURE__ */ React.createElement("span", { className: "color-dot earth-sand" }),
    /* @__PURE__ */ React.createElement("span", { className: "color-dot earth-linen" })
  ))), /* @__PURE__ */ React.createElement("div", { className: "sidebar-footer" }, /* @__PURE__ */ React.createElement("div", { className: "sync-status-indicator" }, /* @__PURE__ */ React.createElement("div", { className: `status-dot ${supabaseConfig ? "active" : "inactive"}` }), /* @__PURE__ */ React.createElement("span", null, supabaseConfig ? "Cloud Synced" : "Local Mode")), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--text-muted)" } }, "Files: ", files.length, " (", files.filter((f) => f.isSynced).length, " synced)"), /* @__PURE__ */ React.createElement("span", { style: { color: "var(--text-muted)" } }, "Alarms Active: ", reminders.filter((r) => r.active).length))), /* @__PURE__ */ React.createElement("main", { className: "app-content" }, activeTab === "files" && /* @__PURE__ */ React.createElement("div", { className: "files-explorer" }, /* @__PURE__ */ React.createElement("header", { className: "page-header" }, /* @__PURE__ */ React.createElement("div", { className: "page-title" }, /* @__PURE__ */ React.createElement("h1", null, "Important Study Materials"), /* @__PURE__ */ React.createElement("p", null, "Upload, store, preview and organize your lectures, notes, PDFs and photos.")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "1rem" } }, supabaseConfig && /* @__PURE__ */ React.createElement("button", { className: "btn-secondary", onClick: handleManualSync, disabled: isSyncing, style: { display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1rem" } }, /* @__PURE__ */ React.createElement(RefreshCw, { size: 16, className: isSyncing ? "spin-anim" : "" }), /* @__PURE__ */ React.createElement("span", null, "Sync Now")))), /* @__PURE__ */ React.createElement(
    "div",
    {
      className: `upload-zone ${dragActive ? "drag-active" : ""}`,
      onDragEnter: handleDrag,
      onDragOver: handleDrag,
      onDragLeave: handleDrag,
      onDrop: handleDrop,
      onClick: () => document.getElementById("file-picker")?.click()
    },
    /* @__PURE__ */ React.createElement(
      "input",
      {
        id: "file-picker",
        type: "file",
        multiple: true,
        className: "file-input-hidden",
        onChange: handleFileChange
      }
    ),
    /* @__PURE__ */ React.createElement("div", { className: "upload-icon-container" }, /* @__PURE__ */ React.createElement(UploadCloud, { size: 32 })),
    /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { style: { fontSize: "1.2rem", marginBottom: "0.25rem" } }, "Drag & Drop study materials here"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--text-secondary)", fontSize: "0.9rem" } }, "or click to browse from device (PDFs, images, notes, zip, videos, audio)")),
    uploadProgress !== null && /* @__PURE__ */ React.createElement("div", { style: { width: "80%", maxWidth: "300px", background: "var(--bg-tertiary)", height: "6px", borderRadius: "3px", marginTop: "1rem", overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: { width: `${uploadProgress}%`, background: "var(--accent-primary)", height: "100%", transition: "width 0.2s" } }))
  ), /* @__PURE__ */ React.createElement("div", { className: "explorer-controls" }, /* @__PURE__ */ React.createElement("div", { className: "search-bar" }, /* @__PURE__ */ React.createElement(Search, { size: 18, style: { color: "var(--text-muted)" } }), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "text",
      placeholder: "Search file name...",
      value: searchQuery,
      onChange: (e) => setSearchQuery(e.target.value)
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "category-pills" }, ["all", "document", "photo", "video", "audio", "other"].map((cat) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: cat,
      className: `pill-button ${categoryFilter === cat ? "active" : ""}`,
      onClick: () => setCategoryFilter(cat)
    },
    /* @__PURE__ */ React.createElement("span", null, cat.charAt(0).toUpperCase() + cat.slice(1), "s")
  )))), filteredFiles.length > 0 ? /* @__PURE__ */ React.createElement("div", { className: "files-grid" }, filteredFiles.map((file) => /* @__PURE__ */ React.createElement("div", { key: file.id, className: `file-card ${file.category}` }, /* @__PURE__ */ React.createElement("div", { className: "file-card-top" }, /* @__PURE__ */ React.createElement("div", { className: "file-icon-wrapper" }, getCategoryIcon(file.category)), /* @__PURE__ */ React.createElement("span", { className: `sync-badge ${file.isSynced ? "synced" : "local"}` }, file.isSynced ? /* @__PURE__ */ React.createElement(Cloud, { size: 12 }) : /* @__PURE__ */ React.createElement(Database, { size: 12 }), file.isSynced ? "Cloud" : "Local")), /* @__PURE__ */ React.createElement("div", { className: "file-meta-main" }, /* @__PURE__ */ React.createElement("h4", { className: "file-name", title: file.name }, file.name), /* @__PURE__ */ React.createElement("div", { className: "file-size-date" }, /* @__PURE__ */ React.createElement("span", null, "Size: ", formatBytes(file.size)), /* @__PURE__ */ React.createElement("span", null, "Uploaded: ", file.uploadedAt))), /* @__PURE__ */ React.createElement("div", { className: "file-card-actions" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "action-btn",
      title: "Preview File",
      onClick: () => handleFilePreview(file)
    },
    /* @__PURE__ */ React.createElement(Eye, { size: 16 })
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "action-btn",
      title: "Download",
      onClick: () => handleFileDownload(file)
    },
    /* @__PURE__ */ React.createElement(Download, { size: 16 })
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "action-btn delete",
      title: "Delete",
      onClick: () => handleFileDelete(file)
    },
    /* @__PURE__ */ React.createElement(Trash2, { size: 16 })
  ))))) : /* @__PURE__ */ React.createElement("div", { className: "empty-state" }, /* @__PURE__ */ React.createElement("div", { className: "empty-state-icon" }, /* @__PURE__ */ React.createElement(Folder, { size: 36 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { style: { fontSize: "1.25rem", marginBottom: "0.25rem" } }, "No files found"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--text-secondary)" } }, searchQuery ? "Try adjusting your search query" : "Upload your first study material to get started!")))), activeTab === "clock" && /* @__PURE__ */ React.createElement("div", { className: "files-explorer" }, /* @__PURE__ */ React.createElement("header", { className: "page-header" }, /* @__PURE__ */ React.createElement("div", { className: "page-title" }, /* @__PURE__ */ React.createElement("h1", null, "Clock & Reminders"), /* @__PURE__ */ React.createElement("p", null, "Set electronic timers and notification alarms to help stay focused on your study routines.")), /* @__PURE__ */ React.createElement("div", null, notificationPermission !== "granted" && /* @__PURE__ */ React.createElement("button", { className: "btn-primary", onClick: requestNotificationPermission, style: { display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 1rem" } }, /* @__PURE__ */ React.createElement(Bell, { size: 16 }), /* @__PURE__ */ React.createElement("span", null, "Enable Desktop Alarms")))), /* @__PURE__ */ React.createElement("div", { className: "clock-dashboard" }, /* @__PURE__ */ React.createElement("div", { className: "clock-card" }, /* @__PURE__ */ React.createElement("div", { className: "digital-time" }, currentTime.toLocaleTimeString(void 0, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }), /* @__PURE__ */ React.createElement("span", { className: "seconds" }, String(currentTime.getSeconds()).padStart(2, "0"))), /* @__PURE__ */ React.createElement("div", { className: "digital-date" }, currentTime.toLocaleDateString(void 0, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  })), /* @__PURE__ */ React.createElement("div", { className: "digital-timezone" }, Intl.DateTimeFormat().resolvedOptions().timeZone)), /* @__PURE__ */ React.createElement("div", { className: "reminders-section" }, /* @__PURE__ */ React.createElement("form", { className: "reminder-form-card", onSubmit: handleAddReminder }, /* @__PURE__ */ React.createElement("h3", { className: "form-title" }, /* @__PURE__ */ React.createElement(Plus, { size: 20 }), "Create Study Reminder"), /* @__PURE__ */ React.createElement("div", { className: "form-grid" }, /* @__PURE__ */ React.createElement("div", { className: "form-group full-width" }, /* @__PURE__ */ React.createElement("label", { htmlFor: "alarm-title" }, "Reminder Goal"), /* @__PURE__ */ React.createElement(
    "input",
    {
      id: "alarm-title",
      type: "text",
      placeholder: "e.g. Solve Math Assignment, Chemistry quiz study...",
      value: alarmForm.title,
      onChange: (e) => setAlarmForm((prev) => ({ ...prev, title: e.target.value }))
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { htmlFor: "alarm-time" }, "Alarm Time"), /* @__PURE__ */ React.createElement(
    "input",
    {
      id: "alarm-time",
      type: "time",
      value: alarmForm.time,
      onChange: (e) => setAlarmForm((prev) => ({ ...prev, time: e.target.value }))
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { htmlFor: "alarm-priority" }, "Priority"), /* @__PURE__ */ React.createElement(
    "select",
    {
      id: "alarm-priority",
      value: alarmForm.priority,
      onChange: (e) => setAlarmForm((prev) => ({ ...prev, priority: e.target.value }))
    },
    /* @__PURE__ */ React.createElement("option", { value: "low" }, "Low (Chime)"),
    /* @__PURE__ */ React.createElement("option", { value: "medium" }, "Medium (Standard)"),
    /* @__PURE__ */ React.createElement("option", { value: "high" }, "High (Loud Alarm)")
  ))), /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn-primary" }, "Create Alarm Clock")), /* @__PURE__ */ React.createElement("div", { className: "reminders-list-container" }, /* @__PURE__ */ React.createElement("h3", { className: "reminders-list-header" }, "Active Alarms (", reminders.length, ")"), reminders.length > 0 ? /* @__PURE__ */ React.createElement("div", { className: "reminders-list" }, reminders.map((reminder) => /* @__PURE__ */ React.createElement("div", { key: reminder.id, className: `reminder-item ${!reminder.active ? "inactive" : ""}` }, /* @__PURE__ */ React.createElement("div", { className: "reminder-item-left" }, /* @__PURE__ */ React.createElement("div", { className: `reminder-priority-indicator ${reminder.priority}`, title: `Priority: ${reminder.priority}` }), /* @__PURE__ */ React.createElement("div", { className: "reminder-info" }, /* @__PURE__ */ React.createElement("span", { className: "reminder-time" }, reminder.time), /* @__PURE__ */ React.createElement("span", { className: "reminder-label" }, reminder.title))), /* @__PURE__ */ React.createElement("div", { className: "reminder-item-actions" }, /* @__PURE__ */ React.createElement(
    "a",
    {
      href: getGoogleCalendarUrl(reminder),
      target: "_blank",
      rel: "noopener noreferrer",
      className: "action-btn",
      title: "Add to Google Calendar",
      style: { color: "var(--accent-primary)" }
    },
    /* @__PURE__ */ React.createElement(Calendar, { size: 16 })
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "action-btn",
      title: "Export Calendar Invite (.ics)",
      onClick: () => downloadIcsFile(reminder),
      style: { color: "var(--info)" }
    },
    /* @__PURE__ */ React.createElement(Plus, { size: 16 })
  ), /* @__PURE__ */ React.createElement("label", { className: "switch" }, /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "checkbox",
      checked: reminder.active,
      onChange: () => toggleReminder(reminder.id)
    }
  ), /* @__PURE__ */ React.createElement("span", { className: "slider" })), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "action-btn delete",
      title: "Delete Alarm",
      onClick: () => deleteReminder(reminder.id)
    },
    /* @__PURE__ */ React.createElement(Trash2, { size: 16 })
  ))))) : /* @__PURE__ */ React.createElement("div", { className: "empty-state", style: { padding: "2rem" } }, /* @__PURE__ */ React.createElement("p", { style: { color: "var(--text-muted)", fontSize: "0.9rem" } }, "No reminder clocks set.")))))), activeTab === "settings" && /* @__PURE__ */ React.createElement("div", { className: "settings-container" }, /* @__PURE__ */ React.createElement("header", { className: "page-header" }, /* @__PURE__ */ React.createElement("div", { className: "page-title" }, /* @__PURE__ */ React.createElement("h1", null, "Cloud Storage Sync"), /* @__PURE__ */ React.createElement("p", null, "Integrate your own free-tier Supabase project bucket to access your uploaded study material from any device via your Vercel link!"))), /* @__PURE__ */ React.createElement("div", { className: "settings-card" }, /* @__PURE__ */ React.createElement("h3", { className: "settings-section-title" }, /* @__PURE__ */ React.createElement(Database, { size: 20 }), "Supabase Credentials"), /* @__PURE__ */ React.createElement("div", { className: "settings-info-alert" }, /* @__PURE__ */ React.createElement(AlertCircle, { size: 24, style: { color: "var(--info)", flexShrink: 0 } }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { style: { fontWeight: 600, marginBottom: "0.25rem" } }, "How to connect your storage:"), /* @__PURE__ */ React.createElement("ol", { style: { paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem" } }, /* @__PURE__ */ React.createElement("li", null, "Create a free project at ", /* @__PURE__ */ React.createElement("code", null, "supabase.com"), "."), /* @__PURE__ */ React.createElement("li", null, "Go to Storage and create a new **Public** bucket named e.g. ", /* @__PURE__ */ React.createElement("code", null, "files"), "."), /* @__PURE__ */ React.createElement("li", null, "Go to Project Settings > API, and copy the **Project URL** and **anon public API key**."), /* @__PURE__ */ React.createElement("li", null, "Paste them here. Files uploaded locally will immediately sync up to your secure cloud bucket, keeping you organized!")))), /* @__PURE__ */ React.createElement("form", { onSubmit: handleSaveSettings, style: { display: "flex", flexDirection: "column", gap: "1.25rem" } }, /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { htmlFor: "settings-url" }, "Supabase Project URL"), /* @__PURE__ */ React.createElement(
    "input",
    {
      id: "settings-url",
      type: "url",
      placeholder: "https://your-project-id.supabase.co",
      value: configInputs.url,
      onChange: (e) => setConfigInputs((prev) => ({ ...prev, url: e.target.value })),
      disabled: isSyncing
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { htmlFor: "settings-key" }, "Supabase Public API Anon Key"), /* @__PURE__ */ React.createElement(
    "input",
    {
      id: "settings-key",
      type: "password",
      placeholder: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      value: configInputs.anonKey,
      onChange: (e) => setConfigInputs((prev) => ({ ...prev, anonKey: e.target.value })),
      disabled: isSyncing
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "form-group" }, /* @__PURE__ */ React.createElement("label", { htmlFor: "settings-bucket" }, "Supabase Storage Bucket Name"), /* @__PURE__ */ React.createElement(
    "input",
    {
      id: "settings-bucket",
      type: "text",
      placeholder: "e.g. files, studies, bucket-name",
      value: configInputs.bucketName,
      onChange: (e) => setConfigInputs((prev) => ({ ...prev, bucketName: e.target.value })),
      disabled: isSyncing
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "settings-actions" }, /* @__PURE__ */ React.createElement("button", { type: "submit", className: "btn-primary", disabled: isSyncing, style: { display: "flex", alignItems: "center", gap: "0.5rem" } }, isSyncing ? /* @__PURE__ */ React.createElement(RefreshCw, { size: 16, className: "spin-anim" }) : /* @__PURE__ */ React.createElement(Check, { size: 16 }), /* @__PURE__ */ React.createElement("span", null, supabaseConfig ? "Update & Re-sync" : "Test Connection & Connect")), supabaseConfig && /* @__PURE__ */ React.createElement("button", { type: "button", className: "btn-secondary", onClick: handleDisconnectCloud, disabled: isSyncing, style: { color: "var(--danger)" } }, "Disconnect Cloud"))), (syncLogs.length > 0 || isSyncing) && /* @__PURE__ */ React.createElement("div", { style: { marginTop: "1rem" } }, /* @__PURE__ */ React.createElement("h4", { style: { fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "0.5rem" } }, "Connection Terminal:"), /* @__PURE__ */ React.createElement("div", { className: "sync-log-terminal" }, syncLogs.map((log, index) => /* @__PURE__ */ React.createElement("div", { key: index, className: "sync-log-line" }, /* @__PURE__ */ React.createElement("span", { className: "timestamp" }, "[", log.timestamp, "]"), /* @__PURE__ */ React.createElement("span", null, log.text))), isSyncing && /* @__PURE__ */ React.createElement("div", { className: "sync-log-line", style: { color: "var(--text-secondary)" } }, /* @__PURE__ */ React.createElement("span", { className: "timestamp" }, "[", (/* @__PURE__ */ new Date()).toLocaleTimeString(), "]"), /* @__PURE__ */ React.createElement("span", null, "Processing sync operation..."))))))), previewFile && /* @__PURE__ */ React.createElement("div", { className: "modal-overlay", onClick: handleClosePreview }, /* @__PURE__ */ React.createElement("div", { className: "modal-content preview-modal", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement("div", { className: "modal-header" }, /* @__PURE__ */ React.createElement("h3", null, previewFile.name), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "0.8rem", color: "var(--text-muted)", marginLeft: "1.25rem" } }, "(", formatBytes(previewFile.size), ")"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "0.5rem", marginLeft: "auto", marginRight: "1rem" } }, previewUrl && /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "btn-secondary",
      title: "Open in New Tab",
      onClick: () => window.open(previewUrl, "_blank"),
      style: { display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.35rem 0.75rem", width: "auto", height: "auto", fontSize: "0.8rem", fontWeight: 600, borderRadius: "var(--border-radius-sm)", cursor: "pointer" }
    },
    /* @__PURE__ */ React.createElement(ExternalLink, { size: 14 }),
    /* @__PURE__ */ React.createElement("span", null, "Open in new tab")
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "action-btn delete",
      title: "Delete Permanently",
      onClick: async () => {
        await handleFileDelete(previewFile);
        handleClosePreview();
      },
      style: { display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.35rem 0.75rem", width: "auto", height: "auto", background: "rgba(178, 88, 88, 0.1)", color: "var(--danger)", borderRadius: "var(--border-radius-sm)", cursor: "pointer", transition: "background 0.2s" }
    },
    /* @__PURE__ */ React.createElement(Trash2, { size: 14 }),
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "0.8rem", fontWeight: 600 } }, "Delete permanently")
  )), /* @__PURE__ */ React.createElement("button", { className: "modal-close-btn", onClick: handleClosePreview }, /* @__PURE__ */ React.createElement(X, { size: 18 }))), loadingPreview ? /* @__PURE__ */ React.createElement("div", { className: "preview-viewer-body" }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" } }, /* @__PURE__ */ React.createElement(RefreshCw, { size: 36, className: "spin-anim", style: { color: "var(--accent-primary)" } }), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--text-secondary)" } }, "Retrieving file content..."))) : /* @__PURE__ */ React.createElement("div", { className: "preview-viewer-body" }, previewFile.category === "photo" && previewUrl && /* @__PURE__ */ React.createElement("img", { src: previewUrl, alt: previewFile.name }), previewFile.category === "video" && previewUrl && /* @__PURE__ */ React.createElement("video", { src: previewUrl, controls: true, autoPlay: true }), previewFile.category === "audio" && previewUrl && /* @__PURE__ */ React.createElement("audio", { src: previewUrl, controls: true, autoPlay: true }), previewFile.category === "document" && (previewFile.type.includes("pdf") || previewFile.name.toLowerCase().endsWith(".pdf")) && previewUrl && /* @__PURE__ */ React.createElement("iframe", { src: previewUrl, style: { width: "100%", height: "60vh", border: "none", borderRadius: "var(--border-radius-sm)" }, title: previewFile.name }), previewFile.category === "document" && !previewFile.type.includes("pdf") && !previewFile.name.toLowerCase().endsWith(".pdf") && textPreviewContent && /* @__PURE__ */ React.createElement("div", { className: "text-preview-scroll" }, textPreviewContent), (!previewUrl || previewFile.category === "document" && !textPreviewContent && !previewFile.type.includes("pdf") && !previewFile.name.toLowerCase().endsWith(".pdf") || previewFile.category === "other") && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem", color: "var(--text-secondary)", padding: "3rem 2rem" } }, /* @__PURE__ */ React.createElement(FileIcon, { size: 64, style: { color: "var(--text-muted)" } }), /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center" } }, /* @__PURE__ */ React.createElement("p", { style: { fontWeight: 600, color: "white", marginBottom: "0.25rem" } }, "No in-browser preview available"), /* @__PURE__ */ React.createElement("p", { style: { fontSize: "0.85rem" } }, "This file type (", previewFile.type || "unknown", ") cannot be previewed directly.")), /* @__PURE__ */ React.createElement("button", { className: "btn-primary", onClick: () => handleFileDownload(previewFile), style: { display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1.5rem" } }, /* @__PURE__ */ React.createElement(Download, { size: 18 }), /* @__PURE__ */ React.createElement("span", null, "Download file to view")))))), activeAlarm && /* @__PURE__ */ React.createElement("div", { className: "modal-overlay" }, /* @__PURE__ */ React.createElement("div", { className: "modal-content alarm-modal-content" }, /* @__PURE__ */ React.createElement("div", { className: "alarm-icon-glowing" }, /* @__PURE__ */ React.createElement(Bell, { size: 40 })), /* @__PURE__ */ React.createElement("div", { className: "alarm-title-heading" }, "ALARM CLOCK TRIGGERED"), /* @__PURE__ */ React.createElement("div", { className: "alarm-label-text" }, activeAlarm.title || "Study session reminder!"), /* @__PURE__ */ React.createElement("div", { className: "alarm-actions" }, /* @__PURE__ */ React.createElement("button", { className: "btn-alarm-dismiss", onClick: dismissAlarm }, "Dismiss Alarm Clock")))), /* @__PURE__ */ React.createElement("div", { className: "toast-container" }, toasts.map((toast) => /* @__PURE__ */ React.createElement("div", { key: toast.id, className: `toast ${toast.type}` }, toast.type === "error" && /* @__PURE__ */ React.createElement(AlertCircle, { size: 18, style: { color: "var(--danger)" } }), toast.type === "success" && /* @__PURE__ */ React.createElement(Check, { size: 18, style: { color: "var(--success)" } }), /* @__PURE__ */ React.createElement("span", null, toast.text)))));
}
