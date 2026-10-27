import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamily, radii, spacing, typography } from "@/theme/tokens";

const ACTIONS = [
  { key: "barcode", label: "Pindai Barcode", icon: "barcode-outline" },
  { key: "riwayat", label: "Riwayat", icon: "receipt-outline" },
  { key: "pelanggan", label: "Pelanggan", icon: "people-outline" },
] as const;

export function QuickActions() {
  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>AKSI CEPAT</Text>
      <View style={styles.grid}>
        {ACTIONS.map((action) => (
          <Pressable
            key={action.key}
            testID={`quick-action-${action.key}`}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() =>
              Alert.alert("Segera hadir", `${action.label} belum tersedia di versi ini.`)
            }
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          >
            <View style={styles.iconBox}>
              <Ionicons name={action.icon} size={18} color={colors.primary} />
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  eyebrow: {
    fontFamily: fontFamily.narrowSemiBold,
    fontSize: typography.labelSm.fontSize,
    lineHeight: typography.labelSm.lineHeight,
    letterSpacing: 0.4,
    color: colors.inkSecondary,
  },
  grid: { flexDirection: "row", gap: spacing.sm },
  action: {
    flex: 1,
    minHeight: 64,
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  actionPressed: { backgroundColor: colors.surfaceLow },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: fontFamily.narrowSemiBold,
    fontSize: typography.labelSm.fontSize,
    lineHeight: typography.labelSm.lineHeight,
    color: colors.inkPrimary,
    textAlign: "center",
  },
});