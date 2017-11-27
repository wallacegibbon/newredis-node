const { RedisConnection } = require("../..");


async function test() {
  try {
    console.log("Trying to create connection to redis server...");
    const conn = new RedisConnection({ password: "asdf" });
    await conn.initialize();

    const r = await conn.transaction([
      [ "set", "mycounter", 1 ],
      [ "incr", "mycounter" ],
      [ "blah" ],
      [ "incr", "mycounter" ],
      [ "incr", "mycounter" ],
    ]);

    console.log("R:", r);
  } catch (e) {
    console.error("**Err:", e);
  }
}


(async function() {
  await test();

})().catch(console.error);

