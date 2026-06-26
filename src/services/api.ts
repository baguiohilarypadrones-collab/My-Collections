const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

export interface MediaProgress {
  currentChapter?: number;
  totalChapters?: number;
  currentEpisode?: number;
  totalEpisodes?: number;
  currentSeason?: number;
  totalSeasons?: number;
  currentPage?: number;
  totalPages?: number;
  watched?: boolean;
  watchPercentage?: number;
  seasons?: SeasonEntry[];
}

export interface SeasonEntry {
  seasonNumber: number;
  totalEpisodes: number;
}

export type MediaCategory = "movie" | "series" | "manhwa" | "anime" | "book" | "cartoon" | "drama";

export interface MediaItem {
  _id: string; //   MongoDB ID
  title: string;
  category: MediaCategory;
  coverImage: string;
  description: string;
  genres: string[];
  rating: number;
  recommended: boolean;
  createdAt: string;
  updatedAt: string;
  progress: MediaProgress;
  owner?: string;
}

/* =========================
  GET ALL MEDIA
========================= */
export async function fetchMedia(
  category?: string,
  sort?: string,
  order?: string,
  limit?: number
): Promise<MediaItem[]> {
  const params = new URLSearchParams();
  if (category && category !== "overall") params.append("category", category);
  if (sort) params.append("sort", sort);
  if (order) params.append("order", order);
  if (limit) params.append("limit", String(limit));

  const response = await fetch(`${API_BASE}/media?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to fetch media");
  }

  return response.json();
}

/* =========================
  GET SINGLE MEDIA
========================= */
export async function fetchMediaById(
  id: string
): Promise<MediaItem> {
  const response = await fetch(`${API_BASE}/media/${id}`);

  if (!response.ok) {
    throw new Error("Failed to fetch media");
  }

  return response.json();
}

/* =========================
  CREATE MEDIA
========================= */
export async function createMedia(
  data: Partial<MediaItem>
): Promise<MediaItem> {
  const response = await fetch(`${API_BASE}/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const body = (await response.json()) as { message?: string };
    throw new Error(body.message || "Failed to create media");
  }

  return response.json();
}

/* =========================
  UPDATE FULL MEDIA (PUT)
========================= */
export async function updateMedia(
  id: string,
  data: Partial<MediaItem>
): Promise<MediaItem> {
  const response = await fetch(`${API_BASE}/media/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const body = (await response.json()) as { message?: string };
    throw new Error(body.message || "Failed to update media");
  }

  return response.json();
}

/* =========================
  PATCH PROGRESS ONLY
========================= */
export async function patchProgress(
  id: string,
  updates: MediaProgress
): Promise<MediaItem> {
  const response = await fetch(
    `${API_BASE}/media/${id}/progress`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    }
  );

  if (!response.ok) {
    const body = (await response.json()) as { message?: string };
    throw new Error(body.message || "Failed to update progress");
  }

  return response.json();
}

/* =========================
  DELETE MEDIA
========================= */
export async function deleteMedia(
  id: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/media/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const body = (await response.json()) as { message?: string };
    throw new Error(body.message || "Failed to delete media");
  }
}

export interface MediaSections {
  recentlyUpdated: MediaItem[];
  recommendations: MediaItem[];
  random: MediaItem[];
}

export async function fetchSections(category: MediaCategory | "overall"): Promise<MediaSections> {
  const response = await fetch(
    `${API_BASE}/media/sections?category=${category}`
  );
  if (!response.ok) {
    const body = (await response.json()) as { message?: string };
    throw new Error(body.message || "Failed to load sections");
  }
  return response.json();
}
