import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { Card } from './Card';
import { spacing } from '../constants/theme';
import { useColors } from '../lib/theme';

interface Props {
  balance: number;
  label?: string;
}

export function WalletCard({ balance, label = 'MINDS Tokens' }: Props) {
  const colors = useColors();
  return (
    <Card variant="raised">
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.tokenMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="diamond" size={24} color={colors.token} />
        </View>
        <Text variant="hero" color={colors.token}>
          {balance.toLocaleString()}
        </Text>
        <Text variant="label" color={colors.textMuted}>
          {label}
        </Text>
      </View>
    </Card>
  );
}
