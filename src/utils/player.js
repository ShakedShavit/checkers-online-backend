const { playersHashFields, lobbyRedisKey } = require("../constants/redisKeys");
const User = require("../models/user");
const {
    deleteKeysInRedis,
    doesKeyExistInRedis,
    removeElementFromListInRedis,
    setHashValuesInRedis,
    getHashValuesFromRedis,
    getPlayerRedisKey,
} = require("./redis");

const getOppSocketId = async (socketId) => {
    return (await getHashValuesFromRedis(getPlayerRedisKey(socketId), [playersHashFields[5]]))[0];
};

const removePlayersFromLobby = (socketIds) => {
    socketIds.forEach((socketId) => {
        removeElementFromListInRedis(lobbyRedisKey, socketId);
    });
};

const setPlayerValues = (data) => {
    data.forEach(({ socketId, keyValuePairs }) => {
        setHashValuesInRedis(getPlayerRedisKey(socketId), keyValuePairs);
    });
};

const getPlayersObjFromRedis = async (socketIds) => {
    let players = [];

    let getPlayersHashPromises = [];
    socketIds.forEach((socketId) => {
        getPlayersHashPromises.push(
            getHashValuesFromRedis(getPlayerRedisKey(socketId), playersHashFields)
        );
    });

    await Promise.all(getPlayersHashPromises).then((playersValues) => {
        playersValues.map((values) => {
            let player = {};
            for (let i = 0; i < values.length; i++) {
                switch (i) {
                    case 2:
                        values[i] = Number(values[i]);
                        break;
                    case 4:
                        values[i] = values[i] === "true";
                        break;
                    default:
                        break;
                }
                player[playersHashFields[i]] = values[i];
            }
            players.push(player);
        });
    });
    return players;
};

const quittingMatch = async (socket, firstPlayer, secondPlayer) => {
    if (firstPlayer == undefined || !secondPlayer == undefined) {
        const oppSocketId = await getOppSocketId(socket.id);
        [firstPlayer, secondPlayer] = await getPlayersObjFromRedis([socket.id, oppSocketId]);
    }

    if (!firstPlayer.opponentSocketId) return; // If there is a match (or invited/inviting to match)

    if (firstPlayer.isInMatch) {
        await updateRank(false, false, socket);

        socket.emit("quittingProcessDone");
        socket.to(secondPlayer.id).emit("opponentQuitDuringMatch");

        return;
    }
    socket.to(secondPlayer.id).emit("opponentQuit");

    setPlayerValues([
        {
            socketId: socket.id,
            keyValuePairs: [playersHashFields[4], "false", playersHashFields[5], ""],
        },
        {
            socketId: secondPlayer.id,
            keyValuePairs: [playersHashFields[4], "false", playersHashFields[5], ""],
        },
    ]);
};

const removePlayer = async (socket) => {
    if (!(await doesKeyExistInRedis(getPlayerRedisKey(socket.id)))) return; // If the user logged in
    console.log("REMOVING PLAYER");
    await quittingMatch(socket);

    socket.leave("ranked-lobby");
    socket.broadcast.to("ranked-lobby").emit("playerLeavingLobby", [socket.id]);
    removePlayersFromLobby([socket.id]);
    deleteKeysInRedis(getPlayerRedisKey(socket.id));
};

const calcAndUpdateRank = async (isTie, isVictory, firstPlayer, secondPlayer) => {
    let newFirstPlayerRank, newSecondPlayerRank;

    const rankDifferenceMax = 5; // The max rank one can lose/gain is rankDifferenceMax * 2 + 1
    const rankDifference = firstPlayer.rank - secondPlayer.rank;

    // The rank factor moves from 1 to (2 * rankDifferenceMax) + 1 (the higher it is, the bigger the win / the smaller the loss)
    let rankFactor = Math.floor(rankDifference / 5);
    if (rankFactor >= 0) {
        if (rankFactor > rankDifferenceMax) rankFactor = rankDifferenceMax;
        rankFactor = -rankFactor + rankDifferenceMax + 1;
    } else {
        if (rankDifference % 10 != 0) rankFactor++;
        if (rankFactor < -rankDifferenceMax) rankFactor = -rankDifferenceMax;
        rankFactor = -rankFactor + rankDifferenceMax + 1;
    }
    const reverseFactor = (factor) => {
        return 2 * rankDifferenceMax + 2 - factor;
    };

    // In case of tie, add 1 to the rank of the player with the lower rank
    if (isTie) {
        if (rankDifference > 0) {
            newSecondPlayerRank = secondPlayer.rank + 1;
        } else if (rankDifference < 0) {
            newFirstPlayerRank = firstPlayer.rank + 1;
        }
    } else {
        if (isVictory) {
            newFirstPlayerRank = firstPlayer.rank + rankFactor;
            newSecondPlayerRank = secondPlayer.rank - rankFactor;
        } else {
            newFirstPlayerRank = firstPlayer.rank - reverseFactor(rankFactor);
            newSecondPlayerRank = secondPlayer.rank + reverseFactor(rankFactor);
        }
    }

    const minRank = 1;
    if (newFirstPlayerRank < minRank) newFirstPlayerRank = minRank;
    if (newSecondPlayerRank < minRank) newSecondPlayerRank = minRank;

    try {
        if (firstPlayer.rank !== newFirstPlayerRank || secondPlayer.rank !== newSecondPlayerRank) {
            const users = await User.find({
                $or: [
                    {
                        _id: firstPlayer.userId,
                    },
                    {
                        _id: secondPlayer.userId,
                    },
                ],
            });
            if (users.length !== 2) throw new Error("Players were not found in DB");

            const playersMap = new Map([
                [firstPlayer.userId, newFirstPlayerRank],
                [secondPlayer.userId, newSecondPlayerRank],
            ]);
            users[0].rank = playersMap.get(users[0]._id.toString());
            users[1].rank = playersMap.get(users[1]._id.toString());

            await users[0].save();
            await users[1].save();
        }
        // this.endMatchProcess();

        return {
            newFirstPlayerRank,
            newSecondPlayerRank,
        };
    } catch (err) {
        console.log(err);
        this.endMatchProcess();
    }
};

const updateRank = async (isTie, isVictory, socket) => {
    try {
        const oppSocketId = await getOppSocketId(socket.id);
        const opponents = await getPlayersObjFromRedis([socket.id, oppSocketId]);

        const { newFirstPlayerRank, newSecondPlayerRank } = await calcAndUpdateRank(
            isTie,
            isVictory,
            ...opponents
        );
        setPlayerValues([
            {
                socketId: socket.id,
                keyValuePairs: [
                    playersHashFields[2],
                    newFirstPlayerRank,
                    playersHashFields[4],
                    "false",
                    playersHashFields[5],
                    "",
                ],
            },
            {
                socketId: oppSocketId,
                keyValuePairs: [
                    playersHashFields[2],
                    newSecondPlayerRank,
                    playersHashFields[4],
                    "false",
                    playersHashFields[5],
                    "",
                ],
            },
        ]);

        socket.emit("updateMyRank", newFirstPlayerRank);
        socket.to(oppSocketId).emit("updateMyRank", newSecondPlayerRank);
        socket.to("ranked-lobby").emit("playerRankChanged", {
            userId: opponents[0].userId,
            newRank: newFirstPlayerRank,
        });
    } catch (err) {
        socket.emit("updatingRankFailed");
    }
};

module.exports = {
    quittingMatch,
    removePlayer,
    getPlayersObjFromRedis,
    getOppSocketId,
    removePlayersFromLobby,
    setPlayerValues,
    updateRank,
};
