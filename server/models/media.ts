import mongoose, { Document, Schema } from "mongoose";

export interface SeasonEntry {
  seasonNumber: number;
  totalEpisodes: number;
}

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

export type MediaCategory = "movie" | "series" | "manhwa" | "anime" | "book" | "cartoon" | "drama";

export interface IMedia extends Document {
  title: string;
  category: MediaCategory;
  coverImage: string;
  description: string;
  genres: string[];
  rating: number;
  recommended: boolean;
  progress: MediaProgress;
}

const SeasonEntrySchema: Schema = new Schema({
  seasonNumber: { type: Number, required: true },
  totalEpisodes: { type: Number, required: true },
}, { _id: false });

const MediaProgressSchema: Schema = new Schema({
  currentChapter: { type: Number },
  totalChapters: { type: Number },
  currentEpisode: { type: Number },
  totalEpisodes: { type: Number },
  currentSeason: { type: Number },
  totalSeasons: { type: Number },
  currentPage: { type: Number },
  totalPages: { type: Number },
  watched: { type: Boolean },
  watchPercentage: { type: Number },
  seasons: [SeasonEntrySchema],
}, { _id: false });

const MediaSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    category: { type: String, required: true, enum: ["movie", "series", "manhwa", "anime", "book", "cartoon", "drama"] },
    coverImage: { type: String, required: true },
    description: { type: String, required: true },
    genres: [{ type: String }],
    rating: { type: Number, required: true },
    recommended: { type: Boolean, default: false },
    progress: { type: MediaProgressSchema, required: true },
  },
  { timestamps: true }
);

const Media = mongoose.model<IMedia>("Media", MediaSchema);

export default Media;
