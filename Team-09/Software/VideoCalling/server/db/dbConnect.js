import mongoose from "mongoose"

const dbConnection = async() => {
  try {
    await mongoose.connect(process.env.MONGOOSE_CONNECTION);
    console.log("✅ Connected to DataBase");
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    throw error;
  }
}

export default dbConnection