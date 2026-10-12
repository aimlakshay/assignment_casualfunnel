import mongoose from 'mongoose';

export const EVENT_TYPES = ['page_view', 'click'];

const eventSchema = new mongoose.Schema(
  {
    session_id: { type: String, required: true },
    event_type: { type: String, required: true, enum: EVENT_TYPES },
    page_url: { type: String, required: true },
    timestamp: { type: Date, required: true },

    // Click position in document coordinates (pageX / pageY). Only set for clicks.
    x: { type: Number },
    y: { type: Number },

    // Dimensions at the time of the event, used to scale clicks on the heatmap.
    viewport_width: { type: Number },
    viewport_height: { type: Number },
    page_width: { type: Number },
    page_height: { type: Number },
  },
  {
    versionKey: false,
    timestamps: { createdAt: 'received_at', updatedAt: false },
  }
);

// Session journey: all events of one session in time order.
eventSchema.index({ session_id: 1, timestamp: 1 });
// Heatmap: clicks for a given page.
eventSchema.index({ page_url: 1, event_type: 1 });

export const Event = mongoose.model('Event', eventSchema);
