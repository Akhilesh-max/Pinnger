import { createClient, Client } from '@libsql/client';

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    
    if (!url || !authToken) {
      throw new Error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variables');
    }
    
    client = createClient({
      url,
      authToken
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
          status TEXT DEFAULT 'active',
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
      throw error;
    }
  }

  async getAllPinngers(): Promise<DatabasePinnger[]> {
    try {
      const result = await this.client.execute('SELECT * FROM pinngers ORDER BY createdAt DESC');
      return result.rows.map(row => ({
        id: row.id as string,
        websiteName: row.websiteName as string,
        url: row.url as string,
        duration: row.duration as string,
        status: (row.status as string) === 'paused' ? 'paused' : 'active',
        lastPing: row.lastPing as string | undefined,
        lastStatus: row.lastStatus as 'success' | 'failed' | undefined,
        lastResponse: row.lastResponse as string | undefined,
        responseHistory: (row.responseHistory as string) || '[]',
        createdAt: row.createdAt as string,
      }));
    } catch (error) {
      console.error('Error getting all pinngers:', error);
      throw error;
    }
  }

  async getPinnger(id: string): Promise<DatabasePinnger | null> {
    try {
      const result = await this.client.execute({
        sql: 'SELECT * FROM pinngers WHERE id = ?',
        args: [id]
      });
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id as string,
        websiteName: row.websiteName as string,
        url: row.url as string,
        duration: row.duration as string,
        status: (row.status as string) === 'paused' ? 'paused' : 'active',
        lastPing: row.lastPing as string | undefined,
        lastStatus: row.lastStatus as 'success' | 'failed' | undefined,
        lastResponse: row.lastResponse as string | undefined,
        responseHistory: (row.responseHistory as string) || '[]',
        createdAt: row.createdAt as string,
      };
    } catch (error) {
      console.error('Error getting pinnger:', error);
      throw error;
    }
  }

  async addPinnger(pinnger: Omit<DatabasePinnger, 'id' | 'createdAt' | 'lastPing' | 'lastStatus' | 'lastResponse'>): Promise<string> {
    try {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      
      await this.client.execute({
        sql: `INSERT INTO pinngers (id, websiteName, url, duration, status, responseHistory, createdAt) 
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [id, pinnger.websiteName, pinnger.url, pinnger.duration, pinnger.status, pinnger.responseHistory, createdAt]
      });
      
      return id;
    } catch (error) {
      console.error('Error adding pinnger:', error);
      throw error;
    }
  }

  async updatePinnger(id: string, updates: Partial<Omit<DatabasePinnger, 'id' | 'createdAt'>>): Promise<void> {
    try {
      const setParts: string[] = [];
      const args: (string | number | boolean | null)[] = [];
      
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          setParts.push(`${key} = ?`);
          args.push(value);
        }
      });
      
      if (setParts.length === 0) {
        return;
      }
      
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
      const pinnger = await this.getPinnger(id);
      if (!pinnger) {
        throw new Error('Pinnger not found');
      }
      
      const newStatus = pinnger.status === 'active' ? 'paused' : 'active';
      await this.updatePinnger(id, { status: newStatus });
    } catch (error) {
      console.error('Error toggling pinnger status:', error);
      throw error;
    }
  }
}

// Create a singleton instance for server-side use
export const dbService = new DatabaseService();
