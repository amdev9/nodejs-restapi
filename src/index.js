/* eslint-disable no-console */

import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import constants from "./config/constants";
import "./config/database";
import middlewaresConfig from "./config/middlewares";
import apiRoutes from "./modules";

const app = express();

middlewaresConfig(app);

app.get("/", (req, res) => {
  res.send("Hello world!");
});

apiRoutes(app);

const server = createServer(app);

let users = {};

const wss = new WebSocketServer({ noServer: true });
 
wss.on("connection", function(connection) {
  
  console.log("User connected");

  //when server gets a message from a connected user
  connection.on("message", function(message) {
    var data;
    //accepting only JSON messages
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.log("Invalid JSON");
      data = {};
    }

    //switching type of the user message
    switch (data.type) {
      //when a user tries to login

      case "login":
        console.log("User logged", data.name);

        //if anyone is logged in with this username then refuse
        if (users[data.name]) {
          sendTo(connection, {
            type: "login",
            success: false
          });
        } else {
          //save user connection on the server
          users[data.name] = connection;
          connection.name = data.name;

          sendTo(connection, {
            type: "login",
            success: true
          });
        }

        break;

      case "offer":
        //for ex. UserA wants to call UserB
        console.log("Sending offer to: ", data.name);

        //if UserB exists then send him offer details
        var conn = users[data.name];

        if (conn != null) {
          //setting that UserA connected with UserB
          connection.otherName = data.name;

          sendTo(conn, {
            type: "offer",
            offer: data.offer,
            name: connection.name
          });
        }

        break;

      case "answer":
        console.log("Sending answer to: ", data.name);
        //for ex. UserB answers UserA
        var conn = users[data.name];

        if (conn != null) {
          connection.otherName = data.name;
          sendTo(conn, {
            type: "answer",
            answer: data.answer
          });
        }

        break;

      case "candidate":
        console.log("Sending candidate to:", data.name);
        var conn = users[data.name];

        if (conn != null) {
          sendTo(conn, {
            type: "candidate",
            candidate: data.candidate
          });
        }

        break;

      case "leave":
        console.log("Disconnecting from", data.name);
        var conn = users[data.name];
        conn.otherName = null;

        //notify the other user so he can disconnect his peer connection
        if (conn != null) {
          sendTo(conn, {
            type: "leave"
          });
        }

        break;

      default:
        sendTo(connection, {
          type: "error",
          message: "Command not found: " + data.type
        });

        break;
    }
  });

  //when user exits, for example closes a browser window
  //this may help if we are still in "offer","answer" or "candidate" state
  connection.on("close", function() {
    if (connection.name) {
      delete users[connection.name];

      if (connection.otherName) {
        console.log("Disconnecting from ", connection.otherName);
        var conn = users[connection.otherName];
        conn.otherName = null;

        if (conn != null) {
          sendTo(conn, {
            type: "leave"
          });
        }
      }
    }
  });

  connection.send("Hello world");
});

function sendTo(connection, message) {
  connection.send(JSON.stringify(message));
}

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, socket => {
    wss.emit("connection", socket, request);
  });
});

server.listen(constants.PORT, err => {
  // add server emit upgrade event to wss

  if (err) {
    throw err;
  } else {
    console.log(`
      Server running on port: ${constants.PORT}
      ---
      Running on ${process.env.NODE_ENV}
      ---
      Make something great
    `);
  }
});
