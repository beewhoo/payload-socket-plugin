/**
 * Minimal type definitions for Payload CMS v3
 * This allows the package to compile without having payload as a devDependency
 * The actual types come from the user's installed payload package (peerDependency)
 */

declare module "payload" {
  /**
   * Payload Config type
   * Compatible with Payload v3
   */
  export type Config = {
    collections?: CollectionConfig[];
    globals?: any[];
    plugins?: any[];
    onInit?: (payload: any) => Promise<void> | void;
    [key: string]: any;
  };

  /**
   * Collection Config type
   */
  export interface CollectionConfig {
    slug: string;
    hooks?: {
      afterChange?: Array<(args: any) => Promise<void> | void>;
      afterDelete?: Array<(args: any) => Promise<void> | void>;
      [key: string]: any;
    };
    [key: string]: any;
  }

  /**
   * Payload instance type
   */
  export type Payload = {
    logger: {
      info: (message: string, ...args: any[]) => void;
      warn: (message: string, ...args: any[]) => void;
      error: (message: string, ...args: any[]) => void;
    };
    secret: string;
    findByID: (args: any) => Promise<any>;
    [key: string]: any;
  };

  const payload: Payload;
  export default payload;
}
