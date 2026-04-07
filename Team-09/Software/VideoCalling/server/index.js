import express from "express"; // Express.js framework to create the backend server
import dotenv from "dotenv"; // dotenv is used to load environment variables from a `.env` file
import cors from "cors"; // CORS (Cross-Origin Resource Sharing) allows frontend & backend communication
import cookieParser from "cookie-parser"; // Parses cookies from incoming requests
import { createServer } from "http"; // Creates an HTTP server (needed for WebSocket support)
import { Server } from "socket.io"; // Import `Server` from `socket.io` for real-time communication
// Import custom route files
import authRoute from "./rout/authRout.js"; // Import authentication routes (login/signup)
import userRoute from "./rout/userRout.js"; // Import user-related routes (profile, settings)
import dbConnection from "./db/dbConnect.js"; 
import { on } from "events";
// ✅ Load environment variables (from `.env` file)
dotenv.config();

// 🌍 Create an Express application
const app = express(); 

// 🔧 Set up server port (from `.env` or default to 3000)
const PORT = process.env.PORT || 3000;


const server = createServer(app);


app.get('/',(req,res) => {
    res.json('Welcome to the Video Calling Server!');
})

const io = new Server(server, {
    pingTimeout: 60000, // Timeout for ping/pong messages (60 seconds)
  cors: {
    origin: process.env.CLIENT_URL, // Allow requests from the client URL
    methods: ["GET", "POST"], // Allowed HTTP methods
    credentials: true, // Allow cookies to be sent with requests
  },
});

console.log("Socket.io server is running");

let onlineUsers = []; // Array to store online users
// const activeCalls = new Map(); // Map to track ongoing calls

// 📞 Handle WebSocket (Socket.io) connections
io.on("connection", (socket) => {
  console.log(`info - new connection ${socket.id}`);
  socket.emit("me", socket.id);

  socket.on("join", (user) => {
    if (!user || !user.id) {
      console.log("User data is missing or invalid");
      return;
    }

    socket.join(user.id); // Join user to a room

    const existingUser = onlineUsers.find((u) => u.userId === user.id);
    if (existingUser) {
      existingUser.socketId = socket.id; // Update socket ID
    } else {
      onlineUsers.push({ userId: user.id, socketId: socket.id, name: user.name });
    }

    io.emit("online-users", onlineUsers); // ✅ fixed event name
  });
  socket.on("callToUser", ( data ) => {
    console.log("callToUser event received:", data);
    const callee = onlineUsers.find((user) => user.userId === data.callToUserId);
    if (!callee) {
      socket.emit("userUnavailable", { message: "User is offline." }); // ❌ Notify caller if user is offline
      return;
    }

    io.to(callee.socketId).emit("callToUser", {
      signal: data.signalData, // WebRTC signal data
      from: data.from, // Caller ID
      name: data.name, // Caller name
      email: data.email, // Caller email
      profilepic: data.profilepic, // Caller profile picture
    });
  })
  socket.on("answeredCall", (data) => {
    io.to(data.to).emit("callAccepted", {
      signal: data.signal, // WebRTC signal data
      from: data.from, // Caller ID
      
    });
  })
  socket.on("reject-call", (data) => {
    io.to(data.callFrom).emit("callRejected", {

      name:data.name,
      profilepic:data.profilepic // Data about the user who rejected the call
    });
  })
  socket.on("call-ended", (data) => {
    io.to(data.to).emit("callEnded", {
      from: data.from, // ID of the user who ended the call
  // Profile picture of the user who ended the call
    });
  })
  socket.on("disconnect", () => {
    onlineUsers = onlineUsers.filter((u) => u.socketId !== socket.id);

    io.emit("online-users", onlineUsers); // ✅ fixed event name
    socket.broadcast.emit("disconnected", { disUser: socket.id });

    console.log(`info - user disconnected ${socket.id}`);
  });
});

 // Emit the socket ID to the client


const allowedOrigins = [process.env.CLIENT_URL]
app.use(cors({
  origin: function (origin, callback) { 
    if (!origin || allowedOrigins.includes(origin)) { 
      callback(null, true); // ✅ Allow the request if it's from an allowed origin
    } else {
      callback(new Error('Not allowed by CORS')); // ❌ Block requests from unknown origins
    }
  },
  credentials: true, // ✅ Allow sending cookies with requests
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // ✅ Allow these HTTP methods
}));

// 🛠 Middleware for handling JSON requests and cookies
app.use(express.json()); // Enables parsing of JSON request bodies
app.use(cookieParser()); // Enables reading cookies in HTTP requests
app.use("/api/auth", authRoute); // Authentication routes (login, signup, logout)
app.use("/api/user", userRoute); // User-related routes (profile, settings)

(async () => {
  try {
        // Connect to MongoDB
     await dbConnection();
     server.listen(PORT,() => {
        
      console.log(`✅ Server is running on port ${PORT}`);
    });
    
  } catch (error) {
    console.error("❌ Failed to connect to the database:", error);
    process.exit(1); // Exit the process if the database connection fails
  }
})();