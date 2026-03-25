import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const client = new MongoClient(process.env.DATABASE_URL);

export let db;

export async function connectDB() {
  await client.connect();
  db = client.db("sxp_bridge");
  console.log("✅ DB connected");
}
