# LoadSetu API Path Fix - Summary

## Problem
After implementing auto-login on registration, the frontend was making API calls with **duplicated path segments**:
- ❌ `GET /api/spring/api/v1/users/me` (wrong - double `/api`)
- ❌ `GET /api/spring/api/v1/loads/my-loads` (wrong - double `/api`)
- ❌ `GET /api/ai/api/v1/admin/trucks/live` (wrong - double `/api`)

This caused **500 Internal Server Error** on all API calls after login.

## Root Cause
Two issues were causing the path duplication:

### Issue 1: API Hooks Had Full Paths
**File**: `loadsetu-web/src/lib/api/hooks.ts`

The API client was configured with:
- `springClient` baseURL: `/api/spring`
- `aiClient` baseURL: `/api/ai`

But the hooks were calling endpoints with full paths like:
```typescript
get(springClient, "/api/v1/users/me")  // ❌ Creates /api/spring/api/v1/users/me
```

**Fix**: Removed `/api/v1` prefix from all endpoint paths:
```typescript
get(springClient, "/users/me")  // ✅ Creates /api/spring/users/me
```

### Issue 2: Next.js Rewrites Used Wrong URLs
**File**: `loadsetu-web/next.config.js`

The rewrites were configured to proxy to `NEXT_PUBLIC_SPRING_URL` which was set to `http://localhost/api/spring` - creating a **circular proxy loop**!

**Old Config**:
```javascript
{
  source: "/api/spring/:path*",
  destination: `${process.env.NEXT_PUBLIC_SPRING_URL}/:path*`,  // ❌ Circular loop
}
```

**New Config**:
```javascript
{
  source: "/api/spring/:path*",
  destination: `${process.env.SPRING_BACKEND_URL}/api/v1/:path*`,  // ✅ Internal backend URL
}
```

Now rewrites properly proxy to internal Docker services:
- `/api/spring/*` → `http://backend:8080/api/v1/*`
- `/api/ai/*` → `http://ml-engine:8000/api/v1/*`

## Changes Made

### 1. Fixed API Hooks (`loadsetu-web/src/lib/api/hooks.ts`)
Removed `/api/v1` prefix from all endpoints:
- `/api/v1/users/me` → `/users/me`
- `/api/v1/loads/my-loads` → `/loads/my-loads`
- `/api/v1/loads` → `/loads`
- `/api/v1/bookings` → `/bookings`
- `/api/v1/matches/:id` → `/matches/:id`
- `/api/v1/auth/login` → `/auth/login`
- `/api/v1/loads/bulk` → `/loads/bulk`
- `/api/v1/admin/trucks/live` → `/admin/trucks/live`
- `/api/v1/loads/match` → `/loads/match`

### 2. Fixed Next.js Rewrites (`loadsetu-web/next.config.js`)
Changed rewrites to use internal backend URLs:
```javascript
const springBackend = process.env.SPRING_BACKEND_URL || 'http://localhost:8080';
const fastApiBackend = process.env.FASTAPI_BACKEND_URL || 'http://localhost:8000';

return [
  {
    source: "/api/spring/:path*",
    destination: `${springBackend}/api/v1/:path*`,
  },
  {
    source: "/api/ai/:path*",
    destination: `${fastApiBackend}/api/v1/:path*`,
  },
];
```

## Request Flow (After Fix)

### Frontend → Backend (Spring)
1. Frontend calls: `GET /api/spring/users/me`
2. Next.js rewrite proxies to: `http://backend:8080/api/v1/users/me`
3. Backend receives: `GET /api/v1/users/me` ✅

### Frontend → ML Engine (FastAPI)
1. Frontend calls: `GET /api/ai/admin/trucks/live`
2. Next.js rewrite proxies to: `http://ml-engine:8000/api/v1/admin/trucks/live`
3. ML Engine receives: `GET /api/v1/admin/trucks/live` ✅

## Environment Variables

### Docker Compose (`docker-compose.prod.yml`)
```yaml
web:
  environment:
    # Internal backend URLs (for Next.js rewrites)
    SPRING_BACKEND_URL: http://backend:8080
    FASTAPI_BACKEND_URL: http://ml-engine:8000
    
    # External URLs (for client-side, baked into build)
    NEXT_PUBLIC_SPRING_URL: http://localhost/api/spring
    NEXT_PUBLIC_FASTAPI_URL: http://localhost/api/ai
```

## Testing
After these fixes:
1. Registration works ✅
2. Auto-login works ✅
3. Redirect to `/loads` dashboard works ✅
4. API calls should now work correctly ✅

## Commits
- `34cd281` - Fix API endpoint path duplication - remove /api/v1 prefix from hooks
- `a780815` - Fix Next.js rewrites to use internal backend URLs

## Next Steps
1. Test registration and auto-login flow in browser
2. Verify API calls are working (check browser console)
3. Fix WebSocket connection if still failing
4. Deploy to EC2 once local testing is complete
