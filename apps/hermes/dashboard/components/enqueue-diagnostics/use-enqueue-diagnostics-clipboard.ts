import { useCallback, useState } from "react";

/**
 * Clipboard copy with per-row "Copied" feedback (correlation ids, etc.).
 */
export const useKeyedClipboardCopyFeedback = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyForKey = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setCopiedKey(null);
    }
  }, []);

  return { copiedKey, copyForKey };
};

/**
 * Clipboard copy for a single string with short "Copied" feedback.
 */
export const useClipboardCopyFeedback = (text: string) => {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [text]);

  return { copied, copy };
};
