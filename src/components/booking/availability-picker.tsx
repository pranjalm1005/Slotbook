
"use client";

import { useEffect, useState } from "react";
import { formatBookingReference } from "@/lib/booking-reference";

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

const fieldClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100";

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
  const [showManagementToken, setShowManagementToken] = useState(false);
  const [copiedField, setCopiedField] = useState("");

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
      timeZone: timezone,
    }).format(new Date(isoDate));
  }

  async function reserveSlot() {
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
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmBooking(event: React.FormEvent<HTMLFormElement>) {
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
      setExpiresAt("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Booking confirmation failed"
      );
    } finally {
      setBookingLoading(false);
    }
  }
  async function copyToClipboard(value: string, field: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
    } catch {
      setError("Unable to copy. Please copy the value manually.");
    }
  }
  return (
    <section className="mt-5">
      {confirmedBooking ? (
        <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">
              ✓
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Booking confirmed!
              </h3>
              <p className="text-sm text-slate-600">
                Your appointment has been successfully scheduled.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Booking reference
              </p>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <p className="break-all text-xl font-extrabold tracking-wide text-indigo-700">
                  {formatBookingReference(confirmedBooking.id)}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      formatBookingReference(confirmedBooking.id),
                      "reference"
                    )
                  }
                  className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50"
                >
                  {copiedField === "reference" ? "Copied!" : "Copy reference"}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Booking management token
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-800">
                Keep this token private. You will need it to manage or cancel your booking.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 break-all rounded-lg border border-amber-200 bg-white px-3 py-3 font-mono text-sm text-slate-800">
                  {showManagementToken
                    ? confirmedBooking.managementToken
                    : "••••••••••••••••••••••••"}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setShowManagementToken((previous) => !previous)
                  }
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
                >
                  {showManagementToken ? "Hide" : "Reveal"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      confirmedBooking.managementToken,
                      "token"
                    )
                  }
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
                >
                  {copiedField === "token" ? "Copied!" : "Copy token"}
                </button>
              </div>
            </div>

            <p className="text-center text-xs leading-5 text-slate-500">
              Save your booking reference and management token for future access.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          {/* Date and available slots */}
          <div className="min-w-0">
            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-900">
                Choose a date
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Available times are displayed in the event timezone.
              </p>
            </div>

            <input
              type="date"
              value={date}
              min={getToday(timezone)}
              onChange={(event) => setDate(event.target.value)}
              disabled={Boolean(holdId)}
              className={fieldClass}
            />

            <div className="mt-5">
              <h4 className="text-sm font-bold text-slate-900">
                Available times
              </h4>

              {loading && (
                <p className="mt-3 text-sm text-slate-600">
                  Loading available times...
                </p>
              )}

              {!loading && slots.length === 0 && !error && (
                <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                  {message || "No available slots for this date."}
                </p>
              )}

              {!loading && slots.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot.start}
                      type="button"
                      disabled={Boolean(holdId)}
                      onClick={() => setSelectedSlot(slot.start)}
                      className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                        selectedSlot === slot.start
                          ? "border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-100"
                          : "border-slate-300 bg-white text-slate-800 hover:border-indigo-500 hover:bg-indigo-50"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {formatTime(slot.start)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedSlot && !holdId && (
              <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                <p className="text-sm font-semibold text-indigo-950">
                  Selected: {formatTime(selectedSlot)}
                </p>

                <button
                  type="button"
                  onClick={reserveSlot}
                  disabled={loading}
                  className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? "Reserving..." : "Continue to details"}
                </button>
              </div>
            )}
          </div>

          {/* Guest details */}
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            {holdId ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Your details
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">
                      Complete your booking below.
                    </p>
                  </div>

                  <span className="shrink-0 rounded-lg bg-orange-100 px-3 py-2 text-xs font-bold text-orange-800">
                    {Math.floor(timeLeft / 60)}:
                    {String(timeLeft % 60).padStart(2, "0")}
                  </span>
                </div>

                <form
                  className="mt-5 space-y-4"
                  onSubmit={confirmBooking}
                >
                  <div>
                    <label
                      htmlFor="guestName"
                      className="mb-2 block text-sm font-semibold text-slate-900"
                    >
                      Full name
                    </label>
                    <input
                      id="guestName"
                      required
                      maxLength={100}
                      autoComplete="name"
                      value={guestName}
                      onChange={(event) =>
                        setGuestName(event.target.value)
                      }
                      placeholder="Enter your full name"
                      className={fieldClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="guestEmail"
                      className="mb-2 block text-sm font-semibold text-slate-900"
                    >
                      Email address
                    </label>
                    <input
                      id="guestEmail"
                      required
                      type="email"
                      maxLength={255}
                      autoComplete="email"
                      value={guestEmail}
                      onChange={(event) =>
                        setGuestEmail(event.target.value)
                      }
                      placeholder="you@example.com"
                      className={fieldClass}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={bookingLoading}
                    className="w-full rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-100 transition hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {bookingLoading
                      ? "Confirming booking..."
                      : "Confirm booking"}
                  </button>

                  <p className="text-center text-xs text-slate-500">
                    Your reserved slot is temporarily held while you
                    complete this form.
                  </p>
                </form>
              </>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-xl text-indigo-700">
                  ◷
                </div>
                <h3 className="mt-4 text-sm font-bold text-slate-900">
                  Almost there
                </h3>
                <p className="mt-2 max-w-52 text-xs leading-5 text-slate-600">
                  Select an available time and continue to enter your
                  booking details.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
          {error}
        </p>
      )}
    </section>
  );
}
