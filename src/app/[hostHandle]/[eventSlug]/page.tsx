import { notFound } from "next/navigation";
import AvailabilityPicker from "@/components/booking/availability-picker";
export const instant = false;

type PageProps = {
  params: Promise<{
    hostHandle: string;
    eventSlug: string;
  }>;
};

type EventDetails = {
  hostName: string;
  hostHandle: string;
  timezone: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  duration: number;
};

export default async function PublicBookingPage({
  params,
}: PageProps) {
  const { hostHandle, eventSlug } = await params;

  const response = await fetch(
    `http://localhost:3000/api/public/events/${encodeURIComponent(hostHandle)}/${encodeURIComponent(eventSlug)}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    notFound();
  }

  const result = await response.json();

  if (!result.success || !result.data) {
    notFound();
  }

  const event: EventDetails = result.data;

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-lg border border-slate-200 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Slotbook
          </h1>

          <p className="mt-2 text-slate-500">
            Simple scheduling. Seamless booking.
          </p>
        </div>

        <div className="border-t border-slate-200 pt-8">
          <p className="text-sm font-medium text-blue-600">
            {event.hostName}
          </p>

          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            {event.eventName}
          </h2>

          <div className="mt-6 flex flex-wrap gap-6 text-sm text-slate-600">
            <span>{event.duration} minutes</span>
            <span>{event.timezone}</span>
          </div>

          <p className="mt-8 text-slate-500">
            Select a convenient time to schedule your meeting.
          </p>

          <AvailabilityPicker
            eventId={event.eventId}
            timezone={event.timezone}
          />
        </div>
      </div>
    </main>
  );
}