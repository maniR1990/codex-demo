declare module 'react/jsx-runtime' {
  export const Fragment: any;
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
}

declare namespace JSX {
  type DOMAttributes<T = any> = {
    [prop: string]: any;
    onChange?: (event: import('react').ChangeEvent<T>) => void;
    onInput?: (event: import('react').ChangeEvent<T>) => void;
    onSubmit?: (event: import('react').FormEvent<T>) => void;
    onClick?: (event: import('react').SyntheticEvent<T>) => void;
  };

  interface IntrinsicElements {
    [elementName: string]: DOMAttributes<any>;
  }
}
