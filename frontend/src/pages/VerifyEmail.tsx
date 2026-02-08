import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getApiUrl } from "@/lib/config";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

const VerifyEmail = () => {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const navigate = useNavigate();

    useEffect(() => {
        const verify = async () => {
            const token = searchParams.get("token");
            const email = searchParams.get("email");

            try {
                const res = await fetch(getApiUrl("auth/verify-email"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, token })
                });
                if (res.ok) setStatus("success");
                else setStatus("error");
            } catch {
                setStatus("error");
            }
        };
        verify();
    }, [searchParams]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30">
            <div className="max-w-md w-full p-8 bg-background rounded-lg shadow-xl text-center">
                {status === "loading" && <Loader2 className="w-12 h-12 animate-spin mx-auto text-accent" />}
                {status === "success" && (
                    <>
                        <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
                        <h1 className="text-2xl font-bold">Email Verified!</h1>
                        <p className="my-4">Your account is now active. You can log in.</p>
                        <button onClick={() => navigate("/login")} className="bg-accent text-white px-6 py-2 rounded-md">Login</button>
                    </>
                )}
                {status === "error" && (
                    <>
                        <XCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
                        <h1 className="text-2xl font-bold">Verification Failed</h1>
                        <p className="my-4">The link is invalid or expired.</p>
                    </>
                )}
            </div>
        </div>
    );
};
export default VerifyEmail;