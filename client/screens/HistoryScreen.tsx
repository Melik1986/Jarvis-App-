import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  StyleSheet,
  View,
  SectionList,
  Pressable,
  Platform,
  TextInput,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  useNavigation,
  useFocusEffect,
  CompositeNavigationProp,
} from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainTabParamList } from "@/navigation/MainTabNavigator";
import type { HistoryStackParamList } from "@/navigation/HistoryStackNavigator";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { Spacing, BorderRadius } from "@/constants/theme";
import { localStore, type LocalConversation } from "@/lib/local-store";
import { AppLogger } from "@/lib/logger";

type HistoryNavProp = CompositeNavigationProp<
  NativeStackNavigationProp<HistoryStackParamList, "History">,
  BottomTabNavigationProp<MainTabParamList>
>;

interface Section {
  title: string;
  data: LocalConversation[];
}

type AppTheme = ReturnType<typeof useTheme>["theme"];
type TranslationFn = ReturnType<typeof useTranslation>["t"];

function SearchBar({
  value,
  onChangeText,
  theme,
  t,
  style,
}: {
  value: string;
  onChangeText: (text: string) => void;
  theme: AppTheme;
  t: TranslationFn;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.searchContainer, style]}>
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: theme.border,
          },
        ]}
      >
        <Ionicons
          name="search"
          size={18}
          color={theme.textTertiary}
          style={{ marginRight: Spacing.sm }}
        />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder={t("searchConversations") || "Search conversations..."}
          placeholderTextColor={theme.textTertiary}
          value={value}
          onChangeText={onChangeText}
          returnKeyType="search"
          autoCorrect={false}
        />
        {value.length > 0 && (
          <Pressable onPress={() => onChangeText("")}>
            <Ionicons
              name="close-circle"
              size={18}
              color={theme.textTertiary}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function EmptyHistoryState({
  theme,
  t,
}: {
  theme: AppTheme;
  t: TranslationFn;
}) {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="time-outline"
        size={120}
        color={theme.textTertiary}
        style={{ marginBottom: Spacing.lg, opacity: 0.5 }}
      />
      <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
        {t("noActivityYet") || "No activity yet"}
      </ThemedText>
      <ThemedText style={{ color: theme.textSecondary }}>
        {t("historyAppearHere") || "Your conversations will appear here"}
      </ThemedText>
    </View>
  );
}

function HistoryItem({
  item,
  theme,
  onPress,
  onDelete,
  formatDate,
}: {
  item: LocalConversation;
  theme: AppTheme;
  onPress: (item: LocalConversation) => void;
  onDelete: (id: string) => void;
  formatDate: (ts: number | string) => string;
}) {
  const swipeableRef = useRef<Swipeable | null>(null);
  const isFork = !!item.forkedFrom;

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={() => (
        <Pressable
          style={[styles.swipeDelete, { backgroundColor: theme.error }]}
          onPress={() => {
            swipeableRef.current?.close();
            onDelete(item.id);
          }}
        >
          <Ionicons name="trash-outline" size={22} color="#fff" />
        </Pressable>
      )}
      rightThreshold={80}
      overshootRight={false}
    >
      <Pressable
        style={[
          styles.historyItem,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: theme.border,
          },
        ]}
        onPress={() => onPress(item)}
      >
        <View style={styles.itemIcon}>
          <Ionicons
            name={isFork ? "git-branch-outline" : "chatbubble-ellipses-outline"}
            size={22}
            color={isFork ? theme.warning : theme.primary}
          />
        </View>
        <View style={styles.itemContent}>
          <View style={styles.titleRow}>
            <ThemedText
              style={[styles.itemTitle, { color: theme.text }]}
              numberOfLines={1}
            >
              {item.title}
            </ThemedText>
            {isFork && (
              <View
                style={[
                  styles.forkBadge,
                  { backgroundColor: theme.warning + "20" },
                ]}
              >
                <ThemedText
                  style={[styles.forkBadgeText, { color: theme.warning }]}
                >
                  Fork
                </ThemedText>
              </View>
            )}
          </View>
          <ThemedText
            style={[styles.itemTimestamp, { color: theme.textTertiary }]}
          >
            {formatDate(item.createdAt)}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
      </Pressable>
    </Swipeable>
  );
}

