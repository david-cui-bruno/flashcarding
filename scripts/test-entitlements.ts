import assert from "node:assert/strict";
import { getEntitlement, isProRequiredError, requirePro } from "../lib/billing/entitlements";

function client(row: { plan: string | null; plan_expires_at: string | null } | null) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async single() {
                  return row ? { data: row, error: null } : { data: null, error: { message: "missing" } };
                },
              };
            },
          };
        },
      };
    },
  } as never;
}

async function main() {
  assert.deepEqual(await getEntitlement("u", client({ plan: "free", plan_expires_at: null })), {
    plan: "free",
    active: false,
  });

  assert.deepEqual(await getEntitlement("u", client({ plan: "pro", plan_expires_at: null })), {
    plan: "pro",
    active: true,
  });

  assert.deepEqual(
    await getEntitlement("u", client({ plan: "pro", plan_expires_at: "2000-01-01T00:00:00.000Z" })),
    { plan: "free", active: false },
  );

  await assert.rejects(
    () => requirePro("u", client({ plan: "free", plan_expires_at: null })),
    (error) => isProRequiredError(error) && error.status === 402,
  );
}

main().then(() => console.log("entitlements ok"));
