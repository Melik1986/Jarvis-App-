import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { useAuthStore } from "@/store/authStore";
import { AppLogger } from "@/lib/logger";
import { useSettingsStore } from "@/store/settingsStore";

interface McpServer {
  name: string;
  command: string;
  args: string[];
  status?: "connected" | "disconnected" | "error";
  toolCount?: number;
}

export default function MCPServersScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { session } = useAuthStore();
  const mcpServers = useSettingsStore((state) => state.mcpServers);
  const setMcpServers = useSettingsStore((state) => state.setMcpServers);

  const [servers, setServers] = useState<McpServer[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const [name, setName] = useState("");
  const [command, setCommand] = useState("npx");
  const [args, setArgs] = useState(
    "-y @modelcontextprotocol/server-everything",
  );

  const fetchServers = useCallback(async () => {
    try {
      setIsLoading(true);

      const stored = mcpServers;
      if (stored.length > 0) {
        setServers(stored);
      }

      const baseUrl = getApiUrl();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (session?.accessToken) {
        headers["Authorization"] = `Bearer ${session.accessToken}`;
      }

      const response = await fetch(`${baseUrl}api/mcp/servers`, { headers });
      if (response.ok) {
        const data = (await response.json()) as {
          name: string;
          toolCount?: number;
          status?: "connected" | "disconnected" | "error";
        }[];

        const connectedByName = new Map(data.map((s) => [s.name, s]));

        const merged = stored.map((s) => {
          const server = connectedByName.get(s.name);
          if (!server) {
            return { ...s, status: "disconnected" as const };
          }
          return {
            ...s,
            status: server.status ?? "connected",
            toolCount: server.toolCount,
          };
        });

        setServers(merged);
      }
    } catch (error) {
      AppLogger.error("Failed to fetch MCP servers", error);
    } finally {
      setIsLoading(false);
    }
  }, [mcpServers, session?.accessToken]);

  useEffect(() => {
    fetchServers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddServer = async () => {
    try {
      setIsConnecting(true);
      const baseUrl = getApiUrl();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (session?.accessToken) {
        headers["Authorization"] = `Bearer ${session.accessToken}`;
      }

      const response = await fetch(`${baseUrl}api/mcp/servers`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name,
          command,
          args: args.split(" "),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const newServer: McpServer = {
          name,
          command,
          args: args.split(" "),
          status: result.connected ? "connected" : "error",
          toolCount: result.toolCount,
        };
        const nextServers = [
          ...servers.filter((s) => s.name !== name),
          newServer,
        ];
        setServers(nextServers);
        setMcpServers(
          nextServers.map((s) => ({
            name: s.name,
            command: s.command,
            args: s.args,
          })),
        );
        setIsAdding(false);
        setName("");
      }
    } catch (error) {
      AppLogger.error("Failed to connect MCP server", error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (serverName: string) => {
    try {
      const baseUrl = getApiUrl();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (session?.accessToken) {
        headers["Authorization"] = `Bearer ${session.accessToken}`;
      }

      await fetch(`${baseUrl}api/mcp/servers/${serverName}`, {
        method: "DELETE",
        headers,
      });

      const nextServers = servers.filter((s) => s.name !== serverName);
      setServers(nextServers);
      setMcpServers(
        nextServers.map((s) => ({
          name: s.name,
          command: s.command,
          args: s.args,
        })),
      );
    } catch (error) {
      AppLogger.error("Failed to disconnect MCP server", error);
    }
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundDefault }]}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
        }}
      >
        <View style={styles.header}>
          <ThemedText style={styles.title}>{t("mcpServers")}</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t("mcpServersDesc")}
          </ThemedText>
        </View>

        <View
          style={[
            styles.devBanner,
            {
              backgroundColor: theme.warning + "20",
              borderColor: theme.warning,
            },
          ]}
        >
          <Ionicons
            name="construct-outline"
            size={20}
            color={theme.warning}
            style={styles.devBannerIcon}
          />
          <ThemedText style={[styles.devBannerText, { color: theme.warning }]}>
            🚧 MCP integration is in development. Full HTTP-based support coming
            in v2.0. Current implementation requires backend server.
          </ThemedText>
        </View>

        {!isAdding ? (
          <Button
            onPress={() => setIsAdding(true)}
            variant="outline"
            style={styles.addBtn}
          >
            {t("connectNewServer")}
          </Button>
        ) : (
          <View
            style={[
              styles.form,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <ThemedText style={styles.formTitle}>
              {t("connectMcpServer")}
            </ThemedText>

            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border },
              ]}
              placeholder={t("serverName")}
              placeholderTextColor={theme.textTertiary}
              value={name}
              onChangeText={setName}
            />

            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border },
              ]}
              placeholder={t("command")}
              placeholderTextColor={theme.textTertiary}
              value={command}
              onChangeText={setCommand}
            />

            <ThemedText style={styles.label}>{t("arguments")}</ThemedText>
            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border },
              ]}
              value={args}
              onChangeText={setArgs}
            />

            <View style={styles.formRow}>
              <Button
                onPress={() => setIsAdding(false)}
                variant="outline"
                disabled={isConnecting}
              >
                {t("cancel")}
              </Button>
              <Button
                onPress={handleAddServer}
                disabled={isConnecting || !name}
              >
                {isConnecting ? t("connecting") : t("connect")}
              </Button>
            </View>
          </View>
        )}

        <View style={styles.list}>
          {isLoading ? (
            <ActivityIndicator size="large" color={theme.primary} />
          ) : servers.length === 0 ? (
            <ThemedText
              style={[styles.emptyText, { color: theme.textSecondary }]}
            >
              {t("noMcpServers")}
            </ThemedText>
          ) : (
            servers.map((server, index) => (
              <View
                key={index}
                style={[
                  styles.card,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.cardName}>
                      {server.name}
                    </ThemedText>
                    <ThemedText
                      style={[styles.cardDesc, { color: theme.textSecondary }]}
                    >
                      {server.command} {server.args.join(" ")}
                    </ThemedText>
                    {server.toolCount !== undefined && (
                      <ThemedText
                        style={[
                          styles.toolCount,
                          { color: theme.textTertiary },
                        ]}
                      >
                        {server.toolCount} {t("tools")}
                      </ThemedText>
                    )}
                  </View>
                  <View style={styles.cardActions}>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor:
                            server.status === "connected"
                              ? "#22c55e"
                              : "#94a3b8",
                        },
                      ]}
                    />
                    <Button
                      variant="outline"
                      style={styles.disconnectBtn}
                      onPress={() => handleDisconnect(server.name)}
                    >
                      {t("disconnect") || "Disconnect"}
                    </Button>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: Spacing.lg,
  },
  devBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  devBannerIcon: {
    marginRight: Spacing.sm,
  },
  devBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  addBtn: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  form: {
    margin: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: "bold",
    marginTop: Spacing.md,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  formRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
  },
  list: {
    padding: Spacing.lg,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardActions: {
    alignItems: "flex-end",
    gap: Spacing.xs,
    marginLeft: Spacing.md,
  },
  disconnectBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  cardName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  cardDesc: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: "monospace",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: Spacing.md,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    marginTop: Spacing.xl,
  },
  toolCount: {
    fontSize: 11,
    marginTop: 4,
  },
});
