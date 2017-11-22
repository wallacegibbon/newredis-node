const { RedisConnection } = require("../..");
const { inspect } = require("util");


async function test() {
  try {
    console.log("Trying to create connection to redis server...");
    const conn = new RedisConnection({ password: "asdf" });

    await conn.initialize();

    console.log("Sending empty array...");
    //await conn.execute([]);
    //await conn.execute([ "set" ]);
    await conn.execute({ a: 1 });
  } catch (e) {
    console.error("**Err:", e);
  }
}



(async function() {
  await test();

})().catch(console.error);

