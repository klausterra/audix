import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'

export const firebaseConfig = {
  apiKey: "AIzaSyBr-QoJasxWE15yBPXOHCEvEkb25lNU9Oo",
  authDomain: "hipercube-dev-train.firebaseapp.com",
  projectId: "hipercube-dev-train",
  storageBucket: "hipercube-dev-train.firebasestorage.app",
  messagingSenderId: "488155064180",
  appId: "1:488155064180:web:1f40f7fd3b8ed5c4692e21",
}

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider)
  // Ensure profile doc exists
  const userRef = doc(db, 'audix_users', result.user.uid)
  const snap = await getDoc(userRef)
  if (!snap.exists()) {
    await setDoc(userRef, {
      displayName: result.user.displayName || '',
      email: result.user.email || '',
      photoURL: result.user.photoURL || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      stats: { total: 0, correct: 0, streak: 0, bestStreak: 0 },
    }, { merge: true })
  }
  return result.user
}

export async function logoutUser(): Promise<void> {
  await signOut(auth)
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback)
}

export interface UserStats {
  total: number
  correct: number
  streak: number
  bestStreak: number
  selectedNotes?: string[]
}

export async function syncUserStatsToFirestore(uid: string, stats: UserStats): Promise<void> {
  try {
    const userRef = doc(db, 'audix_users', uid)
    await setDoc(userRef, {
      stats,
      updatedAt: serverTimestamp(),
    }, { merge: true })
  } catch (err) {
    console.warn('Error saving stats to Firestore:', err)
  }
}

export async function fetchUserStatsFromFirestore(uid: string): Promise<UserStats | null> {
  try {
    const userRef = doc(db, 'audix_users', uid)
    const snap = await getDoc(userRef)
    if (snap.exists() && snap.data().stats) {
      return snap.data().stats as UserStats
    }
  } catch (err) {
    console.warn('Error fetching stats from Firestore:', err)
  }
  return null
}
