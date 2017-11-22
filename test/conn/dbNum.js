const { RedisConnection } = require("../..");


async function test() {
  try {
    console.log("Trying to create connection to redis server...");
    const conn = new RedisConnection({ password: "asdf", dbNum: 2 });

    console.log("==Trying to set a key...");
    await conn.execute([ "set", "keyInDb2", "hello" ]);
  } catch (e) {
    console.error("**Err:", e);
  }
}


(async function() {
  await test();

})().catch(console.error);

