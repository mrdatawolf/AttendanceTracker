# Theme System

This folder contains all application theme configurations. Each theme defines appearance settings, layout preferences, and customization options.

## Available Themes

### Trinity
- **Description**: Light mode with original layout
- **File**: `trinity.ts`
- **Features**:
  - Light background
  - Balance Cards shown first
  - Traditional office-friendly appearance

### Default
- **Description**: Dark mode with optimized layout
- **File**: `default.ts`
- **Features**:
  - Dark background for reduced eye strain
  - Attendance Record shown first
  - Visual month separators

## Creating a New Theme

### Step 1: Create Theme File

Create a new file in this folder (e.g., `ocean.ts`):

```typescript
import { ThemeConfig } from './types';

export const oceanTheme: ThemeConfig = {
  id: 'ocean',
  name: 'Ocean',
  description: 'Cool blue tones with medium contrast',

  appearance: {
    colors: {
      // IMPORTANT: Use HSL values WITHOUT hsl() wrapper
      // Format: 'hue saturation% lightness%'
      background: '210 100% 97%',      // Very light blue
      foreground: '210 100% 10%',      // Very dark blue
      card: '210 100% 98%',
      cardForeground: '210 100% 10%',
      popover: '0 0% 100%',
      popoverForeground: '210 100% 10%',
      primary: '210 100% 50%',         // Ocean blue
      primaryForeground: '0 0% 100%',
      secondary: '210 50% 90%',
      secondaryForeground: '210 100% 20%',
      muted: '210 30% 95%',
      mutedForeground: '210 20% 40%',
      accent: '195 100% 50%',          // Cyan accent
      accentForeground: '0 0% 100%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '0 0% 100%',
      border: '210 40% 85%',
      input: '210 40% 85%',
      ring: '210 100% 50%',
    },
    // Optional: add custom CSS class for additional styling
    cssClass: 'theme-ocean',
  },

  layout: {
    attendance: {
      // 'balanceFirst' or 'recordFirst'
      sectionOrder: 'balanceFirst',
      showMonthSeparators: false,
    },
  },

  // Optional: custom settings for your theme
  customization: {
    accentColor: 'blue',
    // Add any custom properties you need
  },
};
```

### Step 2: Update Type Definition

Add your theme ID to the `ThemeId` type in `types.ts`:

```typescript
export type ThemeId = 'trinity' | 'default' | 'ocean';
```

### Step 3: Register Theme

Import and add your theme to the `THEMES` array in `index.ts`:

```typescript
import { oceanTheme } from './ocean';

export const THEMES: ThemeConfig[] = [
  trinityTheme,
  defaultTheme,
  oceanTheme, // Add your theme here
];
```

### Step 4: (Optional) Add Custom Styles

If you used a `cssClass` in your theme config, add corresponding styles to `app/globals.css`:

```css
.theme-ocean {
  /* Your custom CSS variables and styles */
  --ocean-primary: #0066cc;
  --ocean-background: #f0f8ff;
}
```

That's it! Your theme will now appear in the Settings page and be available for selection.

## Theme Configuration Reference

### ThemeConfig Interface

```typescript
interface ThemeConfig {
  id: ThemeId;              // Unique identifier
  name: string;             // Display name
  description: string;      // Brief description

  appearance: {
    isDark: boolean;        // Apply dark mode?
    cssClass?: string;      // Optional CSS class
  };

  layout: {
    attendance: {
      sectionOrder: 'balanceFirst' | 'recordFirst';
      showMonthSeparators: boolean;
    };
  };

  customization?: {
    [key: string]: any;     // Custom properties
  };
}
```

### Layout Options

#### `sectionOrder`
- `'balanceFirst'`: Balance Cards → Attendance Record (original layout)
- `'recordFirst'`: Attendance Record → Balance Cards (optimized layout)

#### `showMonthSeparators`
- `true`: Show visual gaps between each month in the attendance grid
- `false`: No gaps between months (compact view)

### Appearance Options

#### `colors` (required)
- Complete color palette for the theme
- **IMPORTANT:** Use HSL format WITHOUT `hsl()` wrapper
- Format: `'hue saturation% lightness%'` (e.g., `'222.2 84% 4.9%'`)
- Tailwind CSS automatically wraps these values when applying classes
- All 19 color properties are required:
  - `background`, `foreground`
  - `card`, `cardForeground`
  - `popover`, `popoverForeground`
  - `primary`, `primaryForeground`
  - `secondary`, `secondaryForeground`
  - `muted`, `mutedForeground`
  - `accent`, `accentForeground`
  - `destructive`, `destructiveForeground`
  - `border`, `input`, `ring`

#### `cssClass` (optional)
- Custom CSS class applied to the root `<html>` element
- Use for theme-specific styling beyond color changes
- Define corresponding styles in `globals.css`

## Accessing Themes in Components

### Get Current Theme Configuration

```typescript
import { useTheme } from '@/lib/theme-context';
import { getTheme } from '@/lib/themes';

function MyComponent() {
  const { theme: themeId } = useTheme();
  const themeConfig = getTheme(themeId);

  // Access theme properties
  const isDark = themeConfig.appearance.isDark;
  const sectionOrder = themeConfig.layout.attendance.sectionOrder;

  return <div>Current theme: {themeConfig.name}</div>;
}
```

### Use Theme-Specific Layout

```typescript
const themeConfig = getTheme(themeId);

{themeConfig.layout.attendance.sectionOrder === 'recordFirst' ? (
  <>
    <AttendanceRecord />
    <BalanceCards />
  </>
) : (
  <>
    <BalanceCards />
    <AttendanceRecord />
  </>
)}
```

## Best Practices

1. **Keep themes focused**: Each theme should have a clear purpose or aesthetic
2. **Test thoroughly**: Verify your theme works across all pages
3. **Document custom properties**: If using `customization`, document what they do
4. **Consider accessibility**: Ensure sufficient contrast in all themes
5. **Name meaningfully**: Use descriptive names that convey the theme's purpose

## File Structure

```
lib/themes/
├── README.md           # This file
├── types.ts            # TypeScript type definitions
├── index.ts            # Theme registry and utilities
├── trinity.ts          # Trinity theme configuration
├── default.ts          # Default theme configuration
└── [your-theme].ts     # Your custom theme
```

## Troubleshooting

### Theme not appearing in Settings
- Ensure you added it to the `THEMES` array in `index.ts`
- Verify the theme ID is added to `ThemeId` type in `types.ts`

### Dark mode not working
- Check that `isDark: true` is set in theme config
- Verify Tailwind's dark mode is configured in `tailwind.config.ts`

### Layout not changing
- Ensure components are checking `themeConfig.layout` properties
- Verify the component is using `getTheme()` to access configuration

### Custom CSS class not applying
- Check that the class is defined in `app/globals.css`
- Ensure the theme context is applying the class to the root element
