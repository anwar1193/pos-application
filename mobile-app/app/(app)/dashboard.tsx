import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth/auth-context";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { QuickActions } from "@/components/QuickActions";
import { RecentSales } from "@/components/RecentSales";
import { ScreenState } from "@/components/ScreenState";
import { ShiftCard } from "@/components/ShiftCard";
import { StatsStrip } from "@/components/StatsStrip";
import { useDashboard } from "@/hooks/use-dashboard";
import { firstName, formatDateHeader } from "@/lib/format";
import { colors, fontFamily, radii, spacing, typography } from "@/theme/tokens";

export default function DashboardScreen() {
  const { signOut } = useAuth();
  const dashboard = useDashboard();

  if (dashboard.isPending) {
    return <ScreenState variant="loading" />;
  }

  if (!dashboard.data) {
    return (
      <ScreenState
        variant="error"
        message={
          dashboard.error instanceof Error ? dashboard.error.message : undefined
        }
        onRetry={() => {
          void dashboard.refetch();
        }}
        onSignOut={() => {
          void signOut();
        }}
      />
    );
  }

  const data = dashboard.data;
  const timezone = data.organization.timezone;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <AppHeader
        branchName={data.branch.name}
        onLogout={() => {
          void signOut();
        }}
      />

      <ScrollView
        testID="dashboard-scroll"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={dashboard.isRefetching}
            onRefresh={() => {
              void dashboard.refetch();
            }}
            tintColor={colors.primaryContainer}
          />
        }
      >
        <View style={styles.greeting}>
          <View style={styles.greetingMeta}>
            <Text style={styles.eyebrow}>RINGKASAN OPERASIONAL</Text>
            <Text style={styles.date}>{formatDateHeader(new Date(), timezone)}</Text>
          </View>
          <Text style={styles.greetingTitle}>
            Selamat datang, {firstName(data.user.name)}.
          </Text>
          <Text style={styles.greetingCaption}>
            Kinerja {data.branch.name} hari ini.
          </Text>
        </View>

        <ShiftCard shift={data.shift} timezone={timezone} />

        <Pressable
          testID="new-sale-button"
          accessibilityRole="button"
          onPress={() =>
            Alert.alert("Segera hadir", "Pembuatan transaksi belum tersedia di versi ini.")
          }
          style={({ pressed }) => [styles.newSale, pressed && styles.newSalePressed]}
        >
          <Ionicons name="cart" size={20} color={colors.onPrimary} />
          <Text style={styles.newSaleText}>Transaksi Baru</Text>
        </Pressable>

        <StatsStrip today={data.today} />

        <QuickActions />

        <RecentSales sales={data.recentSales} timezone={timezone} />
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  content: {
    paddingHorizontal: spacing.margin,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  greeting: { gap: spacing.xs },
  greetingMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  eyebrow: {
    fontFamily: fontFamily.narrowSemiBold,
    fontSize: typography.labelSm.fontSize,
    lineHeight: typography.labelSm.lineHeight,
    letterSpacing: 0.4,
    color: colors.inkSecondary,
  },
  date: {
    fontFamily: fontFamily.narrow,
    fontSize: typography.bodySm.fontSize,
    lineHeight: typography.bodySm.lineHeight,
    color: colors.inkSecondary,
  },
  greetingTitle: {
    fontFamily: fontFamily.narrowBold,
    fontSize: typography.headlineMd.fontSize,
    lineHeight: typography.headlineMd.lineHeight,
    color: colors.inkPrimary,
  },
  greetingCaption: {
    fontFamily: fontFamily.narrow,
    fontSize: typography.labelMd.fontSize,
    lineHeight: typography.labelMd.lineHeight,
    color: colors.inkSecondary,
  },
  newSale: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.control,
    backgroundColor: colors.primaryContainer,
  },
  newSalePressed: { backgroundColor: colors.primary },
  newSaleText: {
    fontFamily: fontFamily.narrowBold,
    fontSize: typography.labelLg.fontSize,
    lineHeight: typography.labelLg.lineHeight,
    color: colors.onPrimary,
  },
});