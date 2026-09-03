import { LogtoProvider, useLogto, type IdTokenClaims } from "@logto/react";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { ACCOUNT_SERVICE_ENABLED, LOGTO_API_RESOURCE, LOGTO_ENABLED, logtoConfig } from "@/constant/logto";
import { setAccountAccessTokenProvider } from "@/services/api/account";
import { useUserStore, type LocalUser } from "@/stores/use-user-store";

export function LogtoAuthProvider({ children }: { children: ReactNode }) {
    if (!LOGTO_ENABLED) return children;
    return (
        <LogtoProvider config={logtoConfig} unstable_enableCache>
            <LogtoUserSync />
            {children}
        </LogtoProvider>
    );
}

function LogtoUserSync() {
    const { isAuthenticated, getAccessToken, getIdTokenClaims } = useLogto();
    const setUser = useUserStore((state) => state.setUser);
    const clearSession = useUserStore((state) => state.clearSession);

    useEffect(() => {
        if (!ACCOUNT_SERVICE_ENABLED) return;
        return setAccountAccessTokenProvider(async () => (await getAccessToken(LOGTO_API_RESOURCE)) || "");
    }, [getAccessToken]);

    useEffect(() => {
        if (!isAuthenticated) {
            clearSession();
            return;
        }
        let active = true;
        void getIdTokenClaims().then((claims) => {
            if (!active) return;
            const user = claims && toLocalUser(claims);
            if (user) setUser(user);
            else clearSession();
        });
        return () => {
            active = false;
        };
    }, [clearSession, getIdTokenClaims, isAuthenticated, setUser]);

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
