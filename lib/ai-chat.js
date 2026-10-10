export const AI_MESSAGE_LIMIT = 2000;
export const AI_HISTORY_LIMIT = 8;
export const AI_HISTORY_TEXT_LIMIT = 1000;
export function chatHistoryForRequest(messages) {
    const history = messages.slice(-AI_HISTORY_LIMIT).map(({ role, text, movieIds }) => ({
        role,
        text: text.slice(0, AI_HISTORY_TEXT_LIMIT),
        ...(movieIds?.length ? { movieIds: movieIds.slice(0, 4) } : {}),
    })).filter(turn => turn.text.trim());
    // Reserve room for the current message, including multibyte Vietnamese or emoji.
    while (new TextEncoder().encode(JSON.stringify(history)).byteLength > 22_000)
        history.shift();
    return history;
}
export function validChatHistory(value) {
    return Array.isArray(value) && value.length <= AI_HISTORY_LIMIT && value.every(turn => {
        if (!turn || typeof turn !== "object" || Array.isArray(turn))
            return false;
        const item = turn;
        return (item.role === "user" || item.role === "assistant")
            && typeof item.text === "string" && item.text.trim().length > 0 && item.text.length <= AI_HISTORY_TEXT_LIMIT
            && (item.movieIds === undefined || (Array.isArray(item.movieIds) && item.movieIds.length <= 4
                && item.movieIds.every(id => typeof id === "string" && id.length > 0 && id.length <= 100)));
    });
}
