const express = require("express");
const cors = require("cors");
// const cookieParser = require("cookie-parser");
require("dotenv").config();
const { Server } = require("socket.io");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();

const port = process.env.PORT || 4000;
// const uri = "mongodb://localhost:27017";
const uri = `mongodb+srv://${process.env.DB_ADDRE}:${process.env.DB_PASS}@cluster0.aeratuu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const http = require("http").createServer(app);
const io = new Server(http, {
  cors: {
    origin: [
      "http://localhost:3000", // Allow React app in development
      "https://chatify-app-z24j.onrender.com",
      "https://ch4tify.web.app", // Allow web app deployed on Firebase
      "https://ch4tify.firebaseapp.com", // Allow web app deployed on Firebase
    ],
    methods: ["GET", "POST"],
    credentials: true, // Ensure credentials are sent
  },
});

app.use(
  cors({
    origin: [
      "http://localhost:3000", // Allow React app in development
      "https://chatify-app-z24j.onrender.com",
      "https://ch4tify.web.app", // Allow web app deployed on Firebase
      "https://ch4tify.firebaseapp.com", // Allow web app deployed on Firebase
    ],
    credentials: true, // Ensure credentials are sent
  })
);
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
let users = [];
const run = async () => {
  try {
    const userCollection = client.db("chatify").collection("users");
    const friendCollection = client.db("chatify").collection("friends");
    const msgCollection = client.db("chatify").collection("messages");
    const groupCollection = client.db("chatify").collection("groups");
    const requestCollection = client.db("chatify").collection("requests");

    app.get("/users", async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });
    app.get("/user", async (req, res) => {
      const email = req.query?.email;
      const user = await userCollection.findOne({ email: email });
      res.send(user);
    });
    app.post("/user", async (req, res) => {
      const user = req.body;
      const exist = await userCollection.findOne({
        email: user.email,
        name: user.name,
      });
      if (exist) {
        return res.send({ message: "user already exist" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.get("/requester/:id", async (req, res) => {
      console.log(req.params.id);
      const filter = await requestCollection
        .find({ to: req.params.id })
        .toArray();
      res.send(filter);
    });
    app.post("/send-request", async (req, res) => {
      const data = req.body;
      console.log(data);
      const exist = await requestCollection.findOne({
        from: data?.from,
        to: data?.to,
      });
      if (exist) return res.send({ message: "request already exist" });
      const result = await requestCollection.insertOne(data);
      res.send(result);
    });
    app.post("/accept-request", async (req, res) => {
      const data = req.body;
      const added = await friendCollection.insertOne(data);
      const person1 = await userCollection.findOne({
        _id: new ObjectId(data.friend_from),
      });
      const person2 = await userCollection.findOne({
        _id: new ObjectId(data.to),
      });

      const personUpdate1 = await userCollection.updateOne(
        {
          _id: new ObjectId(data.friend_from),
        },
        {
          $push: { friends: { ...person2 } },
        }
      );
      const personUpdate2 = await userCollection.updateOne(
        {
          _id: new ObjectId(data.to),
        },
        {
          $push: { friends: { ...person1 } },
        }
      );
      res.send({ personUpdate1, personUpdate2 });
    });
    app.delete("/delete-request/:id", async (req, res) => {
      const filter = await requestCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(filter);
    });
    // group related apis
    app.get("/groups", async (req, res) => {
      const result = await groupCollection.find().toArray();
      res.send(result);
    });
    app.get("/group/:id", async (req, res) => {
      const filter = await groupCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(filter);
    });
    app.post("/group", async (req, res) => {
      const data = req.body;
      const exist = await groupCollection.findOne({
        group_name: data.group_name,
      });
      if (exist) {
        return res.send({ message: "group already exist" });
      }
      const result = await groupCollection.insertOne(data);
      if (result) {
        const group = await groupCollection.findOne({
          _id: new ObjectId(result?.insertedId),
        });
        const updateResult = await userCollection.updateOne(
          {
            _id: new ObjectId(group?.group_admin[0]?.member_id),
          },
          {
            $push: {
              join_groups: {
                group_id: group._id,
                group_name: group.group_name,
                group_image: group.group_image,
              },
            },
          }
        );
      }
      //
      res.send(result);
    });
    //
    app.post("/conversations", async (req, res) => {
      const data = req.body;
      const filter = await msgCollection
        .find({
          $or: [
            { from: data.from, to: data.to },
            { from: data.to, to: data.from },
          ],
        })
        .toArray();
      const nxtPersonData = await userCollection.findOne({
        _id: new ObjectId(data?.to),
      });
      res.send({ result: filter, chatUser: nxtPersonData });
    });
    app.post("/conversation", async (req, res) => {
      const body = req.body;
      const result = await msgCollection.insertOne(body);
      res.send(result);
    });
    // group conversition
    app.get("/group-info/:id", async (req, res) => {
      const result = await groupCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });
    app.post("/group-converstions", async (req, res) => {
      const body = req.body;
      const result = await msgCollection
        .find({ group_name: body?.group_name })
        .toArray();
      res.send(result);
    });
    app.post("/group-conversation", async (req, res) => {
      const body = req.body;
      const result = await msgCollection.insertOne(body);
      res.send(result);
    });
    // group request
    app.post("/group-request", async (req, res) => {
      const data = req.body;
      const exist = await requestCollection.findOne({
        user_id: data.user_id,
        group_name: data.group_name, // Check for matching group_name
      });
      if (exist) {
        return res.send({ message: "group already exist!" });
      }
      const result = await requestCollection.insertOne(data);
      res.send(result);
    });
    app.post("/group-request-accept", async (req, res) => {
      const body = req.body;

      const filterGroup = await groupCollection.updateOne(
        {
          _id: new ObjectId(body.group_id),
        },
        {
          $push: {
            group_members: {
              member_id: body.user_id,
              name: body.name,
              email: body.email,
              photoURL: body.photoURL,
              admin: false,
              block: false,
              mute: false,
            },
          },
        }
      );
      const filterUser = await userCollection.updateOne(
        {
          _id: new ObjectId(body.user_id),
        },
        {
          $push: {
            join_groups: {
              group_id: body.group_id,
              group_name: body.group_name,
              group_image: body.group_image,
            },
          },
        }
      );
      const deleteRequest = await requestCollection.deleteOne({
        _id: new ObjectId(body.request_id),
      });
      res.send({ filterGroup, deleteRequest });
    });
    app.get("/group-requests/:id", async (req, res) => {
      const result = await requestCollection
        .find({
          user_id: req.params?.id,
        })
        .toArray();
      return res.send(result);
    });
  } finally {
    // console.log()
  }
  io.on("connection", (socket) => {
    // console.log("socket id", socket.id);
    socket.on("addUser", (userId) => {
      if (users.includes(userId)) return;
      const user = { userId, socketId: socket.id };
      users.push(user);
      socket.userId = userId;
      io.emit("getUsers", users);
    });

    socket.on("sendMessage", (msgData) => {
      const recevier = users.find((user) => user.userId === msgData.to);
      const sender = users.find((user) => user.userId === msgData.from);
      if (recevier) {
        io.to(recevier?.socketId)
          .to(sender?.socketId)
          .emit("getMessage", msgData);
      }
    });

    socket.on("joinRoom", (room) => {
      socket.join(room);
    });
    socket.on("groupMessage", ({ room, msgData }) => {
      io.to(room).emit("getGroupMessage", msgData);
    });

    socket.on("disconnect", () => {
      users = users.filter((user) => user.socketId !== socket.id);
      io.emit("getUsers", users);
    });
  });
};
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("chat is running");
});
http.listen(port, () => {
  console.log(`Server is running now on port ${port}`);
});
