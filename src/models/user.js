const mongoose = require("mongoose");
require("../db/mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            unique: true,
            required: true,
            trim: true,
        },
        password: {
            type: "String",
            required: true,
            minlength: 6,
            validate(value) {
                if (!/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{6,}$/.test(value))
                    throw new Error(
                        "Passwords must contain at least six characters, at least one letter, one number and one capital letter"
                    );
            },
        },
        rank: {
            type: "Number",
            default: 1,
        },
        tokens: [
            {
                token: {
                    type: String,
                    required: true,
                },
            },
        ],
    },
    {
        timestamps: true,
    }
);

// Hiding info
userSchema.methods.toJSON = function () {
    const user = this;
    const userObj = user.toObject();

    delete userObj.password;
    delete userObj.tokens;

    return userObj;
};

userSchema.methods.generateAuthToken = async function () {
    const user = this;
    const token = jwt.sign(
        {
            _id: user._id,
        },
        process.env.TOKEN_SECRET,
        {
            expiresIn: "6h",
        }
    );

    user.tokens = user.tokens.concat({ token });
    await user.save();

    return token;
};

userSchema.statics.findByCredentials = async (username, password) => {
    let loginCredentialsErrorMsg = "Username and/or password are incorrect";

    let user = await UserModel.findOne({ username });
    if (!user) throw new Error(loginCredentialsErrorMsg);

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) throw new Error(loginCredentialsErrorMsg);

    return user;
};

// Hash the plain text password before saving
userSchema.pre("save", async function (next) {
    const user = this;

    if (user.isModified("password")) user.password = await bcrypt.hash(user.password, 8);

    next();
});

const UserModel = mongoose.model("UserModel", userSchema);

module.exports = UserModel;
