import React from "react";

/**
 * Custom hook for copy-to-clipboard functionality.
 *
 * @returns `copied` flag and `copy` function that writes to the clipboard.
 */
export const useCopyToClipboard = () => {
  const [copied, setCopied] = React.useState(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return { copied, copy };
};
