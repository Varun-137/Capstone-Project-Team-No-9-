import React, { useEffect, useRef, useState } from 'react';
import { FaBars, FaTimes, FaPhoneAlt, FaMicrophone, FaVideo, FaVideoSlash, FaMicrophoneSlash, FaDoorClosed } from "react-icons/fa";
import Lottie from "lottie-react";
import { Howl } from "howler";

import { FaPhoneSlash } from "react-icons/fa6";
import apiClient from "../../apiClient";
import { useUser } from '../../context/UserContextApi';
import { RiLogoutBoxLine } from "react-icons/ri";
import { useNavigate } from 'react-router-dom';
import VideoCallSocket from '../components/socketio/VideoCallSocket';
import { Toaster } from 'react-hot-toast';
import Peer from 'simple-peer';
import "./index.css"




const Dashboard = () => {
  const { user, updateUser } = useUser();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userOnline, setUserOnline] = useState([]);
  const [stream, setStream] = useState(null);
  const [me, setMe] = useState("");
  const [showUserDetailModal, setShowUserDetailModal] = useState(false);
  const [showReciverDetails, setshowReciverDetails] = useState(null);
  const myVideo = useRef(null);
  const reciverVideo = useRef(null);
  const connectionRef = useRef(null);
  const hasJoined = useRef(false);
  const [reciveCall, setReciveCall] = useState(false);
  const [caller, setCaller] = useState(null);
  const [callerName, setCallerName] = useState("");
  const [callerSignal, setCallerSignal] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callerWating, setCallerWating] = useState(false)
  const [showReciverDetailPopUp, setShowReciverDetailPopUp] = useState(false);

  const [callRejectedPopUp, setCallRejectedPopUp] = useState(false);
  const [rejectorData, setCallrejectorData] = useState(null);


  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);


  const socket = VideoCallSocket.getSocket();
  console.log("Socket instance:", socket);
  
  
  useEffect(() => {
    if (user && socket && !hasJoined.current) {
      socket.emit("join", { id: user._id, name: user.username });
      hasJoined.current = true;
    }
    socket.on("me", (id) => setMe(id));
    socket.on("online-users", (onlineUsers) => {
      setUserOnline(onlineUsers); // Update state with the list of online users.
    });

    socket.on("callToUser", (data) => {
      setReciveCall(true);  // Set state to indicate an incoming call.
      setCaller(data);      // Store caller's information in state.
      setCallerName(data.name);  // Store caller's name.
      setCallerSignal(data.signal);  // Store WebRTC signal data for the call.
      // ✅ Start playing ringtone
      // ringtone.play();
    });
    socket.on("callRejected", (data) => {
      setCallRejectedPopUp(true);
      setCallrejectorData(data);
      // ✅ Stop ringtone in case call is ended before acceptance
      // ✅ Stop ringtone when call is accepted
      // ringtone.stop();
    });
    // Listen for "callEnded" event, which is triggered when the other user ends the call.
    socket.on("callEnded", (data) => {
      console.log("Call ended by", data.name); // Log the event in the console.
      // ✅ Stop ringtone in case call is ended before acceptance
      // ringtone.stop();
      endCallCleanup();  // Call a function to clean up the call state.
    });
    

    
    return () => {
      socket.off("me");  // Remove listener for "me" event.
      socket.off("callToUser");  // Remove listener for incoming calls.
      socket.off("callRejected");  // Remove listener for call rejection.
      socket.off("callEnded");  // Remove listener for call ending.
      // socket.off("userUnavailable");  // Remove listener for unavailable user.
      // socket.off("userBusy");  // Remove listener for busy user.
      socket.off("online-users");  // Remove listener for online users list.
    };

  }, [user, socket]);
  console.log("Online users:", userOnline);
  
  const allusers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/user');
      if (response.data.success !== false) {
        setUsers(response.data.users);
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    allusers();
  }, []);
  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const isOnlineUser = (userId) => {
    return userOnline.some((u) => u.userId === userId);
  };
  const startCall = async () => {
    try{
        const currentStream = await navigator.mediaDevices.getUserMedia({
        video: true, // Enable video
        audio: {
          echoCancellation: true, // ✅ Reduce echo in audio
          noiseSuppression: true  // ✅ Reduce background noise
        }
      });
      setStream(currentStream);
      if (myVideo.current) {
        myVideo.current.srcObject = currentStream;
        myVideo.current.muted = true; // ✅ Mute local audio to prevent feedback
        myVideo.current.volume = 0;   // ✅ Set volume to zero to avoid echo
      }
      setIsSidebarOpen(false);
      currentStream.getAudioTracks().forEach(track => (track.enabled = true));

      const peer = new Peer({
        initiator: true, // ✅ This user starts the call
        trickle: false,  // ✅ Prevents trickling of ICE candidates, ensuring a single signal exchange
        stream: currentStream // ✅ Attach the local media stream
      });
       peer.on("signal", (data) => {
        
        socket.emit("callToUser", {
          callToUserId: showReciverDetails._id, // ✅ ID of the user being called
          signalData: data, // ✅ WebRTC signal data required for establishing connection
          from: me, // ✅ ID of the caller
          name: user.username, // ✅ Caller’s name
          email: user.email, // ✅ Caller’s email
          profilepic: user.profilepic, // ✅ Caller’s profile picture
        });
       })
       peer.on("stream", (remoteStream) => {
        if (reciverVideo.current) {
          reciverVideo.current.srcObject = remoteStream; // ✅ Assign remote stream to video element
          reciverVideo.current.muted = false; // ✅ Ensure audio from the remote user is not muted
          reciverVideo.current.volume = 1.0; // ✅ Set volume to normal level
        }
      });
      socket.once("callAccepted", (data) => {
        setCallRejectedPopUp(false);
        setCallAccepted(true); 
        setCallerWating(false);
        setCaller(data.from); 
        peer.signal(data.signal); 
      });
       connectionRef.current = peer;
       setShowReciverDetailPopUp(false); 
    }catch (error) {
      console.error("Error starting call:", error);
    }
  }
  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMicOn;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const toggleCam = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isCamOn;
        setIsCamOn(videoTrack.enabled);
      }
    }
  };
  const endCallCleanup = () => {
    // ✅ Stop all media tracks (video & audio) to release device resources
    console.log("🔴 Stopping all media streams and resetting call...");
    if (stream) {
      stream.getTracks().forEach((track) => track.stop()); // ✅ Stops camera and microphone
    }
    // ✅ Clear the receiver's video (Remote user)
    if (reciverVideo.current) {
      console.log("🔴 Clearing receiver video");
      reciverVideo.current.srcObject = null;
    }
    // ✅ Clear the user's own video
    if (myVideo.current) {
      console.log("🔴 Clearing my video");
      myVideo.current.srcObject = null;
    }
    // ✅ Destroy the peer-to-peer connection if it exists
    connectionRef.current?.destroy();
    // ✅ Reset all relevant states to indicate call has ended
    // ✅ Stop ringtone when call is accepted
    // ringtone.stop();
    setCallerWating(false);
    setStream(null); // ✅ Remove video/audio stream
    setReciveCall(false); // ✅ Indicate no ongoing call
    setCallAccepted(false); // ✅ Ensure call is not mistakenly marked as ongoing
    setSelectedUser(null); // ✅ Reset the selected user
    setTimeout(() => {
      window.location.reload(); // ✅ Force reset if cleanup fails
    }, 100);
  };
  const handelacceptCall = async () => {
    // ✅ Stop ringtone when call is accepted
    // ringtone.stop();
    try {
      // ✅ Request access to the user's media devices (camera & microphone)
      const currentStream = await navigator.mediaDevices.getUserMedia({
        video: true, // Enable video
        audio: {
          echoCancellation: true, // ✅ Reduce echo in audio
          noiseSuppression: true  // ✅ Reduce background noise
        }
      });

      // ✅ Store the stream in state so it can be used later
      setStream(currentStream);

      // ✅ Assign the stream to the local video element for preview
      if (myVideo.current) {
        myVideo.current.srcObject = currentStream;
      }

      // ✅ Ensure that the audio track is enabled
      currentStream.getAudioTracks().forEach(track => (track.enabled = true));

      // ✅ Update call state
      setCallAccepted(true); // ✅ Mark call as accepted
      setReciveCall(true); // ✅ Indicate that the user has received the call
      setCallerWating(false);//reciver join the call
      setIsSidebarOpen(false); // ✅ Close the sidebar (if open)

      // ✅ Create a new Peer connection as the receiver (not the initiator)
      const peer = new Peer({
        initiator: false, // ✅ This user is NOT the call initiator
        trickle: false, // ✅ Prevents trickling of ICE candidates, ensuring a single signal exchange
        stream: currentStream // ✅ Attach the local media stream
      });

      // ✅ Handle the "signal" event (this occurs when the WebRTC handshake is completed)
      peer.on("signal", (data) => {
        // ✅ Emit an "answeredCall" event to the server with necessary response details
        socket.emit("answeredCall", {
          signal: data, // ✅ WebRTC signal data required for establishing connection
          from: me, // ✅ ID of the receiver (this user)
          to: caller.from, // ✅ ID of the caller
        });
      });

      // ✅ Handle the "stream" event (this is triggered when the remote user's media stream is received)
      peer.on("stream", (remoteStream) => {
        if (reciverVideo.current) {
          reciverVideo.current.srcObject = remoteStream; // ✅ Assign remote stream to video element
          reciverVideo.current.muted = false; // ✅ Ensure audio from the remote user is not muted
          reciverVideo.current.volume = 1.0; // ✅ Set volume to normal level
        }
      });

      // ✅ If there's an incoming signal (from the caller), process it
      if (callerSignal) peer.signal(callerSignal);

      // ✅ Store the peer connection reference to manage later (like ending the call)
      connectionRef.current = peer;
    } catch (error) {
      console.error("Error accessing media devices:", error); // ✅ Handle permission errors or device access failures
    }
  };

  const handleLogout = async () => {
    // if (callAccepted || reciveCall) {
    //   alert("You must end the call before logging out.");
    //   return;
    // }
    try {
      await apiClient.post('/auth/logout');
      socket.off("disconnect");
      socket.disconnect();
      VideoCallSocket.setSocket()
      updateUser(null);
      localStorage.removeItem("userData");
      navigate('/login');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };
  const handelendCall = () => {
    // ✅ Stop ringtone when call is accepted
    console.log("🔴 Sending call-ended event...");
    // ✅ Stop ringtone when call is accepted
    // ringtone.stop();
    // ✅ Notify the other user that the call has ended
    socket.emit("call-ended", {
      to: caller?.from || selectedUser, // ✅ Send call end signal to the caller or selected user
      name: user.username // ✅ Send the username to inform the other party
    });

    // ✅ Perform cleanup actions after ending the call
    endCallCleanup();
  };
  const handelrejectCall = () => {
    // ✅ Stop ringtone when call is accepted
    // ringtone.stop();
    // ✅ Update the state to indicate that the call is rejected
    setCallerWating(false);//reciver reject the call
    setReciveCall(false); // ✅ The user is no longer receiving a call
    setCallAccepted(false); // ✅ Ensure the call is not accepted

    // ✅ Notify the caller that the call was rejected
    socket.emit("reject-call", {
      callFrom: caller.from, // ✅ The caller's ID (who initiated the call)
      name: user.username, // ✅ The name of the user rejecting the call
      profilepic: user.profilepic // ✅ Placeholder profile picture of the user rejecting the call
    });
  };
  const handelSelectedUser = (user) => {
    // if (callAccepted || reciveCall) {
    //   alert("You must end the current call before starting a new one.");
    //   return;
    // }
    console.log("Selected user:", user);
    const selected = filteredUsers.find(user => user._id === user._Id);
    setSelectedUser(user._id);

    setShowReciverDetailPopUp(true);
    setshowReciverDetails(user)


  };

  return (
    <div className="flex min-h-screen bg-gray-100" id = "dashboard">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-10 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`bg-gradient-to-br from-blue-800 to-purple-800 text-white w-64 h-full p-4 flex flex-col fixed z-20 transition-transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0`}
      >
        {/* Header with close icon */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Users</h1>
          <button
            type="button"
            className="md:hidden text-white"
            onClick={() => setIsSidebarOpen(false)}
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search user..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 rounded-md bg-gray-800 text-white border border-gray-700 mb-3"
        />

        {/* User list scrollable */}
        <ul className="space-y-3 flex-1 overflow-y-auto pr-1">
          {filteredUsers.map((user) => (
            <li
              key={user._id}
              className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${selectedUser === user._id
                  ? "bg-green-600"
                  : "bg-gradient-to-r from-purple-600 to-blue-400"
                }`}
              onClick={() => handelSelectedUser(user)}
            >
              <div className="relative">
                <img
                  src={user.profilepic || "/default-avatar.png"}
                  alt={`${user.username}'s profile`}
                  className="w-10 h-10 rounded-full border border-white"
                />
                {isOnlineUser(user._id) && (
                  <span className="absolute top-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-800 rounded-full shadow-lg animate-bounce"></span>
                )}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm">{user.username}</span>
                <span className="text-xs text-gray-200 truncate w-32">
                  {user.email}
                </span>
              </div>
            </li>
          ))}
        </ul>

        {/* Logout button pinned bottom */}
        {user && (
          <div
            onClick={handleLogout}
            className="mt-4 flex items-center justify-center gap-2 bg-red-500 px-4 py-2 cursor-pointer rounded-lg hover:bg-red-600 transition"
          >
            <RiLogoutBoxLine />
            Logout
          </div>
        )}
      </aside>

      <div className="flex-1 p-6 md:ml-72 text-white">
        {/* Mobile Sidebar Toggle */}
        <button
          type="button"
          className="md:hidden text-2xl text-black mb-4"
          onClick={() => setIsSidebarOpen(true)}
        >
          <FaBars />
        </button>

        {/* Welcome */}
        {selectedUser || reciveCall || callAccepted ?  (
          <div className="relative w-full h-screen bg-black flex items-center justify-center">
           {/* Remote Video */}
          {callerWating ? <div>
              <div className="flex flex-col items-center">
                <p className='font-black text-xl mb-2'>User Details</p>
                <img
                  src={modalUser.profilepic || "/default-avatar.png"}
                  alt="User"
                  className="w-20 h-20 rounded-full border-4 border-blue-500 animate-bounce"
                />
                <h3 className="text-lg font-bold mt-3 text-white">{modalUser.username}</h3>
                <p className="text-sm text-gray-300">{modalUser.email}</p>
              </div>
            </div> : 
          <video
            ref={reciverVideo}
            autoPlay
            className="absolute top-0 left-0 w-full h-full object-contain rounded-lg"
          />
          } 
            <video
            ref={reciverVideo}
            autoPlay
            className="absolute top-0 left-0 w-full h-full object-contain rounded-lg"
          />
          <div className="absolute bottom-[75px] md:bottom-0 right-1 bg-gray-900 rounded-lg overflow-hidden shadow-lg">
              <video
              ref={myVideo}
              autoPlay
              playsInline
              className="w-32 h-40 md:w-56 md:h-52 object-cover rounded-lg"
            />
          </div>
          <div className="absolute top-4 left-4 text-white text-lg font-bold flex gap-2 items-center">
            <button
              type="button"
              className="md:hidden text-2xl text-white cursor-pointer"
              onClick={() => setIsSidebarOpen(true)}
            >
              <FaBars />
            </button>
            {caller?.username || "Caller"}
          </div>

          {/* Call Controls */}
          <div className="absolute bottom-4 w-full flex justify-center gap-4">
            <button
              type="button"
              className="bg-red-600 p-4 rounded-full text-white shadow-lg cursor-pointer"
              onClick={handelendCall}
            >
              <FaPhoneSlash size={24} />
            </button>
            {/* 🎤 Toggle Mic */}
            <button
              type="button"
              onClick={toggleMic}
              className={`p-4 rounded-full text-white shadow-lg cursor-pointer transition-colors ${isMicOn ? "bg-green-600" : "bg-red-600"
                }`}
            >
              {isMicOn ? <FaMicrophone size={24} /> : <FaMicrophoneSlash size={24} />}
            </button>

            {/* 📹 Toggle Video */}
            <button
              type="button"
              onClick={toggleCam}
              className={`p-4 rounded-full text-white shadow-lg cursor-pointer transition-colors ${isCamOn ? "bg-green-600" : "bg-red-600"
                }`}
            >
              {isCamOn ? <FaVideo size={24} /> : <FaVideoSlash size={24} />}
            </button>


          </div>
        
          </div>)
          : (
            <div>
              <div className="flex items-center gap-5 mb-6 bg-gray-800 p-5 rounded-xl shadow-md">
                <div className="w-20 h-20">
                  {/* <Lottie animationData={wavingAnimation} loop autoplay /> */}
                </div>
                <div>
                  <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
                    Hey {user?.username || "Guest"}! 👋
                  </h1>
                  <p className="text-lg text-gray-300 mt-2">
                    Ready to <strong>connect with friends instantly?</strong>
                    Just <strong>select a user</strong> and start your video call! 🎥✨
                  </p>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-gray-800 p-4 rounded-lg shadow-lg text-sm">
                <h2 className="text-lg font-semibold mb-2">💡 How to Start a Video Call?</h2>
                <ul className="list-disc pl-5 space-y-2 text-gray-400">
                  <li>📌 Open the sidebar to see online users.</li>
                  <li>🔍 Use the search bar to find a specific person.</li>
                  <li>🎥 Click on a user to start a video call instantly!</li>
                </ul>
              </div>
            </div>
          )}

        {showReciverDetailPopUp && showReciverDetails && (
          <div className="fixed inset-0 bg-transparent bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
              <div className="flex flex-col items-center">
                <p className='font-black text-xl mb-2'>User Details</p>
                <img
                  src={showReciverDetails.profilepic || "/default-avatar.png"}
                  alt="User"
                  className="w-20 h-20 rounded-full border-4 border-blue-500"
                />
                <h3 className="text-lg font-bold mt-3">{showReciverDetails.username}</h3>
                <p className="text-sm text-gray-500">{showReciverDetails.email}</p>

                <div className="flex gap-4 mt-5">
                  <button
                    onClick={() => {
                      setSelectedUser(showReciverDetails._id);
                      startCall(); // function that handles media and calling
                      setShowReciverDetailPopUp(false);
                    }}
                    className="bg-green-600 text-white px-4 py-1 rounded-lg w-28 flex items-center gap-2 justify-center"
                  >
                    Call <FaPhoneAlt />
                  </button>
                  <button
                    onClick={() => setShowReciverDetailPopUp(false)}
                    className="bg-gray-400 text-white px-4 py-1 rounded-lg w-28"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
        }
        {reciveCall && !callAccepted && (
        <div className="fixed inset-0 bg-transparent bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex flex-col items-center">
              <p className="font-black text-xl mb-2">Call From...</p>
              <img
                src={caller?.profilepic || "/default-avatar.png"}
                alt="Caller"
                className="w-20 h-20 rounded-full border-4 border-green-500"
              />
              <h3 className="text-lg font-bold mt-3">{callerName}</h3>
              <p className="text-sm text-gray-500">{caller?.email}</p>
              <div className="flex gap-4 mt-5">
                <button
                  type="button"
                  onClick={handelacceptCall}
                  className="bg-green-500 text-white px-4 py-1 rounded-lg w-28 flex gap-2 justify-center items-center"
                >
                  Accept <FaPhoneAlt />
                </button>
                <button
                  type="button"
                  onClick={handelrejectCall}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg w-28 flex gap-2 justify-center items-center"
                >
                  Reject <FaPhoneSlash />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {callRejectedPopUp && (
        <div className="fixed inset-0 bg-transparent bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex flex-col items-center">
              <p className="font-black text-xl mb-2">Call Rejected From...</p>
              <img
                src={rejectorData.profilepic || "/default-avatar.png"}
                alt="Caller"
                className="w-20 h-20 rounded-full border-4 border-green-500"
              />
              <h3 className="text-lg font-bold mt-3">{rejectorData.name}</h3>
              <div className="flex gap-4 mt-5">
                <button
                  type="button"
                  onClick={() => {
                    startCall(); // function that handles media and calling
                  }}
                  className="bg-green-500 text-white px-4 py-1 rounded-lg w-28 flex gap-2 justify-center items-center"
                >
                  Call Again <FaPhoneAlt />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // endCallCleanup();
                    setCallRejectedPopUp(false);
                    setShowReciverDetailPopUp(false);
                  }}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg w-28 flex gap-2 justify-center items-center"
                >
                  Back <FaPhoneSlash />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>


    </div>
  )
}
export default Dashboard