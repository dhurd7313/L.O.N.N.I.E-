import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";

// Mock user type
interface User {
  id: string;
  email: string;
  displayName?: string;
}

interface Session {
  user: User;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Storage keys
const STORAGE_USER_KEY = "lonnie_auth_user";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    // Mock refresh - just reload from localStorage
    const stored = localStorage.getItem(STORAGE_USER_KEY);
    if (stored) {
      try {
        const userData = JSON.parse(stored);
        setUser(userData);
        setSession({ user: userData });
      } catch {
        setUser(null);
        setSession(null);
      }
    }
  }, []);

  useEffect(() => {
    // Load user from localStorage on mount
    const stored = localStorage.getItem(STORAGE_USER_KEY);
    if (stored) {
      try {
        const userData = JSON.parse(stored);
        setUser(userData);
        setSession({ user: userData });
      } catch {
        setUser(null);
        setSession(null);
      }
    }
    setLoading(false);
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    // Mock signup - store in localStorage
    const newUser: User = {
      id: crypto.randomUUID(),
      email,
      displayName: displayName || email.split("@")[0],
    };
    
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(newUser));
    setUser(newUser);
    setSession({ user: newUser });
  };

  const signIn = async (email: string, password: string) => {
    // Mock signin - create or load user
    const stored = localStorage.getItem(STORAGE_USER_KEY);
    if (stored) {
      const existingUser = JSON.parse(stored);
      if (existingUser.email === email) {
        setUser(existingUser);
        setSession({ user: existingUser });
        return;
      }
    }
    
    // Create new user if doesn't exist
    const newUser: User = {
      id: crypto.randomUUID(),
      email,
      displayName: email.split("@")[0],
    };
    
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(newUser));
    setUser(newUser);
    setSession({ user: newUser });
  };

  const signOut = async () => {
    localStorage.removeItem(STORAGE_USER_KEY);
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
