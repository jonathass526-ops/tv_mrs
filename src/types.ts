export interface TrainSchedule {
  id: string;
  prefix: string;        // e.g. "KPC", "G32", "P04", "V12"
  departureTime: string; // e.g. "12:00", "17:00", "19:50"
}

export interface TVDevice {
  id: string;
  name: string;
  location?: string;
  folderUrl: string;
  folderId?: string;
  folderName?: string;
  trainSchedules: TrainSchedule[];
  transitionSpeed: number; // in milliseconds (e.g. 15000)
  transitionEffect: 'fade' | 'zoom' | 'slide';
  showFileName: boolean;
  showClock: boolean;
  showUiInSlideshow: boolean;
  autoRefresh: boolean;
  autoRefreshRate: number; // in milliseconds (e.g. 60000)
  createdAt: string;
  updatedAt: string;
}

export interface MediaFile {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  downloadUrl: string | null;
  directUrl?: string | null;
  isImage: boolean;
  isVideo: boolean;
  isPdf?: boolean;
  lastModified: string;
  mimeType: string;
  durationMillis?: number;
}

export interface AuthStatus {
  connected: boolean;
  hasCredentials: boolean;
  user: { displayName?: string; mail?: string } | null;
  selectedFolder: { id: string; name: string } | null;
  publicSharingUrl: string | null;
  isDemo: boolean;
}

export interface TrainAlertInfo {
  prefix: string;
  departureTime: string;
  message: string;
  diffSeconds: number;
  formattedTimer: string;
  level: 'banner' | 'fullscreen'; // 'banner' (<= 90 min and > 15 min), 'fullscreen' (<= 15 min and > 0)
}

// Backwards compatibility helper
export function normalizeTrainSchedules(schedules: any[]): TrainSchedule[] {
  if (!Array.isArray(schedules)) return [];
  return schedules.map((item, index) => {
    if (typeof item === 'string') {
      return {
        id: `sched_${index}_${item.replace(':', '')}`,
        prefix: 'KPC',
        departureTime: item.trim(),
      };
    }
    if (item && typeof item === 'object') {
      return {
        id: item.id || `sched_${index}_${(item.departureTime || '').replace(':', '')}`,
        prefix: (item.prefix || 'KPC').trim().toUpperCase(),
        departureTime: (item.departureTime || '12:00').trim(),
      };
    }
    return {
      id: `sched_${index}`,
      prefix: 'KPC',
      departureTime: '12:00',
    };
  });
}
