import React, { useState, useEffect } from 'react';
import { Search, MessageSquare, Calendar, User, Link, Image, Sparkles, RefreshCw, ChevronDown, MessageCircle } from 'lucide-react';

function App() {
  const [releases, setReleases] = useState([]);
  const [filteredReleases, setFilteredReleases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [openReplies, setOpenReplies] = useState({});
  const [draggedStage, setDraggedStage] = useState(null);

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e, stageName) => {
    e.dataTransfer.setData("stageName", stageName);
    setDraggedStage(stageName);
  };

  const handleDragEnd = () => {
    setDraggedStage(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, releaseTimestamp) => {
    e.preventDefault();
    const stageName = e.dataTransfer.getData("stageName");
    
    setReleases(prevReleases => 
      prevReleases.map(release => 
        release.timestamp === releaseTimestamp 
          ? { ...release, stage: stageName } 
          : release
      )
    );
    setDraggedStage(null);
  };

  const toggleReplies = (timestamp) => {
    setOpenReplies(prev => ({ ...prev, [timestamp]: !prev[timestamp] }));
  };

  const formatSenderName = (name) => {
    if (!name || typeof name !== 'string') return 'Unknown';
    if (name.includes('.')) {
      return name.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
    }
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const getValidUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    const trimmedUrl = url.trim();
    if (trimmedUrl === '' || trimmedUrl.toLowerCase() === 'null') return null;
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) return trimmedUrl;
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
    return cleaned.split('\n').map(line => line.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(parseInt(timestamp, 10) * 1000);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short'
    });
  };
  
  const isTooShortToShow = (messageText) => {
    const main = (messageText || '').trim();
    return main.length > 0 && main.length < 200;
  };
  
  const fetchGoogleSheetsData = async () => {
    setLoading(true);
    try {
      const API_KEY = process.env.REACT_APP_GOOGLE_SHEETS_API_KEY;
      const SHEET_ID = process.env.REACT_APP_GOOGLE_SHEET_ID;
      const WORKSHEET = process.env.REACT_APP_GOOGLE_SHEET_NAME || 'september';
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
            stage: row[7] || null,
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
            parent.replies.push(reply);
          }
        });
        
        const processedParentReleases = Array.from(parentReleasesMap.values())
          .map(parent => ({
            ...parent,
            mainMessage: cleanSlackText(parent.mainMessage),
            detailedNotes: cleanSlackText(parent.detailedNotes),
            replies: parent.replies.map(r => ({...r, mainMessage: cleanSlackText(r.mainMessage)})).sort((a, b) => parseFloat(a.timestamp) - parseFloat(b.timestamp))
          }))
          .filter(parent => !isTooShortToShow(parent.mainMessage));

        const sortedData = processedParentReleases.sort((a, b) => parseFloat(b.timestamp) - parseFloat(a.timestamp));
        setReleases(sortedData);
      } else {
        setReleases([]);
      }
    } catch (error) {
      console.error('Error fetching Google Sheets data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGoogleSheetsData();
  }, []);

  useEffect(() => {
    setFilteredReleases(releases);
  }, [releases]);

  useEffect(() => {
    const filtered = releases.filter(release => {
        const searchTermLower = searchTerm.toLowerCase();
        const inMainMessage = (release.mainMessage || '').toLowerCase().includes(searchTermLower);
        const inSender = (release.sender || '').toLowerCase().includes(searchTermLower);
        const inReplies = release.replies && release.replies.some(reply => (reply.mainMessage || '').toLowerCase().includes(searchTermLower));
        return inMainMessage || inSender || inReplies;
    });
    setFilteredReleases(filtered);
  }, [searchTerm, releases]);

  const stages = [
    { name: 'Internal', color: 'bg-blue-200 text-blue-800 border-blue-300' },
    { name: 'GA', color: 'bg-green-200 text-green-800 border-green-300' },
    { name: 'ENT Exclusion', color: 'bg-yellow-200 text-yellow-800 border-yellow-300' }
  ];

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
              <button className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                <Sparkles className="w-4 h-4 mr-2" /> Ask Gemini
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Main Content Area */}
          <div className="flex-1">
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input type="text" placeholder="Search releases, messages, or team members..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
              </div>
            </div>

            <div className="space-y-6">
              {filteredReleases.map((release) => (
                <div 
                  key={release.timestamp} 
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, release.timestamp)}
                  className={`relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300 ${draggedStage ? 'border-dashed border-2 border-purple-400 scale-105' : 'hover:shadow-md'}`}
                >
                   {/* STAGE TAG DISPLAY */}
                   {release.stage && (
                    <div 
                      className={`absolute top-3 -right-2 px-3 py-1 text-xs font-bold rounded-sm shadow-lg transform rotate-3 border ${stages.find(s => s.name === release.stage)?.color}`}
                    >
                      {release.stage}
                    </div>
                  )}

                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">{release.sender.charAt(0).toUpperCase()}</div>
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
                      <div className="text-lg font-normal text-gray-900 whitespace-pre-line" dangerouslySetInnerHTML={{ __html: release.mainMessage }} />
                      {release.detailedNotes && <div className="text-gray-700 leading-relaxed whitespace-pre-line break-words" dangerouslySetInnerHTML={{ __html: release.detailedNotes }} />}
                    </div>

                    {release.replies && release.replies.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <button onClick={() => toggleReplies(release.timestamp)} className="flex items-center justify-between w-full text-left text-sm font-medium text-purple-600 hover:text-purple-800">
                          <span className="flex items-center">
                            <MessageCircle className="w-4 h-4 mr-2" />
                            View {release.replies.length} {release.replies.length > 1 ? 'Updates' : 'Update'}
                          </span>
                          <ChevronDown className={`w-5 h-5 transition-transform ${openReplies[release.timestamp] ? 'rotate-180' : ''}`} />
                        </button>
                        {openReplies[release.timestamp] && (
                          <div className="mt-4 pl-6 border-l-2 border-slate-200 space-y-6">
                            {release.replies.map(reply => (
                              <div key={reply.timestamp}>
                                <div className="flex items-center space-x-3 mb-2">
                                  <div className="w-8 h-8 bg-gradient-to-r from-slate-400 to-slate-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">{reply.sender.charAt(0).toUpperCase()}</div>
                                  <div>
                                    <p className="font-semibold text-gray-800 text-sm">{reply.sender}</p>
                                    <p className="text-xs text-gray-500">{formatTimestamp(reply.timestamp)}</p>
                                  </div>
                                </div>
                                <div className="text-gray-700 leading-relaxed whitespace-pre-line break-words" dangerouslySetInnerHTML={{ __html: reply.mainMessage }} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* STAGES PANEL - MOVED TO THE RIGHT */}
          <div className="w-full md:w-64">
            <div className="sticky top-8 p-4 bg-white rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Stages</h3>
              <p className="text-sm text-gray-500 mb-4">Drag a stage onto a release card.</p>
              <div className="space-y-3">
                {stages.map(stage => (
                  <div 
                    key={stage.name}
                    draggable
                    onDragStart={(e) => handleDragStart(e, stage.name)}
                    onDragEnd={handleDragEnd}
                    className={`p-4 rounded-lg font-semibold cursor-grab transition-opacity shadow-md hover:shadow-lg transform hover:-translate-y-1 ${stage.color} ${draggedStage === stage.name ? 'opacity-50 scale-105' : 'opacity-100'}`}
                  >
                    {stage.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
