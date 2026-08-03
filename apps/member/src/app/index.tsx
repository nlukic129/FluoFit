import { useRouter } from "expo-router";
import { View } from "react-native";

import { Body, Button, Heading, Screen } from "@fluofit/ui";

// Prospect home (conversion-first). A cold Prospect sees the buy CTA + an "I have a Box"
// activation path. The warm Standalone / scanner experience lands in Phase 2 (PRODUCT §1).
export default function HomeScreen() {
  const router = useRouter();
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", gap: 12 }}>
        <Heading>Jedan sačet dnevno.</Heading>
        <Body>
          Kreatin, B12, magnezijum, vitamin C — sve u jednom. Pretplati se i nikad ne ostani bez
          zalihe; skeniraj i otključaj streak, XP i Perks.
        </Body>
      </View>
      <Button title="Započni pretplatu" onPress={() => router.push("/checkout")} />
      <Button
        title="Imam Box — aktiviraj"
        variant="secondary"
        onPress={() => router.push("/activate")}
      />
      <Button
        title="Prijava / moj nalog"
        variant="secondary"
        onPress={() => router.push("/account")}
      />
    </Screen>
  );
}
