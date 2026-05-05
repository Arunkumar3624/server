export type Project = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  user_id: string;
};

export type IdeaNode = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  color: string;
  tags: string[];
  category: string | null;
  priority: string | null;
  x: number;
  y: number;
  collapsed: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
};

export type GraphEdge = {
  id: string;
  project_id: string;
  from_node_id: string;
  to_node_id: string;
  relation_type: "one-way" | "bidirectional";
  created_at: string;
  user_id: string;
};
