/**
 * Security event logging service
 */

interface SecurityEvent {
  type: 'prompt_injection_attempt' | 'rate_limit_exceeded' | 'invalid_input' |
        'suspicious_pattern' | 'error';
  userId?: number;
  userEmail?: string;
  ip?: string;
  message: string;
  metadata?: any;
  timestamp: string;
}

class SecurityLogger {
  private events: SecurityEvent[] = [];
  private readonly maxEvents = 1000;

  log(event: Omit<SecurityEvent, 'timestamp'>) {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    this.events.push(fullEvent);

    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    const logLevel = event.type === 'error' ? 'error' : 'warn';
    console[logLevel]('[Security Event]', {
      type: event.type,
      user: event.userEmail || event.userId || 'anonymous',
      message: event.message,
    });
  }

  getRecentEvents(limit = 100): SecurityEvent[] {
    return this.events.slice(-limit);
  }

  getEventsByType(type: SecurityEvent['type'], limit = 100): SecurityEvent[] {
    return this.events.filter(e => e.type === type).slice(-limit);
  }

  getStats() {
    const stats = {
      total: this.events.length,
      byType: {} as Record<string, number>,
    };

    this.events.forEach(event => {
      stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
    });

    return stats;
  }
}

export const securityLogger = new SecurityLogger();
