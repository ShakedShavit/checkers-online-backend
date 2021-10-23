const express = require("express");
const cors = require("cors");
const path = require("path");
require("./db/mongoose");
const userRouter = require("./routes/user");
const initiateSockets = require("./socketio/socketio");

const app = express();

const server = require("http").createServer(app);
initiateSockets(server);

const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());
app.use(userRouter);

if (process.env.NODE_ENV === "production") {
    app.use(express.static("client/build"));

    app.get("*", (req, res) => {
        res.sendFile(path.resolve(__dirname, "../", "client", "build", "index.html"));
    });
}

server.listen(port, () => {
    console.log("server connected, port:", port);
});
