"use client";

import { useEffect, useState } from "react";

type Slot = {
  start: string;
  end: string;
  bufferedStart: string;
  bufferedEnd: string;
};

type AvailabilityResponse = {
  success: boolean;
  date?: string;
  timezone?: string;
  data?: Slot[];
  message?: string;
};

type Props = {
  eventId: string;
  timezone: string;
};

function getToday(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function AvailabilityPicker({
  eventId,
  timezone,
}: Props) {
  const [date, setDate] = useState(() => getToday(timezone));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [holdId, setHoldId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<{
    id: string;
    managementToken: string;
  } | null>(null);
  useEffect(() => {
    if (!holdId || !expiresAt) return;

    const updateCountdown = () => {
        const remaining = Math.max(
        0,
        Math.floor(
            (new Date(expiresAt).getTime() - Date.now()) / 1000
        )
        );

        setTimeLeft(remaining);

        if (remaining <= 0) {
        setHoldId("");
        setExpiresAt("");
        setSelectedSlot("");
        setError(
            "Your reservation has expired. Please select another time."
        );
        }
    };

    updateCountdown();

    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
    }, [holdId, expiresAt]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSlots() {
      setLoading(true);
      setError("");
      setMessage("");
      setSelectedSlot("");
      setSlots([]);

      try {
        const response = await fetch(
          `/api/event-types/${eventId}/slots?date=${date}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result: AvailabilityResponse = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Unable to load slots");
        }

        setSlots(result.data ?? []);
        setMessage(result.message ?? "");
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadSlots();

    return () => controller.abort();
  }, [eventId, date]);

  function formatTime(isoDate: string) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(isoDate));
  }

  return (
    <section className="mt-8 border-t border-slate-200 pt-8">
      <h3 className="text-lg font-semibold text-slate-900">
        Select a date
      </h3>

      <p className="mt-2 text-sm text-slate-500">
        Available appointment times will be shown in your local timezone.
      </p>

      <input
        type="date"
        value={date}
        min={getToday(timezone)}
        onChange={(event) => setDate(event.target.value)}
        className="mt-5 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-700 outline-none focus:border-blue-500"
      />

      <div className="mt-6">
        <h4 className="font-medium text-slate-800">
          Available times
        </h4>

        {loading && (
          <p className="mt-4 text-sm text-slate-500">
            Loading available times...
          </p>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}

        {!loading && !error && slots.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">
            {message || "No available slots for this date."}
          </p>
        )}

        {!loading && slots.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {slots.map((slot) => (
              <button
                key={slot.start}
                type="button"
                onClick={() => setSelectedSlot(slot.start)}
                className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${
                  selectedSlot === slot.start
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-blue-500 hover:text-blue-600"
                }`}
              >
                {formatTime(slot.start)}
              </button>
            ))}
          </div>
        )}

        {selectedSlot && (
        <div className="mt-5 space-y-4">
            <p className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
            Selected time: {formatTime(selectedSlot)}
            </p>

            <button
            type="button"
            onClick={async () => {
                try {
                setError("");
                setLoading(true);

                const response = await fetch(
                    `/api/event-types/${eventId}/holds`,
                    {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Idempotency-Key": crypto.randomUUID(),
                    },
                    body: JSON.stringify({
                        slotStart: selectedSlot,
                    }),
                    }
                );

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(
                    result.message || "Unable to reserve this slot"
                    );
                }

                setHoldId(result.data.id);
                setExpiresAt(result.data.expiresAt);
                } catch (err) {
                setError(
                    err instanceof Error
                    ? err.message
                    : "Something went wrong"
                );
                } finally {
                setLoading(false);
                }
            }}
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
            {loading ? "Reserving..." : "Continue"}
            </button>
        </div>
        )}
      </div>

      {holdId && (
        <div className="mt-8 rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900">
            Enter your details
            </h3>

            <p className="mt-2 text-sm font-medium text-orange-600">
                Time remaining: {Math.floor(timeLeft / 60)}:
                {String(timeLeft % 60).padStart(2, "0")}
            </p>

            <form
            className="mt-5 space-y-4"
            onSubmit={async (event) => {
                event.preventDefault();
                setBookingLoading(true);
                setError("");

                try {
                const response = await fetch(
                    `/api/holds/${holdId}/confirm`,
                    {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        guestName,
                        guestEmail,
                    }),
                    }
                );

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(
                    result.message || "Unable to confirm booking"
                    );
                }

                setConfirmedBooking({
                    id: result.data.booking.id,
                    managementToken: result.data.managementToken,
                });

                setHoldId("");
                } catch (err) {
                setError(
                    err instanceof Error
                    ? err.message
                    : "Booking confirmation failed"
                );
                } finally {
                setBookingLoading(false);
                }
            }}
            >
            <input
                required
                maxLength={100}
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                placeholder="Your full name"
                className="w-full rounded-lg border border-slate-300 px-4 py-3"
            />

            <input
                required
                type="email"
                maxLength={255}
                value={guestEmail}
                onChange={(event) => setGuestEmail(event.target.value)}
                placeholder="Your email address"
                className="w-full rounded-lg border border-slate-300 px-4 py-3"
            />

            <button
                type="submit"
                disabled={bookingLoading}
                className="w-full rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
                {bookingLoading ? "Confirming..." : "Confirm Booking"}
            </button>
            </form>
        </div>
        )}

        {confirmedBooking && (
        <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-6">
            <h3 className="text-lg font-semibold text-green-800">
            Booking confirmed!
            </h3>

            <p className="mt-2 text-sm text-green-700">
            Your appointment has been successfully booked.
            </p>

            <p className="mt-3 text-sm text-green-700">
            Booking ID: {confirmedBooking.id}
            </p>

            <p className="mt-3 break-all text-xs text-green-700">
            Management token: {confirmedBooking.managementToken}
            </p>
        </div>
        )}
    </section>
  );
}