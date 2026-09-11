import { View } from 'react-native';
import { spacing } from '../constants/theme';
import { useColors } from '../lib/theme';

interface Props {
  marginVertical?: number;
}

export function Divider({ marginVertical = spacing.lg }: Props) {
  const colors = useColors();
  return (
    <View
      style={{
        height: 0.5,
        backgroundColor: colors.borderSubtle,
        marginVertical,
      }}
    />
  );
}
