export type Env = {
  Bindings: {
    KV: KVNamespace;
  };
  Variables: {
    requestId: string;
    auth?: ApiKeyData;
  };
};

export type ApiKeyData = {
  key_id: string;
  prefix: string;
  plan: "free" | "pro" | "agency";
  scopes: string[];
  status: "active" | "revoked" | "expired";
  created_at: number;
  last_used_at?: number;
};
