"use client";

import { useEffect, useState } from "react";

/**
 * Opens the dev preview dialog after mount so Playwright can capture the create form.
 */
export const useCreateApiKeyModalDevPreviewDialog = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(true);
  }, []);

  return { open, setOpen };
};
