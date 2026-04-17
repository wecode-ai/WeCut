export interface EditorTransition {
  phase: "editing" | "loadingCrop";
  initialEditorImageDataUrl: string;
  initialEditorImageCropped: boolean;
}

export const resolveEditorTransition = (
  previewImageDataUrl: string,
): EditorTransition => {
  if (previewImageDataUrl) {
    return {
      initialEditorImageCropped: false,
      initialEditorImageDataUrl: previewImageDataUrl,
      phase: "editing",
    };
  }

  return {
    initialEditorImageCropped: true,
    initialEditorImageDataUrl: "",
    phase: "loadingCrop",
  };
};
