export interface Theme {
  name: string;
  displayName: string;
  description: string;
  builtIn: boolean;
  cssPath?: string;
}

export const BUILT_IN_THEMES: Theme[] = [
  {
    name: 'default',
    displayName: 'Default',
    description: 'Clean, minimal theme with good readability',
    builtIn: true,
  },
  {
    name: 'gaia',
    displayName: 'Gaia',
    description: 'Modern theme with gradient backgrounds',
    builtIn: true,
  },
  {
    name: 'uncover',
    displayName: 'Uncover',
    description: 'Simple theme focused on content',
    builtIn: true,
  },
];

export function getTheme(name: string): Theme | undefined {
  return BUILT_IN_THEMES.find((t) => t.name === name);
}

export function getAvailableThemes(): Theme[] {
  return [...BUILT_IN_THEMES];
}

export function isValidTheme(name: string): boolean {
  return BUILT_IN_THEMES.some((t) => t.name === name);
}

export function getThemeFrontMatter(themeName: string): string {
  const theme = getTheme(themeName);
  if (theme?.cssPath) {
    return `theme: ${theme.cssPath}`;
  }
  return `theme: ${themeName}`;
}
