/* ── Memorial Project ── */
export interface MemorialProject {
  id: string;
  slug: string;
  createdBy: string; // uid
  createdAt: number;
  updatedAt: number;

  // Niftar details
  nameHebrew: string;
  nameEnglish?: string;
  nameSpanish?: string;
  nameFrench?: string;
  fatherNameHebrew?: string;
  motherNameHebrew?: string;
  gender: "male" | "female";
  dateOfPassing: string; // Hebrew date string
  dateOfPassingGregorian?: string;
  photoURL?: string;
  biography?: string;
  familyMessage?: string;

  // Settings
  isPublic: boolean;
  allowAnonymous: boolean;
  status: "active" | "completed" | "archived" | "pending_moderation" | "hidden";

  // Tracks enabled
  tracks: TrackType[];

  // Stats (denormalized)
  totalPortions: number;
  claimedPortions: number;
  completedPortions: number;
  participantCount: number;
}

export type TrackType =
  | "mishnayos"
  | "tehillim"
  | "shnayim_mikra"
  | "mitzvot";

/* ── Track Portions ── */
export interface Portion {
  id: string;
  projectId: string;
  trackType: TrackType;
  reference: string; // e.g., "Berachos 1:1" or "Tehillim 23"
  displayName: string;
  displayNameHebrew: string;
  order: number;

  // Claim status
  status: "available" | "claimed" | "completed";
  claimedBy?: string; // uid
  claimedByName?: string;
  claimedAt?: number;
  completedAt?: number;
  deadline?: number;

  // Metadata
  seder?: string;
  masechet?: string;
  perek?: number;
  mishna?: number;
  mizmor?: number;
  parsha?: string;
}

/* ── User Profile (lzecher_users collection) ── */
export interface LzecherUser {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAdmin?: boolean;
  createdAt: number;
  language: string;

  // Stats
  totalClaimed: number;
  totalCompleted: number;
  projectsCreated: number;
  projectsContributed: string[]; // project IDs
}

/* ── Claim Record ── */
export interface Claim {
  id: string;
  projectId: string;
  portionId: string;
  trackType: TrackType;
  reference: string;
  userId: string;
  userName: string;
  userEmail?: string;
  claimedAt: number;
  completedAt?: number;
  deadline?: number;
  status: "active" | "completed" | "expired";
}

/* ── Mishnayos Data ── */
export interface Masechet {
  id: string;
  name: string;
  nameHebrew: string;
  seder: string;
  sederHebrew: string;
  order: number;
  perakim: number;
  mishnayot: number;
}

export interface MishnaPerek {
  masechet: string;
  perek: number;
  mishnayot: number;
}

/* ── Tehillim Data ── */
export interface TehillimMizmor {
  number: number;
  nameHebrew: string;
  nameEnglish: string;
  verses: number;
  book: number; // 1-5
}

/* ── Shnayim Mikra Data ── */
export interface Parsha {
  id: string;
  name: string;
  nameHebrew: string;
  book: string;
  bookHebrew: string;
  order: number;
  aliyot: number;
}

/* ── Mitzvah Template ── */
export interface MitzvahTemplate {
  id: string;
  title: string;
  titleHebrew: string;
  description: string;
  descriptionHebrew: string;
  category: "chesed" | "tefillah" | "tzedakah" | "limud" | "middot";
}

/* ── Notification ── */
export interface LzecherNotification {
  id: string;
  userId: string;
  projectId: string;
  type:
    | "portion_claimed"
    | "portion_completed"
    | "project_completed"
    | "deadline_reminder"
    | "new_participant";
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
}

/* ── Moderation Queue Item ── */
export interface ModerationItem {
  id: string;
  projectId: string;
  projectName: string;
  createdBy: string;
  createdByEmail: string;
  submittedAt: number;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedAt?: number;
  rejectionReason?: string;
}

/* ── Seder info for colors ── */
export const SEDER_COLORS: Record<string, string> = {
  Zeraim: "zeraim",
  Moed: "moed",
  Nashim: "nashim",
  Nezikin: "nezikin",
  Kodashim: "kodashim",
  Tahorot: "tahorot",
};
