/**
 * Centralized Date Formatter for Backend (CommonJS)
 */

function parseNaiveToLocalDate(dateTimeStr) {
  if (!dateTimeStr) return null;
  
  const match = String(dateTimeStr).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    const d = new Date(dateTimeStr);
    return isNaN(d.getTime()) ? null : d;
  }
  
  const year = parseInt(match[1], 10);
  const monthIndex = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const hours = parseInt(match[4], 10);
  const minutes = parseInt(match[5], 10);
  const seconds = match[6] ? parseInt(match[6], 10) : 0;
  
  return new Date(year, monthIndex, day, hours, minutes, seconds);
}

function normalizeDueDate(dateVal) {
  if (!dateVal) return dateVal;
  
  if (dateVal instanceof Date) {
    const pad = (num) => String(num).padStart(2, '0');
    return `${dateVal.getFullYear()}-${pad(dateVal.getMonth() + 1)}-${pad(dateVal.getDate())}T${pad(dateVal.getHours())}:${pad(dateVal.getMinutes())}`;
  }
  
  const str = String(dateVal);
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`;
  }
  return str;
}

function formatTaskNotificationDateTime(dateTimeStr) {
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

module.exports = {
  parseNaiveToLocalDate,
  normalizeDueDate,
  formatTaskNotificationDateTime
};
