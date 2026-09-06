import type { CSSProperties } from "react";
import { useLogto } from "@logto/react";
import { Dropdown } from "antd";
import { useEffect, useState } from "react";
import { BookOpen, CircleUserRound, ExternalLink, Keyboard, LogOut, Settings2, WalletCards } from "lucide-react";

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { GitHubLink } from "@/components/layout/github-link";
import { VersionReleaseModal } from "@/components/layout/version-release-modal";
import { ACCOUNT_SERVICE_ENABLED, buildAppUrl, buildNewApiUrl, LOGTO_ENABLED } from "@/constant/logto";
import { cn } from "@/lib/utils";
import { canvasThemes } from "@/lib/canvas-theme";
import { getAccountSummary } from "@/services/api/account";
import { useConfigStore } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";

type UserStatusActionsProps = {
    showConfig?: boolean;
    variant?: "default" | "canvas";
    onOpenShortcuts?: () => void;
};

export function UserStatusActions({ showConfig = true, variant = "default", onOpenShortcuts }: UserStatusActionsProps) {
    const theme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const canvasTheme = canvasThemes[theme];
    const naturalIconClass = "inline-flex size-7 shrink-0 items-center justify-center text-stone-600 transition hover:text-stone-950 dark:text-stone-300 dark:hover:text-white [&_svg]:size-4";
    const loginButtonClass = "inline-flex h-7 shrink-0 items-center px-2 text-xs font-medium text-stone-600 transition hover:text-stone-950 dark:text-stone-300 dark:hover:text-white";
    const iconStyle: CSSProperties | undefined = variant === "canvas" ? { color: canvasTheme.node.text } : undefined;
    const versionStyle = iconStyle;
    const gitHubClassName = "size-7 text-base";
    const gitHubStyle = iconStyle;

    return (
        <div className="inline-flex shrink-0 items-center gap-1">
            <a href={`${import.meta.env.BASE_URL}docs/overview/quick-start/`} className={naturalIconClass} style={iconStyle} aria-label="帮助文档" title="帮助文档">
                <BookOpen className="size-4" />
            </a>
            {showConfig ? (
                <button type="button" className={naturalIconClass} style={iconStyle} onClick={() => openConfigDialog(false)} aria-label="配置" title="配置">
                    <Settings2 className="size-4" />
                </button>
            ) : null}
            <AnimatedThemeToggler theme={theme} onThemeChange={setTheme} className={naturalIconClass} style={iconStyle} aria-label={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"} title={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"} />
            <VersionReleaseModal style={versionStyle} />
            <GitHubLink className={cn("bg-transparent hover:bg-transparent dark:hover:bg-transparent", gitHubClassName)} style={gitHubStyle} />
            {LOGTO_ENABLED ? <LogtoAccountAction className={naturalIconClass} loginClassName={loginButtonClass} style={iconStyle} /> : null}
            {onOpenShortcuts ? (
                <button type="button" className={naturalIconClass} style={iconStyle} onClick={onOpenShortcuts} aria-label="快捷键" title="快捷键">
                    <Keyboard className="size-4" />
                </button>
            ) : null}
        </div>
    );
}

function LogtoAccountAction({ className, loginClassName, style }: { className: string; loginClassName: string; style?: CSSProperties }) {
    const { isAuthenticated, isLoading, error, signIn, signOut } = useLogto();
    const user = useUserStore((state) => state.user);
    const [accountSummary, setAccountSummary] = useState<{ quota?: number; quotaUsed?: number } | null>(null);

    useEffect(() => {
        if (!isAuthenticated || !ACCOUNT_SERVICE_ENABLED) {
            setAccountSummary(null);
            return;
        }
        let active = true;
        void getAccountSummary()
            .then((summary) => {
                if (active) setAccountSummary(summary);
            })
            .catch(() => {
                if (active) setAccountSummary(null);
            });
        return () => {
            active = false;
        };
    }, [isAuthenticated]);

    if (isAuthenticated) {
        const label = user?.displayName || user?.username || "已登录";
        const remainingQuota = accountSummary?.quota === undefined ? undefined : Math.max(0, accountSummary.quota - (accountSummary.quotaUsed || 0));
        return (
            <Dropdown
                trigger={["click"]}
                menu={{
                    items: [
                        { key: "profile", label, disabled: true },
                        ...(ACCOUNT_SERVICE_ENABLED
                            ? [
                                  {
                                      key: "quota",
                                      label: <span>{remainingQuota === undefined ? "剩余额度：读取中" : remainingQuota === 0 ? "剩余额度：0，未开通或已用尽，请充值或联系管理员" : `剩余额度：${formatQuota(remainingQuota)}`}</span>,
                                      icon: <WalletCards className="size-3.5" />,
                                      disabled: true,
                                  },
                                  { key: "new-api", label: "打开 NewAPI 控制台", icon: <ExternalLink className="size-3.5" /> },
                                  { key: "top-up", label: "前往充值（钱包）", icon: <WalletCards className="size-3.5" /> },
                              ]
                            : []),
                        { type: "divider" },
                        { key: "logout", label: "退出登录", icon: <LogOut className="size-3.5" />, danger: true },
                    ],
                    onClick: ({ key }) => {
                        if (key === "new-api") window.open(buildNewApiUrl("dashboard"), "_blank", "noopener,noreferrer");
                        if (key === "top-up") window.open(buildNewApiUrl("wallet"), "_blank", "noopener,noreferrer");
                        if (key === "logout") void signOut(buildAppUrl());
                    },
                }}
            >
                <button type="button" className={className} style={style} aria-label="账户" title={label}>
                    <CircleUserRound className="size-4" />
                </button>
            </Dropdown>
        );
    }

    return (
        <button
            type="button"
            className={loginClassName}
            style={style}
            disabled={isLoading}
            onClick={() => void signIn({ redirectUri: buildAppUrl("callback"), postRedirectUri: window.location.href })}
            aria-label="登录"
            title={error ? `登录失败：${error.message}` : "登录 CQ AI Club"}
        >
            登录
        </button>
    );
}

function formatQuota(value: number) {
    return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value);
}
