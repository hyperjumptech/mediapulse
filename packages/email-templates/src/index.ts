// Auto-generated registry scaffold.
import React from "react";

// For this project, the only template required dynamically is the newsletter.
// The template will be rendered inside the `delivery` agent, but the framework guide
// implies a registry structure. We'll simply export a flexible map type for now.
export type TemplateMap = {
  "newsletter": any;
};

// And an empty registry
export const templates: Record<keyof TemplateMap, React.FC<any>> = {
    "newsletter": () => null
};
