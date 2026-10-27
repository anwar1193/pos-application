import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamily, radii, spacing, typography } from "@/theme/tokens";

type Tab = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active?: boolean;
};

const TABS: Tab[] = [
  { key: "beranda", label: "Beranda", icon: "grid-outline", active: true },
  { key: "kasir", label: "Kasir", icon: "cart-outline" },
  { key: "riwayat", label: "Riwayat", icon: "receipt-outline" },
  { key: "akun", label: "Akun", icon: "person-outline" },
];

export function BottomNav() {
  return (
    <View style={styles.nav}>
      {TABS.map((tab) => {
        const active = Boolean(tab.active);
        return (
          <Pressable
            key={tab.key}
            testID={`nav-${tab.key}`}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
            style={styles.tab}
            onPress={() => {
              if (!active) {
                Alert.alert("Segera hadir", `${tab.label} belum tersedia di versi ini.`);
              }
            }}
          >
            <View style={[styles.indicator, active && styles.indicatorActive]} />
            <Ionicons
              name={tab.icon}
              size={22}
              color={active ? colors.primaryContainer : colors.inkMuted}
            />
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.surfaceLowest,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingTop: spacing.sm,
  },
  tab: {
    flex: 1,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  indicator: {
    width: 3,
    height: 24,
    position: "absolute",
    top: 0,
    borderRadius: radii.full,
    backgroundColor: "transparent",
  },
  indicatorActive: { backgroundColor: colors.primaryContainer },
  label: {
    fontFamily: fontFamily.narrow,
    fontSize: typography.labelSm.fontSize,
    lineHeight: typography.labelSm.lineHeight,
    color: colors.inkMuted,
  },
  labelActive: {
    fontFamily: fontFamily.narrowSemiBold,
    color: colors.primaryContainer,
  },
});
