"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Search, ExternalLink, Paperclip } from "lucide-react";

// === Google Sheets Fetch ===
const fetchGoogleSheetsData = async () => {
  try {
    const response = await fetch(
      "https://opensheet.elk.sh/1WcfJv6R3ZpKONX_kJ4PfZoixlffdeDQOjmiKZLDC2tE/Sheet1"
    );
    if (!response.ok) throw new Error("Failed to fetch data");
    const rows = await response.json();

    // Filter out thread replies and format data
    const formattedData = rows
      // Filter: Only include top-level messages (no replies). Replies have a thread_ts value.
      .filter((row) => !row.thread_ts || row.thread_ts === row.ts)
      .map((row, index) => ({
        id: index + 1,
        timestamp: row.Timestamp || "",
        sender: formatSenderName(row.Sender || "Unknown"), // Apply sender name formatting
        mainMessage: cleanSlackText(row["Main Message"]) || "",
        detailedNotes: cleanSlackText(row["Detailed Notes"]) || "",
        screenshotLink:
          row["Screenshot Link"] && row["Screenshot Link"].trim() !== "null"
            ? row["Screenshot Link"].trim()
            : null,
        slackLink:
          row["Slack Link"] && row["Slack Link"].trim() !== "null"
            ? row["Slack Link"].trim()
            : null,
        extractedLinks: extractLinks(
          (row["Main Message"] || "") + " " + (row["Detailed Notes"] || "")
        ),
      }));

    return formattedData;
  } catch (error) {
    console.error("Error fetching Google Sheets data:", error);
    return [];
  }
};

// === Helper Functions ===

// Format sender's name to Title Case
const formatSenderName = (name) => {
  if (!name) return "";
  return name
    .toLowerCase()
    .split(".")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Clean Slack-style formatting
const cleanSlackText = (text) => {
  if (!text) return "";

  let cleaned = text;

  // Replace Slack hyperlinks <https://url|label> → label
  cleaned = cleaned.replace(/<https?:\/\/[^|]+\|([^>]+)>/g, "$1");

  // Replace bare Slack links <https://url> → https://url
  cleaned = cleaned.replace(/<((?:https?|ftp):\/\/[^|>]+)>/g, "$1");

  // Remove Slack emoji codes :wave:
  cleaned = cleaned.replace(/:[^:\s]*:/g, "");

  // Replace channel mentions <#C12345|channel> → #channel
  cleaned = cleaned.replace(/<#[A-Z0-9]+\|([^>]+)>/g, "#$1");

  // Replace user mentions <@U12345> → @user
  cleaned = cleaned.replace(/<@([A-Z0-9]+)>/g, "@$1");

  // Remove bold markdown (*text* or **text**)
  cleaned = cleaned.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1");

  // Preserve line breaks
  cleaned = cleaned.replace(/\n/g, "<br/>");

  // Remove other specific slack formatting
  cleaned = cleaned.replace(/<[^>]+>/g, "");

  return cleaned.trim();
};

// Extract Slack links → clickable objects
const extractLinks = (text) => {
  if (!text) return [];

  const matches = [
    ...text.matchAll(/<((?:https?|ftp):\/\/[^|>]+)(?:\|([^>]+))?>/g),
  ];

  return matches.map((m) => {
    const url = m[1];
    const label = m[2] || url;
    return { url, label };
  });
};

// === Main Dashboard Component ===
export default function SlackReleasesDashboard() {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const getData = async () => {
      const data = await fetchGoogleSheetsData();
      setReleases(data);
      setLoading(false);
    };
    getData();
  }, []);

  // Filter releases by search term
  const filteredReleases = useMemo(() => {
    if (!searchTerm) return releases;
    return releases.filter(
      (release) =>
        release.mainMessage.toLowerCase().includes(searchTerm.toLowerCase()) ||
        release.detailedNotes.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, releases]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      {/* Header */}
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          🚀 Productboard Release Notes
        </h1>
        <div className="flex gap-4 items-center">
          <div className="relative flex-grow">
            <Input
              type="text"
              placeholder="Search releases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full rounded-xl border-gray-300 focus:ring-2 focus:ring-blue-500"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
          </div>
        </div>
      </header>

      {/* Loading State */}
      {loading ? (
        <p className="text-gray-500">Loading release notes...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReleases.map((release, index) => (
            <motion.div
              key={release.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <Card className="rounded-2xl shadow-md hover:shadow-xl transition-shadow bg-white">
                <CardContent className="p-6 space-y-4">
                  {/* Sender and Date */}
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>{release.sender}</span>
                    <span>{release.timestamp}</span>
                  </div>

                  {/* Main Message */}
                  <div
                    className="text-lg font-medium text-gray-900"
                    dangerouslySetInnerHTML={{ __html: release.mainMessage }}
                  />

                  {/* Detailed Notes */}
                  {release.detailedNotes && (
                    <div
                      className="text-gray-700 leading-relaxed whitespace-pre-line break-words"
                      dangerouslySetInnerHTML={{
                        __html: release.detailedNotes,
                      }}
                    />
                  )}

                  {/* Links Section */}
                  {(release.extractedLinks.length > 0 ||
                    release.screenshotLink ||
                    release.slackLink) && (
                    <div className="pt-2">
                      <h4 className="text-sm font-semibold text-gray-600 mb-1">
                        Resources:
                      </h4>
                      <ul className="list-disc list-inside space-y-1">
                        {release.extractedLinks.map((link, i) => (
                          <li key={i}>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              {link.label}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </li>
                        ))}
                        {release.screenshotLink && (
                          <li>
                            <a
                              href={release.screenshotLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              View Screenshot
                              <Paperclip className="w-3 h-3" />
                            </a>
                          </li>
                        )}
                        {release.slackLink && (
                          <li>
                            <a
                              href={release.slackLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              View in Slack
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
