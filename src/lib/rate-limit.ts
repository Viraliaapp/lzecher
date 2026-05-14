import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }
  redis = new Redis({ url, token });
  return redis;
}

function createLimiter(
  prefix: string,
  tokens: number,
  windowSeconds: number
): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  return new Ratelimit({
    redis: r,
    prefix: `lzecher:${prefix}`,
    limiter: Ratelimit.slidingWindow(tokens, `${windowSeconds} s`),
  });
}

// Named limiters
const limiters = {
  magicLinkPerEmail: () => createLimiter("ml-email", 5, 3600),
  magicLinkPerIp: () => createLimiter("ml-ip", 20, 3600),
  projectCreate: () => createLimiter("proj-create", 10, 3600),
  claimCreateAnon: () => createLimiter("claim-anon", 30, 3600),
  claimCreateAuth: () => createLimiter("claim-auth", 100, 3600),
  markCompleteAnon: () => createLimiter("complete-anon", 10, 3600),
  ogImage: () => createLimiter("og", 100, 60),
};

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check rate limit. Returns { success: true } if allowed.
 * Falls back to allow-all if Upstash is not configured.
 */
export async function checkRateLimit(
  limiterName: keyof typeof limiters,
  identifier: string
): Promise<RateLimitResult> {
  const limiter = limiters[limiterName]();
  if (!limiter) {
    // No Redis configured — allow all (log once per cold start)
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (err) {
    console.warn("Rate limit check failed, allowing request:", err);
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
}

/**
 * Extract client IP from request headers.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
}
