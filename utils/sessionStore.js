const sessions = new Map();

export const getSession = (sessionId) => {
    let session = sessions.get(sessionId);

    if (!session) {
        session = {
            stage: "greeting",
            userName: null,
            language: "en",
        };
        sessions.set(sessionId, session);
    }

    return session;
};