/** Group conversations into date-based sections */
function groupByDate(
  items: LocalConversation[],
  t: (k: "today" | "yesterday" | "thisWeek" | "earlier") => string,
): Section[] {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 86400000 * 6;

  const today: LocalConversation[] = [];
  const yesterday: LocalConversation[] = [];
  const thisWeek: LocalConversation[] = [];
  const earlier: LocalConversation[] = [];

  for (const item of items) {
    const ts = item.createdAt;
    if (ts >= todayStart) today.push(item);
    else if (ts >= yesterdayStart) yesterday.push(item);
    else if (ts >= weekStart) thisWeek.push(item);
    else earlier.push(item);
  }

  const sections: Section[] = [];
  if (today.length > 0)
    sections.push({ title: t("today") || "Today", data: today });
  if (yesterday.length > 0)
    sections.push({ title: t("yesterday") || "Yesterday", data: yesterday });
  if (thisWeek.length > 0)
    sections.push({ title: t("thisWeek") || "This Week", data: thisWeek });
  if (earlier.length > 0)
    sections.push({ title: t("earlier") || "Earlier", data: earlier });

  return sections;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<HistoryNavProp>();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const [conversations, setConversations] = useState<LocalConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await localStore.listConversations();
      setConversations(data);
    } catch (error) {
      AppLogger.error("Failed to load conversations:", error);
    }
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadConversations();
    }, [loadConversations]),
  );

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const sections = useMemo(
    () => groupByDate(filteredConversations, t),
    [filteredConversations, t],
  );

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await localStore.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      AppLogger.error("Failed to delete conversation:", error);
    }
  }, []);

  const handleItemPress = useCallback(
    (item: LocalConversation) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      navigation.navigate("ChatTab", {
        screen: "Chat",
        params: { conversationId: item.id },
      } as never);
    },
    [navigation],
  );

  const handleNewChat = useCallback(async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      const newConv = await localStore.createConversation(t("newChat"));
      navigation.navigate("ChatTab", {
        screen: "Chat",
        params: { conversationId: newConv.id },
      } as never);
    } catch (error) {
      AppLogger.error("Failed to create new conversation:", error);
    }
  }, [navigation, t]);

  const formatDate = useCallback(
    (ts: number | string) => {
      const date = new Date(ts);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

      if (diffHours < 1) return t("justNow") || "Just now";
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString();
    },
    [t],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <View style={styles.sectionHeader}>
        <ThemedText
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          {section.title}
        </ThemedText>
      </View>
    ),
    [theme.textSecondary],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        theme={theme}
        t={t}
        style={{ marginTop: headerHeight + Spacing.sm }}
      />

      <SectionList
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + Spacing.xl + 80 },
          sections.length === 0 && styles.emptyListContent,
        ]}
        sections={sections}
        renderItem={({ item }) => (
          <HistoryItem
            item={item}
            theme={theme}
            onPress={handleItemPress}
            onDelete={deleteConversation}
            formatDate={formatDate}
          />
        )}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<EmptyHistoryState theme={theme} t={t} />}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        stickySectionHeadersEnabled={false}
        refreshing={isLoading}
        onRefresh={loadConversations}
      />

      <Pressable
        style={[
          styles.fab,
          {
            backgroundColor: theme.primary,
            bottom: tabBarHeight + Spacing.lg,
          },
        ]}
        onPress={handleNewChat}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: Spacing.sm,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === "ios" ? Spacing.sm : 2,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  emptyListContent: {
    justifyContent: "center",
    flexGrow: 1,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
    marginTop: Spacing.xl,
  },
  sectionHeader: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  itemIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  itemContent: {
    flex: 1,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "500",
    flexShrink: 1,
  },
  forkBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  forkBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  itemTimestamp: {
    fontSize: 12,
    marginTop: 2,
  },
  swipeDelete: {
    width: 80,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    marginLeft: 8,
  },
  separator: {
    height: 8,
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
