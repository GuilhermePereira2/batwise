import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getApiUrl } from "@/lib/config";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

const VerifyEmail = () => {
    const { t } = useTranslation();
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
                        <h1 className="text-2xl font-bold">{t('verifyEmail.successTitle')}</h1>
                        <p className="my-4">{t('verifyEmail.successDesc')}</p>
                        <button onClick={() => navigate("/login")} className="bg-accent text-white px-6 py-2 rounded-md">
                            {t('verifyEmail.loginButton')}
                        </button>
                    </>
                )}

                {status === "error" && (
                    <>
                        <XCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
                        <h1 className="text-2xl font-bold">{t('verifyEmail.errorTitle')}</h1>
                        <p className="my-4">{t('verifyEmail.errorDesc')}</p>
                    </>
                )}
            </div>
        </div>
    );
};

export default VerifyEmail;