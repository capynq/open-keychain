import { useEffect, useRef } from 'react';

import { createWebMcpTools, type WebMcpCustomizer, type WebMcpState } from '../model/tools';

export const useWebMcp = (customizer: WebMcpCustomizer, state: WebMcpState): void => {
  const customizerRef = useRef(customizer);
  const stateRef = useRef(state);

  useEffect(() => {
    customizerRef.current = customizer;
    stateRef.current = state;
  }, [customizer, state]);

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) return undefined;

    const controller = new AbortController();
    const tools = createWebMcpTools(
      {
        get params() {
          return customizerRef.current.params;
        },
        applyDesign: (changes) => customizerRef.current.applyDesign(changes),
      },
      {
        get template() {
          return stateRef.current.template;
        },
        get style() {
          return stateRef.current.style;
        },
        get font() {
          return stateRef.current.font;
        },
        get printable() {
          return stateRef.current.printable;
        },
        get busy() {
          return stateRef.current.busy;
        },
        get error() {
          return stateRef.current.error;
        },
        get dimensions() {
          return stateRef.current.dimensions;
        },
      },
    );
    void Promise.all(
      (tools as unknown as WebMCP.ModelContextTool[]).map((tool) =>
        modelContext.registerTool(tool, { signal: controller.signal }),
      ),
    ).catch(() => undefined);
    return () => controller.abort();
  }, []);
};
