import React, { useState, useEffect } from 'react';
import { Search, MessageSquare, Calendar, User, Link, Image, Sparkles, RefreshCw, ExternalLink, Paperclip } from 'lucide-react';
import { format } from "date-fns";

const SlackReleasesDashboard = () => {
  const [releases, setReleases] = useState([]);
  const [filteredReleases, setFilteredReleases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [geminiLoading, setGeminiLoading] = useState(false);

  // --- Helper Functions ---

  // Format sender's name to Title Case
  const formatSenderName = (rawName) => {
    if (!rawName) return "Unknown";
    return rawName
      .toLowerCase()
      .split(/[._]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  // Clean Slack text, remove emojis, channel tags, format bullets
  const cleanSlackText = (text) => {
    if (!text) return "";

    let cleaned = text;

    // 1) Remove emojis like :wave: or :rocket:
    cleaned = cleaned.replace(/:[a-zA-Z0-9_+\-]+:/g, "");

    // 2) Remove markdown bold/italic markers (*text* or **text**)
    cleaned = cleaned.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1");

    // 3) Convert Slack-style links: <https://url|Label> -> Label, <https://url> -> https://url
    cleaned = cleaned.replace(/<https?:\/\/[^|]+\|([^>]+)>/g, "$1 ($1)");
    cleaned = cleaned.replace(/<((?:https?|ftp):\/\/[^>]+)>/g, "$1");

    // 4) Clean up user and channel mentions
    cleaned = cleaned.replace(/<#[^>]+>/g, "");
    cleaned = cleaned.replace(/<@[^>]+>/g, "");

    // 5) Remove code blocks and inline code
    cleaned = cleaned.replace(/```[\s\S]*?```/g, "");
    cleaned = cleaned.replace(/`([^`]+)`/g, "$1");

    // 6) Preserve paragraph breaks
    cleaned = cleaned.replace(/\n{2,}/g, '\n\n');

    return cleaned.trim();
  };

  // Extract all links into a separate array
  const extractLinks = (text) => {
    if (!text) return [];
    const urlMatches = text.match(/<?(https?:\/\/[^\s>]+)>?/g);
    if (!urlMatches) return [];
    return urlMatches.map(match => match.replace(/[<>]/g, ''));
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(Number(timestamp) * 1000);
    if (isNaN(date.getTime())) return timestamp;
    return format(date, "PPP p");
  };

  // --- Data Fetching ---
  const fetchGoogleSheetsData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "https://opensheet.elk.sh/1WcfJv6R3ZpKONX_kJ4PfZoixlffdeDQOjmiKZLDC2tE/Sheet1"
      );
      const rows = await response.json();

      const formattedData = rows
        // Filter out thread replies
        .filter(row => !row.thread_ts)
        .map((row, index) => {
          const messageText = row[2] || "";
          const detailedText = row[3] || "";

          return {
            id: index + 1,
            timestamp: row[0] || "",
            sender: formatSenderName(row[1] || "Unknown"),
            mainMessage: cleanSlackText(messageText),
            detailedNotes: cleanSlackText(detailedText),
            screenshotLink: row[4] || null,
            slackLink: row[5] || null,
            extractedLinks: extractLinks((row[2] || "") + " " + (row[3] || "")),
          };
        });

      setReleases(formattedData);
      setFilteredReleases(formattedData);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  // --- React Hooks ---
  useEffect(() => {
    fetchGoogleSheetsData();
  }, []);

  useEffect(() => {
    const filtered = releases.filter(release =>
      (release.mainMessage || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (release.sender || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (release.detailedNotes || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredReleases(filtered);
  }, [searchTerm, releases]);

  // --- Gemini Chat Handlers ---
  const handleGeminiQuery = async (message) => {
    setGeminiLoading(true);
    setChatMessages(prev => [...prev, { role: 'user', content: message }]);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const mockResponse = `Based on your release data, I can see ${releases.length} releases. What would you like to know about them?`;
      setChatMessages(prev => [...prev, { role: 'assistant', content: mockResponse }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    }
    setGeminiLoading(false);
    setCurrentMessage('');
  };

  const handleSendMessage = () => {
    if (currentMessage.trim()) {
      handleGeminiQuery(currentMessage.trim());
    }
  };

  // --- Main Render ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Product Releases</h1>
              <p className="text-gray-600 mt-1">Track and analyze your team's release communications</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={fetchGoogleSheetsData}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh Data
              </button>
              <button
                onClick={() => setShowChat(!showChat)}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Ask Gemini
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          <div className={`flex-1 ${showChat ? 'mr-0' : ''}`}>
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search releases, messages, or team members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center">
                  <MessageSquare className="w-8 h-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Releases</p>
                    <p className="text-2xl font-bold text-gray-900">{releases.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center">
                  <User className="w-8 h-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Contributors</p>
                    <p className="text-2xl font-bold text-gray-900">{new Set(releases.map(r => r.sender)).size}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center">
                  <Calendar className="w-8 h-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">This Month</p>
                    <p className="text-2xl font-bold text-gray-900">{releases.length}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {filteredReleases.map((release) => (
                <div key={release.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {release.sender.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{release.sender}</p>
                          <p className="text-sm text-gray-500">{formatTimestamp(release.timestamp)}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        {release.screenshotLink && (
                          <a
                            href={release.screenshotLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200"
                            title="View Screenshot"
                          >
                            <Image className="w-5 h-5" />
                          </a>
                        )}
                        {release.slackLink && (
                          <a
                            href={release.slackLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors border border-gray-200"
                            title="View in Slack"
                          >
                            <Link className="w-5 h-5" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3
                        className="text-lg font-normal text-gray-900"
                        dangerouslySetInnerHTML={{ __html: release.mainMessage }}
                      />
                      {release.detailedNotes && (
                        <div
                          className="text-gray-700 leading-relaxed whitespace-pre-line break-words"
                          dangerouslySetInnerHTML={{ __html: release.detailedNotes }}
                        />
                      )}
                      {release.extractedLinks && release.extractedLinks.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-sm font-medium text-gray-600 mb-2">Links:</p>
                          <div className="flex flex-wrap gap-2">
                            {release.extractedLinks.map((link, idx) => (
                              <a
                                key={idx}
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                <Link className="w-3 h-3 mr-1" />
                                {link.length > 40 ? `${link.substring(0, 40)}...` : link}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {filteredReleases.length === 0 && (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No releases found matching your search.</p>
                </div>
              )}
            </div>
          </div>

          {showChat && (
            <div className="w-96 bg-white rounded-xl shadow-sm border border-slate-200 h-fit">
              <div className="p-4 border-b border-slate-200">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-900">Ask Gemini</h3>
                </div>
                <p className="text-sm text-gray-600 mt-1">Ask questions about your releases</p>
              </div>

              <div className="h-96 overflow-y-auto p-4">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-gray-500 mt-8">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Start a conversation with Gemini about your release data!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className={msg.role === 'user' ? 'ml-4' : 'mr-4'}>
                        <div className={`p-3 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white ml-auto'
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          <p className="text-sm">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    {geminiLoading && (
                      <div className="mr-4">
                        <div className="bg-gray-100 text-gray-900 p-3 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-200">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    placeholder="Ask about your releases..."
                    disabled={geminiLoading}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={geminiLoading || !currentMessage.trim()}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SlackReleasesDashboard;
