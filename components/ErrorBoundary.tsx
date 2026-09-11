import * as React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from './Text';
import { captureException } from '../lib/monitoring';
import { colors, spacing } from '../constants/theme';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
    captureException(error, { componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing['3xl'], gap: spacing.xl }}>
          <Text variant="h2" color={colors.text} align="center">Something went wrong</Text>
          <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 300, lineHeight: 22 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Text>
          <Pressable
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.md,
              backgroundColor: colors.accent,
              borderRadius: 999,
            }}
          >
            <Text variant="bodyMedium" color={colors.textInverse}>Try Again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
