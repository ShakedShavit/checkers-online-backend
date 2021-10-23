const { lobbyRedisKey, playersHashFields } = require("../constants/redisKeys");
const {
    removePlayer,
    quittingMatch,
    getPlayersObjFromRedis,
    getOppSocketId,
    removePlayersFromLobby,
    setPlayerValues,
    updateRank,
} = require("../utils/player");
const {
    getPlayerRedisKey,
    doesKeyExistInRedis,
    setHashInRedis,
    appendElementsToListInRedis,
    getElementsFromListInRedis,
} = require("../utils/redis");

const enterGameLobbyEvent = (socket) => {
    socket.on("enterGameLobby", async ({ username, rank, id }) => {
        let player = {
            id: socket.id,
            username,
            rank,
            userId: id,
            isInMatch: false, // is in a match (invitation not included)
            opponentSocketId: "", // In match or after invitation
        };

        let playerHashRedisKey = getPlayerRedisKey(player.id);
        if (!(await doesKeyExistInRedis("playerHashRedisKey"))) {
            setHashInRedis(playerHashRedisKey, player);
        }

        appendElementsToListInRedis(lobbyRedisKey, [player.id]);

        socket.join("ranked-lobby");
        socket.broadcast.to("ranked-lobby").emit("playerJoiningLobby", [player]);

        const lobbySockets = await getElementsFromListInRedis(lobbyRedisKey);
        const lobbyPlayers = await getPlayersObjFromRedis(lobbySockets);
        console.log(lobbyPlayers);

        socket.emit("getRankedLobby", lobbyPlayers);
    });
};

const invitePlayerForMatchEvent = (socket) => {
    socket.on("inviteForMatch", async ({ invitedPlayerSocketId, invitingPlayer }) => {
        socket.to(invitedPlayerSocketId).emit("invitedForMatchClient", {
            id: socket.id,
            ...invitingPlayer,
        });

        setPlayerValues([
            {
                socketId: socket.id,
                keyValuePairs: [playersHashFields[5], invitedPlayerSocketId],
            },
            {
                socketId: invitedPlayerSocketId,
                keyValuePairs: [playersHashFields[5], socket.id],
            },
        ]);

        // Removes the two players (inviting and invited) from the lobby (both the server lobby and the client lobby state),
        // but it doesn't remove them from the sockets lobby room
        socket.broadcast
            .to("ranked-lobby")
            .emit("playerLeavingLobby", [invitedPlayerSocketId, socket.id]);

        removePlayersFromLobby([socket.id, invitedPlayerSocketId]);
    });
};

const acceptMatchInviteEvent = (socket, io) => {
    socket.on("acceptMatchInvite", async () => {
        const oppSocketId = await getOppSocketId(socket.id);
        const opponents = await getPlayersObjFromRedis([socket.id, oppSocketId]);
        io.to(socket.id).to(oppSocketId).emit("matchInvitationAccepted", {
            player1: opponents[0],
            player2: opponents[1],
        });

        socket.leave("ranked-lobby");
        io.sockets.sockets.get(oppSocketId).leave("ranked-lobby");

        setPlayerValues([
            {
                socketId: socket.id,
                keyValuePairs: [playersHashFields[4], "true"],
            },
            {
                socketId: oppSocketId,
                keyValuePairs: [playersHashFields[4], "true"],
            },
        ]);
        removePlayersFromLobby([socket.id, oppSocketId]);
    });
};

const movePlayedEvent = (socket) => {
    socket.on("movePlayed", async ({ squareObjectsBoard, isWin, isTie }) => {
        const oppSocketId = await getOppSocketId(socket.id);
        socket.to(oppSocketId).emit("getNewBoard", {
            squareObjectsBoard,
            isWin,
            isTie,
        });

        if (isWin || isTie) {
            await updateRank(isTie, isWin, socket);
        }
    });
};

const quitMatchEvent = (socket) => {
    socket.on("quitMatch", async () => {
        const oppSocketId = await getOppSocketId(socket.id);
        const opponents = await getPlayersObjFromRedis([socket.id, oppSocketId]);

        if (!opponents[0].isInMatch) {
            socket.broadcast
                .to("ranked-lobby")
                .emit("playerJoiningLobby", [opponents[0], opponents[1]]);
            appendElementsToListInRedis(lobbyRedisKey, [socket.id, oppSocketId]);
        }
        await quittingMatch(socket, ...opponents);
        // send event to the player that quit and listen to it in lobby (not in page match)
        // send event to the opponent to listen to in tha match page)
    });
};

const userLogoutEvent = (socket) => {
    socket.on("logout", async () => {
        await removePlayer(socket);
    });
};

const userDisconnectEvent = (socket) => {
    socket.on("disconnect", async () => {
        await removePlayer(socket);
    });
};

module.exports = {
    enterGameLobbyEvent,
    invitePlayerForMatchEvent,
    acceptMatchInviteEvent,
    movePlayedEvent,
    quitMatchEvent,
    userLogoutEvent,
    userDisconnectEvent,
};
