import React, { useState, useEffect } from 'react';
import { Search, MessageSquare, Calendar, User, Link, Image, Sparkles, Filter, RefreshCw } from 'lucide-react';

const SlackReleasesDashboard = () => {
  const [releases, setReleases] = useState([]);
  const [filteredReleases, setFilteredReleases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [geminiLoading, setGeminiLoading] = useState(false);

  // Mock data for demo - replace with Google Sheets API
  const mockData = [
    {
      id: 1,
      timestamp: '1726677661',
      sender: 'niall.cochrane',
      mainMessage: 'Released version 2.1.4 with critical bug fixes for authentication system',
      detailedNotes: 'This release addresses the login timeout issues reported by multiple users. Also includes performance improvements for the dashboard.',
      screenshotLink: 'https://example.com/screenshot1.png',
      slackLink: 'https://slack.com/archives/C123/p1726677661'
    },
    {
      id: 2,
      timestamp: '1726591261',
      sender: 'sarah.dev',
      mainMessage: 'Mobile app update v3.2.0 now available on app stores',
      detailedNotes: 'New features include dark mode, push notifications, and improved offline sync. iOS and Android versions are now live.',
      screenshotLink: 'https://example.com/screenshot2.png',
      slackLink: 'https://slack.com/archives/C123/p1726591261'
    },
    {
      id: 3,
      timestamp: '1726504861',
      sender: 'mike.qa',
      mainMessage: 'API v2 documentation updated with new endpoints',
      detailedNotes: 'Added comprehensive examples for the new user management and reporting endpoints. Breaking changes are clearly marked.',
      screenshotLink: null,
      slackLink: 'https://slack.com/archives/C123/p1726504861'
    }
  ];

  useEffect(() => {
    // Initialize with mock data - replace with actual Google Sheets fetch
    setReleases(mockData);
    setFilteredReleases(mockData);
  }, []);

  useEffect(() => {
  fetchGoogleSheetsData(); // Remove mock data, use real data
}, []);

  const formatTimestamp = (timestamp) => {
    const date = new Date(parseInt(timestamp) * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
      timeZone: 'UTC',
      timeZoneName: 'short'
    });
  };

  const handleGeminiQuery = async (message) => {
    setGeminiLoading(true);
    setChatMessages(prev => [...prev, { role: 'user', content: message }]);
    
    try {
      // Mock Gemini response - replace with actual Gemini API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      const mockResponse = `Based on your release data, I can see that you've had 3 recent releases. The most recent was version 2.1.4 by ${releases[0]?.sender} focusing on authentication fixes. Your team seems to be actively addressing user-reported issues and maintaining both web and mobile platforms. Is there something specific about these releases you'd like me to analyze?`;
      
      setChatMessages(prev => [...prev, { role: 'assistant', content: mockResponse }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    }
    
    setGeminiLoading(false);
    setCurrentMessage('');
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (currentMessage.trim()) {
      handleGeminiQuery(currentMessage.trim());
    }
  };

  const fetchGoogleSheetsData = async () => {
  setLoading(true);
  try {
    const API_KEY = process.env.REACT_APP_GOOGLE_SHEETS_API_KEY;
    const SHEET_ID = process.env.REACT_APP_GOOGLE_SHEET_ID;
    const WORKSHEET = process.env.REACT_APP_WORKSHEET_NAME || 'september';
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${WORKSHEET}?key=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.values) {
      const [headers, ...rows] = data.values;
      const formattedData = rows.map((row, index) => ({
        id: index + 1,
        timestamp: row[0] || '', // Assuming timestamp is column A
        sender: row[1] || 'Unknown', // Assuming sender is column B
        mainMessage: row[2] || '', // Assuming message is column C
        detailedNotes: row[3] || '',
        screenshotLink: row[4] || null,
        slackLink: row[5] || ''
      }));
      
      setReleases(formattedData);
      setFilteredReleases(formattedData);
    }
  } catch (error) {
    console.error('Error fetching Google Sheets data:', error);
  }
  setLoading(false);
};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
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
          {/* Main Content */}
          <div className={`flex-1 ${showChat ? 'mr-0' : ''}`}>
            {/* Search Bar */}
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

            {/* Stats Cards */}
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

            {/* Release Cards */}
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
  {release.screenshotLink && release.screenshotLink !== 'null' && !release.screenshotLink.includes('example.com') && (
    
      href={release.screenshotLink}
      target="_blank"
      rel="noopener noreferrer"
      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      title="View Screenshot"
    >
      <Image className="w-4 h-4" />
    </a>
  )}
  {release.slackLink && release.slackLink !== 'null' && !release.slackLink.includes('example.com') && (
    
      href={release.slackLink}
      target="_blank"
      rel="noopener noreferrer"
      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      title="View in Slack"
    >
      <Link className="w-4 h-4" />
    </a>
  )}
</div>                    
                   <div className="space-y-3">
  <h3 className="text-lg font-semibold text-gray-900">
    {release.mainMessage && release.mainMessage.length > 100 
      ? release.mainMessage.substring(0, 100) + '...' 
      : release.mainMessage}
  </h3>
  
  {release.detailedNotes && (
    <div className="text-gray-700 leading-relaxed">
      <div className="whitespace-pre-wrap break-words">
        {release.detailedNotes}
      </div>
    </div>
  )}
</div>
              
              {filteredReleases.length === 0 && (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No releases found matching your search.</p>
                </div>
              )}
            </div>
          </div>

          {/* Gemini Chat Sidebar */}
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
                      <div key={idx} className={`${msg.role === 'user' ? 'ml-4' : 'mr-4'}`}>
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
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(e)}
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
