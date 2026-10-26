import { FieldValue } from "firebase-admin/firestore";
import { appendTimeline, timelineEntry } from "@/lib/order-timeline";

export { appendTimeline as appendTimelineAdmin, timelineEntry };

export const serverTimestampField = () => FieldValue.serverTimestamp();
