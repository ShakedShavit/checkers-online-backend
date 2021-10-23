const {
    invitePlayerForMatchEvent,
    enterGameLobbyEvent,
    movePlayedEvent,
    quitMatchEvent,
    userLogoutEvent,
    userDisconnectEvent,
    acceptMatchInviteEvent,
} = require("./socketEvents");

const initiateSockets = async (server) => {
    const io = require("socket.io")(server, {
        cors: {
            origin: `http://${process.env.DOMAIN}:3000`,
            credentials: true,
        },
    });

    io.on("connection", async (socket) => {
        enterGameLobbyEvent(socket);

        invitePlayerForMatchEvent(socket);

        acceptMatchInviteEvent(socket, io);

        movePlayedEvent(socket);

        quitMatchEvent(socket);

        userLogoutEvent(socket);
        userDisconnectEvent(socket);
    });
};

module.exports = initiateSockets;
