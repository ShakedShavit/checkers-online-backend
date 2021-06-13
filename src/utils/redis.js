const redisClient = require('../db/redis');

const deleteKeysInRedis = async (keysArr) => {
    try {
        await redisClient.delAsync(...keysArr);
    } catch (err) {
        throw new Error(err.message);
    }
}

const doesKeyExistInRedis = async (key) => {
    try {
        const doesKeyExist = await redisClient.existsAsync(key);
        return doesKeyExist;
    } catch (err) {
        throw new Error(err.message);
    }
}

const appendElementsToListInRedis = async (key, elementsArr) => {
    try {
        await redisClient.rpushAsync(key, ...elementsArr);
    } catch (err) {
        throw new Error(err.message);
    }
}

const getElementsFromListInRedis = async (key, start = 0, end = -1) => {
    try {
        return await redisClient.lrangeAsync(key, start, end);
    } catch (err) {
        throw new Error(err.message);
    }
}

const trimListInRedis = async (key, start = 0, end = -1) => {
    try {
        await redisClient.ltrimAsync(key, start, end);
    } catch (err) {
        throw new Error(err.message);
    }
}

const removeElementFromListInRedis = async (key, element, count = 0) => {
    try {
        await redisClient.lremAsync(key, count, element);
    } catch (err) {
        throw new Error(err.message);
    }
}

module.exports = {
    appendElementsToListInRedis,
    getElementsFromListInRedis,
    trimListInRedis,
    removeElementFromListInRedis
};