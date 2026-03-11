import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = path.resolve(process.cwd(), 'src');

const ALLOWED_IMPORTERS = new Set([
  'services/runChecksService.test.ts',
  'services/runChecksService.usageGuard.test.ts',
]);

function toPosix(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      return;
    }

    if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      files.push(fullPath);
    }
  });

  return files;
}

function importsRunChecksService(source: string): boolean {
  const patterns = [
    /from\s+['"]@\/services\/runChecksService['"]/,
    /import\s*\(\s*['"]@\/services\/runChecksService['"]\s*\)/,
    /from\s+['"][.]{1,2}\/[^'"]*runChecksService(?:\.[^'"]+)?['"]/,
    /import\s*\(\s*['"][.]{1,2}\/[^'"]*runChecksService(?:\.[^'"]+)?['"]\s*\)/,
  ];
  return patterns.some((pattern) => pattern.test(source));
}

describe('runChecksService usage guard', () => {
  it('prevents new imports outside approved legacy files', () => {
    const sourceFiles = listSourceFiles(SRC_ROOT);
    const violations: string[] = [];

    sourceFiles.forEach((filePath) => {
      const relativePath = toPosix(path.relative(SRC_ROOT, filePath));

      if (relativePath === 'services/runChecksService.ts') return;
      if (ALLOWED_IMPORTERS.has(relativePath)) return;

      const source = readFileSync(filePath, 'utf8');
      if (importsRunChecksService(source)) {
        violations.push(relativePath);
      }
    });

    expect(violations).toEqual([]);
  });
});
