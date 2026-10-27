import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { DashboardRecentSale } from "@/api/types";
import { formatMoney, formatTime } from "@/lib/format";
import { colors, fontFamily, radii, spacing, typography } from "@/theme/tokens";
import { StatusBadge } from "./StatusBadge";

type RecentSalesProps = {
  sales: DashboardRecentSale[];
  timezone: string;
};

export function RecentSales({ sales, timezone }: RecentSalesProps) {
  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Transaksi terakhir</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => Alert.alert("Riwayat", "Riwayat transaksi belum tersedia di versi ini.")}
          hitSlop={8}
        >
          <Text style={styles.link}>Lihat semua</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        {sales.length === 0 ? (
          <Text style={styles.empty}>Belum ada transaksi hari ini.</Text>
        ) : (
          sales.map((sale) => (
            <View key={sale.id} testID={`recent-sale-${sale.id}`} style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.receipt}>{sale.receiptNumber}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {formatTime(new Date(sale.soldAt), timezone)} ·{" "}
                  {sale.customerName ?? "Pelanggan umum"}
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.amount}>{formatMoney(sale.grandTotal)}</Text>
                <StatusBadge status={sale.status} />
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: fontFamily.narrowSemiBold,
    fontSize: typography.headlineSm.fontSize,
    lineHeight: typography.headlineSm.lineHeight,
    color: colors.inkPrimary,
  },
  link: {
    fontFamily: fontFamily.narrowSemiBold,
    fontSize: typography.labelMd.fontSize,
    color: colors.primaryContainer,
  },
  card: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: "hidden",
  },
  empty: {
    padding: spacing.lg,
    fontFamily: fontFamily.narrow,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
    color: colors.inkSecondary,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  rowLeft: { flex: 1, gap: 2 },
  rowRight: { alignItems: "flex-end", gap: spacing.xs },
  receipt: {
    fontFamily: fontFamily.narrowBold,
    fontSize: typography.labelLg.fontSize,
    lineHeight: typography.labelLg.lineHeight,
    color: colors.inkPrimary,
  },
  meta: {
    fontFamily: fontFamily.narrow,
    fontSize: typography.bodySm.fontSize,
    lineHeight: typography.bodySm.lineHeight,
    color: colors.inkSecondary,
  },
  amount: {
    fontFamily: fontFamily.narrowBold,
    fontSize: typography.labelLg.fontSize,
    lineHeight: typography.labelLg.lineHeight,
    color: colors.inkPrimary,
  },
});
