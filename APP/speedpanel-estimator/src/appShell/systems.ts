// =============================================================================
// Wall and system config
// =============================================================================
export const SYSTEMS = [
  { id: "int-vert",  label: "Vertical",   sub: "Internal Wall", ext: false, orient: "vertical"   as const },
  { id: "int-horiz", label: "Horizontal", sub: "Internal Wall", ext: false, orient: "horizontal" as const },
  { id: "ext-vert",  label: "Vertical",   sub: "External Wall", ext: true,  orient: "vertical"   as const },
  { id: "ext-horiz", label: "Horizontal", sub: "External Wall", ext: true,  orient: "horizontal" as const },
];
