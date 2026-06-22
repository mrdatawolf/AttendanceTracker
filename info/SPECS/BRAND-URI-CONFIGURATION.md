# Brand URI Configuration

## Overview

The build system now supports configuring a default API server URL for each brand. This allows client applications to be pre-configured to communicate with a specific server, which is useful for:

- Remote server deployments (client and server on different machines)
- Testing against a specific server instance
- Multi-server environments

## Configuration

### Setting the Brand URI

Each brand's `brand-features.json` file includes a `brandURI` field:

```json
{
  "brandName": "TRL",
  "brandURI": "http://192.168.1.100:6029",
  "brandPrimaryColor": "#003366",
  "brandSecondaryColor": "#FFFFFF",
  "brandAccentColor": "#FF6B35"
}
```

**brandURI Options:**

1. **Empty string `""`** (default):
   - Uses relative API paths (`/api/employees`)
   - Client and server must be on the same host
   - Standard single-server deployment

2. **Full URL** (e.g., `"http://192.168.1.100:6029"`):
   - Client makes API calls to the specified server
   - Supports remote server scenarios
   - Client can be deployed separately from server

## Build Process

### How It Works

1. **Brand Selection**: Run `npm run select-brand` to choose a brand
2. **Build with URI**: The `npm run build` script now:
   - Reads the selected brand from `lib/brand-selection.json`
   - Loads `brandURI` from that brand's `brand-features.json`
   - Sets `NEXT_PUBLIC_API_URL` environment variable
   - Runs Next.js build with this configuration

3. **Result**: The built application has the API URL baked in at build time

### Build Commands

- `npm run build` - Build with brand URI injection (recommended)
- `npm run build:basic` - Build without URI injection (original behavior)
- `npm run build:all` - Full build including all artifacts with brand URI
- `npm run build:branded` - Select brand + build with URI

## Code Usage

### Using the API Client

The [lib/api-client.ts](../lib/api-client.ts) module provides utilities for making API calls:

```typescript
import { apiFetch, getApiUrl } from '@/lib/api-client';

// Option 1: Use apiFetch helper (recommended)
const response = await apiFetch('/api/employees', {
  headers: { Authorization: `Bearer ${token}` }
});
const data = await response.json();

// Option 2: Get URL and use with fetch
const url = getApiUrl('/api/employees');
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` }
});
```

### Configuration Object

The configuration is available via [lib/config.ts](../lib/config.ts):

```typescript
import { config } from '@/lib/config';

// Access the configured API base URL
const baseURL = config.api.baseURL;  // '' or 'http://192.168.1.100:6029'
```

## Migration Guide

### Updating Existing Fetch Calls

**Before:**
```typescript
const response = await fetch('/api/employees', {
  headers: { Authorization: `Bearer ${token}` }
});
```

**After:**
```typescript
import { apiFetch } from '@/lib/api-client';

const response = await apiFetch('/api/employees', {
  headers: { Authorization: `Bearer ${token}` }
});
```

### Benefits of Migration

- ✅ Automatic URL handling (relative or absolute)
- ✅ Supports remote server configurations
- ✅ No changes needed when switching between deployment modes
- ✅ Type-safe with TypeScript

## Examples

### Example 1: Local Development

**brand-features.json:**
```json
{
  "brandURI": ""
}
```

**Result:** API calls use relative paths
- Fetch: `fetch('/api/employees')`
- Actual URL: `/api/employees` (relative to current host)

### Example 2: Remote Server

**brand-features.json:**
```json
{
  "brandURI": "http://192.168.1.100:6029"
}
```

**Result:** API calls use absolute URLs
- Fetch: `apiFetch('/api/employees')`
- Actual URL: `http://192.168.1.100:6029/api/employees`

### Example 3: HTTPS Production Server

**brand-features.json:**
```json
{
  "brandURI": "https://api.example.com"
}
```

**Result:** All API calls go to production server
- Fetch: `apiFetch('/api/employees')`
- Actual URL: `https://api.example.com/api/employees`

## Deployment Scenarios

### Scenario 1: Single Server (Client + Server Together)

- Set `brandURI: ""`
- Deploy both client and server together
- Standard Next.js standalone deployment
- Client uses relative paths

### Scenario 2: Separate Client and Server

- Set `brandURI: "http://server-host:6029"`
- Build client with this configuration
- Deploy client static files to web server
- Deploy server separately
- Client makes cross-origin requests to server

