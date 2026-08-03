import { ActivityIndicator, View } from "react-native";

import { useSession } from "@/hooks/use-session";
import Login from "@/screens/login";
import Provisioning from "@/screens/provisioning";

export default function Index() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: "#0B0B0F" }}>
        <ActivityIndicator color="#208AEF" />
      </View>
    );
  }
  return session ? <Provisioning /> : <Login />;
}
