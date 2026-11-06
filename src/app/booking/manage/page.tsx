"use client";

import { useState } from "react";


type Booking = {
  id: string;
  status: string;
  guestName: string;
  guestEmail: string;
  slotStart: string;
  eventTypeId: string;
  eventName: string;
  timezone: string;
  duration: number;
};

export default function ManageBookingPage() {
  const [bookingId, setBookingId] = useState("");
  const [token, setToken] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [newSlot, setNewSlot] = useState("");

  async function findBooking(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setBooking(null);

    try {
      const response = await fetch(
        `/api/bookings/${bookingId}/manage`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to find booking");
      }

      setBooking(result.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  async function manageBooking(action: "cancel" | "reschedule") {
  if (!booking) return;

  setActionLoading(true);
  setActionMessage("");
  setError("");

  try {
    const response = await fetch(
      `/api/bookings/${booking.id}/manage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
            action === "cancel"
                ? { action: "cancel" }
                : {
                    action: "reschedule",
                    slotStart: new Date(newSlot).toISOString(),
                }
            ),
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Unable to update booking");
    }

    setActionMessage(result.message);

    if (action === "cancel") {
      setBooking({ ...booking, status: "cancelled" });
    } else {
      setBooking({
        ...booking,
        slotStart: result.data.booking.slotStart,
      });
      setNewSlot("");
    }
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Something went wrong"
    );
  } finally {
    setActionLoading(false);
  }
}

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-bold text-slate-900">
          Manage your booking
        </h1>

        <p className="mt-2 text-slate-600">
          Enter your booking ID and private management token.
        </p>

        <form
          onSubmit={findBooking}
          className="mt-8 space-y-5 rounded-xl border bg-white p-6 shadow-sm"
        >
          <div>
            <label className="mb-2 block text-sm font-medium">
              Booking ID
            </label>

            <input
              required
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              className="w-full rounded-lg border px-3 py-3"
              placeholder="Enter booking ID"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Management token
            </label>

            <input
              required
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full rounded-lg border px-3 py-3"
              placeholder="Enter private token"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? "Loading..." : "Find booking"}
          </button>
        </form>

        {booking && (
          <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">
              Booking details
            </h2>

            <p className="mt-4">
              <strong>Event:</strong> {booking.eventName}
            </p>

            <p className="mt-2">
              <strong>Name:</strong> {booking.guestName}
            </p>

            <p className="mt-2">
              <strong>Email:</strong> {booking.guestEmail}
            </p>

            <p className="mt-2">
              <strong>Date:</strong>{" "}
              {new Date(booking.slotStart).toLocaleString()}
            </p>

            <p className="mt-2">
              <strong>Status:</strong> {booking.status}
            </p>
            {booking.status === "confirmed" && (
                <div className="mt-6 border-t pt-5">
                    <h3 className="text-lg font-semibold">
                    Reschedule appointment
                    </h3>

                    <p className="mt-2 text-sm text-slate-500">
                    Select a new appointment date and time.
                    </p>

                    <input
                    type="datetime-local"
                    value={newSlot}
                    onChange={(e) => setNewSlot(e.target.value)}
                    className="mt-3 w-full rounded-lg border px-3 py-3"
                    />

                    <button
                    type="button"
                    disabled={!newSlot || actionLoading}
                    onClick={() => {
                        const selectedDate = new Date(newSlot);

                        if (Number.isNaN(selectedDate.getTime())) {
                        setError("Please select a valid date and time.");
                        return;
                        }

                        void manageBooking("reschedule");
                    }}
                    className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white disabled:opacity-50"
                    >
                    Reschedule booking
                    </button>

                    <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => {
                        if (window.confirm("Are you sure you want to cancel this booking?")) {
                        void manageBooking("cancel");
                        }
                    }}
                    className="mt-3 w-full rounded-lg border border-red-300 px-4 py-3 font-medium text-red-600 disabled:opacity-50"
                    >
                    Cancel booking
                    </button>
                </div>
                )}

                {actionMessage && (
                <p className="mt-4 text-sm font-medium text-green-700">
                    {actionMessage}
                </p>
                )}
          </div>
        )}
      </div>
    </main>
  );
}