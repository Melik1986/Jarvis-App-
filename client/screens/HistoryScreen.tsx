import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, FlatList, Pressable, Platform, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import * as Haptics from "expo-haptics";

import { AnimatedChatIcon, AnimatedTrashIcon } from "@/components/AnimatedIcons";

import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { Conversation } from "@/store/chatStore";

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
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

  const deleteConversation = async (id: number) => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}api/conversations/${id}`, {
        method: "DELETE",
      });
      if (response.ok || response.status === 204) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        console.error("Failed to delete conversation:", response.status);
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  const confirmDelete = (item: Conversation) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (Platform.OS === "web") {
      if (confirm(t("confirmDelete"))) {
        deleteConversation(item.id);
      }
    } else {
      Alert.alert(
        t("delete"),
        t("confirmDelete"),
        [
          { text: t("cancel"), style: "cancel" },
          { 
            text: t("delete"), 
            style: "destructive", 
            onPress: () => deleteConversation(item.id) 
          },
        ]
      );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return t("justNow");
    if (diffHours < 24) return `${diffHours}${t("hoursAgo")}`;
    if (diffDays < 7) return `${diffDays}${t("daysAgo")}`;
    return date.toLocaleDateString();
  };

  const handleItemPress = (item: Conversation) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const renderItem = useCallback(({ item }: { item: Conversation }) => (
    <View style={[styles.historyItem, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
      <Pressable 
        style={styles.itemMain}
        onPress={() => handleItemPress(item)}
      >
        <View style={[styles.itemIcon, { backgroundColor: theme.backgroundSecondary }]}>
          <AnimatedChatIcon size={20} color={theme.primary} />
        </View>
        <View style={styles.itemContent}>
          <ThemedText style={[styles.itemTitle, { color: theme.text }]} numberOfLines={1}>
            {item.title}
          </ThemedText>
          <ThemedText style={[styles.itemTimestamp, { color: theme.textTertiary }]}>
            {formatDate(item.createdAt)}
          </ThemedText>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: theme.success + "20" }]}>
          <View style={[styles.statusDot, { backgroundColor: theme.success }]} />
          <ThemedText style={[styles.statusText, { color: theme.success }]}>
            {t("completed")}
          </ThemedText>
        </View>
      </Pressable>
      <Pressable 
        style={[styles.deleteButton, { backgroundColor: theme.error + "15" }]}
        onPress={() => confirmDelete(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <AnimatedTrashIcon size={18} color={theme.error} />
      </Pressable>
    </View>
  ), [theme, t]);

  const renderEmpty = () => (
    <EmptyState
      image={require("../../assets/images/empty-history.png")}
      title={t("noActivityYet")}
      subtitle={t("historyAppearHere")}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.segmentContainer, { marginTop: headerHeight + Spacing.lg }]}>
        <SegmentedControl
          values={[t("commands"), t("analytics")]}
          selectedIndex={selectedIndex}
          onChange={(event) => setSelectedIndex(event.nativeEvent.selectedSegmentIndex)}
          style={styles.segmentedControl}
          backgroundColor={theme.backgroundDefault}
          tintColor={theme.primary}
          fontStyle={{ color: theme.textSecondary }}
          activeFontStyle={{ color: theme.buttonText }}
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
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  itemMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
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
    marginBottom: 2,
  },
  itemTimestamp: {
    fontSize: 13,
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
  deleteButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginRight: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  separator: {
    height: Spacing.sm,
  },
});
