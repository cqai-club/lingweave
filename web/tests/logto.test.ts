import { describe, expect, it } from "vitest";

import { toLocalUser } from "@/components/layout/logto-auth-provider";
import { buildAppUrl, buildNewApiUrl } from "@/constant/logto";

describe("Logto 配置", () => {
    it("按部署子路径生成登录回调和退出地址", () => {
        expect(buildAppUrl("callback", "https://example.com", "/lingweave/")).toBe("https://example.com/lingweave/callback");
        expect(buildAppUrl("", "https://example.com", "/")).toBe("https://example.com/");
    });

    it("生成 NewAPI 控制台和钱包地址", () => {
        expect(buildNewApiUrl("dashboard")).toBe("https://relay.cqaiclub.asia/dashboard");
        expect(buildNewApiUrl("/wallet")).toBe("https://relay.cqaiclub.asia/wallet");
    });

    it("将 Logto claims 转换为本地用户", () => {
        const user = toLocalUser({
            iss: "https://auth.cqaiclub.asia/oidc",
            sub: "user-1",
            aud: "app-1",
            exp: 1,
            iat: 1,
            username: "lingweaver",
            name: "灵织用户",
            picture: "https://example.com/avatar.png",
        });

        expect(user).toEqual({ id: "user-1", username: "lingweaver", displayName: "灵织用户", avatarUrl: "https://example.com/avatar.png" });
    });
});
