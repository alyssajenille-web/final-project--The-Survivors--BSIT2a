const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const SCHOOL_TIMEZONE = process.env.SCHOOL_TIMEZONE || 'Asia/Manila';

const parseTimeToMinutes = (time) => {
  if (!TIME_PATTERN.test(time || '')) return null;

  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const startOfLocalDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfLocalDay = (date) => {
  const value = startOfLocalDay(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const combineDateAndTime = (date, time) => {
  const minutes = parseTimeToMinutes(time);
  if (minutes === null) return null;

  const value = startOfLocalDay(date);
  value.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return value;
};

const parseLocalDateOnly = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
};

const isSameLocalDay = (first, second) => {
  return startOfLocalDay(first).getTime() === startOfLocalDay(second).getTime();
};

const getSchoolTimeParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SCHOOL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map(part => [part.type, part.value])
  );

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);

  return {
    year,
    month,
    day,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    dayOfWeek: new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  };
};

const getSchoolTimeMinutes = (date = new Date()) => {
  const parts = getSchoolTimeParts(date);
  return parts.hour * 60 + parts.minute;
};

module.exports = {
  TIME_PATTERN,
  SCHOOL_TIMEZONE,
  parseTimeToMinutes,
  startOfLocalDay,
  endOfLocalDay,
  combineDateAndTime,
  parseLocalDateOnly,
  isSameLocalDay,
  getSchoolTimeParts,
  getSchoolTimeMinutes
};
