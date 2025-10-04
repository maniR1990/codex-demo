export type CryptoLike = {
  getRandomValues?: (array: ArrayBufferView) => ArrayBufferView;
};

export function setupWebCrypto(cryptoProvider?: CryptoLike) {
  const globalObj = globalThis as typeof globalThis & { crypto?: CryptoLike };

  const hasGetRandomValues =
    typeof globalObj.crypto?.getRandomValues === 'function';

  if (!hasGetRandomValues && cryptoProvider) {
    globalObj.crypto = cryptoProvider;
  }
}
