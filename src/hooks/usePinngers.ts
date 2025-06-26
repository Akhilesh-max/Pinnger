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

        let responseHistory: PingResponse[] = [];
        try {
          const historyData = JSON.parse(p.responseHistory || '[]') as unknown[];
          responseHistory = historyData.map((r: unknown) => {
            const response = r as Record<string, unknown>;
            return {
              status: response.status as number,
              statusText: response.statusText as string,
              responseTime: response.responseTime as number,
              timestamp: new Date(response.timestamp as string),
              error: response.error as string | undefined
            };
          });
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

  // Load pinngers and refresh periodically
  useEffect(() => {
    if (isLoading) return;

    // Refresh data every 30 seconds to show latest ping results
    const interval = setInterval(() => {
      loadPinngers();
    }, 30000);

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

    try {
      const response = await fetch('/api/ping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Refresh the data to show updated results
        await loadPinngers();
      }
    } catch (error) {
      console.error('Error testing ping:', error);
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
