const { RedisConnection } = require("../..");


async function test() {
  try {
    console.log("Trying to create connection to redis server...");
    const conn = new RedisConnection({ password: "asdf" });

    await conn.initialize();

    console.log("==Sending ERROR command request...");
    await conn.execute([ "ssget", "test_string" ]);

  } catch (e) {
    console.error("**Err:", e);
  }
}



(async function() {
  await test();

})().catch(console.error);

