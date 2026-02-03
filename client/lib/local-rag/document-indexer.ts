import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { localVectorStore } from "./vector-store";
import { embeddingService } from "./embedding-service";
import { AppLogger } from "../logger";

export class DocumentIndexer {
  async indexPickedDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "text/plain"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return null;

      const file = result.assets[0];
      AppLogger.info(`Indexing document: ${file.name}`, undefined, "RAG");

      let content = "";
      if (file.mimeType === "text/plain") {
        content = await FileSystem.readAsStringAsync(file.uri);
      } else if (file.mimeType === "application/pdf") {
        // Simple PDF text extraction is hard on mobile without native libs
        // For now we'll just store metadata or use a service
        content = `PDF Content of ${file.name}`;
      }

      if (!content) return null;

      const embedding = await embeddingService.getEmbedding(content);

      const doc = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        content: content,
        embedding: embedding,
        metadata: {
          mimeType: file.mimeType,
          size: file.size,
          uri: file.uri,
        },
        createdAt: Date.now(),
      };

      await localVectorStore.addDocument(doc);
      AppLogger.info(`Successfully indexed: ${file.name}`, undefined, "RAG");
      return doc;
    } catch (error) {
      AppLogger.error("Failed to index document", error, "RAG");
      return null;
    }
  }

  async searchLocal(query: string) {
    const queryEmbedding = await embeddingService.getEmbedding(query);
    return localVectorStore.search(queryEmbedding);
  }
}

export const documentIndexer = new DocumentIndexer();
