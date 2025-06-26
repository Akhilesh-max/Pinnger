'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePinngers } from '@/hooks/usePinngers';

export default function Dashboard() {
  const { pinngers, addPinnger, deletePinnger, togglePinngerStatus, testPing, isLoading } = usePinngers();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedPinnger, setSelectedPinnger] = useState<string | null>(null);
  const [newPinnger, setNewPinnger] = useState({
    websiteName: '',
    url: '',
    duration: '5'
  });
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const loggedIn = localStorage.getItem('isLoggedIn');
    const username = localStorage.getItem('username');
    
    if (!loggedIn || username !== 'Akhil') {
      router.push('/login');
      return;
    }
    
    setIsLoggedIn(true);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    router.push('/login');
  };

  const handleAddPinnger = (e: React.FormEvent) => {
    e.preventDefault();
    
    addPinnger({
      websiteName: newPinnger.websiteName,
      url: newPinnger.url,
      duration: newPinnger.duration,
      status: 'active'
    });
    
    // Reset form
    setNewPinnger({ websiteName: '', url: '', duration: '5' });
    setShowAddForm(false);
  };

  const getStatusColor = (status: 'active' | 'paused', lastStatus?: 'success' | 'failed') => {
    if (status === 'paused') {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100';
    }
    if (lastStatus === 'failed') {
      return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100';
    }
    return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100';
  };

  const getStatusText = (status: 'active' | 'paused', lastStatus?: 'success' | 'failed') => {
    if (status === 'paused') return 'Paused';
    if (lastStatus === 'failed') return 'Failed';
    if (lastStatus === 'success') return 'Online';
    return 'Pending';
  };

  const getAverageResponseTime = () => {
    const allResponses = pinngers.flatMap(p => p.responseHistory || []);
    if (allResponses.length === 0) return 0;
    const total = allResponses.reduce((sum, response) => sum + response.responseTime, 0);
    return Math.round(total / allResponses.length);
  };

  if (!isLoggedIn || isLoading) {
    return <div className="min-h-screen flex items-center justify-center">
      {!isLoggedIn ? 'Loading...' : 'Loading pinngers...'}
    </div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Pinnger Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Welcome back, Akhil! You have {pinngers.length} pinnger{pinngers.length !== 1 ? 's' : ''} configured
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {pinngers.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Pinngers</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-green-600">
                {pinngers.filter(p => p.status === 'active' && p.lastStatus === 'success').length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Online</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-red-600">
                {pinngers.filter(p => p.lastStatus === 'failed').length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Failed</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {pinngers.filter(p => p.status === 'paused').length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Paused</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-blue-600">
                {getAverageResponseTime()}ms
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Avg Response</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          {/* Add Pinnger Button */}
          <div className="mb-6">
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              + Add New Pinnger
            </button>
          </div>

          {/* Add Pinnger Form Modal */}
          {showAddForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
                <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
                  Add New Pinnger
                </h2>
                <form onSubmit={handleAddPinnger} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Website Name
                    </label>
                    <input
                      type="text"
                      value={newPinnger.websiteName}
                      onChange={(e) => setNewPinnger(prev => ({ ...prev, websiteName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="e.g., My Website"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Website URL
                    </label>
                    <input
                      type="url"
                      value={newPinnger.url}
                      onChange={(e) => setNewPinnger(prev => ({ ...prev, url: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="https://example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Ping Interval (minutes)
                    </label>
                    <select
                      value={newPinnger.duration}
                      onChange={(e) => setNewPinnger(prev => ({ ...prev, duration: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="1">Every 1 minute</option>
                      <option value="5">Every 5 minutes</option>
                      <option value="10">Every 10 minutes</option>
                      <option value="15">Every 15 minutes</option>
                      <option value="30">Every 30 minutes</option>
                      <option value="60">Every 1 hour</option>
                    </select>
                  </div>
                  <div className="flex space-x-3 pt-4">
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-md transition-colors"
                    >
                      Add Pinnger
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Pinngers List */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pinngers.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <div className="text-gray-400 text-lg mb-2">No pinngers yet</div>
                <div className="text-gray-500">Add your first pinnger to get started monitoring websites</div>
              </div>
            ) : (
              pinngers.map((pinnger) => (
                <div
                  key={pinnger.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {pinnger.websiteName}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 break-all">
                        {pinnger.url}
                      </p>
                    </div>
                    <span
                      className={`ml-2 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(pinnger.status, pinnger.lastStatus)}`}
                    >
                      {getStatusText(pinnger.status, pinnger.lastStatus)}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 space-y-1">
                    <div>Ping every {pinnger.duration} minute{pinnger.duration !== '1' ? 's' : ''}</div>
                    <div>Created: {new Date(pinnger.createdAt).toLocaleDateString()}</div>
                    {pinnger.lastPing && (
                      <div>Last ping: {new Date(pinnger.lastPing).toLocaleString()}</div>
                    )}
                    {pinnger.lastResponse && (
                      <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs">
                        <div className="font-medium mb-1">Last Response:</div>
                        <div>Status: {pinnger.lastResponse.status} {pinnger.lastResponse.statusText}</div>
                        <div>Response Time: {pinnger.lastResponse.responseTime}ms</div>
                        {pinnger.lastResponse.error && (
                          <div className="text-red-600 dark:text-red-400">Error: {pinnger.lastResponse.error}</div>
                        )}
                        <div>Time: {new Date(pinnger.lastResponse.timestamp).toLocaleTimeString()}</div>
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-2 mb-2">
                    <button
                      onClick={() => testPing(pinnger.id)}
                      className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-100 py-2 px-3 rounded text-sm font-medium transition-colors"
                    >
                      Test Ping
                    </button>
                    <button
                      onClick={() => setSelectedPinnger(selectedPinnger === pinnger.id ? null : pinnger.id)}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100 py-2 px-3 rounded text-sm font-medium transition-colors"
                    >
                      {selectedPinnger === pinnger.id ? 'Hide' : 'History'}
                    </button>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => togglePinngerStatus(pinnger.id)}
                      className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                        pinnger.status === 'active'
                          ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                          : 'bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-100'
                      }`}
                    >
                      {pinnger.status === 'active' ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={() => deletePinnger(pinnger.id)}
                      className="flex-1 bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-100 py-2 px-3 rounded text-sm font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </div>

                  {/* Response History */}
                  {selectedPinnger === pinnger.id && pinnger.responseHistory && pinnger.responseHistory.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Response History</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {pinnger.responseHistory.slice().reverse().map((response, index) => (
                          <div key={index} className="text-xs p-2 bg-gray-50 dark:bg-gray-700 rounded">
                            <div className="flex justify-between items-start">
                              <span className={`font-medium ${response.status >= 200 && response.status < 400 ? 'text-green-600' : 'text-red-600'}`}>
                                {response.status} {response.statusText}
                              </span>
                              <span className="text-gray-500">
                                {response.responseTime}ms
                              </span>
                            </div>
                            <div className="text-gray-600 dark:text-gray-400">
                              {new Date(response.timestamp).toLocaleString()}
                            </div>
                            {response.error && (
                              <div className="text-red-600 dark:text-red-400 mt-1">
                                {response.error}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
