import React, { useState, useEffect } from 'react';
import { Search, MessageSquare, Calendar, User, Link, Image, Sparkles, RefreshCw, ChevronDown, MessageCircle, ExternalLink, Info } from 'lucide-react';

function App() {
  const [releases, setReleases] = useState([]);
  const [filteredReleases, setFilteredReleases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [openReplies, setOpenReplies] = useState({});
  const [draggedStage, setDraggedStage] = useState(null);
  const [stageAssignments, setStageAssignments] = useState({});
  const [selectedDateFilter, setSelectedDateFilter] = useState('all');
  const [showTooltip, setShowTooltip] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

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
    
    // Update persistent stage assignments
    setStageAssignments(prev => ({
      ...prev,
      [releaseTimestamp]: stageName
    }));
    
    setReleases(prevReleases => 
      prevReleases.map(release => 
        release.timestamp === releaseTimestamp 
          ? { ...release, stage: stageName } 
          : release
      )
    );
    setDraggedStage(null);
  };

  // Remove stage assignment
  const removeStageAssignment = (releaseTimestamp) => {
    setStageAssignments(prev => {
      const newAssignments = { ...prev };
      delete newAssignments[releaseTimestamp];
      return newAssignments;
    });
    
    setReleases(prevReleases => 
      prevReleases.map(release => 
        release.timestamp === releaseTimestamp 
          ? { ...release, stage: null } 
          : release
      )
    );
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
    const boldRegex = /(Internal release note|What(?:'|')s new|What's new|Why It Matters\?|What(?:'|')s next|Solution|Problem)/gi;
    cleaned = cleaned.replace(boldRegex, '<b>$1</b>');
    return cleaned.split('\n').map(line => line.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    // Timestamps from Slack are in seconds with microseconds, so we split at the '.'
    const date = new Date(parseInt(timestamp.split('.')[0], 10) * 1000);
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

  const filterByDate = (releases, filterType) => {
    if (filterType === 'all') return releases;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return releases.filter(release => {
      const releaseDate = new Date(parseInt(release.timestamp.split('.')[0], 10) * 1000);
      
      switch (filterType) {
        case 'today':
          const releaseDateOnly = new Date(releaseDate.getFullYear(), releaseDate.getMonth(), releaseDate.getDate());
          return releaseDateOnly.getTime() === today.getTime();
        case 'week':
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          return releaseDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          return releaseDate >= monthAgo;
        default:
          return true;
      }
    });
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
          // REMOVE: Niall Cochrane release (timestamp 1758810522) entirely
          if (item.timestamp === '1758810522') {
            return; // Skip this item completely
          }

          // Manual fix: Force row 17 (timestamp 1758713492) to be a reply to row 19 (timestamp 1758713371)
          if (item.timestamp === '1758713492') {
            item.threadParentId = '1758713371';
          }
          
          // Manual fix: Add missing API link to Ben Allen's release (row 18, timestamp 1758630185)
          if (item.timestamp === '1758630185') {
            item.apiLink = 'https://developer.productboard.com/v2.0.0/reference/introduction';
          }

          // FIXED: Only treat as reply if threadParentId is a timestamp (not a user ID)
          // Check if threadParentId looks like a timestamp (numeric) and differs from the message timestamp
          const isReply = item.threadParentId && 
                         item.threadParentId !== item.timestamp && 
                         /^\d+/.test(item.threadParentId); // Check if it starts with digits (timestamp format)
          
          if (isReply) {
            replies.push(item);
          } else {
            parentReleasesMap.set(item.timestamp, { ...item, replies: [] });
          }
        });

        replies.forEach(reply => {
          const parent = parentReleasesMap.get(reply.threadParentId);
          if (parent) {
            parent.replies.push(reply);
          } else {
            // If a reply's parent isn't found, treat the reply as its own parent message.
            parentReleasesMap.set(reply.timestamp, { ...reply, replies: [] });
          }
        });
        
        const processedParentReleases = Array.from(parentReleasesMap.values())
          .map(parent => {
            // Apply persistent stage assignments
            const persistentStage = stageAssignments[parent.timestamp];
            return {
              ...parent,
              stage: persistentStage || parent.stage,
              mainMessage: cleanSlackText(parent.mainMessage),
              detailedNotes: cleanSlackText(parent.detailedNotes),
              replies: parent.replies.map(r => ({...r, mainMessage: cleanSlackText(r.mainMessage)})).sort((a, b) => parseFloat(a.timestamp) - parseFloat(b.timestamp))
            };
          })
          // Manual fix: Don't filter out row 18 (timestamp 1758630185)
          .filter(parent => {
            if (parent.timestamp === '1758630185') {
              return true; // Force include this release
            }
            return !isTooShortToShow(parent.mainMessage);
          });

        const sortedData = processedParentReleases.sort((a, b) => parseFloat(b.timestamp) - parseFloat(a.timestamp));
        
        console.log(`Loaded ${sortedData.length} releases (filtered from ${allItems.length} total items)`);
        setReleases(sortedData);
      } else {
        setReleases([]);
      }
    } catch (error) {
      console.error('Error fetching Google Sheets data:', error);
    }
    setLoading(false);
  };

  const handleAskGemini = async () => {
    // Placeholder for Gemini integration
    alert('Gemini integration would be implemented here. This would analyze your releases and provide insights.');
  };

  useEffect(() => {
    fetchGoogleSheetsData();
  }, []);

  useEffect(() => {
    const dateFiltered = filterByDate(releases, selectedDateFilter);
    const searchFiltered = dateFiltered.filter(release => {
        const searchTermLower = searchTerm.toLowerCase();
        const inMainMessage = (release.mainMessage || '').toLowerCase().includes(searchTermLower);
        const inSender = (release.sender || '').toLowerCase().includes(searchTermLower);
        const inReplies = release.replies && release.replies.some(reply => (reply.mainMessage || '').toLowerCase().includes(searchTermLower));
        return inMainMessage || inSender || inReplies;
    });
    setFilteredReleases(searchFiltered);
  }, [searchTerm, releases, selectedDateFilter]);

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
              <button onClick={handleAskGemini} className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                <Sparkles className="w-4 h-4 mr-2" /> Ask Gemini
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          
          <div className="flex-1">
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input type="text" placeholder="Search releases, messages, or team members..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center">
                  <MessageSquare className="w-8 h-8 text-blue-600" />
                  <div className="ml-4">
                    <div className="flex items-center">
                      <p className="text-sm font-medium text-gray-600">Total Releases</p>
                      <div className="relative ml-2">
                        <Info 
                          className="w-4 h-4 text-gray-400 cursor-help" 
                          onMouseEnter={() => setShowTooltip(true)}
                          onMouseLeave={() => setShowTooltip(false)}
                        />
                        {showTooltip && (
                          <div className="absolute bottom-6 left-0 bg-black text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                            Since September 17, 2025
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{filteredReleases.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center">
                  <User className="w-8 h-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Contributors</p>
                    <p className="text-2xl font-bold text-gray-900">{new Set(filteredReleases.map(r => r.sender)).size}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center">
                  <Calendar className="w-8 h-8 text-purple-600 cursor-pointer" onClick={() => setShowDatePicker(!showDatePicker)} />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Date Filter</p>
                    <p className="text-2xl font-bold text-gray-900">{filteredReleases.length}</p>
                    {showDatePicker && (
                      <div className="absolute mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-2 z-10">
                        <button 
                          onClick={() => {setSelectedDateFilter('all'); setShowDatePicker(false);}} 
                          className={`block w-full text-left px-3 py-2 rounded ${selectedDateFilter === 'all' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                        >
                          All Time
                        </button>
                        <button 
                          onClick={() => {setSelectedDateFilter('today'); setShowDatePicker(false);}} 
                          className={`block w-full text-left px-3 py-2 rounded ${selectedDateFilter === 'today' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                        >
                          Today
                        </button>
                        <button 
                          onClick={() => {setSelectedDateFilter('week'); setShowDatePicker(false);}} 
                          className={`block w-full text-left px-3 py-2 rounded ${selectedDateFilter === 'week' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                        >
                          Past Week
                        </button>
                        <button 
                          onClick={() => {setSelectedDateFilter('month'); setShowDatePicker(false);}} 
                          className={`block w-full text-left px-3 py-2 rounded ${selectedDateFilter === 'month' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                        >
                          Past Month
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {filteredReleases.map((release) => (
                <div 
                  key={release.timestamp} 
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, release.timestamp)}
                  className={`relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300 ${draggedStage ? 'border-dashed border-2 border-purple-400' : 'hover:shadow-md'}`}
                >
                   {release.stage && (
                    <div 
                      className={`absolute top-3 -right-2 px-3 py-1 text-xs font-bold rounded-sm shadow-lg transform rotate-3 border cursor-pointer ${stages.find(s => s.name === release.stage)?.color}`}
                      onClick={() => removeStageAssignment(release.timestamp)}
                      title="Click to remove stage"
                    >
                      {release.stage} ×
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
                        {release.apiLink && (<a href={release.apiLink} target="_blank" rel="noopener noreferrer" className="p-2 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors border border-gray-200" title="View API Documentation"><ExternalLink className="w-5 h-5" /></a>)}
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
