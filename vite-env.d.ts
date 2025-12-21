/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_DATABASE_URL: string;
  readonly VITE_DB_HOST: string;
  readonly VITE_DB_PORT: string;
  readonly VITE_DB_NAME: string;
  readonly VITE_DB_USER: string;
  readonly VITE_DB_PASSWORD: string;
  readonly GEMINI_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
