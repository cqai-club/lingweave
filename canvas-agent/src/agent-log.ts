const ANSI_ESCAPE = /\u001b\[[0-?]*[ -/]*[@-~]/g;

export function redactAgentLog(text: string) {
    return text
        .replace(ANSI_ESCAPE, "")
        .replace(/(authorization\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\r\n,;]+)/gi, "$1[REDACTED]")
        .replace(/(Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi, "$1[REDACTED]")
        .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED]")
        .replace(/((?:api[ _-]*key|token)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, "$1[REDACTED]");
}

export function createAgentLogWriter(emit: (text: string) => void) {
    let buffer = "";
    const send = (value: string) => emit(redactAgentLog(value));
    return {
        write(value: string) {
            buffer += value;
            let newline = buffer.indexOf("\n");
            while (newline >= 0) {
                send(buffer.slice(0, newline + 1));
                buffer = buffer.slice(newline + 1);
                newline = buffer.indexOf("\n");
            }
        },
        flush() {
            if (buffer) send(buffer);
            buffer = "";
        },
        clear() {
            buffer = "";
        },
    };
}
