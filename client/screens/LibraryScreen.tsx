import React, { useState } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  FlatList,
  Pressable,
  Platform,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Svg, { Path, Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";

import {
  AnimatedSearchIcon,
  AnimatedChevronIcon,
  AnimatedDocumentIcon,
} from "@/components/AnimatedIcons";
import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { Spacing, BorderRadius } from "@/constants/theme";

type CategoryIconName = "book" | "mic" | "camera" | "link" | "chart";

interface KnowledgeCategory {
  id: string;
  title: string;
  description: string;
  icon: CategoryIconName;
  articleCount: number;
}

function CategoryIcon({
  name,
  size = 24,
  color,
}: {
  name: CategoryIconName;
  size?: number;
  color: string;
}) {
  const strokeWidth = 1.5;

  switch (name) {
    case "book":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case "mic":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M19 10v2a7 7 0 0 1-14 0v-2"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M12 19v3"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case "camera":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle
            cx="12"
            cy="13"
            r="4"
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
    case "link":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case "chart":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M18 20V10"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M12 20V4"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M6 20v-6"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle
            cx="12"
            cy="12"
            r="10"
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
  }
}

function CloseIcon({
  size = 20,
  color,
  backgroundColor,
}: {
  size?: number;
  color: string;
  backgroundColor: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" fill={color} />
      <Path
        d="M15 9l-6 6M9 9l6 6"
        stroke={backgroundColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const categories: KnowledgeCategory[] = [
  {
    id: "1",
    title: "Getting Started",
    description: "Learn the basics of using Jarvis",
    icon: "book",
    articleCount: 5,
  },
  {
    id: "2",
    title: "Voice Commands",
    description: "Master voice interactions",
    icon: "mic",
    articleCount: 12,
  },
  {
    id: "3",
    title: "Document Scanning",
    description: "Scan invoices and receipts",
    icon: "camera",
    articleCount: 8,
  },
  {
    id: "4",
    title: "ERP Integration",
    description: "Connect to your business systems",
    icon: "link",
    articleCount: 15,
  },
  {
    id: "5",
    title: "Reports & Analytics",
    description: "Generate business insights",
    icon: "chart",
    articleCount: 10,
  },
];

export default function LibraryScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCategories, setFilteredCategories] = useState(categories);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      const filtered = categories.filter(
        (cat) =>
          cat.title.toLowerCase().includes(query.toLowerCase()) ||
          cat.description.toLowerCase().includes(query.toLowerCase()),
      );
      setFilteredCategories(filtered);
    } else {
      setFilteredCategories(categories);
    }
  };

  const handleCategoryPress = (item: KnowledgeCategory) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const renderCategory = ({ item }: { item: KnowledgeCategory }) => (
    <Pressable
      style={({ pressed }) => [
        styles.categoryCard,
        { backgroundColor: theme.backgroundDefault },
        pressed && { backgroundColor: theme.backgroundSecondary },
      ]}
      onPress={() => handleCategoryPress(item)}
    >
      <View
        style={[
          styles.categoryIcon,
          { backgroundColor: theme.backgroundSecondary },
        ]}
      >
        <CategoryIcon name={item.icon} size={24} color={theme.primary} />
      </View>
      <View style={styles.categoryContent}>
        <ThemedText
          type="h4"
          style={[styles.categoryTitle, { color: theme.text }]}
        >
          {item.title}
        </ThemedText>
        <ThemedText
          style={[styles.categoryDescription, { color: theme.textSecondary }]}
        >
          {item.description}
        </ThemedText>
        <View style={styles.articleCount}>
          <AnimatedDocumentIcon size={14} color={theme.textTertiary} />
          <ThemedText
            style={[styles.articleCountText, { color: theme.textTertiary }]}
          >
            {item.articleCount} {t("documents").toLowerCase()}
          </ThemedText>
        </View>
      </View>
      <AnimatedChevronIcon size={20} color={theme.textTertiary} />
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          styles.searchContainer,
          { marginTop: headerHeight + Spacing.lg },
        ]}
      >
        <View
          style={[
            styles.searchInputWrapper,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <AnimatedSearchIcon size={20} color={theme.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder={`${t("knowledgeBase")}...`}
            placeholderTextColor={theme.textTertiary}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => handleSearch("")}>
              <CloseIcon
                size={20}
                color={theme.textTertiary}
                backgroundColor={theme.backgroundRoot}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={filteredCategories}
        keyExtractor={(item) => item.id}
        renderItem={renderCategory}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            title={t("emptyLibrary")}
            subtitle={t("uploadDocsHint")}
            image={require("../../assets/images/empty-library.png")}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Platform.select({ ios: Spacing.sm, android: Spacing.xs }),
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  categoryContent: {
    flex: 1,
  },
  categoryTitle: {
    marginBottom: Spacing.xs,
  },
  categoryDescription: {
    fontSize: 14,
    marginBottom: Spacing.xs,
  },
  articleCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  articleCountText: {
    fontSize: 12,
  },
});