**Note:** For Scenario 2, ensure CORS is properly configured on the server.

## Testing

### Testing Different Configurations

1. **Test with empty brandURI:**
   ```bash
   # Update brand-features.json: "brandURI": ""
   npm run select-brand
   npm run build
   # Should use relative paths
   ```

2. **Test with remote server:**
   ```bash
   # Update brand-features.json: "brandURI": "http://192.168.1.100:6029"
   npm run select-brand
   npm run build
   # Should use absolute URLs
   ```

3. **Verify in browser DevTools:**
   - Open Network tab
   - Check API request URLs
   - Should match expected configuration

## Troubleshooting

### API Calls Not Using Correct URL

**Symptoms:**
- API calls still using relative paths when they should be absolute
- Or vice versa

**Solutions:**
1. Verify `brandURI` is set correctly in `brand-features.json`
2. Rebuild the application: `npm run build`
3. Check browser console for the configured URL:
   ```javascript
   console.log(process.env.NEXT_PUBLIC_API_URL)
   ```
4. Ensure you're using `apiFetch` or `getApiUrl` helpers

### CORS Errors with Remote Server

**Symptoms:**
- Browser shows CORS policy errors
- API calls fail from client to remote server

**Solutions:**
1. Configure CORS on the server to allow client origin
2. Ensure server is accessible from client machine
3. Check firewall and network settings

### Build Not Picking Up brandURI

**Symptoms:**
- `NEXT_PUBLIC_API_URL` is not set during build
- Application ignores brandURI configuration

**Solutions:**
1. Check that [scripts/build-with-brand-uri.js](../scripts/build-with-brand-uri.js) is being used
2. Verify `npm run build` is set to use the script in [package.json](../package.json)
3. Check [lib/brand-selection.json](../lib/brand-selection.json) exists and has correct brand
4. Verify brand's `brand-features.json` has valid JSON

## Technical Details

### Environment Variable

The `NEXT_PUBLIC_API_URL` environment variable is:
- Set at **build time** by [scripts/build-with-brand-uri.js](../scripts/build-with-brand-uri.js)
- Embedded in the client bundle by Next.js
- Accessible via `process.env.NEXT_PUBLIC_API_URL` in client code
- Read by [lib/config.ts](../lib/config.ts) and exposed as `config.api.baseURL`

### Build Script Flow

1. Read selected brand from `lib/brand-selection.json`
2. Load that brand's `public/{brand}/brand-features.json`
3. Extract `brandURI` field
4. Set `NEXT_PUBLIC_API_URL={brandURI}` in environment
5. Run `next build` with this environment
6. Next.js embeds the value in client bundle

### URL Construction Logic

See [lib/api-client.ts](../lib/api-client.ts) for implementation:

```typescript
export function getApiUrl(path: string): string {
  const baseURL = config.api.baseURL;

  // Empty baseURL -> use relative path
  if (!baseURL || baseURL.trim() === '') {
    return path;  // e.g., '/api/employees'
  }

  // Non-empty baseURL -> construct absolute URL
  return `${baseURL}${path}`;  // e.g., 'http://server:6029/api/employees'
}
```

## Best Practices

1. **Default to Empty URI**: For most deployments, use `""` for brandURI
2. **Document Remote Configurations**: When using remote URIs, document the server address
3. **Use HTTPS in Production**: Always use `https://` for production brandURIs
4. **Test Both Modes**: Test with both empty and configured URIs before deployment
5. **Consistent Migration**: Migrate all fetch calls to use `apiFetch` for consistency
6. **Environment Variables**: Consider using environment variables for server configuration instead of hardcoded URIs

## Related Files

- [scripts/build-with-brand-uri.js](../scripts/build-with-brand-uri.js) - Build script
- [lib/config.ts](../lib/config.ts) - Configuration object
- [lib/api-client.ts](../lib/api-client.ts) - API client utilities
- [lib/brand-selection.json](../lib/brand-selection.json) - Selected brand
- `public/{brand}/brand-features.json` - Brand-specific configuration

## Future Enhancements

Potential improvements to consider:

- [ ] Runtime configuration via environment variables (in addition to build-time)
- [ ] Multiple server endpoints (e.g., separate auth and data servers)
- [ ] Automatic CORS configuration based on brandURI
- [ ] Validation of brandURI format during build
- [ ] Support for server discovery/service registry
