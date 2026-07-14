import { get, set, del } from 'idb-keyval';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SharedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  category: 'document' | 'photo' | 'video' | 'audio' | 'other';
  isSynced: boolean;
  cloudPath?: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  bucketName: string;
}

const METADATA_KEY = 'file_sharer_metadata';
const SYNC_CONFIG_KEY = 'file_sharer_sync_config';

// Help helper for category classification
export function getFileCategory(fileType: string, fileName: string): SharedFile['category'] {
  const type = fileType.toLowerCase();
  const name = fileName.toLowerCase();
  
  if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(name)) {
    return 'photo';
  }
  if (type.startsWith('video/') || /\.(mp4|webm|ogg|mov|mkv)$/.test(name)) {
    return 'video';
  }
  if (type.startsWith('audio/') || /\.(mp3|wav|ogg|aac|flac|m4a)$/.test(name)) {
    return 'audio';
  }
  if (
    type.startsWith('text/') ||
    type.includes('pdf') ||
    type.includes('msword') ||
    type.includes('officedocument') ||
    /\.(pdf|txt|doc|docx|xls|xlsx|ppt|pptx|md|json|zip|rar|7z|pdf)$/.test(name)
  ) {
    return 'document';
  }
  return 'other';
}

// Format bytes to readable size
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Local Storage for Config
export function getSavedSyncConfig(): SupabaseConfig | null {
  try {
    const configStr = localStorage.getItem(SYNC_CONFIG_KEY);
    return configStr ? JSON.parse(configStr) : null;
  } catch (e) {
    console.error('Failed to get sync config', e);
    return null;
  }
}

export function saveSyncConfig(config: SupabaseConfig | null): void {
  if (config) {
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
  } else {
    localStorage.removeItem(SYNC_CONFIG_KEY);
  }
}

// Supabase client instance holder
let supabaseInstance: SupabaseClient | null = null;
let currentConfigString = '';

export function getSupabaseClient(config: SupabaseConfig | null): SupabaseClient | null {
  if (!config || !config.url || !config.anonKey) {
    supabaseInstance = null;
    currentConfigString = '';
    return null;
  }
  
  const configString = `${config.url}_${config.anonKey}`;
  if (supabaseInstance && currentConfigString === configString) {
    return supabaseInstance;
  }
  
  try {
    supabaseInstance = createClient(config.url, config.anonKey, {
      auth: { persistSession: false }
    });
    currentConfigString = configString;
    return supabaseInstance;
  } catch (e) {
    console.error('Failed to create Supabase client', e);
    return null;
  }
}

// Metadata list retrieval
export async function getMetadataList(): Promise<SharedFile[]> {
  try {
    const list = await get<SharedFile[]>(METADATA_KEY);
    return list || [];
  } catch (e) {
    console.error('Failed to fetch metadata list', e);
    return [];
  }
}

// Save Metadata list locally
export async function saveMetadataList(list: SharedFile[]): Promise<void> {
  await set(METADATA_KEY, list);
}

// Save File Blob locally
export async function saveFileBlobLocal(id: string, blob: Blob): Promise<void> {
  await set(`file_blob_${id}`, blob);
}

// Get File Blob locally
export async function getFileBlobLocal(id: string): Promise<Blob | null> {
  try {
    const blob = await get<Blob>(`file_blob_${id}`);
    return blob || null;
  } catch (e) {
    console.error(`Failed to fetch file blob ${id}`, e);
    return null;
  }
}

// Delete File locally
export async function deleteFileLocal(id: string): Promise<void> {
  const list = await getMetadataList();
  const updatedList = list.filter(f => f.id !== id);
  await saveMetadataList(updatedList);
  await del(`file_blob_${id}`);
}

