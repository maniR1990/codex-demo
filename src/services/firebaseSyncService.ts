import type { FirebaseApp } from 'firebase/app';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
  type User
} from 'firebase/auth';
import {
  doc,
  enableIndexedDbPersistence,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import type { FinancialSnapshot, FirebaseSyncConfig } from '../types';
import { normaliseMergedSnapshot } from '../utils/snapshotMerge';

export interface FirebaseSyncCallbacks {
  onStatusChange?: (status: 'idle' | 'connecting' | 'connected' | 'error', error?: Error) => void;
  onRemoteSnapshot?: (snapshot: FinancialSnapshot) => void;
}

class FirebaseSyncService {
  private app: FirebaseApp | null = null;
  private user: User | null = null;
  private unsubscribe: (() => void) | null = null;
  private callbacks: FirebaseSyncCallbacks | undefined;
  private config: FirebaseSyncConfig | null = null;

  async configure(config: FirebaseSyncConfig, callbacks?: FirebaseSyncCallbacks) {
    this.callbacks = callbacks;
    this.config = config;
    this.callbacks?.onStatusChange?.('connecting');

    if (!this.app) {
      const existing = getApps();
      this.app = existing.length > 0 ? getApp() : initializeApp(config, 'wealth-accelerator');
    }

    const auth = getAuth(this.app);
    this.user = await this.ensureAuthSession(auth, config);

    const firestore = getFirestore(this.app);
    try {
      await enableIndexedDbPersistence(firestore);
    } catch {
      // Persistence may already be enabled; ignore.
    }

    await this.attachListener(firestore, this.user.uid);
    this.callbacks?.onStatusChange?.('connected');
  }

  async pushSnapshot(snapshot: FinancialSnapshot) {
    if (!this.app || !this.user) throw new Error('Firebase sync not initialised');
    const firestore = getFirestore(this.app);
    const docRef = doc(firestore, 'users', this.user.uid, 'snapshots', 'primary');
    await setDoc(
      docRef,
      {
        payload: snapshot,
        revision: snapshot.revision,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }

  async fetchRemoteSnapshot(): Promise<FinancialSnapshot | null> {
    if (!this.app || !this.user) return null;
    const firestore = getFirestore(this.app);
    const docRef = doc(firestore, 'users', this.user.uid, 'snapshots', 'primary');
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    if (!data?.payload) return null;
    return normaliseMergedSnapshot(data.payload as FinancialSnapshot);
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.callbacks?.onStatusChange?.('idle');
  }

  private async ensureAuthSession(auth: ReturnType<typeof getAuth>, config: FirebaseSyncConfig) {
    const current = auth.currentUser;
    if (current) return current;

    await new Promise<void>((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(
        auth,
        (user) => {
          if (user) {
            this.user = user;
            unsubscribe();
            resolve();
          }
        },
        (error) => {
          unsubscribe();
          reject(error);
        }
      );

      const signInPromise = config.useCustomToken && config.customToken
        ? signInWithCustomToken(auth, config.customToken)
        : signInAnonymously(auth);

      signInPromise.catch((error) => {
        unsubscribe();
        this.callbacks?.onStatusChange?.('error', error);
        reject(error);
      });
    });

    if (!auth.currentUser) {
      throw new Error('Unable to establish Firebase authentication session');
    }

    return auth.currentUser;
  }

  private async attachListener(firestore: ReturnType<typeof getFirestore>, uid: string) {
    this.unsubscribe?.();
    const docRef = doc(firestore, 'users', uid, 'snapshots', 'primary');
    this.unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        const data = snapshot.data();
        if (data?.payload) {
          const normalised = normaliseMergedSnapshot(data.payload as FinancialSnapshot);
          this.callbacks?.onRemoteSnapshot?.(normalised);
        }
      },
      (error) => {
        this.callbacks?.onStatusChange?.('error', error);
      }
    );
  }
}

export const firebaseSyncService = new FirebaseSyncService();
