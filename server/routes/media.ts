import express, { Request, Response } from "express";
import Media from "../models/media";

const router = express.Router();

// GET all media items or by category with sorting
router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, sort, order, limit } = req.query;
    let query: any = {};
    if (category && category !== "overall") {
      query.category = category;
    }

    let sortQuery: any = {};
    if (sort) {
      sortQuery[sort as string] = order === "asc" ? 1 : -1;
    } else {
      sortQuery.updatedAt = -1; // Default sort by recently updated
    }

    const media = await Media.find(query).sort(sortQuery).limit(Number(limit) || 0);
    res.json(media);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch media" });
  }
});

// GET media sections (recently updated, recommendations, random)
router.get("/sections", async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    let query: any = {};
    if (category && category !== "overall") {
      query.category = category;
    }

    const recentlyUpdated = await Media.find(query).sort({ updatedAt: -1 }).limit(8);
    const recommendations = await Media.find({ ...query, recommended: true }).limit(8);
    const random = await Media.aggregate([
      { $match: query },
      { $sample: { size: 8 } }
    ]);

    res.json({
      recentlyUpdated,
      recommendations,
      random,
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Failed to load sections" });
  }
});

// GET single media item by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) {
      return res.status(404).json({ error: "Media not found" });
    }
    res.json(media);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch media" });
  }
});

// POST create new media item
router.post("/", async (req: Request, res: Response) => {
  try {
    const { title, category, coverImage, description, genres, rating, progress } = req.body;

    const existingMedia = await Media.findOne({ title });
    if (existingMedia) {
      return res.status(400).json({ message: "Media with this title already exists." });
    }

    const newMedia = await Media.create({
      title,
      category,
      coverImage,
      description,
      genres,
      rating,
      recommended: rating >= 8.5,
      progress,
    });
    res.status(201).json(newMedia);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Failed to create media" });
  }
});

// PUT update entire media item
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { title, category, coverImage, description, genres, rating, progress } = req.body;
    const media = await Media.findByIdAndUpdate(
      req.params.id,
      {
        title,
        category,
        coverImage,
        description,
        genres,
        rating,
        recommended: rating >= 8.5,
        progress,
      },
      { new: true, runValidators: true }
    );

    if (!media) {
      return res.status(404).json({ error: "Media not found" });
    }
    res.json(media);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Failed to update media" });
  }
});

// PATCH update only progress fields
router.patch("/:id/progress", async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const media = await Media.findById(req.params.id);

    if (!media) {
      return res.status(404).json({ error: "Media not found" });
    }

    // Update only the progress subdocument fields
    for (const key in updates) {
      if (media.progress.hasOwnProperty(key)) {
        (media.progress as any)[key] = updates[key];
      }
    }

    const updatedMedia = await media.save();

    res.json(updatedMedia);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Failed to update progress" });
  }
});

// DELETE media item
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const media = await Media.findByIdAndDelete(req.params.id);
    if (!media) {
      return res.status(404).json({ error: "Media not found" });
    }
    res.json({ message: "Media deleted" });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete media" });
  }
});

export default router;
