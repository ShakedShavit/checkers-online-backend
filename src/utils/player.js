const User = require('../models/user');

class Player {
    constructor(socketId, username, rank, userId) {
        this.id = socketId;
        this.username = username;
        this.rank = rank;
        this.userId = userId;
        this.isInMatch = false; // is in a match (invitation not included)
        this.opponent = null; // In match or after invitation
        
        // this.constructor.rankedLobby.push(this);
    }

    static rankedLobby = [];

    addPlayerToLobby() {
        Player.rankedLobby.push(this);
    }

    set setRank(value) {
        if (value < 1) value = 1;
        this.rank = value;
    }

    async updateRank(isTie, isVictory) {
        const playerRank = this.rank;
        const opponentRank = this.opponent.rank; 

        const rankDifferenceMax = 5; // The max rank one can lose/gain is rankDifferenceMax * 2 + 1
        const rankDifference = playerRank - opponentRank;

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
        }

        // In case of tie, add 1 to the rank of the player with the lower rank
        if (isTie) {
            if (rankDifference > 0) {
                this.opponent.setRank = opponentRank + 1;
            } else if (rankDifference < 0) {
                this.setRank = playerRank + 1;
            }
        } else {
            if (isVictory) {
                this.setRank = playerRank + rankFactor;
                this.opponent.setRank = opponentRank - rankFactor;
            } else {
                this.setRank = playerRank - reverseFactor(rankFactor);
                this.opponent.setRank = opponentRank + reverseFactor(rankFactor);
            }
        }

        try {
            if (playerRank !== this.rank || opponentRank !== this.opponent.rank) {
                const users = await User.find({ $or: [ { _id: this.userId }, { _id: this.opponent.userId } ] });
                console.log(users, 'users');
                if (users.length !== 2) throw new Error('Players were not found in DB');
               
                const playersMap = new Map([[ this.userId, this.rank ], [ this.opponent.userId, this.opponent.rank ] ])
                users[0].rank = playersMap.get(users[0]._id.toString());
                users[1].rank = playersMap.get(users[1]._id.toString());

                await users[0].save();
                await users[1].save();

                // await new Promise(resolve => setTimeout(resolve, 1000));


                // const user1 = await User.findById(this.userId);
                // const user2 = await User.findById(this.opponent.userId);
                // user1.rank = this.rank;
                // user2.rank = this.opponent.rank;
                // await user1.save();
                // await user2.save();
            }
            console.log('78');
            this.endMatchProcess();
        } catch(err) {
            console.log(err);
            this.endMatchProcess();
        }
    }

    get playerClientFormat() {
        let user = {
            username: this.username,
            userId: this.userId,
            socketId: this.id,
            rank: this.rank,
            isInMatch: this.isInMatch
        };

        if (!!this.opponent) user.opponentSocketId = this.opponent.id;

        return user;
    }

    startMatchProcess(opponentSocketId) {
        this.opponent = Player.rankedLobby.find(player => player.id === opponentSocketId);
        this.opponent.opponent = this;
    }

    matchAccepted() {
        this.isInMatch = true;
        this.opponent.isInMatch = true;
        Player.rankedLobby = Player.rankedLobby.filter(player => player.id !== this.id && player.id !== this.opponent.id);
    }
    
    endMatchProcess() {
        let opponent = this.opponent;

        opponent.opponent = null;
        opponent.isInMatch = false;

        this.opponent = null;
        this.isInMatch = false;
    }

    static deletePlayer(socketId) {
        this.rankedLobby = this.rankedLobby.filter(player => player.id !== socketId);
    }
}

module.exports = { Player };