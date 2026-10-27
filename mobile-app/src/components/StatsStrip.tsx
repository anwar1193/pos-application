import { StyleSheet, Text, View } from "react-native";
import type { DashboardToday } from "@/api/types";
import {
  averagePerTransaction,
  deltaLabel,
  formatCompactMoney,
} from "@/lib/format";
import { colors, fontFamily, radii, spacing, typography } from "@/theme/tokens";

type StatsStripProps = {
  today: DashboardToday;
};

function comparisonText(percent: number | null, suffix: string): string {
  return percent === null ? deltaLabel(null) : `${deltaLabel(percent)} ${suffix}`;
}

export function StatsStrip({ today }: StatsStripProps) {
  return (
    <View style={styles.strip}>
      <View style={styles.cell}>
        <Text style={styles.label} numberOfLines={1}>
          Penjualan bersih
        </Text>
        <Text style={styles.value}>{formatCompactMoney(today.net)}</Text>
        <Text style={styles.foot} numberOfLines={1}>
          {comparisonText(today.comparison.grossPercent, "vs kmrn")}
        </Text>
      </View>

      <View style={[styles.cell, styles.cellMiddle]}>
        <Text style={styles.label} numberOfLines={1}>
          Transaksi
        </Text>
        <Text style={styles.value}>{today.transactions}</Text>
        <Text style={styles.foot} numberOfLines={1}>
          {comparisonText(today.comparison.transactionsPercent, "vs kmrn")}
        </Text>
      </View>

      <View style={styles.cell}>
        <Text style={styles.label} numberOfLines={1}>
          Item terjual
        </Text>
        <Text style={styles.value}>{today.itemsSold}</Text>
        <Text style={styles.foot} numberOfLines={1}>
          {averagePerTransaction(today.itemsSold, today.transactions)}/transaksi
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
  },
  cell: { flex: 1, gap: 2, paddingRight: spacing.sm },
  cellMiddle: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.sm,
  },
  label: {
    fontFamily: fontFamily.narrow,
    fontSize: typography.bodySm.fontSize,
    lineHeight: typography.bodySm.lineHeight,
    color: colors.inkSecondary,
  },
  value: {
    fontFamily: fontFamily.narrowBold,
    fontSize: typography.headlineSm.fontSize,
    lineHeight: typography.headlineSm.lineHeight,
    color: colors.inkPrimary,
  },
  foot: {
    fontFamily: fontFamily.narrowSemiBold,
    fontSize: typography.labelSm.fontSize,
    lineHeight: typography.labelSm.lineHeight,
    color: colors.primaryContainer,
  },
});
