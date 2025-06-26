'use client';

import { useState, useEffect } from 'react';
import { dbService, DatabasePinnger } from '@/lib/database';

export interface PingResponse {
  status: number;
  statusText: string;
  responseTime: number;
  timestamp: Date;
  error?: string;
}

export interface Pinnger {
  id: string;
  websiteName: string;
  url: string;
  duration: string;
  status: 'active' | 'paused';
  lastPing?: Date;
  lastStatus?: 'success' | 'failed';
  lastResponse?: PingResponse;
  responseHistory: PingResponse[];
  createdAt: Date;
}

export function usePinngers() {
  const [pinngers, setPinngers] = useState<Pinnger[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize database and load pinngers on mount
  useEffect(() => {
    const initAndLoad = async () => {
      try {
        await dbService.initDatabase();
        await loadPinngers();
      } catch (error) {
        console.error('Error initializing:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAndLoad();
  }, []);

  const loadPinngers = async () => {
    try {
      const dbPinngers = await dbService.getAllPinngers();
      const convertedPinngers = dbPinngers.map(p => {
        let lastResponse;
        try {
          lastResponse = p.lastResponse ? JSON.parse(p.lastResponse) : undefined;
          if (lastResponse && lastResponse.timestamp) {
            lastResponse.timestamp = new Date(lastResponse.timestamp);
          }
        } catch (e) {
          console.warn('Error parsing lastResponse for pinnger', p.id, e);
          lastResponse = undefined;
        }

        let responseHistory = [];
        try {
          const historyData = JSON.parse(p.responseHistory || '[]');
          responseHistory = historyData.map((r: any) => ({
            ...r,
            timestamp: new Date(r.timestamp)
          }));
        } catch (e) {
          console.warn('Error parsing responseHistory for pinnger', p.id, e);
          responseHistory = [];
        }

        return {
          ...p,
          createdAt: new Date(p.createdAt),
          lastPing: p.lastPing ? new Date(p.lastPing) : undefined,
          lastResponse,
          responseHistory
        };
      });
      setPinngers(convertedPinngers);
    } catch (error) {
      console.error('Error loading pinngers:', error);
    }
  };

  // Simulate ping functionality with real HTTP requests
  useEffect(() => {
    if (isLoading) return; // Don't start pinging until data is loaded

    const performPing = async (pinnger: Pinnger): Promise<PingResponse> => {
      const startTime = Date.now();
      
      try {
        // Use a CORS proxy for demo purposes, or you could create an API route
        const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(pinnger.url)}`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        const responseTime = Date.now() - startTime;
        
        return {
          status: response.status,
          statusText: response.statusText || 'OK',
          responseTime,
          timestamp: new Date()
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;
        
        return {
          status: 0,
          statusText: 'Network Error',
          responseTime,
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    };

    const interval = setInterval(async () => {
      // Get fresh data from database to ensure we have latest state
      const currentPinngers = await dbService.getAllPinngers();
      
      for (const dbPinnger of currentPinngers) {
        if (dbPinnger.status !== 'active') continue;
        
        const now = new Date();
        const lastPing = dbPinnger.lastPing ? new Date(dbPinnger.lastPing) : new Date(0);
        const minutesSinceLastPing = (now.getTime() - lastPing.getTime()) / (1000 * 60);
        
        if (minutesSinceLastPing >= parseInt(dbPinnger.duration)) {
          const pinnger: Pinnger = {
            ...dbPinnger,
            createdAt: new Date(dbPinnger.createdAt),
            lastPing: dbPinnger.lastPing ? new Date(dbPinnger.lastPing) : undefined,
            lastResponse: dbPinnger.lastResponse ? JSON.parse(dbPinnger.lastResponse) : undefined,
            responseHistory: JSON.parse(dbPinnger.responseHistory).map((r: any) => ({
              ...r,
              timestamp: new Date(r.timestamp)
            }))
          };

          const response = await performPing(pinnger);
          const success = response.status >= 200 && response.status < 400;
          
          const newHistory = [...(pinnger.responseHistory || []), response].slice(-10);
          
          // Update in database
          await dbService.updatePinnger(pinnger.id, {
            lastPing: now.toISOString(),
            lastStatus: success ? 'success' : 'failed',
            lastResponse: JSON.stringify({
              ...response,
              timestamp: response.timestamp.toISOString()
            }),
            responseHistory: JSON.stringify(newHistory.map(r => ({
              ...r,
              timestamp: r.timestamp.toISOString()
            })))
          });
          
          // Update local state
          setPinngers(prev => prev.map(p => 
            p.id === pinnger.id 
              ? {
                  ...p,
                  lastPing: now,
                  lastStatus: success ? 'success' : 'failed',
                  lastResponse: response,
                  responseHistory: newHistory
                }
              : p
          ));
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [isLoading]);

  const addPinnger = async (pinngerData: Omit<Pinnger, 'id' | 'createdAt' | 'responseHistory'>) => {
    try {
      // Convert to database format
      const dbPinngerData = {
        ...pinngerData,
        lastPing: pinngerData.lastPing?.toISOString(),
        lastResponse: pinngerData.lastResponse ? JSON.stringify({
          ...pinngerData.lastResponse,
          timestamp: pinngerData.lastResponse.timestamp.toISOString()
        }) : undefined
      };
      
      const id = await dbService.addPinnger(dbPinngerData);
      const newPinnger: Pinnger = {
        ...pinngerData,
        id,
        createdAt: new Date(),
        responseHistory: []
      };
      
      setPinngers(current => [...current, newPinnger]);
    } catch (error) {
      console.error('Error adding pinnger:', error);
    }
  };

  const deletePinnger = async (id: string) => {
    try {
      await dbService.deletePinnger(id);
      setPinngers(current => current.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting pinnger:', error);
    }
  };

  const togglePinngerStatus = async (id: string) => {
    try {
      await dbService.togglePinngerStatus(id);
      setPinngers(current =>
        current.map(p =>
          p.id === id
            ? { ...p, status: p.status === 'active' ? 'paused' : 'active' }
            : p
        )
      );
    } catch (error) {
      console.error('Error toggling pinnger status:', error);
    }
  };

  const updatePinnger = async (id: string, updates: Partial<Pinnger>) => {
    try {
      // Convert dates to ISO strings for database
      const dbUpdates: Partial<DatabasePinnger> = {};
      
      // Copy simple properties
      if (updates.websiteName) dbUpdates.websiteName = updates.websiteName;
      if (updates.url) dbUpdates.url = updates.url;
      if (updates.duration) dbUpdates.duration = updates.duration;
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.lastStatus) dbUpdates.lastStatus = updates.lastStatus;
      
      // Convert complex properties
      if (updates.lastPing) {
        dbUpdates.lastPing = updates.lastPing.toISOString();
      }
      if (updates.lastResponse) {
        dbUpdates.lastResponse = JSON.stringify({
          ...updates.lastResponse,
          timestamp: updates.lastResponse.timestamp.toISOString()
        });
      }
      if (updates.responseHistory) {
        dbUpdates.responseHistory = JSON.stringify(updates.responseHistory.map((r: PingResponse) => ({
          ...r,
          timestamp: r.timestamp.toISOString()
        })));
      }

      await dbService.updatePinnger(id, dbUpdates);
      setPinngers(current =>
        current.map(p =>
          p.id === id ? { ...p, ...updates } : p
        )
      );
    } catch (error) {
      console.error('Error updating pinnger:', error);
    }
  };

  const testPing = async (id: string) => {
    const pinnger = pinngers.find(p => p.id === id);
    if (!pinnger) return;

    const startTime = Date.now();
    
    try {
      const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(pinnger.url)}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000)
      });
      
      const responseTime = Date.now() - startTime;
      const success = response.status >= 200 && response.status < 400;
      
      const pingResponse: PingResponse = {
        status: response.status,
        statusText: response.statusText || 'OK',
        responseTime,
        timestamp: new Date()
      };

      const newHistory = [...(pinnger.responseHistory || []), pingResponse].slice(-10);

      // Update in database
      await dbService.updatePinnger(id, {
        lastPing: new Date().toISOString(),
        lastStatus: success ? 'success' : 'failed',
        lastResponse: JSON.stringify({
          ...pingResponse,
          timestamp: pingResponse.timestamp.toISOString()
        }),
        responseHistory: JSON.stringify(newHistory.map(r => ({
          ...r,
          timestamp: r.timestamp.toISOString()
        })))
      });

      // Update local state
      setPinngers(current => current.map(p => 
        p.id === id 
          ? {
              ...p,
              lastPing: new Date(),
              lastStatus: success ? 'success' : 'failed',
              lastResponse: pingResponse,
              responseHistory: newHistory
            }
          : p
      ));
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      const pingResponse: PingResponse = {
        status: 0,
        statusText: 'Network Error',
        responseTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      const newHistory = [...(pinnger.responseHistory || []), pingResponse].slice(-10);

      // Update in database
      await dbService.updatePinnger(id, {
        lastPing: new Date().toISOString(),
        lastStatus: 'failed',
        lastResponse: JSON.stringify({
          ...pingResponse,
          timestamp: pingResponse.timestamp.toISOString()
        }),
        responseHistory: JSON.stringify(newHistory.map(r => ({
          ...r,
          timestamp: r.timestamp.toISOString()
        })))
      });

      // Update local state
      setPinngers(current => current.map(p => 
        p.id === id 
          ? {
              ...p,
              lastPing: new Date(),
              lastStatus: 'failed',
              lastResponse: pingResponse,
              responseHistory: newHistory
            }
          : p
      ));
    }
  };

  return {
    pinngers,
    addPinnger,
    deletePinnger,
    togglePinngerStatus,
    updatePinnger,
    testPing,
    isLoading
  };
}
