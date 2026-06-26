import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "./utils/cn";
import {
  MediaCategory,
  MediaItem,
  MediaProgress,
  MediaSections,
  SeasonEntry,
  createMedia as createMediaItemApi,
  deleteMedia as deleteMediaApi,
  fetchMedia as fetchMediaApi,
  fetchMediaById as fetchMediaByIdApi,
  fetchSections as fetchSectionsApi,
  patchProgress as patchProgressApi,
  sendVerificationEmail,
  updateMedia as updateMediaApi,
} from "./services/api";

type NavCategory = "overall" | MediaCategory;
type ViewMode = "carousel" | "grid";
type MediaLinks = Record<string, { prequelIds: string[]; sequelIds: string[] }>;

type AddFormState = {
  title: string;
  category: MediaCategory;
  coverImage: string;
  description: string;
  genres: string;
  rating: number;
  currentChapter: number;
  totalChapters: number;
  currentEpisode: number;
  currentSeason: number;
  totalSeasons: number;
  seasons: SeasonEntry[];
  currentPage: number;
  totalPages: number;
  watched: boolean;
  watchPercentage: number;
  prequelIds: string[];
  sequelIds: string[];
};

const navItems: Array<{ label: string; value: NavCategory }> = [
  { label: "Overall", value: "overall" },
  { label: "Movies", value: "movie" },
  { label: "Series", value: "series" },
  { label: "Dramas", value: "drama" },
  { label: "Manhwa", value: "manhwa" },
  { label: "Anime", value: "anime" },
  { label: "Books", value: "book" },
  { label: "Cartoons", value: "cartoon" },
];

const categoryLabel: Record<MediaCategory, string> = {
  manhwa: "MANHWA",
  anime: "ANIME",
  series: "SERIES",
  drama: "DRAMA",
  movie: "MOVIE",
  book: "BOOK",
  cartoon: "CARTOON",
};

function makeSeasons(count: number): SeasonEntry[] {
  return Array.from({ length: Math.max(count, 1) }, (_, i) => ({
    seasonNumber: i + 1,
    totalEpisodes: 12,
  }));
}

const defaultForm: AddFormState = {
  title: "",
  category: "manhwa",
  coverImage: "",
  description: "",
  genres: "",
  rating: 8,
  currentChapter: 1,
  totalChapters: 100,
  currentEpisode: 1,
  currentSeason: 1,
  totalSeasons: 1,
  seasons: makeSeasons(1),
  currentPage: 1,
  totalPages: 300,
  watched: false,
  watchPercentage: 0,
  prequelIds: [],
  sequelIds: [],
};

const emptySections: MediaSections = {
  recentlyUpdated: [],
  recommendations: [],
  random: [],
};

const LINKS_KEY = "media_tracker_links";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}



function getSeasonEpisodes(progress: MediaProgress, seasonNum: number): number {
  const entry = (progress.seasons || []).find((s) => s.seasonNumber === seasonNum);
  return entry?.totalEpisodes ?? progress.totalEpisodes ?? 0;
}

function getTotalAllEpisodes(progress: MediaProgress): number {
  if (progress.seasons && progress.seasons.length > 0) {
    return progress.seasons.reduce((sum, s) => sum + s.totalEpisodes, 0);
  }
  return (progress.totalSeasons ?? 1) * (progress.totalEpisodes ?? 0);
}

function buildProgress(form: AddFormState): MediaProgress {
  if (form.category === "manhwa") {
    return {
      currentChapter: clamp(form.currentChapter, 0, form.totalChapters),
      totalChapters: Math.max(form.totalChapters, 1),
    };
  }

  if (
    form.category === "anime" ||
    form.category === "cartoon" ||
    form.category === "series" ||
    form.category === "drama"
  ) {
    const totalSeasons = Math.max(form.totalSeasons, 1);
    const seasons = form.seasons.slice(0, totalSeasons).map((s, i) => ({
      seasonNumber: i + 1,
      totalEpisodes: Math.max(s.totalEpisodes, 1),
    }));
    const currentSeason = clamp(form.currentSeason, 1, totalSeasons);
    const currentSeasonEps = seasons[currentSeason - 1]?.totalEpisodes ?? 12;
    const totalEpisodes = seasons.reduce((sum, s) => sum + s.totalEpisodes, 0);

    return {
      currentEpisode: clamp(form.currentEpisode, 0, currentSeasonEps),
      totalEpisodes,
      currentSeason,
      totalSeasons,
      seasons,
    };
  }

  if (form.category === "book") {
    return {
      currentPage: clamp(form.currentPage, 0, form.totalPages),
      totalPages: Math.max(form.totalPages, 1),
    };
  }

  return {
    watched: form.watched,
    watchPercentage: clamp(form.watchPercentage, 0, 100),
  };
}

