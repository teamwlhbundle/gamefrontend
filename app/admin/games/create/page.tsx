"use client";

import { useState, useCallback } from "react";
import { Calendar } from "./Calendar";
import { DaySchedulePanel } from "./DaySchedulePanel";
import { CreateGameDrawer } from "./CreateGameDrawer";

export default function CreateGamePage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarKey, setCalendarKey] = useState(0);

  const handleCreateSuccess = useCallback(() => {
    setCalendarKey((k) => k + 1);
  }, []);

  return (
    <div className="p-6 flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <h1 className="text-xl font-semibold text-neutral-900">Create Game</h1>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-slate-800 text-white font-medium hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
        >
          Create Game
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-hidden">
        <div className="lg:col-span-2 min-w-0 min-h-0 overflow-y-auto">
          <Calendar
            key={calendarKey}
            selectedDate={selectedDate}
            onSelectDate={(dateStr) => setSelectedDate(dateStr)}
          />
        </div>
        <div className="lg:col-span-1 flex flex-col min-h-0 overflow-hidden lg:sticky lg:top-6">
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
            {selectedDate ? (
              <DaySchedulePanel
                dateStr={selectedDate}
                onClose={() => setSelectedDate(null)}
              />
            ) : (
              <div className="p-6 text-center bg-slate-50/50 flex-1 overflow-y-auto">
                <p className="text-sm text-slate-500">
                  Click a date on the calendar to see that day&apos;s schedule.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {drawerOpen && (
        <CreateGameDrawer
          onClose={() => setDrawerOpen(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  );
}
