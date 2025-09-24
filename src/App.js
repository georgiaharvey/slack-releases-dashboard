import React, { useState, useEffect } from 'react';
import { Search, MessageSquare, Calendar, User, Link, Image, Sparkles, RefreshCw, ExternalLink, Paperclip } from 'lucide-react';

const SlackReleasesDashboard = () => {
  // Use window-based environment variables or defaults for browser compatibility
  const ENV = {
    API_KEY: window.REACT_APP_GOOGLE_SHEETS_API_KEY || '',
    SHEET_ID: window.REACT_APP_GOOGLE_SHEET_ID || '',
    WORKSHEET_NAME: window.REACT_APP_WORKSHEET_NAME || 'september'
  };
  
  console.log('=== ENVIRONMENT CHECK ===');
  console.log('API Key:', ENV.API_KEY ? 'EXISTS' : 'MISSING');
  console.log('Sheet ID:', ENV.SHEET_ID ? 'EXISTS' : 'MISSING');
  console.log('Worksheet:', ENV.WORKSHEET_NAME ? 'EXISTS' : 'MISSING');
  
  const [releases, setReleases] = useState([]);
  const [filteredReleases, setFilteredReleases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [geminiLoading, setGeminiLoading] = useState(false);

  const cleanSlackText = (text) => {
    if (!text) return text;
    
    let cleaned = text;
    
    // Replace Slack hyperlinks <https://url|label> → label
    cleaned = cleaned.replace(/<https?:\/\/[^|]+\|([^>]+)>/g, '$1');
    
    // Replace bare Slack links <https://url> → url
    cleaned = cleaned.replace(/<(https?:\/\/[^>]+)>/g, '$1');
    
    // Remove Slack emoji codes :wave:
    cleaned = cleaned.replace(/:[^:\s]*:/g, '');
    
    // Replace channel mentions <#C12345|channel> → #channel
    cleaned = cleaned.replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1');
    
    // Replace user mentions <@U12345> → @user
    cleaned = cleaned.replace(/<@([A-Z0-9]+)>/g, '@$1');
    
    // AGGRESSIVE asterisk and formatting removal - multiple passes
    // Remove bold text **text** or *text*
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
    // Remove any remaining single asterisks
    cleaned = cleaned.replace(/\*/g, '');
    // Remove underscores (italic markdown)
    cleaned = cleaned.replace(/_([^_]+)_/g, '$1');
    // Remove backticks (code formatting)
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
    // Remove triple backticks (code blocks)
    cleaned = cleaned.replace(/```[^`]*```/g, '');
    
    return cleaned.trim();
  };

  const formatReleaseText = (text) => {
    if (!text) return [];
    
    // Split by double newlines for main sections
    const sections = text.split(/\n\n+/);
    const formatted = [];
    
    sections.forEach((section, sIdx) => {
      const lines = section.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) return;
      
      // Check if this is a header/title line (usually the first non-bullet line)
      const firstLine = lines[0].trim();
      const isBulletSection = lines.some(line => 
        line.trim().match(/^[•·▪▫◦‣⁃\-\*]\s/) || 
        line.trim().match(/^\d+[\.\)]\s/)
      );
      
      if (!isBulletSection && lines.length === 1) {
        // Single line header or paragraph
        formatted.push({
          type: 'header',
          content: firstLine
        });
      } else if (isBulletSection) {
        // Process as a list
        const items = [];
        let currentHeader = null;
        
        lines.forEach(line => {
          const trimmed = line.trim();
          // Check if it's a bullet point
          if (trimmed.match(/^[•·▪▫◦‣⁃\-\*]\s/)) {
            items.push(trimmed.replace(/^[•·▪▫◦‣⁃\-\*]\s*/, ''));
          } else if (trimmed.match(/^\d+[\.\)]\s/)) {
            // Numbered list
            items.push(trimmed.replace(/^\d+[\.\)]\s*/, ''));
          } else if (trimmed && !currentHeader) {
            // This might be a header for the list
            currentHeader = trimmed;
          } else if (trimmed) {
            // Regular text within list section
            items.push(trimmed);
          }
        });
        
        if (currentHeader) {
          formatted.push({
            type: 'header',
            content: currentHeader
          });
        }
        
        if (items.length > 0) {
          formatted.push({
            type: 'list',
            items: items
          });
        }
      } else {
        // Multi-line paragraph
        formatted.push({
          type: 'paragraph',
          content: lines.join(' ')
        });
      }
    });
    
    return formatted;
  };

  const extractLinks = (text) => {
    if (!text) return [];
    
    const urlMatches = text.match(/<?(https?:\/\/[^\s>]+)>?/g);
    if (!urlMatches) return [];
    
    return urlMatches.map(match => match.replace(/[<>]/g, ''));
  };

  const isLikelyReply = (messageText, detailedText) => {
    if (!messageText) return true;
    
    const trimmed = messageText.trim();
    const lowerMessage = trimmed.toLowerCase();
    
    // Skip if starts with @mention
    if (trimmed.startsWith('<@') || trimmed.startsWith('@')) {
      return true;
    }
    
    // Skip very short messages without detailed notes
    if (trimmed.length < 30 && !detailedText) {
      return true;
    }
    
    // Skip common reply phrases (exact matches or very short messages containing these)
    const replyPhrases = [
      'thanks', 'thank you', 'got it', 'looks good', 'awesome', 
      'great', '+1', 'nice', 'cool', 'ok', 'okay', 'sure', 
      'sounds good', 'perfect', 'done', 'fixed', 'updated',
      'lgtm', 'approved', 'merged', 'shipped'
    ];
    
    // Check if the entire message is just a reply phrase
    if (replyPhrases.includes(lowerMessage)) {
      return true;
    }
    
    // Check if it's a very short message containing reply phrases
    if (trimmed.length < 50) {
      const isReplyPhrase = replyPhrases.some(phrase => 
        lowerMessage === phrase || 
        (lowerMessage.split(' ').length <= 5 && lowerMessage.includes(phrase))
      );
      if (isReplyPhrase) {
        return true;
      }
    }
    
    // Skip single word or very short responses
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount <= 3 && !detailedText) {
      return true;
    }
    
    return false;
  };

  useEffect(() => {
    console.log('Component mounted, fetching Google Sheets data...');
    fetchGoogleSheetsData();
  }, []);

  useEffect(() => {
    const filtered = releases.filter(release =>
      release.mainMessage.toLowerCase().includes(searchTerm.toLowerCase()) ||
      release.sender.toLowerCase().includes(searchTerm.toLowerCase()) ||
      release.detailedNotes.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredReleases(filtered);
  }, [searchTerm, releases]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    let date;
    if (!isNaN(timestamp)) {
      let ts = parseInt(timestamp);
      date = new Date(ts * 1000);
    } else {
      date = new Date(timestamp);
    }
    
    if (isNaN(date.getTime())) {
      return timestamp;
    }
    
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short'
    });
  };

  const formatSenderName = (name) => {
    if (!name) return 'Unknown';
    return name
      .toLowerCase()
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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
      const API_KEY = ENV.API_KEY;
      const SHEET_ID = ENV.SHEET_ID;
      const WORKSHEET = ENV.WORKSHEET_NAME;
      
      console.log('Using values:', { API_KEY: API_KEY ? 'SET' : 'MISSING', SHEET_ID, WORKSHEET });
      
      // If essential config is missing, use mock data for demonstration
      if (!API_KEY || !SHEET_ID) {
        console.log('Using mock data due to missing configuration');
        
        // Mock data that matches your screenshot example
        const mockData = [
          {
            id: 1,
            timestamp: '1726668320',
            sender: 'Niall Cochrane',
            mainMessage: 'Good afternoon folks We are now live to all customers, excluding those on the exclusion list Have a lovely Wednesday',
            detailedNotes: `Internal Release Note: Global Entity Creation

Problem
Working with core entities in Productboard is currently too complex and slow.
• Creating a new feature requires a 4–5 step flow: open/create a board → configure the board → click create → select hierarchy → name it → confirm.
• Flows like this force users to open or configure a board first, which is unnecessary friction and interrupts their workflow.

Solution Users can now create any supported entity in at most 2 steps, directly from the main navigation — no need to open or create a board first. This reduces cognitive load, saves time, and keeps product managers in flow.

What's New
• Global Search &amp; Create available in the main navigation.
• Supported entities at launch:
• Notes
• Features
• Initiatives
• Components
• Products
• Releases
• Objectives
• Key Results

Access &amp; Release
• This feature is now available to all internal spaces
• Customer spaces will be enabled in the middle of next week

Any questions, please let us know. Thanks to the <!subteam^S04NVSA5KD2> team, specifically @U02F7ERRMKQ for leading up this initiative.`,
            screenshotLink: null,
            slackLink: 'https://slack.com/archives/C123456',
            extractedLinks: []
          }
        ];
        
        setReleases(mockData);
        setFilteredReleases(mockData);
        setLoading(false);
        return;
      }
      
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${WORKSHEET}?key=${API_KEY}`;
      console.log('Fetching URL:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('Google Sheets Response:', data);
      
      if (data.values && data.values.length > 1) {
        const [headers, ...rows] = data.values;
        console.log('Headers:', headers);
        console.log('Total rows:', rows.length);
        
        const formattedData = rows.map((row, index) => {
          const messageText = row[2] || '';
          const detailedText = row[3] || '';
          
          // Filter out replies and short messages
          if (isLikelyReply(messageText, detailedText)) {
            console.log(`Skipping reply/short message at row ${index + 1}: "${messageText.substring(0, 50)}..."`);
            return null;
          }
          
          const item = {
            id: index + 1,
            timestamp: row[0] || '',
            sender: formatSenderName(row[1] || 'Unknown'),
            mainMessage: cleanSlackText(messageText) || '',
            detailedNotes: cleanSlackText(detailedText) || '',
            screenshotLink: row[4] && row[4].trim() && row[4].trim() !== 'null' && row[4].trim() !== '' ? row[4].trim() : null,
            slackLink: row[5] && row[5].trim() && row[5].trim() !== 'null' && row[5].trim() !== '' ? row[5].trim() : null,
            extractedLinks: extractLinks((messageText || '') + ' ' + (detailedText || ''))
          };
          
          console.log(`Keeping message ${index + 1} by ${item.sender}: ${item.mainMessage.substring(0, 50)}...`);
          
          return item;
        }).filter(item => item !== null);
        
        const sortedData = formattedData.sort((a, b) => {
          if (!isNaN(a.timestamp) && !isNaN(b.timestamp)) {
            return parseInt(b.timestamp) - parseInt(a.timestamp);
          }
          return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        console.log('Formatted data (after filtering):', sortedData);
        console.log('Total releases after filtering:', sortedData.length);
        setReleases(sortedData);
        setFilteredReleases(sortedData);
      } else {
        console.log('No data found or empty response');
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
              {filteredReleases.map((release) => {
                const formattedMain = formatReleaseText(release.mainMessage);
                const formattedDetails = formatReleaseText(release.detailedNotes);
                
                return (
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
                              className="flex items-center gap-1 px-3 py-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
                              title="View Screenshot"
                            >
                              <Paperclip className="w-4 h-4" />
                              <span className="text-xs font-medium">Screenshot</span>
                            </a>
                          )}
                          {release.slackLink && (
                            <a
                              href={release.slackLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-3 py-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors border border-purple-200"
                              title="View in Slack"
                            >
                              <ExternalLink className="w-4 h-4" />
                              <span className="text-xs font-medium">Slack</span>
                            </a>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {/* Main Message */}
                        <div className="text-gray-900">
                          {formattedMain.map((section, idx) => {
                            if (section.type === 'header') {
                              return (
                                <h3 key={idx} className="text-base font-normal mb-2">
                                  {section.content}
                                </h3>
                              );
                            } else if (section.type === 'list') {
                              return (
                                <ul key={idx} className="space-y-1 ml-4 mb-3">
                                  {section.items.map((item, iIdx) => (
                                    <li key={iIdx} className="flex items-start">
                                      <span className="mr-2 text-gray-600">•</span>
                                      <span className="text-gray-700">{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              );
                            } else {
                              return (
                                <p key={idx} className="text-gray-700 mb-2">
                                  {section.content}
                                </p>
                              );
                            }
                          })}
                        </div>
                        
                        {/* Detailed Notes */}
                        {release.detailedNotes && (
                          <div className="text-gray-700 pt-2">
                            {formattedDetails.map((section, idx) => {
                              if (section.type === 'header') {
                                return (
                                  <div key={idx} className="font-medium text-gray-800 mb-2 mt-3">
                                    {section.content}
                                  </div>
                                );
                              } else if (section.type === 'list') {
                                return (
                                  <ul key={idx} className="space-y-1.5 ml-6 mb-3">
                                    {section.items.map((item, iIdx) => (
                                      <li key={iIdx} className="flex items-start">
                                        <span className="mr-2 text-gray-500">•</span>
                                        <span className="text-gray-600 text-sm">{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                );
                              } else {
                                return (
                                  <p key={idx} className="text-gray-600 mb-2 text-sm">
                                    {section.content}
                                  </p>
                                );
                              }
                            })}
                          </div>
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
                );
              })}
              
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
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
