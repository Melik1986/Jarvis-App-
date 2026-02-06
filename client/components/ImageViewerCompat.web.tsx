import React from "react";
import { Modal, View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";

interface ImageViewerProps {
  images: Array<{ uri: string }>;
  imageIndex: number;
  visible: boolean;
  onRequestClose: () => void;
  swipeToCloseEnabled?: boolean;
  doubleTapToZoomEnabled?: boolean;
}

export default function ImageViewerCompat({
  images,
  imageIndex,
  visible,
  onRequestClose,
}: ImageViewerProps) {
  if (!visible) return null;
  const currentImage = images[imageIndex];
  if (!currentImage) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.closeButton} onPress={onRequestClose}>
          <Feather name="x" size={28} color="#fff" />
        </Pressable>
        <Image
          source={{ uri: currentImage.uri }}
          style={styles.image}
          contentFit="contain"
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  image: {
    width: "90%" as unknown as number,
    height: "80%" as unknown as number,
  },
});
