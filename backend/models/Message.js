const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  receiver: { type: String, required: true },
  text: { type: String },
  file: { type: String },
  type: { type: String, default: 'text' }, // text | image | video | file | voice
  edited: { type: Boolean, default: false },
  editedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
