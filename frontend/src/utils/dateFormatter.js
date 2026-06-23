/**
 * Naive (Timezone-Independent) Date and Time Utilities for Task Fields.
 * This ensures that task times selected by the user (e.g. 20:00) are parsed,
 * stored, and displayed exactly without shifting due to timezone offsets.
 */

export function parseNaiveToLocalDate(dateTimeStr) {
  if (!dateTimeStr) return null;
  
  // Matches formats: YYYY-MM-DDTHH:mm, YYYY-MM-DD HH:mm, YYYY-MM-DDTHH:mm:ss, etc.
  const match = String(dateTimeStr).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  
  if (!match) {
    const d = new Date(dateTimeStr);
    return isNaN(d.getTime()) ? null : d;
  }
  
  const year = parseInt(match[1], 10);
  const monthIndex = parseInt(match[2], 10) - 1; // 0-indexed month
  const day = parseInt(match[3], 10);
  const hours = parseInt(match[4], 10);
  const minutes = parseInt(match[5], 10);
  const seconds = match[6] ? parseInt(match[6], 10) : 0;
  
  // Constructs Date object in the browser's current timezone using exact local parts.
  return new Date(year, monthIndex, day, hours, minutes, seconds);
}

export function formatTaskDueDateTime(dateTimeStr) {
  const d = parseNaiveToLocalDate(dateTimeStr);
  if (!d) return '';
  
  const pad = (num) => String(num).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthStr = months[d.getMonth()];
  const day = d.getDate();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  
  return `${monthStr} ${day}, ${hours}:${minutes}`;
}

export function formatDateForInput(dateTimeStr) {
  const d = parseNaiveToLocalDate(dateTimeStr);
  if (!d) return '';
  
  const pad = (num) => String(num).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatTaskTrackingDateTime(dateTimeStr) {
  const d = parseNaiveToLocalDate(dateTimeStr);
  if (!d) return '';
  
  const pad = (num) => String(num).padStart(2, '0');
  return `${d.toLocaleDateString()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
