/**
 * Reads an uploaded file as UTF-8 text using `FileReader` (works in browsers and jsdom).
 *
 * @param uploaded - File from an `<input type="file" />`.
 * @returns File contents as a string.
 */
export const readUploadedFileAsUtf8Text = (uploaded: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("File read failed"));
    };
    reader.readAsText(uploaded);
  });
