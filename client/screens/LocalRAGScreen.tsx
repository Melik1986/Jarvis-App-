import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Alert,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { documentIndexer } from "@/lib/local-rag/document-indexer";
import {
  localVectorStore,
  LocalDocumentResult,
} from "@/lib/local-rag/vector-store";
import { AppLogger } from "@/lib/logger";

export default function LocalRAGScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [documents, setDocuments] = useState<LocalDocumentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [indexing, setIndexing] = useState(false);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      // We don't have a listAll method in vector-store yet, adding one
      // For now we'll just search with a zero vector to get all
      const results = await localVectorStore.search(
        new Array(1536).fill(0),
        100,
      );
      setDocuments(results);
    } catch (error) {
      AppLogger.error("Failed to fetch local documents:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleAddDocument = async () => {
    setIndexing(true);
    try {
      const doc = await documentIndexer.indexPickedDocument();
      if (doc) {
        fetchDocuments();
      }
    } catch (error) {
      AppLogger.error("Failed to index document:", error);
      Alert.alert("Error", "Failed to index document");
    } finally {
      setIndexing(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert("Delete", "Delete this document from local storage?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await localVectorStore.deleteDocument(id);
          fetchDocuments();
        },
      },
    ]);
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.header}>
        <ThemedText type="h2">Local RAG</ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          Manage your local knowledge base documents
        </ThemedText>
      </View>

      <Button
        onPress={handleAddDocument}
        disabled={indexing}
        style={{ marginHorizontal: Spacing.lg, marginBottom: Spacing.lg }}
      >
        {indexing ? "Indexing..." : "Add Document (PDF/Text)"}
      </Button>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={theme.primary}
          style={{ marginTop: 40 }}
        />
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          }}
          renderItem={({ item }) => (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <View style={styles.cardInfo}>
                <Ionicons
                  name={
                    item.metadata?.mimeType === "application/pdf"
                      ? "file-tray-full-outline"
                      : "document-text-outline"
                  }
                  size={24}
                  color={theme.primary}
                />
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <ThemedText style={styles.docName}>{item.name}</ThemedText>
                  <ThemedText
                    style={[styles.docMeta, { color: theme.textSecondary }]}
                  >
                    {new Date(item.createdAt).toLocaleDateString()} •{" "}
                    {((Number(item.metadata?.size) || 0) / 1024).toFixed(1)} KB
                  </ThemedText>
                </View>
                <Pressable onPress={() => handleDelete(item.id)}>
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={theme.error}
                  />
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="library-outline"
                size={48}
                color={theme.textTertiary}
              />
              <ThemedText
                style={{ color: theme.textTertiary, marginTop: Spacing.md }}
              >
                No local documents yet.
              </ThemedText>
            </View>
          }
        />
      )}
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
    marginBottom: Spacing.md,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  cardInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  docName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  docMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  empty: {
    alignItems: "center",
    marginTop: 60,
  },
});
