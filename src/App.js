import React, { useState, useEffect } from "react";
import { format } from "date-fns";

const SlackReleasesDashboard = () => {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(false);

  // Format Slack usernames like niall.cochrane -> Niall Cochrane
  const formatSenderName = (rawName) => {
    if (!rawName) return "Unknown";
    return rawName
      .split(/[._]/) // split on dot or underscore
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  // Clean Slack text, remove emojis, channel tags, format bullets
  const cleanSlackText = (text) => {
    if (!text) return "";

    let cleaned = text;

    // Remove emojis like :wave: or :rocket:
    cleaned = cleaned.replace(/:[^:\s]*(?:::[^:\s]*)*:/g, "");

    // Remove Slack channel mentions like <#C05L93HMHCM|>
    cleaned = cleaned.replace(/<#[A-Z0-9]+\|?>/gi, "");

    // Convert <http://url|label> → label (or just the URL if no label)
    cleaned = cleaned.replace(/<([^|>]+)\|([^>]+)>/g, "$2 ($1)");

    // Convert <http://url> → http://url
    cleaned = cleaned.replace(/<([^|>]+)>/g, "$1");

    // Format bullet points
    cleaned = cleaned
      .split("•")
      .map((part, idx) => (idx === 0 ? part.trim() : `\n• ${part.trim()}`))
      .join("");

    return cleaned.trim();
  };

  const fetchGoogleSheetsData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "https://opensheet.elk.sh/YOUR_SHEET_ID/Sheet1"
      );
      const rows = await response.json();

      const formattedData = rows
        .map((row, index) => {
          const messageText = row[2] || "";
          const detailedText = row[3] || "";
          const fullText = (messageText + " " + detailedText).trim();

          // Skip anything too short (< 200 chars total)
          if (fullText.length < 200) return null;

          return {
            id: index + 1,
            timestamp: row[0] || "",
            sender: formatSenderName(row[1] || "Unknown"),
            mainMessage: cleanSlackText(messageText),
            detailedNotes: cleanSlackText(detailedText),
          };
        })
        .filter((item) => item !== null);

      setReleases(formattedData);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGoogleSheetsData();
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Product Releases</h1>
      <button
        onClick={fetchGoogleSheetsData}
        disabled={loading}
        className="mb-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
      >
        {loading ? "Refreshing..." : "Refresh Data"}
      </button>
      <div className="space-y-4">
        {releases.map((release) => (
          <div
            key={release.id}
            className="bg-white rounded-lg shadow p-4 whitespace-pre-line"
          >
            <p className="text-sm text-gray-500">
              {release.sender} —{" "}
              {release.timestamp
                ? format(new Date(Number(release.timestamp) * 1000), "PPP p")
                : "Unknown date"}
            </p>
            <p className="mt-2">{release.mainMessage}</p>
            {release.detailedNotes && (
              <p className="mt-2 text-gray-700">{release.detailedNotes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SlackReleasesDashboard;
