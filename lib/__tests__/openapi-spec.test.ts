import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { openApiSpec } from '../openapi';

/**
 * Keeps lib/openapi.ts in sync with the actual route handlers:
 * every app/api route+method must be documented in the spec, and the
 * spec must not document endpoints that no longer exist.
 */

const API_DIR = path.resolve(__dirname, '../../app/api');
const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'] as const;

function findRouteFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findRouteFiles(full));
    } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
      files.push(full);
    }
  }
  return files;
}

/** app/api/backup/[id]/route.ts -> /api/backup/{id} */
function routeFileToApiPath(file: string): string {
  const rel = path.relative(API_DIR, path.dirname(file));
  const segments = rel === '' ? [] : rel.split(path.sep);
  const converted = segments.map((s) =>
    s.startsWith('[') && s.endsWith(']') ? `{${s.slice(1, -1)}}` : s
  );
  return ['/api', ...converted].join('/');
}

function exportedMethods(file: string): string[] {
  const source = fs.readFileSync(file, 'utf-8');
  const methods: string[] = [];
  for (const method of HTTP_METHODS) {
    const re = new RegExp(`export\\s+async\\s+function\\s+${method.toUpperCase()}\\b`);
    if (re.test(source)) methods.push(method);
  }
  return methods;
}

function collectActual(): Map<string, string[]> {
  const actual = new Map<string, string[]>();
  for (const file of findRouteFiles(API_DIR)) {
    actual.set(routeFileToApiPath(file), exportedMethods(file).sort());
  }
  return actual;
}

function collectDocumented(): Map<string, string[]> {
  const documented = new Map<string, string[]>();
  for (const [specPath, operations] of Object.entries(openApiSpec.paths)) {
    const methods = Object.keys(operations as object).filter((k) =>
      (HTTP_METHODS as readonly string[]).includes(k)
    );
    documented.set(specPath, methods.sort());
  }
  return documented;
}

describe('OpenAPI spec stays in sync with app/api routes', () => {
  const actual = collectActual();
  const documented = collectDocumented();

  it('documents every route handler on disk', () => {
    const missing: string[] = [];
    for (const [apiPath, methods] of actual) {
      const specMethods = documented.get(apiPath);
      if (!specMethods) {
        missing.push(`${apiPath} (entire path missing from lib/openapi.ts)`);
        continue;
      }
      for (const method of methods) {
        if (!specMethods.includes(method)) {
          missing.push(`${method.toUpperCase()} ${apiPath}`);
        }
      }
    }
    expect(missing, `Undocumented endpoints — add them to lib/openapi.ts:\n${missing.join('\n')}`).toEqual([]);
  });

  it('does not document endpoints that no longer exist', () => {
    const stale: string[] = [];
    for (const [specPath, methods] of documented) {
      const actualMethods = actual.get(specPath);
      if (!actualMethods) {
        stale.push(`${specPath} (no route file on disk)`);
        continue;
      }
      for (const method of methods) {
        if (!actualMethods.includes(method)) {
          stale.push(`${method.toUpperCase()} ${specPath}`);
        }
      }
    }
    expect(stale, `Stale spec entries — remove them from lib/openapi.ts:\n${stale.join('\n')}`).toEqual([]);
  });

  it('every operation has a tag and a summary', () => {
    const problems: string[] = [];
    for (const [specPath, operations] of Object.entries(openApiSpec.paths)) {
      for (const [method, op] of Object.entries(operations as Record<string, any>)) {
        if (!(HTTP_METHODS as readonly string[]).includes(method)) continue;
        if (!op.summary) problems.push(`${method.toUpperCase()} ${specPath}: missing summary`);
        if (!op.tags?.length) problems.push(`${method.toUpperCase()} ${specPath}: missing tags`);
      }
    }
    expect(problems).toEqual([]);
  });
});
