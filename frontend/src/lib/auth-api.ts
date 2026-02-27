import { getApiUrl } from "@/lib/config";

export const resendVerificationEmail = async (email: string) => {
  const url = getApiUrl("auth/resend-verification-email");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error("Failed to resend verification email.");
  }

  return response.json();
};