# Phase 6: Interactive Contextual Help System

## Overview

Phase 6 implements a comprehensive contextual help system with modal overlays and interactive tooltips that guide users through each screen. The system provides on-demand help bubbles that explain what each section does, how to use it, and how to update data.

## Goals

### 1. Screen-Level Help Overlays
- ✅ Modal overlay for each major screen (Attendance, Employees, Users, etc.)
- ✅ Highlight important UI sections with animated borders
- ✅ Sequential walkthrough mode for new users
- ✅ Dismissable and can be re-accessed anytime
- ✅ Remember which screens user has seen help for

### 2. Interactive Help Bubbles
- ✅ Hover tooltips on mouse-over for each section
- ✅ Clear, concise explanations (50-100 words max)
- ✅ Three types of info: "What it is", "How to use", "How to update"
- ✅ Positioned intelligently to avoid blocking content
- ✅ Keyboard accessible (Tab navigation)

### 3. Help Management
- ✅ Toggle help mode on/off
- ✅ Help icon/button in navbar
- ✅ "Don't show again" option per screen
- ✅ Reset help progress option
- ✅ Admin ability to edit help content

### 4. User Onboarding
- ✅ First-time user welcome tour
- ✅ Progressive disclosure of features
- ✅ Task completion tracking
- ✅ "Getting Started" checklist

## User Experience Flow

### Help Button in Navbar
```
┌─────────────────────────────────────────┐
│ Attendance | Employees | Dashboard | ? │
└─────────────────────────────────────────┘
                                         ↑
                                    Help button
                                    (shows ? icon)
```

### When Help Mode Activated
```
┌─────────────────────────────────────────┐
│        Attendance Tracking              │
│  ┌───────────────────────────────────┐  │
│  │ ℹ Employee Selector               │  │
│  │ Select which employee's attendance│  │
│  │ you want to view or edit. You can │  │
│  │ search by name or number.         │  │
│  └───────────────────────────────────┘  │
│  [Employee Dropdown] ▼                   │
│                                          │
│  ┌───────────────────────────────────┐  │
│  │ ℹ Attendance Grid                 │  │
│  │ Click any date cell to add or edit│  │
│  │ time entries. Multiple entries per│  │
│  │ day show as *totalHours.          │  │
│  └───────────────────────────────────┘  │
│  [Calendar Grid with tooltips]          │
└─────────────────────────────────────────┘
```

### Help Bubble Structure
```
┌────────────────────────────────────┐
│ ℹ Employee Selector                │
├────────────────────────────────────┤
│ What it is:                        │
│ Select the employee whose          │
│ attendance you want to manage.     │
│                                    │
│ How to use:                        │
│ Click the dropdown to see all      │
│ employees you have access to.      │
│                                    │
│ How to update:                     │
│ Go to Employees tab to add new     │
│ employees or modify existing ones. │
└────────────────────────────────────┘
```

## Technical Architecture

### Help Content Structure

```typescript
interface HelpContent {
  id: string;
  screen: string; // 'attendance', 'employees', 'users', etc.
  section: string; // 'employee-selector', 'attendance-grid', etc.
  title: string;
  whatItIs: string;
  howToUse: string;
  howToUpdate: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  highlightSelector?: string; // CSS selector for element to highlight
  order?: number; // For walkthrough sequence
}
```

### Help Content Database/Storage

```typescript
// Option 1: Static JSON file (simpler)
const helpContent: HelpContent[] = [
  {
    id: 'attendance-employee-selector',
    screen: 'attendance',
    section: 'employee-selector',
    title: 'Employee Selector',
    whatItIs: 'Select which employee\'s attendance you want to view or edit.',
    howToUse: 'Click the dropdown to see all employees you have permission to access.',
    howToUpdate: 'Go to the Employees tab to add new employees or modify existing ones.',
    position: 'bottom',
    highlightSelector: '[data-help-id="employee-selector"]',
    order: 1,
  },
  {
    id: 'attendance-grid',
    screen: 'attendance',
    section: 'attendance-grid',
    title: 'Attendance Calendar',
    whatItIs: 'A calendar grid showing all time entries for the selected employee.',
    howToUse: 'Click any date cell to add or edit time entries. Single entries show the time code, multiple entries show *totalHours.',
    howToUpdate: 'Click a cell, then add/edit/delete entries in the dialog that appears.',
    position: 'top',
    highlightSelector: '[data-help-id="attendance-grid"]',
    order: 2,
  },
  // ... more help items
];

// Option 2: Database table (more flexible, allows admin editing)
CREATE TABLE help_content (
  id TEXT PRIMARY KEY,
  screen TEXT NOT NULL,
  section TEXT NOT NULL,
  title TEXT NOT NULL,
  what_it_is TEXT NOT NULL,
  how_to_use TEXT NOT NULL,
  how_to_update TEXT NOT NULL,
  position TEXT DEFAULT 'auto',
  highlight_selector TEXT,
  display_order INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### User Help Progress Tracking

```typescript
interface UserHelpProgress {
  user_id: number;
  screen: string;
  has_seen: boolean;
  dont_show_again: boolean;
  last_viewed_at: string;
}

