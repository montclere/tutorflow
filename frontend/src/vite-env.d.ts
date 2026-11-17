interface ImportMetaEnv {
  readonly VITE_AUTH_MOCK?: string;
  readonly VITE_DEMO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "virtual:objects-3d" {
  const names: readonly string[];
  export default names;
}
