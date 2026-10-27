import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamily, radii, spacing, typography } from "@/theme/tokens";

type AppHeaderProps = {
  branchName: string;
  onLogout: () => void;
};

export function AppHeader({ branchName, onLogout }: AppHeaderProps) {
  function confirmLogout() {
    Alert.alert("Keluar", "Anda yakin ingin keluar dari terminal ini?", [
      { text: "Batal", style: "cancel" },
      { text: "Keluar", style: "destructive", onPress: onLogout },
    ]);
  }

  return (
    <View style={styles.header}>
      <View style={styles.brandBlock}>
        <View style={styles.logo}>
          <Ionicons name="storefront" size={17} color={colors.primary} />
        </View>
        <Text style={styles.brand}>POS Kasir</Text>
        <View style={styles.branchChip}>
          <Text style={styles.branchText} numberOfLines={1}>
            {branchName}
          </Text>
        </View>
      </View>

      <Pressable
        testID="logout-button"
        accessibilityRole="button"
        accessibilityLabel="Keluar"
        onPress={confirmLogout}
        style={({ pressed }) => [styles.avatar, pressed && styles.avatarPressed]}
      >
        <Ionicons name="person" size={18} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.margin,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  brandBlock: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  logo: {
    width: 30,
    height: 30,
    borderRadius: radii.control,
    backgroundColor: colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    fontFamily: fontFamily.narrowBold,
    fontSize: typography.headlineSm.fontSize,
    color: colors.primary,
  },
  branchChip: {
    maxWidth: 120,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  branchText: {
    fontFamily: fontFamily.narrowSemiBold,
    fontSize: typography.labelSm.fontSize,
    lineHeight: typography.labelSm.lineHeight,
    color: colors.onSecondaryContainer,
    textTransform: "uppercase",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPressed: { backgroundColor: colors.primaryPressed },
});
