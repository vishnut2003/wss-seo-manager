import {
  Schema,
  model,
  models,
  type Model,
  type HydratedDocument,
} from "mongoose";
import bcrypt from "bcryptjs";

export type UserRole = "super_admin" | "admin" | "user";

export interface IUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

type UserModel = Model<IUser, object, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["super_admin", "admin", "user"],
      default: "user",
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(
  candidate: string
) {
  return bcrypt.compare(candidate, this.password);
};

export type UserDocument = HydratedDocument<IUser, IUserMethods>;

const User =
  (models.User as UserModel) || model<IUser, UserModel>("User", userSchema);

export default User;
