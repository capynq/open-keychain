type ReactExceptionCapture = (error: Error) => void;

let capture: ReactExceptionCapture | undefined;

export const registerReactExceptionCapture = (handler: ReactExceptionCapture): void => {
  capture = handler;
};

export const captureReactException = (error: Error): void => {
  capture?.(error);
};
