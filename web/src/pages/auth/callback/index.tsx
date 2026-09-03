import { useHandleSignInCallback } from "@logto/react";
import { Alert, Button, Spin } from "antd";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { LOGTO_ENABLED } from "@/constant/logto";

export default function LogtoCallbackPage() {
    if (!LOGTO_ENABLED) return <CallbackUnavailable />;
    return <EnabledLogtoCallback />;
}

function EnabledLogtoCallback() {
    const navigate = useNavigate();
    const finish = useCallback(() => navigate("/", { replace: true }), [navigate]);
    const { isLoading, isAuthenticated, error } = useHandleSignInCallback(finish);
    const hasCallbackParams = new URLSearchParams(window.location.search).has("code") || new URLSearchParams(window.location.search).has("error");
    const invalidCallback = !hasCallbackParams && !isLoading && !isAuthenticated;

    return (
        <main className="grid min-h-screen place-items-center bg-background px-6 text-stone-900 dark:text-stone-100">
            <section className="w-full max-w-sm text-center">
                {error || invalidCallback ? (
                    <>
                        <Alert type={error ? "error" : "warning"} showIcon title={error ? "登录没有完成" : "登录回调无效"} description={error?.message} />
                        <Button className="mt-5" type="primary" onClick={finish}>
                            返回首页
                        </Button>
                    </>
                ) : (
                    <>
                        <Spin size="large" />
                        <h1 className="mt-6 text-lg font-semibold">正在完成登录</h1>
                        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">即将返回 LingWeave</p>
                    </>
                )}
            </section>
        </main>
    );
}

function CallbackUnavailable() {
    const navigate = useNavigate();
    return (
        <main className="grid min-h-screen place-items-center bg-background px-6 text-stone-900 dark:text-stone-100">
            <section className="w-full max-w-sm text-center">
                <Alert type="warning" showIcon title="当前部署未启用登录" />
                <Button className="mt-5" type="primary" onClick={() => navigate("/", { replace: true })}>
                    返回首页
                </Button>
            </section>
        </main>
    );
}
