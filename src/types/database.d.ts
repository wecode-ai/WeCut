import type {
  ClipboardContentType,
  ReadClipboardItemUnion,
} from "tauri-plugin-clipboard-x-api";
import type { LiteralUnion } from "type-fest";

export type DatabaseSchemaHistorySubtype = "url" | "email" | "color" | "path";

export type DatabaseSchemaHistory<
  T extends ClipboardContentType = ClipboardContentType,
> = ReadClipboardItemUnion<T> & {
  id: string;
  group: DatabaseSchemaGroupId;
  search: string;
  favorite: boolean;
  createTime: string;
  note?: string;
  title?: string;
  subtype?: DatabaseSchemaHistorySubtype;
  sourceAppName?: string;
  sourceAppPath?: string;
  sourceAppBundleId?: string;
  sourceAppIcon?: string;
  fileSize?: number;
  fileMimeType?: string;
};

export type DatabaseSchemaGroupId = LiteralUnion<
  "all" | "text" | "image" | "files" | "favorite",
  string
>;

export interface DatabaseSchemaGroup {
  id: DatabaseSchemaGroupId;
  name: string;
  createTime?: string;
}

export interface DatabaseSchemaTag {
  id: string;
  name: string;
  color: string;
  createTime: string;
}

export interface DatabaseSchemaHistoryTag {
  historyId: string;
  tagId: string;
}

export interface DatabaseSchemaTextExpansion {
  id: string;
  triggerWord: string;
  content: string;
  variables?: string;
  sourceHistoryId?: string;
  createTime: string;
  updateTime: string;
}

export interface DatabaseSchema {
  history: DatabaseSchemaHistory;
  group: DatabaseSchemaGroup;
  tag: DatabaseSchemaTag;
  historyTag: DatabaseSchemaHistoryTag;
  textExpansion: DatabaseSchemaTextExpansion;
}
