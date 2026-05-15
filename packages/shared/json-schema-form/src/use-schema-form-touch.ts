import { useState } from "react";

/**
 * Touch state for validation-on-blur in {@link SchemaForm}.
 */
export const useSchemaFormTouch = () => {
  const [touched, setTouched] = useState(false);
  return { touched, setTouched };
};
