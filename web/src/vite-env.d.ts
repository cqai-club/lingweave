/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_LOGTO_ENDPOINT?: string;
    readonly VITE_LOGTO_APP_ID?: string;
    readonly VITE_LOGTO_API_RESOURCE?: string;
    readonly VITE_LOGTO_API_SCOPES?: string;
    readonly VITE_ACCOUNT_SERVICE_URL?: string;
    readonly VITE_NEW_API_URL?: string;
    readonly VITE_PROMPT_LIBRARY_URL?: string;
}

declare const __APP_VERSION__: string;
declare const __APP_RELEASES__: import("@/lib/release").ReleaseInfo[];
