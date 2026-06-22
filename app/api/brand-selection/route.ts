import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/brand-selection
 * Returns the currently selected brand from lib/brand-selection.json
 */
export async function GET() {
  try {
    const brandSelectionPath = path.join(process.cwd(), 'lib', 'brand-selection.json');

    if (!fs.existsSync(brandSelectionPath)) {
      return NextResponse.json({ brand: 'Default', selectedAt: null });
    }

    const data = JSON.parse(fs.readFileSync(brandSelectionPath, 'utf8'));
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reading brand selection:', error);
    return NextResponse.json({ brand: 'Default', selectedAt: null });
  }
}