function formatProgress(item: MediaItem) {
  const { progress } = item;

  if (item.category === "manhwa") {
    return `Chapter ${progress.currentChapter ?? 0} / ${progress.totalChapters ?? 0}`;
  }

  if (
    item.category === "anime" ||
    item.category === "cartoon" ||
    item.category === "series" ||
    item.category === "drama"
  ) {
    const seasonEps = getSeasonEpisodes(progress, progress.currentSeason ?? 1);
    return `Season ${progress.currentSeason ?? 1} - Episode ${progress.currentEpisode ?? 0} / ${seasonEps}`;
  }

  if (item.category === "book") {
    return `Page ${progress.currentPage ?? 0} / ${progress.totalPages ?? 0}`;
  }

  return progress.watched ? "Watched" : `Progress ${progress.watchPercentage ?? 0}%`;
}

function totalsSummary(item: MediaItem) {
  const p = item.progress;

  if (item.category === "manhwa") {
    return `Total Chapters: ${p.totalChapters ?? 0}`;
  }

  if (
    item.category === "anime" ||
    item.category === "cartoon" ||
    item.category === "series" ||
    item.category === "drama"
  ) {
    const total = getTotalAllEpisodes(p);
    return `Total Seasons: ${p.totalSeasons ?? 0} | Total Episodes: ${total}`;
  }

  if (item.category === "book") {
    return `Total Pages: ${p.totalPages ?? 0}`;
  }

  if (typeof p.watchPercentage === "number") {
    return `Total Watch Target: 100%`;
  }

  return "Total Status: 1 completed movie";
}

function getItemLinks(links: MediaLinks, id: string) {
  const rel = links[id];
  if (!rel) return { prequelIds: [], sequelIds: [] };
  return {
    prequelIds: rel.prequelIds || [],
    sequelIds: rel.sequelIds || [],
  };
}

function hasLinks(links: MediaLinks, id: string) {
  const { prequelIds, sequelIds } = getItemLinks(links, id);
  return prequelIds.length > 0 || sequelIds.length > 0;
}

