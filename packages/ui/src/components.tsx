// Shared UI primitives — one source for member, admin, and partners (replaces the per-app
// copies). Pure React Native so they render on iOS, Android, and web (react-native-web).
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "./theme";

export function Screen({
  children,
  scroll = false,
  maxWidth = 480,
}: {
  children: ReactNode;
  scroll?: boolean;
  maxWidth?: number;
}) {
  const inner = <View style={[styles.container, { maxWidth }]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll}>{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}
export function Subheading({ children }: { children: ReactNode }) {
  return <Text style={styles.subheading}>{children}</Text>;
}
export function Body({ children }: { children: ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}
export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.cardBox}>{children}</View>;
}
export function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={COLORS.muted}
        autoCapitalize="none"
        {...props}
      />
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  disabled?: boolean;
}) {
  const secondary = variant === "secondary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        variant === "danger" && styles.buttonDanger,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? COLORS.text : "#fff"} />
      ) : (
        <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}>
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 20, alignItems: "center" },
  container: { flex: 1, padding: 20, gap: 16, width: "100%", alignSelf: "center" },
  heading: { color: COLORS.text, fontSize: 28, fontWeight: "700" },
  subheading: { color: COLORS.text, fontSize: 18, fontWeight: "600", marginTop: 8 },
  body: { color: COLORS.muted, fontSize: 15, lineHeight: 22 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardBox: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  field: { gap: 6 },
  label: { color: COLORS.text, fontSize: 14, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    color: COLORS.text,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  button: { backgroundColor: COLORS.brand, borderRadius: 12, padding: 16, alignItems: "center" },
  buttonSecondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.border },
  buttonDanger: { backgroundColor: COLORS.danger },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  buttonTextSecondary: { color: COLORS.text },
  choice: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: COLORS.card,
  },
  choiceSelected: { borderColor: COLORS.brand, backgroundColor: "#208AEF22" },
  choiceText: { color: COLORS.text, fontSize: 15, fontWeight: "600" },
  choiceTextSelected: { color: COLORS.brand },
});
