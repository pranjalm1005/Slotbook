import { DateTime } from "luxon";

type SlotConfig = {
  date: string;
  timezone: string;
  startTime: string;
  endTime: string;
  duration: number;
  bufferBefore: number;
  bufferAfter: number;
  minNotice: number;
  bookingHorizon: number;
};

export function generateCandidateSlots(config: SlotConfig) {
  const {
    date,
    timezone,
    startTime,
    endTime,
    duration,
    bufferBefore,
    bufferAfter,
    minNotice,
    bookingHorizon,
  } = config;

  const now = DateTime.now().setZone(timezone);

  const requestedDate = DateTime.fromISO(date, { zone: timezone });

  if (!requestedDate.isValid || !now.isValid) {
    throw new Error("Invalid date or timezone");
  }

  const earliestBooking = now.plus({ minutes: minNotice });

  const latestBooking = now.plus({ days: bookingHorizon });

  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  const dayStart = requestedDate.set({
    hour: startHour,
    minute: startMinute,
    second: 0,
    millisecond: 0,
  });

  const dayEnd = requestedDate.set({
    hour: endHour,
    minute: endMinute,
    second: 0,
    millisecond: 0,
  });

  const slots = [];

  let cursor = dayStart;

  while (cursor.plus({ minutes: duration }) <= dayEnd) {
    const slotEnd = cursor.plus({ minutes: duration });

    const bufferedStart = cursor.minus({ minutes: bufferBefore });
    const bufferedEnd = slotEnd.plus({ minutes: bufferAfter });

    if (
      cursor >= earliestBooking &&
      slotEnd <= latestBooking
    ) {
      slots.push({
        start: cursor.toUTC().toISO(),
        end: slotEnd.toUTC().toISO(),
        bufferedStart: bufferedStart.toUTC().toISO(),
        bufferedEnd: bufferedEnd.toUTC().toISO(),
      });
    }

    cursor = cursor.plus({ minutes: 15 });
  }

  return slots;
}