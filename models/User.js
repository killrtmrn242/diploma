const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      default: ""
    },
    authMethods: {
      type: [String],
      default: []
    },
    oauthProvider: {
      type: String,
      default: ""
    },
    oauthId: {
      type: String,
      default: ""
    },
    name: {
      type: String,
      default: ""
    },
    avatar: {
      type: String,
      default: ""
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

module.exports = mongoose.model("User", userSchema);
