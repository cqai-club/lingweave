import { LogtoProvider, useLogto, type IdTokenClaims } from "@logto/react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ACCOUNT_SERVICE_ENABLED, LOGTO_API_RESOURCE, LOGTO_ENABLED, logtoConfig } from "@/constant/logto";
import { setAccountAccessTokenProvider, setAccountAuthFailureHandler } from "@/services/api/account";
import { useUserStore, type LocalUser } from "@/stores/use-user-store";

export function LogtoAuthProvider({ children }: { children: ReactNode }) {
    const [authSessionVersion, setAuthSessionVersion] = useState(0);
    const resetAuthentication = useCallback(() => setAuthSessionVersion((version) => version + 1), []);

    if (!LOGTO_ENABLED) return children;
    return (
        <LogtoProvider key={authSessionVersion} config={logtoConfig} unstable_enableCache>
            <LogtoUserSync onAuthInvalidated={resetAuthentication} />
            {children}
        </LogtoProvider>
    );
}

function LogtoUserSync({ onAuthInvalidated }: { onAuthInvalidated: () => void }) {
    const { isAuthenticated, clearAllTokens, getAccessToken, getIdTokenClaims } = useLogto();
    const setUser = useUserStore((state) => state.setUser);
    const clearSession = useUserStore((state) => state.clearSession);
    const invalidatingRef = useRef(false);
    const invalidateAuthentication = useCallback(async () => {
        if (invalidatingRef.current) return;
        invalidatingRef.current = true;
        clearSession();
        try {
            await clearAllTokens();
        } finally {
            onAuthInvalidated();
        }
    }, [clearAllTokens, clearSession, onAuthInvalidated]);

    useEffect(() => {
        if (!ACCOUNT_SERVICE_ENABLED) return;
        return setAccountAccessTokenProvider(async () => (await getAccessToken(LOGTO_API_RESOURCE)) || "");
    }, [getAccessToken]);

    useEffect(() => {
        if (!ACCOUNT_SERVICE_ENABLED) return;
        return setAccountAuthFailureHandler(invalidateAuthentication);
    }, [invalidateAuthentication]);

    useEffect(() => {
        if (!isAuthenticated) {
            clearSession();
            return;
        }
        let active = true;
        void getIdTokenClaims()
            .then((claims) => {
                if (!active) return;
                const user = claims && toLocalUser(claims);
                if (user) setUser(user);
                else clearSession();
            })
            .catch(() => {
                if (active) void invalidateAuthentication();
            });
        return () => {
            active = false;
        };
    }, [clearSession, getIdTokenClaims, invalidateAuthentication, isAuthenticated, setUser]);

    return null;
}

export function toLocalUser(claims: IdTokenClaims): LocalUser {
    const username = claims.username || claims.email || claims.name || claims.sub;
    return {
        id: claims.sub,
        username,
        displayName: claims.name || username,
        avatarUrl: claims.picture || "",
    };
}
