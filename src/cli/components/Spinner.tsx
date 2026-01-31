import React from 'react';
import { Text, Box } from 'ink';
import InkSpinner from 'ink-spinner';

export interface SpinnerProps {
  message?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ message = 'Loading...' }) => {
  return (
    <Box>
      <Text color="cyan">
        <InkSpinner type="dots" />
      </Text>
      <Text> {message}</Text>
    </Box>
  );
};
