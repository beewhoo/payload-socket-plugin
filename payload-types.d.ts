/**
 * Minimal Payload CMS type definitions
 * This file provides just enough types to build the plugin without installing payload as a devDependency
 */

declare module "payload/config" {
  import { Express } from "express";

  export interface Config {
    collections?: CollectionConfig[];
    onInit?: (payload: any) => Promise<void> | void;
    express?: Express;
    [key: string]: any;
  }

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

declare module "payload" {
  export interface Payload {
    secret: string;
    logger: {
      info: (message: string, ...args: any[]) => void;
      warn: (message: string, ...args: any[]) => void;
      error: (message: string, ...args: any[]) => void;
    };
    express?: any;
    findByID: (options: {
      collection: string;
      id: string | number;
    }) => Promise<any>;
    [key: string]: any;
  }

  const payload: Payload;
  export default payload;
}

