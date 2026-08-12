export type SourceType = "LINK" | "UPLOAD";
export type Skill = "SERVE" | "ACE" | "SPIKE" | "BLOCK" | "DIG" | "SET" | "ASSIST";
export type Outcome = "POINT_WON" | "POINT_LOST" | "NO_POINT";

export interface Player {
  id: string;
  name: string;
  position: string | null;
  graduationYear: number | null;
  createdAt: string;
}

export interface Clip {
  id: string;
  title: string;
  sourceType: SourceType;
  url: string;
  playerId: string;
  skill: Skill;
  outcome: Outcome;
  opponent: string | null;
  matchDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ClipWithPlayer extends Clip {
  player: Player;
}

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  shareToken: string;
  createdAt: string;
}

export interface PlaylistClip {
  playlistId: string;
  clipId: string;
  position: number;
  clip: ClipWithPlayer;
}

export interface PlaylistWithClips extends Playlist {
  clips: PlaylistClip[];
}

export interface SharePlaylist {
  name: string;
  description: string | null;
  clips: ClipWithPlayer[];
}

export interface ClipFilters {
  playerId?: string;
  skill?: Skill;
  outcome?: Outcome;
  opponent?: string;
}
