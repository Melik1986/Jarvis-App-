import React from "react";
import ImageViewing from "react-native-image-viewing";

interface ImageViewerProps {
  images: Array<{ uri: string }>;
  imageIndex: number;
  visible: boolean;
  onRequestClose: () => void;
  swipeToCloseEnabled?: boolean;
  doubleTapToZoomEnabled?: boolean;
}

export default function ImageViewerCompat(props: ImageViewerProps) {
  return <ImageViewing {...props} />;
}
