"use client";

import { useState } from "react";
import {
  parseBookingReference,
  formatBookingReference,
} from "@/lib/booking-reference";


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
      const enteredReference = bookingId.trim();

      const internalBookingId = enteredReference
        .toUpperCase()
        .startsWith("SBK-")
        ? parseBookingReference(enteredReference)
        : enteredReference;

      const response = await fetch(
        `/api/bookings/${internalBookingId}/manage`,
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
    <main className="min-h-screen bg-slate-100 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-bold text-slate-900">
          Manage your booking
        </h1>

        <p className="mt-2 text-sm font-medium text-slate-700">
          Enter your booking reference and private management token.
        </p>

        <form
          onSubmit={findBooking}
          className="mt-8 space-y-5 rounded-xl border bg-white p-6 shadow-sm"
        >
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">
              Booking reference
            </label>

            <input
              required
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-500 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
              placeholder="e.g. SBK-XXXXXXXX"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">
              Management token
            </label>

            <input
              required
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-500 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
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
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
            <h2 className="text-xl font-semibold">
              Booking details
            </h2>

            <div className="mt-3 rounded-lg bg-indigo-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Slotbook reference
              </p>
              <p className="mt-1 text-lg font-bold text-indigo-800">
                {formatBookingReference(booking.id)}
              </p>
            </div>

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

                    <p className="mt-2 text-sm font-medium text-slate-700">
                    Select a new appointment date and time.
                    </p>

                    <input
                    type="datetime-local"
                    value={newSlot}
                    onChange={(e) => setNewSlot(e.target.value)}
                    className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
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