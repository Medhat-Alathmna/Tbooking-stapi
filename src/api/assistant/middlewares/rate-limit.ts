/**
 * Rate limiting middleware للـ AI assistant
 * Rate limiting middleware for AI assistant
 *
 * Limits:
 * - Employee: 5 requests/minute, 30/hour
 * - Admin: 30 requests/minute, 1000/hour
 */

interface RateLimitEntry {
  minute: { count: number; resetTime: number };
  hour: { count: number; resetTime: number };
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// تنظيف كل 10 دقائق - Cleanup every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.hour.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    const userId = ctx.state.user?.id;
    const userRole = ctx.state.user?.role?.type || ctx.state.user?.role?.name;

    // تحديد الحدود بناءً على الدور - Determine limits based on role
    const isAdmin = userRole === 'admin' || userRole === 'Admin';
    const limits = isAdmin
      ? { perMinute: 30, perHour: 1000 }
      : { perMinute: 5, perHour: 30 };

    const identifier = userId ? `user:${userId}` : `ip:${ctx.request.ip}`;
    const now = Date.now();

    // الحصول أو إنشاء rate limit entry - Get or create rate limit entry
    let rateLimit = rateLimitStore.get(identifier);

    if (!rateLimit) {
      rateLimit = {
        minute: { count: 0, resetTime: now + 60 * 1000 },
        hour: { count: 0, resetTime: now + 60 * 60 * 1000 }
      };
      rateLimitStore.set(identifier, rateLimit);
    }

    // إعادة تعيين العدادات إذا انتهى الوقت - Reset counters if time expired
    if (now > rateLimit.minute.resetTime) {
      rateLimit.minute = { count: 0, resetTime: now + 60 * 1000 };
    }
    if (now > rateLimit.hour.resetTime) {
      rateLimit.hour = { count: 0, resetTime: now + 60 * 60 * 1000 };
    }

    // زيادة العدادات - Increment counters
    rateLimit.minute.count++;
    rateLimit.hour.count++;

    // التحقق من الحدود - Check limits
    if (rateLimit.minute.count > limits.perMinute) {
      const retryAfter = Math.ceil((rateLimit.minute.resetTime - now) / 1000);
      console.warn(`[Rate Limit] ${identifier} exceeded minute limit (${isAdmin ? 'admin' : 'employee'})`);

      ctx.status = 429;
      ctx.body = {
        success: false,
        error: 'rate_limit_exceeded',
        message: `Too many requests. You can make ${limits.perMinute} requests per minute. Please wait ${retryAfter} seconds.`,
        retryAfter,
        limits: {
          perMinute: limits.perMinute,
          perHour: limits.perHour,
          role: isAdmin ? 'admin' : 'employee'
        }
      };

      ctx.set('X-RateLimit-Limit', String(limits.perMinute));
      ctx.set('X-RateLimit-Remaining', '0');
      ctx.set('Retry-After', String(retryAfter));
      return;
    }

    if (rateLimit.hour.count > limits.perHour) {
      const retryAfter = Math.ceil((rateLimit.hour.resetTime - now) / 1000);
      console.warn(`[Rate Limit] ${identifier} exceeded hour limit (${isAdmin ? 'admin' : 'employee'})`);

      ctx.status = 429;
      ctx.body = {
        success: false,
        error: 'rate_limit_exceeded',
        message: `Too many requests. You can make ${limits.perHour} requests per hour. Please wait.`,
        retryAfter,
        limits: {
          perMinute: limits.perMinute,
          perHour: limits.perHour,
          role: isAdmin ? 'admin' : 'employee'
        }
      };

      ctx.set('X-RateLimit-Limit', String(limits.perHour));
      ctx.set('X-RateLimit-Remaining', '0');
      ctx.set('Retry-After', String(retryAfter));
      return;
    }

    // إضافة headers - Add headers
    ctx.set('X-RateLimit-Limit-Minute', String(limits.perMinute));
    ctx.set('X-RateLimit-Remaining-Minute', String(limits.perMinute - rateLimit.minute.count));
    ctx.set('X-RateLimit-Limit-Hour', String(limits.perHour));
    ctx.set('X-RateLimit-Remaining-Hour', String(limits.perHour - rateLimit.hour.count));

    await next();
  };
};
