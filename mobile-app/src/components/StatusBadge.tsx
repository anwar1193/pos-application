import { StyleSheet, Text, View } from "react-native";
import { saleStatus, type SaleStatusTone } from "@/lib/status";
import { colors, fontFamily, radii, spacing, typography } from "@/theme/tokens";

const TONES: Record<SaleStatusTone, { background: string; foreground: string }> = {
  success: { background: colors.primaryFixed, foreground: colors.primary },
  warning: { background: colors.warningSoft, foreground: colors.warning },
  danger: { background: colors.dangerSoft, foreground: colors.danger },
  neutral: { background: colors.surfaceContainer, foreground: colors.inkSecondary },
};

export function StatusBadge({ status }: { status: string }) {
  const { label, tone } = saleStatus(status);
  const palette = TONES[tone];

  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.label, { color: palette.foreground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  label: {
    fontFamily: fontFamily.narrowSemiBold,
    fontSize: typography.labelSm.fontSize,
    lineHeight: typography.labelSm.lineHeight,
  },
});
