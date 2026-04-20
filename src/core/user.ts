import { vercelFetch } from "./api";
import { UserResponse } from "./schemas";
import { ValidationError } from "../errors";

export type User = {
  id: string;
  username: string;
  email?: string;
  name?: string;
};

export async function getUser(token: string): Promise<User> {
  const raw = await vercelFetch(token, "GET", "/v2/user");
  try {
    return UserResponse.parse(raw).user;
  } catch (cause) {
    throw new ValidationError("/v2/user", cause);
  }
}

export async function validateToken(token: string): Promise<User> {
  return getUser(token);
}
