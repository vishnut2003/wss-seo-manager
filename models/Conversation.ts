import { Schema, model, models, type Model } from "mongoose";

/**
 * SEO Manager chatbot conversations, scoped per project and per user. Stores
 * only the human-readable turns (user prompt + assistant reply); intermediate
 * tool traffic stays server-side and is never persisted.
 */
export type ChatRole = "user" | "assistant";

export interface IChatMessage {
  role: ChatRole;
  content: string;
  createdAt: Date;
}

export interface IConversation {
  projectId: string;
  /** Owner (email) — conversations are private to the user who started them. */
  userId: string;
  title?: string;
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

type ConversationModel = Model<IConversation>;

const messageSchema = new Schema<IChatMessage>(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const conversationSchema = new Schema<IConversation, ConversationModel>(
  {
    projectId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    title: { type: String },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true }
);

// Fast lookup of a user's most recent threads for a project.
conversationSchema.index({ projectId: 1, userId: 1, updatedAt: -1 });

const Conversation =
  (models.Conversation as ConversationModel) ||
  model<IConversation, ConversationModel>("Conversation", conversationSchema);

export default Conversation;
