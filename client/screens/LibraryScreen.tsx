import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  FlatList,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";

import { LibraryStackParamList } from "@/navigation/LibraryStackNavigator";
import { AnimatedSearchIcon } from "@/components/AnimatedIcons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { Spacing, BorderRadius } from "@/constants/theme";
import { localVectorStore } from "@/lib/local-rag/vector-store";
import { documentIndexer } from "@/lib/local-rag/document-indexer";
import { AppLogger } from "@/lib/logger";

interface DocumentDisplay {
  id: string;
  name: string;
  type: string;
  size: string;
  createdAt: number;
  status: "ready" | "processing";
}

const DocumentTypeIcon = ({
  type,
  size,
  color,
}: {
  type: string;
  size: number;
  color: string;
}) => {
  return <Ionicons name="document-text-outline" size={size} color={color} />;
};

function PlusIcon({ size = 24, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TrashIcon({ size = 20, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function performDocumentLoad(
  setIsLoading: (v: boolean) => void,
  setDocuments: (docs: DocumentDisplay[]) => void,
  currentTimeRef: React.MutableRefObject<number>,
) {
  try {
    setIsLoading(true);
    const docs = await localVectorStore.listAll();
    setDocuments(
      docs.map((doc) => ({
        id: doc.id,
        name: doc.name,
        type: (doc.metadata?.type as string) || "other",
        size: formatBytes((doc.metadata?.size as number) || doc.content.length),
        createdAt: doc.createdAt,
        status: "ready" as const,
      })),
    );
    currentTimeRef.current = Date.now();
  } catch (error) {
    AppLogger.error("Failed to load local documents:", error);
  }
  setIsLoading(false);
}

export default function LibraryScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp<LibraryStackParamList>>();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState("");
  const [documents, setDocuments] = useState<DocumentDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const currentTimeRef = React.useRef(0);

  /** Load documents from local SQLite */
  const loadDocuments = useCallback(async () => {
    await performDocumentLoad(setIsLoading, setDocuments, currentTimeRef);
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  /** Upload: pick file -> server extracts text -> store in SQLite */
  const handleUploadDocument = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      setIsUploading(true);
      const doc = await documentIndexer.indexPickedDocument();
      if (doc) {
        await loadDocuments();
        Alert.alert(t("success"), `${doc.name} saved`);
      }
    } catch (error) {
      AppLogger.error("Upload error:", error);
      Alert.alert(t("error"), t("uploadFailed"));
    }
    setIsUploading(false);
  };

  /** Delete from local SQLite */
  const handleDeleteDocument = (docId: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    Alert.alert(t("confirmDelete"), t("deleteDocumentConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          await localVectorStore.deleteDocument(docId);
          await loadDocuments();
        },
      },
    ]);
  };

  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    return documents.filter((doc) =>
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [documents, searchQuery]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const getStatusColor = (status: DocumentDisplay["status"]) => {
    return status === "ready" ? theme.success : theme.warning;
  };

  const getStatusText = (status: DocumentDisplay["status"]) => {
    return status === "ready" ? t("indexed") : t("processing");
  };

  const formatDate = useCallback(
    (timestamp: number) => {
      const diff = currentTimeRef.current - timestamp;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return t("justNow");
      if (hours < 1) return `${minutes}m`;
      if (days < 1) return `${hours}${t("hoursAgo")}`;
      return `${days}${t("daysAgo")}`;
    },
    [t],
  );

  const handleDocumentPress = (item: DocumentDisplay) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("DocumentViewer", {
      documentId: item.id,
      documentName: item.name,
    });
  };

  const renderDocument = ({ item }: { item: DocumentDisplay }) => (
    <Pressable
      style={({ pressed }) => [
        styles.documentCard,
        { backgroundColor: theme.backgroundDefault },
        pressed && { opacity: 0.7 },
      ]}
      onPress={() => handleDocumentPress(item)}
    >
      <View style={styles.documentIcon}>
        <DocumentTypeIcon type={item.type} size={32} color={theme.primary} />
      </View>
      <View style={styles.documentContent}>
        <ThemedText
          type="body"
          style={[styles.documentName, { color: theme.text }]}
          numberOfLines={1}
        >
          {item.name}
        </ThemedText>
        <View style={styles.documentMeta}>
          <ThemedText
            style={[styles.documentSize, { color: theme.textSecondary }]}
          >
            {item.size}
          </ThemedText>
          <ThemedText
            style={[styles.documentDate, { color: theme.textTertiary }]}
          >
            {formatDate(item.createdAt)}
          </ThemedText>
        </View>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          />
          <ThemedText
            style={[styles.statusText, { color: getStatusColor(item.status) }]}
          >
            {getStatusText(item.status)}
          </ThemedText>
        </View>
      </View>
      <Pressable
        style={styles.deleteButton}
        onPress={() => handleDeleteDocument(item.id)}
        hitSlop={8}
      >
        <TrashIcon size={20} color={theme.textTertiary} />
      </Pressable>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[styles.headerSection, { marginTop: headerHeight + Spacing.lg }]}
      >
        <View style={styles.titleRow}>
          <ThemedText type="h2" style={{ color: theme.text }}>
            {t("knowledgeBase")}
          </ThemedText>
          <Pressable
            style={[styles.uploadButton, { backgroundColor: theme.primary }]}
            onPress={handleUploadDocument}
          >
            <PlusIcon size={20} color="#FFFFFF" />
            <ThemedText style={styles.uploadButtonText}>
              {t("uploadDocument")}
            </ThemedText>
          </Pressable>
        </View>

        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          {t("ragLibraryDesc")}
        </ThemedText>

        <View
          style={[
            styles.searchInputWrapper,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <AnimatedSearchIcon size={20} color={theme.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder={t("searchDocuments")}
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

      {isUploading ? <View style={styles.loadingOverlay} /> : null}

      <FlatList
        data={filteredDocuments}
        keyExtractor={(item) => item.id}
        renderItem={renderDocument}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + Spacing.xl },
          filteredDocuments.length === 0 && styles.emptyListContent,
        ]}
        showsVerticalScrollIndicator={false}
        refreshing={isLoading}
        onRefresh={loadDocuments}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="document-text-outline"
              size={120}
              color={theme.textTertiary}
              style={{ marginBottom: Spacing.lg, opacity: 0.5 }}
            />
            <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
              {t("emptyLibrary")}
            </ThemedText>
            <ThemedText
              style={{ color: theme.textSecondary, marginBottom: Spacing.xl }}
            >
              {t("uploadDocsHint")}
            </ThemedText>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: Spacing.lg,
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
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
  documentCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  documentIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  documentContent: {
    flex: 1,
  },
  documentName: {
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  documentMeta: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  documentSize: {
    fontSize: 12,
  },
  documentDate: {
    fontSize: 12,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  deleteButton: {
    padding: Spacing.sm,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
});
