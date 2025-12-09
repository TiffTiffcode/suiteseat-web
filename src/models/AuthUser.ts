//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\models\AuthUser.ts
// src/models/AuthUser.ts
import mongoose, { Schema, type Model } from 'mongoose';

export interface IAuthUser {
  _id: mongoose.Types.ObjectId;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  passwordHash?: string;  // ✅ main field we use now
  password?: string;      // legacy, optional
  role?: string;
  roles?: string[];
}

const AuthUserSchema = new Schema<IAuthUser>(
  {
    email: { type: String, required: true, unique: true, index: true },
    firstName: String,
    lastName: String,
    phone: String,
    passwordHash: String,
    password: String,
    role: { type: String, default: 'pro' },
    roles: [{ type: String }],
  },
  {
    timestamps: true,
    collection: 'authusers',
  }
);

export default (mongoose.models.AuthUser as Model<IAuthUser>) ||
  mongoose.model<IAuthUser>('AuthUser', AuthUserSchema);

