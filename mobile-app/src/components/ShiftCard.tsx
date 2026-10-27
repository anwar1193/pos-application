import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { DashboardShift } from "@/api/types";
import { formatMoney, formatTime } from "@/lib/format";
import { colors, fontFamily, radii, spacing, typography } from "@/theme/tokens";

type ShiftCardProps = {
  shift: DashboardShift | null;
  timezone: string;
};

export function ShiftCard({ shift, timezone }: ShiftCardProps) {
  if (!shift) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.iconBox}>
            <Ionicons name="time-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.heading}>
            <Text style={styles.title}>Shift Kasir</Text>
            <Text style={styles.subtitle}>Shift belum dibuka</Text>
          </View>
        </View>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Belum ada shift terbuka</Text>
          <Text style={styles.emptyHint}>
            Buka shift dari menu Kasir untuk mulai mencatat transaksi.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBox}>
            <Ionicons name="time-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.heading}>
            <Text style={styles.title}>Shift Kasir</Text>
            <Text style={styles.subtitle}>
              Dibuka {formatTime(new Date(shift.openedAt), timezone)} oleh {shift.cashierName}
            </Text>
          </View>
        </View>
        <View style={styles.openBadge}>
          <Text style={styles.openBadgeText}>Shift terbuka</Text>
        </View>
      </View>

      <View style={styles.amountBlock}>
        <Text style={styles.amountLabel}>KAS DIHARAPKAN</Text>
        <Text style={styles.amount}>{formatMoney(shift.expectedAmount)}</Text>
        <Text style={styles.amountCaption}>
          {shift.transactionCount} transaksi · {formatMoney(shift.grossTotal)} penjualan
        </Text>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={() => Alert.alert("Tutup shift", "Fitur tutup shift belum tersedia.")}
        >
          <Text style={styles.secondaryText}>Tutup Shift</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => Alert.alert("Detail shift", "Fitur detail shift belum tersedia.")}
          hitSlop={8}
        >
          <Text style={styles.linkText}>Detail</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { flex: 1, gap: 2 },
  title: {
    fontFamily: fontFamily.narrowSemiBold,
    fontSize: typography.headlineSm.fontSize,
    lineHeight: typography.headlineSm.lineHeight,
    color: colors.inkPrimary,
  },
  subtitle: {
    fontFamily: fontFamily.narrow,
    fontSize: typography.bodySm.fontSize,
    lineHeight: typography.bodySm.lineHeight,
    color: colors.inkSecondary,
  },
  openBadge: {
    backgroundColor: colors.primaryFixed,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  openBadgeText: {
    fontFamily: fontFamily.narrowSemiBold,
    fontSize: typography.labelSm.fontSize,
    lineHeight: typography.labelSm.lineHeight,
    color: colors.primary,
  },
  amountBlock: { gap: 2 },
  amountLabel: {
    fontFamily: fontFamily.narrowSemiBold,
    fontSize: typography.labelSm.fontSize,
    lineHeight: typography.labelSm.lineHeight,
    letterSpacing: 0.4,
    color: colors.inkSecondary,
  },
  amount: {
    fontFamily: fontFamily.narrowBold,
    fontSize: typography.headlineLgMobile.fontSize,
    lineHeight: typography.headlineLgMobile.lineHeight,
    color: colors.inkPrimary,
  },
  amountCaption: {
    fontFamily: fontFamily.narrow,
    fontSize: typography.bodySm.fontSize,
    lineHeight: typography.bodySm.lineHeight,
    color: colors.inkSecondary,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { backgroundColor: colors.surfaceHigh },
  secondaryText: {
    fontFamily: fontFamily.narrowSemiBold,
    fontSize: typography.labelMd.fontSize,
    color: colors.inkPrimary,
  },
  linkText: {
    fontFamily: fontFamily.narrowSemiBold,
    fontSize: typography.labelMd.fontSize,
    color: colors.primaryContainer,
  },
  emptyBox: { gap: spacing.xs },
  emptyTitle: {
    fontFamily: fontFamily.narrowSemiBold,
    fontSize: typography.bodyLg.fontSize,
    lineHeight: typography.bodyLg.lineHeight,
    color: colors.inkPrimary,
  },
  emptyHint: {
    fontFamily: fontFamily.narrow,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
    color: colors.inkSecondary,
  },
});
