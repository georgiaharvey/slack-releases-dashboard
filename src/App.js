import React, { useState, useEffect, useRef } from "react";

const SlackReleasesDashboard = () => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showGeminiModal, setShowGeminiModal] = useState(false);
  const [geminiResponse, setGeminiResponse] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false); // ✅ Added
  const datePickerRef = useRef(null);

  // Close datepicker when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setShowDatePicker(false);
      }
    }
    if (showDatePicker) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDatePicker]);

  return (
    <div className="p-6">
      {/* Example top bar with Date Filter */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Slack Releases Dashboard</h1>

        <div className="relative" ref={datePickerRef}>
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Filter by Date
          </button>

          {showDatePicker && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-300 rounded-lg shadow-lg z-10 p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                className="w-full mb-3 border rounded px-2 py-1 text-sm"
              />
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                className="w-full border rounded px-2 py-1 text-sm"
              />
              <button
                onClick={() => setShowDatePicker(false)}
                className="mt-3 w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main content placeholder */}
      <div className="border rounded-lg p-6 bg-gray-50">
        <p className="text-gray-600">
          Your release notes will render here once connected to Google Sheets.
        </p>
      </div>
    </div>
  );
};

export default SlackReleasesDashboard;