// Sync local metadata with Supabase Cloud storage
// It uploads any unsynced local file to Supabase and writes/updates the merged metadata.json file in Supabase.
export async function syncWithCloud(
  config: SupabaseConfig,
  onProgress?: (text: string) => void
): Promise<{ success: boolean; error?: string; updatedList: SharedFile[] }> {
  const supabase = getSupabaseClient(config);
  if (!supabase) {
    return { success: false, error: 'Invalid Supabase client creation.', updatedList: [] };
  }

  try {
    onProgress?.('Fetching cloud metadata...');
    
    // 1. Fetch metadata.json from Supabase Storage
    let cloudList: SharedFile[] = [];
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(config.bucketName)
      .download('metadata.json');
      
    if (!downloadError && fileData) {
      try {
        const text = await fileData.text();
        cloudList = JSON.parse(text);
      } catch (jsonErr) {
        console.error('Error parsing cloud metadata.json', jsonErr);
      }
    } else {
      console.log('No metadata.json found or failed to download. Starting with empty cloud metadata.');
    }

    // 2. Fetch local list
    const localList = await getMetadataList();

    // Merge lists by ID (cloud takes priority for overlapping fields, but local is added if missing in cloud)
    const mergedMap = new Map<string, SharedFile>();
    cloudList.forEach(f => mergedMap.set(f.id, f));
    localList.forEach(f => {
      if (!mergedMap.has(f.id)) {
        mergedMap.set(f.id, f);
      } else {
        // Keep synced local files in sync, update sync state
        const cloudFile = mergedMap.get(f.id)!;
        mergedMap.set(f.id, {
          ...f,
          isSynced: true,
          cloudPath: cloudFile.cloudPath || f.cloudPath
        });
      }
    });

    const mergedList = Array.from(mergedMap.values());

    // 3. Find files that need to be uploaded (i.e. present in local list, but isSynced is false or not in cloud)
    const unsyncedFiles = mergedList.filter(f => !f.isSynced);
    
    if (unsyncedFiles.length > 0) {
      onProgress?.(`Uploading ${unsyncedFiles.length} file(s)...`);
      
      for (const fileMetadata of unsyncedFiles) {
        // Fetch raw blob from Local DB
        const blob = await getFileBlobLocal(fileMetadata.id);
        if (!blob) {
          console.warn(`Local content for file ${fileMetadata.name} (${fileMetadata.id}) not found. Skipping.`);
          continue;
        }

        // Upload to bucket under "uploads/ID_name"
        const cloudPath = `uploads/${fileMetadata.id}_${fileMetadata.name}`;
        
        onProgress?.(`Uploading: ${fileMetadata.name}`);
        const { error: uploadError } = await supabase.storage
          .from(config.bucketName)
          .upload(cloudPath, blob, {
            contentType: fileMetadata.type,
            upsert: true
          });

        if (uploadError) {
          console.error(`Failed to upload ${fileMetadata.name}`, uploadError);
          throw new Error(`Upload failed for ${fileMetadata.name}: ${uploadError.message}`);
        }

        // Mark as synced
        fileMetadata.isSynced = true;
        fileMetadata.cloudPath = cloudPath;
        
        // Save the metadata update locally
        const updatedLocal = await getMetadataList();
        const itemIdx = updatedLocal.findIndex(x => x.id === fileMetadata.id);
        if (itemIdx !== -1) {
          updatedLocal[itemIdx] = { ...updatedLocal[itemIdx], isSynced: true, cloudPath };
          await saveMetadataList(updatedLocal);
        }
      }
    }

    // 4. Update the centralized metadata.json file in Supabase Storage
    onProgress?.('Updating cloud catalog...');
    const metadataBlob = new Blob([JSON.stringify(mergedList, null, 2)], { type: 'application/json' });
    const { error: metadataUploadError } = await supabase.storage
      .from(config.bucketName)
      .upload('metadata.json', metadataBlob, {
        contentType: 'application/json',
        upsert: true
      });

    if (metadataUploadError) {
      throw new Error(`Failed to upload catalog: ${metadataUploadError.message}`);
    }

    // 5. Update local state with the fully synced and merged list
    await saveMetadataList(mergedList);

    return { success: true, updatedList: mergedList };
  } catch (e: any) {
    console.error('Sync failed', e);
    return { success: false, error: e.message || 'Unknown sync error', updatedList: await getMetadataList() };
  }
}

// Download cloud file to local cache when clicked, or return public URL
export async function getFileDownloadUrl(
  file: SharedFile,
  config: SupabaseConfig | null
): Promise<string> {
  // If local blob exists, use it first! It's super fast.
  const localBlob = await getFileBlobLocal(file.id);
  if (localBlob) {
    return URL.createObjectURL(localBlob);
  }

  // If local blob doesn't exist but we have cloud credentials, download from cloud
  if (file.cloudPath && config) {
    const supabase = getSupabaseClient(config);
    if (supabase) {
      // Try to download the blob to save it locally
      try {
        const { data: blob, error } = await supabase.storage
          .from(config.bucketName)
          .download(file.cloudPath);
          
        if (!error && blob) {
          // Cache it locally so subsequent loads are instant!
          await saveFileBlobLocal(file.id, blob);
          return URL.createObjectURL(blob);
        }
      } catch (err) {
        console.error('Error fetching file from cloud storage, falling back to public URL', err);
      }

      // Fallback: Generate public URL directly
      const { data } = supabase.storage
        .from(config.bucketName)
        .getPublicUrl(file.cloudPath);
      if (data?.publicUrl) {
        return data.publicUrl;
      }
    }
  }

  throw new Error('File content is not available locally or on the cloud.');
}

// Delete file from local AND cloud (if config exists)
export async function deleteFileFromSpace(
  file: SharedFile,
  config: SupabaseConfig | null
): Promise<SharedFile[]> {
  // 1. Delete local blob and metadata
  await deleteFileLocal(file.id);

  const updatedLocalList = await getMetadataList();

  // 2. If synced to cloud, delete the file and update metadata.json in cloud
  if (file.cloudPath && config) {
    const supabase = getSupabaseClient(config);
    if (supabase) {
      try {
        // Delete the uploaded file
        await supabase.storage.from(config.bucketName).remove([file.cloudPath]);
        
        // Update catalog
        const metadataBlob = new Blob([JSON.stringify(updatedLocalList, null, 2)], { type: 'application/json' });
        await supabase.storage
          .from(config.bucketName)
          .upload('metadata.json', metadataBlob, {
            contentType: 'application/json',
            upsert: true
          });
      } catch (err) {
        console.error('Failed to clean up cloud assets during deletion', err);
      }
    }
  }

  return updatedLocalList;
}