// Database table
CREATE TABLE user_help_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  screen TEXT NOT NULL,
  has_seen INTEGER DEFAULT 0,
  dont_show_again INTEGER DEFAULT 0,
  last_viewed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, screen)
);
```

## Components Architecture

### 1. Help Provider Context (`lib/help-context.tsx`)

```typescript
interface HelpContextType {
  isHelpMode: boolean;
  toggleHelpMode: () => void;
  currentScreen: string;
  setCurrentScreen: (screen: string) => void;
  getHelpForSection: (sectionId: string) => HelpContent | null;
  markScreenAsSeen: (screen: string) => Promise<void>;
  shouldShowWelcome: boolean;
}

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [isHelpMode, setIsHelpMode] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('');
  // ... context logic
}
```

### 2. Help Button Component (`components/help-button.tsx`)

```typescript
export function HelpButton() {
  const { isHelpMode, toggleHelpMode } = useHelp();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleHelpMode}
      className={isHelpMode ? 'bg-blue-100' : ''}
      title="Toggle Help Mode"
    >
      <HelpCircle className="h-5 w-5" />
      {isHelpMode && <span className="ml-2">Help Mode On</span>}
    </Button>
  );
}
```

### 3. Help Bubble Component (`components/help-bubble.tsx`)

```typescript
interface HelpBubbleProps {
  content: HelpContent;
  targetRef: React.RefObject<HTMLElement>;
  isVisible: boolean;
  onClose?: () => void;
}

export function HelpBubble({ content, targetRef, isVisible, onClose }: HelpBubbleProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    // Calculate optimal position based on targetRef and viewport
    if (targetRef.current && isVisible) {
      const rect = targetRef.current.getBoundingClientRect();
      // Position bubble to not overlap with target element
      setPosition(calculateOptimalPosition(rect, content.position));
    }
  }, [targetRef, isVisible, content.position]);

  if (!isVisible) return null;

  return (
    <div
      className="absolute z-50 max-w-sm bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-4"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-500" />
          {content.title}
        </h3>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <p className="font-medium text-gray-700 dark:text-gray-300">What it is:</p>
          <p className="text-gray-600 dark:text-gray-400">{content.whatItIs}</p>
        </div>

        <div>
          <p className="font-medium text-gray-700 dark:text-gray-300">How to use:</p>
          <p className="text-gray-600 dark:text-gray-400">{content.howToUse}</p>
        </div>

        <div>
          <p className="font-medium text-gray-700 dark:text-gray-300">How to update:</p>
          <p className="text-gray-600 dark:text-gray-400">{content.howToUpdate}</p>
        </div>
      </div>
    </div>
  );
}
```

### 4. Help Area Wrapper (`components/help-area.tsx`)

```typescript
interface HelpAreaProps {
  helpId: string;
  children: React.ReactNode;
  className?: string;
}

