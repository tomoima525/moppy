import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { BUILT_IN_THEMES, Theme } from '../../generation/themes.js';

export interface ThemeSelectorProps {
  currentTheme: string;
  onSelect: (theme: string) => void;
  onCancel: () => void;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  currentTheme,
  onSelect,
  onCancel,
}) => {
  const themes = BUILT_IN_THEMES;
  const [selectedIndex, setSelectedIndex] = useState(
    themes.findIndex((t) => t.name === currentTheme) || 0
  );

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : themes.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev < themes.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      onSelect(themes[selectedIndex].name);
    } else if (key.escape || input === 'q') {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text bold>Select a theme:</Text>
      <Text dimColor>(Use arrows to navigate, Enter to select, Esc to cancel)</Text>
      <Box flexDirection="column" marginTop={1}>
        {themes.map((theme, index) => (
          <ThemeOption
            key={theme.name}
            theme={theme}
            isSelected={index === selectedIndex}
            isCurrent={theme.name === currentTheme}
          />
        ))}
      </Box>
    </Box>
  );
};

interface ThemeOptionProps {
  theme: Theme;
  isSelected: boolean;
  isCurrent: boolean;
}

const ThemeOption: React.FC<ThemeOptionProps> = ({
  theme,
  isSelected,
  isCurrent,
}) => {
  const prefix = isSelected ? '> ' : '  ';
  const suffix = isCurrent ? ' (current)' : '';

  return (
    <Box>
      <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
        {prefix}
        {theme.displayName}
        {suffix}
      </Text>
      <Text dimColor> - {theme.description}</Text>
    </Box>
  );
};
