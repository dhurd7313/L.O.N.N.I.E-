// Supabase has been disabled - using mock auth instead
// This file is kept for reference but exports nothing

export const supabase = null;

export type User = {
  id: string;
  email: string;
  displayName?: string;
};

export type Session = {
  user: User;
};

export type AuthError = Error;
