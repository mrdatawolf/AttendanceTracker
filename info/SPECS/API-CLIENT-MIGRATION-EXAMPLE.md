# API Client Migration Example

This document provides a step-by-step example of migrating existing fetch calls to use the new `apiFetch` utility.

## Before Migration

Here's a typical component with direct fetch calls:

```typescript
// app/employees/page.tsx - BEFORE

"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';

export default function EmployeesPage() {
  const { token } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    async function loadData() {
      // Direct fetch call #1
      const employeesResponse = await fetch('/api/employees', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const employeesData = await employeesResponse.json();
      setEmployees(employeesData);

      // Direct fetch call #2
      const groupsResponse = await fetch('/api/groups', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const groupsData = await groupsResponse.json();
      setGroups(groupsData);
    }

    if (token) {
      loadData();
    }
  }, [token]);

  async function handleCreateEmployee(data) {
    // Direct fetch call #3
    const response = await fetch('/api/employees', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      // Refresh list
      // Direct fetch call #4
      const employeesResponse = await fetch('/api/employees', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const employeesData = await employeesResponse.json();
      setEmployees(employeesData);
    }
  }

  async function handleUpdateEmployee(id, data) {
    // Direct fetch call #5
    const response = await fetch('/api/employees', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ id, ...data })
    });

    if (response.ok) {
      // Update in place
      setEmployees(prev =>
        prev.map(emp => emp.id === id ? { ...emp, ...data } : emp)
      );
    }
  }

  async function handleDeleteEmployee(id) {
    // Direct fetch call #6
    const response = await fetch(`/api/employees?id=${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      setEmployees(prev => prev.filter(emp => emp.id !== id));
    }
  }

  return (
    // ... component JSX
  );
}
```

## After Migration

Same component using `apiFetch`:

```typescript
// app/employees/page.tsx - AFTER

"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api-client';  // ← ADD THIS IMPORT

export default function EmployeesPage() {
  const { token } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    async function loadData() {
      // apiFetch call #1 - Same API, different function
      const employeesResponse = await apiFetch('/api/employees', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const employeesData = await employeesResponse.json();
      setEmployees(employeesData);

      // apiFetch call #2
      const groupsResponse = await apiFetch('/api/groups', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const groupsData = await groupsResponse.json();
      setGroups(groupsData);
    }

    if (token) {
      loadData();
    }
  }, [token]);

  async function handleCreateEmployee(data) {
    // apiFetch call #3 - POST request
    const response = await apiFetch('/api/employees', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      // Refresh list
      // apiFetch call #4
      const employeesResponse = await apiFetch('/api/employees', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const employeesData = await employeesResponse.json();
      setEmployees(employeesData);
    }
  }

  async function handleUpdateEmployee(id, data) {
    // apiFetch call #5 - PUT request
    const response = await apiFetch('/api/employees', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ id, ...data })
    });

    if (response.ok) {
      // Update in place
      setEmployees(prev =>
        prev.map(emp => emp.id === id ? { ...emp, ...data } : emp)
      );
    }
  }

  async function handleDeleteEmployee(id) {
    // apiFetch call #6 - DELETE with query params
    const response = await apiFetch(`/api/employees?id=${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      setEmployees(prev => prev.filter(emp => emp.id !== id));
    }
  }

  return (
    // ... component JSX (unchanged)
  );
}
```

## What Changed?

### Import Added

```typescript
import { apiFetch } from '@/lib/api-client';
```

### Function Calls Changed

Replace all instances of:
```typescript
fetch('/api/...')
```

With:
```typescript
apiFetch('/api/...')
```

**That's it!** The rest of the code remains identical:
- Same request options (method, headers, body)
- Same response handling
- Same error handling
- Same async/await patterns

## Advanced Example: Using getApiUrl

For cases where you need the URL but want to use a different fetch library:

```typescript
import { getApiUrl } from '@/lib/api-client';
import axios from 'axios';  // Example: using axios instead of fetch

async function loadEmployees() {
  const url = getApiUrl('/api/employees');

  // Use with axios
  const response = await axios.get(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  return response.data;
}
```

## Migration Checklist

For each component/file that makes API calls:

- [ ] Import `apiFetch` from `@/lib/api-client`
- [ ] Find all `fetch('/api/...)` calls
- [ ] Replace `fetch` with `apiFetch`
- [ ] Verify the code still compiles (TypeScript)
- [ ] Test the functionality

## Find Files to Migrate

Use grep to find all files with API fetch calls:

```bash
# Windows (Git Bash or WSL)
grep -r "fetch('/api" app/ --include="*.tsx" --include="*.ts"

# Or using PowerShell
Get-ChildItem -Path app -Recurse -Include *.tsx,*.ts | Select-String "fetch\('/api"
```

## Benefits After Migration

1. **Works with Remote Servers**: Client can point to a different server via `brandURI`
2. **No Code Changes**: Switching between local and remote doesn't require code changes
3. **Consistent**: All API calls use the same pattern
4. **Future-Proof**: Easy to add features like retry logic, authentication refresh, etc.

## Common Patterns

### Pattern 1: GET Request

```typescript
// Before
const response = await fetch('/api/employees', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// After
const response = await apiFetch('/api/employees', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### Pattern 2: POST Request

```typescript
// Before
const response = await fetch('/api/employees', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(data)
});

// After
const response = await apiFetch('/api/employees', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(data)
});
```

### Pattern 3: DELETE with Query Params

```typescript
// Before
const response = await fetch(`/api/employees?id=${id}`, {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${token}` }
});

// After
const response = await apiFetch(`/api/employees?id=${id}`, {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### Pattern 4: Error Handling

```typescript
// Before and After - No change!
try {
  const response = await apiFetch('/api/employees', { /* ... */ });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  // ... use data
} catch (error) {
  console.error('Failed to fetch employees:', error);
}
```

## Testing Migration

After migrating a component:

1. **Test with Empty brandURI** (local mode):
   ```bash
   # In brand-features.json: "brandURI": ""
   npm run select-brand
   npm run build
   npm run start
   # Test all CRUD operations
   ```

2. **Test with Remote brandURI**:
   ```bash
   # In brand-features.json: "brandURI": "http://server-ip:6029"
   npm run select-brand
   npm run build
   # Deploy client separately
   # Test all CRUD operations
   # Check browser Network tab - should show full URLs
   ```

## Gradual Migration

You don't need to migrate everything at once:

1. **Start with One Component**: Pick a simple component and migrate it
2. **Test Thoroughly**: Ensure it works in both local and remote modes
3. **Continue Component by Component**: Migrate others one at a time
4. **Track Progress**: Keep a list of migrated vs. pending components

The old `fetch` calls will continue to work in local mode. Migration is only required when you need remote server support.

## Questions?

See [BRAND-URI-CONFIGURATION.md](BRAND-URI-CONFIGURATION.md) for more details on:
- How brandURI configuration works
- Build process details
- Troubleshooting
- Deployment scenarios