export function HelpArea({ helpId, children, className }: HelpAreaProps) {
  const { isHelpMode, getHelpForSection } = useHelp();
  const [showBubble, setShowBubble] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const helpContent = getHelpForSection(helpId);

  return (
    <div
      ref={ref}
      data-help-id={helpId}
      className={cn(
        className,
        isHelpMode && 'relative ring-2 ring-blue-500 ring-offset-2 rounded cursor-help'
      )}
      onMouseEnter={() => isHelpMode && setShowBubble(true)}
      onMouseLeave={() => setShowBubble(false)}
    >
      {children}
      {helpContent && (
        <HelpBubble
          content={helpContent}
          targetRef={ref}
          isVisible={showBubble}
        />
      )}
    </div>
  );
}
```

### 5. Welcome Tour Component (`components/welcome-tour.tsx`)

```typescript
export function WelcomeTour() {
  const { shouldShowWelcome, currentScreen } = useHelp();
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(shouldShowWelcome);

  const tourSteps = [
    {
      title: 'Welcome to Multi-User Attendance!',
      description: 'Let\'s take a quick tour of the key features.',
      screen: null,
    },
    {
      title: 'Attendance Tracking',
      description: 'Track time entries for all employees with an intuitive calendar interface.',
      screen: 'attendance',
      highlight: 'attendance-grid',
    },
    {
      title: 'Employee Management',
      description: 'Add and manage employee records and their time allocations.',
      screen: 'employees',
      highlight: 'employee-list',
    },
    // ... more steps
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tourSteps[currentStep].title}</DialogTitle>
        </DialogHeader>
        <p>{tourSteps[currentStep].description}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Skip Tour
          </Button>
          <Button onClick={() => setCurrentStep(currentStep + 1)}>
            {currentStep < tourSteps.length - 1 ? 'Next' : 'Finish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## Implementation Per Screen

### Attendance Screen
```typescript
<div className="min-h-screen p-3">
  <div className="max-w-full mx-auto space-y-2">
    <HelpArea helpId="attendance-header">
      <h1 className="text-xl font-bold">Attendance</h1>
    </HelpArea>

    <HelpArea helpId="attendance-employee-selector">
      <div className="flex flex-wrap items-end gap-2 p-2 border rounded-lg bg-card">
        <Label htmlFor="employee">Employee</Label>
        <Select>
          {/* ... */}
        </Select>
      </div>
    </HelpArea>

    <HelpArea helpId="attendance-grid">
      <AttendanceGrid
        year={year}
        employeeId={selectedEmployeeId}
        entries={entries}
        timeCodes={timeCodes}
        onEntryChange={handleEntryChange}
      />
    </HelpArea>

    <HelpArea helpId="attendance-balance-cards">
      <BalanceCards entries={entries} allocations={allocations} />
    </HelpArea>
  </div>
</div>
```

## Help Content Examples

### Attendance Screen

| Section | What it is | How to use | How to update |
|---------|-----------|------------|---------------|
| **Employee Selector** | Dropdown to choose which employee's attendance to view | Click the dropdown and select an employee from the list | Go to Employees tab to add new employees |
| **Year Selector** | Choose which year's attendance to display | Click the year dropdown to select a different year | Calendar automatically shows selected year |
| **Attendance Grid** | Calendar showing all time entries for the employee | Click any date cell to add or edit time entries. Single entries show time code (V 8), multiple entries show *totalHours (*8.5) | Click a cell to open the entry dialog where you can add, edit, or delete entries |
| **Balance Cards** | Shows used vs allocated hours for limited time codes | View remaining hours for Vacation, Floating Holidays, etc. | Balances update automatically as you add entries. Allocations can be customized per employee in Employees tab |
| **Time Code Legend** | Reference list of all available time codes | Use this to understand what each time code abbreviation means | Contact your administrator to add or modify time codes |

### Employees Screen

| Section | What it is | How to use | How to update |
|---------|-----------|------------|---------------|
| **Employee List** | Table of all employees you have access to | Browse, search, and select employees to view details | Click "Add Employee" or click edit icon on an employee |
| **Add Employee Button** | Create a new employee record | Click to open a form for entering new employee information | Fill out required fields (name, group) and save |
| **Employee Groups** | Filter employees by their assigned group | Click a group badge to filter the list | Groups are managed by administrators in the Groups settings |
| **Time Allocations** | Custom time-off hours per employee per year | Click the clock icon next to an employee to set custom allocations | Enter custom hours or use defaults, changes take effect immediately |

### Users Screen (Superuser Only)

| Section | What it is | How to use | How to update |
|---------|-----------|------------|---------------|
| **User List** | All system users who can log in | View all user accounts and their permissions | Click "Add User" or edit icon to modify |
| **Superuser Badge** | Indicates users with full system access | Superusers bypass all permission checks and can manage everything | Toggle superuser checkbox when creating/editing users |
| **Group Permissions** | Per-user per-group CRUD access controls | Click shield icon to manage which groups a user can access | Check/uncheck Create, Read, Update, Delete permissions per group |

## API Endpoints

- `GET /api/help/content` - Get all help content for current screen
- `GET /api/help/content/:screen` - Get help content for specific screen
- `POST /api/help/progress` - Mark screen as seen
- `PUT /api/help/progress` - Update "don't show again" preference
- `GET /api/help/progress` - Get user's help progress
- `POST /api/help/reset` - Reset user's help progress (start over)

### Admin Endpoints (Superuser only)
- `PUT /api/help/content/:id` - Update help content text
- `POST /api/help/content` - Add new help content
- `DELETE /api/help/content/:id` - Remove help content

## Configuration

```env
# Help system settings
HELP_ENABLED=true
HELP_SHOW_WELCOME_TOUR=true
HELP_AUTO_SHOW_NEW_SCREENS=false
```

## UI/UX Guidelines

### Visual Design
- **Help bubbles**: White background with blue accent border
- **Highlight color**: Blue ring (ring-blue-500)
- **Icon**: Info circle (ℹ) in blue
- **Animation**: Fade in/out, subtle pulse on highlighted areas
- **Z-index**: Above all content but below modals

### Interaction Patterns
- **Hover delay**: 300ms before showing bubble
- **Auto-hide**: Bubble stays visible while cursor over target or bubble
- **Keyboard**: Tab through help areas when help mode active
- **Mobile**: Tap to toggle help bubble instead of hover

### Content Guidelines
- **Brevity**: Keep each section under 100 words
- **Active voice**: "Click the button" not "The button can be clicked"
- **No jargon**: Use simple, clear language
- **Consistent structure**: Always include all three sections (What/How/Update)

## Implementation Steps

### Phase 6.1: Core Help System ✅ COMPLETE
1. ✅ Created help content structure with brand-specific JSON (`public/{brand}/help-content.json`)
2. ✅ Implemented HelpProvider context (`lib/help-context.tsx`)
3. ✅ Built HelpArea component with Radix UI Popover for viewport collision detection
4. ✅ Help bubbles appear on hover (no click required)
5. ✅ Added Help toggle button to navbar
6. ✅ API endpoint for brand selection (`/api/brand-selection`)

### Phase 6.2: Screen Integration ✅ COMPLETE
1. ✅ Attendance screen - employee selector, year selector, attendance grid labels
2. ✅ Attendance dialog - time code, time, notes labels in multi-entry-dialog
3. ✅ Employees screen - action buttons (add, edit, allocations, delete)
4. ✅ Users screen - action buttons (add, edit, permissions, delete)
5. ✅ Dashboard screen - stats cards, time code usage, employee summary, recent entries
6. ✅ Settings screen - color mode, layout theme labels
7. ✅ Reports screen - filters, generate/export buttons, results table
8. ✅ All help content written in `public/TRL/help-content.json`

### Phase 6.3: Progress Tracking (Partial)
1. ⏳ Using localStorage instead of database table for simplicity
2. ✅ Help mode toggle state management
3. ✅ "Don't show again" option available in context
4. ✅ Reset help progress option in context
5. ✅ Per-screen tracking via currentScreen state

### Phase 6.4: Welcome Tour (Removed)
Removed from scope - in-person training and contextual help system are sufficient.

### Phase 6.10: Attendance Page Employee Values Display ✅ COMPLETE
Explain how the attendance page values next to employees are calculated/generated.

1. ✅ Add help content explaining employee totals calculation
2. ✅ Document how hours are summed and displayed

**Implementation:**
- Updated `attendance-balance-cards` help entry with detailed calculation explanation
- Added new help entries for each balance card type:
  - `balance-floating-holiday` - Explains quarterly accrual (NFL: 8h/quarter, 24h max, 1-year eligibility)
  - `balance-personal-sick` - Explains hours-worked accrual (1h per 30h worked, 80h max)
  - `balance-vacation` - Explains tiered seniority system (40h-200h based on years of service)
  - `balance-holiday` - Explains usage-only tracking (no allocation limit)
- Help content added to both NFL and TRL brands

### Phase 6.5: Admin Features (Partial)
1. ✅ Brand-specific JSON files allow per-brand customization
2. ⏳ In-place editing UI not implemented
3. ⏳ Preview mode not implemented
4. ⏳ Help content validation not implemented

### Phase 6.8: Groups Management ✅ COMPLETE
Super admins can manage employee groups directly from the Settings page.

**Purpose:**
- Allow super admins to create, edit, and delete groups without database access
- Centralize group management in the UI
- Configure group-level permissions (can_view_all, can_edit_all)

**Implementation:**
1. ✅ Created `GroupManagement` component (`components/group-management.tsx`)
   - DataTable listing all groups with columns: Name, Description, Permissions, Actions
   - Add Group dialog with name, description, permission toggles
   - Edit Group dialog (pre-filled form)
   - Delete Group with confirmation (warn if group has employees)
2. ✅ Added Groups section to Settings page (super admin only)
3. ✅ DELETE endpoint in `/api/groups` route
4. ✅ Add help content for Groups management section
5. ✅ Audit logging for all group CRUD operations

**UI Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Groups Management                            [+ Add Group]  │
├─────────────────────────────────────────────────────────────┤
│ Name         │ Description      │ View All │ Edit All │     │
├──────────────┼──────────────────┼──────────┼──────────┼─────┤
│ Master       │ Full system...   │    ✓     │    ✓     │ ✏️🗑️│
│ Production   │ Production team  │    ✗     │    ✗     │ ✏️🗑️│
│ Office       │ Office staff     │    ✓     │    ✗     │ ✏️🗑️│
└─────────────────────────────────────────────────────────────┘
```

### Phase 6.9: Job Titles Management ✅ COMPLETE
Super admins can define and manage job titles that can be assigned to employees.

**Purpose:**
- Replace free-text role field with standardized job titles
- Enable filtering and reporting by job title
- Support job title-based policy rules in future phases

**Implementation:**
1. ✅ Created `job_titles` table in auth.db (in `lib/db-auth.ts`)
2. ✅ Migration `005_seed_job_titles.ts` seeds 17 default job titles on server start
3. ✅ Created `/api/job-titles` endpoint (GET, POST, PUT, DELETE)
4. ✅ Created `JobTitleManagement` component (`components/job-title-management.tsx`)
   - DataTable listing all job titles: Name, Description, Status, Actions
   - Add Job Title dialog
   - Edit Job Title dialog
   - Delete Job Title with confirmation
5. ✅ Added Job Titles section to Settings page (super admin only)
6. ✅ Updated Employee forms to use job title dropdown fetched from API
7. ✅ Add help content for Job Titles management section
8. ⏳ Future: Add `job_title_id` foreign key column to employees table (currently uses name string)

**UI Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Job Titles                                [+ Add Job Title] │
├─────────────────────────────────────────────────────────────┤
│ Title            │ Description              │ Status │      │
├──────────────────┼──────────────────────────┼────────┼──────┤
│ Operator         │ Machine operator         │ Active │ ✏️🗑️ │
│ Supervisor       │ Team supervisor          │ Active │ ✏️🗑️ │
│ Manager          │ Department manager       │ Active │ ✏️🗑️ │
│ Office Admin     │ Administrative staff     │ Active │ ✏️🗑️ │
└─────────────────────────────────────────────────────────────┘
```

**Settings Page Layout (Super Admin View):**
```
┌─────────────────────────────────────────────────────────────┐
│ Settings                                                     │
├─────────────────────────────────────────────────────────────┤
│ ┌─── Appearance ────────────────────────────────────────┐   │
│ │ Color Mode: [Light ▼]                                  │   │
│ │ Layout Theme: [Default ▼]  (Admin Only)               │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌─── Groups Management ─────────────────────────────────┐   │
│ │ [DataTable with groups...]                             │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌─── Job Titles ────────────────────────────────────────┐   │
│ │ [DataTable with job titles...]                         │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌─── Database Backups ──────────────────────────────────┐   │
│ │ [Backup controls...]                                   │   │
│ └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Testing Strategy

- Content accuracy for all screens
- Bubble positioning on different screen sizes
- Hover/click interactions
- Keyboard navigation through help areas
- Mobile touch interactions
- Help mode toggle persistence
- Progress tracking accuracy

## Success Criteria

- ✅ All major screens have comprehensive help content
- ✅ Help bubbles position correctly without blocking content
- ✅ Help mode can be toggled on/off easily
- ✅ New users see welcome tour on first login
- ✅ Help progress tracked per user
- ✅ Reduces support questions by 50%+
- ✅ 90%+ of users find help content useful (survey)

## Timeline Estimate

- **Week 1**: Core help system and components
- **Week 2**: Screen integration and progress tracking
- **Week 3**: Welcome tour and admin features

**Total**: 3 weeks

## Future Enhancements

- Video tutorials embedded in help bubbles
- Interactive demos that walk through actions
- Search functionality for help content
- Help content in multiple languages
- Analytics on which help sections are viewed most
- Tooltips for form field validation
- AI-powered contextual help suggestions

---

## Roadmap: Upcoming Features

### Phase 6.6: Brand-Specific Time Codes ✅ COMPLETE
Move TimeCode abbreviations and names from the database into brand-specific JSON files (`public/{brand}/time-codes.json`). This allows companies to customize time codes for their specific needs without database modifications.

**Benefits:**
- Each brand can define their own time codes (V, S, H, FH, etc.)
- No database migration required for time code changes
- Consistent with brand-specific help content pattern
- Falls back to database if no JSON file exists

**Implementation:**
1. ✅ Created `time-codes.json` structure in brand folders (`public/TRL/time-codes.json`)
2. ✅ Created shared utility `lib/brand-time-codes.ts` for loading brand time codes
3. ✅ Updated `/api/time-codes` to read from JSON with database fallback
4. ✅ Updated `/api/employee-allocations` to use brand time codes for defaults and lookups
5. ✅ Components work without modification (they receive time codes via API)

### Phase 6.7: Balance Breakdown Modals ✅ COMPLETE
Add clickable modals to each balance card on the Attendance page that explain how the available time was calculated.

**Purpose:**
- Show users exactly how their time-off balance was derived
- Display allocation source (default vs. employee override)
- Break down used vs. remaining time with detailed line items
- Help users understand why they have the balance they do

**Implementation:**
1. ✅ Created `BalanceBreakdownModal` component (`components/balance-breakdown-modal.tsx`)
2. ✅ Added click handlers to all four balance cards (FH, PS, V, H)
3. ✅ Modal shows:
   - Allocation source (default or employee override)
   - Summary with total used and remaining
   - Progress bar visualization
   - Detailed usage with entries grouped by month
   - Entry dates and notes
4. ✅ Updated help content to explain clickable cards
5. ✅ Cards have hover state to indicate clickability

#### Phase 6.7.1: Accrual Calculation Engine ✅ COMPLETE
Created a comprehensive accrual calculation engine to explain how leave hours are earned.

**Files Created/Modified:**
- `lib/accrual-calculations.ts` - Core accrual calculation logic
- `lib/brand-time-codes.ts` - Updated `AccrualRuleConfig` interface to support all accrual types
- `public/NFL/brand-features.json` - Brand-specific accrual rules
- `components/balance-cards.tsx` - Added `AccrualDetails` interface for modal data

**Important:** Accrual rule keys in `brand-features.json` must match time code strings in `time-codes.json` (e.g., use `"PS"` not `"PSL"` for Personal Sick).

**Accrual Types Implemented:**

**1. Quarterly Accrual (Floating Holiday - FH)**
```typescript
interface QuarterlyRule {
  type: 'quarterly';
  hoursPerPeriod: number;  // e.g., 8 hours
  maxAnnual: number;       // e.g., 24 hours
  eligibility: { waitPeriod: { years: number } };
  quarters: { Q1, Q2, Q3, Q4 with start/end dates };
}
```

**2. Hours-Worked Accrual (Personal Sick Leave - PS)**
```typescript
interface HoursWorkedRule {
  type: 'hoursWorked';
  accrualRate: { earnHours: 1, perHoursWorked: 30 };
  maxAccrual: 80;
  maxUsage: { hours: 40, days: 5, rule: 'whicheverGreater' };
  period: '12month';
  accrualExclusions: ['paidLeave', 'unpaidLeave'];
  hoursCountedBy: {
    nonexempt: ['straightTime', 'overtime'];
    exemptFullTime: { assumedWeeklyHours: 40, condition: 'anyWorkPerformed' };
    exemptPartTime: 'regularSchedule';
  };
}
```

**3. Tiered Seniority Accrual (Vacation - V)**
```typescript
interface TieredSeniorityRule {
  type: 'tieredSeniority';
  period: { type: 'custom', startMonth: 6, startDay: 1, endMonth: 5, endDay: 31 };
  eligibility: {
    fullTime: { hoursThreshold: 1200, includesHolidayPay: true, ... };
    exempt: { waitPeriod: { months: 6 }, expectedUsage: 80 };
  };
  tiers: [
    { minBaseYears: 0, maxBaseYears: 2, fullTime: { weeks: 1, hours: 40 }, partTime: { earnHours: 1, perHoursWorked: 30, maxHours: 40 } },
    { minBaseYears: 3, maxBaseYears: 4, fullTime: { weeks: 2, hours: 80 }, ... },
    { minBaseYears: 5, maxBaseYears: 7, fullTime: { weeks: 2, hours: 120 }, ... },
    { minBaseYears: 8, maxBaseYears: 14, fullTime: { weeks: 3, hours: 160 }, ... },
    { minBaseYears: 15, maxBaseYears: null, fullTime: { weeks: 4, hours: 200 }, ... }
  ];
}
```

**Balance Breakdown Modal Updates:**
- Modal now displays accrual-specific information based on rule type
- Quarterly: Shows quarters earned, hours per quarter, eligibility status
- Hours-Worked: Shows estimated hours worked, accrual rate, effective max usage
- Tiered Seniority: Shows current tier, years of service, employee type

**Key Interfaces:**
- `VacationTier` - Defines vacation tiers with min/max years and hours
- `TieredSeniorityRule` - Full tiered seniority rule configuration
- `HoursWorkedAccrualDetails` - Details for hours-worked calculations
- `TieredSeniorityAccrualDetails` - Details for tiered seniority calculations
- `AccrualResult` - Standardized return type for all accrual calculations

#### Phase 6.7.2: Leave Types Time Code Mapping ✅ COMPLETE
Added configurable time code mappings to leaveTypes in brand-features.json so balance cards dynamically use the correct time codes.

**Problem Solved:**
Previously, balance-cards.tsx had hardcoded time code abbreviations (e.g., `'FH'`, `'PS'`, `'H'`). When brands updated their time codes in the database (e.g., `FLH` instead of `FH`), the balance cards didn't reflect the correct data.

**Solution:**
Extended the `leaveTypes` configuration in `brand-features.json` to include `timeCode` and `label` properties:

```json
"leaveTypes": {
  "vacation": { "enabled": true, "timeCode": "V", "label": "Vacation" },
  "sickLeave": { "enabled": true, "timeCode": "PSL", "label": "Paid Sick Leave" },
  "floatingHoliday": { "enabled": true, "timeCode": "FLH", "label": "Floating Holiday" },
  "paidHoliday": { "enabled": true, "timeCode": "HL", "label": "Holiday" }
}
```

**Files Modified:**
- `public/NFL/brand-features.json` - Added timeCode and label to each leave type
- `lib/brand-features.ts` - Extended `LeaveTypeConfig` interface with optional `timeCode` and `label`
- `components/balance-cards.tsx` - Now loads time codes dynamically from brand features
- `lib/accrual-calculations.ts` - Changed `loadAccrualRules` return type from hardcoded `{ FH?: AccrualRule }` to flexible `Record<string, AccrualRule>`

**Benefits:**
- Each brand can use different time code abbreviations
- Balance cards automatically use the correct codes from configuration
- No code changes needed when time codes change - just update brand-features.json
- Labels are also configurable for display purposes

### Phase 6.11: Employee Reactivation ✅ COMPLETE
Added ability for authorized users to reactivate deactivated employees.

**Problem:**
When employees were deactivated (soft delete), there was no way to restore them through the UI. The only option was "Deleted" text with no action.

**Solution:**
Added a reactivate button that appears for inactive employees when viewing with "Show Inactive" enabled.

**Implementation:**
- Added `handleReactivate` function that calls PUT /api/employees with `is_active: 1`
- Added green reactivate button (↻ RotateCcw icon) in the Actions column
- Button only appears for users with delete permission (same permission check as deactivate)
- Users without permission see "Inactive" text instead

**Files Modified:**
- `app/employees/page.tsx` - Added RotateCcw import, handleReactivate function, and reactivate button UI

### Phase 6.12: Color Configuration ✅ COMPLETE
Super admins can customize colors for time codes and status indicators (warning/critical thresholds).

**Purpose:**
- Allow brand differentiation through custom color schemes
- Enable status highlighting customization (warning at 90%, critical at 100%)
- Time code identification with distinct colors in calendar grid
- Consistent color application across attendance grid, balance cards, and reports

**Architecture:**
```
Color Resolution Priority:
1. Database (admin customizations) - HIGHEST PRIORITY
2. Brand JSON defaults (public/{brand}/)
3. System defaults (hardcoded fallback)
```

**Feature Flag Required:**
```json
// In brand-features.json
"colorCustomization": {
  "enabled": true,
  "allowTimeCodeColors": true,
  "allowStatusColors": true
}
```
- If `colorCustomization.enabled = false`: No admin UI shown, only brand JSON defaults used
- If `allowTimeCodeColors = false`: Hide time code color section in admin UI
- If `allowStatusColors = false`: Hide status color section in admin UI

**Implementation:**

1. ✅ Created `color_config` database table in auth.db
   - Migration: `lib/migrations/auth/006_color_config.ts`
   - Fields: id, config_type, config_key, color_name, created_at, updated_at
   - UNIQUE constraint on (config_type, config_key)

2. ✅ Created `lib/color-config.ts` with utilities:
   - `getTimeCodeColor(code)` - returns resolved color (DB → JSON → default)
   - `getStatusColor(status)` - returns warning/critical colors
   - `saveColorConfig()` / `deleteColorConfig()` - CRUD operations
   - `isColorCustomizationEnabled()` - checks feature flag
   - `getAvailableColors()` - returns palette options

3. ✅ Created `/api/color-config` endpoint (`app/api/color-config/route.ts`):
   - `GET` - returns feature config, color configs, time codes with defaults, available colors
   - `POST` - create/update color config (admin only)
   - `DELETE` - remove custom config, reverts to default (admin only)
   - Includes audit logging for all changes

4. ✅ Created `ColorConfigManagement` component (`components/color-config-management.tsx`):
   - Two sections: "Time Code Colors" and "Status Colors"
   - Dropdown to select color from palette (blue, amber, red, teal, purple, green, gray)
   - Color swatch preview next to each item
   - "Reset to Default" button per item (only visible when customized)

5. ✅ Added Color Configuration to Settings page (super admin only)

6. ✅ Updated `balance-cards.tsx`:
   - Added `COLOR_CLASS_MAP` for semantic colors to Tailwind classes
   - Fetches status colors from `/api/color-config`
   - Dynamic warning/critical threshold colors

7. ✅ Updated `leave-balance-summary.tsx`:
   - Added `CELL_COLOR_MAP` for cell and legend styling
   - Fetches status colors from `/api/color-config`
   - Dynamic threshold colors in getCellStyle() and legend

8. ✅ Updated `attendance-grid.tsx`:
   - Added `CELL_BG_COLOR_MAP` for background colors
   - Fetches time code colors from `/api/color-config`
   - Added `getCellColorClass()` function
   - Calendar cells colored based on time code

9. ✅ Added default colors to `public/Default/time-codes.json`:
   - V=blue, S=red, PS=purple, H=green, FH=teal, PTO=purple, etc.

10. ✅ Added colorCustomization and statusColors to `public/Default/brand-features.json`

**Available Color Palette:**
| Color  | Light BG | Light Text | Use Case |
|--------|----------|------------|----------|
| blue   | #dbeafe  | #1e40af    | Vacation, general leave |
| amber  | #fef3c7  | #92400e    | Warning status (90%+) |
| red    | #fee2e2  | #991b1b    | Critical status (100%+), sick |
| teal   | #ccfbf1  | #115e59    | Floating holiday |
| purple | #f3e8ff  | #6b21a8    | Personal sick, PTO |
| green  | #dcfce7  | #166534    | Holiday, positive |
| gray   | #f3f4f6  | #374151    | Default/neutral |

**UI Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Color Configuration                              [Admin Only]│
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ TIME CODE COLORS                                             │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Code      Description      Color       Actions         │  │
│ │ ──────────────────────────────────────────────────────│  │
│ │ V         Vacation         [■ Blue ▼]  [Reset]        │  │
│ │ PS        Personal Sick    [■ Purple▼] [Reset]        │  │
│ │ FH        Floating Holiday [■ Teal  ▼] [Reset]        │  │
│ │ H         Holiday          [■ Green ▼] [Reset]        │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ STATUS COLORS                                                │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Status    Threshold   Color         Actions            │  │
│ │ ──────────────────────────────────────────────────────│  │
│ │ Warning   90%+        [■ Amber ▼]   [Reset]           │  │
│ │ Critical  100%+       [■ Red   ▼]   [Reset]           │  │
│ └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Files Created:**
- `lib/migrations/auth/006_color_config.ts` - Database migration
- `lib/color-config.ts` - Color utilities and DB operations
- `app/api/color-config/route.ts` - CRUD API endpoint
- `components/color-config-management.tsx` - Admin UI component

**Files Modified:**
- `lib/brand-features.ts` - Added ColorCustomizationConfig, StatusColorsConfig interfaces
- `lib/brand-time-codes.ts` - Added `color?: string` to BrandTimeCode interface
- `public/Default/time-codes.json` - Added default colors to all time codes
- `public/Default/brand-features.json` - Added colorCustomization and statusColors
- `components/balance-cards.tsx` - Dynamic status colors
- `components/reports/leave-balance-summary.tsx` - Dynamic status colors
- `components/attendance-grid.tsx` - Time code colors in calendar cells
- `app/settings/page.tsx` - Added ColorConfigManagement for super admins
