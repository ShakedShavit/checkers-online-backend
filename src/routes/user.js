const express = require('express');
const User = require('../models/user');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const user = await User.findByCredentials(req.body.username, req.body.password);
        const token = await user.generateAuthToken();
    
        res.status(200).send({ user, token });
    } catch (err) {
        res.status(400).send(err.message || err);
    }
});

router.post('/signup', async (req, res) => {
    try {
        let user = await User.findOne({ username: req.body.username })
        if (!!user) return res.status(422).send('Username already taken. Please choose another one');

        user = new User({ ...req.body });
        await user.save();
        const token = await user.generateAuthToken();

        res.status(201).send({ user, token });
    } catch (err) {
        res.status(400).send(err.message);
    }
});

router.post('/users/logout', auth, async (req, res) => {
    try {
        const user = req.user;
        user.tokens = user.tokens.filter(tokenObj => tokenObj.token !== req.token);
        await user.save();
        res.status(200).send();
    } catch (e) {
        res.status(500).send();
    }
});

module.exports = router;