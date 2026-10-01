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
  addDoc,
  collection,
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
  const user = result.user

  // Ensure profile doc exists in audix_users (non-blocking)
  try {
    const userRef = doc(db, 'audix_users', user.uid)
    const snap = await getDoc(userRef)
    if (!snap.exists()) {
      await setDoc(userRef, {
        displayName: user.displayName || '',
        email: user.email || '',
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        stats: { total: 0, correct: 0, streak: 0, bestStreak: 0 },
      }, { merge: true })
    }
  } catch (err) {
    console.warn('Could not sync user profile to Firestore:', err)
  }

  // Also record lead in audix_leads (non-blocking)
  try {
    const leadRef = doc(db, 'audix_leads', user.uid)
    await setDoc(leadRef, {
      uid: user.uid,
      name: user.displayName || '',
      email: user.email || '',
      provider: 'google',
      source: 'audix_app',
      lastSeen: serverTimestamp(),
    }, { merge: true })
  } catch (err) {
    console.warn('Failed to record lead on login:', err)
  }

  return user
}

export interface LeadFormData {
  name: string
  email: string
  instrument?: string
  goal?: string
}

export async function recordLeadForm(data: LeadFormData): Promise<string> {
  const leadsCol = collection(db, 'audix_leads')
  const docRef = await addDoc(leadsCol, {
    ...data,
    provider: 'lead_form',
    source: 'landing_page',
    createdAt: serverTimestamp(),
  })
  return docRef.id
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
