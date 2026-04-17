import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '@/lib/api';

interface AuthContextType {
  isHydrating: boolean;
  isAuthenticated: boolean;
  user: User | null;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Storage keys for PWA session persistence
const STORAGE_KEY_USER = 'nutricore_user_cache';
const STORAGE_KEY_SESSION_ACTIVE = 'nutricore_session_active';
const IDB_NAME = 'nutricore_auth';
const IDB_STORE = 'session';

// IndexedDB helpers for more persistent storage on iOS PWAs
let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
    } catch (e) {
      reject(e);
    }
  });
  
  return dbPromise;
}

async function saveToIndexedDB(userData: User | null): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    if (userData) {
      store.put(JSON.stringify(userData), 'user');
      store.put('true', 'active');
    } else {
      store.delete('user');
      store.delete('active');
    }
  } catch (e) {
    // IndexedDB might not be available
  }
}

async function getFromIndexedDB(): Promise<User | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    
    return new Promise((resolve) => {
      const userReq = store.get('user');
      const activeReq = store.get('active');
      
      tx.oncomplete = () => {
        if (userReq.result && activeReq.result === 'true') {
          try {
            resolve(JSON.parse(userReq.result));
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };
      tx.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

// Save user to both localStorage AND IndexedDB for PWA persistence
function saveUserToStorage(userData: User | null) {
  try {
    if (userData) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userData));
      localStorage.setItem(STORAGE_KEY_SESSION_ACTIVE, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem(STORAGE_KEY_SESSION_ACTIVE);
    }
  } catch (e) {
    // localStorage might not be available
  }
  // Also save to IndexedDB (more persistent on iOS PWAs)
  saveToIndexedDB(userData);
}

// Get cached user from localStorage (sync, for initial render)
function getCachedUser(): User | null {
  try {
    const cached = localStorage.getItem(STORAGE_KEY_USER);
    const sessionActive = localStorage.getItem(STORAGE_KEY_SESSION_ACTIVE);
    if (cached && sessionActive === 'true') {
      return JSON.parse(cached);
    }
  } catch (e) {
    // localStorage might not be available
  }
  return null;
}

// Get cached user from IndexedDB (async fallback)
async function getCachedUserAsync(): Promise<User | null> {
  // Try localStorage first (sync)
  const localUser = getCachedUser();
  if (localUser) return localUser;
  
  // Fall back to IndexedDB
  return getFromIndexedDB();
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // Initialize with cached user for instant PWA resume (no flash of login screen)
  const [user, setUser] = useState<User | null>(() => getCachedUser());
  const [isHydrating, setIsHydrating] = useState(true);
  const pendingRefresh = useRef<Promise<void> | null>(null);

  const refreshSession = useCallback(async (): Promise<void> => {
    // If there's already a pending refresh, wait for it instead of starting another
    if (pendingRefresh.current) {
      // Still set hydrating true while waiting
      setIsHydrating(true);
      return pendingRefresh.current;
    }

    // Always set hydrating to block protected routes during refresh
    setIsHydrating(true);

    const doRefresh = async (): Promise<void> => {
      try {
        // Retry loop for iOS PWA cookie issues
        let lastResponse: Response | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          lastResponse = response;
          
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
            queryClient.setQueryData(['/api/auth/user'], userData);
            saveUserToStorage(userData);
            return;
          }
          
          if (response.status === 401 && attempt < 2) {
            // Wait and retry - iOS sometimes needs time to restore cookies
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }
          
          break;
        }
        
        // All retries failed with 401
        if (lastResponse && lastResponse.status === 401) {
          // After 3 failed attempts, the session is definitely not recoverable
          // Clear all caches and redirect to login
          console.log('Session not authenticated after 3 attempts - redirecting to login');
          saveUserToStorage(null);
          setUser(null);
          queryClient.setQueryData(['/api/auth/user'], null);
          queryClient.clear();
          // Redirect to login
          window.location.href = '/api/login';
          return;
        }
        // For other errors (500, network), keep existing user state
      } catch (error) {
        console.error('Session refresh failed:', error);
        // Keep existing user state on network errors, or use cached from both sources
        const cachedUser = await getCachedUserAsync();
        if (cachedUser) {
          setUser(cachedUser);
          queryClient.setQueryData(['/api/auth/user'], cachedUser);
        }
      } finally {
        setIsHydrating(false);
        pendingRefresh.current = null;
      }
    };

    pendingRefresh.current = doRefresh();
    return pendingRefresh.current;
  }, [queryClient]);

  // Initial hydration on mount - check all caches and verify with server
  useEffect(() => {
    const initSession = async () => {
      // If we have a cached user from initial state, sync it to React Query
      let cachedUser = getCachedUser();
      
      // If localStorage is empty, try IndexedDB (more persistent on iOS)
      if (!cachedUser) {
        cachedUser = await getFromIndexedDB();
        if (cachedUser) {
          setUser(cachedUser);
          // Sync back to localStorage
          try {
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(cachedUser));
            localStorage.setItem(STORAGE_KEY_SESSION_ACTIVE, 'true');
          } catch (e) {}
        }
      }
      
      if (cachedUser) {
        queryClient.setQueryData(['/api/auth/user'], cachedUser);
      }
      
      // Always verify session with server
      refreshSession();
    };
    
    initSession();
  }, []);

  // Handle visibility/focus/resume events - always refresh on resume
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSession();
      }
    };

    const handleFocus = () => {
      refreshSession();
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      // Always refresh on pageshow, especially from bfcache
      if (event.persisted) {
        refreshSession();
      }
    };

    const handlePageHide = () => {
      // Use sendBeacon for background session save (fire-and-forget)
      if (user && navigator.sendBeacon) {
        navigator.sendBeacon('/api/auth/refresh');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [refreshSession, user]);

  // Sync with React Query updates (terms acceptance, profile updates, logout, etc.)
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      // Check if this is exactly the auth user query ['/api/auth/user']
      const queryKey = event.query.queryKey;
      const isAuthUserQuery = Array.isArray(queryKey) && 
        queryKey.length === 1 && 
        queryKey[0] === '/api/auth/user';
      
      if (isAuthUserQuery) {
        if (event.type === 'updated' || event.type === 'removed') {
          const data = event.query.state.data as User | null | undefined;
          // Mirror the cache exactly - including null/undefined for logout
          setUser(data ?? null);
        }
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const value: AuthContextType = {
    isHydrating,
    isAuthenticated: !!user,
    user,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
