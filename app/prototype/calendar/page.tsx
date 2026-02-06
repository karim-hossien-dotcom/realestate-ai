'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type CalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  htmlLink: string;
};

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBooking, setShowBooking] = useState(false);

  const success = searchParams.get('success');
  const urlError = searchParams.get('error');

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    try {
      const res = await fetch('/api/calendar/events');
      const data = await res.json();
      setConnected(data.connected);
      setEvents(data.events || []);
      if (data.error && data.connected) {
        setError(data.error);
      }
    } catch {
      setError('Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    const res = await fetch('/api/calendar/connect');
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
  }

  async function handleBookAppointment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const startDate = formData.get('date') as string;
    const startTime = formData.get('time') as string;
    const duration = parseInt(formData.get('duration') as string) || 30;

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

    const res = await fetch('/api/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: formData.get('summary'),
        description: formData.get('description'),
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        attendeeEmail: formData.get('attendeeEmail'),
        location: formData.get('location'),
      }),
    });

    const data = await res.json();
    if (data.ok) {
      setShowBooking(false);
      fetchEvents();
    } else {
      alert(data.error || 'Failed to create appointment');
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-gray-500">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        {connected && (
          <button
            onClick={() => setShowBooking(true)}
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <i className="fas fa-plus mr-2"></i>
            New Appointment
          </button>
        )}
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
          Google Calendar connected successfully!
        </div>
      )}

      {(urlError || error) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {urlError || error}
        </div>
      )}

      {!connected ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-calendar text-primary text-2xl"></i>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect Google Calendar</h2>
          <p className="text-gray-600 mb-6">
            Connect your Google Calendar to schedule appointments with leads.
          </p>
          <button
            onClick={handleConnect}
            className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-blue-700 inline-flex items-center"
          >
            <i className="fab fa-google mr-2"></i>
            Connect with Google
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Appointments</h2>
          </div>
          {events.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No upcoming appointments. Click "New Appointment" to schedule one.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {events.map((event) => (
                <div key={event.id} className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{event.summary}</h3>
                    <p className="text-sm text-gray-500">
                      {new Date(event.start).toLocaleString()} - {new Date(event.end).toLocaleTimeString()}
                    </p>
                  </div>
                  <a
                    href={event.htmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-blue-700"
                  >
                    <i className="fas fa-external-link-alt"></i>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Booking Modal */}
      {showBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">New Appointment</h2>
              <button onClick={() => setShowBooking(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleBookAppointment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  name="summary"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                  placeholder="Property Viewing"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    name="date"
                    type="date"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
                  <input
                    name="time"
                    type="time"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                <select name="duration" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900">
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Attendee Email</label>
                <input
                  name="attendeeEmail"
                  type="email"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                  placeholder="client@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  name="location"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                  placeholder="123 Main St"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  name="description"
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                  placeholder="Additional details..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBooking(false)}
                  className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
