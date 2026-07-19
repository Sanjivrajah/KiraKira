"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthServiceError } from "@/services/auth";
import { useAuth } from "./auth-provider";

function GoogleMark() {
  return (
    <svg aria-hidden="true" height="18" viewBox="0 0 18 18" width="18">
      <path d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.703-1.568 2.684-3.878 2.684-6.614Z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.181l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z" fill="#34A853" />
      <path d="M3.963 10.706A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.281-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.332Z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.463.892 11.426 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z" fill="#EA4335" />
    </svg>
  );
}

export function GoogleAuthButton({ authPage }: { authPage: "login" | "signup" }) {
  const searchParams = useSearchParams();
  const { mode, signInWithGoogle } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  if (mode !== "supabase") return null;

  const callbackFailed = searchParams.get("authError") === "google_oauth";
  const startGoogleAuth = async () => {
    setMessage(null);
    setIsRedirecting(true);
    try {
      await signInWithGoogle({ authPage, next: searchParams.get("next") });
    } catch (error) {
      setIsRedirecting(false);
      setMessage(error instanceof AuthServiceError ? error.message : "Google sign-in is temporarily unavailable. Please try again.");
    }
  };

  return (
    <div className="google-auth">
      {message || callbackFailed ? (
        <p className="form-message error" role="alert">
          {message ?? "We could not complete Google sign-in. Please try again."}
        </p>
      ) : null}
      <button className="button button-secondary button-full google-auth-button" disabled={isRedirecting} onClick={startGoogleAuth} type="button">
        <GoogleMark />
        {isRedirecting ? "Opening Google…" : "Continue with Google"}
      </button>
      <div aria-hidden="true" className="auth-divider"><span>or continue with email</span></div>
    </div>
  );
}
