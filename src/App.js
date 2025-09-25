import React, { useState, useEffect } from 'react';
import { Search, MessageSquare, Calendar, User, Link, Image, Sparkles, RefreshCw, ChevronDown, MessageCircle } from 'lucide-react';

const SlackReleasesDashboard = () => {
  const [releases, setReleases] = useState([]);
  const [filteredReleases, setFilteredReleases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [openReplies, setOpenReplies] = useState({});

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
    const date = new Date(parseInt(timestamp, 10)); // Use milliseconds for JS Date
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short'
    });
  };
  
  // This function is kept for the "Refresh Data" button but is not called on initial load.
  const fetchGoogleSheetsData = async () => {
    setLoading(true);
    alert("Fetching live data from Google Sheets. This will replace the demo data.");
    // The live data fetching logic would go here. For now, it does nothing.
    setLoading(false);
  };

  useEffect(() => {
    // ========================================================================
    // FORCED DEMO DATA STARTS HERE
    // This section creates the exact releases you requested.
    // ========================================================================

    const demoRelease1 = {
      timestamp: "1727177340000", // September 24, 2025 at 11:29 AM UTC
      sender: 'Kami Fournier',
      mainMessage: cleanSlackText(`Timeframe visualization Grid column is now available internally\n\nWhat's New?\n\nGrid boards now support timeframe visualization column. It turns grid boards into powerful Gantt\n• like visualizations, enabling product teams to visualize deep hierarchies in time.\n\n• Enable/disable Timeframe visualization column from Default fields in the Grid column management\n\n• Configure Timeframe visualization granularity and timeline range from the column context menu\n\n• Resize column width as usual to suit your needs\n\n• ✚ Assign and update the timeframe of your items by clicking in the timeframe cells\n\n• Fiscal calendar settings are respected\nCheck out the for more details!`),
      detailedNotes: '',
      screenshotLink: null,
      slackLink: "#",
      replies: [
        {
          timestamp: "1727177460000", // September 24, 2025 at 11:31 AM UTC
          sender: 'Kamila',
          mainMessage: cleanSlackText(`Why It Matters?\n\nTimeframe visualization column allows teams to show what their work contributes to, whether it's their company's objectives hierarchy or broader domains represented by components in the product hierarchy.\n\nWhat's next\nAssuming all goes well, we'll release to GA in a week and to the exclusion list the week after that.\n\nKudos Big thanks to the team and especially @user and @user\n\nQuestions. If you have questions or feedback, please reach out in`),
        }
      ]
    };

    const demoRelease2 = {
        timestamp: "1727153580000", // Made up timestamp
        sender: 'Product Team', // Placeholder sender
        mainMessage: cleanSlackText('Internal release note: APIv2 public beta…'),
        detailedNotes: '',
        screenshotLink: null,
        slackLink: "#",
        replies: [
          {
            timestamp: "1727153640000", // Made up timestamp
            sender: 'Petr Kom',
            mainMessage: cleanSlackText(`Just adding on here –This is a big milestone for Productboard. After several years, we finally have a new generation of our API – easier to use, faster, and designed to grow with our product. From early feedback – like from Kroger or Salesforce – we know this will be a huge improvement. The new API also opens up new possibilities for Enterprise use cases and AI agents. The Launchpad team is already using API v2 in some of their new flows.\n\nWe’re currently in Public Beta, supporting Product entities and Notes. And alongside it, the Data team just released the first endpoint of the Analytics API – for retrieving member activity data.\n\nBig shoutout to the Ecosystem team for delivering this initiative – especially @MicTech for shaping the vision, @Schovi for driving the delivery, and @Martini, @kristina, @Cihla, @Martin Kvapil and @vita for pushing it over the finish line. And @Jany, @Niall Cochrane for drafting the vision in the early days and continuing supporting us along the way.\n\nThis was a cross-team effort – thanks to @jan, @Balázs, @Michal Turek, and @Klaudia for collaborating with us, and to @Klara, @Bara, and @vinay.ram for helping test and pressure-test the experience. (and probably more, sorry if I didn't mention you <3)\n\nAnd if you know a customer who could benefit from API v2, send them our way.`),
          }
        ]
      };

    const demoData = [demoRelease1, demoRelease2];
    setReleases(demoData);
    setFilteredReleases(demoData);
    
    // ========================================================================
    // FORCED DEMO DATA ENDS HERE
    // ========================================================================
  }, []);

  useEffect(() => {
    const filtered = releases.filter(release => {
        const searchTermLower = searchTerm.toLowerCase();
        const inMainMessage = (release.mainMessage || '').toLowerCase().includes(searchTermLower);
        const inSender = (release.sender || '').toLowerCase().includes(searchTermLower);
        const inReplies = release.replies.some(reply => (reply.mainMessage || '').toLowerCase().includes(searchTermLower));
        return inMainMessage || inSender || inReplies;
    });
    setFilteredReleases(filtered);
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
        <div className="flex-1">
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
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">{release.sender.charAt(0).toUpperCase()}</div>
                        <div>
                          <p className="font-semibold text-gray-900">{release.sender}</p>
                          <p className="text-sm text-gray-500">{formatTimestamp(Date.parse(release.timestamp))}</p>
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
                            View {release.replies.length} {release.replies.length > 1 ? 'Updates/Feedback' : 'Update/Feedback'}
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
                                    <p className="text-xs text-gray-500">{formatTimestamp(Date.parse(reply.timestamp))}</p>
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
      </div>
    </div>
  );
};

export default SlackReleasesDashboard;
