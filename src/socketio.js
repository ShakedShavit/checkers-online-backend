const { Player } = require("./utils/player");
const User = require("./models/user");

const initiateSockets = (io) => {
    io.on('connection', (socket) => {
        console.log('New WebSocket connection');
        let player;

        socket.on('enterGameLobby', ({ username, rank, id }) => {
            if (!player) player = new Player(socket.id, username, rank, id);
            player.addPlayerToLobby();
            socket.join('ranked-lobby');
            socket.broadcast.to('ranked-lobby').emit('playerJoiningLobby', player.playerClientFormat);

            socket.emit('getRankedLobby', Player.rankedLobby.map((player) => {return player.playerClientFormat}));
        });

        socket.on('inviteForMatch', async ({ invitedPlayerSocketId, invitingPlayer }) => {
            socket.to(invitedPlayerSocketId).emit('invitedForMatchClient', { id: socket.id, ...invitingPlayer });
            player.startMatchProcess(invitedPlayerSocketId);
        });

        socket.on('acceptMatchInvite', () => {
            io.to(player.id).to(player.opponent.id).emit('matchInvitationAccepted', { player1: player.playerClientFormat, player2: player.opponent.playerClientFormat });

            socket.leave('ranked-lobby');
            io.sockets.sockets.get(player.opponent.id).leave('ranked-lobby');

            socket.broadcast.to('ranked-lobby').emit('playerLeavingLobby', [player.id, player.opponent.id]);

            player.matchAccepted();
        })

        const updateRank = async (isTie, isVictory) => {
            try {
                let opponent = player.opponent;

                await player.updateRank(isTie, isVictory);

                socket.emit('updateMyRank', player.rank);
                socket.to(opponent.id).emit('updateMyRank', opponent.rank);
                socket.to('ranked-lobby').emit('playerRankChanged', { userId: player.userId, newRank: player.rank });
            } catch(err) {
                socket.emit('updatingRankFailed');
            }
        }

        socket.on('movePlayed', async ({ squareObjectsBoard, isWin, isTie }) => {
            socket.to(player.opponent.id).emit('getNewBoard', { squareObjectsBoard, isWin, isTie });

            if (isWin || isTie) {
                await updateRank(isTie, isWin);
            }
        });

        socket.on('declineMatch', async () => {
            await quittingMatch();
        });

        socket.on('quitMatch', async () => {
            await quittingMatch();
            // send event to the player that quit and listen to it in lobby (not in page match)
            // send event to the opponent to listen to in tha match page)
        });

        const quittingMatch = async () => {
            if (!player.opponent) return; // If there is a match (or invited/inviting to match)

            let opponent = player.opponent;

            if (player.isInMatch) {
                await updateRank(false, false);

                socket.emit('quittingProcessDone');
                socket.to(opponent.id).emit('opponentQuitDuringMatch');
                
                return;
            }
            socket.to(opponent.id).emit('opponentQuit');
            player.endMatchProcess();
        }

        const removePlayer = async (socket) => {
            if (!player) return; // If the user logged in

            await quittingMatch();

            socket.leave('ranked-lobby');
            socket.broadcast.to('ranked-lobby').emit('playerLeavingLobby', [player.id]);
            player = null;
            Player.deletePlayer(socket.id);
        }

        // Add the logout event in the client side!
        socket.on('logout', async () => {
            await removePlayer(socket);
        });
        socket.on('disconnect', async () => {
            await removePlayer(socket);
        });
    });
}

module.exports = initiateSockets;