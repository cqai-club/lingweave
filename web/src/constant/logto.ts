import { UserScope, type LogtoConfig } from "@logto/react";

export const LOGTO_ENDPOINT = (import.meta.env.VITE_LOGTO_ENDPOINT || "https://auth.cqaiclub.asia").trim().replace(/\/+$/, "");
export const LOGTO_APP_ID = (import.meta.env.VITE_LOGTO_APP_ID || "").trim();
export const LOGTO_ENABLED = Boolean(LOGTO_APP_ID);
export const LOGTO_API_RESOURCE = (import.meta.env.VITE_LOGTO_API_RESOURCE || "").trim();
export const LOGTO_API_SCOPES = Array.from(
    new Set(
        (import.meta.env.VITE_LOGTO_API_SCOPES || "ai:invoke")
            .split(/[\s,]+/)
            .map((scope) => scope.trim())
            .filter(Boolean),
    ),
);
export const ACCOUNT_SERVICE_URL = (import.meta.env.VITE_ACCOUNT_SERVICE_URL || "").trim().replace(/\/+$/, "");
export const ACCOUNT_SERVICE_ENABLED = Boolean(LOGTO_ENABLED && LOGTO_API_RESOURCE && ACCOUNT_SERVICE_URL);
export const NEW_API_URL = (import.meta.env.VITE_NEW_API_URL || "https://relay.cqaiclub.asia").trim().replace(/\/+$/, "");

export const logtoConfig: LogtoConfig = {
    endpoint: LOGTO_ENDPOINT,
    appId: LOGTO_APP_ID,
    scopes: [UserScope.Email, ...(LOGTO_API_RESOURCE ? LOGTO_API_SCOPES : [])],
    ...(LOGTO_API_RESOURCE ? { resources: [LOGTO_API_RESOURCE] } : {}),
};

export function buildAppUrl(path = "", origin = window.location.origin, basePath = import.meta.env.BASE_URL) {
    const baseName = basePath.replace(/^\/+|\/+$/g, "");
    const base = baseName ? `/${baseName}/` : "/";
    return new URL(`${base}${path.replace(/^\/+/, "")}`, origin).toString();
}

export function buildNewApiUrl(path = "") {
    return `${NEW_API_URL}${path ? `/${path.replace(/^\/+/, "")}` : ""}`;
}
