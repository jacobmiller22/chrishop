/**
 * Directus CMS Custom Extensions & Hooks Skeleton
 */
export interface DirectusExtensionConfig {
  name: string;
  version: string;
  enabled: boolean;
}

export const extensionConfig: DirectusExtensionConfig = {
  name: 'chrishop-cms-extensions',
  version: '0.1.0',
  enabled: true,
};

export function registerExtensions(): void {
  console.log(`[Directus CMS] Extension suite '${extensionConfig.name}' initialized.`);
}
