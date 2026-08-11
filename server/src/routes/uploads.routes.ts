import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createSignedUploadUrl, publicUrlFor } from "../lib/supabaseStorage";

const router = Router();

const signInput = z.object({
  fileName: z.string().min(1),
});

router.post("/sign", async (req, res, next) => {
  try {
    const { fileName } = signInput.parse(req.body);
    const parts = fileName.split(".");
    const rawExt = parts.length > 1 ? parts.pop() : undefined;
    const ext = rawExt && rawExt.length > 0 ? rawExt : "mp4";
    const path = `${randomUUID()}.${ext}`;

    const { signedUrl, token } = await createSignedUploadUrl(path);

    res.json({ uploadUrl: signedUrl, token, path, publicUrl: publicUrlFor(path) });
  } catch (err) {
    next(err);
  }
});

export default router;
