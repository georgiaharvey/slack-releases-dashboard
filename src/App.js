import React, { useState, useEffect } from 'react';
import { Search, MessageSquare, Calendar, User, Link, Image, Sparkles, RefreshCw, ExternalLink, Paperclip } from 'lucide-react';

const SlackReleasesDashboard = () => {
  console.log('=== ENVIRONMENT CHECK ===');
  console.log('API Key:', process.env.REACT_APP_GOOGLE_SHEETS_API_KEY ? 'EXISTS' : 'MISSING');
  console.log('Sheet ID:', process.env.REACT_APP_GOOGLE_SHEET_ID ? 'EXISTS' : 'MISSING');
  console.log('Worksheet:', process.env.REACT_APP_WORKSHEET_NAME ? 'EXISTS' : 'MISSING');
  
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
    
    // AGGRESSIVE asterisk removal - multiple passes to catch all cases
    // Remove **text**
    cleaned = cleaned.replace(/\*\*([^*]+?)\*\*/g, '$1');
    // Remove *text*
    cleaned = cleaned.replace(/\*([^*]+?)\*/g, '$1');
    // Remove _text_ (italic markdown)
    cleaned = cleaned.replace(/_([^_]+?)_/g, '$1');
    // Remove any leftover asterisks
    cleaned = cleaned.replace(/\*/g, '');
    
    // Process lines for better formatting
    let lines = cleaned.split('\n');
    let processedLines = [];
    
    for (let line of lines) {
      line = line.trim();
      
      // Skip empty lines
      if (!line) {
        processedLines.push('');
        continue;
      }
      
      // Convert various bullet formats to consistent format
      if (line.match(/^[•·▪▫◦‣⁃\-\*]/)) {
        line = '• ' + line.replace(/^[•·▪▫◦‣⁃\-\*]\s*/, '');
      }
      
      // Collapse multiple spaces
      line = line.replace(/\s+/g, ' ');
      
      processedLines.push(line);
    }
    
    // Join lines back together, preserving intentional line breaks
    cleaned = processedLines.join('\n');
    
    // Clean up multiple consecutive newlines (keep max 2)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    return cleaned.trim();
  };

  const extractLinks = (text) => {
    if (!text) return [];
    
    const urlMatches = text.match(/<?(https?:\/\/[^\s>]+)>?/g);
    if (!urlMatches) return [];
    
    return urlMatches.map(match => match.replace(/[<>]/g, ''));
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
    
    // Check if timestamp is Unix timestamp (number) or date string
    let date;
    if (!isNaN(timestamp)) {
      // Unix timestamp
      let ts = parseInt(timestamp);
      date = new Date(ts * 1000);
    } else {
      // Try parsing as date string
      date = new Date(timestamp);
    }
    
    if (isNaN(date.getTime())) {
      return timestamp; // Return original if can't parse
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
      const API_KEY = process.env.REACT_APP_GOOGLE_SHEETS_API_KEY;
      const SHEET_ID = process.env.REACT_APP_GOOGLE_SHEET_ID;
      const WORKSHEET = process.env.REACT_APP_WORKSHEET_NAME || 'september';
      const SLACK_WORKSPACE = process.env.REACT_APP_SLACK_WORKSPACE || 'your-workspace';
      const SLACK_CHANNEL = process.env.REACT_APP_SLACK_CHANNEL || 'C1234567890';
      
      console.log('Using values:', { API_KEY: API_KEY ? 'SET' : 'MISSING', SHEET_ID, WORKSHEET });
      
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${WORKSHEET}?key=${API_KEY}`;
      console.log('Fetching URL:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('Google Sheets Response:', data);
      
      if (data.values && data.values.length > 1) {
        const [headers, ...rows] = data.values;
        console.log('Headers:', headers);
        console.log('Total rows:', rows.length);
        
        // First pass: identify all messages and thread relationships
        const allMessages = rows.map((row, index) => {
          const timestamp = row[0] || '';
          const threadTs = row[6]; // Assuming column 7 has thread_ts
          
          return {
            rowIndex: index,
            timestamp: timestamp,
            threadTs: threadTs || timestamp, // If no thread_ts, it's a parent message
            sender: row[1] || 'Unknown',
            mainMessage: row[2] || '',
            detailedNotes: row[3] || '',
            screenshotLink: row[4] && row[4].trim() && row[4].trim() !== 'null' && row[4].trim() !== '' ? row[4].trim() : null,
            providedSlackLink: row[5] && row[5].trim() && row[5].trim() !== 'null' && row[5].trim() !== '' ? row[5].trim() : null,
            isReply: threadTs && threadTs !== timestamp
          };
        });
        
        // Group messages by thread
        const threadGroups = {};
        const standaloneMessages = [];
        
        allMessages.forEach(msg => {
          if (!msg.isReply) {
            // This is a parent message
            threadGroups[msg.timestamp] = {
              parent: msg,
              replies: []
            };
          }
        });
        
        // Add replies to their parent threads
        allMessages.forEach(msg => {
          if (msg.isReply && threadGroups[msg.threadTs]) {
            threadGroups[msg.threadTs].replies.push(msg);
          } else if (!msg.isReply) {
            // Already handled as parent
          } else {
            // Orphaned reply or standalone message
            standaloneMessages.push(msg);
          }
        });
        
        // Format the grouped data
        const formattedData = [];
        
        Object.values(threadGroups).forEach((thread, index) => {
          const parent = thread.parent;
          const messageText = parent.mainMessage || '';
          const detailedText = parent.detailedNotes || '';
          
          // Skip if it's just a reply or too short
          if (messageText.trim().startsWith('<@') || messageText.trim().startsWith('@')) {
            console.log(`Skipping reply at row ${parent.rowIndex + 1}: ${messageText.substring(0, 50)}...`);
            return;
          }
          
          if (messageText.length < 50 && !detailedText) {
            console.log(`Skipping short message at row ${parent.rowIndex + 1}: "${messageText}"`);
            return;
          }
          
          const lowerMessage = messageText.toLowerCase();
          const skipPhrases = ['thanks', 'got it', 'looks good', 'awesome', 'great', '+1', 'nice', 'cool'];
          if (skipPhrases.some(phrase => lowerMessage === phrase || (lowerMessage.length < 100 && lowerMessage.includes(phrase)))) {
            console.log(`Skipping likely reply at row ${parent.rowIndex + 1}: "${messageText}"`);
            return;
          }
          
          // Combine replies into the detailed notes
          let combinedDetailedNotes = cleanSlackText(detailedText) || '';
          
          if (thread.replies.length > 0) {
            const replyTexts = thread.replies.map(reply => {
              const replySender = formatSenderName(reply.sender);
              const replyMessage = cleanSlackText(reply.mainMessage);
              const replyDetails = cleanSlackText(reply.detailedNotes);
              
              let replyText = `\n\n**Reply from ${replySender}:**\n${replyMessage}`;
              if (replyDetails) {
                replyText += `\n${replyDetails}`;
              }
              return replyText;
            }).join('');
            
            combinedDetailedNotes = combinedDetailedNotes + replyTexts;
          }
          
          // Generate Slack link from timestamp if not provided
          let slackLink = parent.providedSlackLink;
          if (!slackLink && parent.timestamp) {
            // Convert timestamp to Slack message link format
            // Format: https://workspace.slack.com/archives/CHANNEL/pTIMESTAMP
            const ts = parent.timestamp.replace('.', '');
            slackLink = `https://${SLACK_WORKSPACE}.slack.com/archives/${SLACK_CHANNEL}/p${ts}`;
          }
          
          const item = {
            id: index + 1,
            timestamp: parent.timestamp,
            sender: formatSenderName(parent.sender),
            mainMessage: cleanSlackText(messageText) || '',
            detailedNotes: combinedDetailedNotes,
            screenshotLink: parent.screenshotLink,
            slackLink: slackLink,
            extractedLinks: extractLinks((messageText || '') + ' ' + (detailedText || '')),
            replyCount: thread.replies.length
          };
          
          console.log(`Keeping message ${index + 1} by ${item.sender} with ${item.replyCount} replies`);
          
          formattedData.push(item);
        });
        
        const sortedData = formattedData.sort((a, b) => {
          if (!isNaN(a.timestamp) && !isNaN(b.timestamp)) {
            return parseInt(b.timestamp) - parseInt(a.timestamp);
          }
          return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        console.log('Formatted data (after filtering and grouping):', sortedData);
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
                            className="flex items-center gap-1 px-3 py-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
                            title="View Screenshot"
                          >
                            <Paperclip className="w-4 h-4" />
                            <span className="text-xs font-medium">Screenshot</span>
                          </a>
                        )}
                        <a
                          href={release.slackLink || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors border border-purple-200"
                          title="View in Slack"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span className="text-xs font-medium">Slack</span>
                          {release.replyCount > 0 && (
                            <span className="ml-1 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                              {release.replyCount} {release.replyCount === 1 ? 'reply' : 'replies'}
                            </span>
                          )}
                        </a>
                      </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {release.mainMessage}
                      </h3>
                      
                      {release.detailedNotes && (
                        <div className="text-gray-700 leading-relaxed space-y-2">
                          {release.detailedNotes.split('\n\n').map((paragraph, pIdx) => {
                            // Check if this is a reply section
                            if (paragraph.startsWith('**Reply from')) {
                              const lines = paragraph.split('\n');
                              const replyHeader = lines[0];
                              const replyContent = lines.slice(1).join('\n');
                              
                              return (
                                <div key={pIdx} className="mt-4 p-3 bg-gray-50 rounded-lg border-l-4 border-purple-300">
                                  <p className="text-sm font-semibold text-purple-700 mb-1">
                                    {replyHeader.replace(/\*\*/g, '')}
                                  </p>
                                  <div className="text-gray-700">
                                    {replyContent.split('\n').map((line, lIdx) => {
                                      if (line.startsWith('• ')) {
                                        return (
                                          <div key={lIdx} className="flex items-start ml-2">
                                            <span className="mr-2">•</span>
                                            <span>{line.substring(2)}</span>
                                          </div>
                                        );
                                      } else if (line.trim()) {
                                        return <p key={lIdx}>{line}</p>;
                                      }
                                      return null;
                                    })}
                                  </div>
                                </div>
                              );
                            }
                            
                            // Check if this paragraph contains bullet points
                            const lines = paragraph.split('\n');
                            const hasBullets = lines.some(line => line.startsWith('• '));
                            
                            if (hasBullets) {
                              // Render as a bullet list
                              return (
                                <ul key={pIdx} className="space-y-1 ml-4">
                                  {lines.map((line, lIdx) => {
                                    if (line.startsWith('• ')) {
                                      return (
                                        <li key={lIdx} className="flex items-start">
                                          <span className="mr-2">•</span>
                                          <span>{line.substring(2)}</span>
                                        </li>
                                      );
                                    } else if (line.trim()) {
                                      // Non-bullet line in a bullet section
                                      return <div key={lIdx} className="ml-6">{line}</div>;
                                    }
                                    return null;
                                  })}
                                </ul>
                              );
                            } else if (paragraph.trim()) {
                              // Regular paragraph
                              return <p key={pIdx}>{paragraph}</p>;
                            }
                            return null;
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
