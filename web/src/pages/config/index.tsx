import { AppConfigPanel } from "@/components/layout/app-config-modal";
import { useConfigStore } from "@/stores/use-config-store";

export default function ConfigPage() {
    const accountMode = useConfigStore((state) => state.config.channelMode === "remote");
    return (
        <main className="h-full overflow-y-auto bg-background">
            <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
                <div className="mb-5">
                    <h1 className="text-xl font-semibold text-stone-950 dark:text-stone-100">配置与用户偏好</h1>
                    <p className="mt-1 text-sm text-stone-500">{accountMode ? "登录后从 CQ AI Club 账号服务拉取并选择模型" : "配置自己的 Base URL、API Key，拉取并选择模型"}</p>
                </div>
                <AppConfigPanel />
            </div>
        </main>
    );
}
