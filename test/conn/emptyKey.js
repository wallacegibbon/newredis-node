const { RedisConnection } = require("../..");


async function test() {
  try {
    console.log("Trying to create connection to redis server...");
    const conn = new RedisConnection({ password: "asdf" });

    console.log("==Trying to get a key who doesn't exists...");
    const r = await conn.execute([ "get", "blahblah" ]);
    console.log("r:", r);

  } catch (e) {
    console.error("**Err:", e);
  }
}


(async function() {
  await test();

})().catch(console.error);

