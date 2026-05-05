import cors from "cors";
import express from "express";
import morgan from "morgan";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());
app.use(morgan("dev"));
/* ---------------- SUPABASE ---------------- */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase environment variables");
}
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
/* ---------------- AUTH MIDDLEWARE ---------------- */
const authMiddleware = async (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing token" });
    }
    const token = auth.replace("Bearer ", "");
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
        return res.status(401).json({ error: "Invalid token" });
    }
    req.userId = data.user.id;
    next();
};
/* ---------------- ROUTES ---------------- */
app.get("/health", (_, res) => res.json({ ok: true }));
app.use(authMiddleware);
/* -------- PROJECTS -------- */
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
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
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
    const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", req.params.id)
        .eq("user_id", userId);
    if (error)
        return res.status(400).json({ error: error.message });
    res.status(204).send();
});
/* -------- NODES -------- */
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
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
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
app.delete("/nodes/:id", async (req, res) => {
    const userId = req.userId;
    const { error } = await supabase
        .from("nodes")
        .delete()
        .eq("id", req.params.id)
        .eq("user_id", userId);
    if (error)
        return res.status(400).json({ error: error.message });
    res.status(204).send();
});
/* -------- CONNECTIONS -------- */
app.get("/connections", async (req, res) => {
    const userId = req.userId;
    const projectId = req.query.projectId;
    if (!projectId) {
        return res.status(400).json({ error: "Missing projectId" });
    }
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
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
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
    const { error } = await supabase
        .from("connections")
        .delete()
        .eq("id", req.params.id)
        .eq("user_id", userId);
    if (error) {
        return res.status(400).json({ error: error.message });
    }
    res.status(204).send();
});
export default app;
