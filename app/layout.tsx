import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { Navbar } from "@/components/navbar";
import { Providers } from "@/components/providers";
import { PageTransition } from "@/components/page-transition";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  display: "swap",
});

const themeInitScript = `
(function() {
  try {
    var mode = localStorage.getItem('app_color_mode') || 'system';
    var resolved = mode === 'system'
      ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    var palettes = {
      light: {
        background: '0 0% 100%',
        foreground: '222.2 84% 4.9%',
        card: '0 0% 100%',
        cardForeground: '222.2 84% 4.9%',
        popover: '0 0% 100%',
        popoverForeground: '222.2 84% 4.9%',
        primary: '222.2 47.4% 11.2%',
        primaryForeground: '210 40% 98%',
        secondary: '210 40% 96.1%',
        secondaryForeground: '222.2 47.4% 11.2%',
        muted: '210 40% 96.1%',
        mutedForeground: '215.4 16.3% 46.9%',
        accent: '210 40% 96.1%',
        accentForeground: '222.2 47.4% 11.2%',
        destructive: '0 84.2% 60.2%',
        destructiveForeground: '210 40% 98%',
        border: '214.3 31.8% 91.4%',
        input: '214.3 31.8% 91.4%',
        ring: '222.2 84% 4.9%'
      },
      dark: {
        background: '218 44% 14%',
        foreground: '210 40% 98%',
        card: '218 42% 16%',
        cardForeground: '210 40% 98%',
        popover: '218 42% 16%',
        popoverForeground: '210 40% 98%',
        primary: '210 40% 98%',
        primaryForeground: '218 44% 14%',
        secondary: '216 34% 24%',
        secondaryForeground: '210 40% 98%',
        muted: '216 34% 24%',
        mutedForeground: '214 24% 76%',
        accent: '215 36% 28%',
        accentForeground: '210 40% 98%',
        destructive: '0 62.8% 30.6%',
        destructiveForeground: '210 40% 98%',
        border: '215 32% 30%',
        input: '215 32% 30%',
        ring: '212.7 26.8% 83.9%'
      }
    };
    var colors = palettes[resolved] || palettes.light;
    var root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
    Object.keys(colors).forEach(function(key) {
      var cssKey = key.replace(/[A-Z]/g, function(match) { return '-' + match.toLowerCase(); });
      root.style.setProperty('--' + cssKey, colors[key]);
    });
  } catch (error) {}
})();
`;

export const metadata: Metadata = {
  title: "Multi-User Attendance",
  description: "Employee attendance management system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={roboto.className}>
        <Providers>
          <Navbar />
          <main className="min-h-[calc(100vh-2.5rem)]">
            <PageTransition>{children}</PageTransition>
          </main>
        </Providers>
      </body>
    </html>
  );
}
