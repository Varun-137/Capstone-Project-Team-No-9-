import User from "../schema/userSchema.js";

// Get all users (excluding current logged-in user)
export const getAllUsers = async (req, res) => {
    const currentUserID = req.user?._conditions?._id;
   // console.log("current user",currentUserID);
    if (!currentUserID) return res.status(401).json({ success: false, message: "Unauthorized." });
    try {
        const users = await User.find({ _id: { $ne: currentUserID } }, "profilepic email username");
        res.status(200).json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}