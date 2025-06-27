import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/database-server';

export async function GET() {
  try {
    // Initialize database
    await dbService.initDatabase();
    
    // Get all active pinngers
    const pinngers = await dbService.getAllPinngers();
    const activePinngers = pinngers.filter(p => p.status === 'active');
    
    const results = [];
    
    for (const pinnger of activePinngers) {
      const now = new Date();
      const lastPing = pinnger.lastPing ? new Date(pinnger.lastPing) : new Date(0);
      const minutesSinceLastPing = (now.getTime() - lastPing.getTime()) / (1000 * 60);
      
      // Check if it's time to ping
      if (minutesSinceLastPing >= parseInt(pinnger.duration)) {
        const startTime = Date.now();
        
        try {
          // Try to ping the URL
          const response = await fetch(pinnger.url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });
          
          const responseTime = Date.now() - startTime;
          const success = response.status >= 200 && response.status < 400;
          
          const pingResponse = {
            status: response.status,
            statusText: response.statusText || 'OK',
            responseTime,
            timestamp: now.toISOString(),
          };

          // Get existing history
          let responseHistory = [];
          try {
            responseHistory = JSON.parse(pinnger.responseHistory || '[]');
          } catch {
            responseHistory = [];
          }
          
          // Add new response and keep last 10
          const newHistory = [...responseHistory, pingResponse].slice(-10);
          
          // Update in database
          await dbService.updatePinnger(pinnger.id, {
            lastPing: now.toISOString(),
            lastStatus: success ? 'success' : 'failed',
            lastResponse: JSON.stringify(pingResponse),
            responseHistory: JSON.stringify(newHistory)
          });
          
          results.push({
            id: pinnger.id,
            websiteName: pinnger.websiteName,
            url: pinnger.url,
            status: success ? 'success' : 'failed',
            responseTime,
            timestamp: now.toISOString()
          });
          
        } catch (error) {
          const responseTime = Date.now() - startTime;
          
          const pingResponse = {
            status: 0,
            statusText: 'Network Error',
            responseTime,
            timestamp: now.toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error'
          };

          // Get existing history
          let responseHistory = [];
          try {
            responseHistory = JSON.parse(pinnger.responseHistory || '[]');
          } catch {
            responseHistory = [];
          }
          
          // Add new response and keep last 10
          const newHistory = [...responseHistory, pingResponse].slice(-10);
          
          // Update in database
          await dbService.updatePinnger(pinnger.id, {
            lastPing: now.toISOString(),
            lastStatus: 'failed',
            lastResponse: JSON.stringify(pingResponse),
            responseHistory: JSON.stringify(newHistory)
          });
          
          results.push({
            id: pinnger.id,
            websiteName: pinnger.websiteName,
            url: pinnger.url,
            status: 'failed',
            responseTime,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: now.toISOString()
          });
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} pinngers`,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in ping API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Also handle POST for manual triggers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Pinnger ID required' }, { status: 400 });
    }
    
    await dbService.initDatabase();
    
    // Get the specific pinnger
    const pinngers = await dbService.getAllPinngers();
    const pinnger = pinngers.find(p => p.id === id);
    
    if (!pinnger) {
      return NextResponse.json({ error: 'Pinnger not found' }, { status: 404 });
    }
    
    const startTime = Date.now();
    const now = new Date();
    
    try {
      const response = await fetch(pinnger.url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000)
      });
      
      const responseTime = Date.now() - startTime;
      const success = response.status >= 200 && response.status < 400;
      
      const pingResponse = {
        status: response.status,
        statusText: response.statusText || 'OK',
        responseTime,
        timestamp: now.toISOString(),
      };

      // Get existing history
      let responseHistory = [];
      try {
        responseHistory = JSON.parse(pinnger.responseHistory || '[]');
      } catch {
        responseHistory = [];
      }
      
      // Add new response and keep last 10
      const newHistory = [...responseHistory, pingResponse].slice(-10);
      
      // Update in database
      await dbService.updatePinnger(pinnger.id, {
        lastPing: now.toISOString(),
        lastStatus: success ? 'success' : 'failed',
        lastResponse: JSON.stringify(pingResponse),
        responseHistory: JSON.stringify(newHistory)
      });
      
      return NextResponse.json({
        success: true,
        result: {
          id: pinnger.id,
          websiteName: pinnger.websiteName,
          url: pinnger.url,
          status: success ? 'success' : 'failed',
          responseTime,
          timestamp: now.toISOString()
        }
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      const pingResponse = {
        status: 0,
        statusText: 'Network Error',
        responseTime,
        timestamp: now.toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      // Get existing history
      let responseHistory = [];
      try {
        responseHistory = JSON.parse(pinnger.responseHistory || '[]');
      } catch {
        responseHistory = [];
      }
      
      // Add new response and keep last 10
      const newHistory = [...responseHistory, pingResponse].slice(-10);
      
      // Update in database
      await dbService.updatePinnger(pinnger.id, {
        lastPing: now.toISOString(),
        lastStatus: 'failed',
        lastResponse: JSON.stringify(pingResponse),
        responseHistory: JSON.stringify(newHistory)
      });
      
      return NextResponse.json({
        success: false,
        result: {
          id: pinnger.id,
          websiteName: pinnger.websiteName,
          url: pinnger.url,
          status: 'failed',
          responseTime,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: now.toISOString()
        }
      });
    }
    
  } catch (error) {
    console.error('Error in manual ping:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
