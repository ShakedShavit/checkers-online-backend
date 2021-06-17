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
        return await redisClient.existsAsync(key);
    } catch (err) {
        throw new Error(err.message);
    }
}

const getStrValFromRedis = async (key) => {
    try {
        return redisClient.getAsync(key);
    } catch (err) {
        console.log(err.message, '62');
        throw new Error(err.message);
    }
}

const setStrValInRedis = async (key, value) => {
    try {
        if (typeof value !== 'string') throw new Error(`value's type must be string. value (${value}) input is of type ${typeof value}`);

        return redisClient.setAsync(key, value);
    } catch (err) {
        console.log(err.message, '73');
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

const setHashInRedis = async (key, hash) => {
    const hashArray = [];
    for (let [k, v] of Object.entries(hash)) {
        hashArray.push(k);
        hashArray.push(v);
    }

    try {
        return redisClient.hmsetAsync(key, hashArray);
    } catch (err) {
        throw new Error(err.message);
    }
}

const setHashValuesInRedis = async (hashKey, data) => {
    try {
        const doesKeyExist = await doesKeyExistInRedis(hashKey);
        if (!doesKeyExist) throw new Error('key does not exist in redis');

        return redisClient.hsetAsync(hashKey, ...data);
    } catch (err) {
        throw new Error(err.message);
    }
}

const getHashValuesFromRedis = async (hashKey, fieldsArr) => {
    try {
        return redisClient.hmgetAsync(hashKey, ...fieldsArr);
    } catch (err) {
        console.log(err.message, '12');
        throw new Error(err.message);
    }
}

const incHashIntValInRedis = async (hashKey, field, factor = 1) => {
    try {
        const doesKeyExist = await doesKeyExistInRedis(hashKey);
        // Return 0 or 1 (!0 equals True, !1 equals False)
        if (!doesKeyExist) throw new Error('key does not exist in redis');
        
        if (typeof factor !== 'number') {
            let prevFactor = factor;
            factor = parseInt(factor);
            if (isNaN(factor)) throw new Error(`factor's type must be number. factor (${prevFactor}) input is of type ${typeof prevFactor}`);
        }
        if (factor === 0) return 0;

        return redisClient.hincrbyAsync(hashKey, field, factor);
    } catch (err) {
        console.log(err.message, '37');
        throw new Error(err.message);
    }
}

module.exports = {
    deleteKeysInRedis,
    doesKeyExistInRedis,
    getStrValFromRedis,
    setStrValInRedis,
    appendElementsToListInRedis,
    getElementsFromListInRedis,
    trimListInRedis,
    removeElementFromListInRedis,
    setHashInRedis,
    setHashValuesInRedis,
    getHashValuesFromRedis,
    incHashIntValInRedis
};