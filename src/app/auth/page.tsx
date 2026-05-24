"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "sign_in" | "sign_up";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(
    null,
  );
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  async function handleOAuth(provider: "google" | "apple") {
    setOauthLoading(provider);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setMessage({ type: "error", text: error.message });
      setOauthLoading(null);
    }
    // On success, Supabase redirects away — no need to clear loading state.
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createClient();

    if (mode === "sign_up") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({
          type: "success",
          text: "Check your email to confirm your account, then come back to sign in.",
        });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMessage({ type: "error", text: error.message });
      }
      // On success, middleware will redirect to /
    }

    setLoading(false);
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#F2EAD8] px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#C28840]">
            Welcome to
          </p>
          <h1 className="mt-1 font-serif text-4xl font-medium italic text-[#0F1310]">
            Ty&apos;s Table
          </h1>
          <p className="mt-2 font-sans text-sm text-[#0F1310]/60">
            Cook more. Save smart. Dine like you mean it.
          </p>
        </div>

        {/* OAuth Buttons */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void handleOAuth("google")}
            disabled={!!oauthLoading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#D9CDB0] bg-white px-4 py-3 font-sans text-sm font-medium text-[#0F1310] transition-colors hover:bg-[#F9F6EF] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {oauthLoading === "google" ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0F1310]/20 border-t-[#0F1310]" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => void handleOAuth("apple")}
            disabled={!!oauthLoading}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#0F1310] px-4 py-3 font-sans text-sm font-medium text-[#F2EAD8] transition-colors hover:bg-[#1a2018] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {oauthLoading === "apple" ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            ) : (
              <AppleIcon />
            )}
            Continue with Apple
          </button>
        </div>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#D9CDB0]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/40">
            or
          </span>
          <div className="h-px flex-1 bg-[#D9CDB0]" />
        </div>

        {/* Email / Password Form */}
        <form onSubmit={(e) => void handleEmailAuth(e)} className="space-y-4">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/55">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-2 w-full border-0 border-b border-[#D9CDB0] bg-transparent pb-1 font-serif text-lg text-[#0F1310] outline-none focus:border-b-[#7A2A1E]"
            />
          </div>

          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#0F1310]/55">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-2 w-full border-0 border-b border-[#D9CDB0] bg-transparent pb-1 font-serif text-lg text-[#0F1310] outline-none focus:border-b-[#7A2A1E]"
            />
          </div>

          {message ? (
            <p
              role="alert"
              className={`font-sans text-sm ${
                message.type === "error"
                  ? "text-[#7A2A1E]"
                  : "text-[#2a5c1e]"
              }`}
            >
              {message.text}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#7A2A1E] px-6 py-4 font-sans text-base font-semibold text-[#F2EAD8] transition-colors duration-200 hover:bg-[#C28840] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Just a moment..."
              : mode === "sign_in"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        {/* Mode Toggle */}
        <p className="mt-6 text-center font-sans text-sm text-[#0F1310]/60">
          {mode === "sign_in" ? (
            <>
              New here?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("sign_up");
                  setMessage(null);
                }}
                className="font-semibold text-[#7A2A1E] hover:underline"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("sign_in");
                  setMessage(null);
                }}
                className="font-semibold text-[#7A2A1E] hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      width="17"
      height="20"
      viewBox="0 0 17 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M13.769 10.27c-.021-2.173 1.776-3.222 1.856-3.274-1.01-1.478-2.582-1.68-3.143-1.703-1.337-.135-2.61.79-3.286.79-.676 0-1.718-.773-2.829-.752-1.45.022-2.793.843-3.541 2.143-1.51 2.616-.386 6.49 1.085 8.612.718 1.04 1.574 2.208 2.695 2.166 1.083-.043 1.492-.697 2.8-.697 1.307 0 1.676.697 2.822.675 1.165-.02 1.9-1.055 2.612-2.098.825-1.2 1.163-2.364 1.18-2.425-.025-.01-2.265-.87-2.251-3.437zM11.547 3.528c.596-.722.997-1.723.888-2.724-.858.035-1.9.572-2.516 1.293-.554.642-1.038 1.668-.907 2.652.957.074 1.935-.487 2.535-1.221z" />
    </svg>
  );
}
