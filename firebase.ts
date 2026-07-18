import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

let firebaseApp: any = null;
let firebaseAuth: any = null;
let firebaseDb: any = null;

// Try to load user's firebaseConfig at runtime. If missing, we won't initialize.
export function initFirebase() {
  let firebaseConfig: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    firebaseConfig = require('./firebaseConfig').default;
  } catch (e) {
    // no config provided
    return { configured: false };
  }

  const alreadyInitialized = getApps().length > 0;
  if (!alreadyInitialized) {
    firebaseApp = initializeApp(firebaseConfig as any);
  }

  if (!firebaseAuth) {
    // Web has its own built-in persistence; native (iOS/Android) needs AsyncStorage wired in explicitly.
    // getReactNativePersistence only exists on @firebase/auth's "react-native" build, not the firebase/auth wrapper.
    if (Platform.OS === 'web' || alreadyInitialized) {
      firebaseAuth = getAuth(firebaseApp);
    } else {
      const { getReactNativePersistence } = require('@firebase/auth');
      firebaseAuth = initializeAuth(firebaseApp, { persistence: getReactNativePersistence(AsyncStorage) });
    }
  }

  if (!firebaseDb) {
    firebaseDb = getFirestore(firebaseApp);
  }

  return { configured: true, app: firebaseApp, auth: firebaseAuth, db: firebaseDb };
}

export default initFirebase;
