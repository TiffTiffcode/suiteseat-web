//C:\Users\tiffa\OneDrive\Desktop\suiteseat-web\src\models\AuthUser.ts
// src/models/AuthUser.ts
import { Schema, model, models } from 'mongoose';

const AuthUserSchema = new Schema({
  email:        { type: String, index: true, unique: true },
  firstName:    { type: String },
  lastName:     { type: String },
  // 👇 your Atlas doc shows "passwordHash"
  passwordHash: { type: String },
  // Atlas shows "roles: []"
  roles:        { type: [String], default: [] },
  // if you also sometimes store a single role:
  role:         { type: String }
}, {
  timestamps: true,
  // your collection in Atlas is literally "authusers"
  collection: 'authusers'
});

export default models.AuthUser ?? model('AuthUser', AuthUserSchema);
