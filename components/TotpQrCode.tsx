import QRCode from 'react-native-qrcode-svg';
import { View } from 'react-native';

import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';
import { Text } from './Text';

export function TotpQrCode({ uri }: { uri: string }) {
  const colors = useColors();

  return (
    <View style={{ alignItems: 'center', gap: spacing.md }}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel="Authenticator setup QR code"
        style={{
          padding: spacing.md,
          borderRadius: radius.md,
          backgroundColor: '#ffffff',
        }}
      >
        <QRCode
          value={uri}
          size={196}
          color="#111111"
          backgroundColor="#ffffff"
        />
      </View>
      <Text variant="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>
        Can&apos;t scan it? Enter this setup URI manually:
      </Text>
      <View
        style={{
          alignSelf: 'stretch',
          padding: spacing.md,
          borderRadius: radius.sm,
          backgroundColor: colors.glass,
        }}
      >
        <Text
          variant="mono"
          color={colors.text}
          selectable
          style={{ fontSize: 12, textAlign: 'center' }}
        >
          {uri}
        </Text>
      </View>
    </View>
  );
}
