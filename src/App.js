import React, { useState, useEffect } from 'react';
import { Search, MessageSquare, Calendar, User, Link, Image, Sparkles, RefreshCw, ChevronDown, MessageCircle } from 'lucide-react';

const SlackReleasesDashboard = () => {
  const [releases, setReleases] = useState([]);
  const [filteredReleases, setFilteredReleases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [openReplies, setOpenReplies] = useState({});

  const toggleReplies = (timestamp) => {
    setOpenReplies(prev => ({
      ...prev,
      [timestamp]: !prev[timestamp]
    }));
  };

  const formatSenderName = (name) => {
    if (!name || typeof name !== 'string') return 'Unknown';
    if (name.includes('.')) {
      return name
        .split('.')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const getValidUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    const trimmedUrl = url.trim();
    if (trimmedUrl === '' || trimmedUrl.toLowerCase() === 'null') {
      return null;
    }
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      return trimmedUrl;
    }
    return null;
  };

  const cleanSlackText = (text) => {
    if (!text) return '';
    let cleaned = text;
    cleaned = cleaned.replace(/<((?:https?:\/\/|ftp:\/\/)[^|>]+)\|([^>]+)>/g, '$2');
    cleaned = cleaned.replace(/<((?:https?:\/\/|ftp:\/\/)[^>]+)>/g, '$1');
    cleaned = cleaned.replace(/<#\w+\|?[^>]*>/g, '');
    cleaned = cleaned.replace(/<@[^>]+>/g, '@user');
    cleaned = cleaned.replace(/:[a-zA-Z0-9_+\-]+:/g, '');
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
    cleaned = cleaned.replace(/\*\*([\s\S]*?)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*([\s\S]*?)\*/g, '$1');
    cleaned = cleaned.replace(/_([^_]+)_/g, '$1');
    cleaned = cleaned.replace(/\?\s*/g, '?\n\n');
    cleaned = cleaned.replace(/[ \t]*[-\*•·▪▫◦‣⁃][ \t]*/g, '\n• ');
    const boldRegex = /(Internal release note|What(?:’|')s new|Why It Matters\?|What(?:’|')s next|Solution|Problem)/gi;
    cleaned = cleaned.replace(boldRegex, '<b>$1</b>');
    cleaned = cleaned
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return cleaned;
  };

  const isTooShortToShow = (messageText) => {
    const main = (messageText || '').trim();
    return main.length > 0 && main.length < 200;
  };

  useEffect(() => {
    fetchGoogleSheetsData();
  }, []);

  useEffect(() => {
    const filtered = releases.filter(release => {
        const searchTermLower = searchTerm.toLowerCase();
        const inMainMessage = (release.mainMessage || '').toLowerCase().includes(searchTermLower);
        const inSender = (release.sender || '').toLowerCase().includes(searchTermLower);
        const inDetailedNotes = (release.detailedNotes || '').toLowerCase().includes(searchTermLower);
        const inReplies = release.replies.some(reply => (reply.mainMessage || '').toLowerCase().includes(searchTermLower));
        return inMainMessage || inSender || inDetailedNotes || inReplies;
    });
    setFilteredReleases(filtered);
  }, [searchTerm, releases]);


  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    let date;
    if (/^\d+$/.test(String(timestamp))) {
      date = new Date(parseInt(timestamp, 10) * 1000);
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
    setLoading(true);
    try {
      const API_KEY = process.env.REACT_APP_GOOGLE_SHEETS_API_KEY;
      const SHEET_ID = process.env.REACT_APP_GOOGLE_SHEET_ID;
      const WORKSHEET = process.env.REACT_APP_GOOGLE_SHEET_NAME || process.env.REACT_APP_GOOGLE_SHEETS_WORKSHEET || 'september';
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${WORKSHEET}?key=${API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.values && data.values.length > 1) {
        const [headers, ...rows] = data.values;

        const allItems = rows.map(row => {
          if (!row[0]) return null;
          return {
            timestamp: row[0],
            sender: formatSenderName(row[1] || 'Unknown'),
            mainMessage: row[2] || '',
            detailedNotes: row[3] || '',
            screenshotLink: getValidUrl(row[4]),
            slackLink: getValidUrl(row[5]),
            threadParentId: row[6] || null,
          };
        }).filter(item => item !== null);

        const parentReleasesMap = new Map();
        const replies = [];

        allItems.forEach(item => {
          if (item.threadParentId && item.threadParentId !== item.timestamp) {
            replies.push(item);
          } else {
            parentReleasesMap.set(item.timestamp, { ...item, replies: [] });
          }
        });

        replies.forEach(reply => {
          const parent = parentReleasesMap.get(reply.threadParentId);
          if (parent) {
            const cleanedReply = {
              ...reply,
              mainMessage: cleanSlackText(reply.mainMessage)
            };
            parent.replies.push(cleanedReply);
          }
        });
        
        const processedParentReleases = Array.from(parentReleasesMap.values())
          .map(parent => ({
            ...parent,
            mainMessage: cleanSlackText(parent.mainMessage),
            detailedNotes: cleanSlackText(parent.detailedNotes),
            replies: parent.replies.sort((a, b) => parseFloat(a.timestamp) - parseFloat(b.timestamp))
          }))
          .filter(parent => !isTooShortToShow(parent.mainMessage));

        const sortedData = processedParentReleases.sort((a, b) => parseFloat(b.timestamp) - parseFloat(a.timestamp));
        
        setReleases(sortedData);
        setFilteredReleases(sortedData);
      } else {
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
              <button onClick={fetchGoogleSheetsData} disabled={loading} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh Data
              </button>
              <button onClick={() => setShowChat(!showChat)} className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                <Sparkles className="w-4 h-4 mr-2" /> Ask Gemini
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
                <input type="text" placeholder="Search releases, messages, or team members..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
               <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"><div className="flex items-center"><MessageSquare className="w-8 h-8 text-blue-600" /><div className="ml-4"><p className="text-sm font-medium text-gray-600">Total Releases</p><p className="text-2xl font-bold text-gray-900">{releases.length}</p></div></div></div>
               <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"><div className="flex items-center"><User className="w-8 h-8 text-green-600" /><div className="ml-4"><p className="text-sm font-medium text-gray-600">Active Contributors</p><p className="text-2xl font-bold text-gray-900">{new Set(releases.map(r => r.sender)).size}</p></div></div></div>
               <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"><div className="flex items-center"><Calendar className="w-8 h-8 text-purple-600" /><div className="ml-4"><p className="text-sm font-medium text-gray-600">This Month</p><p className="text-2xl font-bold text-gray-900">{releases.length}</p></div></div></div>
            </div>

            <div className="space-y-6">
              {filteredReleases.map((release) => (
                <div key={release.timestamp} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
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
                        {release.screenshotLink && (<a href={release.screenshotLink} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200" title="View Screenshot"><Image className="w-5 h-5" /></a>)}
                        {release.slackLink && (<a href={release.slackLink} target="_blank" rel="noopener noreferrer" className="p-2 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors border border-gray-200" title="View in Slack"><Link className="w-5 h-5" /></a>)}
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
                    </div>

                    {release.replies && release.replies.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <button
                          onClick={() => toggleReplies(release.timestamp)}
                          className="flex items-center justify-between w-full text-left text-sm font-medium text-purple-600 hover:text-purple-800"
                        >
                          <span className="flex items-center">
                            <MessageCircle className="w-4 h-4 mr-2" />
                            View {release.replies.length} {release.replies.length > 1 ? 'Updates/Feedback' : 'Update/Feedback'}
                          </span>
                          <ChevronDown className={`w-5 h-5 transition-transform ${openReplies[release.timestamp] ? 'rotate-180' : ''}`} />
                        </button>
                        {openReplies[release.timestamp] && (
                          <div className="mt-4 pl-6 border-l-2 border-slate-200 space-y-6">
                            {release.replies.map(reply => (
                              <div key={reply.timestamp}>
                                <div className="flex items-center space-x-3 mb-2">
                                  <div className="w-8 h-8 bg-gradient-to-r from-slate-400 to-slate-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                    {reply.sender.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-gray-800 text-sm">{reply.sender}</p>
                                    <p className="text-xs text-gray-500">{formatTimestamp(reply.timestamp)}</p>
                                  </div>
                                </div>
                                <div
                                  className="text-gray-700 leading-relaxed whitespace-pre-line break-words"
                                  dangerouslySetInnerHTML={{ __html: reply.mainMessage }}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {filteredReleases.length === 0 && !loading && (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No releases found.</p>
                </div>
              )}
            </div>
          </div>
          
          {showChat && (
             <div className="w-96 bg-white rounded-xl shadow-sm border border-slate-200 h-fit">
              <div className="p-4 border-b border-slate-200"><div className="flex items-center space-x-2"><Sparkles className="w-5 h-5 text-purple-600" /><h3 className="font-semibold text-gray-900">Ask Gemini</h3></div><p className="text-sm text-gray-600 mt-1">Ask questions about your releases</p></div>
              <div className="h-96 overflow-y-auto p-4">
                {chatMessages.length === 0 ? (<div className="text-center text-gray-500 mt-8"><Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>Start a conversation with Gemini about your release data!</p></div>) : (<div className="space-y-4">{chatMessages.map((msg, idx) => (<div key={idx} className={msg.role === 'user' ? 'ml-4' : 'mr-4'}><div className={`p-3 rounded-lg ${ msg.role === 'user' ? 'bg-blue-600 text-white ml-auto' : 'bg-gray-100 text-gray-900'}`}><p className="text-sm">{msg.content}</p></div></div>))}
                {geminiLoading && (<div className="mr-4"><div className="bg-gray-100 text-gray-900 p-3 rounded-lg"><div className="flex items-center space-x-2"><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div></div></div></div>)}</div>)}
              </div>
              <div className="p-4 border-t border-slate-200"><div className="flex space-x-2"><input type="text" value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} placeholder="Ask about your releases..." disabled={geminiLoading} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm" /><button onClick={handleSendMessage} disabled={geminiLoading || !currentMessage.trim()} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50">Send</button></div></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SlackReleasesDashboard;
