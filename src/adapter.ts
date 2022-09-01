import { type Account } from "next-auth";
import {
  type VerificationToken,
  type Adapter,
  type AdapterUser,
  type AdapterSession,
} from "next-auth/adapters";
import { type DatabasePool, sql, NotFoundError } from "slonik";

/** @return { import("next-auth/adapters").Adapter } */
export default function SlonikAdapter(client: DatabasePool): Adapter {
  return {
    async createUser({
      name,
      email,
      emailVerified,
      image,
    }: Partial<AdapterUser>) {
      const emailVerifiedDate = emailVerified ? sql.date(emailVerified) : null;
      const result: AdapterUser = await client.one(
        sql`
          insert into verification_token
            (name, email, email_verified, image)
          values
            (
              ${name || null}, ${email || null}, ${emailVerifiedDate},
              ${image || null}
            )
          returning
            name, email, image, email_verified as emailVerified
        `
      );
      return result;
    },

    async getUser(id) {
      try {
        const result: AdapterUser = await client.one(
          sql`
            select
              id, name, image, email, email_verified as emailVerified
            from users
            where users.id = ${id}
          `
        );
        return result;
      } catch (e) {
        // Throws error unless the record was simply not found
        if (e instanceof NotFoundError) {
          return null;
        } else {
          throw e;
        }
      }
    },

    async getUserByEmail(email) {
      try {
        const result: AdapterUser = await client.one(
          sql`
            select
              id, name, image, email, email_verified as emailVerified
            from users
            where users.email = ${email}
          `
        );
        return result;
      } catch (e) {
        // Throws error unless the record was simply not found
        if (e instanceof NotFoundError) {
          return null;
        } else {
          throw e;
        }
      }
    },

    async getUserByAccount({ providerAccountId, provider }) {
      try {
        const result: AdapterUser = await client.one(
          sql`
            select
              users.id, users.name, users.image, users.email,
              users.email_verified as emailVerified
            from users
            inner join accounts
              on users.id = accounts.user_id
            where accounts.provider = ${provider}
              and accounts.provider_account_id = ${providerAccountId}
          `
        );
        return result;
      } catch (e) {
        // Throws error unless the record was simply not found
        if (e instanceof NotFoundError) {
          return null;
        } else {
          throw e;
        }
      }
    },

    async updateUser({ id, ...updates }) {
      if (!id) {
        throw new Error("ID not provided for updateUser");
      }

      const user: AdapterUser = await client.one(
        sql`
          select
            id, name, image, email, email_verified as emailVerified
          from users
          where users.id = ${id}
        `
      );

      const { name, email, emailVerified, image } = {
        ...user,
        ...updates,
      };

      const emailVerifiedDate = emailVerified ? sql.date(emailVerified) : null;
      const result: AdapterUser = await client.one(
        sql`
          update users
          set
            name = ${name || null},
            email = ${email || null},
            email_verified = ${emailVerifiedDate},
            image = ${image || null}
          where id = ${id || null}
          returning
            name, email, email_verified as emailVerified, image
        `
      );

      return result;
    },

    async deleteUser(id) {
      await client.transaction(async (transactionConnection) => {
        await transactionConnection.query(
          sql`delete from users where id = ${id}`
        );
        await transactionConnection.query(
          sql`delete from sessions where "userId" = ${id}`
        );
        await transactionConnection.query(
          sql`delete from accounts where "userId" = ${id}`
        );
      });
    },

    async linkAccount({
      userId,
      provider,
      type,
      providerAccountId,
      access_token,
      expires_at,
      refresh_token,
      id_token,
      scope,
      session_state,
      token_type,
    }) {
      const result: Account = await client.one(
        sql`
          insert into accounts
            (
              user_id, provider, type, provider_account_id, access_token,
              expires_at, refresh_token, id_token, scope, session_state,
              token_type
            )
          values
            (
              ${userId}, ${provider}, ${type}, ${providerAccountId}, ${
          access_token || ""
        },
              ${expires_at || null}, ${refresh_token || null}, ${
          id_token || null
        }, ${scope || null},
              ${session_state || null}, ${token_type || null}
            )
          returning
            user_id as userId, provider, type, provider_account_id as providerAccountId,
            access_token, expires_at, refresh_token, id_token, scope, session_state,
            token_type
        `
      );
      return result;
    },

    async unlinkAccount({ providerAccountId, provider }) {
      try {
        await client.one(
          sql`
            delete from accounts
            where provider_account_id = ${providerAccountId}
              and provider = ${provider}
          `
        );
      } catch (e) {
        // Throws error unless the record was simply not found
        if (e instanceof NotFoundError) {
          return undefined;
        } else {
          throw e;
        }
      }
    },

    async createSession({ sessionToken, userId, expires }) {
      const result: AdapterSession = await client.one(
        sql`
          insert into sessions
            (user_id, expires, session_token)
          values
            (${userId}, ${sql.date(expires)}, ${sessionToken})
          returning
            id, user_id as userId, expires, session_token as sessionToken
        `
      );
      return result;
    },

    async getSessionAndUser(sessionToken) {
      const sessionResult: AdapterSession = await client.one(
        sql`
          select
            id, session_token as sessionToken, user_id as userId, expires
          from sessions
          where session_token = ${sessionToken}
        `
      );

      const userResult: AdapterUser = await client.one(
        sql`
          select
            id, name, image, email, email_verified as emailVerified
          from users
          where users.id = ${sessionResult.userId}
        `
      );

      return {
        session: sessionResult,
        user: userResult,
      };
    },

    async updateSession({ sessionToken, ...updates }) {
      const session: AdapterSession = await client.one(
        sql`
          select
            id, session_token as sessionToken, user_id as userId, expires
          from sessions
          where session_token = ${sessionToken}
        `
      );

      const { userId, expires } = {
        ...session,
        ...updates,
      };

      const result: AdapterSession = await client.one(
        sql`
          update sessions
          set
            user_id = ${userId}, expires = ${sql.date(expires)}
          where session_token = ${sessionToken}
        `
      );

      return result;
    },

    async deleteSession(sessionToken) {
      await client.one(
        sql`
          delete from sessions
          where session_token = ${sessionToken}
        `
      );
    },

    async createVerificationToken({ identifier, expires, token }) {
      const result: VerificationToken = await client.one(
        sql`
          insert into verification_token
            (identifier, expires, token)
          values
            (${identifier}, ${sql.date(expires)}, ${token})
          returning
            identifier, expires, token
        `
      );
      return result;
    },

    async useVerificationToken({ identifier, token }) {
      try {
        const result: VerificationToken = await client.one(
          sql`
            delete from verification_token
            where identifier = ${identifier}
              and token = ${token}
            returning identifier, expires, token
          `
        );
        return result;
      } catch (e) {
        // Throws error unless the record was simply not found
        if (e instanceof NotFoundError) {
          return null;
        } else {
          throw e;
        }
      }
    },
  };
}
