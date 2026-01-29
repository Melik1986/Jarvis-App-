import React, { useState } from "react";
import { StyleSheet, View, TextInput, FlatList, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface KnowledgeCategory {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  articleCount: number;
}

const categories: KnowledgeCategory[] = [
  {
    id: "1",
    title: "Getting Started",
    description: "Learn the basics of using Jarvis",
    icon: "book-outline",
    articleCount: 5,
  },
  {
    id: "2",
    title: "Voice Commands",
    description: "Master voice interactions",
    icon: "mic-outline",
    articleCount: 12,
  },
  {
    id: "3",
    title: "Document Scanning",
    description: "Scan invoices and receipts",
    icon: "camera-outline",
    articleCount: 8,
  },
  {
    id: "4",
    title: "ERP Integration",
    description: "Connect to your business systems",
    icon: "link-outline",
    articleCount: 15,
  },
  {
    id: "5",
    title: "Reports & Analytics",
    description: "Generate business insights",
    icon: "bar-chart-outline",
    articleCount: 10,
  },
];

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCategories, setFilteredCategories] = useState(categories);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      const filtered = categories.filter(
        (cat) =>
          cat.title.toLowerCase().includes(query.toLowerCase()) ||
          cat.description.toLowerCase().includes(query.toLowerCase())
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
      style={({ pressed }) => [styles.categoryCard, pressed && styles.categoryCardPressed]}
      onPress={() => handleCategoryPress(item)}
    >
      <View style={styles.categoryIcon}>
        <Ionicons name={item.icon} size={24} color={Colors.dark.primary} />
      </View>
      <View style={styles.categoryContent}>
        <ThemedText type="h4" style={styles.categoryTitle}>
          {item.title}
        </ThemedText>
        <ThemedText style={styles.categoryDescription}>
          {item.description}
        </ThemedText>
        <View style={styles.articleCount}>
          <Ionicons name="document-text-outline" size={14} color={Colors.dark.textTertiary} />
          <ThemedText style={styles.articleCountText}>
            {item.articleCount} articles
          </ThemedText>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.dark.textTertiary} />
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: Colors.dark.backgroundRoot }]}>
      <View
        style={[
          styles.searchContainer,
          { marginTop: headerHeight + Spacing.lg },
        ]}
      >
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color={Colors.dark.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search knowledge base..."
            placeholderTextColor={Colors.dark.textTertiary}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => handleSearch("")}>
              <Ionicons name="close-circle" size={20} color={Colors.dark.textTertiary} />
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
            title="No results found"
            subtitle="Try a different search term"
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
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.dark.text,
    paddingVertical: Platform.select({ ios: Spacing.sm, android: Spacing.xs }),
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  categoryCardPressed: {
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.dark.backgroundSecondary,
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
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.xs,
  },
  articleCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  articleCountText: {
    fontSize: 12,
    color: Colors.dark.textTertiary,
  },
});
