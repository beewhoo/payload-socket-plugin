/**
 * Minimal type definitions for Payload CMS
 * This allows the package to compile without having payload as a devDependency
 * The actual types come from the user's installed payload package (peerDependency)
 */

declare module "payload" {
  /**
   * Payload Config type
   * Compatible with both Payload v2
   */
  export type Config = {
    collections?: any[];
    globals?: any[];
    plugins?: any[];
    onInit?: (payload: any) => Promise<void> | void;
    [key: string]: any;
  };

  /**
   * Payload instance type
   */
  export type Payload = {
    logger: {
      info: (message: string, ...args: any[]) => void;
      warn: (message: string, ...args: any[]) => void;
      error: (message: string, ...args: any[]) => void;
    };
    [key: string]: any;
  };

  const payload: Payload;
  export default payload;
}

declare module "payload/config" {
  import type { Config } from "payload";
  export type { Config };
  export type Plugin = (config: Config) => Config;
}

declare module "payload/types" {
  export interface CollectionConfig {
    slug: string;
    hooks?: {
      afterChange?: Array<(args: any) => Promise<void> | void>;
      afterDelete?: Array<(args: any) => Promise<void> | void>;
      [key: string]: any;
    };
    [key: string]: any;
  }
}
