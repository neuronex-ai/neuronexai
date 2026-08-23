export type MermaidVisualTheme = "dark" | "light";

let renderSequence = 0;
let renderQueue: Promise<void> = Promise.resolve();

const cleanMermaidSource = (value: string) =>
  value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r\n/g, "\n")
    .trim();

const nextRenderId = () => {
  renderSequence += 1;
  return `neuronex-mermaid-${Date.now()}-${renderSequence}`;
};

/**
 * Mermaid keeps a global configuration. Serializing renders prevents diagrams
 * with different themes from changing one another while they are rendering.
 */
export const renderMermaidSvg = (
  source: string,
  theme: MermaidVisualTheme,
): Promise<string> => {
  const task = renderQueue.then(async () => {
    const cleanSource = cleanMermaidSource(source);
    if (!cleanSource) throw new Error("EMPTY_MERMAID_SOURCE");

    const { default: mermaid } = await import("mermaid");
    const isDark = theme === "dark";

    mermaid.initialize({
      startOnLoad: false,
      suppressErrorRendering: true,
      securityLevel: "strict",
      theme: "base",
      themeVariables: {
        darkMode: isDark,
        background: isDark ? "#080808" : "#ffffff",
        primaryColor: isDark ? "#151515" : "#ffffff",
        primaryTextColor: isDark ? "#ffffff" : "#09090b",
        primaryBorderColor: isDark ? "#52525b" : "#52525b",
        lineColor: isDark ? "#8b8b94" : "#8b8b94",
        textColor: isDark ? "#e4e4e7" : "#27272a",
        mainBkg: isDark ? "#151515" : "#ffffff",
        nodeBorder: isDark ? "#52525b" : "#52525b",
        clusterBkg: isDark ? "#0d0d0d" : "#ffffff",
        clusterBorder: isDark ? "#3f3f46" : "#e4e4e7",
        defaultLinkColor: isDark ? "#8b8b94" : "#a1a1aa",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      },
      flowchart: {
        htmlLabels: true,
        curve: "basis",
      },
    });

    const { svg } = await mermaid.render(nextRenderId(), cleanSource);
    return svg;
  });

  renderQueue = task.then(
    () => undefined,
    () => undefined,
  );

  return task;
};
