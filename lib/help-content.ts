/**
 * Help Content Types and Loader
 *
 * Help content is stored in each brand's folder as help-content.json.
 * This allows brands to customize help text and add help for custom sections.
 *
 * To add help for a new section:
 * 1. Wrap the UI element with <HelpArea helpId="your-section-id">
 * 2. Add an entry to the brand's help-content.json with matching section ID
 */

export interface HelpContent {
  id: string;
  screen: string;
  section: string;
  title: string;
  whatItIs: string;
  howToUse: string;
  howToUpdate: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  order?: number;
}

export interface BrandHelpContent {
  brandId: string;
  version: string;
  description?: string;
  content: HelpContent[];
}

/**
 * Fetch help content for the current brand
 * Returns from the brand's public folder help-content.json
 */
export async function fetchBrandHelpContent(): Promise<HelpContent[]> {
  try {
    // First get the current brand from brand-selection.json
    const brandResponse = await fetch('/api/brand-selection');
    let brandName = 'Default';

    if (brandResponse.ok) {
      const brandData = await brandResponse.json();
      brandName = brandData.brand || 'Default';
    }

    // Then fetch the help content for that brand
    const helpResponse = await fetch(`/${brandName}/help-content.json`);

    if (!helpResponse.ok) {
      console.log(`No help content found for brand ${brandName}, using empty content`);
      return [];
    }

    const helpData: BrandHelpContent = await helpResponse.json();
    return helpData.content || [];
  } catch (error) {
    console.error('Failed to load help content:', error);
    return [];
  }
}

/**
 * Get help content for a specific screen from loaded content
 */
export function getHelpForScreen(content: HelpContent[], screen: string): HelpContent[] {
  return content
    .filter(h => h.screen === screen)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Get help content for a specific section from loaded content
 */
export function getHelpForSection(content: HelpContent[], screen: string, section: string): HelpContent | undefined {
  return content.find(h => h.screen === screen && h.section === section);
}

/**
 * Get all available screens with help content
 */
export function getScreensWithHelp(content: HelpContent[]): string[] {
  return [...new Set(content.map(h => h.screen))];
}