export default function App() {
  const [activeCategory, setActiveCategory] = useState<NavCategory>("overall");
  const [sections, setSections] = useState<MediaSections>(emptySections);
  const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("carousel");
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [form, setForm] = useState<AddFormState>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>("");

  const [links, setLinks] = useState<MediaLinks>(safeParse(localStorage.getItem(LINKS_KEY), {}));

  useEffect(() => {
    localStorage.setItem(LINKS_KEY, JSON.stringify(links));
  }, [links]);

  const mediaById = useMemo(() => {
    return allMedia.reduce((acc, item) => {
      acc[item._id] = item;
      return acc;
    }, {} as Record<string, MediaItem>);
  }, [allMedia]);

  const mediaOptions = useMemo(() => {
    return allMedia.map((item) => ({ id: item._id, title: item.title }));
  }, [allMedia]);

  function handleEdit(item: MediaItem) {
    setEditingId(item._id);
    setForm({
      title: item.title,
      category: item.category,
      coverImage: item.coverImage,
      description: item.description,
      genres: item.genres.join(", "),
      rating: item.rating,
      currentChapter: item.progress.currentChapter || 1,
      totalChapters: item.progress.totalChapters || 100,
      currentEpisode: item.progress.currentEpisode || 1,
      currentSeason: item.progress.currentSeason || 1,
      totalSeasons: item.progress.totalSeasons || 1,
      seasons: item.progress.seasons || makeSeasons(1),
      currentPage: item.progress.currentPage || 1,
      totalPages: item.progress.totalPages || 300,
      watched: item.progress.watched || false,
      watchPercentage: item.progress.watchPercentage || 0,
      prequelIds: getItemLinks(links, item._id).prequelIds,
      sequelIds: getItemLinks(links, item._id).sequelIds,
    });
    setAddOpen(true);
  }

  async function handleRefreshSections(category: NavCategory) {
    setLoading(true);
    try {
      const [sectionData, allData] = await Promise.all([
        fetchSectionsApi(category),
        fetchMediaApi(category, undefined, "updatedAt", "desc", 100),
      ]);
      setSections(sectionData);
      setAllMedia(allData);
      setStatusText("");
    } catch (err) {
      console.error(err);
      setStatusText("Error: Failed to load sections");
      setSections(emptySections);
      setAllMedia([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    handleRefreshSections(activeCategory);
  }, [activeCategory]);

  async function onPatchProgress(id: string, updates: MediaProgress) {
    const now = new Date().toISOString();
    setAllMedia((current) =>
      current.map((item) =>
        item._id === id ? { ...item, progress: { ...item.progress, ...updates }, updatedAt: now } : item
      )
    );
    setSections((current) => ({
      ...current,
      recentlyUpdated: current.recentlyUpdated.map((item) =>
        item._id === id ? { ...item, progress: { ...item.progress, ...updates }, updatedAt: now } : item
      ),
      recommendations: current.recommendations.map((item) =>
        item._id === id ? { ...item, progress: { ...item.progress, ...updates }, updatedAt: now } : item
      ),
      random: current.random.map((item) =>
        item._id === id ? { ...item, progress: { ...item.progress, ...updates }, updatedAt: now } : item
      ),
    }));
    setStatusText("PATCH /media/id/progress " + JSON.stringify(updates));
    try {
      await patchProgressApi(id, updates);
      setStatusText("Progress updated!");
    } catch (err) {
      console.error(err);
      setStatusText("Error: Failed to update progress");
    }
  }

  function saveLinks(targetId: string, prequelIds: string[], sequelIds: string[]) {
    setLinks((current) => {
      const newLinks = { ...current };
      newLinks[targetId] = { prequelIds, sequelIds };
      return newLinks;
    });
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const payload = {
      title: form.title,
      category: form.category,
      coverImage: form.coverImage.trim() || "https://images.unsplash.com/photo-1517604931442-7e0c8e52363c?auto=format&fit=crop&w=1200&q=80",
      description: form.description.trim(),
      genres: form.genres.split(",").map((g) => g.trim()).filter(Boolean),
      rating: form.rating,
      recommended: form.rating >= 8.5,
      progress: buildProgress(form),
    };

    try {
      if (editingId) {
        await updateMediaApi(editingId, payload);
        saveLinks(editingId, form.prequelIds, form.sequelIds);
        setStatusText("Media updated!");
      } else {
        const newMedia = await createMediaItemApi(payload);
        saveLinks(newMedia._id, form.prequelIds, form.sequelIds);
        setStatusText("POST /media " + newMedia._id + " saved!");
      }
      setAddOpen(false);
      setForm(defaultForm);
      handleRefreshSections(activeCategory);
    } catch (error) {
      console.error(error);
      setStatusText("Error: " + (error as Error).message);
    }
  }

  function handleTotalSeasonsChange(newTotal: number) {
    const clamped = Math.max(newTotal, 1);
    setForm((current) => {
      const existing = current.seasons;
      const seasons: SeasonEntry[] = Array.from({ length: clamped }, (_, i) => {
        if (i < existing.length) return existing[i];
        return { seasonNumber: i + 1, totalEpisodes: 12 };
      });
      return { ...current, totalSeasons: clamped, seasons };
    });
  }

  const pageTitle = useMemo(() => {
    return navItems.find((item) => item.value === activeCategory)?.label ?? "Overall";
  }, [activeCategory]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    if (!normalizedSearch) return sections;
    return {
      recentlyUpdated: sections.recentlyUpdated.filter(
        (item) =>
          item.title.toLowerCase().includes(normalizedSearch) ||
          item.description.toLowerCase().includes(normalizedSearch) ||
          item.genres.join(" ").toLowerCase().includes(normalizedSearch)
      ),
      recommendations: sections.recommendations.filter(
        (item) =>
          item.title.toLowerCase().includes(normalizedSearch) ||
          item.description.toLowerCase().includes(normalizedSearch) ||
          item.genres.join(" ").toLowerCase().includes(normalizedSearch)
      ),
      random: sections.random.filter(
        (item) =>
          item.title.toLowerCase().includes(normalizedSearch) ||
          item.description.toLowerCase().includes(normalizedSearch) ||
          item.genres.join(" ").toLowerCase().includes(normalizedSearch)
      ),
    };
  }, [sections, normalizedSearch]);

  const filteredAllMedia = useMemo(() => {
    if (!normalizedSearch) return allMedia;
    return allMedia.filter(
      (item) =>
        item.title.toLowerCase().includes(normalizedSearch) ||
        item.description.toLowerCase().includes(normalizedSearch) ||
        item.genres.join(" ").toLowerCase().includes(normalizedSearch)
    );
  }, [allMedia, normalizedSearch]);

    return (
    <div className="min-h-screen dark:bg-slate-950 bg-slate-50 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-10 border-b bg-white/90 dark:bg-slate-900/90 backdrop-blur">
        <div className="max-w-7xl mx-auto flex w-full items-center justify-between gap-4 p-4">
          <h1 className="text-xl font-semibold uppercase tracking-wider">Media Tracker</h1>
          <div className="flex items-center gap-2">
            <button
              className={cn("carousel-nav", viewMode === "carousel" && "bg-indigo-600 text-white dark:bg-indigo-600 dark:text-white")}
              onClick={() => setViewMode("carousel")}
            >
              Carousel View
            </button>
            <button
              className={cn("carousel-nav", viewMode === "grid" && "bg-indigo-600 text-white dark:bg-indigo-600 dark:text-white")}
              onClick={() => setViewMode("grid")}
            >
              Grid View
            </button>
            <button
              className={cn("carousel-nav", darkMode && "bg-indigo-600 text-white dark:bg-indigo-600 dark:text-white")}
              onClick={() => setDarkMode((prev) => !prev)}
            >
              {darkMode ? "Light Mode" : "Dark Mode"}
            </button>
            <button
              className="rounded-xl bg-indigo-600 p-3 text-white font-medium transition hover:bg-indigo-700"
              onClick={() => { setAddOpen(true); setEditingId(null); setForm(defaultForm); }}
            >
              Add Card
            </button>
          </div>
        </div>
        <nav className="no-scrollbar mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto pb-4">
          {navItems.map((item) => (
            <button
              key={item.value}
              onClick={() => setActiveCategory(item.value)}
              className={cn("carousel-nav",
                activeCategory === item.value && "bg-indigo-600 text-white dark:bg-indigo-600 dark:text-white"
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        <h2 className="text-2xl font-semibold mb-4">{pageTitle}</h2>
        <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">Your personal media collection.</p>

        <div className="mb-4">
          <label className="block space-y-1 text-sm">
            <span>Search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search title, description, genres..."
              className="inputClass"
            />
          </label>
        </div>

        {statusText && <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">{statusText}</p>}

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="space-y-8">
            {viewMode === "carousel" ? (
              <>
                <MediaCarousel title="Recently Updated" items={filteredSections.recentlyUpdated} darkMode={darkMode} onPatch={onPatchProgress} onEdit={handleEdit} onShow={handleShow} />
                <MediaCarousel title="Recommendations" items={filteredSections.recommendations} darkMode={darkMode} onPatch={onPatchProgress} onEdit={handleEdit} onShow={handleShow} />
                <MediaCarousel title="Random" items={filteredSections.random} darkMode={darkMode} onPatch={onPatchProgress} onEdit={handleEdit} onShow={handleShow} />
              </>
            ) : (
              <MediaGrid items={filteredAllMedia} darkMode={darkMode} onPatch={onPatchProgress} onEdit={handleEdit} onShow={handleShow} />
            )}
          </div>
        )}
      </main>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md mx-auto p-6 rounded-2xl bg-white dark:bg-slate-900 shadow-lg overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-bold mb-4">{editingId ? "Edit Media" : "Add Media"}</h2>
            <form onSubmit={onSave} className="space-y-4">
              <div>
                <label className="block space-y-1 text-sm">
                  <span>Title</span>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="inputClass"
                    required
                  />
                </label>
              </div>
              <div>
                <label className="block space-y-1 text-sm">
                  <span>Category</span>
                  <select
                    value={form.category}
                    onChange={(e) => {
                      const newCategory = e.target.value as MediaCategory;
                      setForm((prev) => ({
                        ...prev,
                        category: newCategory,
                        // Reset progress fields based on new category
                        currentChapter: 1,
                        totalChapters: 100,
                        currentEpisode: 1,
                        currentSeason: 1,
                        totalSeasons: 1,
                        seasons: makeSeasons(1),
                        currentPage: 1,
                        totalPages: 300,
                        watched: false,
                        watchPercentage: 0,
                      }));
                    }}
                    className="inputClass"
                  >
                    <option value="movie">Movie</option>
                    <option value="series">Series</option>
                    <option value="manhwa">Manhwa</option>
                    <option value="anime">Anime</option>
                    <option value="book">Book</option>
                    <option value="cartoon">Cartoon</option>
                    <option value="drama">Drama</option>
                  </select>
                </label>
              </div>
              <div>
                <label className="block space-y-1 text-sm">
                  <span>Cover Image URL</span>
                  <input
                    type="url"
                    value={form.coverImage}
                    onChange={(e) => setForm((prev) => ({ ...prev, coverImage: e.target.value }))}
                    className="inputClass"
                  />
                </label>
              </div>
              <div>
                <label className="block space-y-1 text-sm">
                  <span>Description</span>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="inputClass"
                  ></textarea>
                </label>
              </div>
              <div>
                <label className="block space-y-1 text-sm">
                  <span>Genres (comma separated)</span>
                  <input
                    type="text"
                    value={form.genres}
                    onChange={(e) => setForm((prev) => ({ ...prev, genres: e.target.value }))}
                    className="inputClass"
                  />
                </label>
              </div>
              <div>
                <label className="block space-y-1 text-sm">
                  <span>Rating (1-10)</span>
                  <input
                    type="number"
                    value={form.rating}
                    onChange={(e) => setForm((prev) => ({ ...prev, rating: Number(e.target.value) }))}
                    min={1}
                    max={10}
                    className="inputClass"
                  />
                </label>
              </div>

              {form.category === "manhwa" && (
                <div className="flex gap-4">
                  <label className="block space-y-1 text-sm flex-1">
                    <span>Current Chapter</span>
                    <input
                      type="number"
                      value={form.currentChapter}
                      onChange={(e) => setForm((prev) => ({ ...prev, currentChapter: Number(e.target.value) }))}
                      min={1}
                      className="inputClass"
                    />
                  </label>
                  <label className="block space-y-1 text-sm flex-1">
                    <span>Total Chapters</span>
                    <input
                      type="number"
                      value={form.totalChapters}
                      onChange={(e) => setForm((prev) => ({ ...prev, totalChapters: Number(e.target.value) }))}
                      min={1}
                      className="inputClass"
                    />
                  </label>
                </div>
              )}

              {(form.category === "anime" ||
                form.category === "cartoon" ||
                form.category === "series" ||
                form.category === "drama") && (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <label className="block space-y-1 text-sm flex-1">
                      <span>Current Episode</span>
                      <input
                        type="number"
                        value={form.currentEpisode}
                        onChange={(e) => setForm((prev) => ({ ...prev, currentEpisode: Number(e.target.value) }))}
                        min={1}
                        className="inputClass"
                      />
                    </label>
                    <label className="block space-y-1 text-sm flex-1">
                      <span>Current Season</span>
                      <input
                        type="number"
                        value={form.currentSeason}
                        onChange={(e) => setForm((prev) => ({ ...prev, currentSeason: Number(e.target.value) }))}
                        min={1}
                        className="inputClass"
                      />
                    </label>
                  </div>
                  <label className="block space-y-1 text-sm">
                    <span>Total Seasons</span>
                    <input
                      type="number"
                      value={form.totalSeasons}
                      onChange={(e) => handleTotalSeasonsChange(Number(e.target.value))}
                      min={1}
                      className="inputClass"
                    />
                  </label>
                  {form.seasons.map((season, index) => (
                    <div key={index} className="flex gap-4 items-center">
                      <span className="text-sm font-medium">Season {season.seasonNumber}</span>
                      <label className="block space-y-1 text-sm flex-1">
                        <span>Episodes Per Season</span>
                        <input
                          type="number"
                          value={season.totalEpisodes}
                          onChange={(e) =>
                            setForm((prev) => {
                              const newSeasons = [...prev.seasons];
                              newSeasons[index] = { ...newSeasons[index], totalEpisodes: Number(e.target.value) };
                              return { ...prev, seasons: newSeasons };
                            })
                          }
                          min={1}
                          className="inputClass"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {form.category === "book" && (
                <div className="flex gap-4">
                  <label className="block space-y-1 text-sm flex-1">
                    <span>Current Page</span>
                    <input
                      type="number"
                      value={form.currentPage}
                      onChange={(e) => setForm((prev) => ({ ...prev, currentPage: Number(e.target.value) }))}
                      min={1}
                      className="inputClass"
                    />
                  </label>
                  <label className="block space-y-1 text-sm flex-1">
                    <span>Total Pages</span>
                    <input
                      type="number"
                      value={form.totalPages}
                      onChange={(e) => setForm((prev) => ({ ...prev, totalPages: Number(e.target.value) }))}
                      min={1}
                      className="inputClass"
                    />
                  </label>
                </div>
              )}

              {form.category === "movie" && (
                <div className="flex gap-4">
                  <label className="block space-y-1 text-sm flex-1">
                    <span>Watch Percentage</span>
                    <input
                      type="number"
                      value={form.watchPercentage}
                      onChange={(e) => setForm((prev) => ({ ...prev, watchPercentage: Number(e.target.value) }))}
                      min={0}
                      max={100}
                      className="inputClass"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.watched}
                      onChange={(e) => setForm((prev) => ({ ...prev, watched: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Watched</span>
                  </label>
                </div>
              )}

              <div>
                <label className="block space-y-1 text-sm">
                  <span>Prequels</span>
                  <MultiSelect
                    label="Prequels"
                    selected={form.prequelIds.map((id) => mediaById[id])}
                    options={mediaOptions.filter((o) => o.id !== editingId && !form.sequelIds.includes(o.id))}
                    onChange={(ids) => setForm((prev) => ({ ...prev, prequelIds: ids }))}
                    darkMode={darkMode}
                  />
                </label>
              </div>
              <div>
                <label className="block space-y-1 text-sm">
                  <span>Sequels</span>
                  <MultiSelect
                    label="Sequels"
                    selected={form.sequelIds.map((id) => mediaById[id])}
                    options={mediaOptions.filter((o) => o.id !== editingId && !form.prequelIds.includes(o.id))}
                    onChange={(ids) => setForm((prev) => ({ ...prev, sequelIds: ids }))}
                    darkMode={darkMode}
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="rounded-xl border p-3 text-sm font-medium transition border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 p-3 text-white font-medium transition hover:bg-indigo-700"
                >
                  {editingId ? "Update Media" : "Add Media"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Media Details Modal */}
      {selectedMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md mx-auto p-6 rounded-2xl bg-white dark:bg-slate-900 shadow-lg overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{selectedMedia.title}</h2>
              <button
                onClick={() => setSelectedMedia(null)}
                className="rounded-xl border p-2 text-sm font-medium transition border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            <img src={selectedMedia.coverImage} alt={selectedMedia.title} className="w-full h-auto rounded-xl object-contain mb-4" />
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">{selectedMedia.description}</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">Genres: {selectedMedia.genres.join(", ")}</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">Rating: {selectedMedia.rating}</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">Category: {categoryLabel[selectedMedia.category]}</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">Progress: {formatProgress(selectedMedia)}</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">{totalsSummary(selectedMedia)}</p>

            {hasLinks(links, selectedMedia._id) && (
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Linked Media</h3>
                {getItemLinks(links, selectedMedia._id).prequelIds.length > 0 && (
                  <div className="mb-2">
                    <p className="text-sm font-medium">Prequels:</p>
                    <div className="flex flex-wrap gap-2">
                      {getItemLinks(links, selectedMedia._id).prequelIds.map((id) => (
                        <button
                          key={id}
                          onClick={() => handleShow(mediaById[id])}
                          className="rounded-xl border p-2 text-sm font-medium transition border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          {mediaById[id]?.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {getItemLinks(links, selectedMedia._id).sequelIds.length > 0 && (
                  <div>
                    <p className="text-sm font-medium">Sequels:</p>
                    <div className="flex flex-wrap gap-2">
                      {getItemLinks(links, selectedMedia._id).sequelIds.map((id) => (
                        <button
                          key={id}
                          onClick={() => handleShow(mediaById[id])}
                          className="rounded-xl border p-2 text-sm font-medium transition border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          {mediaById[id]?.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  handleEdit(selectedMedia);
                  setSelectedMedia(null);
                }}
                className="rounded-xl bg-indigo-600 p-3 text-white font-medium transition hover:bg-indigo-700"
              >
                Edit
              </button>
              <button
                onClick={async () => {
                  if (window.confirm("Are you sure you want to delete this item?")) {
                    try {
                      await deleteMediaApi(selectedMedia._id);
                      setStatusText("Media deleted!");
                      setSelectedMedia(null);
                      handleRefreshSections(activeCategory);
                    } catch (error) {
                      console.error(error);
                      setStatusText("Error: " + (error as Error).message);
                    }
                  }
                }}
                className="rounded-xl bg-rose-600 p-3 text-white font-medium transition hover:bg-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface MediaCarouselProps {
  title: string;
  items: MediaItem[];
  darkMode: boolean;
  onPatch: (id: string, updates: MediaProgress) => void;
  onEdit: (item: MediaItem) => void;
  onShow: (item: MediaItem) => void;
}

function MediaCarousel({ title, items, darkMode, onPatch, onEdit, onShow }: MediaCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth / 2;
      scrollRef.current.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
    }
  };

  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4">{title}</h3>
      <div className="relative">
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/80 dark:bg-slate-800/80 shadow-md"
        >
          &lt;
        </button>
        <div ref={scrollRef} className="flex gap-4 overflow-x-auto no-scrollbar py-2">
          {items.map((item) => (
            <MediaCard key={item._id} item={item} darkMode={darkMode} onPatch={onPatch} onEdit={onEdit} onShow={onShow} />
          ))}
        </div>
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/80 dark:bg-slate-800/80 shadow-md"
        >
          &gt;
        </button>
      </div>
    </div>
  );
}

interface MediaGridProps {
  items: MediaItem[];
  darkMode: boolean;
  onPatch: (id: string, updates: MediaProgress) => void;
  onEdit: (item: MediaItem) => void;
  onShow: (item: MediaItem) => void;
}

function MediaGrid({ items, darkMode, onPatch, onEdit, onShow }: MediaGridProps) {
  if (items.length === 0) return <p className="text-slate-700 dark:text-slate-300">No media to display.</p>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <MediaCard key={item._id} item={item} darkMode={darkMode} onPatch={onPatch} onEdit={onEdit} onShow={onShow} />
      ))}
    </div>
  );
}

interface MediaCardProps {
  item: MediaItem;
  darkMode: boolean;
  onPatch: (id: string, updates: MediaProgress) => void;
  onEdit: (item: MediaItem) => void;
  onShow: (item: MediaItem) => void;
}

function MediaCard({ item, darkMode, onPatch, onEdit, onShow }: MediaCardProps) {
  const progress = item.progress;

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (item.category === "manhwa") {
      onPatch(item._id, { currentChapter: value });
    } else if (item.category === "book") {
      onPatch(item._id, { currentPage: value });
    } else if (item.category === "movie") {
      onPatch(item._id, { watchPercentage: value });
    } else if (item.category === "anime" || item.category === "cartoon" || item.category === "series" || item.category === "drama") {
      onPatch(item._id, { currentEpisode: value });
    }
  };

  const handleSeasonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    onPatch(item._id, { currentSeason: value });
  };

  const handleWatchedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onPatch(item._id, { watched: e.target.checked });
  };

  return (
    <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm flex flex-col h-full">
      <img
        src={item.coverImage}
        alt={item.title}
        className="w-full h-48 object-cover rounded-t-xl cursor-pointer"
        onClick={() => onShow(item)}
      />
      <div className="p-4 flex-grow flex flex-col">
        <h3 className="text-lg font-semibold mb-1 cursor-pointer" onClick={() => onShow(item)}>{item.title}</h3>
        <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">{categoryLabel[item.category]}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 flex-grow">{item.description.substring(0, 100)}...</p>
        <div className="text-sm mb-2">
          <span className="font-medium">Progress:</span> {formatProgress(item)}
        </div>

        {item.category === "manhwa" && (
          <div className="mb-2">
            <label className="block text-sm font-medium mb-1">Chapter</label>
            <input
              type="number"
              value={progress.currentChapter ?? 0}
              onChange={handleProgressChange}
              min={0}
              max={progress.totalChapters ?? 0}
              className="inputClass"
            />
          </div>
        )}

        {(item.category === "anime" || item.category === "cartoon" || item.category === "series" || item.category === "drama") && (
          <div className="mb-2">
            <label className="block text-sm font-medium mb-1">Season {progress.currentSeason ?? 1} Episode</label>
            <input
              type="number"
              value={progress.currentEpisode ?? 0}
              onChange={handleProgressChange}
              min={0}
              max={getSeasonEpisodes(progress, progress.currentSeason ?? 1)}
              className="inputClass"
            />
            <label className="block text-sm font-medium mb-1 mt-2">Season</label>
            <input
              type="number"
              value={progress.currentSeason ?? 1}
              onChange={handleSeasonChange}
              min={1}
              max={progress.totalSeasons ?? 1}
              className="inputClass"
            />
          </div>
        )}

        {item.category === "book" && (
          <div className="mb-2">
            <label className="block text-sm font-medium mb-1">Page</label>
            <input
              type="number"
              value={progress.currentPage ?? 0}
              onChange={handleProgressChange}
              min={0}
              max={progress.totalPages ?? 0}
              className="inputClass"
            />
          </div>
        )}

        {item.category === "movie" && (
          <div className="mb-2">
            <label className="block text-sm font-medium mb-1">Watch Percentage</label>
            <input
              type="number"
              value={progress.watchPercentage ?? 0}
              onChange={handleProgressChange}
              min={0}
              max={100}
              className="inputClass"
            />
            <label className="flex items-center gap-2 text-sm mt-2">
              <input
                type="checkbox"
                checked={progress.watched ?? false}
                onChange={handleWatchedChange}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Watched</span>
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-auto">
          <button
            onClick={() => onEdit(item)}
            className="progress-btn"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

interface MultiSelectProps {
  label: string;
  selected: MediaItem[];
  options: { id: string; title: string }[];
  onChange: (ids: string[]) => void;
  darkMode: boolean;
}

function MultiSelect({ label, selected, options, onChange, darkMode }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelect = (id: string) => {
    if (selected.some(item => item._id === id)) {
      onChange(selected.filter(item => item._id !== id).map(item => item._id));
    } else {
      onChange([...selected.map(item => item._id), id]);
    }
  };

  const selectedTitles = selected.map(item => item.title).join(", ");

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full rounded-xl border p-3 text-sm text-left font-medium transition border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {label}: {selectedTitles || "None selected"}
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-xl border bg-white dark:bg-slate-900 shadow-lg max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">No options available</p>
          ) : (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelect(option.id)}
                className={cn("w-full text-left p-3 text-sm transition",
                  selected.some(item => item._id === option.id) ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                {option.title}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
