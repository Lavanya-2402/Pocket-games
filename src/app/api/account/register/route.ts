import {
  ACCOUNT_COLS, hashPassword, loginPayload, parseForm, passwordSchema, profileSchema, setupError, usernameSchema,
  type Account,
} from "@/lib/accounts";
import { cleanAvatar, cleanColor } from "@/lib/profile";
import { db, handle, HttpError } from "@/lib/server";

const bodySchema = profileSchema.extend({ username: usernameSchema, password: passwordSchema });

/** Create an account and log this phone in. */
export function POST(req: Request) {
  return handle(async () => {

    const b = await parseForm(req, bodySchema);

    const { data, error } = await db()
      .from("accounts")
      .insert({
        username: b.username,
        display_name: b.name,
        password_hash: hashPassword(b.password),
        avatar: cleanAvatar(b.avatar),
        color: cleanColor(b.color),
      })
      .select(ACCOUNT_COLS)
      .single<Account>();
    if (error?.code === "23505") throw new HttpError(409, "That username is taken");
    if (error) setupError(error);
    return Response.json(await loginPayload(data!));
  });
}
