declare module 'react' {
  export type ReactNode = any;
  export interface FC<P = {}> {
    (props: P & { children?: ReactNode }): ReactNode;
  }

  export interface ChangeEvent<T = any> extends SyntheticEvent<T> {}

  export interface SyntheticEvent<T = any> {
    target: T;
    currentTarget: T;
    preventDefault(): void;
    stopPropagation(): void;
  }

  export interface FormEvent<T = any> extends SyntheticEvent<T> {}

  export interface MutableRefObject<T> {
    current: T;
  }

  export type Dispatch<A> = (value: A) => void;
  export type SetStateAction<S> = S | ((prevState: S) => S);

  export function useState<S = any>(initialState?: S | (() => S)): [
    S,
    (value: SetStateAction<S> | null | undefined) => void
  ];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useMemo<T>(factory: () => T, deps?: any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps?: any[]): T;
  export function useRef<T>(initialValue: T | null): MutableRefObject<T | null>;

  export interface Context<T> {
    Provider: FC<{ value: T; children?: ReactNode }>;
    Consumer: FC<{ children: (value: T) => ReactNode }>;
    _currentValue?: T;
  }

  export function useContext<T>(context: Context<T>): T;
  export function createContext<T>(defaultValue: T): Context<T>;

  export const Fragment: FC<{ children?: ReactNode }>;

  const React: {
    StrictMode: FC<{ children?: ReactNode }>;
  };

  export default React;
}

declare module 'react-dom/client' {
  interface Root {
    render(children: any): void;
  }
  export function createRoot(container: Element | DocumentFragment): Root;
  const ReactDOMClient: {
    createRoot: typeof createRoot;
  };
  export default ReactDOMClient;
}
