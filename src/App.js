import React, { useState, useEffect } from 'react';
import { Search, MessageSquare, Calendar, User, Link, Image, Sparkles, RefreshCw } from 'lucide-react';

const SlackReleasesDashboard = () => {
  console.log('=== ENVIRONMENT CHECK ===');
  console.log('API Key:', process.env.REACT_APP_GOOGLE_SHEETS_API_KEY ? 'EXISTS' : 'MISSING');
  console.log('Sheet ID:', process.env.REACT_APP_GOOGLE_SHEET_ID ? 'EXISTS' : 'MISSING');
  console.log('Worksheet:', process.env.REACT_APP_GOOGLE_WORKSHEET_NAME ? 'EXISTS' : 'MISSING');

  const [releases, setReleases] = useState([]);
  const [filteredReleases, setFilteredReleases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [geminiLoading, setGeminiLoading] = useState(false);

  const formatSenderName = (name) => {
    if (!name || typeof name !== 'string') return 'Unknown';
    // Capitalize names that follow the "first.last" format
    if (name.includes('.')) {
      return name
        .split('.')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }
    // Capitalize single-word names
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  // --- Improved cleaning of Slack markup for display ---
  const cleanSlackText = (text) => {
    if (!text) return '';

    let cleaned = text;

    // 1) Convert Slack-style links: <https://url|Label> -> Label, <https://url> -> https://url
    cleaned = cleaned.replace(/<((?:https?:\/\/|ftp:\/\/)[^|>]+)\|([^>]+)>/g, '$2'); // <url|label> -> label
    cleaned = cleaned.replace(/<((?:https?:\/\/|ftp:\/\/)[^>]+)>/g, '$1'); // <url> -> url

    // 2) Remove Slack-style channel mentions completely (e.g., <#C1234|channel>)
    cleaned = cleaned.replace(/<#\w+\|?[^>]*>/g, '');

    // 3) User mentions <@U12345> -> @user (or remove if you prefer)
    cleaned = cleaned.replace(/<@[^>]+>/g, '@user');

    // 4) Remove Slack emoji shortcodes like :wave:
    cleaned = cleaned.replace(/:[a-zA-Z0-9_+\-]+:/g, '');

    // 5) Remove code blocks and inline code
    cleaned = cleaned.replace(/```[\s\S]*?```/g, ''); // remove fenced blocks
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1'); // inline code

    // 6) Remove markdown bold/italic markers but keep text
    cleaned = cleaned.replace(/\*\*([\s\S]*?)\*\*/g, '$1'); // **bold**
    cleaned = cleaned.replace(/\*([\s\S]*?)\*/g, '$1');     // *italic or single *
    cleaned = cleaned.replace(/_([^_]+)_/g, '$1');          // _italic_

    // NEW: Create a paragraph break after a question mark
    cleaned = cleaned.replace(/\?\s*/g, '?\n\n');

    // 7) Normalize bullet markers and put each on a new line for list formatting
    // This finds any bullet-like character and replaces it with a newline and a standard '• ' format.
    cleaned = cleaned.replace(/[ \t]*[-\*•·▪▫◦‣⁃][ \t]*/g, '\n• ');
    
    // NEW: Bold specific keywords
    const boldRegex = /(Internal release note|What(?:'|')s new|Why It Matters\?|What(?:'|')s next|Solution|Problem)/gi;
    cleaned = cleaned.replace(boldRegex, '<b>$1</b>');

    // 8) Final cleanup of all lines, preserving paragraph breaks
    cleaned = cleaned
      .split('\n')
      .map(line => line.trim()) // Trim each line
      .join('\n') // Re-join with single newlines
      .replace(/\n{3,}/g, '\n\n') // Collapse 3+ newlines into a standard paragraph break
      .trim(); // Remove any leading/trailing whitespace from the whole block

    return cleaned;
  };

  // preserve previous link extraction behavior (returns array of URLs)
  const extractLinks = (text) => {
    if (!text) return [];
    const urlMatches = text.match(/<?(https?:\/\/[^\s>]+)>?/g);
    if (!urlMatches) return [];
    return urlMatches.map(match => match.replace(/[<>]/g, ''));
  };

  // NEW: Only treat a message as a "reply-to-skip" when the main message is < 200 characters AND there are no detailed notes.
  // This is the single filtering criterion you asked for.
  const isTooShortToShow = (messageText, detailedText) => {
    const main = (messageText || '').trim();
    const details = (detailedText || '').trim();

    // If main message length is less than 200 and there are no detailed notes, skip it.
    if (main.length > 0 && main.length < 200 && details.length === 0) return true;

    // Keep everything else
    return false;
  };

  useEffect(() => {
    console.log('Component mounted, fetching Google Sheets data...');
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

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    // handle both unix seconds and ISO strings
    let date;
    if (/^\d+$/.test(String(timestamp))) {
      const ts = parseInt(timestamp, 10);
      date = new Date(ts * 1000);
    } else {
      date = new Date(timestamp);
    }
    if (isNaN(date.getTime())) return timestamp;
    return date.toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short'
    });
  };

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

  const fetchGoogleSheetsData = async () => {
    console.log('fetchGoogleSheetsData called');
    setLoading(true);

    try {
      const API_KEY = process.env.REACT_APP_GOOGLE_SHEETS_API_KEY;
      const SHEET_ID = process.env.REACT_APP_GOOGLE_SHEET_ID;
      const WORKSHEET = process.env.REACT_APP_GOOGLE_SHEET_NAME || process.env.REACT_APP_GOOGLE_SHEETS_WORKSHEET || 'september';

      console.log('Using values:', { API_KEY: API_KEY ? 'SET' : 'MISSING', SHEET_ID, WORKSHEET });

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${WORKSHEET}?key=${API_KEY}`;
      console.log('Fetching URL:', url);

      const response = await fetch(url);
      const data = await response.json();

      console.log('Google Sheets Response:', data);

      if (data.values && data.values.length > 1) {
        const [headers, ...rows] = data.values;
        console.log('Headers:', headers);
        console.log('Rows count:', rows.length);
        
        // First pass: collect all messages with their thread info
        const allMessages = rows.map((row, index) => {
          const timestamp = row[0] || '';
          const threadTs = row[6] || timestamp; // Column 7 (index 6) for thread_ts, fallback to timestamp
          
          return {
            rowIndex: index,
            timestamp: timestamp,
            threadTs: threadTs,
            sender: formatSenderName(row[1]),
            mainMessage: row[2] || '',
            detailedNotes: row[3] || '',
            screenshotLink: row[4] && row[4].trim() && row[4].trim() !== 'null' ? row[4].trim() : null,
            slackLink: row[5] && row[5].trim() && row[5].trim() !== 'null' ? row[5].trim() : null,
            isReply: threadTs !== timestamp && threadTs !== ''
          };
        });
        
        console.log('All messages with thread info:', allMessages.length);
        
        // Group messages by thread
        const threadGroups = {};
        
        // First, add all parent messages
        allMessages.forEach(msg => {
          if (!msg.isReply) {
            threadGroups[msg.timestamp] = {
              parent: msg,
              replies: []
            };
          }
        });
        
        // Then add replies to their threads
        allMessages.forEach(msg => {
          if (msg.isReply && threadGroups[msg.threadTs]) {
            threadGroups[msg.threadTs].replies.push(msg);
            console.log(`Adding reply from ${msg.sender} to thread ${msg.threadTs}`);
          }
        });
        
        // Format grouped data
        const formattedData = Object.values(threadGroups).map((thread, index) => {
          const parent = thread.parent;
          const messageText = parent.mainMessage || '';
          const detailedText = parent.detailedNotes || '';
          
          // Skip if parent message is too short (but keep all replies)
          if (isTooShortToShow(messageText, detailedText) && thread.replies.length === 0) {
            console.log(`Skipping short message: "${String(messageText).slice(0, 80)}"`);
            return null;
          }
          
          // Build combined detailed notes with replies
          let combinedDetailedNotes = cleanSlackText(detailedText) || '';
          
          if (thread.replies.length > 0) {
            // Add a separator before replies
            if (combinedDetailedNotes) {
              combinedDetailedNotes += '\n\n---\n\n<b>Thread Replies:</b>';
            } else {
              combinedDetailedNotes = '<b>Thread Replies:</b>';
            }
            
            // Add each reply
            thread.replies.forEach(reply => {
              const replySender = reply.sender;
              const replyMessage = cleanSlackText(reply.mainMessage);
              const replyDetails = cleanSlackText(reply.detailedNotes);
              
              combinedDetailedNotes += `\n\n<b>${replySender}:</b>\n${replyMessage}`;
              if (replyDetails) {
                combinedDetailedNotes += `\n${replyDetails}`;
              }
            });
          }

          return {
            id: index + 1,
            timestamp: parent.timestamp,
            sender: parent.sender,
            mainMessage: cleanSlackText(messageText) || '',
            detailedNotes: combinedDetailedNotes,
            screenshotLink: parent.screenshotLink,
            slackLink: parent.slackLink,
            extractedLinks: extractLinks((parent.mainMessage || '') + ' ' + (parent.detailedNotes || '')),
            replyCount: thread.replies.length,
            replies: thread.replies.map(r => ({
              sender: r.sender,
              message: cleanSlackText(r.mainMessage)
            }))
          };
        }).filter(item => item !== null);

        const sortedData = formattedData.sort((a, b) => {
          const aNum = parseInt(a.timestamp, 10);
          const bNum = parseInt(b.timestamp, 10);
          if (!isNaN(aNum) && !isNaN(bNum)) return bNum - aNum;
          return new Date(b.timestamp) - new Date(a.timestamp);
        });

        console.log('Formatted data with thread grouping:', sortedData);
        console.log(`Total threads: ${sortedData.length}, with ${sortedData.filter(d => d.replyCount > 0).length} having replies`);
        setReleases(sortedData);
        setFilteredReleases(sortedData);
      } else {
        console.log('No data found or empty response');
        setReleases([]);
        setFilteredReleases([]);
      }
    } catch (error) {
      console.error('Error fetching Google Sheets data:', error);
    }

    setLoading(false);
  };

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
                            {release.replyCount > 0 && (
                              <span className="ml-1 text-xs text-purple-600">+{release.replyCount}</span>
                            )}
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3
                        className="text-lg font-normal text-gray-900 whitespace-pre-line"
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
