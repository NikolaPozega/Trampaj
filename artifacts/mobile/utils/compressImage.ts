import { Platform } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";

/**
 * On web, expo-image-manipulator returns a blob URL without base64, which
 * cannot be rendered by the Image component after the camera session ends.
 * Use FileReader to convert the blob URL to a data URL — renderable and
 * contains base64 for AI analysis.
 */
async function blobUrlToDataUrl(url: string): Promise<{ uri: string; base64: string }> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      resolve({ uri: dataUrl, base64: dataUrl.split(",")[1] ?? "" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function compressImage(
  uri: string,
  maxWidth: number,
  quality = 0.6
): Promise<{ uri: string; base64: string }> {
  // On web, skip canvas compression — just convert blob URL to data URL
  if (Platform.OS === "web") {
    return blobUrlToDataUrl(uri);
  }
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return { uri: result.uri, base64: result.base64 ?? "" };
}
