import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, fontFamily, radii, typography } from "@/theme/tokens";

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
};

export function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  testID,
}: PrimaryButtonProps) {
  const inactive = disabled || loading;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        inactive && styles.inactive,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryContainer,
    borderRadius: radii.control,
    paddingHorizontal: 16,
  },
  pressed: { backgroundColor: colors.primaryPressed },
  inactive: { opacity: 0.6 },
  text: {
    fontFamily: fontFamily.narrowSemiBold,
    fontSize: typography.labelLg.fontSize,
    lineHeight: typography.labelLg.lineHeight,
    color: colors.onPrimary,
  },
});
