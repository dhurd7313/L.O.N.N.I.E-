import { useState, useEffect, useCallback } from "react";

interface BiometricState {
  supported: boolean;
  enrolled: boolean;
  verified: boolean;
  loading: boolean;
  error?: string;
}

interface BiometricOptions {
  onEnrollSuccess?: () => void;
  onVerifySuccess?: () => void;
  onError?: (error: string) => void;
}

export function useBiometric(userId: string | null) {
  const [state, setState] = useState<BiometricState>({
    supported: false,
    enrolled: false,
    verified: false,
    loading: true,
  });

  // Check if Web Authentication API is supported
  useEffect(() => {
    const checkSupport = async () => {
      if (!window.PublicKeyCredential) {
        setState(prev => ({ ...prev, supported: false, loading: false }));
        return;
      }

      try {
        // Check if we can get credentials (indicates enrolled)
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

        setState(prev => ({
          ...prev,
          supported: available,
          loading: false,
        }));
      } catch {
        setState(prev => ({ ...prev, supported: false, loading: false }));
      }
    };

    checkSupport();
  }, []);

  // Load saved verification state from localStorage
  useEffect(() => {
    if (!userId) return;

    const savedVerified = localStorage.getItem(`bio_verified_${userId}`);
    const savedTime = localStorage.getItem(`bio_verified_time_${userId}`);

    if (savedVerified && savedTime) {
      const elapsed = Date.now() - parseInt(savedTime, 10);
      const fiveMinutes = 5 * 60 * 1000;

      if (elapsed < fiveMinutes) {
        setState(prev => ({ ...prev, verified: true }));
      } else {
        // Clear expired verification
        localStorage.removeItem(`bio_verified_${userId}`);
        localStorage.removeItem(`bio_verified_time_${userId}`);
      }
    }
  }, [userId]);

  const enroll = useCallback(async (options?: BiometricOptions) => {
    if (!state.supported || !userId) {
      options?.onError?.("Biometric authentication not supported");
      return;
    }

    try {
      // In a real app, you would call your backend to get a challenge
      // For demo, we'll just mark as enrolled
      localStorage.setItem(`bio_enrolled_${userId}`, "true");

      setState(prev => ({ ...prev, enrolled: true }));
      options?.onEnrollSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Enrollment failed";
      setState(prev => ({ ...prev, error: message }));
      options?.onError?.(message);
    }
  }, [state.supported, userId]);

  const verify = useCallback(async (options?: BiometricOptions) => {
    if (!state.supported || !userId) {
      options?.onError?.("Biometric authentication not supported");
      return false;
    }

    try {
      // In a real app, you would verify with your backend
      // For demo, we'll just mark as verified
      localStorage.setItem(`bio_verified_${userId}`, "true");
      localStorage.setItem(`bio_verified_time_${userId}`, Date.now().toString());

      setState(prev => ({ ...prev, verified: true }));
      options?.onVerifySuccess?.();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Verification failed";
      setState(prev => ({ ...prev, error: message }));
      options?.onError?.(message);
      return false;
    }
  }, [state.supported, userId]);

  const clearVerification = useCallback(() => {
    if (!userId) return;

    localStorage.removeItem(`bio_verified_${userId}`);
    localStorage.removeItem(`bio_verified_time_${userId}`);
    setState(prev => ({ ...prev, verified: false }));
  }, [userId]);

  return {
    ...state,
    enroll,
    verify,
    clearVerification,
  };
}