import React, { useState, useEffect } from 'react';
import { Search, MessageSquare, Calendar, User, Link, Image, Sparkles, RefreshCw } from 'lucide-react';

const SlackReleasesDashboard = () => {
  const [releases, setReleases] = useState([]);
  const [filteredReleases, setFilteredReleases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [geminiLoading, setGeminiLoading] = useState(false);

  // --- Format sender name properly ---
  const formatSenderName = (name) => {
    if (!name || typeof name !== 'string') return 'Unknown';
    return name
      .split('.')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  // --- Clean Slack text for proper formatting ---
  const cleanSlackText = (text) => {
    if (!text) return '';

    let cleaned = text;

    // Replace Slack links
    cleaned = cleaned.replace(/<((?:https?:\/\/)[^|>]+)\|([^>]+)>/g, '<a href="$1" target="_blank" class="text-blue-600 underline">$2</a>');
    cleaned = cleaned.replace(/<((?:https?:\/\/)[^>]+)>/g, '<a href="$1" target="_blank" class="text-blue-600 underline">$1</a>');

    // Remove Slack channel refs like <#C1234|channel>
    cleaned = cleaned.replace(/<#\w+\|?[^>]*>/g, '');

    // Mentions → @user
    cleaned = cleaned.replace(/<@[^>]+>/g, '@user');

    // Remove emoji shortcodes like :wave:
    cleaned = cleaned.replace(/:[a-zA-Z0-9_+\-]+:/g, '');

    // Strip code blocks
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

    // Normalize bullets
    cleaned = cleaned.replace(/[ \t]*[-\*•·▪▫◦‣⁃][ \t]*/g, '\n• ');

    // Bold section headers
    const boldRegex = /(Internal release note|What(?:’|')s new|Why It Matters\?|What(?:’|')s next|Solution|Problem)/gi;
    cleaned = cleaned.replace(boldRegex, '<b>$1</b>');

    // Format newlines
    cleaned = cleaned
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return cleaned;
  };

  // --- Extract links for "Links" section ---
  const extractLinks = (text) => {
    if (!text) return [];
    const matches = text.match(/<?(https?:\/\/[^\s>]+)>?/g);
    return matches ? matches.map(m => m.replace(/[<>]/g, '')) : [];
  };

  // --- Filter out replies (short msgs) ---
  const isTooShortToShow = (main, details) => {
    const m = (main || '').trim();
    const d = (details || '').trim();
    return m.length > 0 && m.length < 200 && d.length === 0;
  };

  // --- Format timestamps ---
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = /^\d+$/.test(timestamp) ? new Date(parseInt(timestamp, 10) * 1000) : new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;
    return date.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' });
  };

  // --- Fetch Google Sheets data ---
  const fetchGoogleSheetsData = async () => {
    setLoading(true);
    try {
      const API_KEY = process.env.REACT_APP_GOOGLE_SHEETS_API_KEY;
      const SHEET_ID = process.env.REACT_APP_GOOGLE_SHEET_ID;
      const WORKSHEET = process.env.REACT_APP_GOOGLE_WORKSHEET_NAME || 'september';

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${WORKSHEET}?key=${API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.values && data.values.length > 1) {
        const [headers, ...rows] = data.values;
        const formatted = rows.map((row, i) => {
          const main = row[2] || '';
          const details = row[3] || '';
          if (isTooShortToShow(main, details)) return null;

          return {
            id: i + 1,
            timestamp: row[0] || '',
            sender: formatSenderName(row[1]),
            mainMessage: cleanSlackText(main),
            detailedNotes: cleanSlackText(details),
            screenshotLink: row[4] || null,
            slackLink: row[5] || null,
            extractedLinks: extractLinks(main + ' ' + details)
          };
        }).filter(Boolean);

        setReleases(formatted.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
        setFilteredReleases(formatted);
      } else {
        setReleases([]); setFilteredReleases([]);
      }
    } catch (err) {
      console.error('Error fetching Google Sheets:', err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchGoogleSheetsData(); }, []);
  useEffect(() => {
    setFilteredReleases(releases.filter(r =>
      r.mainMessage.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.sender.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.detailedNotes.toLowerCase().includes(searchTerm.toLowerCase())
    ));
  }, [searchTerm, releases]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Product Releases</h1>
              <p className="text-gray-600 mt-1">Track and analyze your team's release communications</p>
            </div>
            <button onClick={fetchGoogleSheetsData} disabled={loading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {filteredReleases.map(r => (
            <div key={r.id} className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {r.sender.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold">{r.sender}</p>
                    <p className="text-sm text-gray-500">{formatTimestamp(r.timestamp)}</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  {r.screenshotLink && (
                    <a href={r.screenshotLink} target="_blank" rel="noreferrer"
                      className="p-2 border rounded-lg hover:bg-blue-50 text-blue-600" title="Screenshot">
                      <Image className="w-5 h-5" />
                    </a>
                  )}
                  {r.slackLink && (
                    <a href={r.slackLink} target="_blank" rel="noreferrer"
                      className="p-2 border rounded-lg hover:bg-purple-50 text-purple-600" title="Slack Thread">
                      <Link className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div dangerouslySetInnerHTML={{ __html: r.mainMessage }} className="text-lg font-normal text-gray-900 whitespace-pre-line" />
                {r.detailedNotes && (
                  <div dangerouslySetInnerHTML={{ __html: r.detailedNotes }} className="text-gray-700 whitespace-pre-line" />
                )}
              </div>
            </div>
          ))}

          {filteredReleases.length === 0 && (
            <div className="text-center py-12 text-gray-500">No releases found.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SlackReleasesDashboard;
