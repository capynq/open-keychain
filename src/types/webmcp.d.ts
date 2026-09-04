declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface FormHTMLAttributes<T> {
    toolname?: string;
    tooldescription?: string;
    toolautosubmit?: boolean;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface InputHTMLAttributes<T> {
    toolparamdescription?: string;
  }
}

export {};
