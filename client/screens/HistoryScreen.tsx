import React, { useState, useEffect } from "react";
import { StyleSheet, View, FlatList, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import * as Haptics from "expo-haptics";

import { AnimatedChatIcon } from "@/components/AnimatedIcons";

import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { Conversation } from "@/store/chatStore";

interface HistoryItem {
  id: number;
  title: string;
  timestamp: string;
  status: "success" | "pending" | "error";
  type: "command" | "analytics";
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}api/conversations`);
      const data = await response.json();
      setConversations(data);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return Colors.dark.success;
      case "error":
        return Colors.dark.error;
      default:
        return Colors.dark.warning;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleItemPress = (item: Conversation) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const renderItem = ({ item }: { item: Conversation }) => (
    <Pressable 
      style={({ pressed }) => [styles.historyItem, pressed && styles.historyItemPressed]}
      onPress={() => handleItemPress(item)}
    >
      <View style={styles.itemIcon}>
        <AnimatedChatIcon size={20} color={Colors.dark.primary} />
      </View>
      <View style={styles.itemContent}>
        <ThemedText style={styles.itemTitle} numberOfLines={1}>
          {item.title}
        </ThemedText>
        <ThemedText style={styles.itemTimestamp}>
          {formatDate(item.createdAt)}
        </ThemedText>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: Colors.dark.success + "20" }]}>
        <View style={[styles.statusDot, { backgroundColor: Colors.dark.success }]} />
        <ThemedText style={[styles.statusText, { color: Colors.dark.success }]}>
          Completed
        </ThemedText>
      </View>
    </Pressable>
  );

  const renderEmpty = () => (
    <EmptyState
      image={require("../../assets/images/empty-history.png")}
      title="No activity yet"
      subtitle="Your command history will appear here"
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: Colors.dark.backgroundRoot }]}>
      <View style={[styles.segmentContainer, { marginTop: headerHeight + Spacing.lg }]}>
        <SegmentedControl
          values={["Commands", "Analytics"]}
          selectedIndex={selectedIndex}
          onChange={(event) => setSelectedIndex(event.nativeEvent.selectedSegmentIndex)}
          style={styles.segmentedControl}
          backgroundColor={Colors.dark.backgroundDefault}
          tintColor={Colors.dark.primary}
          fontStyle={{ color: Colors.dark.textSecondary }}
          activeFontStyle={{ color: Colors.dark.buttonText }}
        />
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + Spacing.xl },
          conversations.length === 0 && styles.emptyListContent,
        ]}
        data={conversations}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={renderEmpty}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshing={isLoading}
        onRefresh={loadConversations}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  segmentedControl: {
    height: 40,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    flexGrow: 1,
  },
  emptyListContent: {
    justifyContent: "center",
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  historyItemPressed: {
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.dark.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  itemTimestamp: {
    fontSize: 13,
    color: Colors.dark.textTertiary,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: Spacing.xs,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  separator: {
    height: Spacing.sm,
  },
});
