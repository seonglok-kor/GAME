import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

let firebaseApp: any = null;
let firebaseAuth: any = null;

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

  if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig as any);
  }
  firebaseAuth = getAuth();
  return { configured: true, app: firebaseApp, auth: firebaseAuth };
}

export default initFirebase;
