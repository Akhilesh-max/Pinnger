'use client';

import { createClient, Client, InValue } from '@libsql/client';

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    client = createClient({
      url: process.env.NEXT_PUBLIC_TURSO_DATABASE_URL || 'libsql://pinnger-akhilesh.aws-ap-south-1.turso.io',
      authToken: process.env.NEXT_PUBLIC_TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NTA5NjYwNDEsImlkIjoiNTI2YWRkYzYtNTY0Ny00MWIxLThhMzAtYTkyZjU3Y2ZiY2Y5IiwicmlkIjoiMzYxYTJkNjktNzk1MC00YmJmLWJjMjctMzFmZDQ4N2YwNDA0In0.OzTvEngalnZOqZAqwPAF-DDGSc2z5PPW5-YPnF2bFzievEY9MLubZe3OO5I3NBhgit_aAu4AY7jyik6mbf1qBQ'
    });
  }
  return client;
}

export interface PingResponse {
  status: number;
  statusText: string;
  responseTime: number;
  timestamp: string;
  error?: string;
}

export interface DatabasePinnger {
  id: string;
  websiteName: string;
  url: string;
  duration: string;
  status: 'active' | 'paused';
  lastPing?: string;
  lastStatus?: 'success' | 'failed';
  lastResponse?: string; // JSON string
  responseHistory: string; // JSON string
  createdAt: string;
}

export class DatabaseService {
  private client: Client;

  constructor() {
    this.client = getClient();
  }

  async initDatabase() {
    try {
      // Create pinngers table
      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS pinngers (
          id TEXT PRIMARY KEY,
          websiteName TEXT NOT NULL,
          url TEXT NOT NULL,
          duration TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          lastPing TEXT,
          lastStatus TEXT,
          lastResponse TEXT,
          responseHistory TEXT DEFAULT '[]',
          createdAt TEXT NOT NULL
        )
      `);

      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
    }
  }

  async getAllPinngers(): Promise<DatabasePinnger[]> {
    try {
      const result = await this.client.execute('SELECT * FROM pinngers ORDER BY createdAt DESC');
      return result.rows.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        websiteName: row.websiteName as string,
        url: row.url as string,
        duration: row.duration as string,
        status: row.status as 'active' | 'paused',
        lastPing: row.lastPing as string | undefined,
        lastStatus: row.lastStatus as 'success' | 'failed' | undefined,
        lastResponse: row.lastResponse as string | undefined,
        responseHistory: (row.responseHistory as string) || '[]',
        createdAt: row.createdAt as string
      }));
    } catch (error) {
      console.error('Error fetching pinngers:', error);
      return [];
    }
  }

  async addPinnger(pinnger: Omit<DatabasePinnger, 'id' | 'createdAt' | 'responseHistory'>): Promise<string> {
    try {
      const id = Date.now().toString();
      const createdAt = new Date().toISOString();
      
      await this.client.execute({
        sql: `INSERT INTO pinngers (id, websiteName, url, duration, status, responseHistory, createdAt) 
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [id, pinnger.websiteName, pinnger.url, pinnger.duration, pinnger.status, '[]', createdAt]
      });

      return id;
    } catch (error) {
      console.error('Error adding pinnger:', error);
      throw error;
    }
  }

  async updatePinnger(id: string, updates: Partial<DatabasePinnger>): Promise<void> {
    try {
      const setParts: string[] = [];
      const args: InValue[] = [];

      if (updates.websiteName !== undefined) {
        setParts.push('websiteName = ?');
        args.push(updates.websiteName);
      }
      if (updates.url !== undefined) {
        setParts.push('url = ?');
        args.push(updates.url);
      }
      if (updates.duration !== undefined) {
        setParts.push('duration = ?');
        args.push(updates.duration);
      }
      if (updates.status !== undefined) {
        setParts.push('status = ?');
        args.push(updates.status);
      }
      if (updates.lastPing !== undefined) {
        setParts.push('lastPing = ?');
        args.push(updates.lastPing);
      }
      if (updates.lastStatus !== undefined) {
        setParts.push('lastStatus = ?');
        args.push(updates.lastStatus);
      }
      if (updates.lastResponse !== undefined) {
        setParts.push('lastResponse = ?');
        // Ensure it's properly serialized as JSON string
        args.push(typeof updates.lastResponse === 'string' ? updates.lastResponse : JSON.stringify(updates.lastResponse));
      }
      if (updates.responseHistory !== undefined) {
        setParts.push('responseHistory = ?');
        // Ensure it's properly serialized as JSON string
        args.push(typeof updates.responseHistory === 'string' ? updates.responseHistory : JSON.stringify(updates.responseHistory));
      }

      if (setParts.length === 0) return;

      args.push(id);
      
      await this.client.execute({
        sql: `UPDATE pinngers SET ${setParts.join(', ')} WHERE id = ?`,
        args
      });
    } catch (error) {
      console.error('Error updating pinnger:', error);
      throw error;
    }
  }

  async deletePinnger(id: string): Promise<void> {
    try {
      await this.client.execute({
        sql: 'DELETE FROM pinngers WHERE id = ?',
        args: [id]
      });
    } catch (error) {
      console.error('Error deleting pinnger:', error);
      throw error;
    }
  }

  async togglePinngerStatus(id: string): Promise<void> {
    try {
      // First get current status
      const result = await this.client.execute({
        sql: 'SELECT status FROM pinngers WHERE id = ?',
        args: [id]
      });

      if (result.rows.length === 0) return;

      const currentStatus = result.rows[0].status as string;
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';

      await this.client.execute({
        sql: 'UPDATE pinngers SET status = ? WHERE id = ?',
        args: [newStatus, id]
      });
    } catch (error) {
      console.error('Error toggling pinnger status:', error);
      throw error;
    }
  }
}

export const dbService = new DatabaseService();
