export type CryptoLike = {
  getRandomValues?: (array: ArrayBufferView) => ArrayBufferView;
};

type MutableGlobal = Omit<typeof globalThis, 'crypto'> & { crypto?: CryptoLike };

export function setupWebCrypto(cryptoProvider?: CryptoLike) {
  const globalObj = globalThis as MutableGlobal;

  const hasGetRandomValues =
    typeof globalObj.crypto?.getRandomValues === 'function';

  if (!hasGetRandomValues && cryptoProvider) {
    globalObj.crypto = cryptoProvider;
  }
}
