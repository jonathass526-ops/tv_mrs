import { TrainSchedule, TrainAlertInfo, normalizeTrainSchedules } from '../types';

export function calculateTrainAlert(
  schedulesRaw: any[],
  testState?: { active: boolean; mode?: 'fullscreen' | 'banner'; prefix?: string; time?: string }
): TrainAlertInfo | null {
  // If test mode is enabled
  if (testState?.active) {
    const isFullscreen = testState.mode !== 'banner';
    const prefix = testState.prefix || 'KPC';
    const departureTime = testState.time || (isFullscreen ? '12:00' : '17:00');
    const diffSeconds = isFullscreen ? 899 : 4500; // 14m59s for fullscreen, 1h15m for banner
    
    const h = Math.floor(diffSeconds / 3600);
    const m = Math.floor((diffSeconds % 3600) / 60);
    const s = diffSeconds % 60;
    const formattedTimer = h > 0
      ? `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    return {
      prefix,
      departureTime,
      message: `Atenção para a formação do ${prefix}`,
      diffSeconds,
      formattedTimer,
      level: isFullscreen ? 'fullscreen' : 'banner',
    };
  }

  const schedules = normalizeTrainSchedules(schedulesRaw);
  if (schedules.length === 0) return null;

  const now = new Date();
  const currentMs = now.getTime();

  let closestAlert: TrainAlertInfo | null = null;

  for (const schedule of schedules) {
    const parts = (schedule.departureTime || '').trim().split(':');
    if (parts.length < 2) continue;
    const targetHour = parseInt(parts[0], 10);
    const targetMinute = parseInt(parts[1], 10);
    if (isNaN(targetHour) || isNaN(targetMinute)) continue;

    const targetDate = new Date(now);
    targetDate.setHours(targetHour, targetMinute, 0, 0);

    const diffMs = targetDate.getTime() - currentMs;
    const diffSeconds = Math.floor(diffMs / 1000);

    // Only active before departure (> 0 seconds) and within 90 minutes (90 * 60 = 5400s)
    if (diffSeconds > 0 && diffSeconds <= 90 * 60) {
      const h = Math.floor(diffSeconds / 3600);
      const m = Math.floor((diffSeconds % 3600) / 60);
      const s = diffSeconds % 60;
      const formattedTimer = h > 0
        ? `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

      const level: 'banner' | 'fullscreen' = diffSeconds <= 15 * 60 ? 'fullscreen' : 'banner';
      const candidate: TrainAlertInfo = {
        prefix: schedule.prefix || 'KPC',
        departureTime: schedule.departureTime,
        message: `Atenção para a formação do ${schedule.prefix || 'KPC'}`,
        diffSeconds,
        formattedTimer,
        level,
      };

      // Prioritize fullscreen alerts over banner alerts, or closer departure
      if (!closestAlert) {
        closestAlert = candidate;
      } else {
        if (candidate.level === 'fullscreen' && closestAlert.level !== 'fullscreen') {
          closestAlert = candidate;
        } else if (candidate.level === closestAlert.level && candidate.diffSeconds < closestAlert.diffSeconds) {
          closestAlert = candidate;
        }
      }
    }
  }

  return closestAlert;
}
