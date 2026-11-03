
"use client";

import { FormEvent, useState } from "react";

function getSafeCallbackUrl(): string {
  const callbackUrl = new URLSearchParams(
    window.location.search
  ).get("callbackUrl");

  if (
    !callbackUrl ||
    !callbackUrl.startsWith("/") ||
    callbackUrl.startsWith("//") ||
    callbackUrl.includes("\\")
  ) {
    return "/";
  }

  try {
    const callback = new URL(
      callbackUrl,
      window.location.origin
    );

    if (callback.origin !== window.location.origin) {
      return "/";
    }

    return (
      callback.pathname +
      callback.search +
      callback.hash
    );
  } catch {
    return "/";
  }
}

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Login failed"
        );
      }

      window.location.assign(getSafeCallbackUrl());
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg space-y-5"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Nihonkotoba
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Sign in to your private vocabulary workspace.
          </p>
        </div>

        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          placeholder="Enter your password"
          className="w-full rounded-xl border px-4 py-3"
        />

        {error && (
          <p className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          disabled={loading}
          className="w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
