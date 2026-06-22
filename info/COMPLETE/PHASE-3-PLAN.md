# Phase 3: Multiple Attendance Entries Per Day

## Overview

Phase 3 enhances the attendance tracking system to support multiple time entries for a single employee on the same day. This addresses real-world scenarios where employees need to track different time codes within the same day (e.g., working morning hours + taking PTO in the afternoon).

## Current Limitations

- **Single Entry Per Day**: The UI only displays and edits one attendance entry per employee per day
- **Data Loss**: If multiple entries exist in the database for the same date, only one is shown
- **Limited Use Cases**: Cannot track split days (e.g., 4 hours work + 4 hours vacation)

## Phase 3 Goals

### 1. Grid Display Enhancement
- Show time code for single-entry days: `FH` or `V (8)`
- Show total hours for multi-entry days: `*8.0` or `*7.5`
- Visual indicator that clicking will show multiple entries
- Preserve notes indicator (blue dot) when any entry has notes

### 2. Multi-Entry Dialog
- Display all entries for the selected date
- Add new entries for the same date
- Edit existing entries (time code, hours, notes)
- Delete individual entries
- Show running total of hours for the day
- Prevent saving if total exceeds 24 hours

### 3. Data Handling
- Support unlimited entries per employee per day
- Preserve all existing single-entry functionality
- Maintain data integrity with proper validation
- Update balance cards to accurately reflect multi-entry totals

## Technical Implementation

### Database Schema
✅ **No changes required** - The current schema already supports multiple entries:
```sql
CREATE TABLE attendance_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  entry_date DATE NOT NULL,
  time_code TEXT NOT NULL,
  hours REAL NOT NULL DEFAULT 0,
  notes TEXT,
  -- No unique constraint on (employee_id, entry_date)
);
```

### Component Changes

#### 1. `attendance-grid.tsx`
**Current**: Stores entries in `Map<date, entry>` (one entry per date)
```typescript
const [localEntries, setLocalEntries] = useState<Map<string, { time_code: string; hours: number; notes: string }>>(...)
```

**New**: Store entries as `Map<date, entry[]>` (array of entries per date)
```typescript
const [localEntries, setLocalEntries] = useState<Map<string, AttendanceEntry[]>>(...)
```

**Display Logic**:
- Single entry: Show `{timeCode} ({hours})` or just `{timeCode}` if hours = 8
- Multiple entries: Show `*{totalHours}`
- Notes indicator: Show if any entry has notes

#### 2. `entry-edit-dialog.tsx` → `multi-entry-dialog.tsx`
Create new dialog component that:
- Accepts `entries: AttendanceEntry[]` instead of single entry props
- Shows list of entries for the date
- Has "Add Entry" button to create additional entries
- Each entry has edit/delete controls
- Shows running total at bottom
- Validates total hours ≤ 24

**Layout**:
```
┌─────────────────────────────────────┐
│ Edit Entries for 2026-03-15         │
├─────────────────────────────────────┤
│ Entry 1                             │
│ Time Code: [FH ▼]                   │
│ Hours: [- 4 +]  Min: [- 0 +]       │
│ Notes: [____________]               │
│ [Delete Entry]                      │
├─────────────────────────────────────┤
│ Entry 2                             │
│ Time Code: [V ▼]                    │
│ Hours: [- 4 +]  Min: [- 0 +]       │
│ Notes: [____________]               │
│ [Delete Entry]                      │
├─────────────────────────────────────┤
│ [+ Add Another Entry]               │
├─────────────────────────────────────┤
│ Total Hours: 8.0                    │
├─────────────────────────────────────┤
│ [Cancel]  [Save All Changes]        │
└─────────────────────────────────────┘
```

#### 3. `attendance/page.tsx`
Update `handleEntryChange` to support multiple entries:
- Change from single entry update to batch update
- Send all entries for a date to API
- Handle API response for multiple entries

### API Changes

#### `POST /api/attendance`
**Current**: Upserts single entry or deletes by date
```json
{
  "employee_id": 1,
  "entry_date": "2026-03-15",
  "time_code": "V",
  "hours": 8,
  "notes": ""
}
```

**New**: Support batch operations
```json
{
  "action": "update_day",
  "employee_id": 1,
  "entry_date": "2026-03-15",
  "entries": [
    { "time_code": "V", "hours": 4, "notes": "" },
    { "time_code": "FH", "hours": 4, "notes": "afternoon" }
  ]
}
```

**Behavior**:
1. Delete all existing entries for employee + date
2. Insert all new entries from array
3. Validates total hours ≤ 24
4. Returns updated entries for the date

#### `GET /api/attendance`
✅ **No changes required** - Already returns all entries as array

### Balance Card Updates
✅ **No changes required** - Balance calculations already sum all entries regardless of how many exist per day

## User Experience

### Single Entry Day (Existing Behavior)
1. Click cell showing `V (8)`
2. Dialog opens with single entry
3. Can edit time code, hours, notes
4. Can delete by selecting "__NONE__"
5. Save updates the single entry

### Multiple Entry Day (New Behavior)
1. Click cell showing `*8.0`
2. Dialog opens showing list of 2+ entries
3. Can edit any entry's time code, hours, notes
4. Can delete individual entries
5. Can add new entries with "+ Add Another Entry"
6. Running total shows at bottom
7. Save button disabled if total > 24 hours
8. Save updates all entries for that date

### Validation Rules
- ✅ Total hours for a day cannot exceed 24
- ✅ Each entry must have a valid time code
- ✅ Each entry must have hours > 0
- ✅ Time codes can be reused in the same day (e.g., two "V" entries)
- ✅ Notes are optional for each entry

## Testing Requirements

### Unit Tests
- Grid displays "*total" for multiple entries
- Grid displays time code for single entry
- Multi-entry dialog calculates total correctly
- Validation prevents >24 hours per day
- Deleting all entries clears the cell

### Integration Tests
- Create multiple entries for same date
- Edit multiple entries and save
- Delete individual entries
- Add entries to existing date
- Switch between single and multi-entry days

### Edge Cases
- Empty day (no entries)
- Single entry with 0 hours
- Maximum 24 hours across multiple entries
- Entry with notes indicator
- Rapid clicking on cells with multiple entries

## Migration Strategy

✅ **No database migration required** - Existing schema supports feature

**Code Migration**:
1. Update grid component to handle entry arrays
2. Create multi-entry dialog component
3. Update API endpoint for batch operations
4. Maintain backward compatibility with single-entry saves
5. Update TypeScript interfaces

## Success Criteria

- ✅ Users can create multiple attendance entries for the same day
- ✅ Grid clearly distinguishes single vs multi-entry days
- ✅ Total hours validation prevents data entry errors
- ✅ All existing single-entry functionality preserved
- ✅ Balance cards accurately reflect multi-entry totals
- ✅ No performance degradation with multiple entries

## Future Enhancements (Phase 4+)

- Bulk copy entries across multiple days
- Templates for common split-day patterns
- Quick-add buttons for common combinations (4h work + 4h PTO)
- Calendar view showing multi-entry days differently
- Reporting improvements for multi-entry analysis

## Timeline Estimate

- **Grid Updates**: 2-3 hours
- **Multi-Entry Dialog**: 4-6 hours
- **API Updates**: 2-3 hours
- **Testing**: 3-4 hours
- **Documentation**: 1-2 hours

**Total**: 12-18 hours (~2-3 days)
