import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });
const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());
app.use(morgan("dev"));
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env");
}
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
const authMiddleware = async (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer "))
        return res.status(401).json({ error: "Missing token" });
    const token = auth.replace("Bearer ", "");
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user)
        return res.status(401).json({ error: "Invalid token" });
    req.userId = data.user.id;
    next();
};
app.get("/health", (_, res) => res.json({ ok: true }));
app.use(authMiddleware);
app.get("/projects", async (req, res) => {
    const userId = req.userId;
    const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
    if (error)
        return res.status(400).json({ error: error.message });
    res.json(data);
});
app.post("/projects", async (req, res) => {
    const userId = req.userId;
    const schema = z.object({ name: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const { data, error } = await supabase
        .from("projects")
        .insert({ name: parsed.data.name, user_id: userId })
        .select("*")
        .single();
    if (error)
        return res.status(400).json({ error: error.message });
    res.status(201).json(data);
});
app.delete("/projects/:id", async (req, res) => {
    const userId = req.userId;
    const { error } = await supabase.from("projects").delete().eq("id", req.params.id).eq("user_id", userId);
    if (error)
        return res.status(400).json({ error: error.message });
    res.status(204).send();
});
app.get("/nodes", async (req, res) => {
    const userId = req.userId;
    const projectId = req.query.projectId;
    const { data, error } = await supabase
        .from("nodes")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", userId);
    if (error)
        return res.status(400).json({ error: error.message });
    res.json(data);
});
app.post("/nodes", async (req, res) => {
    const userId = req.userId;
    const schema = z.object({
        projectId: z.string().uuid(),
        title: z.string().min(1),
        description: z.string().optional().default(""),
        color: z.string(),
        tags: z.array(z.string()).default([]),
        category: z.string().optional(),
        priority: z.string().optional(),
        position: z.object({ x: z.number(), y: z.number() }),
        collapsed: z.boolean().default(false)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const p = parsed.data;
    const { data, error } = await supabase
        .from("nodes")
        .insert({
        project_id: p.projectId,
        title: p.title,
        description: p.description,
        color: p.color,
        tags: p.tags,
        category: p.category ?? null,
        priority: p.priority ?? null,
        x: p.position.x,
        y: p.position.y,
        collapsed: p.collapsed,
        user_id: userId
    })
        .select("*")
        .single();
    if (error)
        return res.status(400).json({ error: error.message });
    res.status(201).json(data);
});
app.patch("/nodes/:id", async (req, res) => {
    const userId = req.userId;
    const schema = z.object({
        title: z.string().optional(),
        description: z.string().nullable().optional(),
        color: z.string().optional(),
        tags: z.array(z.string()).optional(),
        category: z.string().nullable().optional(),
        priority: z.string().nullable().optional(),
        position: z.object({ x: z.number(), y: z.number() }).optional(),
        collapsed: z.boolean().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const b = parsed.data;
    const payload = {};
    if (b.title !== undefined)
        payload.title = b.title;
    if (b.description !== undefined)
        payload.description = b.description;
    if (b.color !== undefined)
        payload.color = b.color;
    if (b.tags !== undefined)
        payload.tags = b.tags;
    if (b.category !== undefined)
        payload.category = b.category;
    if (b.priority !== undefined)
        payload.priority = b.priority;
    if (b.position !== undefined) {
        payload.x = b.position.x;
        payload.y = b.position.y;
    }
    if (b.collapsed !== undefined)
        payload.collapsed = b.collapsed;
    payload.updated_at = new Date().toISOString();
    const { data, error } = await supabase
        .from("nodes")
        .update(payload)
        .eq("id", req.params.id)
        .eq("user_id", userId)
        .select("*")
        .single();
    if (error)
        return res.status(400).json({ error: error.message });
    res.json(data);
});
app.delete("/nodes/:id", async (req, res) => {
    const userId = req.userId;
    const { error } = await supabase.from("nodes").delete().eq("id", req.params.id).eq("user_id", userId);
    if (error)
        return res.status(400).json({ error: error.message });
    res.status(204).send();
});
app.get("/connections", async (req, res) => {
    const userId = req.userId;
    const projectId = req.query.projectId;
    const { data, error } = await supabase
        .from("connections")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", userId);
    if (error)
        return res.status(400).json({ error: error.message });
    res.json(data);
});
app.post("/connections", async (req, res) => {
    const userId = req.userId;
    const schema = z.object({
        projectId: z.string().uuid(),
        fromNodeId: z.string().uuid(),
        toNodeId: z.string().uuid(),
        type: z.enum(["one-way", "bidirectional"])
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const p = parsed.data;
    const { data, error } = await supabase
        .from("connections")
        .insert({
        project_id: p.projectId,
        from_node_id: p.fromNodeId,
        to_node_id: p.toNodeId,
        relation_type: p.type,
        user_id: userId
    })
        .select("*")
        .single();
    if (error)
        return res.status(400).json({ error: error.message });
    res.status(201).json(data);
});
app.delete("/connections/:id", async (req, res) => {
    const userId = req.userId;
    const { error } = await supabase.from("connections").delete().eq("id", req.params.id).eq("user_id", userId);
    if (error)
        return res.status(400).json({ error: error.message });
    res.status(204).send();
});
const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
    console.log(`Server on :${port}`);
});
