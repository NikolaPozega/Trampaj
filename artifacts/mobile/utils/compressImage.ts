import * as ImageManipulator from "expo-image-manipulator";

export async function compressImage(
  uri: string,
  maxWidth: number,
  quality = 0.6
): Promise<{ uri: string; base64: string }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return { uri: result.uri, base64: result.base64 ?? "" };
}
