export type { Project, ProjectLink, UserResponse, ProjectListResponse } from "./schemas";

export type ListProjectsOptions = {
  limit?: number;
};

export type FilterOptions = {
  olderThan?: string;
  namePattern?: string;
  framework?: string;
  noRepo?: boolean;
};

export type SortField = "name" | "last-deploy" | "updated";

export type SortOptions = {
  sort?: SortField;
  reverse?: boolean;
};
